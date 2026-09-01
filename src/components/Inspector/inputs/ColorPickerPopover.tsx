import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SmartHexInput } from './SmartHexInput';
import {
  clampColorAlpha,
  clampColorChannel,
  hsvToRgb,
  parseHexColor,
  rgbToHsv,
  toHexColor,
} from '../../../utils/colorUtils';

interface ColorPickerPopoverProps {
  label: string;
  color: string;
  alpha: number;
  fallback: string;
  onColorChange: (color: string) => void;
  onAlphaChange: (alpha: number) => void;
}

type SliderName = 'hue' | 'alpha';

const readSliderValue = (event: React.PointerEvent<HTMLDivElement>): number => {
  const rect = event.currentTarget.getBoundingClientRect();
  return Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
};

/**
 * Shared inline RGBA editor. The historical export name remains for internal
 * compatibility; all appearance editing uses this single controlled surface.
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
  const hsv = useMemo(() => rgbToHsv(rgb), [rgb]);
  const normalizedColor = toHexColor(rgb);
  const [hueDisplay, setHueDisplay] = useState<number | null>(null);
  const activeSlider = useRef<SliderName | null>(null);
  const pendingHueUpdate = useRef<string | null>(null);
  const previousColor = useRef(normalizedColor);
  const displayHue = hueDisplay ?? hsv.hue;

  useEffect(() => {
    if (normalizedColor === previousColor.current) return;
    previousColor.current = normalizedColor;
    if (pendingHueUpdate.current === normalizedColor) {
      pendingHueUpdate.current = null;
      return;
    }
    pendingHueUpdate.current = null;
    setHueDisplay(null);
  }, [normalizedColor]);

  const updateHue = (hue: number) => {
    const nextHue = Math.max(0, Math.min(360, hue));
    const nextColor = toHexColor(hsvToRgb({ hue: nextHue, saturation: hsv.saturation, value: hsv.value }));
    pendingHueUpdate.current = nextColor;
    setHueDisplay(nextHue);
    onColorChange(nextColor);
  };

  const updateSlider = (slider: SliderName, value: number) => {
    if (slider === 'hue') updateHue(value * 360);
    else onAlphaChange(value);
  };

  const handlePointerDown = (slider: SliderName, event: React.PointerEvent<HTMLDivElement>) => {
    activeSlider.current = slider;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateSlider(slider, readSliderValue(event));
  };

  const handlePointerMove = (slider: SliderName, event: React.PointerEvent<HTMLDivElement>) => {
    if (activeSlider.current === slider) updateSlider(slider, readSliderValue(event));
  };

  const handlePointerUp = (slider: SliderName, event: React.PointerEvent<HTMLDivElement>) => {
    if (activeSlider.current === slider) {
      activeSlider.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  const handleSliderKeyDown = (slider: SliderName, event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = slider === 'hue' ? 1 / 36 : 0.01;
    const current = slider === 'hue' ? displayHue / 360 : clampColorAlpha(alpha);
    let next = current;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = current - step;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = current + step;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = 1;
    if (next !== current) {
      event.preventDefault();
      updateSlider(slider, Math.max(0, Math.min(1, next)));
    }
  };

  const updateChannel = (key: keyof typeof rgb, value: number) => {
    pendingHueUpdate.current = null;
    setHueDisplay(null);
    onColorChange(toHexColor({ ...rgb, [key]: clampColorChannel(value) }));
  };

  return (
    <div className="rgba-picker" aria-label={`${label} RGBA Controls`}>
      <div className="rgba-picker-header">
        <span>{label}</span>
        <span className="rgba-picker-value">RGBA</span>
      </div>
      <div className="rgba-picker-edit-row">
        <div
          className="rgba-picker-preview"
          aria-label={`${label} Color Preview`}
          title={`${normalizedColor} / ${Math.round(clampColorAlpha(alpha) * 100)}%`}
        >
          <span style={{ backgroundColor: normalizedColor, opacity: clampColorAlpha(alpha) }} />
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
          <label className="rgba-picker-channel">
            <span>A</span>
            <input type="number" min={0} max={255} step={1} value={Math.round(clampColorAlpha(alpha) * 255)} aria-label={`${label} A`} onChange={(event) => onAlphaChange(clampColorChannel(Number(event.target.value)) / 255)} />
          </label>
        </div>
      </div>
      <div
        className="rgba-picker-hue-slider"
        role="slider"
        aria-label={`${label} Hue`}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(displayHue)}
        tabIndex={0}
        onKeyDown={(event) => handleSliderKeyDown('hue', event)}
        onPointerDown={(event) => handlePointerDown('hue', event)}
        onPointerMove={(event) => handlePointerMove('hue', event)}
        onPointerUp={(event) => handlePointerUp('hue', event)}
      >
        <span className="rgba-picker-slider-indicator" style={{ left: `${(displayHue / 360) * 100}%` }} />
      </div>
      <div
        className="rgba-picker-alpha-slider"
        role="slider"
        aria-label={`${label} Alpha`}
        aria-valuemin={0}
        aria-valuemax={255}
        aria-valuenow={Math.round(clampColorAlpha(alpha) * 255)}
        tabIndex={0}
        onKeyDown={(event) => handleSliderKeyDown('alpha', event)}
        onPointerDown={(event) => handlePointerDown('alpha', event)}
        onPointerMove={(event) => handlePointerMove('alpha', event)}
        onPointerUp={(event) => handlePointerUp('alpha', event)}
      >
        <span className="rgba-picker-alpha-fill" style={{ width: `${clampColorAlpha(alpha) * 100}%`, backgroundColor: normalizedColor }} />
        <span className="rgba-picker-slider-indicator" style={{ left: `${clampColorAlpha(alpha) * 100}%` }} />
      </div>
      <label className="rgba-picker-hex">
        <span>HEX</span>
        <SmartHexInput value={normalizedColor} fallback={fallback} onChange={onColorChange} />
      </label>
    </div>
  );
};
