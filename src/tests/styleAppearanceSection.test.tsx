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

  it('keeps the old color card for excluded types', () => {
    const onColorChange = vi.fn();
    render(<StyleColorSection selectedPart={makePart('custom_banner')} onPartColorChange={onColorChange} />);
    expect(screen.getByText('COLOR')).toBeTruthy();
    expect(screen.queryByText('APPEARANCE')).toBeNull();
  });
});
