import { describe, expect, it } from 'vitest';
import { hsvToRgb, parseHexColor, rgbToHsv, toHexColor } from '../utils/layers/colorUtils';

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

  it('treats hue 360 as hue 0 and clamps out-of-range saturation and value', () => {
    expect(hsvToRgb({ hue: 360, saturation: 1, value: 1 })).toEqual(hsvToRgb({ hue: 0, saturation: 1, value: 1 }));
    expect(hsvToRgb({ hue: 0, saturation: 2, value: 2 })).toEqual({ red: 255, green: 0, blue: 0 });
    expect(hsvToRgb({ hue: 0, saturation: -1, value: -1 })).toEqual({ red: 0, green: 0, blue: 0 });
  });

  it('reports zero saturation for greys so the SV area never invents a hue', () => {
    expect(rgbToHsv(parseHexColor('#808080', '#000000'))).toEqual({ hue: 0, saturation: 0, value: 128 / 255 });
  });

  it('round-trips the SV area within the 8-bit quantization the hex storage allows', () => {
    const corners = [
      { hue: 0, saturation: 0, value: 0 },
      { hue: 210, saturation: 1, value: 1 },
      { hue: 210, saturation: 1, value: 0.5 },
      { hue: 210, saturation: 0, value: 1 },
    ];
    for (const hsv of corners) {
      const roundTrip = rgbToHsv(parseHexColor(toHexColor(hsvToRgb(hsv)), '#000000'));
      // 1/255 of a channel is the only slack the hex storage contract leaves; the
      // picker therefore keeps its own draft while a gesture is in flight.
      expect(roundTrip.hue).toBeCloseTo(hsv.saturation === 0 ? 0 : hsv.hue, 0);
      expect(roundTrip.saturation).toBeCloseTo(hsv.saturation, 2);
      expect(roundTrip.value).toBeCloseTo(hsv.value, 2);
    }
  });
});
