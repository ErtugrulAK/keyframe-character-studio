import type { Transform } from '../types/animator';

/**
 * Compose a parent's transform with a direct child's own (local) transform.
 *
 * This IS the composition `evaluateTransform` applies while walking the
 * parent-child chain: the parent's scale scales the child's offset, the
 * parent's rotation rotates it, rotation adds and scale multiplies, and opacity
 * (like masks) is never inherited — the child keeps its own. It lives here, next
 * to its exact inverse, so no second copy of the law can drift from the
 * evaluator.
 */
export const composeWorldTransform = (parent: Transform, child: Transform): Transform => {
  const radians = (parent.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const scaledChildX = child.x * parent.scaleX;
  const scaledChildY = child.y * parent.scaleY;
  return {
    ...child,
    x: parent.x + scaledChildX * cos - scaledChildY * sin,
    y: parent.y + scaledChildX * sin + scaledChildY * cos,
    rotation: parent.rotation + child.rotation,
    scaleX: parent.scaleX * child.scaleX,
    scaleY: parent.scaleY * child.scaleY,
    opacity: child.opacity,
  };
};

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
