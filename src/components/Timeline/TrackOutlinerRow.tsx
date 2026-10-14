import React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Lock, Plus, Tv, Unlock } from 'lucide-react';
import type { CharacterPart, Track, TrackChannel } from '../../types/animator';
import { CHANNEL_META, CHANNEL_ROW_HEIGHT, TRACK_ROW_HEIGHT } from './timelineConstants';
import { resolveAdjacentKeyframeFrame, resolveChannelKeyframeFrames, resolveLayerKeyframeFrames } from '../../utils/timelineMetrics';
import { InlineRename } from '../Shared/InlineRename';

interface TrackOutlinerRowProps {
  track: Track;
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
  onAddChannelKeyframe: (trackId: string, channel: TrackChannel, partId: string) => void;
  /** R3-07 — moves the playhead to a frame. Navigation only: never a document write. */
  onJumpToFrame: (frame: number) => void;
  isGroupExpanded: (key: string, defaultVal?: boolean) => boolean;
  onToggleSubGroup: (key: string, defaultVal?: boolean) => void;
}

/**
 * R3-05 — the tree label of a channel is its own name inside a named parent:
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
export const TrackOutlinerRow: React.FC<TrackOutlinerRowProps> = ({
  track,
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
  onJumpToFrame,
  isGroupExpanded,
  onToggleSubGroup,
}) => {
  // BUGFIX: the timeline label must reflect the REAL element name. The track
  // only carries partId (track.name is not serialized — after import it is a
  // generated "Track part_x" placeholder). Resolve from the part; fall back
  // to the track name only when the part is missing.
  const displayName = parts.find((p) => p.id === track.partId)?.name ?? track.name;
  const isTrackExpanded = track.expanded === true;
  const isPositionExpanded = isGroupExpanded(`${track.id}_position`, true);
  const isScaleExpanded = isGroupExpanded(`${track.id}_scale`, false);
  const isTrimPathExpanded = isGroupExpanded(`${track.id}_trim`, true);

  /**
   * R3-07 — the layer's own keyframe endpoints. Both endpoints are resolved from
   * the SAME projection the lane diamonds are painted from, so the navigation can
   * neither skip a visible keyframe nor stop on a frame the layer does not animate.
   */
  const keyframeFrames = resolveLayerKeyframeFrames(track, activeTemplateId || 'Sequence');
  const previousKeyframeFrame = resolveAdjacentKeyframeFrame(keyframeFrames, currentFrame, 'previous');
  const nextKeyframeFrame = resolveAdjacentKeyframeFrame(keyframeFrames, currentFrame, 'next');

  const renderChannelRow = (ch: TrackChannel, indentClass: string, filterByTemplate: boolean = false) => {
    const meta = CHANNEL_META[ch];
    const activeTmpl = activeTemplateId || 'Sequence';
    const chKfs = filterByTemplate
      ? (track.channels?.[ch] ?? []).filter((k) => (k.templateId || 'Sequence') === activeTmpl)
      : (track.channels?.[ch] ?? []);
    /*
     * R4-05 — the property's OWN endpoints, resolved from the same channel
     * projection the property's lane diamonds are painted from: the arrows can
     * neither skip a key this property holds nor stop on a frame that belongs to
     * a sibling channel. Same policy as the layer pair (see
     * `resolveAdjacentKeyframeFrame`): nothing on a side disables that side, and
     * navigation never wraps.
     */
    const channelKeyframeFrames = resolveChannelKeyframeFrames(track, ch, activeTmpl);
    const previousChannelFrame = resolveAdjacentKeyframeFrame(channelKeyframeFrames, currentFrame, 'previous');
    const nextChannelFrame = resolveAdjacentKeyframeFrame(channelKeyframeFrames, currentFrame, 'next');
    return (
      <div
        key={ch}
        className="ue-channel-row"
        data-owner-part-id={track.partId}
        data-property-channel={ch}
        style={{ height: CHANNEL_ROW_HEIGHT }}
      >
        <span className={indentClass} />
        {/* R3-06 — the row states the property, not how many keys it holds: the
            diamonds on the lane are the count, and a bare counter next to every
            property row was pure noise.
            R5-07 — the row is neutral too: no coloured tick and no tinted label,
            because the channel colour already lives on the lane keyframes and
            the connector the row belongs to. */}
        <span className="ue-channel-label" title={`${meta.label}${chKfs.length ? ` — ${chKfs.length} keyframe${chKfs.length === 1 ? '' : 's'}` : ''}`}>
          {TREE_LABEL[ch] ?? meta.label}
        </span>
        <div className="ue-channel-controls">
          {/* [◀][+][▶] scoped to THIS property — the layer row's own trio, one
              level down: the row states its property, its nav strip states the
              property's keys. The strip is neutral (R5-06/R5-07): a plain plus
              adds the key, a greyed pair means that side has nothing. */}
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
            onClick={(e) => { e.stopPropagation(); onAddChannelKeyframe(track.id, ch, track.partId); }}
            title={`Add ${meta.label} keyframe`}
            aria-label={`Add ${meta.label} keyframe`}
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
    <div key={track.id} className="ue-track-group">
      {/* ── LAYER ROW ── */}
      <div
        className={`ue-track-row ${isSelected ? 'selected' : ''}`}
        style={{ height: TRACK_ROW_HEIGHT, paddingLeft: isChildLayer ? 22 : 8 }}
        onClick={(e) => onSelect(track.partId, e.shiftKey)}
      >
        {isChildLayer && (
          <span style={{ fontSize: 10, color: 'var(--accent-cyan)', fontWeight: 800, marginRight: -2 }}>└─</span>
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
          <button className="btn-icon track-icon-btn" onClick={(e) => { e.stopPropagation(); onToggleLock(track.id); }} title={track.locked ? 'Unlock' : 'Lock Layer'}>
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
          {renderGroupHeader(`${track.id}_position`, 'Position', isPositionExpanded, true)}
          {isPositionExpanded && ['x', 'y'].map((chKey) => renderChannelRow(chKey as TrackChannel, 'ue-channel-indent-deep'))}

          {/* Rotation is one channel: it is a leaf of the tree, not a group. */}
          {renderChannelRow('rotation', 'ue-channel-indent', true)}

          {renderGroupHeader(`${track.id}_scale`, 'Scale', isScaleExpanded, false)}
          {isScaleExpanded && ['scaleX', 'scaleY'].map((chKey) => renderChannelRow(chKey as TrackChannel, 'ue-channel-indent-deep'))}

          {renderChannelRow('opacity', 'ue-channel-indent')}

          {/* Trim Path is a peer of the transform channels, not one of their children. */}
          {renderGroupHeader(`${track.id}_trim`, 'Trim Path', isTrimPathExpanded, true)}
          {isTrimPathExpanded && ['trimPathStart', 'trimPathEnd', 'trimPathOffset'].map((chKey) => renderChannelRow(chKey as TrackChannel, 'ue-channel-indent-deep'))}
        </div>
      )}
    </div>
  );
};
