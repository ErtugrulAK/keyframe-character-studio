import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Lock, Plus, Tv, Unlock } from 'lucide-react';
import type { AnimationChannel, CharacterPart, LayerMaskChannel, LayerMaskPathChannel, Track, TrackChannel } from '../../types/animator';
import { laneContextOf, resolveLaneRows } from './timelineLaneLayout';
import { CHANNEL_META, CHANNEL_ROW_HEIGHT, TRACK_ROW_HEIGHT } from './timelineConstants';
import { resolveAdjacentKeyframeFrame, resolveChannelAnimationState, resolveChannelKeyframeFrames, resolveLayerKeyframeFrames } from '../../utils/timelineMetrics';
import { resolveAuthoredBasePose } from '../../utils/channelKeyframeGroups';
import { InlineRename } from '../Shared/InlineRename';

interface TrackOutlinerRowProps {
  track: Track;
  /** The layer's derived display ordinal (shared with the Outliner). */
  ordinal?: number;
  /** Total layer count, for the ordinal's description. */
  layerCount?: number;
  /** BUGFIX: parts resolve the real element name — the track only carries
   *  partId (track.name may be a generated "Track part_x" placeholder after
   *  import, since the name field is not serialized). */
  parts: CharacterPart[];
  isChildLayer: boolean;
  isSelected: boolean;
  editingPartId: string | null;
  editingNameValue: string;
  currentFrame: number;
  activeTemplateId: string | null;
  onSelect: (partId: string, shiftKey: boolean) => void;
  onStartEdit: (partId: string, name: string) => void;
  onEnterCommit: (partId: string, name: string) => void;
  onCancelEdit: () => void;
  onToggleExpand: (trackId: string) => void;
  onToggleEditVisible: (trackId: string) => void;
  onToggleVisible: (trackId: string) => void;
  onToggleLock: (trackId: string) => void;
  onAddKeyframe: (trackId: string, frame: number) => void;
  onAddChannelKeyframe: (trackId: string, channel: AnimationChannel, partId: string) => void;
  /** K1 (D2) — arm an unanimated property (C10: its "+"), or ask to remove all its keys (C10: the row's menu). */
  onToggleChannelAnimation: (trackId: string, channel: AnimationChannel) => void;
  /** Moves the playhead to a frame. Navigation only: never a document write. */
  onJumpToFrame: (frame: number) => void;
  isGroupExpanded: (key: string, defaultVal?: boolean) => boolean;
  onToggleSubGroup: (key: string, defaultVal?: boolean) => void;
}

/**
 * The tree label of a channel is its own name inside a named parent:
 * the hierarchy reads Layer > Transform > { Position > {X, Y}, Rotation,
 * Scale > {X, Y}, Opacity } and Layer > Trim Path > {Start, End, Offset}. The
 * full channel name stays on the row's own add button and on the lane diamonds,
 * where no parent row carries the context.
 */
const TREE_LABEL: Partial<Record<TrackChannel, string>> = {
  x: 'X',
  y: 'Y',
  scaleX: 'X',
  scaleY: 'Y',
  trimPathStart: 'Start',
  trimPathEnd: 'End',
  trimPathOffset: 'Offset',
};

/** A mask property row reads like other motion tools: Path, Feather, Opacity, Expansion. */
const MASK_PROPERTY_LABEL: Record<string, string> = {
  path: 'Path',
  feather: 'Feather',
  opacity: 'Opacity',
  expansion: 'Expansion',
};

/** Every disclosure row shows the same chevron, at the same size. */
const DisclosureChevron: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <span className="ue-sub-chevron">
    {expanded ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
  </span>
);

/** Enter/Space activate a disclosure row the same way a click does. */
const activateOnKey = (toggle: () => void) => (event: React.KeyboardEvent) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  toggle();
};

/**
 * One outliner track group: the layer row plus the Transform / sub-group
 * channel rows that appear when the track is expanded.
 *
 * Every property row belongs to exactly one layer: the whole property block
 * carries `data-owner-part-id`, and each header names its owner in its
 * accessible name, so a Transform row can never read as an orphan that belongs
 * to no layer (or to the timeline as a whole).
 */
const TrackOutlinerRowView: React.FC<TrackOutlinerRowProps> = ({
  track,
  ordinal,
  layerCount,
  parts,
  isChildLayer,
  isSelected,
  editingPartId,
  editingNameValue,
  currentFrame,
  activeTemplateId,
  onSelect,
  onStartEdit,
  onEnterCommit,
  onCancelEdit,
  onToggleExpand,
  onToggleEditVisible,
  onToggleVisible,
  onToggleLock,
  onAddKeyframe,
  onAddChannelKeyframe,
  onToggleChannelAnimation,
  onJumpToFrame,
  isGroupExpanded,
  onToggleSubGroup,
}) => {
  // BUGFIX: the timeline label must reflect the REAL element name. The track
  // only carries partId (track.name is not serialized — after import it is a
  // generated "Track part_x" placeholder). Resolve from the part; fall back
  // to the track name only when the part is missing.
  const displayName = parts.find((p) => p.id === track.partId)?.name ?? track.name;
  // The layer's own authored pose: the proof the projection needs to keep a
  // property row's keys to the properties the animation actually moves (see
  // `resolveTrackChannels`). Navigation reads exactly what the rows draw.
  const basePose = resolveAuthoredBasePose(parts, track.partId);
  const isTrackExpanded = track.expanded === true;
  // A property row's right-click menu (only for an animated property).
  const [channelMenu, setChannelMenu] = useState<{ channel: AnimationChannel; label: string; x: number; y: number } | null>(null);
  const channelMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!channelMenu) return undefined;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && channelMenuRef.current?.contains(event.target as Node)) return;
      setChannelMenu(null);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [channelMenu]);
  // The layer's masks name their property groups.
  const owningPart = parts.find((p) => p.id === track.partId);
  const partMasks = owningPart?.masks ?? [];

  /**
   * The layer's own keyframe endpoints. Both endpoints are resolved from
   * the SAME projection the lane diamonds are painted from, so the navigation can
   * neither skip a visible keyframe nor stop on a frame the layer does not animate.
   */
  const keyframeFrames = resolveLayerKeyframeFrames(track, activeTemplateId || 'Sequence', basePose);
  const previousKeyframeFrame = resolveAdjacentKeyframeFrame(keyframeFrames, currentFrame, 'previous');
  const nextKeyframeFrame = resolveAdjacentKeyframeFrame(keyframeFrames, currentFrame, 'next');

  const channelKeysFor = (ch: AnimationChannel): { templateId?: string; frame: number }[] =>
    ch.endsWith(':path')
      ? (track.maskPathChannels?.[ch as LayerMaskPathChannel] ?? [])
      : ch.includes(':')
        ? (track.maskChannels?.[ch as LayerMaskChannel] ?? [])
        : (track.channels?.[ch as TrackChannel] ?? []);
  const channelMetaFor = (ch: AnimationChannel): { label: string; color: string; shortLabel: string } => {
    if (!ch.includes(':')) return CHANNEL_META[ch as TrackChannel];
    const [maskId, property] = ch.split(':');
    const mask = partMasks.find((m) => m.id === maskId);
    return {
      label: `${mask?.name ?? maskId} ${property}`,
      color: property === 'path' ? '#76aaed' : '#f59e0b',
      shortLabel: property === 'path' ? 'P' : 'M',
    };
  };
  const renderChannelRow = (ch: AnimationChannel, indentClass: string, filterByTemplate: boolean = false) => {
    const meta = channelMetaFor(ch);
    const isPathChannel = ch.endsWith(':path');
    const activeTmpl = activeTemplateId || 'Sequence';
    const storeKeys = channelKeysFor(ch);
    const chKfs = filterByTemplate ? storeKeys.filter((k) => (k.templateId || 'Sequence') === activeTmpl) : storeKeys;
    /*
     * The property's OWN endpoints, resolved from the same channel
     * projection the property's lane diamonds are painted from: the arrows can
     * neither skip a key this property holds nor stop on a frame that belongs to
     * a sibling channel. Same policy as the layer pair (see
     * `resolveAdjacentKeyframeFrame`): nothing on a side disables that side, and
     * navigation never wraps.
     */
    const channelKeyframeFrames = resolveChannelKeyframeFrames(track, ch, activeTmpl, basePose);
    const previousChannelFrame = resolveAdjacentKeyframeFrame(channelKeyframeFrames, currentFrame, 'previous');
    const nextChannelFrame = resolveAdjacentKeyframeFrame(channelKeyframeFrames, currentFrame, 'next');
    const animationState = resolveChannelAnimationState(track, ch, currentFrame, activeTmpl);
    return (
      <div
        key={ch}
        className="ue-channel-row"
        data-owner-part-id={track.partId}
        data-property-channel={ch}
        data-animation-state={animationState}
        style={{ height: CHANNEL_ROW_HEIGHT }}
        onContextMenu={(event) => {
          // "Remove all keyframes" replaces the stopwatch's disarm.
          event.preventDefault();
          event.stopPropagation();
          setChannelMenu(animationState === 'off' ? null : { channel: ch, label: meta.label, x: event.clientX, y: event.clientY });
        }}
      >
        <span className={indentClass} />
        {/* R3-06 — the row states the property, not how many keys it holds: the
            diamonds on the lane are the count, and a bare counter next to every
            property row was pure noise.
            R5-07 — the row is neutral too: no coloured tick and no tinted label,
            because the channel colour already lives on the lane keyframes and
            the connector the row belongs to. */}
        <span className="ue-channel-label" title={`${meta.label}${chKfs.length ? ` — ${chKfs.length} keyframe${chKfs.length === 1 ? '' : 's'}` : ''}`}>
          {TREE_LABEL[ch as TrackChannel] ?? (ch.includes(':') ? MASK_PROPERTY_LABEL[ch.slice(ch.lastIndexOf(':') + 1)] ?? meta.label : meta.label)}
        </span>
        <div className="ue-channel-controls">
          {/* [◀][+][▶] scoped to THIS property — the layer row's own trio, one
              level down: the row states its property, its nav strip states the
              property's keys. The strip is neutral (R5-06/R5-07): a plain plus
              adds the key, a greyed pair means that side has nothing. */}
          {/* C10 — no stopwatch (QA: it confused more than it helped). The plus
              starts a property's animation with its first key, like any later
              key; removing all of a property's keys is the row's right-click
              menu. A mask PATH row's plus arms the path at the playhead (the
              shape shown there becomes the first key); later path keys come
              from editing the path on the canvas or in the Inspector. */}
          <button
            className="btn-icon track-icon-btn"
            onClick={(e) => { e.stopPropagation(); if (previousChannelFrame !== null) onJumpToFrame(previousChannelFrame); }}
            disabled={previousChannelFrame === null}
            title={previousChannelFrame === null
              ? `${meta.label} of ${displayName} has no earlier keyframe`
              : `Go to the previous ${meta.label} keyframe of ${displayName} (frame ${previousChannelFrame})`}
            aria-label={previousChannelFrame === null
              ? `Previous ${meta.label} keyframe of ${displayName} (none)`
              : `Previous ${meta.label} keyframe of ${displayName}, frame ${previousChannelFrame}`}
          >
            <ChevronLeft size={13} aria-hidden="true" />
          </button>
          <button
            className="btn-icon track-add-kf-btn"
            data-property-channel={ch}
            onClick={(e) => {
              e.stopPropagation();
              if (animationState === 'off') onToggleChannelAnimation(track.id, ch);
              else onAddChannelKeyframe(track.id, ch, track.partId);
            }}
            disabled={isPathChannel && animationState !== 'off'}
            title={isPathChannel && animationState !== 'off'
              ? `${meta.label} geometry is authored on the path lane`
              : `Add ${meta.label} keyframe`}
            aria-label={isPathChannel && animationState !== 'off'
              ? `${meta.label} keyframes are authored on the path lane`
              : `Add ${meta.label} keyframe`}
          >
            <Plus size={12} aria-hidden="true" />
          </button>
          <button
            className="btn-icon track-icon-btn"
            onClick={(e) => { e.stopPropagation(); if (nextChannelFrame !== null) onJumpToFrame(nextChannelFrame); }}
            disabled={nextChannelFrame === null}
            title={nextChannelFrame === null
              ? `${meta.label} of ${displayName} has no later keyframe`
              : `Go to the next ${meta.label} keyframe of ${displayName} (frame ${nextChannelFrame})`}
            aria-label={nextChannelFrame === null
              ? `Next ${meta.label} keyframe of ${displayName} (none)`
              : `Next ${meta.label} keyframe of ${displayName}, frame ${nextChannelFrame}`}
          >
            <ChevronRight size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  };

  /** One named parent row of the property tree (same shape, same chevron). */
  const renderGroupHeader = (
    key: string,
    label: string,
    expanded: boolean,
    defaultExpanded: boolean,
    indentClass: string = 'ue-header-indent',
  ) => (
    <div
      className="ue-subgroup-header"
      data-owner-part-id={track.partId}
      data-property-group={key}
      aria-label={`${label} properties of ${displayName}`}
      aria-expanded={expanded}
      role="button"
      tabIndex={0}
      title={`${label} properties of ${displayName}`}
      style={{ height: CHANNEL_ROW_HEIGHT }}
      onClick={() => onToggleSubGroup(key, defaultExpanded)}
      onKeyDown={activateOnKey(() => onToggleSubGroup(key, defaultExpanded))}
    >
      <span className={indentClass} />
      <DisclosureChevron expanded={expanded} />
      <span className="ue-subgroup-label">{label}</span>
    </div>
  );

  return (
    <div key={track.id} className="ue-track-group" data-track-row-id={track.id} data-track-part-id={track.partId}>
      {/* ── LAYER ROW ── */}
      <div
        className={`ue-track-row ${isSelected ? 'selected' : ''}`}
        style={{ height: TRACK_ROW_HEIGHT, paddingLeft: isChildLayer ? 22 : 8 }}
        onClick={(e) => onSelect(track.partId, e.shiftKey)}
      >
        {isChildLayer && (
          <span style={{ fontSize: 10, color: 'var(--accent-cyan)', fontWeight: 600, marginRight: -2 }}>└─</span>
        )}

        <button
          className="ue-expand-btn"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(track.id); }}
          title={isTrackExpanded ? 'Collapse' : 'Expand properties'}
          aria-label={`${isTrackExpanded ? 'Collapse' : 'Expand'} properties of ${displayName}`}
          aria-expanded={isTrackExpanded}
        >
          {isTrackExpanded ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
        </button>

        {ordinal !== undefined && (
          <span
            className="layer-ordinal"
            data-layer-ordinal={ordinal}
            title={`Position ${ordinal}${layerCount ? ` of ${layerCount}` : ''} in the layer list — a display number, not an ID`}
          >
            {ordinal}
          </span>
        )}
        <span className="ue-color-dot" style={{ backgroundColor: track.color }} />

        {editingPartId === track.partId ? (
          <InlineRename
            value={editingNameValue}
            ariaLabel={`Rename layer ${displayName}`}
            className="ue-track-name-edit"
            onCommit={(next) => onEnterCommit(track.partId, next)}
            onCancel={onCancelEdit}
          />
        ) : (
          <span
            className="ue-track-name"
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartEdit(track.partId, track.name);
            }}
            title="Double-click to rename layer"
          >
            {displayName}
          </span>
        )}

        <div className="ue-track-controls">
          {/* 1. Edit Canvas Hard-Hide Eye */}
          <button
            className={`btn-icon track-icon-btn ${track.editVisible === false ? 'muted' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleEditVisible(track.id); }}
            title={track.editVisible !== false ? 'Edit Canvas Eye: Visible & Editable on Canvas' : 'Edit Canvas Eye: HARD HIDDEN from Canvas (Completely Non-interactive & Non-clickable)'}
          >
            {track.editVisible !== false ? <Eye size={12} className="text-teal" /> : <EyeOff size={12} style={{ color: '#ef4444' }} />}
          </button>

          {/* 2. Broadcast Live Mute TV */}
          <button
            className={`btn-icon track-icon-btn ${!track.visible ? 'muted' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleVisible(track.id); }}
            title={track.visible ? 'Broadcast Live Eye: Included in Live Director Reji' : 'Broadcast Live Eye: MUTED from Live Director Reji'}
          >
            {track.visible ? <Tv size={12} style={{ color: '#10b981' }} /> : <Tv size={12} style={{ color: '#ef4444', opacity: 0.5 }} />}
          </button>

          {/* 3. Lock Button */}
          <button type="button" className={`btn-icon track-icon-btn${track.locked ? ' is-locked' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleLock(track.id); }} title={track.locked ? 'Unlock (Ctrl+L)' : 'Lock Layer (Ctrl+L)'} aria-label={`${track.locked ? 'Unlock' : 'Lock'} ${displayName}`} aria-pressed={Boolean(track.locked)}>
            {track.locked ? <Lock size={12} className="text-gold" /> : <Unlock size={12} />}
          </button>

          {/*
            R3-07 — [◀][+][▶] around the layer's own keyframe action. The arrows
            move the PLAYHEAD to the nearest keyframe of this layer on either
            side (every canonical channel counts, through the lane projection);
            they write no keyframe, and they disable themselves when the layer
            has nothing on that side.
          */}
          <button
            className="btn-icon track-icon-btn"
            onClick={(e) => { e.stopPropagation(); if (previousKeyframeFrame !== null) onJumpToFrame(previousKeyframeFrame); }}
            disabled={previousKeyframeFrame === null}
            title={previousKeyframeFrame === null
              ? `${displayName} has no earlier keyframe`
              : `Go to the previous keyframe of ${displayName} (frame ${previousKeyframeFrame})`}
            aria-label={previousKeyframeFrame === null
              ? `Previous keyframe of ${displayName} (none)`
              : `Previous keyframe of ${displayName}, frame ${previousKeyframeFrame}`}
          >
            <ChevronLeft size={13} aria-hidden="true" />
          </button>

          {/* 4. Add Keyframe Button */}
          {/* The frame is resolved by the parent at call time: a collapsed row
              is not re-rendered for every playhead frame (C3). */}
          <button className="btn-icon track-add-kf-btn" onClick={(e) => { e.stopPropagation(); onAddKeyframe(track.id, currentFrame); }} title="Add Composite Keyframe">
            <Plus size={12} />
          </button>

          <button
            className="btn-icon track-icon-btn"
            onClick={(e) => { e.stopPropagation(); if (nextKeyframeFrame !== null) onJumpToFrame(nextKeyframeFrame); }}
            disabled={nextKeyframeFrame === null}
            title={nextKeyframeFrame === null
              ? `${displayName} has no later keyframe`
              : `Go to the next keyframe of ${displayName} (frame ${nextKeyframeFrame})`}
            aria-label={nextKeyframeFrame === null
              ? `Next keyframe of ${displayName} (none)`
              : `Next keyframe of ${displayName}, frame ${nextKeyframeFrame}`}
          >
            <ChevronRight size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── TRANSFORM & TRIM PATH PROPERTY TREES (when expanded) ── */}
      {isTrackExpanded && (
        <div
          className="ue-channel-group"
          data-owner-part-id={track.partId}
          data-owner-name={displayName}
          aria-label={`Properties of ${displayName}`}
          role="group"
        >
          {/*
            R4-06 — the tree is the animation's own hierarchy, with no redundant
            wrapper row:
              Position > {X, Y}, Rotation, Scale > {X, Y}, Opacity, Trim Path >
              {Start, End, Offset}
            `Transform` stays the INTERNAL name of the model (the channels and the
            evaluator), but it is not a level the user has to read through: the
            layer row is the owner, and these are its properties. The lanes mirror
            the tree row for row, so a property row and its lane are always the
            same band.
          */}
          {/* C7 — the rows come from `resolveLaneRows`, the same model the
              lanes, the marquee and the row heights use (so tree row N and
              lane N are always the same property). Order, as in other motion
              tools: Position, Scale, Rotation, Opacity; Trim Paths only when
              the layer uses it; then one group per mask (Path, Feather,
              Opacity, Expansion). */}
          {resolveLaneRows(track, isGroupExpanded, laneContextOf(owningPart)).map((row) => {
            if (row.kind === 'track') return null;
            if (row.kind === 'header') {
              const key = `${track.id}_${row.group}`;
              return <React.Fragment key={key}>{renderGroupHeader(key, row.label, isGroupExpanded(key, row.defaultExpanded), row.defaultExpanded)}</React.Fragment>;
            }
            return renderChannelRow(row.channel, row.depth === 2 ? 'ue-channel-indent-deep' : 'ue-channel-indent', true);
          })}
        </div>
      )}
      {channelMenu && createPortal(
        <div
          ref={channelMenuRef}
          role="menu"
          aria-label={`${channelMenu.label} of ${displayName}`}
          className="editor-context-menu timeline-channel-menu"
          style={{ position: 'fixed', left: channelMenu.x, top: channelMenu.y, zIndex: 1000, minWidth: 180 }}
        >
          <button
            type="button"
            role="menuitem"
            className="timeline-menu-item editor-context-menu-item"
            autoFocus
            title={`Delete every ${channelMenu.label} keyframe of ${displayName} in this sequence (asks first)`}
            onClick={() => {
              const { channel } = channelMenu;
              setChannelMenu(null);
              onToggleChannelAnimation(track.id, channel);
            }}
          >
            Remove all keyframes
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
};

/** The previous/next keyframe a collapsed row offers at `frame` — all it shows of the playhead. */
const collapsedRowNavigation = (props: TrackOutlinerRowProps): string => {
  const frames = resolveLayerKeyframeFrames(props.track, props.activeTemplateId || 'Sequence', resolveAuthoredBasePose(props.parts, props.track.partId));
  return `${resolveAdjacentKeyframeFrame(frames, props.currentFrame, 'previous')}:${resolveAdjacentKeyframeFrame(frames, props.currentFrame, 'next')}`;
};

/**
 * A playhead frame re-renders only what shows the frame. Every prop is
 * compared by identity (the parent passes stable actions that read the latest
 * handlers at call time), except the frame: an expanded row shows per-channel
 * state at the frame, a collapsed one only its previous/next keyframe
 * navigation, so it re-renders when that navigation changes.
 */
const sameRowProps = (prev: TrackOutlinerRowProps, next: TrackOutlinerRowProps): boolean => {
  const keys = Object.keys(next) as (keyof TrackOutlinerRowProps)[];
  if (keys.length !== Object.keys(prev).length) return false;
  if (keys.some((key) => key !== 'currentFrame' && prev[key] !== next[key])) return false;
  if (prev.currentFrame === next.currentFrame) return true;
  if (next.track.expanded === true) return false;
  return collapsedRowNavigation(prev) === collapsedRowNavigation(next);
};

export const TrackOutlinerRow = React.memo(TrackOutlinerRowView, sameRowProps);
