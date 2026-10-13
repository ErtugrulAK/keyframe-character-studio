import React from 'react';
import { useAnimator } from '../../../context/useAnimator';
import { Diamond, Plus, Trash2, Play } from 'lucide-react';
import type { CharacterPart } from '../../../types/animator';
import { groupChannelKeyframesByFrame, resolveTrackChannels } from '../../../utils/channelKeyframeGroups';
import { SmartNumberInput } from '../inputs/SmartNumberInput';
import { frameToSeconds } from '../../../utils/timebase';

interface KeyframesTabProps {
  selectedPart: CharacterPart;
}

/**
 * M3: Editor keyframe panel now reads/writes the canonical `track.channels`
 * model. "A keyframe" is a frame holding one property keyframe per channel
 * (same UX as the legacy composite keyframe — one row per frame).
 */
export const KeyframesTab: React.FC<KeyframesTabProps> = ({ selectedPart }) => {
  const {
    tracks,
    currentFrame,
    setCurrentFrame,
    addKeyframeToTrack,
    deleteKeyframeFrameGroup,
    updatePropertyKeyframeFrame,
    activeTemplateId,
    fps,
    totalFrames,
  } = useAnimator();

  const track = tracks.find((t) => t.partId === selectedPart.id);
  const activeTmpl = activeTemplateId || 'Sequence';

  // R3-10/R3-11: the SAME projection the timeline reads, so the panel can never
  // disagree with the layer row about which animation exists.
  const groups = groupChannelKeyframesByFrame(track ? resolveTrackChannels(track) : undefined, activeTmpl);

  const formatTime = (frame: number) => {
    const totalSec = frameToSeconds(frame, fps);
    return `${totalSec.toFixed(2)}s`;
  };

  // M3/R3-10: "Add keyframe" is the ONE canonical transform keyframe group
  // action (materializes every transform channel at the current frame).
  const handleAdd = () => {
    if (!track) return;
    addKeyframeToTrack(track.id, currentFrame);
  };

  const handleDelete = (frame: number) => {
    if (!track) return;
    // The frame group is the unit: every store at that (frame, sequence) goes.
    deleteKeyframeFrameGroup(track.id, frame);
  };

  const handleFrameChange = (oldFrame: number, newFrame: number) => {
    if (!track) return;
    const group = groups.find((g) => g.frame === oldFrame);
    if (!group) return;
    for (const ch of group.channels) {
      const kf = group.keyframes[ch];
      if (kf) updatePropertyKeyframeFrame(track.id, ch, kf.id, newFrame);
    }
  };

  return (
    <div className="section-block">
      {/* Header & Add Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Diamond size={14} className="text-teal" />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.4px' }}>
            LAYER KEYFRAMES ({groups.length})
          </span>
        </div>

        <button
          className="fit-pill-btn"
          onClick={handleAdd}
          style={{
            background: 'linear-gradient(135deg, #0d9488, #14b8a6)',
            color: '#fff',
            border: 'none',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
          }}
          title={`Add Keyframe at Frame ${currentFrame}`}
        >
          <Plus size={12} />
          <span>Add at F{currentFrame}</span>
        </button>
      </div>

      {/* Keyframe List (frame-grouped channels) */}
      {groups.length === 0 ? (
        <div
          style={{
            background: '#0b0d10',
            border: '1px dashed #232734',
            borderRadius: 8,
            padding: '24px 16px',
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          <Diamond size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', margin: '0 0 4px 0' }}>
            No keyframes on &quot;{selectedPart.name}&quot;
          </p>
          <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>
            Click <strong>+ Add at F{currentFrame}</strong> to create a keyframe.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
          {groups.map((group) => {
            const isCurrent = group.frame === currentFrame;

            return (
              <div
                key={group.frame}
                style={{
                  background: isCurrent ? 'rgba(20, 184, 166, 0.15)' : '#10131a',
                  border: `1px solid ${isCurrent ? 'var(--accent-teal)' : '#1e2433'}`,
                  borderRadius: 6,
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Left: Frame Jump & Editable Frame Input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: '#0e1118',
                      border: `1px solid ${isCurrent ? 'rgba(20, 184, 166, 0.5)' : '#23293a'}`,
                      borderRadius: 6,
                      padding: '2px 6px',
                    }}
                  >
                    <button
                      className="btn-icon"
                      onClick={() => setCurrentFrame(group.frame)}
                      title={`Jump playhead to Frame ${group.frame}`}
                      style={{ width: 18, height: 18, padding: 0, color: isCurrent ? '#14b8a6' : '#94a3b8' }}
                    >
                      <Play size={10} fill="currentColor" />
                    </button>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8' }}>F</span>
                    <SmartNumberInput
                      value={group.frame}
                      min={0}
                      max={totalFrames}
                      step={1}
                      precision={0}
                      deferCommit
                      onChange={(v) => handleFrameChange(group.frame, v)}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#cbd5e1' }}>
                      {formatTime(group.frame)}
                    </span>
                    {/* Channel tags + representative easing */}
                    <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>
                      {group.channels.join(', ')}
                      {' · '}
                      {group.easing === 'cubic_bezier' && group.bezierControlPoints
                        ? `bezier(${group.bezierControlPoints.join(', ')})`
                        : group.easing || 'ease'}
                    </span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    className="btn-icon danger"
                    onClick={() => handleDelete(group.frame)}
                    title="Delete Keyframe (all properties at this frame)"
                    style={{ width: 22, height: 22, padding: 0 }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
