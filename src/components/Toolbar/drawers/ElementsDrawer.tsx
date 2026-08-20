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
  PenTool,
} from 'lucide-react';

export const ParallelogramIcon = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M5 6h14l-3 12H2z" />
  </svg>
);

const SHAPE_ITEMS: { type: BodyPartType; label: string; icon: React.ReactNode }[] = [
  { type: 'custom_rect', label: 'Rectangle', icon: <RectangleHorizontal size={16} className="text-teal" /> },
  { type: 'custom_box', label: 'Square', icon: <Square size={16} className="text-cyan" /> },
  { type: 'custom_circle', label: 'Circle', icon: <Circle size={16} className="text-green" /> },
  { type: 'custom_triangle', label: 'Triangle', icon: <Triangle size={16} className="text-red" /> },
  { type: 'custom_star', label: 'Star', icon: <Star size={16} className="text-purple" /> },
  { type: 'custom_diamond', label: 'Rhombus', icon: <Diamond size={16} className="text-gold" /> },
  { type: 'custom_parallelogram', label: 'Parallelogram', icon: <ParallelogramIcon size={16} className="text-gold" /> },
  { type: 'custom_freeform', label: 'Free Draw', icon: <PenTool size={16} className="text-cyan" /> },
];

export const ElementsDrawer: React.FC = () => {
  const { addCustomPart, activeTool, setActiveTool } = useAnimator();

  const handleDragStart = (e: React.DragEvent, type: BodyPartType, label: string) => {
    if (type === 'custom_freeform') return; // free draw is a tool, not a draggable element
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
      <div className="drawer-grid">
        {SHAPE_ITEMS.map((item) => {
          const isFreeDrawActive = item.type === 'custom_freeform' && activeTool === 'freeform_draw';
          return (
            <button
              key={item.type}
              className={`drawer-item-card ${isFreeDrawActive ? 'active' : ''}`}
              draggable={item.type !== 'custom_freeform'}
              onDragStart={(e) => handleDragStart(e, item.type, item.label)}
              onClick={() => {
                if (item.type === 'custom_freeform') {
                  // Toggle: clicking again deactivates the tool
                  setActiveTool(activeTool === 'freeform_draw' ? 'select' : 'freeform_draw');
                } else {
                  addCustomPart(item.type, item.label);
                }
              }}
              title={item.type === 'custom_freeform' ? 'Freehand drawing: click corners or drag to draw freely' : undefined}
            >
              <div className="item-icon-box">{item.icon}</div>
              <span className="item-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
