import type { CustomMotionPresetKeyframe } from '../types/animator';

export const sampleCustomPreset = (keyframes: CustomMotionPresetKeyframe[], progress: number) => {
  if (!keyframes || keyframes.length === 0) return { deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
  if (progress <= 0) return keyframes[0];
  if (progress >= 1) return keyframes[keyframes.length - 1];

  let prev = keyframes[0];
  let next = keyframes[keyframes.length - 1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (progress >= keyframes[i].progress && progress <= keyframes[i + 1].progress) {
      prev = keyframes[i];
      next = keyframes[i + 1];
      break;
    }
  }

  const range = next.progress - prev.progress;
  const p = range > 0 ? (progress - prev.progress) / range : 1;

  return {
    deltaX: prev.deltaX + (next.deltaX - prev.deltaX) * p,
    deltaY: prev.deltaY + (next.deltaY - prev.deltaY) * p,
    rotation: prev.rotation + (next.rotation - prev.rotation) * p,
    scaleX: prev.scaleX + (next.scaleX - prev.scaleX) * p,
    scaleY: prev.scaleY + (next.scaleY - prev.scaleY) * p,
    opacity: prev.opacity + (next.opacity - prev.opacity) * p,
  };
};
