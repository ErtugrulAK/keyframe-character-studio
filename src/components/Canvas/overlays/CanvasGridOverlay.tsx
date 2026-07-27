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
  if (appMode === 'broadcast') return null;

  return (
    <>
      {/* Dashed Grid Pattern (Aligned to Top-Left Corner, NO HALF SQUARES) */}
      {showGrid && (
        <rect className="canvas-bg" x={artX} y={artY} width={width} height={height} fill="url(#svg-dashed-grid)" />
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

        {/* Boundary Coordinate Text Labels (Top, Bottom, Left, Right) */}
        {/* Top Edge Label */}
        <text
          x={300}
          y={artY - 6 * zScale}
          fill="#38bdf8"
          fontSize={11 * zScale}
          fontWeight="700"
          textAnchor="middle"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          TOP / ÜST (Y: +{height / 2}px | POS Y: +{(height / 200).toFixed(2)})
        </text>

        {/* Bottom Edge Label */}
        <text
          x={300}
          y={artY + height + 14 * zScale}
          fill="#38bdf8"
          fontSize={11 * zScale}
          fontWeight="700"
          textAnchor="middle"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          BOTTOM / ALT (Y: -{height / 2}px | POS Y: -{(height / 200).toFixed(2)})
        </text>

        {/* Left Edge Label */}
        <text
          x={artX - 8 * zScale}
          y={240}
          fill="#38bdf8"
          fontSize={11 * zScale}
          fontWeight="700"
          textAnchor="end"
          dominantBaseline="middle"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          LEFT / SOL (X: -{width / 2}px | POS X: -{(width / 200).toFixed(2)})
        </text>

        {/* Right Edge Label */}
        <text
          x={artX + width + 8 * zScale}
          y={240}
          fill="#38bdf8"
          fontSize={11 * zScale}
          fontWeight="700"
          textAnchor="start"
          dominantBaseline="middle"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          RIGHT / SAĞ (X: +{width / 2}px | POS X: +{(width / 200).toFixed(2)})
        </text>
      </g>

      {/* Origin Center Grid Axes */}
      <g clipPath="url(#artboard-clip)" pointerEvents="none">
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
