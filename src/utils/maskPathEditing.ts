import type { AnimationTrackData, BezierPath, CharacterPart, CustomMotionPreset, LayerMask, PathCoordinateSpace } from '../types/animator';
import type { RuntimeTrackState } from '../types/composition';
import type { PathPoint } from './bezierPath';
import { moveVertexHandle, type BezierHandleKind } from './bezierPath';
import { applyAffine, composeAffine, invertAffine, worldAffineOf, type WorldAffine } from './containerMath';
import { maskPathNormalizationSize } from './layerMasks';
import { computeProceduralDelta } from './proceduralAnimation';

/**
 * WP-02 — canvas editing of an EXISTING layer mask path.
 *
 * A LayerMask owns no transform of its own: moving a mask moves its path
 * vertices and their absolute tangent handles, never the owner layer. Every map
 * here composes the renderer's own authorities — `maskPathNormalizationSize`
 * (the same normalization `buildLayerMaskPathD` draws with) and the owner's
 * evaluated world affine (`worldAffineOf`) — so the editing overlay and the
 * clip can never disagree, including under rotation, negative scale and a
 * sheared parent nesting.
 */

/**
 * Below this many world units per path unit along its thinnest direction, the
 * path → world map is treated as collapsed: an inverse would turn a one-pixel
 * pointer move into an unbounded path delta. Measured as a lower bound of the
 * smallest singular value (|det| / Frobenius norm), so it means the same for a
 * normalized path (one unit = the whole layer) and a local one.
 */
export const MASK_EDIT_MIN_SCALE = 1e-6;

export interface MaskPathFrame {
  /** Path space (normalized or layer-local) → project-relative world. */
  toWorld: WorldAffine;
  /** Project-relative world → path space. */
  toPath: WorldAffine;
}

/** Normalized (u, v) → layer-local, exactly as the renderer expands it. */
export const normalizationAffine = (part: CharacterPart, coordinateSpace: PathCoordinateSpace): WorldAffine => {
  if (coordinateSpace !== 'normalized') return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const { width, height } = maskPathNormalizationSize(part);
  return { a: width, b: 0, c: 0, d: height, e: -width / 2, f: -height / 2 };
};

/**
 * The frozen path ↔ world maps of one owner pose, or `null` when the pose is
 * not invertible (zero scale, a zero-sized normalized layer, non-finite data).
 * A null frame is a refusal: no pointer delta may be invented for it.
 */
export const resolveMaskPathFrame = (
  part: CharacterPart,
  coordinateSpace: PathCoordinateSpace,
  world: Parameters<typeof worldAffineOf>[0],
): MaskPathFrame | null => {
  const toWorld = composeAffine(worldAffineOf(world), normalizationAffine(part, coordinateSpace));
  const determinant = toWorld.a * toWorld.d - toWorld.b * toWorld.c;
  const frobenius = Math.hypot(toWorld.a, toWorld.b, toWorld.c, toWorld.d);
  if (!Number.isFinite(determinant) || !(frobenius > 0) || Math.abs(determinant) / frobenius < MASK_EDIT_MIN_SCALE) return null;
  const toPath = invertAffine(toWorld);
  if (!toPath || !Object.values(toPath).every(Number.isFinite)) return null;
  return { toWorld, toPath };
};

/** A path point in project-relative world space. */
export const maskPathPointToWorld = (frame: MaskPathFrame, point: PathPoint): PathPoint => applyAffine(frame.toWorld, point);

/**
 * The path-space delta between two world points. Both go through the SAME
 * frozen inverse, so the delta is exact for any invertible affine and the
 * camera zoom is never applied twice.
 */
export const maskPathDeltaFromWorld = (frame: MaskPathFrame, startWorld: PathPoint, currentWorld: PathPoint): PathPoint => {
  const start = applyAffine(frame.toPath, startWorld);
  const current = applyAffine(frame.toPath, currentWorld);
  return { x: current.x - start.x, y: current.y - start.y };
};

const isFiniteDelta = (delta: PathPoint): boolean => Number.isFinite(delta.x) && Number.isFinite(delta.y);
const shift = <T extends PathPoint>(point: T, delta: PathPoint): T => ({ ...point, x: point.x + delta.x, y: point.y + delta.y });

/**
 * Whole-path move: every vertex AND its absolute handles take the same delta,
 * applied to the gesture's INITIAL path (never to the previous preview), so a
 * long drag cannot accumulate drift. Normalized values are not clamped: a mask
 * that reaches past the layer is valid geometry.
 */
export const translateMaskPath = (initialPath: BezierPath, delta: PathPoint): BezierPath => {
  if (!isFiniteDelta(delta)) return initialPath;
  return {
    ...initialPath,
    points: initialPath.points.map((vertex) => ({
      ...shift(vertex, delta),
      ...(vertex.handleIn ? { handleIn: shift(vertex.handleIn, delta) } : {}),
      ...(vertex.handleOut ? { handleOut: shift(vertex.handleOut, delta) } : {}),
    })),
  };
};

/** One vertex moves; its own absolute handles ride along by the same delta. */
export const moveMaskVertex = (initialPath: BezierPath, index: number, delta: PathPoint): BezierPath => {
  if (!isFiniteDelta(delta) || !initialPath.points[index]) return initialPath;
  return {
    ...initialPath,
    points: initialPath.points.map((vertex, vertexIndex) => (vertexIndex === index
      ? {
        ...shift(vertex, delta),
        ...(vertex.handleIn ? { handleIn: shift(vertex.handleIn, delta) } : {}),
        ...(vertex.handleOut ? { handleOut: shift(vertex.handleOut, delta) } : {}),
      }
      : vertex)),
  };
};

/**
 * One tangent handle moves by `delta` from its initial position; a smooth
 * vertex keeps its counterpart mirrored (shared `moveVertexHandle` rule). A
 * vertex without that handle is left untouched.
 */
export const moveMaskHandle = (initialPath: BezierPath, index: number, handle: BezierHandleKind, delta: PathPoint): BezierPath => {
  const vertex = initialPath.points[index];
  const start = vertex?.[handle === 'in' ? 'handleIn' : 'handleOut'];
  if (!vertex || !start || !isFiniteDelta(delta)) return initialPath;
  return {
    ...initialPath,
    points: initialPath.points.map((candidate, vertexIndex) => (vertexIndex === index
      ? moveVertexHandle(candidate, handle, { x: start.x + delta.x, y: start.y + delta.y })
      : candidate)),
  };
};

/** Why the canvas cannot edit this mask right now, or `null` when it can. */
export type MaskEditBlock =
  | { kind: 'locked'; message: string }
  | { kind: 'singular'; message: string }
  | { kind: 'procedural'; message: string }
  | { kind: 'playback'; message: string };

/**
 * D-03 — the first canvas slice edits only where the owner's on-screen pose IS
 * its evaluated keyframe pose. While an IN/OUT preset or a live stunt adds a
 * procedural delta at this frame, the renderer draws a pose the authoring
 * inverse does not model, so editing is refused with a visible reason instead
 * of writing a path that lands somewhere else.
 */
export const resolveMaskEditBlock = (input: {
  part: CharacterPart;
  mask: LayerMask;
  tracks: (AnimationTrackData & RuntimeTrackState)[];
  totalFrames: number;
  frame: number;
  customPresets: CustomMotionPreset[];
  hasLiveStunt: boolean;
  frameMap: MaskPathFrame | null;
  isPlaying?: boolean;
}): MaskEditBlock | null => {
  if (input.mask.locked) return { kind: 'locked', message: 'This mask is locked. Unlock it to edit its path.' };
  // D-03: a gesture is authored at one frozen frame; the playhead must stand still.
  if (input.isPlaying) return { kind: 'playback', message: 'Pause playback to edit the mask.' };
  const delta = computeProceduralDelta(
    input.part,
    input.tracks,
    input.totalFrames,
    input.frame,
    { appMode: 'edit', broadcast: {}, liveStunts: {} },
    input.customPresets,
  );
  const procedural = input.hasLiveStunt
    || delta.x !== 0 || delta.y !== 0 || delta.rotation !== 0 || delta.scaleX !== 1 || delta.scaleY !== 1;
  if (procedural) {
    return {
      kind: 'procedural',
      message: 'An IN/OUT preset moves this layer at this frame. Move the playhead outside the preset to edit the mask.',
    };
  }
  if (!input.frameMap) {
    return { kind: 'singular', message: 'The layer is scaled to zero here, so its mask cannot be edited on the canvas.' };
  }
  return null;
};
