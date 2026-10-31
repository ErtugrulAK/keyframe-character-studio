import React from 'react';
import type { Transform } from '../../../types/animator';
import type { WorldAffine } from '../../../utils/geometry/containerMath';
import { worldAffineOf } from '../../../utils/geometry/containerMath';
import type { CoordinatePoint } from '../../../utils/geometry/projectCoordinates';

interface CanvasCoordinateOverlayProps {
  artX: number;
  artY: number;
  width: number;
  height: number;
  origin: CoordinatePoint;
  zScale: number;
  /** The camera-space rectangle the stage shows; the axis badges stay inside it. */
  visibleRect?: { left: number; right: number; top: number; bottom: number } | null;
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
  visibleRect = null,
  selectedTransform,
}) => {
  const badgeRadius = 7.5 * zScale;
  const badgeInset = 6 * zScale;
  // Each badge sits at the visible end of its positive half-axis: the
  // artboard edge, or the window's edge when the artboard runs past it.
  const xEnd = Math.min(artX + width, visibleRect?.right ?? Infinity) - badgeRadius - badgeInset;
  const yEnd = Math.max(artY, visibleRect?.top ?? -Infinity) + badgeRadius + badgeInset;
  const badges = [
    { axis: 'x', cx: xEnd, cy: origin.y, color: 'var(--accent-red)', letter: 'X', shown: xEnd > origin.x + 2 * badgeRadius },
    { axis: 'y', cx: origin.x, cy: yEnd, color: 'var(--accent-green)', letter: 'Y', shown: yEnd < origin.y - 2 * badgeRadius },
  ] as const;
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
          C12 — each axis ends in a small coloured disc carrying its letter
          (the convention of 3D view gizmos) at the visible end of the
          positive half-axis: readable over any artwork, on screen at every
          zoom, and never over the centre. */}
      {badges.filter((badge) => badge.shown).map((badge) => (
        <g key={badge.axis} className="canvas-coordinate-badge" data-testid={`coordinate-axis-badge-${badge.axis}`}>
          <circle
            cx={badge.cx}
            cy={badge.cy}
            r={badgeRadius}
            fill={badge.color}
            stroke="rgba(4, 9, 16, 0.85)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <text
            className={`canvas-coordinate-label canvas-coordinate-label-${badge.axis}`}
            x={badge.cx}
            y={badge.cy}
            dy="0.36em"
            fill="#0b1018"
            fontSize={9.5 * zScale}
            fontWeight={800}
            textAnchor="middle"
          >
            {badge.letter}
          </text>
        </g>
      ))}

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
