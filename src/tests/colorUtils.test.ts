import { describe, expect, it } from 'vitest';
import { hsvToRgb, parseHexColor, rgbToHsv, toHexColor } from '../utils/colorUtils';

describe('color utilities', () => {
  it.each([
    ['#000000', { red: 0, green: 0, blue: 0 }],
    ['#ffffff', { red: 255, green: 255, blue: 255 }],
    ['#ff0000', { red: 255, green: 0, blue: 0 }],
    ['#00ff00', { red: 0, green: 255, blue: 0 }],
    ['#0000ff', { red: 0, green: 0, blue: 255 }],
  ] as const)('round-trips %s', (hex, expected) => {
    const rgb = parseHexColor(hex, '#123456');
    expect(rgb).toEqual(expected);
    expect(toHexColor(rgb)).toBe(hex);
  });

  it('preserves saturation and value when changing hue', () => {
    const source = parseHexColor('#cc3366', '#000000');
    const hsv = rgbToHsv(source);
    expect(toHexColor(hsvToRgb({ ...hsv, hue: 180 }))).toBe('#33cccc');
  });

  it('falls back safely for malformed and shorthand values', () => {
    expect(parseHexColor('#abc', '#000000')).toEqual({ red: 170, green: 187, blue: 204 });
    expect(parseHexColor('invalid', '#123456')).toEqual({ red: 18, green: 52, blue: 86 });
  });
});
