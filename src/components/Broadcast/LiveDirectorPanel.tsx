import React from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import { Zap, Film, CheckCircle2 } from 'lucide-react';
import './LiveDirector.css';

export const LiveDirectorPanel: React.FC = () => {
  const {
    motionTemplates,
    activeTemplateId,
    setActiveTemplateId,
    setCurrentFrame,
    setIsPlaying,
  } = useAnimator();

  return (
    <div className="live-director-panel">
      <div className="director-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 14, margin: 0, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={14} /> LIVE DIRECTOR PANEL
          </h2>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Select and trigger animation sequence timelines for the active template
          </span>
        </div>
      </div>

      <div className="director-sequences-container" style={{ background: 'var(--bg-dark)', borderRadius: 8, padding: 14, border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Film size={14} /> TEMPLATE SEQUENCES ({motionTemplates.length})
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {motionTemplates.map((tmpl) => {
            const isActive = tmpl.id === activeTemplateId;

            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => {
                  setActiveTemplateId(tmpl.id);
                  setCurrentFrame(0);
                  setIsPlaying(true);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: isActive ? 'var(--accent-teal)' : 'var(--bg-input)',
                  color: isActive ? '#000' : 'var(--text-primary)',
                  border: `1px solid ${isActive ? 'var(--accent-teal)' : 'var(--border-color)'}`,
                  transition: 'all 0.15s ease',
                }}
              >
                <Film size={13} />
                <span>{tmpl.name}</span>
                {isActive && <CheckCircle2 size={13} style={{ marginLeft: 2 }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
