import React from 'react';
import { useAnimator } from '../../../context/AnimatorContext';
import { Diamond, Plus, Trash2, Play } from 'lucide-react';
import type { CharacterPart } from '../../../types/animator';

interface KeyframesTabProps {
  selectedPart: CharacterPart;
}

export const KeyframesTab: React.FC<KeyframesTabProps> = ({ selectedPart }) => {
  const {
    tracks,
    currentFrame,
    setCurrentFrame,
    addKeyframeToTrack,
    deleteKeyframe,
    updateKeyframeFrame,
    activeTemplateId,
    fps,
  } = useAnimator();

  const track = tracks.find((t) => t.partId === selectedPart.id);
  const activeTmpl = activeTemplateId || 'Sequence';

  const keyframes = (track?.keyframes || [])
    .filter((k) => (k.templateId || 'Sequence') === activeTmpl)
    .sort((a, b) => a.frame - b.frame);

  const formatTime = (frame: number) => {
    const totalSec = frame / fps;
    return `${totalSec.toFixed(2)}s`;
  };

  return (
    <div className="section-block">
      {/* Header & Add Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Diamond size={14} className="text-teal" />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.4px' }}>
            LAYER KEYFRAMES ({keyframes.length})
          </span>
        </div>

        <button
          className="fit-pill-btn"
          onClick={() => track && addKeyframeToTrack(track.id, currentFrame)}
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

      {/* Keyframe List */}
      {keyframes.length === 0 ? (
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
            No keyframes on "{selectedPart.name}"
          </p>
          <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>
            Click <strong>+ Add at F{currentFrame}</strong> to create a keyframe.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
          {keyframes.map((kf) => {
            const isCurrent = kf.frame === currentFrame;

            return (
              <div
                key={kf.id}
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
                      onClick={() => setCurrentFrame(kf.frame)}
                      title={`Jump playhead to Frame ${kf.frame}`}
                      style={{ width: 18, height: 18, padding: 0, color: isCurrent ? '#14b8a6' : '#94a3b8' }}
                    >
                      <Play size={10} fill="currentColor" />
                    </button>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8' }}>F</span>
                    <input className="input-control"
                type="number"
                      min={0}
                      value={kf.frame}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 0 && track) {
                          updateKeyframeFrame(track.id, kf.id, val);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      style={{
                        width: 48,
                        height: 20,
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid #2d374d',
                        color: '#fff',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 800,
                        textAlign: 'center',
                        outline: 'none',
                      }}
                      title="Type to edit keyframe frame position manually"
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#cbd5e1' }}>
                      {formatTime(kf.frame)}
                    </span>
                    <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>
                      {kf.easing === 'cubic_bezier' && kf.bezierControlPoints
                        ? `bezier(${kf.bezierControlPoints.join(', ')})`
                        : kf.easing || 'ease'}
                    </span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    className="btn-icon danger"
                    onClick={() => track && deleteKeyframe(track.id, kf.id)}
                    title="Delete Keyframe"
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
