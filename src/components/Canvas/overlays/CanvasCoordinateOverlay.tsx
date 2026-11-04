import React from 'react';
import type { CoordinatePoint } from '../../../utils/geometry/projectCoordinates';

interface CanvasCoordinateOverlayProps {
  artX: number;
  artY: number;
  width: number;
  height: number;
  origin: CoordinatePoint;
  zScale: number;
  /** The camera-space rectangle the stage shows; the axis markers ride its edges. */
  visibleRect?: { left: number; right: number; top: number; bottom: number } | null;
}

/** Faint white: readable over dark and light artwork without competing with it. */
const AXIS_STROKE = 'rgba(255, 255, 255, 0.32)';
const MARKER_FILL = 'rgba(255, 255, 255, 0.6)';
/** Marker size in screen pixels (a third of the old axis badge). */
const MARKER_LENGTH = 5;
const MARKER_HALF_WIDTH = 3;

type Side = 'left' | 'right' | 'top' | 'bottom';

/**
 * Edit-stage coordinate chrome.
 *
 * The axes are drawn in the same editor-camera space as the artboard and every
 * layer, so zoom, pan and resize move them through the existing camera
 * transform, and they run across the whole visible stage. Like ruler markers,
 * a small triangle sits on each edge of the visible stage where an axis
 * crosses it, pointing in towards the origin; the markers slide along the
 * edges as the view pans. Where the axes cross is the origin, so it carries no
 * marker of its own.
 */
export const CanvasCoordinateOverlay: React.FC<CanvasCoordinateOverlayProps> = ({
  artX,
  artY,
  width,
  height,
  origin,
  zScale,
  visibleRect = null,
}) => {
  const left = visibleRect?.left ?? artX;
  const right = visibleRect?.right ?? artX + width;
  const top = visibleRect?.top ?? artY;
  const bottom = visibleRect?.bottom ?? artY + height;
  const length = MARKER_LENGTH * zScale;
  const half = MARKER_HALF_WIDTH * zScale;
  const xAxisShown = origin.y >= top && origin.y <= bottom;
  const yAxisShown = origin.x >= left && origin.x <= right;

  /** The triangle on one edge: its base on the edge, its tip pointing inwards. */
  const marker = (side: Side): string => {
    switch (side) {
      case 'left': return `${left},${origin.y - half} ${left + length},${origin.y} ${left},${origin.y + half}`;
      case 'right': return `${right},${origin.y - half} ${right - length},${origin.y} ${right},${origin.y + half}`;
      case 'top': return `${origin.x - half},${top} ${origin.x},${top + length} ${origin.x + half},${top}`;
      case 'bottom': return `${origin.x - half},${bottom} ${origin.x},${bottom - length} ${origin.x + half},${bottom}`;
    }
  };
  const markers: Array<{ side: Side; axis: 'x' | 'y' }> = [
    ...(xAxisShown ? [{ side: 'left', axis: 'x' }, { side: 'right', axis: 'x' }] as const : []),
    ...(yAxisShown ? [{ side: 'top', axis: 'y' }, { side: 'bottom', axis: 'y' }] as const : []),
  ];

  return (
    <g
      className="canvas-coordinate-overlay"
      data-testid="coordinate-overlay"
      pointerEvents="none"
      aria-hidden="true"
    >
      <line
        className="canvas-coordinate-axis canvas-coordinate-axis-x"
        data-axis="x"
        x1={Math.min(left, artX)}
        y1={origin.y}
        x2={Math.max(right, artX + width)}
        y2={origin.y}
        stroke={AXIS_STROKE}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <line
        className="canvas-coordinate-axis canvas-coordinate-axis-y"
        data-axis="y"
        x1={origin.x}
        y1={Math.min(top, artY)}
        x2={origin.x}
        y2={Math.max(bottom, artY + height)}
        stroke={AXIS_STROKE}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {markers.map(({ side, axis }) => (
        <polygon
          key={side}
          className="canvas-coordinate-marker"
          data-testid={`coordinate-axis-marker-${side}`}
          data-marker-axis={axis}
          points={marker(side)}
          fill={MARKER_FILL}
        />
      ))}
    </g>
  );
};
