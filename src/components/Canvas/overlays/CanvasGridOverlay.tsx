import React from 'react';

interface CanvasGridOverlayProps {
  artX: number;
  artY: number;
  width: number;
  height: number;
  zScale: number;
  showGrid: boolean;
  appMode: 'edit' | 'broadcast';
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
  if (appMode === 'broadcast' || !showGrid) return null;

  return (
    <>
      {/* Dashed Grid Pattern */}
      <rect className="canvas-bg" x={artX} y={artY} width={width} height={height} fill="url(#svg-dashed-grid)" />

      {/* Origin Center Grid Axes */}
      <g clipPath="url(#artboard-clip)">
        <line
          x1="-300000"
          y1="240"
          x2="300000"
          y2="240"
          stroke="rgba(239, 68, 68, 0.75)"
          strokeWidth={1.5 * zScale}
          strokeDasharray={`${6 * zScale} ${4 * zScale}`}
        />
        <line
          x1="300"
          y1="-300000"
          x2="300"
          y2="300000"
          stroke="rgba(16, 185, 129, 0.75)"
          strokeWidth={1.5 * zScale}
          strokeDasharray={`${6 * zScale} ${4 * zScale}`}
        />
        <circle cx={300} cy={240} r={5 * Math.min(3, zScale)} fill="#38bdf8" stroke="#ffffff" strokeWidth={1.5 * zScale} />
      </g>
    </>
  );
};
