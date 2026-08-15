import React from 'react';
import type { Track, TrackChannel, Transform } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { groupChannelKeyframesByFrame } from '../../../../utils/channelKeyframeGroups';
import { CHANNEL_META } from '../../../Timeline/timelineConstants';

/**
 * M29 29A — SELECTED KEYFRAME SECTION (TransformTab).
 *
 * Pure presentational layer over the EXISTING mutation pipeline: when a
 * keyframe is selected (and the playhead is still on its frame), show a
 * compact "Selected Keyframe @ F" block listing ONLY the channels that
 * actually hold a keyframe at F, with their RAW stored values.
 *
 * Editing goes through the existing `updateCurrentTransform` →
 * applyTransformToChannels path (currentFrame === keyframe frame), so:
 *   - easing / bezierControlPoints / templateId are preserved
 *   - unrelated channels are never touched (per-channel typeof guard)
 *   - SmartNumberInput deferCommit keeps one logical history edit per commit
 *
 * No new mutation helper, no new TrackChannel, no new history system.
 */

interface SelectedKeyframeSectionProps {
  track: Track | null;
  selectedKeyframeId: string | null;
  currentFrame: number;
  transform: Transform;
  activeTemplateId: string | null;
  isScaleLocked: boolean;
  onUpdate: (newTransform: Partial<Transform>) => void;
}

export const SelectedKeyframeSection: React.FC<SelectedKeyframeSectionProps> = ({
  track,
  selectedKeyframeId,
  currentFrame,
  transform,
  activeTemplateId,
  isScaleLocked,
  onUpdate,
}) => {
  if (!track || !selectedKeyframeId) return null;

  const groups = groupChannelKeyframesByFrame(track.channels, activeTemplateId || 'Sequence');
  const selected = groups.find((g) =>
    Object.values(g.keyframes).some((k) => k.id === selectedKeyframeId),
  );

  // Hide safely when the selection is stale (keyframe deleted, part changed,
  // playhead moved off the keyframe) — never edit a wrong keyframe.
  if (!selected || selected.frame !== currentFrame) return null;

  const channels = selected.channels.filter((ch) =>
    (['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as TrackChannel[]).includes(ch),
  );
  if (channels.length === 0) return null;

  const handleEdit = (ch: TrackChannel, value: number) => {
    // Follow the existing TransformScaleCard scale-lock behavior: when locked,
    // a scale edit also updates the other axis proportionally.
    if (ch === 'scaleX' && isScaleLocked) {
      const factor = transform.scaleX !== 0 ? value / transform.scaleX : 1;
      onUpdate({ scaleX: value, scaleY: transform.scaleY * factor });
    } else if (ch === 'scaleY' && isScaleLocked) {
      const factor = transform.scaleY !== 0 ? value / transform.scaleY : 1;
      onUpdate({ scaleX: transform.scaleX * factor, scaleY: value });
    } else {
      onUpdate({ [ch]: value } as Partial<Transform>);
    }
  };

  return (
    <div className="panel-card" style={{ marginBottom: 10, borderColor: '#10b981' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#10b981', letterSpacing: '0.6px' }}>
          SELECTED KEYFRAME @ FRAME {selected.frame}
        </div>
        {channels.map((ch) => (
          <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 72, fontSize: 11, fontWeight: 600, color: CHANNEL_META[ch].color }}>
              {CHANNEL_META[ch].label}
            </span>
            <SmartNumberInput
              value={selected.keyframes[ch].value}
              step={ch === 'opacity' ? 0.01 : 1}
              precision={ch === 'opacity' ? 2 : 1}
              deferCommit
              ariaLabel={`Keyframe ${CHANNEL_META[ch].label}`}
              onChange={(val) => handleEdit(ch, val)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
