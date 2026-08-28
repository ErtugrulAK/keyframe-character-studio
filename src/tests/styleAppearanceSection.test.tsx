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
  it('renders fill and stroke RGBA pickers with zero-safe alpha values', () => {
    const onChange = vi.fn();
    const part = { ...makePart('custom_rect'), fillEnabled: true, fillOpacity: 0, strokeEnabled: false, strokeWidth: 0, strokeOpacity: 0 };
    render(<StyleAppearanceSection selectedPart={part} onPartPropChange={onChange} />);
    expect(screen.getByText('APPEARANCE')).toBeTruthy();
    expect((screen.getByLabelText('Fill Enabled') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Stroke Enabled') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByLabelText('FILL COLOR Color Picker'));
    expect(screen.getByLabelText('FILL COLOR Alpha')).toHaveValue('0');
    expect(screen.queryByText('FILL ALPHA')).toBeNull();
    fireEvent.change(screen.getByLabelText('FILL COLOR Alpha'), { target: { value: '50' } });
    expect(onChange).toHaveBeenCalledWith('fillOpacity', 0.5);
    fireEvent.click(screen.getByLabelText('Fill Enabled'));
    expect(onChange).toHaveBeenCalledWith('fillEnabled', false);
    fireEvent.click(screen.getByLabelText('Stroke Enabled'));
    expect(onChange).toHaveBeenCalledWith('strokeEnabled', true);
  });
  it('keeps one shared picker active and synchronizes RGB and hex controls', () => {
    const onChange = vi.fn();
    render(<StyleAppearanceSection selectedPart={makePart('custom_rect')} onPartPropChange={onChange} />);
    fireEvent.click(screen.getByLabelText('FILL COLOR Color Picker'));
    fireEvent.change(screen.getByLabelText('FILL COLOR R'), { target: { value: '128' } });
    expect(onChange).toHaveBeenCalledWith('fillColor', '#800000');
    expect(screen.getByLabelText('FILL COLOR Alpha')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('STROKE COLOR Color Picker'));
    expect(screen.queryByRole('dialog', { name: 'FILL COLOR RGBA Picker' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'STROKE COLOR RGBA Picker' })).toBeTruthy();
  });

  it('keeps excluded color-bearing types on the shared RGBA picker', () => {
    const onColorChange = vi.fn();
    const onPropChange = vi.fn();
    render(<StyleColorSection selectedPart={makePart('custom_banner')} onPartColorChange={onColorChange} onPartPropChange={onPropChange} />);
    expect(screen.getByText('COLOR')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('FILL COLOR Color Picker'));
    expect(screen.getByLabelText('FILL COLOR Alpha')).toBeTruthy();
    expect(screen.queryByText('FILL ALPHA')).toBeNull();
    expect(screen.queryByText('APPEARANCE')).toBeNull();
  });
});
