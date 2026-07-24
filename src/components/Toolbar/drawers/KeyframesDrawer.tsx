import React from 'react';
import { useAnimator } from '../../../context/AnimatorContext';
import { PlusCircle, Gem, Clock, Trash2 } from 'lucide-react';

export const KeyframesDrawer: React.FC = () => {
  const {
    selectedPartId,
    characterParts,
    tracks,
    currentFrame,
    setCurrentFrame,
    addKeyframeForSelected,
    deleteKeyframe,
  } = useAnimator();

  const selectedTrack = selectedPartId ? tracks.find((t) => t.partId === selectedPartId) : null;
  const selectedPart = selectedPartId ? characterParts.find((p) => p.id === selectedPartId) : null;
  const keyframes = selectedTrack ? [...selectedTrack.keyframes].sort((a, b) => a.frame - b.frame) : [];

  return (
    <div className="drawer-content">
      <div className="drawer-header">
        <span className="drawer-title">Keyframe Sequence</span>
      </div>
      <p className="drawer-desc" style={{ fontSize: 11, marginBottom: 8 }}>
        {selectedPart ? `Track list for: ${selectedPart.name}` : 'Select an object on the canvas to view its keyframes.'}
      </p>

      <button
        className="btn-primary w-full add-kf-drawer-btn"
        onClick={addKeyframeForSelected}
        disabled={!selectedPartId}
        style={{ marginBottom: 12 }}
      >
        <PlusCircle size={15} />
        <span>Add Keyframe at Frame {currentFrame}</span>
      </button>

      {selectedTrack && keyframes.length > 0 ? (
        <div className="keyframe-history-list" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
          <div className="drawer-subtitle" style={{ margin: '4px 0', fontSize: 10 }}>CHRONOLOGICAL KEYFRAMES</div>
          {keyframes.map((kf, idx) => {
            const isActiveKf = kf.frame === currentFrame;

            return (
              <div
                key={kf.id}
                className={`keyframe-list-item ${isActiveKf ? 'active-kf' : ''}`}
                onClick={() => setCurrentFrame(kf.frame)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: isActiveKf ? 'rgba(20, 184, 166, 0.15)' : 'var(--bg-dark)',
                  border: `1px solid ${isActiveKf ? 'var(--accent-teal)' : 'var(--border-color)'}`,
                  borderRadius: 6,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Gem size={14} className={isActiveKf ? 'text-teal' : 'text-gold'} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: isActiveKf ? 'var(--accent-teal)' : '#f8fafc' }}>
                    Keyframe #{idx + 1}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={11} /> Frame {kf.frame}
                  </span>

                  <button
                    className="btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteKeyframe(selectedTrack.id, kf.id);
                    }}
                    title="Delete Keyframe"
                    style={{ width: 22, height: 22, padding: 0 }}
                  >
                    <Trash2 size={12} className="text-red" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : selectedPartId ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 8px', background: 'var(--bg-dark)', borderRadius: 6, border: '1px border-dashed var(--border-color)' }}>
          No keyframes recorded for this track yet.
        </div>
      ) : null}
    </div>
  );
};
