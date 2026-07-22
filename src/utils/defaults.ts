import type { CharacterPart, Track, Transform, PresetPose, EasingType } from '../types/animator';

export const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
};

export const DEFAULT_CHARACTER_PARTS: CharacterPart[] = [];

export const DEFAULT_TRACKS: Track[] = [];

export const PRESET_POSES: PresetPose[] = [
  {
    id: 'idle',
    name: 'Idle Stance',
    transforms: {
      head: { rotation: 0, y: 150 },
      upper_arm_l: { rotation: 15 },
      upper_arm_r: { rotation: -15 },
      upper_leg_l: { rotation: 5 },
      upper_leg_r: { rotation: -5 },
    },
  },
  {
    id: 'wave',
    name: 'Friendly Wave',
    transforms: {
      head: { rotation: 5 },
      upper_arm_r: { rotation: -140 },
      lower_arm_r: { rotation: -30 },
      upper_arm_l: { rotation: 25 },
    },
  },
  {
    id: 'combat',
    name: 'Combat Ready',
    transforms: {
      head: { rotation: -5, y: 155 },
      torso: { rotation: 8 },
      upper_arm_l: { rotation: -60 },
      lower_arm_l: { rotation: -40 },
      upper_arm_r: { rotation: -45 },
      lower_arm_r: { rotation: -70 },
      upper_leg_l: { rotation: 25 },
      upper_leg_r: { rotation: -30 },
    },
  },
  {
    id: 'jump',
    name: 'Mid-Air Jump',
    transforms: {
      head: { rotation: -10, y: 130 },
      torso: { y: 200 },
      upper_arm_l: { rotation: -120 },
      upper_arm_r: { rotation: 120 },
      upper_leg_l: { rotation: 45 },
      lower_leg_l: { rotation: -60 },
      upper_leg_r: { rotation: -35 },
      lower_leg_r: { rotation: -40 },
    },
  },
];

export function solveCubicBezier(x1: number, y1: number, x2: number, y2: number, X: number): number {
  if (X <= 0) return 0;
  if (X >= 1) return 1;

  let t = X;
  for (let i = 0; i < 8; i++) {
    const currentX = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    const currentSlope = 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
    if (Math.abs(currentSlope) < 1e-6) break;
    const error = currentX - X;
    t -= error / currentSlope;
    t = Math.max(0, Math.min(1, t));
  }

  const Y = 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  return Y;
}

export function applyEasing(
  t: number,
  easing: EasingType,
  controlPoints?: [number, number, number, number]
): number {
  if (controlPoints) {
    return solveCubicBezier(controlPoints[0], controlPoints[1], controlPoints[2], controlPoints[3], t);
  }

  switch (easing) {
    case 'cubic_bezier':
      return controlPoints
        ? solveCubicBezier(controlPoints[0], controlPoints[1], controlPoints[2], controlPoints[3], t)
        : solveCubicBezier(0.42, 0, 0.58, 1, t);
    case 'easeIn':
      return solveCubicBezier(0.42, 0, 1, 1, t);
    case 'easeOut':
      return solveCubicBezier(0, 0, 0.58, 1, t);
    case 'easeInOut':
      return solveCubicBezier(0.42, 0, 0.58, 1, t);
    case 'bounce': {
      const n1 = 7.5625;
      const d1 = 2.75;
      let x = t;
      if (x < 1 / d1) return n1 * x * x;
      else if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
      else if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
      else return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }
    case 'elastic': {
      const c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
    }
    case 'anticipate':
      return solveCubicBezier(0.6, -0.28, 0.735, 0.045, t);
    case 'overshoot':
      return solveCubicBezier(0.175, 0.885, 0.32, 1.275, t);
    case 'linear':
    default:
      return t;
  }
}

export function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

export function interpolateTransform(
  t1: Transform,
  t2: Transform,
  progress: number,
  easing: EasingType = 'linear',
  controlPoints?: [number, number, number, number]
): Transform {
  const eased = applyEasing(progress, easing, controlPoints);
  return {
    x: lerp(t1.x, t2.x, eased),
    y: lerp(t1.y, t2.y, eased),
    rotation: lerp(t1.rotation, t2.rotation, eased),
    scaleX: lerp(t1.scaleX, t2.scaleX, eased),
    scaleY: lerp(t1.scaleY, t2.scaleY, eased),
    opacity: lerp(t1.opacity, t2.opacity, eased),
  };
}
