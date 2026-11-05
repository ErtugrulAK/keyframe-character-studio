import React from 'react';
import type { BodyPartType } from '../../types/animator';
import { getShapeGeometry, polygonPointsToString } from '../../utils/geometry/shapeGeometry';
import { getShapeCreationPlacement, type ShapeCreationBounds } from '../../utils/geometry/viewportMath';
import type { CoordinatePoint } from '../../utils/geometry/projectCoordinates';

interface ShapeCreationPreviewProps {
  type: BodyPartType;
  bounds: ShapeCreationBounds;
  outputOrigin: CoordinatePoint;
}

export const ShapeCreationPreview: React.FC<ShapeCreationPreviewProps> = ({ type, bounds, outputOrigin }) => {
  if (type === 'custom_text') {
    // The text box being drawn (stage units already), with the text it will
    // hold at the size it will have: the font follows the box height (as
    // `getTextCreationProps` sizes it), and a box too narrow for it shrinks it.
    const NEW_TEXT = 'NEW TEXT';
    const byHeight = Math.min(400, Math.max(8, bounds.height / 1.2));
    // Average glyph width of a bold sans text, about 0.62 em.
    const fontSize = Math.max(4, Math.min(byHeight, bounds.width / (NEW_TEXT.length * 0.62)));
    return (
      <g data-testid="shape-creation-preview" pointerEvents="none">
        <rect
          x={bounds.minX}
          y={bounds.minY}
          width={bounds.width}
          height={bounds.height}
          fill="rgba(56, 189, 248, 0.06)"
          stroke="#38bdf8"
          strokeWidth={1}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
        <text
          data-testid="text-creation-preview"
          x={bounds.centerX}
          y={bounds.centerY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight={700}
          fontFamily="Inter, sans-serif"
          fill="rgba(255, 255, 255, 0.55)"
        >
          {NEW_TEXT}
        </text>
      </g>
    );
  }
  const geometry = getShapeGeometry(type);
  const placement = getShapeCreationPlacement(type, bounds);
  if (!geometry || !placement) return null;
  // A non-scaling stroke is already measured in screen pixels; dividing by the
  // zoom as well made the outline swell when zoomed out.
  const strokeWidth = 1.5;
  const fill = 'rgba(56, 189, 248, 0.18)';
  const stroke = '#38bdf8';
  const common = { fill, stroke, strokeWidth, strokeDasharray: '6 4', vectorEffect: 'non-scaling-stroke' as const };

  return (
    <g
      data-testid="shape-creation-preview"
      transform={`translate(${outputOrigin.x + placement.x}, ${outputOrigin.y + placement.y}) rotate(0) scale(${placement.scaleX}, ${placement.scaleY})`}
      pointerEvents="none"
    >
      {geometry.kind === 'rect' && <rect x={geometry.x} y={geometry.y} width={geometry.width} height={geometry.height} rx={geometry.rx} {...common} />}
      {geometry.kind === 'circle' && <circle cx={0} cy={0} r={geometry.r} {...common} />}
      {geometry.kind === 'polygon' && <polygon points={polygonPointsToString(geometry.points)} {...common} />}
    </g>
  );
};
