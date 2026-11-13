import { describe, expect, it } from 'vitest';
import { parseCubicBezierText } from '../utils/animation/cubicBezierText';

describe('parseCubicBezierText', () => {
  it('reads CSS, array and bare forms', () => {
    expect(parseCubicBezierText('cubic-bezier(0.25, 0.1, 0.25, 1)')).toEqual([0.25, 0.1, 0.25, 1]);
    expect(parseCubicBezierText('[0.4, 0, 0.2, 1]')).toEqual([0.4, 0, 0.2, 1]);
    expect(parseCubicBezierText('.25 .1 .25 1')).toEqual([0.25, 0.1, 0.25, 1]);
    expect(parseCubicBezierText('  cubic-bezier(0.1,0.2,0.3,0.4);  ')).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it('maps the CSS keywords to their defined curves', () => {
    expect(parseCubicBezierText('linear')).toEqual([0, 0, 1, 1]);
    expect(parseCubicBezierText('EASE-IN-OUT')).toEqual([0.42, 0, 0.58, 1]);
  });

  it('returns a fresh array for a keyword', () => {
    const first = parseCubicBezierText('ease')!;
    first[0] = 9;
    expect(parseCubicBezierText('ease')).toEqual([0.25, 0.1, 0.25, 1]);
  });

  it('clamps Y into -1..2 and refuses X outside 0..1', () => {
    expect(parseCubicBezierText('0.5, -3, 0.5, 5')).toEqual([0.5, -1, 0.5, 2]);
    expect(parseCubicBezierText('1.2, 0, 0.5, 1')).toBeNull();
    expect(parseCubicBezierText('0.5, 0, -0.1, 1')).toBeNull();
  });

  it('refuses the wrong count or non-numbers', () => {
    expect(parseCubicBezierText('0.1, 0.2, 0.3')).toBeNull();
    expect(parseCubicBezierText('a, b, c, d')).toBeNull();
    expect(parseCubicBezierText('')).toBeNull();
  });
});
