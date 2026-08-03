import type { CharacterPart, Track, Transform, EasingType, TrackChannel, PropertyKeyframe } from '../types/animator';

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
  };
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
  const progress = (frame - prev.frame) / duration;
  const eased = applyEasing(progress, prev.easing, prev.bezierControlPoints);
  return lerp(prev.value, next.value, eased);
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
    result.mask = {
      ...t1.mask,
      feather: lerp(t1.mask.feather, t2.mask.feather, eased),
      opacity: lerp(t1.mask.opacity, t2.mask.opacity, eased),
      points: t1.mask.points.map((p1, i) => {
        const p2 = t2.mask!.points[i];
        if (!p2) return p1;
        const np: any = {
          x: lerp(p1.x, p2.x, eased),
          y: lerp(p1.y, p2.y, eased),
        };
        if (p1.handleIn && p2.handleIn) {
          np.handleIn = {
            x: lerp(p1.handleIn.x, p2.handleIn.x, eased),
            y: lerp(p1.handleIn.y, p2.handleIn.y, eased),
          };
        }
        if (p1.handleOut && p2.handleOut) {
          np.handleOut = {
            x: lerp(p1.handleOut.x, p2.handleOut.x, eased),
            y: lerp(p1.handleOut.y, p2.handleOut.y, eased),
          };
        }
        return np;
      })
    };
  } else if (t1.mask) {
    result.mask = { ...t1.mask };
  } else if (t2.mask) {
    result.mask = { ...t2.mask };
  }

  return result;
}
