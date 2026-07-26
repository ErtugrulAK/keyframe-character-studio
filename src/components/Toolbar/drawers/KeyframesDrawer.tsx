import React from 'react';
import { useAnimator } from '../../../context/AnimatorContext';
import { Film, Plus, CheckCircle2 } from 'lucide-react';

export const KeyframesDrawer: React.FC = () => {
  const {
    motionTemplates,
    activeTemplateId,
    setActiveTemplateId,
    addMotionTemplate,
  } = useAnimator();

  return (
    <div className="drawer-content">
      <div className="drawer-header">
        <span className="drawer-title">Animation Sequences</span>
      </div>
      <p className="drawer-desc" style={{ fontSize: 11, marginBottom: 12 }}>
        Manage animation sequences for the active graphic template.
      </p>

      <button
        className="btn-primary w-full add-kf-drawer-btn"
        onClick={() => {
          const nextNum = motionTemplates.length + 1;
          addMotionTemplate(`Sequence ${nextNum}`);
        }}
        style={{ marginBottom: 14 }}
      >
        <Plus size={15} />
        <span>New Sequence</span>
      </button>

      <div className="drawer-subtitle" style={{ marginBottom: 8, fontSize: 10 }}>
        ACTIVE TEMPLATE SEQUENCES ({motionTemplates.length})
      </div>

      <div className="keyframe-history-list" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
        {motionTemplates.map((tmpl) => {
          const isActive = tmpl.id === activeTemplateId;

          return (
            <div
              key={tmpl.id}
              className={`keyframe-list-item ${isActive ? 'active-kf' : ''}`}
              onClick={() => setActiveTemplateId(tmpl.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: isActive ? 'rgba(20, 184, 166, 0.15)' : 'var(--bg-dark)',
                border: `1px solid ${isActive ? 'var(--accent-teal)' : 'var(--border-color)'}`,
                borderRadius: 6,
                padding: '8px 12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Film size={14} className={isActive ? 'text-teal' : 'text-cyan'} />
                <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? 'var(--accent-teal)' : '#f8fafc' }}>
                  {tmpl.name}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isActive ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#2dd4bf', background: 'rgba(20,184,166,0.2)', padding: '2px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <CheckCircle2 size={10} /> Active
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    Select
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
