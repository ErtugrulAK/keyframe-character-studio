import type { AnimationTrackData, BezierPath, CharacterPart, PathCoordinateSpace } from '../types/animator';
import type { PathPoint } from './bezierPath';
import { applyAffine, invertAffine } from './containerMath';
import { normalizationAffine, type MaskPathFrame } from './maskPathEditing';

/**
 * Creating layer masks and editing a mask path as a whole (rotate,
 * scale, add/remove points). Every result is an ordinary `BezierPath` in the
 * mask's own coordinate space: no mask primitive, no mask transform field and
 * no new schema. Creation and edits are written through the existing mask
 * writers (`masks[]` / `authorMaskPath`).
 */

/** Cubic Bézier circle constant: a quarter arc's handle reach as a fraction of the radius. */
const ELLIPSE_KAPPA = 0.5522847498307936;

const vertexId = (index: number): string => `vertex-${index}`;

/** An axis-aligned rectangle in path space (layer-aligned for a normalized path). */
export const createRectangleMaskPath = (coordinateSpace: PathCoordinateSpace, from: PathPoint, to: PathPoint): BezierPath => {
  const x0 = Math.min(from.x, to.x);
  const x1 = Math.max(from.x, to.x);
  const y0 = Math.min(from.y, to.y);
  const y1 = Math.max(from.y, to.y);
  return {
    version: 1,
    coordinateSpace,
    closed: true,
    points: [
      { id: vertexId(0), x: x0, y: y0, kind: 'corner' },
      { id: vertexId(1), x: x1, y: y0, kind: 'corner' },
      { id: vertexId(2), x: x1, y: y1, kind: 'corner' },
      { id: vertexId(3), x: x0, y: y1, kind: 'corner' },
    ],
  };
};

/**
 * An ellipse inscribed in the dragged box, as the standard FOUR cubic segments
 * (kappa ≈ 0.5523) — an explicit geometric approximation (radial error below
 * 0.03 %), not a new ellipse primitive. Bézier curves are affine invariant, so
 * the shape stays an ellipse under any owner transform.
 */
export const createEllipseMaskPath = (coordinateSpace: PathCoordinateSpace, from: PathPoint, to: PathPoint): BezierPath => {
  const cx = (from.x + to.x) / 2;
  const cy = (from.y + to.y) / 2;
  const rx = Math.abs(to.x - from.x) / 2;
  const ry = Math.abs(to.y - from.y) / 2;
  const kx = rx * ELLIPSE_KAPPA;
  const ky = ry * ELLIPSE_KAPPA;
  return {
    version: 1,
    coordinateSpace,
    closed: true,
    points: [
      { id: vertexId(0), x: cx, y: cy - ry, kind: 'smooth', handleIn: { x: cx - kx, y: cy - ry }, handleOut: { x: cx + kx, y: cy - ry } },
      { id: vertexId(1), x: cx + rx, y: cy, kind: 'smooth', handleIn: { x: cx + rx, y: cy - ky }, handleOut: { x: cx + rx, y: cy + ky } },
      { id: vertexId(2), x: cx, y: cy + ry, kind: 'smooth', handleIn: { x: cx + kx, y: cy + ry }, handleOut: { x: cx - kx, y: cy + ry } },
      { id: vertexId(3), x: cx - rx, y: cy, kind: 'smooth', handleIn: { x: cx - rx, y: cy + ky }, handleOut: { x: cx - rx, y: cy - ky } },
    ],
  };
};

/** A closed corner polygon through the pen clicks. */
export const createPolygonMaskPath = (coordinateSpace: PathCoordinateSpace, points: readonly PathPoint[]): BezierPath => ({
  version: 1,
  coordinateSpace,
  closed: true,
  points: points.map((point, index) => ({ id: vertexId(index), x: point.x, y: point.y, kind: 'corner' })),
});

/** The fewest vertices a closed mask path keeps (two would enclose no area). */
export const MIN_CLOSED_MASK_POINTS = 3;
export const MIN_OPEN_MASK_POINTS = 2;

const mapPath = (path: BezierPath, map: (point: PathPoint) => PathPoint): BezierPath => ({
  ...path,
  points: path.points.map((vertex) => ({
    ...vertex,
    ...map(vertex),
    ...(vertex.handleIn ? { handleIn: map(vertex.handleIn) } : {}),
    ...(vertex.handleOut ? { handleOut: map(vertex.handleOut) } : {}),
  })),
});

/**
 * Whole-path rotation (degrees) and scale about the vertices' bounding-box
 * centre, applied to every vertex AND absolute handle in LAYER-LOCAL space — a
 * normalized path is expanded first, so a rotation stays a rotation on a
 * non-square layer. The owner's pivot, transform and channels are untouched;
 * the result is a path edit, written as a path value or a path key.
 */
export const transformMaskPathInLayerSpace = (
  path: BezierPath,
  part: CharacterPart,
  change: { rotation?: number; scaleX?: number; scaleY?: number },
): BezierPath => {
  if (path.points.length === 0) return path;
  const toLocal = normalizationAffine(part, path.coordinateSpace);
  const toPath = invertAffine(toLocal);
  const radians = ((change.rotation ?? 0) * Math.PI) / 180;
  const scaleX = change.scaleX ?? 1;
  const scaleY = change.scaleY ?? 1;
  if (!toPath || ![radians, scaleX, scaleY].every(Number.isFinite)) return path;
  const local = path.points.map((vertex) => applyAffine(toLocal, vertex));
  const cx = (Math.min(...local.map((point) => point.x)) + Math.max(...local.map((point) => point.x))) / 2;
  const cy = (Math.min(...local.map((point) => point.y)) + Math.max(...local.map((point) => point.y))) / 2;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return mapPath(path, (point) => {
    const p = applyAffine(toLocal, point);
    const dx = (p.x - cx) * scaleX;
    const dy = (p.y - cy) * scaleY;
    return applyAffine(toPath, { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos });
  });
};

/**
 * D-08 — adding or removing a vertex changes the path TOPOLOGY. A path with
 * keys in any sequence interpolates key to key by vertex identity, so the first
 * canvas slice refuses topology edits on an animated mask path, with a reason.
 */
export const maskPathTopologyLockReason = (
  track: Pick<AnimationTrackData, 'maskPathChannels'> | undefined,
  maskId: string,
): string | null => {
  const keys = track?.maskPathChannels?.[`${maskId}:path`] ?? [];
  return keys.length > 0
    ? 'The mask path is animated: adding or removing points would break its keyframes.'
    : null;
};

/** Removes one vertex; refuses (null) at the minimum point count. */
export const deleteMaskVertex = (path: BezierPath, index: number): BezierPath | null => {
  const minimum = path.closed ? MIN_CLOSED_MASK_POINTS : MIN_OPEN_MASK_POINTS;
  if (!path.points[index] || path.points.length <= minimum) return null;
  return { ...path, points: path.points.filter((_, vertexIndex) => vertexIndex !== index) };
};

const lerp = (a: PathPoint, b: PathPoint, t: number): PathPoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** The segment from vertex `index` to the next one (wrapping for a closed path). */
const segmentEnds = (path: BezierPath, index: number) => {
  const start = path.points[index];
  const endIndex = index + 1 < path.points.length ? index + 1 : path.closed ? 0 : -1;
  const end = endIndex >= 0 ? path.points[endIndex] : undefined;
  return start && end && endIndex !== index ? { start, end, endIndex } : null;
};

/** A point on segment `index` at parameter t (cubic when either end carries a handle). */
export const pointOnMaskPathSegment = (path: BezierPath, index: number, t: number): PathPoint | null => {
  const ends = segmentEnds(path, index);
  if (!ends) return null;
  const { start, end } = ends;
  if (!start.handleOut && !end.handleIn) return lerp(start, end, t);
  const c1 = start.handleOut ?? start;
  const c2 = end.handleIn ?? end;
  const a = lerp(start, c1, t);
  const b = lerp(c1, c2, t);
  const c = lerp(c2, end, t);
  return lerp(lerp(a, b, t), lerp(b, c, t), t);
};

/**
 * The segment and parameter nearest to a WORLD point, measured in world space
 * (through the frame's own map) so a normalized, non-square path picks the
 * visually nearest edge. Sampled, then refined inside the winning interval.
 */
export const nearestMaskPathSegment = (
  path: BezierPath,
  frame: MaskPathFrame,
  world: PathPoint,
  samplesPerSegment = 32,
): { segmentIndex: number; t: number; distance: number } | null => {
  const distanceAt = (index: number, t: number): number => {
    const point = pointOnMaskPathSegment(path, index, t);
    if (!point) return Number.POSITIVE_INFINITY;
    const mapped = applyAffine(frame.toWorld, point);
    return Math.hypot(mapped.x - world.x, mapped.y - world.y);
  };
  let best: { segmentIndex: number; t: number; distance: number } | null = null;
  for (let index = 0; index < path.points.length; index += 1) {
    if (!segmentEnds(path, index)) continue;
    for (let sample = 1; sample < samplesPerSegment; sample += 1) {
      const t = sample / samplesPerSegment;
      const distance = distanceAt(index, t);
      if (!best || distance < best.distance) best = { segmentIndex: index, t, distance };
    }
  }
  if (!best) return null;
  let low = Math.max(1e-3, best.t - 1 / samplesPerSegment);
  let high = Math.min(1 - 1e-3, best.t + 1 / samplesPerSegment);
  for (let step = 0; step < 24; step += 1) {
    const m1 = low + (high - low) / 3;
    const m2 = high - (high - low) / 3;
    if (distanceAt(best.segmentIndex, m1) <= distanceAt(best.segmentIndex, m2)) high = m2;
    else low = m1;
  }
  const t = (low + high) / 2;
  return { segmentIndex: best.segmentIndex, t, distance: distanceAt(best.segmentIndex, t) };
};

/**
 * Inserts a vertex at parameter t of segment `index` WITHOUT changing the
 * drawn shape: a straight segment gains a corner on the line, a curved one is
 * split with De Casteljau so both halves trace the original curve exactly.
 * The new vertex gets a fresh id; existing ids never change.
 */
export const insertMaskVertex = (path: BezierPath, index: number, t: number): BezierPath | null => {
  const ends = segmentEnds(path, index);
  if (!ends || !(t > 0 && t < 1)) return null;
  const { start, end, endIndex } = ends;
  const usedIds = new Set(path.points.map((vertex) => vertex.id));
  let next = path.points.length;
  while (usedIds.has(vertexId(next))) next += 1;
  const id = vertexId(next);
  const points = [...path.points];
  if (!start.handleOut && !end.handleIn) {
    points.splice(index + 1, 0, { id, ...lerp(start, end, t), kind: 'corner' });
    return { ...path, points };
  }
  const c1 = start.handleOut ?? start;
  const c2 = end.handleIn ?? end;
  const a = lerp(start, c1, t);
  const b = lerp(c1, c2, t);
  const c = lerp(c2, end, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  const split = lerp(d, e, t);
  points[index] = { ...start, handleOut: a };
  points[endIndex] = { ...end, handleIn: c };
  points.splice(index + 1, 0, { id, x: split.x, y: split.y, kind: 'smooth', handleIn: d, handleOut: e });
  return { ...path, points };
};
