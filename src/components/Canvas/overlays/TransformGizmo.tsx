import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';

export const getPartBounds = (part: CharacterPart): { halfW: number; halfH: number } => {
  let halfW = 32;
  let halfH = 32;

  switch (part.type) {
    case 'custom_card': halfW = 90; halfH = 50; break;
    case 'custom_rect': halfW = 60; halfH = 30; break;
    case 'custom_banner': halfW = 80; halfH = 25; break;
    case 'custom_image':
    case 'custom_video':
      halfW = part.type === 'custom_video' ? 100 : 90;
      halfH = 60;
      break;
  }
  return { halfW, halfH };
};

export type ScaleMode = 'scale_corner' | 'scale_x' | 'scale_y' | 'scale_left' | 'scale_right' | 'scale_top' | 'scale_bottom';

interface TransformGizmoProps {
  selectedPart: CharacterPart;
  selectedTransform: Transform;
  zScale: number;
  onRotateMouseDown: (e: React.MouseEvent) => void;
  onScaleMouseDown: (e: React.MouseEvent, mode: ScaleMode) => void;
}

export const TransformGizmo: React.FC<TransformGizmoProps> = ({
  selectedPart,
  selectedTransform,
  zScale,
  onRotateMouseDown,
  onScaleMouseDown,
}) => {
  const baseBounds = getPartBounds(selectedPart);
  
  // Multiply bounds by absolute scale so handles don't get warped or flipped visually
  const halfW = baseBounds.halfW * Math.abs(selectedTransform.scaleX);
  const halfH = baseBounds.halfH * Math.abs(selectedTransform.scaleY);

  const rotBarLength = halfH + 30 * zScale;

  return (
    <g
      transform={`translate(${300 + selectedTransform.x}, ${240 + selectedTransform.y}) rotate(${selectedTransform.rotation})`}
      style={{ pointerEvents: 'none' }}
    >
      {/* Dashed Bounding Box Outline */}
      <rect
        x={-halfW}
        y={-halfH}
        width={halfW * 2}
        height={halfH * 2}
        fill="none"
        stroke="#00d2ff"
        strokeWidth={1.5 * zScale}
        strokeDasharray={`${5 * zScale} ${4 * zScale}`}
        vectorEffect="non-scaling-stroke"
      />

      {/* Rotation Top Bar & Handle Knob */}
      <line
        x1={0}
        y1={-halfH}
        x2={0}
        y2={-rotBarLength}
        stroke="#00d2ff"
        strokeWidth={2 * zScale}
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={0}
        cy={-rotBarLength}
        r={7 * zScale}
        fill="#ffb700"
        stroke="#ffffff"
        strokeWidth={2 * zScale}
        style={{ cursor: 'grab', pointerEvents: 'auto' }}
        onMouseDown={onRotateMouseDown}
      />

      {/* 4 Edge Midpoint Handles (Single-Edge Directional Stretch) */}
      {/* Left Handle: Stretch Left */}
      <circle
        cx={-halfW}
        cy={0}
        r={4.5 * zScale}
        fill="#38bdf8"
        stroke="#ffffff"
        strokeWidth={1.5 * zScale}
        style={{ cursor: 'ew-resize', pointerEvents: 'auto' }}
        onMouseDown={(e) => onScaleMouseDown(e, 'scale_left')}
      />

      {/* Right Handle: Stretch Right */}
      <circle
        cx={halfW}
        cy={0}
        r={4.5 * zScale}
        fill="#38bdf8"
        stroke="#ffffff"
        strokeWidth={1.5 * zScale}
        style={{ cursor: 'ew-resize', pointerEvents: 'auto' }}
        onMouseDown={(e) => onScaleMouseDown(e, 'scale_right')}
      />

      {/* Top Handle: Stretch Top */}
      <circle
        cx={0}
        cy={-halfH}
        r={4.5 * zScale}
        fill="#c084fc"
        stroke="#ffffff"
        strokeWidth={1.5 * zScale}
        style={{ cursor: 'ns-resize', pointerEvents: 'auto' }}
        onMouseDown={(e) => onScaleMouseDown(e, 'scale_top')}
      />

      {/* Bottom Handle: Stretch Bottom */}
      <circle
        cx={0}
        cy={halfH}
        r={4.5 * zScale}
        fill="#c084fc"
        stroke="#ffffff"
        strokeWidth={1.5 * zScale}
        style={{ cursor: 'ns-resize', pointerEvents: 'auto' }}
        onMouseDown={(e) => onScaleMouseDown(e, 'scale_bottom')}
      />

      {/* 4 Corner Scale Handles (Proportional / Uniform Scale) */}
      {[
        { x: -halfW, y: -halfH, cursor: 'nwse-resize' }, // Top-Left (NW)
        { x: halfW, y: -halfH, cursor: 'nesw-resize' },  // Top-Right (NE)
        { x: halfW, y: halfH, cursor: 'nwse-resize' },   // Bottom-Right (SE)
        { x: -halfW, y: halfH, cursor: 'nesw-resize' },  // Bottom-Left (SW)
      ].map((corner, i) => (
        <rect
          key={`corner-${i}`}
          x={corner.x - 5 * zScale}
          y={corner.y - 5 * zScale}
          width={10 * zScale}
          height={10 * zScale}
          fill="#00d2ff"
          stroke="#ffffff"
          strokeWidth={1.5 * zScale}
          style={{ cursor: corner.cursor, pointerEvents: 'auto' }}
          onMouseDown={(e) => onScaleMouseDown(e, 'scale_corner')}
        />
      ))}

      {/* Center Pivot Point Dot */}
      <circle cx={0} cy={0} r={4 * zScale} fill="#00d2ff" stroke="#ffffff" strokeWidth={1.5 * zScale} />
    </g>
  );
};
