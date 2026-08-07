import { describe, it, expect } from 'vitest';
import { mirrorTransform, mirrorChannelValue } from '../utils/mirror';
import type { Transform } from '../types/animator';

const base: Transform = { x: 30, y: -40, rotation: 25, scaleX: 1.2, scaleY: 0.8, opacity: 1 };

describe('mirrorTransform', () => {
  it('mirrors across the Y axis (horizontal flip)', () => {
    const m = mirrorTransform(base, 'y');
    expect(m.x).toBe(-30);
    expect(m.y).toBe(-40);
    expect(m.rotation).toBe(-25);
    expect(m.scaleX).toBe(-1.2);
    expect(m.scaleY).toBe(0.8);
  });

  it('mirrors across the X axis (vertical flip)', () => {
    const m = mirrorTransform(base, 'x');
    expect(m.x).toBe(30);
    expect(m.y).toBe(40);
    expect(m.rotation).toBe(-25);
    expect(m.scaleX).toBe(1.2);
    expect(m.scaleY).toBe(-0.8);
  });

  it('mirrors through the origin (180° point reflection, orientation preserved)', () => {
    const m = mirrorTransform(base, 'origin');
    expect(m.x).toBe(-30);
    expect(m.y).toBe(40);
    expect(m.scaleX).toBe(1.2);
    expect(m.scaleY).toBe(0.8);
    expect(m.rotation).toBe(-155); // 25 + 180 = 205 -> normalized to -155
  });

  it('normalizes origin-mirrored rotation into [-180, 180]', () => {
    expect(mirrorTransform({ ...base, rotation: 0 }, 'origin').rotation).toBe(180);
    expect(mirrorTransform({ ...base, rotation: 45 }, 'origin').rotation).toBe(-135);
    expect(mirrorTransform({ ...base, rotation: 170 }, 'origin').rotation).toBe(-10);
    expect(mirrorTransform({ ...base, rotation: 200 }, 'origin').rotation).toBe(20);
    expect(mirrorTransform({ ...base, rotation: -100 }, 'origin').rotation).toBe(80);
  });

  it('double mirroring restores the original transform', () => {
    expect(mirrorTransform(mirrorTransform(base, 'y'), 'y')).toEqual(base);
    expect(mirrorTransform(mirrorTransform(base, 'x'), 'x')).toEqual(base);
    expect(mirrorTransform(mirrorTransform(base, 'origin'), 'origin')).toEqual(base);
  });
});

describe('mirrorChannelValue', () => {
  it('negates the mirrored channels per axis', () => {
    expect(mirrorChannelValue('x', 50, 'y')).toBe(-50);
    expect(mirrorChannelValue('rotation', 30, 'y')).toBe(-30);
    expect(mirrorChannelValue('scaleX', 2, 'y')).toBe(-2);
    expect(mirrorChannelValue('y', 50, 'y')).toBe(50); // untouched

    expect(mirrorChannelValue('y', 50, 'x')).toBe(-50);
    expect(mirrorChannelValue('scaleY', 2, 'x')).toBe(-2);
    expect(mirrorChannelValue('x', 50, 'x')).toBe(50);

    expect(mirrorChannelValue('x', 50, 'origin')).toBe(-50);
    expect(mirrorChannelValue('y', 50, 'origin')).toBe(-50);
  });

  it('adds 180° to angle channels for origin mirrors', () => {
    expect(mirrorChannelValue('rotation', 0, 'origin')).toBe(180);
    expect(mirrorChannelValue('rotation', 170, 'origin')).toBe(-10);
    expect(mirrorChannelValue('maskRotation', 45, 'origin')).toBe(-135);
  });
});
