import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StyleAppearanceSection } from '../components/Inspector/sections/style/StyleAppearanceSection';
import { StyleColorSection } from '../components/Inspector/sections/style/StyleColorSection';
import { StyleEffectsSection } from '../components/Inspector/sections/style/StyleEffectsSection';
import type { CharacterPart } from '../types/animator';

type PartChange = (key: keyof CharacterPart, value: unknown) => void;
type ColorChange = (color: string) => void;

const openAppearance = (selectedPart: CharacterPart, onPartPropChange: PartChange) => {
  const utils = render(<StyleAppearanceSection selectedPart={selectedPart} onPartPropChange={onPartPropChange} />);
  fireEvent.click(utils.getByRole('button', { name: 'Expand APPEARANCE' }));
  return utils;
};

const openModernTextColor = (selectedPart: CharacterPart, onPartColorChange: ColorChange, onPartPropChange: PartChange) => {
  const utils = render(<StyleColorSection selectedPart={selectedPart} onPartColorChange={onPartColorChange} onPartPropChange={onPartPropChange} />);
  fireEvent.click(utils.getByRole('button', { name: 'Expand APPEARANCE' }));
  return utils;
};

const makePart = (type: CharacterPart['type']): CharacterPart => ({
  id: 'p', type, name: type, zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  fillColor: '#ff0000', strokeColor: '#101218',
} as CharacterPart);

describe('StyleAppearanceSection', () => {
  it('renders one inline RGBA editor per property without a native color picker', () => {
    const onChange = vi.fn();
    const part = { ...makePart('custom_rect'), fillEnabled: true, fillOpacity: 0, strokeEnabled: false, strokeWidth: 0, strokeOpacity: 0 };
    const { container } = openAppearance(part, onChange);

    expect(screen.getByText('APPEARANCE')).toBeTruthy();
    expect(screen.getByLabelText('FILL COLOR A')).toHaveValue(0);
    expect(screen.getByLabelText('STROKE COLOR A')).toHaveValue(0);
    expect(screen.getByRole('slider', { name: 'FILL COLOR Hue' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'STROKE COLOR Hue' })).toBeTruthy();
    expect(screen.getAllByLabelText('FILL COLOR Color Preview')).toHaveLength(1);
    expect(screen.getAllByLabelText('STROKE COLOR Color Preview')).toHaveLength(1);
    expect(container.querySelectorAll('input[type="color"]')).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();

    const fillHeader = container.querySelector('.appearance-group-header');
    expect(fillHeader).toBeTruthy();
    fireEvent.click(fillHeader as HTMLElement);
    expect(onChange).not.toHaveBeenCalledWith('fillEnabled', false);

    fireEvent.click(screen.getByLabelText('Fill Enabled'));
    expect(onChange).toHaveBeenCalledWith('fillEnabled', false);
    fireEvent.click(screen.getByLabelText('Stroke Enabled'));
    expect(onChange).toHaveBeenCalledWith('strokeEnabled', true);
  });

  it('updates hue and alpha through their inline controls', () => {
    const onChange = vi.fn();
    const part = makePart('custom_rect');
    const { container } = openAppearance(part, onChange);
    const hue = screen.getByRole('slider', { name: 'FILL COLOR Hue' });
    const alpha = screen.getByRole('slider', { name: 'FILL COLOR Alpha' });
    vi.spyOn(hue, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 100, top: 0, right: 100, bottom: 10, height: 10, x: 0, y: 0, toJSON: () => ({}) });
    vi.spyOn(alpha, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 100, top: 0, right: 100, bottom: 10, height: 10, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(hue, { clientX: 50, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith('fillColor', '#00ffff');
    fireEvent.pointerDown(alpha, { clientX: 25, pointerId: 2 });
    expect(onChange).toHaveBeenCalledWith('fillOpacity', 0.25);
    expect(container.querySelectorAll('.rgba-picker-hue-slider')).toHaveLength(2);
  });

  it('keeps RGB, alpha, hex, and fill/stroke channels independent', () => {
    const onChange = vi.fn();
    const part = makePart('custom_rect');
    const { container, rerender } = openAppearance(part, onChange);

    fireEvent.change(screen.getByLabelText('FILL COLOR R'), { target: { value: '128' } });
    expect(onChange).toHaveBeenCalledWith('fillColor', '#800000');
    fireEvent.change(screen.getByLabelText('FILL COLOR A'), { target: { value: '128' } });
    expect(onChange).toHaveBeenCalledWith('fillOpacity', 128 / 255);

    rerender(<StyleAppearanceSection selectedPart={{ ...part, fillColor: '#800000', fillOpacity: 0.5 }} onPartPropChange={onChange} />);
    expect(screen.getByLabelText('FILL COLOR R')).toHaveValue(128);
    expect(container.querySelector('.appearance-color-field .color-hex-input')).toHaveValue('#800000');

    fireEvent.change(screen.getByLabelText('STROKE COLOR R'), { target: { value: '32' } });
    expect(onChange).toHaveBeenCalledWith('strokeColor', '#201218');
    expect(screen.getByLabelText('STROKE COLOR R')).toHaveValue(16);
  });


  it('exposes only inside and outside alignment while mapping center compatibility', () => {
    const onChange = vi.fn();
    const part = { ...makePart('custom_rect'), strokeAlignment: 'center' as const };
    openAppearance(part, onChange);

    const alignment = screen.getByLabelText('Stroke Alignment');
    expect(alignment).toHaveValue('outside');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByRole('option', { name: 'INSIDE' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'OUTSIDE' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'CENTER' })).toBeNull();

    fireEvent.change(alignment, { target: { value: 'inside' } });
    expect(onChange).toHaveBeenCalledWith('strokeAlignment', 'inside');
    fireEvent.change(alignment, { target: { value: 'outside' } });
    expect(onChange).toHaveBeenCalledWith('strokeAlignment', 'center');
  });

  it('keeps Stroke Width and Align in one compact row without changing callbacks', () => {
    const onChange = vi.fn();
    const { container } = openAppearance({ ...makePart('custom_rect'), strokeWidth: 1.5, strokeAlignment: 'outside' }, onChange);
    const row = container.querySelector('.stroke-inline-fields');

    expect(row).toBeTruthy();
    expect(row?.querySelectorAll('.appearance-field')).toHaveLength(2);
    expect(screen.getByLabelText('Stroke Width')).toHaveValue(1.5);
    expect(screen.getByLabelText('Stroke Alignment')).toHaveValue('outside');

    fireEvent.change(screen.getByLabelText('Stroke Width'), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith('strokeWidth', 3);
    fireEvent.change(screen.getByLabelText('Stroke Alignment'), { target: { value: 'inside' } });
    expect(onChange).toHaveBeenCalledWith('strokeAlignment', 'inside');
  });

  it('uses the modern inline Appearance language for non-shape color-bearing types', () => {
    const onColorChange = vi.fn();
    const onPropChange = vi.fn();
    const { container } = openModernTextColor(makePart('custom_banner'), onColorChange, onPropChange);

    expect(screen.getByText('APPEARANCE')).toBeTruthy();
    expect(screen.getByText('FILL')).toBeTruthy();
    expect(screen.getByText('STROKE')).toBeTruthy();
    expect(screen.getByLabelText('FILL COLOR A')).toBeTruthy();
    expect(screen.queryByText('QUICK PALETTE SWATCHES')).toBeNull();
    expect(screen.queryByText('COLOR')).toBeNull();
    expect(container.querySelectorAll('input[type="color"]')).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Inspector disclosure sections', () => {
  it('closes Appearance by default and opens without mutating authored state', () => {
    const onChange = vi.fn();
    render(<StyleAppearanceSection selectedPart={makePart('custom_rect')} onPartPropChange={onChange} />);

    const disclosure = screen.getByRole('button', { name: 'Expand APPEARANCE' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('FILL COLOR R')).toBeNull();
    fireEvent.click(disclosure);
    expect(screen.getByRole('button', { name: 'Collapse APPEARANCE' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse APPEARANCE' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes Effects by default and keeps property controls outside disclosure clicks', () => {
    const onChange = vi.fn();
    const part = { ...makePart('custom_rect'), shadowColor: '#123456' };
    render(<StyleEffectsSection selectedPart={part} onPartPropChange={onChange} />);

    const disclosure = screen.getByRole('button', { name: 'Expand EFFECTS' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('SHADOW / GLOW COLOR')).toBeNull();
    fireEvent.click(disclosure);
    expect(screen.getByRole('button', { name: 'Collapse EFFECTS' })).toHaveAttribute('aria-expanded', 'true');
    expect(onChange).not.toHaveBeenCalled();
  });
});
