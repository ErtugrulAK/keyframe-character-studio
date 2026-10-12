import type { Transform } from '../types/animator';
import type { PartLocalBounds } from './bounds';

/** A point in the stage's world space (the space authored transforms live in). */
export interface WorldPoint {
  x: number;
  y: number;
}

/**
 * The world point the selection frame's centre sits on.
 *
 * The gizmo draws the frame as `translate(origin) rotate(rotation)` around a box
 * centred at `offset * scale` in the layer's own scaled units, so the drawn
 * centre is the transform origin plus that offset rotated — which is also
 * exactly what a rotation gesture has to pivot around to look right.
 */
export const selectionFrameCenterWorld = (transform: Transform, bounds: PartLocalBounds): WorldPoint => {
  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const offsetX = bounds.offsetX * transform.scaleX;
  const offsetY = bounds.offsetY * transform.scaleY;
  return {
    x: transform.x + offsetX * cos - offsetY * sin,
    y: transform.y + offsetX * sin + offsetY * cos,
  };
};

export interface PivotRotationInput {
  /** The layer's world transform, captured at pointerdown. */
  transform: Transform;
  /** The pivot, in world space, captured at pointerdown and held for the gesture. */
  pivot: WorldPoint;
  /** The world rotation the gesture should land on. */
  rotation: number;
}

/**
 * The world transform a rotation gesture writes so the layer turns about a FIXED
 * world pivot.
 *
 * The authored model rotates a layer about its own origin, so turning about any
 * other point is that rotation plus the translation that keeps the pivot still:
 *
 *   offset = R(-rotation₀) · (pivot − origin₀)      the pivot in the layer's axes
 *   origin(rotation) = pivot − R(rotation) · offset
 *
 * `offset` comes from the transform captured at pointerdown, never from the
 * rotating bounds, so the pivot cannot drift while the gesture runs.
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
