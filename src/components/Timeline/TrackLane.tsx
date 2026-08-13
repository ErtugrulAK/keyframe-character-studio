import React from 'react';
import type { Track, TrackChannel } from '../../types/animator';
import { CHANNEL_META, CHANNEL_ROW_HEIGHT, TRACK_ROW_HEIGHT } from './timelineConstants';
import { groupChannelKeyframesByFrame } from '../../utils/channelKeyframeGroups';
import { hasChannelDataForTemplate } from '../../utils/timelineMetrics';

interface TrackLaneProps {
  track: Track;
  isSelected: boolean;
  selectedKeyframeId: string | null;
  frameWidth: number;
  totalFrames: number;
  activeTemplateId: string | null;
  isGroupExpanded: (key: string, defaultVal?: boolean) => boolean;
  onSelectKeyframe: (id: string | null) => void;
  onSelectPart: (partId: string, shiftKey: boolean) => void;
  onSetFrame: (frame: number) => void;
  onStartDragKf: (drag: { trackId: string; keyframeId: string }) => void;
  onStartDragPKf: (drag: { trackId: string; channel: TrackChannel; keyframeId: string }) => void;
  onHoverKf: (hover: { frame: number; label: string } | null) => void;
  onDeleteKeyframe: (trackId: string, keyframeId: string) => void;
  onDeletePropertyKeyframe: (trackId: string, channel: TrackChannel, keyframeId: string) => void;
}

/**
 * One track's lane group in the timeline grid: the parent lane with composite
 * keyframe diamonds and span bars, plus the channel lanes (trajectory lines
 * and property diamonds) when the track is expanded.
 */
export const TrackLane: React.FC<TrackLaneProps> = ({
  track,
  isSelected,
  selectedKeyframeId,
  frameWidth,
  totalFrames,
  activeTemplateId,
  isGroupExpanded,
  onSelectKeyframe,
  onSelectPart,
  onSetFrame,
  onStartDragKf,
  onStartDragPKf,
  onHoverKf,
  onDeleteKeyframe,
  onDeletePropertyKeyframe,
}) => {
  const isTrackExpanded = track.expanded === true;
  const isTransformExpanded = isGroupExpanded(`${track.id}_transform`, true);
  const isLocationExpanded = isGroupExpanded(`${track.id}_location`, true);
  const isRotationExpanded = isGroupExpanded(`${track.id}_rotation`, false);
  const isScaleExpanded = isGroupExpanded(`${track.id}_scale`, false);

  const activeTmpl = activeTemplateId || 'Sequence';
  // M6: canonical frame-group model — one timeline point per frame.
  // Legacy composite keyframes are only rendered for tracks that have NO
  // channel data (imported old projects), keeping legacy compatibility.
  const useCanonical = hasChannelDataForTemplate(track, activeTmpl);
  const groups = groupChannelKeyframesByFrame(track.channels, activeTmpl);
  const activeKfs = (track.keyframes || []).filter((k) => (k.templateId || 'Sequence') === activeTmpl);
  const sortedKfs = [...activeKfs].sort((a, b) => a.frame - b.frame);

  // Delete every channel keyframe at a frame (frame-group delete, same as
  // KeyframesTab handleDelete).
  const handleDeleteGroup = (e: React.MouseEvent, frame: number) => {
    e.preventDefault();
    const group = groups.find((g) => g.frame === frame);
    if (!group) return;
    for (const ch of group.channels) {
      const kf = group.keyframes[ch];
      if (kf) onDeletePropertyKeyframe(track.id, ch, kf.id);
    }
  };

  const renderChannelLane = (ch: TrackChannel) => {
    const meta = CHANNEL_META[ch];
    const chKfs = [...(track.channels?.[ch] ?? [])]
      .filter((k) => (k.templateId || 'Sequence') === activeTmpl)
      .sort((a, b) => a.frame - b.frame);
    return (
      <div key={ch} className="ue-channel-lane" style={{ height: CHANNEL_ROW_HEIGHT, width: `${(totalFrames + 3) * frameWidth}px`, backgroundSize: `${frameWidth}px 100%` }}>
        {/* Horizontal connecting trajectory line for keyframes (Unreal Engine style) */}
        {chKfs.length > 0 && (
          <div
            className="ue-trajectory-line"
            style={{
              left: `${chKfs[0].frame * frameWidth}px`,
              width: `${(chKfs[chKfs.length - 1].frame - chKfs[0].frame) * frameWidth}px`,
              backgroundColor: meta.color,
            }}
          />
        )}
        {chKfs.map((pkf) => (
          <div
            key={pkf.id}
            className="ue-prop-diamond"
            style={{ left: `${pkf.frame * frameWidth}px`, '--diamond-color': meta.color } as React.CSSProperties}
            onMouseDown={(e) => { e.stopPropagation(); onStartDragPKf({ trackId: track.id, channel: ch, keyframeId: pkf.id }); onSetFrame(pkf.frame); }}
            onMouseEnter={() => onHoverKf({ frame: pkf.frame, label: `${meta.label}: ${pkf.value.toFixed(2)}` })}
            onMouseLeave={() => onHoverKf(null)}
            onContextMenu={(e) => { e.preventDefault(); onDeletePropertyKeyframe(track.id, ch, pkf.id); }}
            title={`${meta.label} = ${pkf.value.toFixed(2)} @ F${pkf.frame}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div key={track.id} className="ue-lane-group">
      {/* ── PARENT LANE (composite keyframes) ── */}
      <div
        className={`ue-track-lane ${isSelected ? 'selected' : ''}`}
        style={{ height: TRACK_ROW_HEIGHT, width: `${(totalFrames + 3) * frameWidth}px`, backgroundSize: `${frameWidth}px 100%`, position: 'relative' }}
      >
        {/* Span bars between composite keyframes (legacy-only track view) */}
        {!useCanonical && sortedKfs.map((kf, idx) => {
          if (idx === sortedKfs.length - 1) return null;
          const nextKf = sortedKfs[idx + 1];
          return (
            <div
              key={`span-${kf.id}`}
              className="keyframe-span-bar"
              style={{ left: `${kf.frame * frameWidth}px`, width: `${(nextKf.frame - kf.frame) * frameWidth}px`, borderColor: track.color }}
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
            frame-group model; legacy tracks keep the span bars above). */}
        {useCanonical && groups.length > 1 && (
          <div
            className="ue-trajectory-line"
            style={{
              left: `${groups[0].frame * frameWidth}px`,
              width: `${(groups[groups.length - 1].frame - groups[0].frame) * frameWidth}px`,
              backgroundColor: track.color,
            }}
          />
        )}
        {/* M6: canonical frame-group diamonds (one per frame, channel info in hover/title) */}
        {useCanonical ? groups.map((group) => {
          const representativeId = group.keyframes[group.channels[0]].id;
          const isKfSelected = selectedKeyframeId === representativeId;
          return (
            <div
              key={representativeId}
              className={`keyframe-diamond ${isKfSelected ? 'selected' : ''}`}
              style={{ left: `${group.frame * frameWidth}px`, borderColor: track.color }}
              onClick={(e) => { e.stopPropagation(); onSelectKeyframe(representativeId); onSelectPart(track.partId, e.shiftKey); onSetFrame(group.frame); }}
              onMouseDown={(e) => {
                // BUGFIX: canonical frame-group diamonds are draggable too —
                // the drag moves the WHOLE frame group (all channel keyframes
                // at this frame stay together). Legacy tracks already dragged
                // composite keyframes; canonical tracks had no drag at all.
                e.stopPropagation();
                onStartDragKf({ trackId: track.id, keyframeId: representativeId });
                onSelectKeyframe(representativeId);
              }}
              onMouseEnter={() => onHoverKf({ frame: group.frame, label: `${track.name} | ${group.channels.join(',')} | ${group.easing}` })}
              onMouseLeave={() => onHoverKf(null)}
              onContextMenu={(e) => handleDeleteGroup(e, group.frame)}
              title={`[${track.name}] Frame: ${group.frame} | ${group.channels.join(', ')} | ${group.easing} (Right-click: Delete)`}
            >
              <div className="diamond-inner" style={{ backgroundColor: track.color }} />
            </div>
          );
        }) : activeKfs.map((kf) => {
          const isKfSelected = selectedKeyframeId === kf.id;
          return (
            <div
              key={kf.id}
              className={`keyframe-diamond ${isKfSelected ? 'selected' : ''}`}
              style={{ left: `${kf.frame * frameWidth}px`, borderColor: track.color }}
              onClick={(e) => { e.stopPropagation(); onSelectKeyframe(kf.id); onSelectPart(track.partId, e.shiftKey); onSetFrame(kf.frame); }}
              onMouseDown={(e) => { e.stopPropagation(); onStartDragKf({ trackId: track.id, keyframeId: kf.id }); onSelectKeyframe(kf.id); }}
              onMouseEnter={() => onHoverKf({ frame: kf.frame, label: `${track.name} | ${kf.easing}` })}
              onMouseLeave={() => onHoverKf(null)}
              onContextMenu={(e) => { e.preventDefault(); onDeleteKeyframe(track.id, kf.id); }}
              title={`[${track.name}] Frame: ${kf.frame} | ${kf.easing} (Right-click: Delete)`}
            >
              <div className="diamond-inner" style={{ backgroundColor: track.color }} />
            </div>
          );
        })}
      </div>

      {/* ── CHANNEL LANES MATCHING SUB-GROUPS ── */}
      {isTrackExpanded && (
        <div className="ue-channel-lanes">
          {/* Transform Header Lane Spacer */}
          <div className="ue-channel-header-lane" style={{ height: CHANNEL_ROW_HEIGHT, width: `${(totalFrames + 3) * frameWidth}px`, backgroundSize: `${frameWidth}px 100%` }} />

          {isTransformExpanded && (
            <>
              {/* Location Header Lane Spacer */}
              <div className="ue-channel-header-lane" style={{ height: CHANNEL_ROW_HEIGHT, width: `${(totalFrames + 3) * frameWidth}px`, backgroundSize: `${frameWidth}px 100%` }} />
              {isLocationExpanded && ['x', 'y'].map((chKey) => renderChannelLane(chKey as TrackChannel))}

              {/* Rotation Header Lane Spacer */}
              <div className="ue-channel-header-lane" style={{ height: CHANNEL_ROW_HEIGHT, width: `${(totalFrames + 3) * frameWidth}px`, backgroundSize: `${frameWidth}px 100%` }} />
              {isRotationExpanded && ['rotation'].map((chKey) => renderChannelLane(chKey as TrackChannel))}

              {/* Scale Header Lane Spacer */}
              <div className="ue-channel-header-lane" style={{ height: CHANNEL_ROW_HEIGHT, width: `${(totalFrames + 3) * frameWidth}px`, backgroundSize: `${frameWidth}px 100%` }} />
              {isScaleExpanded && ['scaleX', 'scaleY'].map((chKey) => renderChannelLane(chKey as TrackChannel))}

              {/* Opacity Channel Lane */}
              {['opacity'].map((chKey) => renderChannelLane(chKey as TrackChannel))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
