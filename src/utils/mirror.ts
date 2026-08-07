import type { Transform } from '../types/animator';

export type MirrorAxis = 'y' | 'x' | 'origin';

/**
 * Mirror a transform across the Y axis, X axis, or the origin (point
 * reflection). Mirrors negate the corresponding position/scale components and
 * flip the rotation sign (or add 180° for origin reflection, which preserves
 * orientation). Applied to a duplicated part this produces a true mirror copy.
 */
export const mirrorTransform = (t: Transform, axis: MirrorAxis): Transform => {
  const m: Transform = { ...t };
  if (axis === 'y') {
    // Across the vertical axis (x=0): horizontal flip
    m.x = -t.x;
    m.rotation = -t.rotation;
    m.scaleX = -t.scaleX;
  } else if (axis === 'x') {
    // Across the horizontal axis (y=0): vertical flip
    m.y = -t.y;
    m.rotation = -t.rotation;
    m.scaleY = -t.scaleY;
  } else {
    // Point reflection through the origin: rotate 180°, no scale flip
    m.x = -t.x;
    m.y = -t.y;
    const r = ((t.rotation + 180) % 360 + 360) % 360; // [0, 360)
    m.rotation = r > 180 ? r - 360 : r; // normalize to [-180, 180]
  }
  return m;
};

const needsValueNegation = (ch: string, axis: MirrorAxis): boolean => {
  if (axis === 'y') {
    return ch === 'x' || ch === 'rotation' || ch === 'scaleX' || ch === 'maskOffsetX' || ch === 'maskRotation';
  }
  if (axis === 'x') {
    return ch === 'y' || ch === 'rotation' || ch === 'scaleY' || ch === 'maskOffsetY' || ch === 'maskRotation';
  }
  return ch === 'x' || ch === 'y' || ch === 'maskOffsetX' || ch === 'maskOffsetY';
};

const isAngleChannel = (ch: string): boolean => ch === 'rotation' || ch === 'maskRotation';

/**
 * Mirror a single channel keyframe value (for animatable property channels).
 * Angle channels get their sign flipped (or +180° normalized for origin), all
 * other mirrored channels get negated.
 */
export const mirrorChannelValue = (ch: string, value: number, axis: MirrorAxis): number => {
  if (axis === 'origin' && isAngleChannel(ch)) {
    const r = ((value + 180) % 360 + 360) % 360; // [0, 360)
    return r > 180 ? r - 360 : r; // normalize to [-180, 180]
  }
  if (needsValueNegation(ch, axis)) {
    return -value;
  }
  return value;
};
