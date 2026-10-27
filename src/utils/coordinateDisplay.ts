import type { Transform } from '../types/animator';
import type { SceneCoordinateSystem } from '../types/composition';

/**
 * The Inspector's position display contract.
 *
 * Project-unit scenes are authored in raw centre-relative units. Historical
 * scenes still carry the centi-unit Inspector representation, so the overlay
 * must use the same scale as `TransformPositionCard` instead of introducing a
 * second interpretation of the same authored numbers.
 */
export const getPositionDisplayScale = (coordinateSystem: SceneCoordinateSystem): number => (
  coordinateSystem === 'project-unit-center-v1' ? 1 : 0.01
);

export interface InspectorPositionDisplay {
  x: number;
  y: number;
}

/**
 * The X/Y pair the Inspector shows for an evaluated world transform.
 *
 * The stage's Y axis points down while the Inspector's Y axis points up, so the
 * sign is inverted here once for every display consumer.
 */
export const toInspectorPositionDisplay = (
  transform: Pick<Transform, 'x' | 'y'>,
  coordinateSystem: SceneCoordinateSystem,
): InspectorPositionDisplay => {
  const scale = getPositionDisplayScale(coordinateSystem);
  return {
    x: transform.x * scale,
    y: -transform.y * scale,
  };
};

/** Matches `SmartNumberInput`'s two-decimal display without trailing zeros. */
export const formatInspectorCoordinate = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};
