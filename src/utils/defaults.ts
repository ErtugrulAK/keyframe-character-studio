import type { CharacterPart, Track, Transform, EasingType, TrackChannel, PropertyKeyframe, PathKeyframe, BezierPath } from '../types/animator';
import { interpolateBezierPath, legacyMaskPointsToPath, pathToLegacyMaskPoints } from './bezierPath';

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

/** Create an empty channels record with no keyframes for any property */
export function makeEmptyChannels(): Record<TrackChannel, PropertyKeyframe[]> {
  return {
    x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
    maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
    trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
  };
}

/** Derive monotonic temporal controls from neighboring values. */
export function deriveAutoBezierControlPoints(
  previous: PropertyKeyframe,
  next: PropertyKeyframe,
  previousPrevious?: PropertyKeyframe,
  nextNext?: PropertyKeyframe,
): [number, number, number, number] {
  const duration = Math.max(1, next.frame - previous.frame);
  const delta = next.value - previous.value;
  if (Math.abs(delta) < 1e-8) return [1 / 3, 0, 2 / 3, 1];
  const previousSlope = previousPrevious
    ? (next.value - previousPrevious.value) / Math.max(1, next.frame - previousPrevious.frame)
    : delta / duration;
  const nextSlope = nextNext
    ? (nextNext.value - previous.value) / Math.max(1, nextNext.frame - previous.frame)
    : delta / duration;
  const normalizedPreviousSlope = (previousSlope * duration) / delta;
  const normalizedNextSlope = (nextSlope * duration) / delta;
  return [
    1 / 3,
    Math.max(0, Math.min(1, normalizedPreviousSlope / 3)),
    2 / 3,
    Math.max(0, Math.min(1, 1 - normalizedNextSlope / 3)),
  ];
}

/** Interpolate a single numeric channel at a given frame */
export function interpolateChannel(
  keyframes: PropertyKeyframe[],
  frame: number,
  fallback: number
): number {
  if (!keyframes || keyframes.length === 0) return fallback;
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  const exact = sorted.find((k) => k.frame === frame);
  if (exact) return exact.value;
  if (frame <= sorted[0].frame) return sorted[0].value;
  if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].value;
  let prev = sorted[0];
  let next = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (frame >= sorted[i].frame && frame <= sorted[i + 1].frame) {
      prev = sorted[i];
      next = sorted[i + 1];
      break;
    }
  }
  const duration = next.frame - prev.frame;
  if (duration <= 0) return prev.value;
  const progress = (frame - prev.frame) / duration;
  const previousPrevious = sorted[sorted.indexOf(prev) - 1];
  const nextNext = sorted[sorted.indexOf(next) + 1];
  const autoBezier = prev.easing === 'autoBezier'
    ? deriveAutoBezierControlPoints(prev, next, previousPrevious, nextNext)
    : undefined;
  const eased = applyEasing(
    progress,
    prev.easing,
    prev.bezierControlPoints ?? autoBezier,
    prev.bezierOut && next.bezierIn ? { out: prev.bezierOut, in: next.bezierIn } : undefined,
  );
  return lerp(prev.value, next.value, eased);
}

/** Interpolate a canonical animated path without guessing vertex correspondence. */
export function interpolatePathChannel(
  keyframes: PathKeyframe[],
  frame: number,
  fallback: BezierPath,
): BezierPath {
  if (!keyframes || keyframes.length === 0) return fallback;
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  const exact = sorted.find((keyframe) => keyframe.frame === frame);
  if (exact) return exact.value;
  if (frame <= sorted[0].frame) return sorted[0].value;
  if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].value;
  let previous = sorted[0];
  let next = sorted[sorted.length - 1];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    if (frame >= sorted[index].frame && frame <= sorted[index + 1].frame) {
      previous = sorted[index];
      next = sorted[index + 1];
      break;
    }
  }
  const duration = next.frame - previous.frame;
  if (duration <= 0) return previous.value;
  const progress = (frame - previous.frame) / duration;
  const eased = applyEasing(
    progress,
    previous.easing,
    previous.bezierControlPoints,
    previous.bezierOut && next.bezierIn ? { out: previous.bezierOut, in: next.bezierIn } : undefined,
  );
  return interpolateBezierPath(previous.value, next.value, eased) ?? previous.value;
}

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
  controlPoints?: [number, number, number, number],
  temporalHandles?: { in: { x: number; y: number }; out: { x: number; y: number } },
): number {
  const progress = Math.max(0, Math.min(1, t));
  if (easing === 'hold') return 0;
  if (temporalHandles) {
    return solveCubicBezier(
      temporalHandles.out.x,
      temporalHandles.out.y,
      temporalHandles.in.x,
      temporalHandles.in.y,
      progress,
    );
  }
  if (controlPoints) {
    return solveCubicBezier(controlPoints[0], controlPoints[1], controlPoints[2], controlPoints[3], progress);
  }

  switch (easing) {
    case 'cubic_bezier':
    case 'bezier':
      return solveCubicBezier(0.42, 0, 0.58, 1, progress);
    case 'autoBezier':
      return solveCubicBezier(0.42, 0, 0.58, 1, progress);
    case 'easeIn':
      return solveCubicBezier(0.42, 0, 1, 1, progress);
    case 'easeOut':
      return solveCubicBezier(0, 0, 0.58, 1, progress);
    case 'easeInOut':
      return solveCubicBezier(0.42, 0, 0.58, 1, progress);
    case 'bounce': {
      const n1 = 7.5625;
      const d1 = 2.75;
      let x = progress;
      if (x < 1 / d1) return n1 * x * x;
      if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
      if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }
    case 'elastic': {
      const c4 = (2 * Math.PI) / 3;
      return progress === 0 ? 0 : progress === 1 ? 1 : -Math.pow(2, 10 * progress - 10) * Math.sin((progress * 10 - 10.75) * c4);
    }
    case 'anticipate':
      return solveCubicBezier(0.6, -0.28, 0.735, 0.045, progress);
    case 'overshoot':
      return solveCubicBezier(0.175, 0.885, 0.32, 1.275, progress);
    case 'linear':
    default:
      return progress;
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
  const result: Transform = {
    x: lerp(t1.x, t2.x, eased),
    y: lerp(t1.y, t2.y, eased),
    rotation: lerp(t1.rotation, t2.rotation, eased),
    scaleX: lerp(t1.scaleX, t2.scaleX, eased),
    scaleY: lerp(t1.scaleY, t2.scaleY, eased),
    opacity: lerp(t1.opacity, t2.opacity, eased),
    maskOffsetX: lerp(t1.maskOffsetX ?? 0, t2.maskOffsetX ?? 0, eased),
    maskOffsetY: lerp(t1.maskOffsetY ?? 0, t2.maskOffsetY ?? 0, eased),
    maskScale: lerp(t1.maskScale ?? 1, t2.maskScale ?? 1, eased),
    maskRotation: lerp(t1.maskRotation ?? 0, t2.maskRotation ?? 0, eased),
  };

  if (t1.mask && t2.mask) {
    const path = interpolateBezierPath(
      t1.mask.path ?? legacyMaskPointsToPath(t1.mask.points, t1.mask.closed),
      t2.mask.path ?? legacyMaskPointsToPath(t2.mask.points, t2.mask.closed),
      eased,
    );
    const points = pathToLegacyMaskPoints(path) ?? t1.mask.points;
    result.mask = {
      ...t1.mask,
      feather: lerp(t1.mask.feather, t2.mask.feather, eased),
      opacity: lerp(t1.mask.opacity, t2.mask.opacity, eased),
      closed: path?.closed ?? t1.mask.closed,
      points,
      ...(path ? { path } : {}),
    };
  } else if (t1.mask) {
    result.mask = { ...t1.mask };
  } else if (t2.mask) {
    result.mask = { ...t2.mask };
  }

  return result;
}
