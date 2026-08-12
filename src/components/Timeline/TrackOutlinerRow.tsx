import React from 'react';
import { ChevronDown, ChevronRight, Diamond, Eye, EyeOff, Lock, Plus, Tv, Unlock } from 'lucide-react';
import type { CharacterPart, Track, TrackChannel } from '../../types/animator';
import { CHANNEL_META, CHANNEL_ROW_HEIGHT, TRACK_ROW_HEIGHT } from './timelineConstants';

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
  onChangeEditValue: (value: string) => void;
  onEnterCommit: (partId: string, name: string) => void;
  onBlurCommit: (partId: string, name: string) => void;
  onCancelEdit: () => void;
  onToggleExpand: (trackId: string) => void;
  onToggleEditVisible: (trackId: string) => void;
  onToggleVisible: (trackId: string) => void;
  onToggleLock: (trackId: string) => void;
  onAddKeyframe: (trackId: string, frame: number) => void;
  onAddChannelKeyframe: (trackId: string, channel: TrackChannel, partId: string) => void;
  isGroupExpanded: (key: string, defaultVal?: boolean) => boolean;
  onToggleSubGroup: (key: string, defaultVal?: boolean) => void;
}

/**
 * One outliner track group: the layer row plus the Transform / sub-group
 * channel rows that appear when the track is expanded.
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
  onChangeEditValue,
  onEnterCommit,
  onBlurCommit,
  onCancelEdit,
  onToggleExpand,
  onToggleEditVisible,
  onToggleVisible,
  onToggleLock,
  onAddKeyframe,
  onAddChannelKeyframe,
  isGroupExpanded,
  onToggleSubGroup,
}) => {
  // BUGFIX: the timeline label must reflect the REAL element name. The track
  // only carries partId (track.name is not serialized — after import it is a
  // generated "Track part_x" placeholder). Resolve from the part; fall back
  // to the track name only when the part is missing.
  const displayName = parts.find((p) => p.id === track.partId)?.name ?? track.name;
  const isTrackExpanded = track.expanded === true;
  const isTransformExpanded = isGroupExpanded(`${track.id}_transform`, true);
  const isLocationExpanded = isGroupExpanded(`${track.id}_location`, true);
  const isRotationExpanded = isGroupExpanded(`${track.id}_rotation`, false);
  const isScaleExpanded = isGroupExpanded(`${track.id}_scale`, false);

  const renderChannelRow = (ch: TrackChannel, indentClass: string, filterByTemplate: boolean = false) => {
    const meta = CHANNEL_META[ch];
    const activeTmpl = activeTemplateId || 'Sequence';
    // NOTE: only the rotation channel filters by template in the original
    // outliner; location/scale/opacity show the unfiltered count.
    const chKfs = filterByTemplate
      ? (track.channels?.[ch] ?? []).filter((k) => (k.templateId || 'Sequence') === activeTmpl)
      : (track.channels?.[ch] ?? []);
    return (
      <div key={ch} className="ue-channel-row" style={{ height: CHANNEL_ROW_HEIGHT }}>
        <span className={indentClass} />
        <span className="ue-channel-color-bar" style={{ backgroundColor: meta.color }} />
        <span className="ue-channel-label" style={{ color: meta.color }}>{meta.label}</span>
        <span className="ue-kf-count" style={{ color: meta.color }}>{chKfs.length}</span>
        <button
          className="btn-icon track-add-kf-btn"
          style={{ color: meta.color }}
          onClick={() => onAddChannelKeyframe(track.id, ch, track.partId)}
          title={`Add ${meta.label} keyframe`}
        >
          <Diamond size={11} />
        </button>
      </div>
    );
  };

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
        >
          {isTrackExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        <span className="ue-color-dot" style={{ backgroundColor: track.color }} />

        {/* Double-Click Inline Renaming */}
        {editingPartId === track.partId ? (
          <input className="input-control"
        type="text"
            autoFocus
            value={editingNameValue}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onChangeEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onEnterCommit(track.partId, editingNameValue);
              } else if (e.key === 'Escape') {
                onCancelEdit();
              }
            }}
            onBlur={() => {
              onBlurCommit(track.partId, editingNameValue);
            }}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--accent-cyan)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: 3,
              outline: 'none',
              maxWidth: 130,
            }}
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

          {/* 4. Add Keyframe Button */}
          <button className="btn-icon track-add-kf-btn" onClick={(e) => { e.stopPropagation(); onAddKeyframe(track.id, currentFrame); }} title="Add Composite Keyframe">
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* ── TRANSFORM & SUB-GROUPS (when expanded) ── */}
      {isTrackExpanded && (
        <div className="ue-channel-group">
          {/* Transform Category Header */}
          <div
            className="ue-transform-header"
            style={{ height: CHANNEL_ROW_HEIGHT }}
            onClick={() => onToggleSubGroup(`${track.id}_transform`, true)}
          >
            <span className="ue-sub-chevron">{isTransformExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
            <span className="ue-transform-label">Transform</span>
          </div>

          {isTransformExpanded && (
            <>
              {/* 1. Location Sub-Group */}
              <div
                className="ue-subgroup-header"
                style={{ height: CHANNEL_ROW_HEIGHT }}
                onClick={() => onToggleSubGroup(`${track.id}_location`, true)}
              >
                <span className="ue-sub-chevron">{isLocationExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
                <span className="ue-subgroup-label">Location</span>
              </div>

              {isLocationExpanded && ['x', 'y'].map((chKey) => renderChannelRow(chKey as TrackChannel, 'ue-channel-indent'))}

              {/* 2. Rotation Sub-Group */}
              <div
                className="ue-subgroup-header"
                style={{ height: CHANNEL_ROW_HEIGHT }}
                onClick={() => onToggleSubGroup(`${track.id}_rotation`, false)}
              >
                <span className="ue-sub-chevron">{isRotationExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
                <span className="ue-subgroup-label">Rotation</span>
              </div>

              {isRotationExpanded && ['rotation'].map((chKey) => renderChannelRow(chKey as TrackChannel, 'ue-channel-indent', true))}

              {/* 3. Scale Sub-Group */}
              <div
                className="ue-subgroup-header"
                style={{ height: CHANNEL_ROW_HEIGHT }}
                onClick={() => onToggleSubGroup(`${track.id}_scale`, false)}
              >
                <span className="ue-sub-chevron">{isScaleExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
                <span className="ue-subgroup-label">Scale</span>
              </div>

              {isScaleExpanded && ['scaleX', 'scaleY'].map((chKey) => renderChannelRow(chKey as TrackChannel, 'ue-channel-indent'))}

              {/* 4. Opacity Row */}
              {['opacity'].map((chKey) => renderChannelRow(chKey as TrackChannel, 'ue-channel-indent-sm'))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
