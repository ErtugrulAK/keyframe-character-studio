import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';

import { getPartLocalBounds } from '../../../utils/bounds';
import { getTransformGizmoMetrics } from '../../../utils/transformGizmoMetrics';
import { EDITOR_CAMERA_CENTER, type CoordinatePoint } from '../../../utils/projectCoordinates';

export type ScaleMode = 'scale_corner' | 'scale_x' | 'scale_y' | 'scale_left' | 'scale_right' | 'scale_top' | 'scale_bottom';

interface TransformGizmoProps {
  selectedPart: CharacterPart;
  selectedTransform: Transform;
  zScale: number;
  onRotateMouseDown: (e: React.MouseEvent) => void;
  onScaleMouseDown: (e: React.MouseEvent, mode: ScaleMode) => void;
  isGroup?: boolean;
  overrideHalfW?: number;
  overrideHalfH?: number;
  outputOrigin?: CoordinatePoint;
}

export const TransformGizmo: React.FC<TransformGizmoProps> = ({
  selectedPart,
  selectedTransform,
  zScale,
  onRotateMouseDown,
  onScaleMouseDown,
  isGroup = false,
  overrideHalfW,
  overrideHalfH,
  outputOrigin = EDITOR_CAMERA_CENTER,
}) => {
  const baseBounds = getPartLocalBounds(selectedPart, selectedTransform);

  // Keep the authored transform origin, but draw the selection frame around
  // the actual local geometry. This preserves asymmetric polygon bounds while
  // retaining the existing transform/scale semantics.
  const halfW = overrideHalfW ?? ((baseBounds.maxX - baseBounds.minX) / 2) * Math.abs(selectedTransform.scaleX);
  const halfH = overrideHalfH ?? ((baseBounds.maxY - baseBounds.minY) / 2) * Math.abs(selectedTransform.scaleY);
  const centerX = overrideHalfW === undefined ? ((baseBounds.minX + baseBounds.maxX) / 2) * Math.abs(selectedTransform.scaleX) : 0;
  const centerY = overrideHalfH === undefined ? ((baseBounds.minY + baseBounds.maxY) / 2) * Math.abs(selectedTransform.scaleY) : 0;
  const left = centerX - halfW;
  const right = centerX + halfW;
  const top = centerY - halfH;
  const bottom = centerY + halfH;
  const orientationScaleX = selectedTransform.scaleX < 0 ? -1 : 1;
  const orientationScaleY = selectedTransform.scaleY < 0 ? -1 : 1;
  const metrics = getTransformGizmoMetrics(halfW * 2, halfH * 2, zScale);

  const renderBounds = (
    <rect
      x={left}
      y={top}
      width={halfW * 2}
      height={halfH * 2}
      fill="none"
      stroke="#00d2ff"
      strokeWidth={1.5 * zScale}
      strokeDasharray={`${5 * zScale} ${4 * zScale}`}
      vectorEffect="non-scaling-stroke"
    />
  );
  const renderIndividualSelection = () => (
    <>
      {renderBounds}
      {!isGroup && (
        <>
          {[
            { x: left, y: top, key: 'top-left' },
            { x: right, y: top, key: 'top-right' },
            { x: left, y: bottom, key: 'bottom-left' },
            { x: right, y: bottom, key: 'bottom-right' },
          ].map((corner) => (
            <g key={`corner-${corner.key}`}>
              <rect
                x={corner.x - metrics.cornerSize / 2}
                y={corner.y - metrics.cornerSize / 2}
                width={metrics.cornerSize}
                height={metrics.cornerSize}
                fill="#00d2ff"
                stroke="#ffffff"
                strokeWidth={1.5 * zScale}
                style={{ cursor: 'nwse-resize', pointerEvents: 'auto' }}
                onMouseDown={(e) => onScaleMouseDown(e, 'scale_corner')}
              />
              <rect
                data-testid="gizmo-hit-target"
                x={corner.x - metrics.hitRadius}
                y={corner.y - metrics.hitRadius}
                width={metrics.hitRadius * 2}
                height={metrics.hitRadius * 2}
                fill="transparent"
                pointerEvents="auto"
                style={{ cursor: 'nwse-resize' }}
                onMouseDown={(e) => onScaleMouseDown(e, 'scale_corner')}
              />
            </g>
          ))}
          <circle cx={centerX} cy={centerY} r={metrics.centerRadius} fill="#00d2ff" stroke="#ffffff" strokeWidth={1.5 * zScale} />
        </>
      )}
    </>
  );

  const rotationY = top - metrics.rotationOffset;
  const renderEdgeHandle = (cx: number, cy: number, cursor: string, mode: ScaleMode, fill: string) => (
    <g>
      <circle cx={cx} cy={cy} r={metrics.edgeRadius} fill={fill} stroke="#ffffff" strokeWidth={1.5 * zScale} style={{ cursor, pointerEvents: 'auto' }} onMouseDown={(e) => onScaleMouseDown(e, mode)} />
      <circle data-testid="gizmo-hit-target" cx={cx} cy={cy} r={metrics.hitRadius} fill="transparent" pointerEvents="auto" style={{ cursor }} onMouseDown={(e) => onScaleMouseDown(e, mode)} />
    </g>
  );

  return (
    <g
      transform={`translate(${outputOrigin.x + selectedTransform.x}, ${outputOrigin.y + selectedTransform.y}) rotate(${selectedTransform.rotation})`}
      data-testid="transform-gizmo"
      style={{ pointerEvents: 'none' }}
    >
      <g transform={`scale(${orientationScaleX}, ${orientationScaleY})`}>
        {renderIndividualSelection()}

        {!isGroup && (
          <>
            <line
              x1={centerX}
              y1={top}
              x2={centerX}
              y2={rotationY}
              stroke="#00d2ff"
              strokeWidth={2 * zScale}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={centerX}
              cy={rotationY}
              r={metrics.rotationRadius}
              fill="#ffb700"
              stroke="#ffffff"
              strokeWidth={2 * zScale}
              style={{ cursor: 'grab', pointerEvents: 'auto' }}
              onMouseDown={onRotateMouseDown}
            />
            <circle
              data-testid="gizmo-hit-target"
              cx={centerX}
              cy={rotationY}
              r={metrics.hitRadius}
              fill="transparent"
              pointerEvents="auto"
              style={{ cursor: 'grab' }}
              onMouseDown={onRotateMouseDown}
            />
            {renderEdgeHandle(left, centerY, 'ew-resize', 'scale_left', '#38bdf8')}
            {renderEdgeHandle(right, centerY, 'ew-resize', 'scale_right', '#38bdf8')}
            {renderEdgeHandle(centerX, top, 'ns-resize', 'scale_top', '#c084fc')}
            {renderEdgeHandle(centerX, bottom, 'ns-resize', 'scale_bottom', '#c084fc')}
          </>
        )}
      </g>
    </g>
  );
};
