import React from 'react';
import type { CoordinatePoint } from '../../../utils/projectCoordinates';

interface CanvasGridOverlayProps {
  artX: number;
  artY: number;
  width: number;
  height: number;
  zScale: number;
  showGrid: boolean;
  appMode: 'edit' | 'broadcast';
  origin?: CoordinatePoint;
}

export const CanvasGridOverlay: React.FC<CanvasGridOverlayProps> = ({
  artX,
  artY,
  width,
  height,
  zScale,
  showGrid,
  appMode,
}) => {
  if (appMode === 'broadcast') return null;

  return (
    <>
      {/* Solid Grid Pattern (Minor 50px + Major 100px, anchored at the origin so lines pass through the axes) */}
      {showGrid && (
        <>
          <rect className="canvas-bg" x={artX} y={artY} width={width} height={height} fill="url(#svg-grid-minor)" />
          <rect className="canvas-bg" x={artX} y={artY} width={width} height={height} fill="url(#svg-grid-major)" />
        </>
      )}

      {/* 4 Outer Artboard Boundary Limit Borders (Top, Bottom, Left, Right) */}
      <g pointerEvents="none">
        {/* Top Edge Border */}
        <line
          x1={artX}
          y1={artY}
          x2={artX + width}
          y2={artY}
          stroke="#00d2ff"
          strokeWidth={2 * zScale}
          vectorEffect="non-scaling-stroke"
        />
        {/* Bottom Edge Border */}
        <line
          x1={artX}
          y1={artY + height}
          x2={artX + width}
          y2={artY + height}
          stroke="#00d2ff"
          strokeWidth={2 * zScale}
          vectorEffect="non-scaling-stroke"
        />
        {/* Left Edge Border */}
        <line
          x1={artX}
          y1={artY}
          x2={artX}
          y2={artY + height}
          stroke="#00d2ff"
          strokeWidth={2 * zScale}
          vectorEffect="non-scaling-stroke"
        />
        {/* Right Edge Border */}
        <line
          x1={artX + width}
          y1={artY}
          x2={artX + width}
          y2={artY + height}
          stroke="#00d2ff"
          strokeWidth={2 * zScale}
          vectorEffect="non-scaling-stroke"
        />

        {/* 4 Corner Accent Markers */}
        {[
          { x: artX, y: artY },
          { x: artX + width, y: artY },
          { x: artX + width, y: artY + height },
          { x: artX, y: artY + height },
        ].map((corner, idx) => (
          <circle
            key={`corner-marker-${idx}`}
            cx={corner.x}
            cy={corner.y}
            r={3.5 * Math.min(2.5, zScale)}
            fill="#00d2ff"
            stroke="#ffffff"
            strokeWidth={1.5 * zScale}
          />
        ))}

      </g>
    </>
  );
};
