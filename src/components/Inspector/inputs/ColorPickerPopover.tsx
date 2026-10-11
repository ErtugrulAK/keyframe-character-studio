import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SmartHexInput } from './SmartHexInput';
import { useFloatingPanel } from '../../../hooks/useFloatingPanel';
import {
  clampColorAlpha,
  clampColorChannel,
  hsvToRgb,
  parseHexColor,
  rgbToHsv,
  toHexColor,
  type HsvColor,
} from '../../../utils/colorUtils';

interface ColorPickerPopoverProps {
  label: string;
  color: string;
  /** Alpha in 0..1; omit (with `onAlphaChange`) for paints that carry no alpha. */
  alpha?: number;
  fallback: string;
  onColorChange: (color: string) => void;
  onAlphaChange?: (alpha: number) => void;
  /** Wraps one pointer gesture into one undo entry through the existing history authority. */
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  /**
   * Where the popover prefers to open. The Inspector swatches sit on the right
   * edge, so they keep the default (beside them, over the canvas); a swatch in
   * the top authoring toolbar opens below itself instead. Both still clamp
   * inside the viewport.
   */
  panelSide?: 'below' | 'left';
  panelAlign?: 'start' | 'end';
}

type SliderName = 'hue' | 'alpha';

/** Controls that take focus from the click itself, so a dismissal must not reclaim it. */
const FOCUS_CLAIMING_SELECTOR = 'button, a[href], input, select, textarea, [tabindex]';

const readSliderValue = (event: React.PointerEvent<HTMLDivElement>): number => {
  const rect = event.currentTarget.getBoundingClientRect();
  return Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
};

const readSaturationValue = (event: React.PointerEvent<HTMLDivElement>): { saturation: number; value: number } => {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    saturation: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1))),
    value: 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1))),
  };
};

/**
 * The single Fill/Stroke paint editor: a swatch that opens one compact popover
 * with a 2D saturation/value area, a hue slider, an alpha slider and the
 * established RGBA + hex fields.
 *
 * The component owns display state only. Every authored value travels through
 * the caller's existing color/alpha authorities, and opening the popover writes
 * nothing to the project.
 */
export const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({
  label,
  color,
  alpha,
  fallback,
  onColorChange,
  onAlphaChange,
  onInteractionStart,
  onInteractionEnd,
  panelSide = 'left',
  panelAlign = 'end',
}) => {
  const rgb = useMemo(() => parseHexColor(color, fallback), [color, fallback]);
  const hsv = useMemo(() => rgbToHsv(rgb), [rgb]);
  const normalizedColor = toHexColor(rgb);
  const hasAlpha = typeof onAlphaChange === 'function';
  const normalizedAlpha = clampColorAlpha(alpha ?? 1);

  const [isOpen, setIsOpen] = useState(false);
  const [hsvDraft, setHsvDraft] = useState<HsvColor | null>(null);
  const swatchRef = useRef<HTMLButtonElement | null>(null);
  const svAreaRef = useRef<HTMLDivElement | null>(null);
  const activeSlider = useRef<SliderName | null>(null);
  const isSvDragging = useRef(false);
  const openStateRef = useRef(false);
  /** Set when the swatch opens the panel, so focus lands in it exactly once. */
  const focusPendingRef = useRef(false);
  /**
   * The last color this picker emitted. While it matches the incoming prop the
   * draft HSV survives, so dragging keeps its own hue/saturation/value even when
   * 8-bit rounding makes two positions collapse onto the same hex (hue 360° ->
   * 0°, or any hue at zero brightness).
   */
  const lastEmittedRef = useRef(normalizedColor);
  // Intentional latest-value mirror: the dismissal callback stays stable while
  // still seeing the live open state.
  // oxlint-disable-next-line react/refs
  openStateRef.current = isOpen;

  useEffect(() => {
    if (normalizedColor === lastEmittedRef.current) return;
    // An external change (undo, another control, selection switch) retires the draft.
    // oxlint-disable-next-line react/set-state-in-effect
    setHsvDraft(null);
  }, [normalizedColor]);

  const closePicker = useCallback((restoreFocus: boolean) => {
    if (!openStateRef.current) return;
    setIsOpen(false);
    if (restoreFocus) swatchRef.current?.focus();
  }, []);

  const closeFromOutsidePress = useCallback((pressTarget?: EventTarget | null) => {
    // A press on another control keeps that control's focus — taking it back
    // would fight the click the user is making. A press on inert chrome hands
    // focus back to the swatch, exactly like Escape.
    const pressedElement = pressTarget instanceof Element ? pressTarget : null;
    const pressClaimsFocus = Boolean(pressedElement?.closest(FOCUS_CLAIMING_SELECTOR));
    closePicker(!pressClaimsFocus);
  }, [closePicker]);

  const { panelRef, placement } = useFloatingPanel({
    isOpen,
    onClose: closeFromOutsidePress,
    anchorRef: swatchRef,
    align: panelAlign,
    side: panelSide,
  });

  // Opening focuses the saturation/value area, but only once the panel has been
  // measured: it is not focusable while it is still hidden for the first paint.
  useLayoutEffect(() => {
    if (!isOpen || !placement || !focusPendingRef.current) return;
    focusPendingRef.current = false;
    svAreaRef.current?.focus();
  }, [isOpen, placement]);

  const displayHsv = hsvDraft ?? hsv;

  const emitHsv = (next: HsvColor) => {
    const nextColor = toHexColor(hsvToRgb(next));
    setHsvDraft(next);
    lastEmittedRef.current = nextColor;
    onColorChange(nextColor);
  };

  const beginInteraction = () => {
    onInteractionStart?.();
  };

  const endInteraction = () => {
    onInteractionEnd?.();
  };

  const updateHue = (hue: number) => {
    emitHsv({ hue: Math.max(0, Math.min(360, hue)), saturation: displayHsv.saturation, value: displayHsv.value });
  };

  const updateSlider = (slider: SliderName, value: number) => {
    if (slider === 'hue') updateHue(value * 360);
    else onAlphaChange?.(clampColorAlpha(value));
  };

  const handleSliderPointerDown = (slider: SliderName, event: React.PointerEvent<HTMLDivElement>) => {
    activeSlider.current = slider;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    beginInteraction();
    updateSlider(slider, readSliderValue(event));
  };

  const handleSliderPointerMove = (slider: SliderName, event: React.PointerEvent<HTMLDivElement>) => {
    if (activeSlider.current === slider) updateSlider(slider, readSliderValue(event));
  };

  const handleSliderPointerUp = (slider: SliderName, event: React.PointerEvent<HTMLDivElement>) => {
    if (activeSlider.current !== slider) return;
    activeSlider.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    endInteraction();
  };

  const handleSliderKeyDown = (slider: SliderName, event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = slider === 'hue' ? 1 / 36 : 0.01;
    const current = slider === 'hue' ? displayHsv.hue / 360 : normalizedAlpha;
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

  const handleSvPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    isSvDragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    beginInteraction();
    const { saturation, value } = readSaturationValue(event);
    emitHsv({ hue: displayHsv.hue, saturation, value });
  };

  const handleSvPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isSvDragging.current) return;
    const { saturation, value } = readSaturationValue(event);
    emitHsv({ hue: displayHsv.hue, saturation, value });
  };

  const handleSvPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isSvDragging.current) return;
    isSvDragging.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    endInteraction();
  };

  const handleSvKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 0.02;
    const { hue } = displayHsv;
    let { saturation, value } = displayHsv;
    if (event.key === 'ArrowLeft') saturation -= step;
    else if (event.key === 'ArrowRight') saturation += step;
    else if (event.key === 'ArrowUp') value += step;
    else if (event.key === 'ArrowDown') value -= step;
    else if (event.key === 'Home') saturation = 0;
    else if (event.key === 'End') saturation = 1;
    else return;
    event.preventDefault();
    emitHsv({
      hue,
      saturation: Math.max(0, Math.min(1, saturation)),
      value: Math.max(0, Math.min(1, value)),
    });
  };

  const updateChannel = (key: keyof typeof rgb, value: number) => {
    setHsvDraft(null);
    lastEmittedRef.current = toHexColor({ ...rgb, [key]: clampColorChannel(value) });
    onColorChange(lastEmittedRef.current);
  };

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // The popover owns Escape while it is open: it must not also reach the
    // global authoring shortcuts.
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    closePicker(true);
  };

  const handlePanelBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (!next) return;
    if (panelRef.current?.contains(next)) return;
    // Focus landing on the swatch belongs to the toggle click that follows: taking
    // the dismissal here would let that click reopen the popover instead.
    if (swatchRef.current?.contains(next)) return;
    // Tabbing out of the popover closes it without yanking focus back.
    closePicker(false);
  };

  const alphaPercent = Math.round(normalizedAlpha * 100);

  return (
    <div className="color-picker-field">
      <button
        type="button"
        ref={swatchRef}
        className={`color-swatch-button${isOpen ? ' is-open' : ''}`}
        aria-label={`${label} Color Preview`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={`${normalizedColor} · ${alphaPercent}%`}
        onClick={() => {
          if (isOpen) {
            closePicker(true);
          } else {
            focusPendingRef.current = true;
            setIsOpen(true);
          }
        }}
      >
        <span className="color-swatch-chip">
          <span className="color-swatch-color" style={{ backgroundColor: normalizedColor, opacity: normalizedAlpha }} />
        </span>
      </button>

      {isOpen && createPortal(
        <div
          ref={panelRef}
          className="color-popover"
          role="dialog"
          aria-label={`${label} Color Picker`}
          onKeyDown={handlePanelKeyDown}
          onBlur={handlePanelBlur}
          style={{
            position: 'fixed',
            left: placement?.left ?? 0,
            top: placement?.top ?? 0,
            visibility: placement ? 'visible' : 'hidden',
          }}
        >
          <div className="rgba-picker">
            <div className="rgba-picker-header">
              <span>{label}</span>
              <span className="rgba-picker-value">{`${normalizedColor.toUpperCase()} · ${alphaPercent}%`}</span>
            </div>
            <div className="rgba-picker-edit-row">
              <div className="rgba-picker-preview" aria-hidden="true">
                <span style={{ backgroundColor: normalizedColor, opacity: normalizedAlpha }} />
              </div>
              <div className="rgba-picker-channel-grid">
                {([
                  ['red', 'R', rgb.red],
                  ['green', 'G', rgb.green],
                  ['blue', 'B', rgb.blue],
                ] as const).map(([key, channelLabel, value]) => (
                  <label key={key} className="rgba-picker-channel">
                    <span>{channelLabel}</span>
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={value}
                      aria-label={`${label} ${channelLabel}`}
                      onChange={(event) => updateChannel(key, Number(event.target.value))}
                    />
                  </label>
                ))}
                {hasAlpha && (
                  <label className="rgba-picker-channel">
                    <span>A</span>
                    <input
                      type="number"
                      min={0}
                      max={255}
                      step={1}
                      value={Math.round(normalizedAlpha * 255)}
                      aria-label={`${label} A`}
                      onChange={(event) => onAlphaChange?.(clampColorChannel(Number(event.target.value)) / 255)}
                    />
                  </label>
                )}
              </div>
            </div>
            <div
              ref={svAreaRef}
              className="rgba-picker-sv"
              role="slider"
              aria-label={`${label} Saturation and Brightness`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(displayHsv.saturation * 100)}
              aria-valuetext={`Saturation ${Math.round(displayHsv.saturation * 100)}%, Brightness ${Math.round(displayHsv.value * 100)}%`}
              tabIndex={0}
              style={{ '--picker-hue': `${displayHsv.hue}` } as React.CSSProperties}
              onKeyDown={handleSvKeyDown}
              onPointerDown={handleSvPointerDown}
              onPointerMove={handleSvPointerMove}
              onPointerUp={handleSvPointerUp}
              onPointerCancel={handleSvPointerUp}
            >
              <span
                className="rgba-picker-sv-indicator"
                style={{ left: `${displayHsv.saturation * 100}%`, top: `${(1 - displayHsv.value) * 100}%` }}
              />
            </div>
            <div
              className="rgba-picker-hue-slider"
              role="slider"
              aria-label={`${label} Hue`}
              aria-valuemin={0}
              aria-valuemax={360}
              aria-valuenow={Math.round(displayHsv.hue)}
              tabIndex={0}
              onKeyDown={(event) => handleSliderKeyDown('hue', event)}
              onPointerDown={(event) => handleSliderPointerDown('hue', event)}
              onPointerMove={(event) => handleSliderPointerMove('hue', event)}
              onPointerUp={(event) => handleSliderPointerUp('hue', event)}
              onPointerCancel={(event) => handleSliderPointerUp('hue', event)}
            >
              <span className="rgba-picker-slider-indicator" style={{ left: `${(displayHsv.hue / 360) * 100}%` }} />
            </div>
            {hasAlpha && (
              <div
                className="rgba-picker-alpha-slider"
                role="slider"
                aria-label={`${label} Alpha`}
                aria-valuemin={0}
                aria-valuemax={255}
                aria-valuenow={Math.round(normalizedAlpha * 255)}
                tabIndex={0}
                onKeyDown={(event) => handleSliderKeyDown('alpha', event)}
                onPointerDown={(event) => handleSliderPointerDown('alpha', event)}
                onPointerMove={(event) => handleSliderPointerMove('alpha', event)}
                onPointerUp={(event) => handleSliderPointerUp('alpha', event)}
                onPointerCancel={(event) => handleSliderPointerUp('alpha', event)}
              >
                <span className="rgba-picker-alpha-fill" style={{ width: `${normalizedAlpha * 100}%`, backgroundColor: normalizedColor }} />
                <span className="rgba-picker-slider-indicator" style={{ left: `${normalizedAlpha * 100}%` }} />
              </div>
            )}
            <label className="rgba-picker-hex">
              <span>HEX</span>
              <SmartHexInput
                value={normalizedColor}
                fallback={fallback}
                onChange={(value) => {
                  setHsvDraft(null);
                  onColorChange(value);
                }}
              />
            </label>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
