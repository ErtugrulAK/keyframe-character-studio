import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorPickerPopover } from '../components/Inspector/inputs/ColorPickerPopover';
import { hsvToRgb, toHexColor } from '../utils/layers/colorUtils';

const mockBounds = (element: HTMLElement, width = 100, height = 10) => {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    width,
    top: 0,
    right: width,
    bottom: height,
    height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
};

const setup = () => {
  const onColorChange = vi.fn();
  const onAlphaChange = vi.fn();
  const onInteractionStart = vi.fn();
  const onInteractionEnd = vi.fn();
  const utils = render(
    <ColorPickerPopover
      label="FILL COLOR"
      color="#336699"
      alpha={0.5}
      fallback="#00d2ff"
      onColorChange={onColorChange}
      onAlphaChange={onAlphaChange}
      onInteractionStart={onInteractionStart}
      onInteractionEnd={onInteractionEnd}
    />,
  );
  return { ...utils, onColorChange, onAlphaChange, onInteractionStart, onInteractionEnd };
};

const swatch = (label = 'FILL COLOR') => screen.getByRole('button', { name: `${label} Color Preview` });
const openPicker = (label = 'FILL COLOR') => fireEvent.click(swatch(label));

describe('ColorPickerPopover paint swatch and popover', () => {
  it('shows only the swatch until it is opened, and opening writes nothing', () => {
    const { onColorChange, onAlphaChange, onInteractionStart } = setup();

    expect(swatch()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(swatch()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).toBeNull();

    openPicker();

    expect(swatch()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'FILL COLOR Color Picker' })).toBeTruthy();
    // Opening the popover is a pure read: no color, alpha or history interaction.
    expect(onColorChange).not.toHaveBeenCalled();
    expect(onAlphaChange).not.toHaveBeenCalled();
    expect(onInteractionStart).not.toHaveBeenCalled();
  });

  it('exposes the current value, the SV area, hue, alpha and the established RGBA + hex fields', () => {
    setup();
    openPicker();

    expect(screen.getByRole('slider', { name: 'FILL COLOR Saturation and Brightness' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'FILL COLOR Hue' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'FILL COLOR Alpha' })).toBeTruthy();
    expect(screen.getByLabelText('FILL COLOR R')).toHaveValue(51);
    expect(screen.getByLabelText('FILL COLOR G')).toHaveValue(102);
    expect(screen.getByLabelText('FILL COLOR B')).toHaveValue(153);
    expect(screen.getByLabelText('FILL COLOR A')).toHaveValue(128);
    expect(document.querySelector('.rgba-picker-hex .color-hex-input')).toHaveValue('#336699');
    // One visible preview of the authored paint, over a transparency checkerboard.
    expect(document.querySelectorAll('.rgba-picker-preview')).toHaveLength(1);
    expect(document.querySelector('.rgba-picker-alpha-slider')).toBeTruthy();
    expect(document.querySelectorAll('input[type="color"]')).toHaveLength(0);
    expect(screen.getByText('#336699 · 50%')).toBeTruthy();
  });

  it('omits the alpha controls for paints that carry no alpha authority', () => {
    render(
      <ColorPickerPopover
        label="SHADOW COLOR"
        color="#101218"
        fallback="#000000"
        onColorChange={vi.fn()}
      />,
    );

    openPicker('SHADOW COLOR');

    expect(screen.queryByRole('slider', { name: 'SHADOW COLOR Alpha' })).toBeNull();
    expect(screen.queryByLabelText('SHADOW COLOR A')).toBeNull();
    expect(screen.getByRole('slider', { name: 'SHADOW COLOR Hue' })).toBeTruthy();
  });

  it('keeps the hue handle at the right endpoint when RGB normalizes 360° to 0°', () => {
    const onColorChange = vi.fn();
    render(
      <ColorPickerPopover
        label="FILL COLOR"
        color="#ff0000"
        alpha={1}
        fallback="#00d2ff"
        onColorChange={onColorChange}
        onAlphaChange={vi.fn()}
      />,
    );
    openPicker();
    const hue = screen.getByRole('slider', { name: 'FILL COLOR Hue' });
    mockBounds(hue);

    fireEvent.pointerDown(hue, { clientX: 100, pointerId: 1 });
    expect(onColorChange).toHaveBeenCalledWith('#ff0000');
    expect(hue).toHaveAttribute('aria-valuenow', '360');
    expect(document.querySelector('.rgba-picker-hue-slider .rgba-picker-slider-indicator')).toHaveStyle({ left: '100%' });

    fireEvent.pointerMove(hue, { clientX: 50, pointerId: 1 });
    expect(hue).toHaveAttribute('aria-valuenow', '180');
    fireEvent.pointerUp(hue, { clientX: 50, pointerId: 1 });
  });

  it('synchronizes the transient hue position after an external color change', () => {
    const onColorChange = vi.fn();
    const { rerender } = render(
      <ColorPickerPopover label="STROKE COLOR" color="#ff0000" alpha={1} fallback="#101218" onColorChange={onColorChange} onAlphaChange={vi.fn()} />,
    );
    openPicker('STROKE COLOR');
    const hue = screen.getByRole('slider', { name: 'STROKE COLOR Hue' });
    mockBounds(hue);
    fireEvent.pointerDown(hue, { clientX: 100, pointerId: 2 });
    expect(hue).toHaveAttribute('aria-valuenow', '360');

    rerender(<ColorPickerPopover label="STROKE COLOR" color="#00ff00" alpha={1} fallback="#101218" onColorChange={onColorChange} onAlphaChange={vi.fn()} />);
    expect(hue).toHaveAttribute('aria-valuenow', '120');
    const indicator = document.querySelector('.rgba-picker-hue-slider .rgba-picker-slider-indicator') as HTMLElement;
    expect(Number.parseFloat(indicator.style.left)).toBeCloseTo(33.333, 2);
  });

  it('keeps alpha endpoint pointer values and keyboard controls in the existing range', () => {
    const onAlphaChange = vi.fn();
    const { rerender } = render(
      <ColorPickerPopover label="FILL COLOR" color="#336699" alpha={0.5} fallback="#00d2ff" onColorChange={vi.fn()} onAlphaChange={onAlphaChange} />,
    );
    openPicker();
    const alpha = screen.getByRole('slider', { name: 'FILL COLOR Alpha' });
    mockBounds(alpha);

    fireEvent.pointerDown(alpha, { clientX: 0, pointerId: 3 });
    fireEvent.pointerUp(alpha, { clientX: 0, pointerId: 3 });
    fireEvent.pointerDown(alpha, { clientX: 100, pointerId: 4 });
    fireEvent.pointerUp(alpha, { clientX: 100, pointerId: 4 });
    fireEvent.keyDown(alpha, { key: 'Home' });
    fireEvent.keyDown(alpha, { key: 'End' });

    expect(onAlphaChange).toHaveBeenNthCalledWith(1, 0);
    expect(onAlphaChange).toHaveBeenNthCalledWith(2, 1);
    expect(onAlphaChange).toHaveBeenNthCalledWith(3, 0);
    expect(onAlphaChange).toHaveBeenNthCalledWith(4, 1);
    rerender(<ColorPickerPopover label="FILL COLOR" color="#336699" alpha={1} fallback="#00d2ff" onColorChange={vi.fn()} onAlphaChange={onAlphaChange} />);
    expect(alpha).toHaveAttribute('aria-valuenow', '255');
  });

  it('drags the saturation/value area continuously and brackets the gesture with one interaction', () => {
    const { onColorChange, onInteractionStart, onInteractionEnd } = setup();
    openPicker();

    const area = screen.getByRole('slider', { name: 'FILL COLOR Saturation and Brightness' });
    mockBounds(area, 100, 100);

    fireEvent.pointerDown(area, { clientX: 50, clientY: 25, pointerId: 7 });
    expect(onInteractionStart).toHaveBeenCalledTimes(1);
    expect(onInteractionEnd).not.toHaveBeenCalled();
    expect(onColorChange).toHaveBeenLastCalledWith(toHexColor(hsvToRgb({ hue: 210, saturation: 0.5, value: 0.75 })));
    expect(area).toHaveAttribute('aria-valuenow', '50');

    fireEvent.pointerMove(area, { clientX: 100, clientY: 0, pointerId: 7 });
    expect(onColorChange).toHaveBeenLastCalledWith(toHexColor(hsvToRgb({ hue: 210, saturation: 1, value: 1 })));
    expect(area).toHaveAttribute('aria-valuetext', 'Saturation 100%, Brightness 100%');

    fireEvent.pointerUp(area, { clientX: 100, clientY: 0, pointerId: 7 });
    expect(onInteractionEnd).toHaveBeenCalledTimes(1);
    // One gesture -> one history bracket, regardless of preview frame count.
    expect(onColorChange.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('brackets a single hue/alpha pointer gesture exactly once', () => {
    const { onInteractionStart, onInteractionEnd } = setup();
    openPicker();
    const hue = screen.getByRole('slider', { name: 'FILL COLOR Hue' });
    mockBounds(hue);

    fireEvent.pointerDown(hue, { clientX: 20, pointerId: 9 });
    fireEvent.pointerMove(hue, { clientX: 60, pointerId: 9 });
    fireEvent.pointerUp(hue, { clientX: 60, pointerId: 9 });

    expect(onInteractionStart).toHaveBeenCalledTimes(1);
    expect(onInteractionEnd).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and returns focus to the swatch', () => {
    setup();
    openPicker();
    const dialog = screen.getByRole('dialog', { name: 'FILL COLOR Color Picker' });

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    fireEvent(dialog, escape);

    expect(escape.defaultPrevented).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(swatch()).toHaveFocus();
  });

  it('closes on an outside pointer press and returns focus to the swatch', () => {
    setup();
    openPicker();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(swatch()).toHaveFocus();
    expect(swatch()).toHaveAttribute('aria-expanded', 'false');
  });

  it('reopens showing the exact current value', () => {
    const { rerender } = setup();
    openPicker();
    fireEvent.change(screen.getByLabelText('FILL COLOR R'), { target: { value: '255' } });
    fireEvent.click(swatch());
    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(
      <ColorPickerPopover
        label="FILL COLOR"
        color="#ff6699"
        alpha={0.25}
        fallback="#00d2ff"
        onColorChange={vi.fn()}
        onAlphaChange={vi.fn()}
      />,
    );
    openPicker();

    expect(screen.getByLabelText('FILL COLOR R')).toHaveValue(255);
    expect(screen.getByLabelText('FILL COLOR G')).toHaveValue(102);
    expect(screen.getByLabelText('FILL COLOR B')).toHaveValue(153);
    expect(screen.getByLabelText('FILL COLOR A')).toHaveValue(64);
    expect(document.querySelector('.rgba-picker-hex .color-hex-input')).toHaveValue('#ff6699');
    expect(screen.getByRole('slider', { name: 'FILL COLOR Alpha' })).toHaveAttribute('aria-valuenow', '64');
  });
});
