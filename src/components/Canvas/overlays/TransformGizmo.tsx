import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';

import { getPartBounds } from '../../../utils/bounds';
import { renderShapeOutline, getPartCornerPoints } from '../../../utils/shapeOutlineHelper';
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
  
  // Multiply bounds by absolute scale so handles don't get warped or flipped visually
  const halfW = overrideHalfW ?? (baseBounds.halfW * Math.abs(selectedTransform.scaleX));
  const halfH = overrideHalfH ?? (baseBounds.halfH * Math.abs(selectedTransform.scaleY));
  // The renderer applies signed scale to the authored local geometry. Keep the
  // editor overlay in that same local orientation so mirrored asymmetric
  // shapes (for example parallelograms and triangles) do not show a stale,
  // unmirrored outline or handle layout.
  const orientationScaleX = selectedTransform.scaleX < 0 ? -1 : 1;
  const orientationScaleY = selectedTransform.scaleY < 0 ? -1 : 1;

  const rotBarLength = halfH + 30 * zScale;

  return (
    <g
      transform={`translate(${outputOrigin.x + selectedTransform.x}, ${outputOrigin.y + selectedTransform.y}) rotate(${selectedTransform.rotation})`}
      data-testid="transform-gizmo"
      style={{ pointerEvents: 'none' }}
    >
      <g transform={`scale(${orientationScaleX}, ${orientationScaleY})`}>
        {/* Shape-Conforming Dashed Selection Outline */}
        {renderShapeOutline(selectedPart, halfW, halfH, zScale)}

        {/* Shape corner points on the borders (like the freeform's vertex dots) */}
        {getPartCornerPoints(selectedPart, halfW, halfH).map((c, i) => (
          <circle
            key={`corner-pt-${i}`}
            cx={c.x}
            cy={c.y}
            r={3.5 * zScale}
            fill="#ffffff"
            stroke="#00d2ff"
            strokeWidth={1.5 * zScale}
            style={{ pointerEvents: 'none' }}
          />
        ))}

        {!isGroup && (
          <>
          {/* Rotation Handle (Top Center, extended upwards) */}
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

          {/* 4 Corner Scale Handles (Proportional / Uniform Scale) */}
          {(() => {
            // For the parallelogram the handles sit on the shape's actual
            // vertices (the slanted corners), not the bounding-box corners.
            const isParallelogram = selectedPart.type === 'custom_parallelogram';
            const corners = isParallelogram
              ? (() => {
                  const sx = halfW / 60;
                  const sy = halfH / 30;
                  return [
                    { x: -35 * sx, y: -30 * sy, cursor: 'nwse-resize' },
                    { x: 85 * sx, y: -30 * sy, cursor: 'nesw-resize' },
                    { x: 35 * sx, y: 30 * sy, cursor: 'nwse-resize' },
                    { x: -85 * sx, y: 30 * sy, cursor: 'nesw-resize' },
                  ];
                })()
              : [
                  { x: -halfW, y: -halfH, cursor: 'nwse-resize' },
                  { x: halfW, y: -halfH, cursor: 'nesw-resize' },
                  { x: halfW, y: halfH, cursor: 'nwse-resize' },
                  { x: -halfW, y: halfH, cursor: 'nesw-resize' },
                ];
            return corners.map((corner, i) => (
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
            ));
          })()}
          </>
        )}

        {/* Center Pivot Point Dot */}
        <circle cx={0} cy={0} r={4 * zScale} fill="#00d2ff" stroke="#ffffff" strokeWidth={1.5 * zScale} />
      </g>
    </g>
  );
};
