import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SmartHexInput } from './SmartHexInput';

interface ColorPickerPopoverProps {
  label: string;
  color: string;
  alpha: number;
  fallback: string;
  onColorChange: (color: string) => void;
  onAlphaChange: (alpha: number) => void;
  pickerId?: string;
  activePickerId?: string | null;
  onActivePickerChange?: (pickerId: string | null) => void;
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

export const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({
  label,
  color,
  alpha,
  fallback,
  onColorChange,
  onAlphaChange,
  pickerId = label,
  activePickerId,
  onActivePickerChange,
}) => {
  const [localOpen, setLocalOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isControlled = activePickerId !== undefined && onActivePickerChange !== undefined;
  const isOpen = isControlled ? activePickerId === pickerId : localOpen;
  const rgb = useMemo(() => parseHexColor(color, fallback), [color, fallback]);
  const normalizedColor = toHexColor(rgb);

  const setOpen = (open: boolean) => {
    if (isControlled) onActivePickerChange?.(open ? pickerId : null);
    else setLocalOpen(open);
  };

  const reposition = () => {
    const trigger = triggerRef.current?.getBoundingClientRect();
    if (!trigger) return;
    const surfaceWidth = 280;
    const surfaceHeight = popoverRef.current?.getBoundingClientRect().height ?? 320;
    const gap = 6;
    const left = Math.max(8, Math.min(trigger.right - surfaceWidth, window.innerWidth - surfaceWidth - 8));
    const above = trigger.top - surfaceHeight - gap;
    const below = trigger.bottom + gap;
    const top = above >= 8
      ? above
      : below + surfaceHeight <= window.innerHeight - 8
        ? below
        : Math.max(8, window.innerHeight - surfaceHeight - 8);
    setPopoverPosition({ top, left });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    reposition();
    const handleViewportChange = () => reposition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen, color, alpha]);

  useEffect(() => {
    if (!isOpen) return;
    const close = () => {
      if (isControlled) onActivePickerChange?.(null);
      else setLocalOpen(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isControlled, onActivePickerChange]);

  const updateChannel = (key: keyof RgbColor, value: number) => {
    onColorChange(toHexColor({ ...rgb, [key]: clampChannel(value) }));
  };

  return (
    <div className="rgba-picker" ref={pickerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="rgba-picker-trigger"
        aria-label={`${label} Color Picker`}
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
      >
        <span className="rgba-picker-swatch" style={{ backgroundColor: normalizedColor, opacity: clampAlpha(alpha) }} />
        <span className="rgba-picker-trigger-value">{normalizedColor.toUpperCase()}</span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="rgba-picker-popover"
          role="dialog"
          aria-label={`${label} RGBA Picker`}
          style={{ top: popoverPosition.top, left: popoverPosition.left }}
        >
          <div className="rgba-picker-header"><span>{label}</span><span className="rgba-picker-value">RGBA</span></div>
          <div className="rgba-picker-preview" aria-label={`${label} Alpha Preview`}>
            <span style={{ backgroundColor: normalizedColor, opacity: clampAlpha(alpha) }} />
          </div>
          <label className="rgba-picker-visual-control">
            <span>Color</span>
            <input type="color" className="rgba-picker-native-input" aria-label={`${label} Native Color`} value={normalizedColor} onChange={(event) => onColorChange(event.target.value)} />
          </label>
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
          <SmartHexInput value={normalizedColor} fallback={fallback} onChange={onColorChange} />
        </div>
      )}
    </div>
  );
};
