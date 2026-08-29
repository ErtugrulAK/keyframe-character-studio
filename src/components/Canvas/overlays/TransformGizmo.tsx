import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';

import { getPartLocalBounds } from '../../../utils/bounds';
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
            <rect
              key={`corner-${corner.key}`}
              x={corner.x - 5 * zScale}
              y={corner.y - 5 * zScale}
              width={10 * zScale}
              height={10 * zScale}
              fill="#00d2ff"
              stroke="#ffffff"
              strokeWidth={1.5 * zScale}
              style={{ cursor: 'nwse-resize', pointerEvents: 'auto' }}
              onMouseDown={(e) => onScaleMouseDown(e, 'scale_corner')}
            />
          ))}
          <circle cx={centerX} cy={centerY} r={4 * zScale} fill="#00d2ff" stroke="#ffffff" strokeWidth={1.5 * zScale} />
        </>
      )}
    </>
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
              y2={top - 30 * zScale}
              stroke="#00d2ff"
              strokeWidth={2 * zScale}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={centerX}
              cy={top - 30 * zScale}
              r={7 * zScale}
              fill="#ffb700"
              stroke="#ffffff"
              strokeWidth={2 * zScale}
              style={{ cursor: 'grab', pointerEvents: 'auto' }}
              onMouseDown={onRotateMouseDown}
            />
            <circle
              cx={left}
              cy={centerY}
              r={4.5 * zScale}
              fill="#38bdf8"
              stroke="#ffffff"
              strokeWidth={1.5 * zScale}
              style={{ cursor: 'ew-resize', pointerEvents: 'auto' }}
              onMouseDown={(e) => onScaleMouseDown(e, 'scale_left')}
            />
            <circle
              cx={right}
              cy={centerY}
              r={4.5 * zScale}
              fill="#38bdf8"
              stroke="#ffffff"
              strokeWidth={1.5 * zScale}
              style={{ cursor: 'ew-resize', pointerEvents: 'auto' }}
              onMouseDown={(e) => onScaleMouseDown(e, 'scale_right')}
            />
            <circle
              cx={centerX}
              cy={top}
              r={4.5 * zScale}
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth={1.5 * zScale}
              style={{ cursor: 'ns-resize', pointerEvents: 'auto' }}
              onMouseDown={(e) => onScaleMouseDown(e, 'scale_top')}
            />
            <circle
              cx={centerX}
              cy={bottom}
              r={4.5 * zScale}
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth={1.5 * zScale}
              style={{ cursor: 'ns-resize', pointerEvents: 'auto' }}
              onMouseDown={(e) => onScaleMouseDown(e, 'scale_bottom')}
            />
          </>
        )}
      </g>
    </g>
  );
};
