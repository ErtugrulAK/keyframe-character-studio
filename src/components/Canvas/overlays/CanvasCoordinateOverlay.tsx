import React, { useSyncExternalStore } from 'react';
import { stageHoverPointer, subscribeStageHover } from '../../../utils/editor/stagePointer';
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
 * a small triangle sits on each edge of the visible stage, pointing inwards:
 * at the pointer while it is over the stage, otherwise where the axes cross
 * the edges (so the markers slide as the view pans). Where the axes cross is
 * the origin, so it carries no marker of its own.
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
  // Like ruler markers, the triangles follow the pointer while it is over the
  // stage, and mark where the axes cross the edges when it is not.
  const hover = useSyncExternalStore(subscribeStageHover, stageHoverPointer, () => null);
  const mark = hover ? { x: origin.x + hover.x, y: origin.y + hover.y } : origin;
  const xAxisShown = mark.y >= top && mark.y <= bottom;
  const yAxisShown = mark.x >= left && mark.x <= right;

  /** The triangle on one edge: its base on the edge, its tip pointing inwards. */
  const marker = (side: Side): string => {
    switch (side) {
      case 'left': return `${left},${mark.y - half} ${left + length},${mark.y} ${left},${mark.y + half}`;
      case 'right': return `${right},${mark.y - half} ${right - length},${mark.y} ${right},${mark.y + half}`;
      case 'top': return `${mark.x - half},${top} ${mark.x},${top + length} ${mark.x + half},${top}`;
      case 'bottom': return `${mark.x - half},${bottom} ${mark.x},${bottom - length} ${mark.x + half},${bottom}`;
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
