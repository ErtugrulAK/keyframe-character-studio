import React from 'react';
import { useAnimator } from '../../../context/AnimatorContext';
import type { BodyPartType } from '../../../types/animator';
import {
  Square,
  Circle,
  Triangle,
  Star,
  Diamond,
  RectangleHorizontal,
  Shapes,
} from 'lucide-react';

const SHAPE_ITEMS: { type: BodyPartType; label: string; icon: React.ReactNode }[] = [
  { type: 'custom_rect', label: 'Rectangle', icon: <RectangleHorizontal size={16} className="text-teal" /> },
  { type: 'custom_box', label: 'Square', icon: <Square size={16} className="text-cyan" /> },
  { type: 'custom_circle', label: 'Circle', icon: <Circle size={16} className="text-green" /> },
  { type: 'custom_triangle', label: 'Triangle', icon: <Triangle size={16} className="text-red" /> },
  { type: 'custom_star', label: 'Star', icon: <Star size={16} className="text-purple" /> },
  { type: 'custom_diamond', label: 'Rhombus', icon: <Diamond size={16} className="text-gold" /> },
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
        <Shapes size={15} className="text-cyan" />
        <span className="drawer-title">Vector Shapes</span>
      </div>

      <div className="drawer-grid">
        {SHAPE_ITEMS.map((item) => (
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

