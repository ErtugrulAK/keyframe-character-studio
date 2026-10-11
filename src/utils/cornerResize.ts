import type { Transform } from '../types/animator';
import type { PartLocalBounds } from './bounds';

/**
 * Corner resize geometry authority — the ONE place that solves a corner drag.
 *
 * Model (matches the renderer and `getPartWorldBounds`):
 *
 *   cornerWorld(local) = origin + R(rotation) · (local ⊙ scale)
 *
 * A drag must therefore keep the diagonally OPPOSITE corner's world position
 * invariant while the dragged corner follows the pointer. Because the layer's
 * rotation is preserved and the local geometry never changes, the whole solve
 * is linear in the local basis:
 *
 *   span   = draggedLocal − oppositeLocal          (unchanged for the gesture)
 *   travel = R(−rotation) · (pointer − pointerAtDown)
 *   scale' = scale + travel ⊘ span                 (per axis, sign included)
 *   origin' = fixed − R(rotation) · (oppositeLocal ⊙ scale')
 *
 * `origin'` is derived from the fixed corner, so the anchor is exact (never a
 * subtraction of two large numbers) and the dragged corner lands exactly under
 * the pointer, with no jump at pointer-down. Crossing a corner flips the scale
 * sign, which the gizmo renders as the mirror it is.
 *
 * The input transform is the layer's WORLD transform (the evaluator's output)
 * and the result is a world-space transform patch; converting it into the
 * layer's container-local space belongs to the canonical write authority
 * (`updateCurrentTransform`).
 */

/** The four corner handles of the transform gizmo. */
export type CornerId = 'tl' | 'tr' | 'bl' | 'br';

/** The local-space geometry bounds the gizmo drew the handles around. */
export type CornerBounds = Pick<PartLocalBounds, 'minX' | 'minY' | 'maxX' | 'maxY'>;

export interface CornerResizeInput {
  /** World transform of the layer when the drag started. */
  transform: Pick<Transform, 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY'>;
  /** Local geometry bounds when the drag started (stroke-expanded like the gizmo). */
  bounds: CornerBounds;
  /** Which corner handle the pointer grabbed. */
  corner: CornerId;
  /** Pointer position in world space at pointer-down. */
  startPointer: { x: number; y: number };
  /** Current pointer position in world space. */
  pointer: { x: number; y: number };
  /** Keep the authored aspect ratio (the Inspector's Aspect Ratio lock). */
  uniform?: boolean;
  /** Smallest allowed scale magnitude per axis. */
  minScale?: number;
}

export interface CornerResizeResult {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

/** Smallest allowed scale magnitude; the fixed corner survives the clamp. */
export const MIN_CORNER_SCALE = 0.05;

/** Below this a local span cannot drive a scale solve. */
const MIN_SPAN = 1e-6;

export const resolveCornerResize = ({
  transform,
  bounds,
  corner,
  startPointer,
  pointer,
  uniform = false,
  minScale = MIN_CORNER_SCALE,
}: CornerResizeInput): CornerResizeResult => {
  const { x, y, rotation, scaleX, scaleY } = transform;

  // The gizmo draws each handle at its own local bounds corner and mirrors the
  // group for negative scale, so the handle identity maps to the local corner
  // regardless of the sign of the scale.
  const isLeft = corner === 'tl' || corner === 'bl';
  const isTop = corner === 'tl' || corner === 'tr';
  const draggedLocalX = isLeft ? bounds.minX : bounds.maxX;
  const draggedLocalY = isTop ? bounds.minY : bounds.maxY;
  const oppositeLocalX = isLeft ? bounds.maxX : bounds.minX;
  const oppositeLocalY = isTop ? bounds.maxY : bounds.minY;

  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  // The diagonally opposite corner is the fixed point of the whole gesture.
  const fixedX = x + oppositeLocalX * scaleX * cos - oppositeLocalY * scaleY * sin;
  const fixedY = y + oppositeLocalX * scaleX * sin + oppositeLocalY * scaleY * cos;

  // Pointer travel since pointer-down, expressed in the layer's local basis.
  const deltaWorldX = pointer.x - startPointer.x;
  const deltaWorldY = pointer.y - startPointer.y;
  const travelX = deltaWorldX * cos + deltaWorldY * sin;
  const travelY = -deltaWorldX * sin + deltaWorldY * cos;

  const spanX = draggedLocalX - oppositeLocalX;
  const spanY = draggedLocalY - oppositeLocalY;

  let nextScaleX = Math.abs(spanX) > MIN_SPAN ? scaleX + travelX / spanX : scaleX;
  let nextScaleY = Math.abs(spanY) > MIN_SPAN ? scaleY + travelY / spanY : scaleY;

  if (uniform) {
    // One factor for both axes: project the travel onto the diagonal the
    // gesture follows, so the aspect ratio is preserved exactly and the drag
    // still starts without a jump.
    const diagonalX = spanX * scaleX;
    const diagonalY = spanY * scaleY;
    const diagonalLengthSq = diagonalX * diagonalX + diagonalY * diagonalY;
    const factor = diagonalLengthSq > MIN_SPAN
      ? 1 + (diagonalX * travelX + diagonalY * travelY) / diagonalLengthSq
      : 1;
    nextScaleX = scaleX * factor;
    nextScaleY = scaleY * factor;
  }

  // Clamp the magnitude, keep the crossed sign, and rebuild the origin from the
  // fixed corner so the anchor survives the clamp.
  if (Math.abs(nextScaleX) < minScale) nextScaleX = nextScaleX < 0 ? -minScale : minScale;
  if (Math.abs(nextScaleY) < minScale) nextScaleY = nextScaleY < 0 ? -minScale : minScale;

  return {
    x: fixedX - (oppositeLocalX * nextScaleX * cos - oppositeLocalY * nextScaleY * sin),
    y: fixedY - (oppositeLocalX * nextScaleX * sin + oppositeLocalY * nextScaleY * cos),
    scaleX: nextScaleX,
    scaleY: nextScaleY,
  };
};
