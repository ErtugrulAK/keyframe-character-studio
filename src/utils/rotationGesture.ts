import type { Transform } from '../types/animator';

/** A point in the stage's world space (the space authored transforms live in). */
interface WorldPoint {
  x: number;
  y: number;
}

interface PivotRotationInput {
  /** The layer's world transform, captured at pointerdown. */
  transform: Transform;
  /** The pivot, in world space, captured at pointerdown and held for the gesture. */
  pivot: WorldPoint;
  /** The world rotation the gesture should land on. */
  rotation: number;
}

/**
 * The world transform that turns a layer about a FIXED world pivot (the arrange
 * commands' ±90° rotation of a selection as one rigid body).
 *
 * The authored model rotates a layer about its own origin, so turning about any
 * other point is that rotation plus the translation that keeps the pivot still:
 *
 *   offset = R(-rotation₀) · (pivot − origin₀)      the pivot in the layer's axes
 *   origin(rotation) = pivot − R(rotation) · offset
 *
 * `offset` comes from the transform captured at pointerdown, never from the
 * rotating bounds, so the pivot cannot drift while the gesture runs.
 *
 * AUDIT (the world-affine contract): this is NOT a hand-rolled
 * `R(rotation)·(local ⊙ scale)` map, so there is no world map here to route
 * through `worldAffineOf`. The layer's own scale cancels — scaling happens about
 * the layer's own origin, so turning about a fixed world pivot only moves that
 * origin, and the origin's orbit about the pivot has radius `|offset|` whatever
 * the scale is.
 */
export const rotateAboutWorldPivot = ({ transform, pivot, rotation }: PivotRotationInput): { x: number; y: number; rotation: number } => {
  const startRadians = (transform.rotation * Math.PI) / 180;
  const dx = pivot.x - transform.x;
  const dy = pivot.y - transform.y;
  const localX = dx * Math.cos(startRadians) + dy * Math.sin(startRadians);
  const localY = -dx * Math.sin(startRadians) + dy * Math.cos(startRadians);

  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: pivot.x - (localX * cos - localY * sin),
    y: pivot.y - (localX * sin + localY * cos),
    rotation,
  };
};
