import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';

import { getPartBounds } from '../../../utils/bounds';
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
  const baseBounds = getPartBounds(selectedPart, selectedTransform);
  
  // Bounds are the transform contract: controls always describe the
  // axis-aligned authored geometry box, never arbitrary polygon vertices.
  const halfW = overrideHalfW ?? (baseBounds.halfW * Math.abs(selectedTransform.scaleX));
  const halfH = overrideHalfH ?? (baseBounds.halfH * Math.abs(selectedTransform.scaleY));
  const orientationScaleX = selectedTransform.scaleX < 0 ? -1 : 1;
  const orientationScaleY = selectedTransform.scaleY < 0 ? -1 : 1;

  const renderBounds = (
    <>
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
    </>
  );

  const renderIndividualSelection = () => (
    <>
      {renderBounds}
      {!isGroup && (
        <>
          {[-1, 1].map((x) => [-1, 1].map((y) => (
            <rect
              key={`corner-${x}-${y}`}
              x={x * halfW - 5 * zScale}
              y={y * halfH - 5 * zScale}
              width={10 * zScale}
              height={10 * zScale}
              fill="#00d2ff"
              stroke="#ffffff"
              strokeWidth={1.5 * zScale}
              style={{ cursor: 'nwse-resize', pointerEvents: 'auto' }}
              onMouseDown={(e) => onScaleMouseDown(e, 'scale_corner')}
            />
          )))}
          <circle cx={0} cy={0} r={4 * zScale} fill="#00d2ff" stroke="#ffffff" strokeWidth={1.5 * zScale} />
        </>
      )}
    </>
  );

  const rotBarLength = halfH + 30 * zScale;

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
              x1={0}
              y1={-halfH}
              x2={0}
              y2={-(halfH + 30 * zScale)}
              stroke="#00d2ff"
              strokeWidth={2 * zScale}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={0}
              cy={-(halfH + 30 * zScale)}
              r={7 * zScale}
              fill="#ffb700"
              stroke="#ffffff"
              strokeWidth={2 * zScale}
              style={{ cursor: 'grab', pointerEvents: 'auto' }}
              onMouseDown={onRotateMouseDown}
            />
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
          </>
        )}
      </g>
    </g>
  );
};
