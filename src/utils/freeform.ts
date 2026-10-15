import type { BezierPath, FreeformPoint } from '../types/animator';
import { buildBezierPathD, createBezierPath, legacyFreeformPointsToPath } from './bezierPath';
import { applyAffine, invertAffine, worldAffineOf, type WorldAffine } from './containerMath';

/**
 * Pure helpers for the freeform drawing feature.
 * Free of React dependencies and independently testable.
 */

/**
 * A freeform layer's WORLD transform: the authored TRS reading plus the DERIVED
 * exact map the evaluator attaches when the nesting is not expressible as those
 * numbers (a rotated child of an anisotropically scaled container is SHEARED).
 * The overlay and the Inspector hand this helper the evaluated world transform,
 * so every world-facing map below reads the affine through `worldAffineOf` — a
 * plain `Transform` keeps its historical numbers because the field is optional.
 */
type WorldTransformInput = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  affine?: WorldAffine;
};

/** The path a freeform layer actually renders: the canonical path when it exists,
 *  otherwise the legacy points normalized and converted to a local closed path
 *  (a repeated closing vertex is dropped, exactly like the render branch does). */
export const resolveFreeformPath = (part: { path?: BezierPath; points?: FreeformPoint[] }): BezierPath | undefined =>
  part.path ?? legacyFreeformPointsToPath(normalizeClosedPoints(part.points ?? []), true);

export const MIN_FREEFORM_POINTS = 3;

/**
 * Convert a local vertex point into canvas-center-relative display
 * coordinates (Y-up), matching the POS X / POS Y fields in the inspector.
 * Applies the layer's WORLD transform, so the position goes through its exact
 * affine (`worldAffineOf`) — the same map the shape renderer draws with — and
 * the display Y axis is flipped. Hand-rolling `translate + R(rotation)·(local ⊙ scale)`
 * dropped the shear of a rotated child inside an anisotropically scaled
 * container, which put the field (and the numbered marker) off the drawn vertex.
 */
export const freeformVertexToDisplay = (
  p: FreeformPoint,
  transform: WorldTransformInput
): { x: number; y: number } => {
  const mapped = applyAffine(worldAffineOf(transform), p);
  return { x: mapped.x, y: -mapped.y };
};

/**
 * Inverse of freeformVertexToDisplay: display coords (canvas-center-relative,
 * Y-up) -> local point (center-relative, Y-down) that the renderer consumes.
 * The display map crosses the world affine, so only its EXACT inverse puts the
 * edited vertex where the typed coordinate says it is.
 */
export const freeformVertexToLocal = (
  dispX: number,
  dispY: number,
  transform: WorldTransformInput
): FreeformPoint => {
  const inverse = invertAffine(worldAffineOf(transform));
  if (inverse) return applyAffine(inverse, { x: dispX, y: -dispY });
  // Collapsed map (det ≈ 0): there is no inverse, so the historical reading is
  // kept verbatim — the sign-preserving epsilon below only guards the division
  // of such a degenerate (invisible) layer against a zero scale.
  const { x: tx, y: ty, scaleX, scaleY, rotation } = transform;
  const rad = (rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  const sx = scaleX !== 0 ? scaleX : 0.001;
  const sy = scaleY !== 0 ? scaleY : 0.001;
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
  return buildBezierPathD(createBezierPath(points, 'local', closed));
};

/**
 * Remove a closing duplicate of the first vertex from a polygon ring.
 * SVG paths close themselves, so keeping the duplicate only creates an
 * overlapping marker and makes the vertex list appear to skip its first label.
 */
export const normalizeClosedPoints = (points: FreeformPoint[]): FreeformPoint[] => {
  if (!Array.isArray(points) || points.length < 2) return points || [];
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.hypot(last.x - first.x, last.y - first.y) <= 1e-6) {
    return points.slice(0, -1);
  }
  return points;
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
 * Map center-relative LOCAL points to their world (stage) positions.
 *
 * The layer is drawn with its exact world affine, so the markers go through
 * `applyAffine(worldAffineOf(world), point)` with the stage origin folded in —
 * never `origin + R(rotation)·(local ⊙ scale)`, which drew the markers of a
 * rotated child inside an anisotropically scaled container off the shape (the
 * drawn vertices are SHEARED there). `origin` is the output/stage origin the
 * caller also folds into the rendered transform.
 */
export const getFreeformVertexWorldPositions = (
  points: FreeformPoint[],
  world: WorldTransformInput,
  origin: { x: number; y: number }
): FreeformVertexWorld[] => {
  const map = worldAffineOf(world);
  return (points || []).map((p) => {
    const mapped = applyAffine(map, p);
    return { x: origin.x + mapped.x, y: origin.y + mapped.y };
  });
};
