import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StyleAppearanceSection } from '../components/Inspector/sections/style/StyleAppearanceSection';
import { StyleColorSection } from '../components/Inspector/sections/style/StyleColorSection';
import type { CharacterPart } from '../types/animator';

const makePart = (type: CharacterPart['type']): CharacterPart => ({
  id: 'p', type, name: type, zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  fillColor: '#ff0000', strokeColor: '#101218',
} as CharacterPart);

describe('StyleAppearanceSection', () => {
  it('renders compact inline RGBA controls without a native color picker', () => {
    const onChange = vi.fn();
    const part = { ...makePart('custom_rect'), fillEnabled: true, fillOpacity: 0, strokeEnabled: false, strokeWidth: 0, strokeOpacity: 0 };
    const { container } = render(<StyleAppearanceSection selectedPart={part} onPartPropChange={onChange} />);

    expect(screen.getByText('APPEARANCE')).toBeTruthy();
    expect(screen.getByLabelText('FILL COLOR Alpha')).toHaveValue('0');
    expect(screen.getByLabelText('STROKE COLOR Alpha')).toHaveValue('0');
    expect(container.querySelectorAll('input[type="color"]')).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('FILL COLOR Alpha Preview')).toBeTruthy();
    expect(screen.getByLabelText('STROKE COLOR Alpha Preview')).toBeTruthy();

    const fillHeader = container.querySelector('.appearance-group-header');
    expect(fillHeader).toBeTruthy();
    fireEvent.click(fillHeader as HTMLElement);
    expect(onChange).not.toHaveBeenCalledWith('fillEnabled', false);

    fireEvent.click(screen.getByLabelText('Fill Enabled'));
    expect(onChange).toHaveBeenCalledWith('fillEnabled', false);
    fireEvent.click(screen.getByLabelText('Stroke Enabled'));
    expect(onChange).toHaveBeenCalledWith('strokeEnabled', true);
  });

  it('keeps RGB, alpha, hex, and fill/stroke channels independent', () => {
    const onChange = vi.fn();
    const part = makePart('custom_rect');
    const { container, rerender } = render(<StyleAppearanceSection selectedPart={part} onPartPropChange={onChange} />);

    fireEvent.change(screen.getByLabelText('FILL COLOR R'), { target: { value: '128' } });
    expect(onChange).toHaveBeenCalledWith('fillColor', '#800000');
    fireEvent.change(screen.getByLabelText('FILL COLOR Alpha'), { target: { value: '50' } });
    expect(onChange).toHaveBeenCalledWith('fillOpacity', 0.5);

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
    render(<StyleAppearanceSection selectedPart={part} onPartPropChange={onChange} />);

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

  it('keeps excluded color-bearing types on the inline RGBA editor', () => {
    const onColorChange = vi.fn();
    const onPropChange = vi.fn();
    const { container } = render(<StyleColorSection selectedPart={makePart('custom_banner')} onPartColorChange={onColorChange} onPartPropChange={onPropChange} />);

    expect(screen.getByText('COLOR')).toBeTruthy();
    expect(screen.getByLabelText('FILL COLOR Alpha')).toBeTruthy();
    expect(screen.queryByText('FILL ALPHA')).toBeNull();
    expect(screen.queryByText('APPEARANCE')).toBeNull();
    expect(container.querySelectorAll('input[type="color"]')).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
