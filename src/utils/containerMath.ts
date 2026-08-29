import type { Transform } from '../types/animator';

/**
 * Convert a world-space transform into a direct child's local transform.
 * The evaluator applies parent scale, then parent rotation, then translation;
 * this is the exact inverse used by canvas and Inspector edits.
 */
export const worldToContainerLocal = (world: Transform, parent: Transform): Transform => {
  const radians = (parent.rotation * Math.PI) / 180;
  const dx = world.x - parent.x;
  const dy = world.y - parent.y;
  const unrotatedX = dx * Math.cos(radians) + dy * Math.sin(radians);
  const unrotatedY = -dx * Math.sin(radians) + dy * Math.cos(radians);
  return {
    ...world,
    x: unrotatedX / (parent.scaleX || 1),
    y: unrotatedY / (parent.scaleY || 1),
    rotation: world.rotation - parent.rotation,
    scaleX: world.scaleX / (parent.scaleX || 1),
    scaleY: world.scaleY / (parent.scaleY || 1),
  };
};
