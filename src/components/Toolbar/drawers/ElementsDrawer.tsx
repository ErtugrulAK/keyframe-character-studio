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

const SHAPE_ICON_SIZE = 18;

type ShapeIconProps = {
  size?: number;
  className?: string;
};

export const ParallelogramIcon = ({ size = SHAPE_ICON_SIZE, className }: ShapeIconProps) => (
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
    aria-hidden="true"
  >
    <path d="M5 6h14l-3 12H2z" />
  </svg>
);

type ShapeIcon = React.ComponentType<ShapeIconProps>;

const SHAPE_ITEMS: { type: BodyPartType; label: string; icon: ShapeIcon }[] = [
  { type: 'custom_rect', label: 'Rectangle', icon: RectangleHorizontal },
  { type: 'custom_box', label: 'Square', icon: Square },
  { type: 'custom_circle', label: 'Circle', icon: Circle },
  { type: 'custom_triangle', label: 'Triangle', icon: Triangle },
  { type: 'custom_star', label: 'Star', icon: Star },
  { type: 'custom_diamond', label: 'Rhombus', icon: Diamond },
  { type: 'custom_parallelogram', label: 'Parallelogram', icon: ParallelogramIcon },
  { type: 'custom_freeform', label: 'Free Draw', icon: PenTool },
];

export const ElementsDrawer: React.FC = () => {
  const { armShapeCreation, activeTool, pendingShapeType, setActiveTool } = useAnimator();
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
          const isActive = item.type === 'custom_freeform'
            ? activeTool === 'freeform_draw'
            : activeTool === 'shape_create' && pendingShapeType === item.type;
          const ShapeIcon = item.icon;
          return (
            <button
              key={item.type}
              className={`drawer-item-card ${isActive ? 'active' : ''}`}
              draggable={item.type !== 'custom_freeform'}
              onDragStart={(e) => handleDragStart(e, item.type, item.label)}
              onClick={() => {
                if (item.type === 'custom_freeform') {
                  setActiveTool(activeTool === 'freeform_draw' ? 'select' : 'freeform_draw');
                } else {
                  armShapeCreation(item.type, item.label);
                }
              }}
              title={item.type === 'custom_freeform' ? 'Freehand drawing: click corners or drag to draw freely' : undefined}
            >
              <div className="item-icon-box"><ShapeIcon size={SHAPE_ICON_SIZE} className="element-shape-icon" /></div>
              <span className="item-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
