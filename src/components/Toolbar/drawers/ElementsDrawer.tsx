import React from 'react';
import { useAnimator } from '../../../context/AnimatorContext';
import type { BodyPartType } from '../../../types/animator';
import {
  Type,
  Tag,
  Pill,
  Gem,
  Star,
  Circle,
  Square,
  Triangle,
  Layout,
  Grid3x3,
  Atom,
} from 'lucide-react';

const QUICK_SHAPES: { type: BodyPartType; label: string; icon: React.ReactNode }[] = [
  { type: 'custom_text', label: 'Text Label', icon: <Type size={14} className="text-cyan" /> },
  { type: 'custom_banner', label: 'Banner Card', icon: <Tag size={14} className="text-gold" /> },
  { type: 'custom_capsule', label: 'Capsule Pill', icon: <Pill size={14} className="text-purple" /> },
  { type: 'custom_diamond', label: 'Diamond', icon: <Gem size={14} className="text-green" /> },
  { type: 'custom_star', label: 'Star', icon: <Star size={14} className="text-purple" /> },
  { type: 'custom_circle', label: 'Circle', icon: <Circle size={14} className="text-green" /> },
  { type: 'custom_box', label: 'Square Box', icon: <Square size={14} className="text-cyan" /> },
  { type: 'custom_rect', label: 'Rectangle', icon: <Layout size={14} className="text-teal" /> },
  { type: 'custom_triangle', label: 'Triangle', icon: <Triangle size={14} className="text-red" /> },
  { type: 'mograph_cloner', label: 'Cloner Grid', icon: <Grid3x3 size={14} className="text-purple" /> },
  { type: 'particle_system', label: 'Particles', icon: <Atom size={14} className="text-teal" /> },
];

export const ElementsDrawer: React.FC = () => {
  const { addCustomPart } = useAnimator();

  const handleDragStart = (e: React.DragEvent, type: BodyPartType, label: string) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type,
        name: label,
      })
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="drawer-content">
      <div className="drawer-header">
        <span className="drawer-title">Vector Elements</span>
      </div>
      <div className="drawer-grid">
        {QUICK_SHAPES.map((item) => (
          <button
            key={item.type}
            className="drawer-item-card"
            draggable={true}
            onDragStart={(e) => handleDragStart(e, item.type, item.label)}
            onClick={() => addCustomPart(item.type, item.label)}
          >
            <div className="item-icon-box">{item.icon}</div>
            <span className="item-label">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
