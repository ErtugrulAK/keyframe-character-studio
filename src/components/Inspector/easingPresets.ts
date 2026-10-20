/**
 * Built-in easing curve presets — the single shared list (E1).
 *
 * Owned by no component so both the Curve Studio editor and the Value Graph
 * handle rows offer the identical six-plus-two curves without duplicating the
 * table. Points are [x1, y1, x2, y2] in the stored temporal-handle space and
 * are applied through the existing handle-patch authority only.
 */

export interface EasingPreset {
  label: string;
  points: [number, number, number, number];
}

export const PRESET_BEZIERS: EasingPreset[] = [
  { label: 'Linear', points: [0.25, 0.25, 0.75, 0.75] },
  { label: 'Ease In', points: [0.42, 0.0, 1.0, 1.0] },
  { label: 'Ease Out', points: [0.0, 0.0, 0.58, 1.0] },
  { label: 'Ease In Out', points: [0.42, 0.0, 0.58, 1.0] },
  { label: 'Overshoot', points: [0.175, 0.885, 0.32, 1.275] },
  { label: 'Anticipate', points: [0.6, -0.28, 0.735, 0.045] },
  { label: 'Slow Mo', points: [0.1, 1.0, 0.1, 1.0] },
  { label: 'Elastic', points: [0.68, -0.55, 0.265, 1.55] },
];
