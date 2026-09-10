import React from 'react';
import { useAnimator } from '../../../context/AnimatorContext';
import type { BodyPartType } from '../../../types/animator';
import {
  SHAPE_ICON_MAP,
  SHAPE_ICON_SIZE,
  SHAPE_ICON_STROKE_WIDTH,
} from '../../../utils/shapeIconMap';

type ShapeIcon = React.ComponentType<{
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}>;

const SHAPE_ITEMS: { type: BodyPartType; label: string; icon: ShapeIcon }[] = [
  { type: 'custom_rect', label: 'Rectangle', icon: SHAPE_ICON_MAP.custom_rect! },
  { type: 'custom_box', label: 'Square', icon: SHAPE_ICON_MAP.custom_box! },
  { type: 'custom_circle', label: 'Circle', icon: SHAPE_ICON_MAP.custom_circle! },
  { type: 'custom_triangle', label: 'Triangle', icon: SHAPE_ICON_MAP.custom_triangle! },
  { type: 'custom_star', label: 'Star', icon: SHAPE_ICON_MAP.custom_star! },
  { type: 'custom_diamond', label: 'Rhombus', icon: SHAPE_ICON_MAP.custom_diamond! },
  { type: 'custom_parallelogram', label: 'Parallelogram', icon: SHAPE_ICON_MAP.custom_parallelogram! },
  { type: 'custom_freeform', label: 'Free Draw', icon: SHAPE_ICON_MAP.custom_freeform! },
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
              <div className="item-icon-box"><ShapeIcon size={SHAPE_ICON_SIZE} strokeWidth={SHAPE_ICON_STROKE_WIDTH} className="element-shape-icon" /></div>
              <span className="item-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
