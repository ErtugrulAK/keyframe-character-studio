import type { CharacterPart, Track, Transform, PresetPose, EasingType } from '../types/animator';

export const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
};

export const DEFAULT_CHARACTER_PARTS: CharacterPart[] = [
  // Head & Hair
  {
    id: 'hair',
    name: 'Hair',
    type: 'hair',
    zIndex: 10,
    fillColor: '#3d2514',
    strokeColor: '#25150a',
    pivot: { x: 0.5, y: 0.9 },
    baseTransform: { x: 300, y: 110, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  },
  {
    id: 'head',
    name: 'Head',
    type: 'head',
    zIndex: 9,
    fillColor: '#ffdbac',
    strokeColor: '#d6a374',
    pivot: { x: 0.5, y: 0.8 },
    baseTransform: { x: 300, y: 150, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  },
  // Torso
  {
    id: 'torso',
    name: 'Torso',
    type: 'torso',
    zIndex: 5,
    fillColor: '#2b580c',
    strokeColor: '#1e3d08',
    pivot: { x: 0.5, y: 0.5 },
    baseTransform: { x: 300, y: 240, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  },
  // Left Arm (Viewer's Left)
  {
    id: 'upper_arm_l',
    name: 'Left Upper Arm',
    type: 'upper_arm_l',
    zIndex: 4,
    fillColor: '#3a7515',
    strokeColor: '#1e3d08',
    pivot: { x: 0.5, y: 0.1 },
    baseTransform: { x: 240, y: 200, rotation: 15, scaleX: 1, scaleY: 1, opacity: 1 },
  },
  {
    id: 'lower_arm_l',
    name: 'Left Lower Arm & Hand',
    type: 'lower_arm_l',
    zIndex: 3,
    fillColor: '#ffdbac',
    strokeColor: '#d6a374',
    pivot: { x: 0.5, y: 0.1 },
    baseTransform: { x: 225, y: 260, rotation: 20, scaleX: 1, scaleY: 1, opacity: 1 },
  },
  // Right Arm (Viewer's Right)
  {
    id: 'upper_arm_r',
    name: 'Right Upper Arm',
    type: 'upper_arm_r',
    zIndex: 4,
    fillColor: '#3a7515',
    strokeColor: '#1e3d08',
    pivot: { x: 0.5, y: 0.1 },
    baseTransform: { x: 360, y: 200, rotation: -15, scaleX: 1, scaleY: 1, opacity: 1 },
  },
  {
    id: 'lower_arm_r',
    name: 'Right Lower Arm & Hand',
    type: 'lower_arm_r',
    zIndex: 3,
    fillColor: '#ffdbac',
    strokeColor: '#d6a374',
    pivot: { x: 0.5, y: 0.1 },
    baseTransform: { x: 375, y: 260, rotation: -20, scaleX: 1, scaleY: 1, opacity: 1 },
  },
  // Left Leg
  {
    id: 'upper_leg_l',
    name: 'Left Upper Leg',
    type: 'upper_leg_l',
    zIndex: 2,
    fillColor: '#1a2a3a',
    strokeColor: '#0f1a26',
    pivot: { x: 0.5, y: 0.1 },
    baseTransform: { x: 275, y: 310, rotation: 5, scaleX: 1, scaleY: 1, opacity: 1 },
  },
  {
    id: 'lower_leg_l',
    name: 'Left Lower Leg & Foot',
    type: 'lower_leg_l',
    zIndex: 1,
    fillColor: '#333333',
    strokeColor: '#111111',
    pivot: { x: 0.5, y: 0.1 },
    baseTransform: { x: 270, y: 380, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  },
  // Right Leg
  {
    id: 'upper_leg_r',
    name: 'Right Upper Leg',
    type: 'upper_leg_r',
    zIndex: 2,
    fillColor: '#1a2a3a',
    strokeColor: '#0f1a26',
    pivot: { x: 0.5, y: 0.1 },
    baseTransform: { x: 325, y: 310, rotation: -5, scaleX: 1, scaleY: 1, opacity: 1 },
  },
  {
    id: 'lower_leg_r',
    name: 'Right Lower Leg & Foot',
    type: 'lower_leg_r',
    zIndex: 1,
    fillColor: '#333333',
    strokeColor: '#111111',
    pivot: { x: 0.5, y: 0.1 },
    baseTransform: { x: 330, y: 380, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  },
];

export const DEFAULT_TRACKS: Track[] = [
  {
    id: 'track_head',
    partId: 'head',
    name: 'Head Transform',
    color: '#00d2ff',
    visible: true,
    locked: false,
    keyframes: [
      { id: 'kf_h1', frame: 0, transform: { ...DEFAULT_CHARACTER_PARTS[1].baseTransform }, easing: 'easeInOut' },
      { id: 'kf_h2', frame: 30, transform: { ...DEFAULT_CHARACTER_PARTS[1].baseTransform, y: 154, rotation: -3 }, easing: 'easeInOut' },
      { id: 'kf_h3', frame: 60, transform: { ...DEFAULT_CHARACTER_PARTS[1].baseTransform }, easing: 'easeInOut' },
    ],
  },
  {
    id: 'track_torso',
    partId: 'torso',
    name: 'Torso Transform',
    color: '#ffb700',
    visible: true,
    locked: false,
    keyframes: [
      { id: 'kf_t1', frame: 0, transform: { ...DEFAULT_CHARACTER_PARTS[2].baseTransform }, easing: 'easeInOut' },
      { id: 'kf_t2', frame: 30, transform: { ...DEFAULT_CHARACTER_PARTS[2].baseTransform, y: 244 }, easing: 'easeInOut' },
      { id: 'kf_t3', frame: 60, transform: { ...DEFAULT_CHARACTER_PARTS[2].baseTransform }, easing: 'easeInOut' },
    ],
  },
  {
    id: 'track_arm_r',
    partId: 'upper_arm_r',
    name: 'Right Arm Wave',
    color: '#ff3366',
    visible: true,
    locked: false,
    keyframes: [
      { id: 'kf_ar1', frame: 0, transform: { ...DEFAULT_CHARACTER_PARTS[5].baseTransform }, easing: 'easeInOut' },
      { id: 'kf_ar2', frame: 20, transform: { ...DEFAULT_CHARACTER_PARTS[5].baseTransform, rotation: -130 }, easing: 'easeInOut' },
      { id: 'kf_ar3', frame: 40, transform: { ...DEFAULT_CHARACTER_PARTS[5].baseTransform, rotation: -90 }, easing: 'easeInOut' },
      { id: 'kf_ar4', frame: 60, transform: { ...DEFAULT_CHARACTER_PARTS[5].baseTransform }, easing: 'easeInOut' },
    ],
  },
  {
    id: 'track_leg_l',
    partId: 'upper_leg_l',
    name: 'Left Leg Stance',
    color: '#a855f7',
    visible: true,
    locked: false,
    keyframes: [
      { id: 'kf_ll1', frame: 0, transform: { ...DEFAULT_CHARACTER_PARTS[7].baseTransform }, easing: 'linear' },
      { id: 'kf_ll2', frame: 30, transform: { ...DEFAULT_CHARACTER_PARTS[7].baseTransform, rotation: 18 }, easing: 'linear' },
      { id: 'kf_ll3', frame: 60, transform: { ...DEFAULT_CHARACTER_PARTS[7].baseTransform }, easing: 'linear' },
    ],
  },
  {
    id: 'track_leg_r',
    partId: 'upper_leg_r',
    name: 'Right Leg Stance',
    color: '#10b981',
    visible: true,
    locked: false,
    keyframes: [
      { id: 'kf_rl1', frame: 0, transform: { ...DEFAULT_CHARACTER_PARTS[9].baseTransform }, easing: 'linear' },
      { id: 'kf_rl2', frame: 30, transform: { ...DEFAULT_CHARACTER_PARTS[9].baseTransform, rotation: -18 }, easing: 'linear' },
      { id: 'kf_rl3', frame: 60, transform: { ...DEFAULT_CHARACTER_PARTS[9].baseTransform }, easing: 'linear' },
    ],
  },
];

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

// Easing Utilities
export function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return t * (2 - t);
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
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
