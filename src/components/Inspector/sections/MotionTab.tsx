import React from 'react';
import { Zap, Ban, ArrowLeft, ArrowRight, ArrowDown, ArrowUp, Layers, Sparkles, RotateCw, Activity } from 'lucide-react';

const INSPECTOR_TRANSITIONS = [
  { id: 'none', label: 'None', icon: <Ban size={18} style={{ color: '#94a3b8' }} /> },
  { id: 'move_left', label: 'Move Left', icon: <ArrowLeft size={18} className="text-cyan" /> },
  { id: 'move_right', label: 'Move Right', icon: <ArrowRight size={18} className="text-teal" /> },
  { id: 'move_down', label: 'Move Down', icon: <ArrowDown size={18} className="text-gold" /> },
  { id: 'move_up', label: 'Move Up', icon: <ArrowUp size={18} className="text-purple" /> },
  { id: 'fade', label: 'Fade In', icon: <Layers size={18} className="text-green" /> },
  { id: 'flash', label: 'Pop Zoom', icon: <Sparkles size={18} className="text-gold" /> },
  { id: 'spin', label: 'Spin 360°', icon: <RotateCw size={18} className="text-cyan" /> },
  { id: 'bounce', label: 'Bounce In', icon: <Activity size={18} className="text-red" /> },
];

interface MotionTabProps {
  selectedPartId: string | null;
  applyMotionTransition: (partId: string, transitionId: string) => void;
}

export const MotionTab: React.FC<MotionTabProps> = ({ selectedPartId, applyMotionTransition }) => {
  return (
    <div className="inspector-section">
      <div className="section-title">
        <Zap size={13} className="text-cyan" />
        <span>MOTION TRANSITION PRESETS</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        Click a motion transition to auto-generate keyframe animations for the selected object.
      </p>

      <div className="transition-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {INSPECTOR_TRANSITIONS.map((item) => (
          <button
            key={item.id}
            className="transition-card"
            style={{
              padding: '10px 4px',
              background: 'var(--bg-dark)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={() => selectedPartId && applyMotionTransition(selectedPartId, item.id)}
            title={`Apply ${item.label} to selected object`}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: 'var(--bg-input)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.icon}
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
