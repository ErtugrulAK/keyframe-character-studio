import type { Transform } from '../../types/animator';

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

/**
 * Mirrors the keyframe values of ONE animated channel together.
 *
 * Mirroring each key on its own is right for a still value but wrong for an
 * animation through the origin: wrapping every angle into [-180, 180] changes
 * the distance between neighbouring keys, so 0° → 200° would play as
 * 180° → 20° (the other way round) and a full 0° → 360° turn would not turn
 * at all. Here every angle turns by 180° and the whole channel then moves by
 * one multiple of 360° so its FIRST key lands in [-180, 180] — the same tidy
 * range a still value gets, with every step between keys kept.
 */
export const mirrorChannelValues = (ch: string, values: readonly number[], axis: MirrorAxis): number[] => {
  if (axis !== 'origin' || !isAngleChannel(ch) || values.length === 0) {
    return values.map((value) => mirrorChannelValue(ch, value, axis));
  }
  const turned = values.map((value) => value + 180);
  const shift = mirrorChannelValue(ch, values[0], axis) - turned[0];
  return turned.map((value) => value + shift);
};
