import React, { useState, useRef, useEffect } from 'react';
import type { Track, TrackChannel, AnimationChannel, LayerMaskChannel, LayerMaskPathChannel, PropertyKeyframe, PathKeyframe, Transform } from '../../types/animator';
import type { KeyframeCopyPayload } from '../../utils/keyframeCopyPaste';
import { CHANNEL_META, CHANNEL_ROW_HEIGHT, KEYFRAME_DRAG_THRESHOLD_PX, KEYFRAME_GLYPH_GAP_PX, TRACK_ROW_HEIGHT } from './timelineConstants';
import { groupChannelKeyframesByFrame, resolveTrackChannels } from '../../utils/channelKeyframeGroups';
import { hasChannelDataForTemplate, resolveConnectorSegments } from '../../utils/timelineMetrics';
import { resolveLaneRows } from './timelineLaneLayout';

interface TrackLaneProps {
  track: Track;
  /**
   * The layer's own authored pose (`authoredBasePose`). The lane projection uses
   * it to tell a legacy composite property that animates (or holds a pose the
   * layer does not own) from one that only re-states the layer's pose, so a
   * property row can never show keys for a property the composite never moves.
   */
  basePose?: Partial<Transform>;
  isSelected: boolean;
  /** Every selected keyframe id (the store's canonical selection). */
  selectedKeyframeIds: string[];
  frameWidth: number;
  totalFrames: number;
  activeTemplateId: string | null;
  isGroupExpanded: (key: string, defaultVal?: boolean) => boolean;
  /** Replace the selection with this one key (null clears it). */
  onSelectKeyframe: (id: string | null) => void;
  /** Add/remove one key, leaving the rest of the selection alone. */
  onToggleKeyframe: (id: string) => void;
  onSelectPart: (partId: string, shiftKey: boolean) => void;
  onSetFrame: (frame: number) => void;
  /**
   * A keyframe press armed a drag. The handler resolves the moving set itself: a
   * press on an already-selected keyframe keeps the selection, so the whole
   * selected set moves as one (`selectedKeyframeIds` is the only selection
   * store). The pointer identity and the pressed element travel with the press so
   * the timeline can own the gesture with pointer capture.
   */
  onStartDragKf: (drag: KeyframePress) => void;
  onStartDragPKf: (drag: KeyframePress & { channel: AnimationChannel }) => void;
  onHoverKf: (hover: { frame: number; label: string } | null) => void;
  onDeleteKeyframe: (trackId: string, keyframeId: string) => void;
  onDeletePropertyKeyframe: (trackId: string, channel: AnimationChannel, keyframeId: string) => void;
  /** Delete every keyframe of one frame group (all stores) of a track. */
  onDeleteKeyframeGroup: (trackId: string, frame: number) => void;
  onUpdateMaskPathKeyframeFrame: (trackId: string, channel: LayerMaskPathChannel, keyframeId: string, frame: number) => void;
  onDeleteMaskPathKeyframe: (trackId: string, channel: LayerMaskPathChannel, keyframeId: string) => void;
  onDuplicateKeyframeGroup: (trackId: string, frame: number) => void;
  kfClipboard: KeyframeCopyPayload | null;
  onCopyKeyframes: (trackId: string, frame: number) => void;
  onPasteKeyframes: (trackId: string, frame: number) => void;
  onFrameFromClientX: (clientX: number) => number;
}

/**
 * One track's lane group in the timeline grid: the parent lane with composite
 * keyframe diamonds and span bars, plus the channel lanes (trajectory lines
 * and property diamonds) when the track is expanded.
 */

/**
 * Diamonds that participate in the local arrow-key focus walk inside one lane.
 */
const LANE_DIAMOND_SELECTOR = '.keyframe-diamond, .ue-prop-diamond';

/**
 * The press that arms a keyframe drag: which key was grabbed, on which track,
 * with which multi-select modifier, and which pointer owns the gesture. The
 * pressed element travels with it so the timeline can capture that pointer —
 * every later pointer event of the gesture is then delivered to the element the
 * user actually pressed, wherever the pointer travels.
 */
export interface KeyframePress {
  trackId: string;
  keyframeId: string;
  additive: boolean;
  pointerId: number;
  clientX: number;
  captureTarget: Element | null;
  /** Alt arms the K2 duplicate gesture instead of a move. */
  altKey: boolean;
}

/**
 * The modifier that means "fold this key into the selection instead of
 * replacing it": Shift, the multi-select modifier the outliner and the canvas
 * already use, with Ctrl/Cmd as its platform echo.
 */
const isAdditiveSelection = (event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean =>
  event.shiftKey || event.ctrlKey || event.metaKey;

/**
 * Keyboard contract for a timeline diamond: focusable button semantics, an
 * accessible name, the selected state, Enter/Space activation, and a local
 * ArrowLeft/ArrowRight focus walk across the diamonds of the same lane.
 * The walk is DOM-sibling based on purpose: diamonds are rendered in frame
 * order inside one absolutely positioned lane, so focus order equals time order.
 */
const diamondKeyboardProps = (
  label: string,
  isSelected: boolean,
  onActivate: () => void,
): React.HTMLAttributes<HTMLDivElement> => ({
  role: 'button',
  tabIndex: 0,
  'aria-label': label,
  'aria-pressed': isSelected,
  onKeyDown: (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onActivate();
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    // The key belongs to the lane walk even at its ends: consume it so the
    // browser does not scroll the timeline and no outer handler sees it.
    event.preventDefault();
    event.stopPropagation();
    const lane = event.currentTarget.parentElement;
    if (!lane) return;
    const diamonds = Array.from(lane.querySelectorAll<HTMLElement>(LANE_DIAMOND_SELECTOR));
    const next = diamonds[diamonds.indexOf(event.currentTarget) + (event.key === 'ArrowLeft' ? -1 : 1)];
    next?.focus();
  },
});

const TrackLaneView: React.FC<TrackLaneProps> = ({
  track,
  basePose,
  isSelected,
  selectedKeyframeIds,
  frameWidth,
  totalFrames,
  activeTemplateId,
  isGroupExpanded,
  onSelectKeyframe,
  onToggleKeyframe,
  onSelectPart,
  onSetFrame,
  onStartDragKf,
  onStartDragPKf,
  onHoverKf,
  onDeleteKeyframe,
  onDeletePropertyKeyframe,
  onDeleteKeyframeGroup,
  onUpdateMaskPathKeyframeFrame: _onUpdateMaskPathKeyframeFrame,
  onDeleteMaskPathKeyframe,
  onDuplicateKeyframeGroup,
  kfClipboard,
  onCopyKeyframes,
  onPasteKeyframes,
  onFrameFromClientX,
}) => {
  const isTrackExpanded = track.expanded === true;

  // M27 — minimal keyframe context menu (right-click on any keyframe).
  // The menu exposes "Duplicate Keyframes" (whole frame-group, 27A helper)
  // next to the existing Delete action. Clicking outside closes it.
  const [kfMenu, setKfMenu] = useState<{
    trackId: string;
    frame: number;
    x: number;
    y: number;
    onDelete: () => void;
  } | null>(null);
  const kfMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!kfMenu) return;
    const handleGlobalClick = (e: MouseEvent) => {
      if (kfMenuRef.current && !kfMenuRef.current.contains(e.target as Node)) {
        setKfMenu(null);
      }
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, [kfMenu]);
  const openKfMenu = (e: React.MouseEvent, frame: number, onDelete: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    setKfMenu({ trackId: track.id, frame, x: e.clientX, y: e.clientY, onDelete });
  };

  // M28 — paste menu on an EMPTY timeline location of this lane (no
  // keyframe): target frame = the exact right-clicked frame (28B passes the
  // existing mouse→frame conversion from SequencerTimeline; no reimplemented
  // math here). Only offered when the timeline keyframe clipboard holds data.
  const [pasteMenu, setPasteMenu] = useState<{ frame: number; x: number; y: number } | null>(null);
  const pasteMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!pasteMenu) return;
    const handleGlobalClick = (e: MouseEvent) => {
      if (pasteMenuRef.current && !pasteMenuRef.current.contains(e.target as Node)) {
        setPasteMenu(null);
      }
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, [pasteMenu]);
  const openPasteMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!kfClipboard) return; // no clipboard → no paste action offered
    setPasteMenu({ frame: onFrameFromClientX(e.clientX), x: e.clientX, y: e.clientY });
  };

  const activeTmpl = activeTemplateId || 'Sequence';
  // M6/R3-10: ONE read truth. The layer row and the channel lanes are both
  // projections of the keyframes the evaluator resolves (`resolveTrackChannels`),
  // so no store — canonical or legacy — can show on one row and hide on another.
  const resolvedChannels = resolveTrackChannels(track, basePose);
  const useCanonical = hasChannelDataForTemplate(track, activeTmpl);
  const groups = groupChannelKeyframesByFrame(resolvedChannels, activeTmpl);
  const activeKfs = (track.keyframes || []).filter((k) => (k.templateId || 'Sequence') === activeTmpl);
  const sortedKfs = [...activeKfs].sort((a, b) => a.frame - b.frame);
  const selectedKeyframeIdSet = new Set(selectedKeyframeIds);
  /** Client X of the press that is still in flight, to tell a click from a drag. */
  const keyPressOriginRef = useRef<number | null>(null);

  /**
   * A keyframe click either replaces the keyframe selection or folds this single key
   * into it, according to the multi-select modifier — unless the press was the
   * end of a DRAG. A drag moves the selection it started from, so the click the
   * browser fires afterwards must not collapse that set to the key under the
   * pointer. A press that did not travel is a click and selects as it always has.
   *
   * R5-05: the frame cursor travels with the same decision. What a click reveals
   * (the frame of the key it landed on) is a READ of the key under the pointer,
   * and after a drag that key is somewhere else: following it would move the
   * playhead to wherever the drag released, so the whole reveal is suppressed
   * together with the selection it belongs to.
   */
  const handleKeyframeClick = (event: React.MouseEvent, id: string, additive: boolean, frame: number) => {
    const origin = keyPressOriginRef.current;
    keyPressOriginRef.current = null;
    if (origin && Math.abs(event.clientX - origin) > KEYFRAME_DRAG_THRESHOLD_PX) return;
    if (additive) onToggleKeyframe(id);
    else onSelectKeyframe(id);
    onSetFrame(frame);
  };

  /**
   * A keyframe press arms the drag. A key that is already part of the selection
   * keeps it — that is what lets a marquee/Shift selection be moved as one set —
   * while a press on an unselected key selects exactly that key. The press itself
   * writes no animation: the timeline turns it into a gesture (and one history
   * transaction) only once the pointer travels past the drag threshold.
   */
  const beginKeyframePress = (event: React.PointerEvent, id: string): void => {
    const additive = isAdditiveSelection(event);
    keyPressOriginRef.current = event.clientX;
    if (!additive && !selectedKeyframeIdSet.has(id)) onSelectKeyframe(id);
  };

  /**
   * Delete one frame group. The frame — not a channel id — identifies it, so a
   * frame whose keys come from the legacy composite list is deleted just like a
   * canonical one (the layer row never offers an action it cannot perform).
   */
  const handleDeleteGroup = (e: React.MouseEvent, frame: number) => {
    e.preventDefault();
    onDeleteKeyframeGroup(track.id, frame);
  };
  const renderChannelLane = (ch: AnimationChannel) => {
    const isPathChannel = ch.endsWith(':path');
    const baseMeta = !ch.includes(':') ? CHANNEL_META[ch as TrackChannel] : undefined;
    const meta = baseMeta ?? {
      label: `Mask ${ch.split(':').slice(1).join(' ')}`,
      color: isPathChannel ? '#38bdf8' : '#f59e0b',
      shortLabel: isPathChannel ? 'P' : 'M',
    };
    const source = isPathChannel
      ? track.maskPathChannels?.[ch as LayerMaskPathChannel]
      : ch.includes(':')
        ? track.maskChannels?.[ch as LayerMaskChannel]
        : resolvedChannels[ch as TrackChannel];
    const chKfs = [...(source ?? [])]
      .filter((keyframe) => (keyframe.templateId || 'Sequence') === activeTmpl)
      .sort((a, b) => a.frame - b.frame) as (PropertyKeyframe | PathKeyframe)[];
    return (
      <div key={ch} className="ue-channel-lane" data-lane-channel={ch} style={{ height: CHANNEL_ROW_HEIGHT, width: `${(totalFrames + 3) * frameWidth}px`, backgroundSize: `${frameWidth}px 100%` }}>
        {chKfs.length > 0 && resolveConnectorSegments(
          chKfs.map((keyframe) => keyframe.frame),
          frameWidth,
          KEYFRAME_GLYPH_GAP_PX,
        ).map((segment, index) => (
          <div
            key={`trajectory-${index}`}
            className="ue-trajectory-line"
            style={{ left: `${segment.left}px`, width: `${segment.width}px`, backgroundColor: meta.color }}
          />
        ))}
        {chKfs.map((keyframe) => {
          const valueLabel = isPathChannel ? 'geometry' : String((keyframe as PropertyKeyframe).value.toFixed(2));
          const isSelected = selectedKeyframeIdSet.has(keyframe.id);
          const onDelete = isPathChannel
            ? () => onDeleteMaskPathKeyframe(track.id, ch as LayerMaskPathChannel, keyframe.id)
            : () => onDeletePropertyKeyframe(track.id, ch, keyframe.id);
          return (
            <div
              key={keyframe.id}
              className={`ue-prop-diamond ${isSelected ? 'selected' : ''}`}
              data-keyframe-id={keyframe.id}
              style={{ left: `${keyframe.frame * frameWidth}px`, color: meta.color } as React.CSSProperties}
              onClick={(e) => { e.stopPropagation(); handleKeyframeClick(e, keyframe.id, isAdditiveSelection(e), keyframe.frame); }}
              onPointerDown={(e) => {
                e.stopPropagation();
                beginKeyframePress(e, keyframe.id);
                onStartDragPKf({
                  trackId: track.id,
                  channel: ch,
                  keyframeId: keyframe.id,
                  additive: isAdditiveSelection(e),
                  pointerId: e.pointerId,
                  clientX: e.clientX,
                  captureTarget: e.currentTarget,
                  altKey: e.altKey,
                });
              }}
              onMouseEnter={() => onHoverKf({ frame: keyframe.frame, label: `${meta.label}: ${valueLabel}` })}
              onMouseLeave={() => onHoverKf(null)}
              onContextMenu={(e) => openKfMenu(e, keyframe.frame, onDelete)}
              title={`${meta.label} = ${valueLabel} @ F${keyframe.frame} (Right-click: menu)`}
              {...diamondKeyboardProps(
                `Keyframe at frame ${keyframe.frame}, ${meta.label}, value ${valueLabel}`,
                isSelected,
                () => { onSelectKeyframe(keyframe.id); onSetFrame(keyframe.frame); },
              )}
            >
              <span className="diamond-glyph" aria-hidden="true" />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div key={track.id} className="ue-lane-group" data-owner-part-id={track.partId}>
      {/* ── PARENT LANE (composite keyframes) ── */}
      <div
        className={`ue-track-lane ${isSelected ? 'selected' : ''}`}
        style={{ height: TRACK_ROW_HEIGHT, width: `${(totalFrames + 3) * frameWidth}px`, backgroundSize: `${frameWidth}px 100%`, position: 'relative' }}
        onContextMenu={openPasteMenu}
      >
        {/* Span bars between composite keyframes (legacy-only track view).
            R4-08: the bar is the legacy connector, so it clears the glyph at
            either end exactly like the canonical connector below. */}
        {!useCanonical && sortedKfs.map((kf, idx) => {
          if (idx === sortedKfs.length - 1) return null;
          const nextKf = sortedKfs[idx + 1];
          const span = (nextKf.frame - kf.frame) * frameWidth;
          const width = span - KEYFRAME_GLYPH_GAP_PX * 2;
          if (width <= 0) return null;
          return (
            <div
              key={`span-${kf.id}`}
              className="keyframe-span-bar"
              style={{ left: `${kf.frame * frameWidth + KEYFRAME_GLYPH_GAP_PX}px`, width: `${width}px`, borderColor: track.color }}
              title={`${kf.easing} (${kf.frame}→${nextKf.frame})`}
            >
              <span className="span-easing-tag">{kf.easing}</span>
            </div>
          );
        })}
        {/* BUGFIX: canonical (channel-based) tracks show the SAME horizontal
            connecting trajectory line on the parent lane as the channel lanes
            do — frame-group diamonds at different frames now display the
            interpolation connection that actually exists at runtime (M6
            frame-group model; legacy tracks keep the span bars above).
            R4-08: one segment per gap, cleared of both glyphs. */}
        {useCanonical && resolveConnectorSegments(
          groups.map((group) => group.frame),
          frameWidth,
          KEYFRAME_GLYPH_GAP_PX,
        ).map((segment, index) => (
          <div
            key={`trajectory-${index}`}
            className="ue-trajectory-line"
            style={{ left: `${segment.left}px`, width: `${segment.width}px`, backgroundColor: track.color }}
          />
        ))}
        {/* M6: canonical frame-group diamonds (one per frame, channel info in hover/title) */}
        {useCanonical ? groups.map((group) => {
          const representativeId = group.keyframes[group.channels[0]].id;
          const isKfSelected = selectedKeyframeIdSet.has(representativeId);
          return (
            <div
              key={representativeId}
              className={`keyframe-diamond ${isKfSelected ? 'selected' : ''}`}
              data-keyframe-id={representativeId}
              style={{ left: `${group.frame * frameWidth}px`, color: track.color }}
              onClick={(e) => { e.stopPropagation(); handleKeyframeClick(e, representativeId, isAdditiveSelection(e), group.frame); onSelectPart(track.partId, e.shiftKey); }}
              onPointerDown={(e) => {
                // Canonical frame-group diamonds drag the WHOLE frame group (all
                // channel keyframes at this frame stay together), or the whole
                // selected set when this diamond is part of one (R3-04).
                e.stopPropagation();
                beginKeyframePress(e, representativeId);
                onStartDragKf({
                  trackId: track.id,
                  keyframeId: representativeId,
                  additive: isAdditiveSelection(e),
                  pointerId: e.pointerId,
                  clientX: e.clientX,
                  captureTarget: e.currentTarget,
                  altKey: e.altKey,
                });
              }}
              onMouseEnter={() => onHoverKf({ frame: group.frame, label: `${track.name} | ${group.channels.join(',')} | ${group.easing}` })}
              onMouseLeave={() => onHoverKf(null)}
              onContextMenu={(e) => openKfMenu(e, group.frame, () => handleDeleteGroup(e, group.frame))}
              title={`[${track.name}] Frame: ${group.frame} | ${group.channels.join(', ')} | ${group.easing} (Right-click: menu)`}
              {...diamondKeyboardProps(
                `Keyframe at frame ${group.frame}, ${track.name}, channels ${group.channels.join(', ')}, ${group.easing}`,
                isKfSelected,
                () => { onSelectKeyframe(representativeId); onSelectPart(track.partId, false); onSetFrame(group.frame); },
              )}
            >
              <span className="diamond-glyph" aria-hidden="true" />
            </div>
          );
        }) : sortedKfs.map((kf) => {
          const isKfSelected = selectedKeyframeIdSet.has(kf.id);
          return (
            <div
              key={kf.id}
              className={`keyframe-diamond ${isKfSelected ? 'selected' : ''}`}
              data-keyframe-id={kf.id}
              style={{ left: `${kf.frame * frameWidth}px`, color: track.color }}
              onClick={(e) => { e.stopPropagation(); handleKeyframeClick(e, kf.id, isAdditiveSelection(e), kf.frame); onSelectPart(track.partId, e.shiftKey); }}
              onPointerDown={(e) => {
                e.stopPropagation();
                beginKeyframePress(e, kf.id);
                onStartDragKf({
                  trackId: track.id,
                  keyframeId: kf.id,
                  additive: isAdditiveSelection(e),
                  pointerId: e.pointerId,
                  clientX: e.clientX,
                  captureTarget: e.currentTarget,
                  altKey: e.altKey,
                });
              }}
              onMouseEnter={() => onHoverKf({ frame: kf.frame, label: `${track.name} | ${kf.easing}` })}
              onMouseLeave={() => onHoverKf(null)}
              onContextMenu={(e) => openKfMenu(e, kf.frame, () => onDeleteKeyframe(track.id, kf.id))}
              title={`[${track.name}] Frame: ${kf.frame} | ${kf.easing} (Right-click: menu)`}
              {...diamondKeyboardProps(
                `Keyframe at frame ${kf.frame}, ${track.name}, ${kf.easing}`,
                isKfSelected,
                () => { onSelectKeyframe(kf.id); onSelectPart(track.partId, false); onSetFrame(kf.frame); },
              )}
            >
              <span className="diamond-glyph" aria-hidden="true" />
            </div>
          );
        })}
      </div>

      {/* ── CHANNEL LANES MATCHING THE PROPERTY TREE ── */}
      {/* R4-06: one lane per property row, in tree order — the tree row and its
          lane are always the same band. There is no `Transform` band, because
          the tree has no `Transform` row: Position / Rotation / Scale / Opacity
          are the layer's own properties, and Trim Path is their peer. */}
      {isTrackExpanded && (
        <div className="ue-channel-lanes">
          {/* The row order (Position header, x/y, Rotation, Scale header, …,
              Opacity, Trim Path, then the K3 mask channels) is
              `resolveLaneRows` — the layout the timeline marquee hit-tests (C5),
              so the property tree, the lanes and the marquee stay row-for-row
              aligned. */}
          {resolveLaneRows(track, isGroupExpanded).map((row) => {
            if (row.kind === 'track') return null;
            if (row.kind === 'header') {
              return <div key={`header-${row.group}`} className="ue-channel-header-lane" style={{ height: CHANNEL_ROW_HEIGHT, width: `${(totalFrames + 3) * frameWidth}px`, backgroundSize: `${frameWidth}px 100%` }} />;
            }
            return renderChannelLane(row.channel);
          })}
        </div>
      )}

      {/* M27 — keyframe context menu (Duplicate frame-group / Delete) */}
      {kfMenu && (
        <div
          ref={kfMenuRef}
          role="menu"
          aria-label="Keyframe actions"
          style={{
            position: 'fixed',
            left: kfMenu.x,
            top: kfMenu.y,
            zIndex: 1000,
            minWidth: 160,
            background: '#1e2430',
            border: '1px solid #39415a',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            padding: '4px 0',
          }}
        >
          <button
            type="button"
            role="menuitem"
            aria-label="Copy Keyframes"
            title="Copy the whole keyframe group at this frame to the timeline clipboard"
            className="timeline-menu-item"
            style={{
              display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
              color: '#dbe3f0', fontSize: 11, fontWeight: 600, padding: '6px 12px', cursor: 'pointer',
            }}
            onClick={() => {
              onCopyKeyframes(kfMenu.trackId, kfMenu.frame);
              setKfMenu(null);
            }}
          >
            Copy Keyframes
          </button>
          <button
            type="button"
            role="menuitem"
            aria-label="Duplicate Keyframes"
            title="Duplicate the whole keyframe group at this frame (frame + 1)"
            className="timeline-menu-item"
            style={{
              display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
              color: '#dbe3f0', fontSize: 11, fontWeight: 600, padding: '6px 12px', cursor: 'pointer',
            }}
            onClick={() => {
              onDuplicateKeyframeGroup(kfMenu.trackId, kfMenu.frame);
              setKfMenu(null);
            }}
          >
            Duplicate Keyframes
          </button>
          <button
            type="button"
            role="menuitem"
            aria-label="Delete Keyframe"
            title="Delete the keyframe(s) at this frame"
            className="timeline-menu-item"
            style={{
              display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
              color: '#f87171', fontSize: 11, fontWeight: 600, padding: '6px 12px', cursor: 'pointer',
            }}
            onClick={() => {
              kfMenu.onDelete();
              setKfMenu(null);
            }}
          >
            Delete Keyframe
          </button>
        </div>
      )}

      {/* M28 — paste menu on an empty timeline location (only with clipboard) */}
      {pasteMenu && (
        <div
          ref={pasteMenuRef}
          role="menu"
          aria-label="Timeline actions"
          style={{
            position: 'fixed',
            left: pasteMenu.x,
            top: pasteMenu.y,
            zIndex: 1000,
            minWidth: 160,
            background: '#1e2430',
            border: '1px solid #39415a',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            padding: '4px 0',
          }}
        >
          <button
            type="button"
            role="menuitem"
            aria-label="Paste Keyframes"
            title="Paste the copied keyframe group at this frame"
            className="timeline-menu-item"
            style={{
              display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
              color: '#dbe3f0', fontSize: 11, fontWeight: 600, padding: '6px 12px', cursor: 'pointer',
            }}
            onClick={() => {
              onPasteKeyframes(track.id, pasteMenu.frame);
              setPasteMenu(null);
            }}
          >
            Paste Keyframes
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * C3 — a lane draws no playhead state, so it re-renders only when its own
 * props change; the parent passes stable actions and a memoized base pose.
 */
export const TrackLane = React.memo(TrackLaneView);
