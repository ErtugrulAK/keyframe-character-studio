import type { CustomMotionPreset } from '../types/animator';

export const DEFAULT_INITIAL_PRESETS: CustomMotionPreset[] = [
  {
    id: 'preset_1',
    name: 'Pink Slide Down (Top -> Center)',
    type: 'in',
    durationFrames: 50,
    keyframes: [
      { progress: 0, deltaX: 0, deltaY: -700, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, easing: 'easeInOut' },
      { progress: 1, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, easing: 'easeInOut' },
    ]
  },
  {
    id: 'preset_2',
    name: 'Blue Slide Right (Center -> Right)',
    type: 'out',
    durationFrames: 50,
    keyframes: [
      { progress: 0, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, easing: 'easeInOut' },
      { progress: 1, deltaX: 1400, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, easing: 'easeInOut' },
    ]
  }
];
