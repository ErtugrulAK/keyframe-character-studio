import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorPickerPopover } from '../components/Inspector/inputs/ColorPickerPopover';

const renderPicker = (color = '#ff0000', alpha = 1) => render(
  <ColorPickerPopover
    label="FILL COLOR"
    color={color}
    alpha={alpha}
    fallback="#00d2ff"
    onColorChange={vi.fn()}
    onAlphaChange={vi.fn()}
  />,
);

const mockSliderBounds = (element: HTMLElement) => {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    width: 100,
    top: 0,
    right: 100,
    bottom: 10,
    height: 10,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
};

describe('ColorPickerPopover inline editor', () => {
  it('keeps one preview, centered RGBA inputs, and no native color input', () => {
    const { container } = renderPicker('#336699', 0.5);

    expect(container.querySelectorAll('.rgba-picker-preview')).toHaveLength(1);
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(4);
    expect(container.querySelectorAll('input[type="color"]')).toHaveLength(0);
    expect(screen.getByLabelText('FILL COLOR R')).toHaveValue(51);
    expect(screen.getByLabelText('FILL COLOR G')).toHaveValue(102);
    expect(screen.getByLabelText('FILL COLOR B')).toHaveValue(153);
    expect(screen.getByLabelText('FILL COLOR A')).toHaveValue(128);
  });

  it('keeps the hue handle at the right endpoint when RGB normalizes 360° to 0°', () => {
    const onColorChange = vi.fn();
    const { container } = render(
      <ColorPickerPopover
        label="FILL COLOR"
        color="#ff0000"
        alpha={1}
        fallback="#00d2ff"
        onColorChange={onColorChange}
        onAlphaChange={vi.fn()}
      />,
    );
    const hue = screen.getByRole('slider', { name: 'FILL COLOR Hue' });
    mockSliderBounds(hue);

    fireEvent.pointerDown(hue, { clientX: 100, pointerId: 1 });
    expect(onColorChange).toHaveBeenCalledWith('#ff0000');
    expect(hue).toHaveAttribute('aria-valuenow', '360');
    expect(container.querySelector('.rgba-picker-hue-slider .rgba-picker-slider-indicator')).toHaveStyle({ left: '100%' });

    fireEvent.pointerMove(hue, { clientX: 50, pointerId: 1 });
    expect(hue).toHaveAttribute('aria-valuenow', '180');
    fireEvent.pointerUp(hue, { clientX: 50, pointerId: 1 });
  });

  it('synchronizes the transient hue position after an external color change', () => {
    const onColorChange = vi.fn();
    const { rerender, container } = render(
      <ColorPickerPopover label="STROKE COLOR" color="#ff0000" alpha={1} fallback="#101218" onColorChange={onColorChange} onAlphaChange={vi.fn()} />,
    );
    const hue = screen.getByRole('slider', { name: 'STROKE COLOR Hue' });
    mockSliderBounds(hue);
    fireEvent.pointerDown(hue, { clientX: 100, pointerId: 2 });
    expect(hue).toHaveAttribute('aria-valuenow', '360');

    rerender(<ColorPickerPopover label="STROKE COLOR" color="#00ff00" alpha={1} fallback="#101218" onColorChange={onColorChange} onAlphaChange={vi.fn()} />);
    expect(hue).toHaveAttribute('aria-valuenow', '120');
    const indicator = container.querySelector('.rgba-picker-hue-slider .rgba-picker-slider-indicator') as HTMLElement;
    expect(Number.parseFloat(indicator.style.left)).toBeCloseTo(33.333, 2);
  });

  it('keeps alpha endpoint pointer values and keyboard controls in the existing range', () => {
    const onAlphaChange = vi.fn();
    const { rerender } = render(
      <ColorPickerPopover label="FILL COLOR" color="#336699" alpha={0.5} fallback="#00d2ff" onColorChange={vi.fn()} onAlphaChange={onAlphaChange} />,
    );
    const alpha = screen.getByRole('slider', { name: 'FILL COLOR Alpha' });
    mockSliderBounds(alpha);

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
});
