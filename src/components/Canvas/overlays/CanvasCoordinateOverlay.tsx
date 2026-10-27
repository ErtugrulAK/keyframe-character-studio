import React from 'react';
import type { Transform } from '../../../types/animator';
import type { WorldAffine } from '../../../utils/containerMath';
import { worldAffineOf } from '../../../utils/containerMath';
import type { CoordinatePoint } from '../../../utils/projectCoordinates';

interface CanvasCoordinateOverlayProps {
  artX: number;
  artY: number;
  width: number;
  height: number;
  origin: CoordinatePoint;
  zScale: number;
  selectedTransform?: (Transform & { affine?: WorldAffine }) | null;
}

/**
 * Edit-stage coordinate chrome.
 *
 * The axes are drawn in the same editor-camera space as the artboard and every
 * layer, so zoom, pan and resize move them through the existing camera
 * transform. The selected marker reads the evaluated world affine: a parented,
 * rotated or scaled layer is marked at its actual world origin, not at its
 * authored local position.
 */
export const CanvasCoordinateOverlay: React.FC<CanvasCoordinateOverlayProps> = ({
  artX,
  artY,
  width,
  height,
  origin,
  zScale,
  selectedTransform,
}) => {
  const arrowWing = 4 * zScale;
  const xEnd = artX + width;
  const yEnd = artY;
  const selectedAffine = selectedTransform ? worldAffineOf(selectedTransform) : null;
  const selectedX = selectedAffine ? origin.x + selectedAffine.e : 0;
  const selectedY = selectedAffine ? origin.y + selectedAffine.f : 0;
  const hasSelectedMarker = Boolean(
    selectedAffine
    && Number.isFinite(selectedX)
    && Number.isFinite(selectedY),
  );

  return (
    <g
      className="canvas-coordinate-overlay"
      data-testid="coordinate-overlay"
      pointerEvents="none"
      aria-hidden="true"
    >
      {/* Dark keylines keep the accent axes readable over both light and dark artwork. */}
      <line
        className="canvas-coordinate-axis"
        x1={artX}
        y1={origin.y}
        x2={artX + width}
        y2={origin.y}
        stroke="rgba(4, 9, 16, 0.72)"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      />
      <line
        className="canvas-coordinate-axis"
        x1={origin.x}
        y1={artY}
        x2={origin.x}
        y2={artY + height}
        stroke="rgba(4, 9, 16, 0.72)"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      />
      <line
        className="canvas-coordinate-axis canvas-coordinate-axis-x"
        data-axis="x"
        x1={artX}
        y1={origin.y}
        x2={artX + width}
        y2={origin.y}
        stroke="var(--accent-red)"
        strokeOpacity={0.7}
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />
      <line
        className="canvas-coordinate-axis canvas-coordinate-axis-y"
        data-axis="y"
        x1={origin.x}
        y1={artY}
        x2={origin.x}
        y2={artY + height}
        stroke="var(--accent-green)"
        strokeOpacity={0.7}
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />

      {/* Positive directions: X right, Y up to match the Inspector's inverted Y.
          C10 — the arrowheads and letters sit at the artboard's edges, where
          the axes end, instead of on top of the artwork at the centre. */}
      <path
        d={`M ${xEnd - arrowWing * 1.6} ${origin.y - arrowWing} L ${xEnd} ${origin.y} L ${xEnd - arrowWing * 1.6} ${origin.y + arrowWing} Z`}
        fill="var(--accent-red)"
        fillOpacity={0.9}
      />
      <path
        d={`M ${origin.x - arrowWing} ${yEnd + arrowWing * 1.6} L ${origin.x} ${yEnd} L ${origin.x + arrowWing} ${yEnd + arrowWing * 1.6} Z`}
        fill="var(--accent-green)"
        fillOpacity={0.9}
      />
      <text
        className="canvas-coordinate-label canvas-coordinate-label-x"
        x={xEnd - 4 * zScale}
        y={origin.y - 9 * zScale}
        fill="var(--accent-red)"
        fontSize={11 * zScale}
        fontWeight={800}
        textAnchor="end"
        stroke="rgba(4, 9, 16, 0.9)"
        strokeWidth={3 * zScale}
        paintOrder="stroke"
      >
        X
      </text>
      <text
        className="canvas-coordinate-label canvas-coordinate-label-y"
        x={origin.x + 9 * zScale}
        y={yEnd + 14 * zScale}
        fill="var(--accent-green)"
        fontSize={11 * zScale}
        fontWeight={800}
        textAnchor="start"
        stroke="rgba(4, 9, 16, 0.9)"
        strokeWidth={3 * zScale}
        paintOrder="stroke"
      >
        Y
      </text>

      {/* Origin crosshair (C10: no "0,0" caption over the artwork). */}
      <g data-testid="coordinate-origin">
        <line
          x1={origin.x - 8 * zScale}
          y1={origin.y}
          x2={origin.x + 8 * zScale}
          y2={origin.y}
          stroke="rgba(255, 255, 255, 0.72)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={origin.x}
          y1={origin.y - 8 * zScale}
          x2={origin.x}
          y2={origin.y + 8 * zScale}
          stroke="rgba(255, 255, 255, 0.72)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={origin.x}
          cy={origin.y}
          r={3.2 * zScale}
          fill="var(--bg-darkest)"
          stroke="var(--accent-cyan)"
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
        />
      </g>

      {hasSelectedMarker && (
        <g
          data-testid="coordinate-selection-marker"
          data-world-x={selectedAffine?.e}
          data-world-y={selectedAffine?.f}
        >
          <circle
            cx={selectedX}
            cy={selectedY}
            r={11 * zScale}
            fill="none"
            stroke="var(--accent-cyan)"
            strokeOpacity={0.8}
            strokeWidth={1.2}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={selectedX - 15 * zScale}
            y1={selectedY}
            x2={selectedX - 7 * zScale}
            y2={selectedY}
            stroke="var(--accent-cyan)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={selectedX + 7 * zScale}
            y1={selectedY}
            x2={selectedX + 15 * zScale}
            y2={selectedY}
            stroke="var(--accent-cyan)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={selectedX}
            y1={selectedY - 15 * zScale}
            x2={selectedX}
            y2={selectedY - 7 * zScale}
            stroke="var(--accent-cyan)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={selectedX}
            y1={selectedY + 7 * zScale}
            x2={selectedX}
            y2={selectedY + 15 * zScale}
            stroke="var(--accent-cyan)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={selectedX}
            cy={selectedY}
            r={2.5 * zScale}
            fill="var(--accent-cyan)"
            stroke="#ffffff"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    </g>
  );
};
