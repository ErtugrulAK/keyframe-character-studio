import type { Transform } from '../types/animator';

/**
 * Container math for the "put a part inside another shape" feature.
 *
 * A child part stores its transform in the CONTAINER's local space (its
 * baseTransform becomes container-relative), while the inspector and canvas
 * work with world (composed) transforms. These helpers convert between the
 * two spaces. Coordinate convention matches the renderer: Y-down, rotation
 * clockwise-positive, center-relative positions.
 */

const deg2rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Convert a WORLD transform (as seen on the canvas / in the inspector) into
 * the container's local space. Use when assigning a part to a container so it
 * does not visually jump.
 */
export const worldToContainerLocal = (worldT: Transform, containerT: Transform): Transform => {
  const rad = deg2rad(-containerT.rotation);
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  const dx = worldT.x - containerT.x;
  const dy = worldT.y - containerT.y;
  const sX = containerT.scaleX || 1;
  const sY = containerT.scaleY || 1;
  return {
    ...worldT,
    x: (dx * cosR - dy * sinR) / sX,
    y: (dx * sinR + dy * cosR) / sY,
    rotation: worldT.rotation - containerT.rotation,
    scaleX: worldT.scaleX / sX,
    scaleY: worldT.scaleY / sY,
    opacity: containerT.opacity ? worldT.opacity / containerT.opacity : worldT.opacity,
  };
};

/**
 * Convert a container-local transform back into world space. Use when
 * removing a part from a container so it stays exactly where it was.
 */
export const containerLocalToWorld = (localT: Transform, containerT: Transform): Transform => {
  const rad = deg2rad(containerT.rotation);
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  const lx = localT.x * (containerT.scaleX || 1);
  const ly = localT.y * (containerT.scaleY || 1);
  return {
    ...localT,
    x: containerT.x + lx * cosR - ly * sinR,
    y: containerT.y + lx * sinR + ly * cosR,
    rotation: localT.rotation + containerT.rotation,
    scaleX: localT.scaleX * (containerT.scaleX || 1),
    scaleY: localT.scaleY * (containerT.scaleY || 1),
    opacity: localT.opacity * (containerT.opacity || 1),
  };
};

/**
 * Convert a world-space drag delta into container-local delta for one axis
 * pair (inverse rotation, then inverse scale).
 */
export const worldDeltaToContainerLocal = (dx: number, dy: number, containerT: Transform) => {
  const rad = deg2rad(-containerT.rotation);
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  return {
    x: (dx * cosR - dy * sinR) / (containerT.scaleX || 1),
    y: (dx * sinR + dy * cosR) / (containerT.scaleY || 1),
  };
};

/**
 * Uniform scale factor that makes a child of the given world size COVER the
 * container's bounding box (preserving the child's aspect ratio). A child
 * covering the bbox always overlaps the container's outline — even for
 * concave freeforms, where the bbox center alone can fall outside the shape
 * and a child centered there would be clipped into invisibility.
 */
export const computeContainerCoverScale = (
  containerW: number,
  containerH: number,
  childW: number,
  childH: number
): number => {
  const cw = Math.max(1, containerW);
  const ch = Math.max(1, containerH);
  const cw2 = Math.max(1, childW);
  const ch2 = Math.max(1, childH);
  return Math.max(cw / cw2, ch / ch2);
};
