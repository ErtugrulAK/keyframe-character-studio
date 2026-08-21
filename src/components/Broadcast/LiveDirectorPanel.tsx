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
    playNamedSequence,
    namedSequenceRuntime,
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
            const runtime = namedSequenceRuntime?.sequenceId === tmpl.id ? namedSequenceRuntime : null;
            const status = runtime?.status ?? 'idle';
            const frame = runtime?.frame ?? 0;
            const duration = runtime?.durationFrames ?? tmpl.durationFrames;
            const progress = duration > 0 ? Math.min(1, frame / duration) : 1;

            return (
              <button
                key={tmpl.id}
                type="button"
                aria-label={tmpl.name}
                data-sequence-id={tmpl.id}
                data-sequence-status={status}
                data-sequence-frame={Math.floor(frame)}
                onClick={() => {
                  setActiveTemplateId(tmpl.id);
                  playNamedSequence(tmpl.id, tmpl.durationFrames);
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
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, minWidth: 110 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tmpl.name}</span>
                    <span style={{ fontSize: 9, opacity: 0.8, textTransform: 'uppercase' }}>{status}</span>
                  </span>
                  <span style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, opacity: 0.78 }}>
                    <span style={{ flex: 1, height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
                      <span style={{ display: 'block', width: `${progress * 100}%`, height: '100%', background: isActive ? '#000' : '#38bdf8' }} />
                    </span>
                    <span>{Math.floor(frame)} / {duration}</span>
                  </span>
                </span>
                {isActive && <CheckCircle2 size={13} style={{ marginLeft: 2 }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
