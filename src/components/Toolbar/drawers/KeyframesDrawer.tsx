import React, { useState } from 'react';
import { useAnimator } from '../../../context/AnimatorContext';
import { Film, Plus, CheckCircle2, Edit2 } from 'lucide-react';

export const KeyframesDrawer: React.FC = () => {
  const {
    motionTemplates,
    activeTemplateId,
    setActiveTemplateId,
    addMotionTemplate,
    renameMotionTemplate,
  } = useAnimator();

  const [editingSeqId, setEditingSeqId] = useState<string | null>(null);
  const [editingSeqName, setEditingSeqName] = useState<string>('');

  return (
    <div className="drawer-content">
      <div className="drawer-header">
        <span className="drawer-title">Animation Sequences</span>
      </div>
      <p className="drawer-desc" style={{ fontSize: 11, marginBottom: 12 }}>
        Manage and switch animation sequences for the active graphic template.
      </p>

      <button
        className="btn-primary w-full add-kf-drawer-btn"
        onClick={() => {
          const defaultSeqName = motionTemplates.length === 1 && motionTemplates[0].name === 'Sequence' ? 'Sequence 1' : `Sequence ${motionTemplates.length}`;
          addMotionTemplate(defaultSeqName);
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
          const isEditing = editingSeqId === tmpl.id;

          return (
            <div
              key={tmpl.id}
              className={`keyframe-list-item ${isActive ? 'active-kf' : ''}`}
              onClick={() => {
                if (!isEditing) setActiveTemplateId(tmpl.id);
              }}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <Film size={14} className={isActive ? 'text-teal' : 'text-cyan'} />
                {isEditing ? (
                  <input
                    type="text"
                    value={editingSeqName}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setEditingSeqName(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        if (editingSeqName.trim()) renameMotionTemplate(tmpl.id, editingSeqName.trim());
                        setEditingSeqId(null);
                      } else if (e.key === 'Escape') {
                        setEditingSeqId(null);
                      }
                    }}
                    onBlur={() => {
                      if (editingSeqName.trim()) renameMotionTemplate(tmpl.id, editingSeqName.trim());
                      setEditingSeqId(null);
                    }}
                    style={{
                      background: '#090b10',
                      border: '1px solid #38bdf8',
                      color: '#fff',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 12,
                      fontWeight: 700,
                      outline: 'none',
                      width: 130,
                    }}
                  />
                ) : (
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: isActive ? 'var(--accent-teal)' : '#f8fafc' }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingSeqId(tmpl.id);
                      setEditingSeqName(tmpl.name);
                    }}
                    title="Double-click to rename sequence directly"
                  >
                    {tmpl.name}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingSeqId(tmpl.id);
                    setEditingSeqName(tmpl.name);
                  }}
                  title="Rename Sequence"
                  style={{ width: 22, height: 22, padding: 0 }}
                >
                  <Edit2 size={12} className="text-muted" />
                </button>

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
