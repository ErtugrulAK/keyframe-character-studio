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
  it('renders independent fill and stroke controls with zero-safe values', () => {
    const onChange = vi.fn();
    const part = { ...makePart('custom_rect'), fillEnabled: true, fillOpacity: 0, strokeEnabled: false, strokeWidth: 0, strokeOpacity: 0 };
    render(<StyleAppearanceSection selectedPart={part} onPartPropChange={onChange} />);
    expect(screen.getByText('APPEARANCE')).toBeTruthy();
    expect((screen.getByLabelText('Fill Enabled') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Stroke Enabled') as HTMLInputElement).checked).toBe(false);
    expect(screen.getAllByDisplayValue('0').length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByLabelText('Fill Enabled'));
    expect(onChange).toHaveBeenCalledWith('fillEnabled', false);
    fireEvent.click(screen.getByLabelText('Stroke Enabled'));
    expect(onChange).toHaveBeenCalledWith('strokeEnabled', true);
  });

  it('keeps the old color card for excluded types with alpha controls', () => {
    const onColorChange = vi.fn();
    const onPropChange = vi.fn();
    render(<StyleColorSection selectedPart={makePart('custom_banner')} onPartColorChange={onColorChange} onPartPropChange={onPropChange} />);
    expect(screen.getByText('COLOR')).toBeTruthy();
    expect(screen.getByText('FILL ALPHA')).toBeTruthy();
    expect(screen.getByText('STROKE ALPHA')).toBeTruthy();
    expect(screen.queryByText('APPEARANCE')).toBeNull();
    fireEvent.change(screen.getByLabelText('Fill Alpha'), { target: { value: '50' } });
    expect(onPropChange).toHaveBeenCalledWith('fillOpacity', 0.5);
  });
});
