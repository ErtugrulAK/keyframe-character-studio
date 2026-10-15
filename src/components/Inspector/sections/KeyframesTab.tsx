import React from 'react';
import { useAnimator } from '../../../context/useAnimator';
import { Diamond, Play } from 'lucide-react';
import type { CharacterPart } from '../../../types/animator';
import { groupChannelKeyframesByFrame, resolveTrackChannels } from '../../../utils/channelKeyframeGroups';
import { authoredBasePose } from '../../../utils/evaluateTransform';
import { frameToSeconds } from '../../../utils/timebase';

interface KeyframesTabProps {
  selectedPart: CharacterPart;
}

/** Read-only projection of the timeline's canonical frame groups. */
export const KeyframesTab: React.FC<KeyframesTabProps> = ({ selectedPart }) => {
  const {
    tracks,
    currentFrame,
    setCurrentFrame,
    activeTemplateId,
    fps,
  } = useAnimator();

  const track = tracks.find((t) => t.partId === selectedPart.id);
  const activeTmpl = activeTemplateId || 'Sequence';

  // R3-10/R3-11: the SAME projection the timeline reads, so the panel can never
  // disagree with the layer row about which animation exists.
  const groups = groupChannelKeyframesByFrame(
    track ? resolveTrackChannels(track, authoredBasePose(selectedPart)) : undefined,
    activeTmpl,
  );

  const formatTime = (frame: number) => {
    const totalSec = frameToSeconds(frame, fps);
    return `${totalSec.toFixed(2)}s`;
  };


  return (
    <div className="section-block">
      {/* Animation summary; authoring controls belong to the timeline. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Diamond size={14} className="text-teal" />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.4px' }}>
            LAYER KEYFRAMES ({groups.length})
          </span>
        </div>

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
            Use the timeline property controls to author keyframes.
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
                {/* Frame navigation does not mutate animation data. */}
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
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8' }}>F{group.frame}</span>
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

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
