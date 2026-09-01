export interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

export interface HsvColor {
  hue: number;
  saturation: number;
  value: number;
}

export const clampColorChannel = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
export const clampColorAlpha = (value: number): number => Math.max(0, Math.min(1, value));

export const parseHexColor = (value: string, fallback: string): RgbColor => {
  const normalized = (value || fallback).replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((channel) => `${channel}${channel}`).join('')
    : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return parseHexColor(fallback, '#000000');
  return {
    red: parseInt(expanded.slice(0, 2), 16),
    green: parseInt(expanded.slice(2, 4), 16),
    blue: parseInt(expanded.slice(4, 6), 16),
  };
};

export const toHexColor = ({ red, green, blue }: RgbColor): string => (
  `#${[red, green, blue].map((channel) => clampColorChannel(channel).toString(16).padStart(2, '0')).join('')}`
);

export const rgbToHsv = ({ red, green, blue }: RgbColor): HsvColor => {
  const r = clampColorChannel(red) / 255;
  const g = clampColorChannel(green) / 255;
  const b = clampColorChannel(blue) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;

  if (delta > 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }

  return {
    hue: (hue + 360) % 360,
    saturation: max === 0 ? 0 : delta / max,
    value: max,
  };
};

export const hsvToRgb = ({ hue, saturation, value }: HsvColor): RgbColor => {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const normalizedSaturation = Math.max(0, Math.min(1, saturation));
  const normalizedValue = Math.max(0, Math.min(1, value));
  const chroma = normalizedValue * normalizedSaturation;
  const segment = normalizedHue / 60;
  const second = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = normalizedValue - chroma;
  const [r, g, b] = segment < 1
    ? [chroma, second, 0]
    : segment < 2
      ? [second, chroma, 0]
      : segment < 3
        ? [0, chroma, second]
        : segment < 4
          ? [0, second, chroma]
          : segment < 5
            ? [second, 0, chroma]
            : [chroma, 0, second];

  return {
    red: (r + match) * 255,
    green: (g + match) * 255,
    blue: (b + match) * 255,
  };
};
