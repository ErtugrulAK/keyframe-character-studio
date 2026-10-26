import { describe, expect, it } from 'vitest';
import { parseCubicBezierText } from '../utils/cubicBezierText';

describe('C10 parseCubicBezierText — easing code pasted from elsewhere', () => {
  it('reads CSS, arrays, bare numbers and CSS keywords', () => {
    expect(parseCubicBezierText('cubic-bezier(0.25, 0.1, 0.25, 1)')).toEqual([0.25, 0.1, 0.25, 1]);
    expect(parseCubicBezierText('  cubic-bezier(.68,-0.55,.27,1.55);  ')).toEqual([0.68, -0.55, 0.27, 1.55]);
    expect(parseCubicBezierText('[0.4, 0, 0.2, 1]')).toEqual([0.4, 0, 0.2, 1]);
    expect(parseCubicBezierText('.42 0 .58 1')).toEqual([0.42, 0, 0.58, 1]);
    expect(parseCubicBezierText('ease-in-out')).toEqual([0.42, 0, 0.58, 1]);
    expect(parseCubicBezierText('LINEAR')).toEqual([0, 0, 1, 1]);
  });

  it('clamps Y to the editor range and refuses an X outside 0..1 or the wrong count', () => {
    expect(parseCubicBezierText('cubic-bezier(0.5, -3, 0.5, 4)')).toEqual([0.5, -1, 0.5, 2]);
    expect(parseCubicBezierText('cubic-bezier(1.2, 0, 0.5, 1)')).toBeNull();
    expect(parseCubicBezierText('cubic-bezier(0.5, 0, 0.5)')).toBeNull();
    expect(parseCubicBezierText('steps(4)')).toBeNull();
    expect(parseCubicBezierText('')).toBeNull();
  });
});
