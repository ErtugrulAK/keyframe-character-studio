import React, { useMemo } from 'react';
import { SmartHexInput } from './SmartHexInput';

interface ColorPickerPopoverProps {
  label: string;
  color: string;
  alpha: number;
  fallback: string;
  onColorChange: (color: string) => void;
  onAlphaChange: (alpha: number) => void;
}

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

const clampChannel = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
const clampAlpha = (value: number): number => Math.max(0, Math.min(1, value));

const parseHexColor = (value: string, fallback: string): RgbColor => {
  const normalized = (value || fallback).replace('#', '');
  const expanded = normalized.length === 3 ? normalized.split('').map((channel) => `${channel}${channel}`).join('') : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return parseHexColor(fallback, '#000000');
  return {
    red: parseInt(expanded.slice(0, 2), 16),
    green: parseInt(expanded.slice(2, 4), 16),
    blue: parseInt(expanded.slice(4, 6), 16),
  };
};

const toHexColor = ({ red, green, blue }: RgbColor): string => (
  `#${[red, green, blue].map((channel) => clampChannel(channel).toString(16).padStart(2, '0')).join('')}`
);

/**
 * Inline RGBA editor shared by modern appearance and legacy color sections.
 * The export name is retained for compatibility with existing internal imports.
 */
export const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({
  label,
  color,
  alpha,
  fallback,
  onColorChange,
  onAlphaChange,
}) => {
  const rgb = useMemo(() => parseHexColor(color, fallback), [color, fallback]);
  const normalizedColor = toHexColor(rgb);

  const updateChannel = (key: keyof RgbColor, value: number) => {
    onColorChange(toHexColor({ ...rgb, [key]: clampChannel(value) }));
  };

  return (
    <div className="rgba-picker" aria-label={`${label} RGBA Controls`}>
      <div className="rgba-picker-header">
        <span>{label}</span>
        <span className="rgba-picker-value">RGBA</span>
      </div>
      <div className="rgba-picker-preview" aria-label={`${label} Alpha Preview`}>
        <span style={{ backgroundColor: normalizedColor, opacity: clampAlpha(alpha) }} />
      </div>
      <div className="rgba-picker-channel-grid">
        {([
          ['red', 'R', rgb.red],
          ['green', 'G', rgb.green],
          ['blue', 'B', rgb.blue],
        ] as const).map(([key, channelLabel, value]) => (
          <label key={key} className="rgba-picker-channel">
            <span>{channelLabel}</span>
            <input type="number" min={0} max={255} value={value} aria-label={`${label} ${channelLabel}`} onChange={(event) => updateChannel(key, Number(event.target.value))} />
          </label>
        ))}
      </div>
      <div className="rgba-picker-alpha">
        <div className="rgba-picker-alpha-label"><span>Alpha</span><strong>{Math.round(clampAlpha(alpha) * 100)}%</strong></div>
        <input type="range" min={0} max={100} step={1} value={Math.round(clampAlpha(alpha) * 100)} aria-label={`${label} Alpha`} onChange={(event) => onAlphaChange(Number(event.target.value) / 100)} />
      </div>
      <label className="rgba-picker-hex">
        <span>HEX</span>
        <SmartHexInput value={normalizedColor} fallback={fallback} onChange={onColorChange} />
      </label>
    </div>
  );
};
