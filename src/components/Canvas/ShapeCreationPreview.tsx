import React from 'react';
import type { BodyPartType } from '../../types/animator';
import { getShapeGeometry, polygonPointsToString } from '../../utils/shapeGeometry';
import { getShapeCreationPlacement, type ShapeCreationBounds } from '../../utils/viewportMath';
import type { CoordinatePoint } from '../../utils/projectCoordinates';

interface ShapeCreationPreviewProps {
  type: BodyPartType;
  bounds: ShapeCreationBounds;
  outputOrigin: CoordinatePoint;
  zoom: number;
}

export const ShapeCreationPreview: React.FC<ShapeCreationPreviewProps> = ({ type, bounds, outputOrigin, zoom }) => {
  const geometry = getShapeGeometry(type);
  const placement = getShapeCreationPlacement(type, bounds);
  if (!geometry || !placement) return null;
  const strokeWidth = 1.5 / Math.max(0.15, zoom);
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
