import type { Transform, Keyframe, EasingType } from '../types/animator';
import { generateId } from './idGenerator';
import { buildTransformSnapshot, type SnapshotTransform } from './channelKeyframeGroups';

export const generateTransitionKeyframes = (
  baseTransform: Transform,
  transitionType: string,
  startFrame: number,
  endFrame: number
): { kfStart: Keyframe; kfEnd: Keyframe } | null => {
  if (transitionType === 'none') {
    return null;
  }

  let startTransform: Transform = { ...baseTransform };
  let endTransform: Transform = { ...baseTransform };
  let easing: EasingType = 'easeOut';

  switch (transitionType) {
    case 'move_left':
      startTransform.x = baseTransform.x + 250;
      startTransform.opacity = 0;
      endTransform.opacity = 1;
      break;
    case 'move_right':
      startTransform.x = baseTransform.x - 250;
      startTransform.opacity = 0;
      endTransform.opacity = 1;
      break;
    case 'move_down':
      startTransform.y = baseTransform.y - 200;
      startTransform.opacity = 0;
      endTransform.opacity = 1;
      break;
    case 'move_up':
      startTransform.y = baseTransform.y + 200;
      startTransform.opacity = 0;
      endTransform.opacity = 1;
      break;
    case 'fade':
      startTransform.opacity = 0;
      endTransform.opacity = 1;
      break;
    case 'flash':
      startTransform.scaleX = 0.1;
      startTransform.scaleY = 0.1;
      startTransform.opacity = 0;
      endTransform.opacity = 1;
      easing = 'overshoot';
      break;
    case 'spin':
      startTransform.rotation = baseTransform.rotation - 360;
      startTransform.opacity = 0;
      endTransform.opacity = 1;
      break;
    case 'bounce':
      startTransform.y = baseTransform.y - 180;
      startTransform.opacity = 0;
      endTransform.opacity = 1;
      easing = 'bounce';
      break;
  }

  const kfStart: Keyframe = {
    id: generateId('kf'),
    frame: startFrame,
    transform: startTransform,
    easing,
  };

  const kfEnd: Keyframe = {
    id: generateId('kf'),
    frame: endFrame,
    transform: endTransform,
    easing: 'linear',
  };

  return { kfStart, kfEnd };
};

// ─── M8a: canonical channels transition ─────────────────────────────────

export interface TransitionChannelResult {
  start: SnapshotTransform;
  end: SnapshotTransform;
  easing: EasingType;
  startFrame: number;
  endFrame: number;
}

/**
 * M8a: same transition semantics as generateTransitionKeyframes, but exposed
 * as the 6 canonical channel start/end values so applyMotionTransition can
 * write channels instead of legacy keyframes[]. Reuses the legacy generator
 * (single source of truth for transition math); null = 'none' (clear).
 */
export const generateTransitionChannelKeyframes = (
  baseTransform: Transform,
  transitionType: string,
  startFrame: number,
  endFrame: number
): TransitionChannelResult | null => {
  const result = generateTransitionKeyframes(baseTransform, transitionType, startFrame, endFrame);
  if (!result) return null;
  return {
    start: buildTransformSnapshot(result.kfStart.transform),
    end: buildTransformSnapshot(result.kfEnd.transform),
    easing: result.kfStart.easing,
    startFrame,
    endFrame,
  };
};
