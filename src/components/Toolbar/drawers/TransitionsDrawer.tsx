import React from 'react';
import { useAnimator } from '../../../context/AnimatorContext';
import {
  Ban,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Layers,
  Sparkles,
  RotateCw,
  Activity,
} from 'lucide-react';

const MOTION_TRANSITIONS = [
  { id: 'none', label: 'None', icon: <Ban size={22} style={{ color: '#94a3b8' }} /> },
  { id: 'move_left', label: 'Move left', icon: <ArrowLeft size={22} className="text-cyan" /> },
  { id: 'move_right', label: 'Move right', icon: <ArrowRight size={22} className="text-teal" /> },
  { id: 'move_down', label: 'Move down', icon: <ArrowDown size={22} className="text-gold" /> },
  { id: 'move_up', label: 'Move up', icon: <ArrowUp size={22} className="text-purple" /> },
  { id: 'fade', label: 'Fade In', icon: <Layers size={22} className="text-green" /> },
  { id: 'flash', label: 'Pop Zoom', icon: <Sparkles size={22} className="text-gold" /> },
  { id: 'spin', label: 'Spin 360°', icon: <RotateCw size={22} className="text-cyan" /> },
  { id: 'bounce', label: 'Bounce In', icon: <Activity size={22} className="text-red" /> },
];

export const TransitionsDrawer: React.FC = () => {
  const { selectedPartId, applyMotionTransition } = useAnimator();

  return (
    <div className="drawer-content">
      <p className="drawer-desc" style={{ fontSize: 11, margin: '2px 0 10px' }}>
        {selectedPartId
          ? 'Select a transition to auto-generate motion keyframes for the selected object.'
          : '⚠️ Click an object on the canvas first to apply motion transitions.'}
      </p>

      <div className="drawer-grid transition-grid">
        {MOTION_TRANSITIONS.map((item) => (
          <button
            key={item.id}
            className={`drawer-item-card transition-card ${selectedPartId ? 'enabled' : 'disabled'}`}
            onClick={() => selectedPartId && applyMotionTransition(selectedPartId, item.id)}
            title={selectedPartId ? `Apply ${item.label} to selected object` : 'Select an object first'}
          >
            <div className="transition-icon-box">{item.icon}</div>
            <span className="item-label">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
