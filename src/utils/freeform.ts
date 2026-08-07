import type { FreeformPoint } from '../types/animator';

/**
 * Pure helpers for the freeform drawing feature.
 * Free of React dependencies and independently testable.
 */

export const MIN_FREEFORM_POINTS = 3;

/**
 * Convert a local vertex point into canvas-center-relative display
 * coordinates (Y-up), matching the POS X / POS Y fields in the inspector.
 * Applies the part's scale and rotation (same math as the SVG renderer:
 * translate -> rotate -> scale).
 */
export const freeformVertexToDisplay = (
  p: FreeformPoint,
  transform: { x: number; y: number; scaleX: number; scaleY: number; rotation: number }
): { x: number; y: number } => {
  const { x: tx, y: ty, scaleX, scaleY, rotation } = transform;
  const rad = (rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  const sx = Math.max(0.001, scaleX);
  const sy = Math.max(0.001, scaleY);
  const dx = p.x * sx * cosR - p.y * sy * sinR;
  const dy = p.x * sx * sinR + p.y * sy * cosR;
  return { x: tx + dx, y: -(ty + dy) };
};

/**
 * Inverse of freeformVertexToDisplay: display coords (canvas-center-relative,
 * Y-up) -> local point (center-relative, Y-down) that the renderer consumes.
 */
export const freeformVertexToLocal = (
  dispX: number,
  dispY: number,
  transform: { x: number; y: number; scaleX: number; scaleY: number; rotation: number }
): FreeformPoint => {
  const { x: tx, y: ty, scaleX, scaleY, rotation } = transform;
  const rad = (rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  const sx = Math.max(0.001, scaleX);
  const sy = Math.max(0.001, scaleY);
  const dx = dispX - tx;
  const dy = -dispY - ty;
  return { x: (dx * cosR + dy * sinR) / sx, y: (-dx * sinR + dy * cosR) / sy };
};

export interface FreeformExtents {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const getFreeformExtents = (points: FreeformPoint[]): FreeformExtents => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
};

export const hasValidFreeformPoints = (points: FreeformPoint[] | undefined): boolean =>
  Array.isArray(points) && points.length >= MIN_FREEFORM_POINTS;

/**
 * Build an SVG path "d" string from the given points (a closed polygon).
 * Returns '' for degenerate inputs.
 */
export const buildFreeformPath = (points: FreeformPoint[], closed: boolean = true): string => {
  if (!Array.isArray(points) || points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  if (closed) d += ' Z';
  return d;
};

/**
 * Half-extents of the bounding box around the points.
 * Falls back to a 32x32 default for empty input.
 */
export const getFreeformBounds = (points: FreeformPoint[]): { halfW: number; halfH: number } => {
  if (!Array.isArray(points) || points.length === 0) return { halfW: 32, halfH: 32 };
  const { minX, minY, maxX, maxY } = getFreeformExtents(points);
  if (!isFinite(minX)) return { halfW: 32, halfH: 32 };
  return {
    halfW: Math.max(1, (maxX - minX) / 2),
    halfH: Math.max(1, (maxY - minY) / 2),
  };
};

/**
 * Normalize raw stage points to center-relative coordinates (part-local space)
 * and return the stage-space center to use as the part transform position.
 */
export const normalizeFreeformPoints = (
  points: FreeformPoint[]
): { points: FreeformPoint[]; centerX: number; centerY: number } => {
  const { minX, minY, maxX, maxY } = getFreeformExtents(points);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    points: points.map((p) => ({ x: p.x - centerX, y: p.y - centerY })),
    centerX,
    centerY,
  };
};

/**
 * Total perimeter of the closed polygon (includes the closing edge).
 */
export const getFreeformPerimeter = (points: FreeformPoint[]): number => {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let perimeter = 0;
  for (let i = 1; i < points.length; i++) {
    perimeter += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  if (points.length > 2) {
    perimeter += Math.hypot(
      points[0].x - points[points.length - 1].x,
      points[0].y - points[points.length - 1].y
    );
  }
  return perimeter;
};

/**
 * Remove consecutive points that are closer than `minDist` to the previous
 * kept point (used to thin freehand mouse samples and dedupe double-click
 * artifacts). Always keeps the first point.
 */
export const simplifyFreeformPoints = (points: FreeformPoint[], minDist: number = 3): FreeformPoint[] => {
  if (!Array.isArray(points) || points.length === 0) return [];
  const result: FreeformPoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    if (Math.hypot(points[i].x - prev.x, points[i].y - prev.y) >= minDist) {
      result.push(points[i]);
    }
  }
  return result;
};

export interface FreeformVertexWorld {
  x: number;
  y: number;
}

/**
 * Map center-relative local points to their world (stage) positions, applying
 * the same transform the shape renderer uses: translate -> rotate -> scale.
 * Used to draw numbered markers at the visible vertices on the canvas.
 */
export const getFreeformVertexWorldPositions = (
  points: FreeformPoint[],
  centerX: number,
  centerY: number,
  scaleX: number,
  scaleY: number,
  rotationDeg: number
): FreeformVertexWorld[] => {
  const rad = (rotationDeg * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  return (points || []).map((p) => {
    const lx = p.x * scaleX;
    const ly = p.y * scaleY;
    return {
      x: centerX + lx * cosR - ly * sinR,
      y: centerY + lx * sinR + ly * cosR,
    };
  });
};
