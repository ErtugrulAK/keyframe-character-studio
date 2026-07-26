import React from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import { Zap, Film, CheckCircle2, Play } from 'lucide-react';
import './LiveDirector.css';

export const LiveDirectorPanel: React.FC = () => {
  const {
    sceneTitle,
    motionTemplates,
    activeTemplateId,
    setActiveTemplateId,
    setCurrentFrame,
    setIsPlaying,
    setIsLooping,
  } = useAnimator();

  return (
    <div className="live-director-panel">
      <div className="director-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 14, margin: 0, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={14} /> LIVE DIRECTOR PANEL
          </h2>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Trigger real-time graphic sequence animations on stage
          </span>
        </div>
      </div>

      <div className="director-sequences-container" style={{ background: 'var(--bg-dark)', borderRadius: 8, padding: 14, border: '1px solid var(--border-color)' }}>
        {/* Template Title Header */}
        <div style={{ fontSize: 12, fontWeight: 800, color: '#38bdf8', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <Film size={14} className="text-teal" />
          <span>TEMPLATE: {sceneTitle || 'Template'}</span>
        </div>

        {/* Horizontal Row of Created Sequences */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {motionTemplates.map((tmpl) => {
            const isActive = tmpl.id === activeTemplateId;

            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => {
                  setActiveTemplateId(tmpl.id);
                  setIsLooping(true);
                  setCurrentFrame(0);
                  setIsPlaying(true);
                }}
                title={`Click to play "${tmpl.name}" animation on stage`}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: isActive ? 'var(--accent-teal)' : '#161b26',
                  color: isActive ? '#000' : '#f8fafc',
                  border: `1px solid ${isActive ? 'var(--accent-teal)' : '#2d3548'}`,
                  boxShadow: isActive ? '0 0 10px rgba(20, 184, 166, 0.35)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Play size={13} fill={isActive ? '#000' : '#38bdf8'} style={{ color: isActive ? '#000' : '#38bdf8' }} />
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
