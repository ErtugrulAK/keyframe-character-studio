import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';

interface TransformGizmoProps {
  selectedPart: CharacterPart;
  selectedTransform: Transform;
  zScale: number;
  onRotateMouseDown: (e: React.MouseEvent) => void;
  onScaleMouseDown: (e: React.MouseEvent) => void;
}

export const TransformGizmo: React.FC<TransformGizmoProps> = ({
  selectedPart,
  selectedTransform,
  zScale,
  onRotateMouseDown,
  onScaleMouseDown,
}) => {
  const getPartBounds = (part: CharacterPart): { halfW: number; halfH: number } => {
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

      {/* 4 Corner Scale Handles */}
      {[
        { x: -halfW, y: -halfH },
        { x: halfW, y: -halfH },
        { x: halfW, y: halfH },
        { x: -halfW, y: halfH },
      ].map((corner, i) => (
        <rect
          key={i}
          x={corner.x - 5 * zScale}
          y={corner.y - 5 * zScale}
          width={10 * zScale}
          height={10 * zScale}
          fill="#00d2ff"
          stroke="#ffffff"
          strokeWidth={1.5 * zScale}
          style={{ cursor: 'nwse-resize', pointerEvents: 'auto' }}
          onMouseDown={onScaleMouseDown}
        />
      ))}

      {/* Center Pivot Point Dot */}
      <circle cx={0} cy={0} r={4 * zScale} fill="#00d2ff" stroke="#ffffff" strokeWidth={1.5 * zScale} />
    </g>
  );
};
