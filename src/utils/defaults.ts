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

export function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'easeIn':
      return t * t * t;
    case 'easeOut':
      return 1 - Math.pow(1 - t, 3);
    case 'easeInOut':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'bounce': {
      const n1 = 7.5625;
      const d1 = 2.75;
      let x = t;
      if (x < 1 / d1) {
        return n1 * x * x;
      } else if (x < 2 / d1) {
        return n1 * (x -= 1.5 / d1) * x + 0.75;
      } else if (x < 2.5 / d1) {
        return n1 * (x -= 2.25 / d1) * x + 0.9375;
      } else {
        return n1 * (x -= 2.625 / d1) * x + 0.984375;
      }
    }
    case 'elastic': {
      const c4 = (2 * Math.PI) / 3;
      return t === 0
        ? 0
        : t === 1
        ? 1
        : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
    }
    case 'anticipate': {
      const s = 1.70158;
      return t * t * ((s + 1) * t - s);
    }
    case 'overshoot': {
      const s = 1.70158;
      return (t - 1) * (t - 1) * ((s + 1) * (t - 1) + s) + 1;
    }
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
  easing: EasingType = 'linear'
): Transform {
  const eased = applyEasing(progress, easing);
  return {
    x: lerp(t1.x, t2.x, eased),
    y: lerp(t1.y, t2.y, eased),
    rotation: lerp(t1.rotation, t2.rotation, eased),
    scaleX: lerp(t1.scaleX, t2.scaleX, eased),
    scaleY: lerp(t1.scaleY, t2.scaleY, eased),
    opacity: lerp(t1.opacity, t2.opacity, eased),
  };
}
