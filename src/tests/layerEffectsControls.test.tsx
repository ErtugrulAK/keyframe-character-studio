import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CharacterPart } from '../types/animator';
import { LayerEffectsControls } from '../components/Inspector/sections/style/LayerEffectsControls';

const part = (extra: Partial<CharacterPart> = {}): CharacterPart => ({
  id: 'p', name: 'P', type: 'custom_rect', zIndex: 1, fillColor: '#f00',
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, ...extra,
} as CharacterPart);

describe('glow, blur and blend controls', () => {
  it('the glow box writes one colour (one undo step) and brings the last one back', () => {
    const change = vi.fn();
    const { rerender } = render(<LayerEffectsControls selectedPart={part()} onPartPropChange={change} />);
    fireEvent.click(screen.getByLabelText('Glow Enabled'));
    expect(change.mock.calls).toEqual([['glowColor', '#ffd166']]);
    rerender(<LayerEffectsControls selectedPart={part({ glowColor: '#00ffaa' })} onPartPropChange={change} />);
    expect(screen.getByLabelText('Glow size')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Glow Enabled'));
    expect(change).toHaveBeenLastCalledWith('glowColor', undefined);
    rerender(<LayerEffectsControls selectedPart={part()} onPartPropChange={change} />);
    fireEvent.click(screen.getByLabelText('Glow Enabled'));
    expect(change).toHaveBeenLastCalledWith('glowColor', '#00ffaa');
  });

  it('strength is shown in percent and stored 0..1; blend Normal clears the field', () => {
    const change = vi.fn();
    render(<LayerEffectsControls selectedPart={part({ glowColor: '#fff', glowStrength: 0.25, blendMode: 'screen' })} onPartPropChange={change} />);
    const strength = screen.getByLabelText('Glow strength') as HTMLInputElement;
    expect(strength.value).toBe('25');
    fireEvent.focus(strength);
    fireEvent.change(strength, { target: { value: '60' } });
    fireEvent.keyDown(strength, { key: 'Enter' });
    expect(change).toHaveBeenLastCalledWith('glowStrength', 0.6);
    fireEvent.change(screen.getByLabelText('Blend mode'), { target: { value: 'normal' } });
    expect(change).toHaveBeenLastCalledWith('blendMode', undefined);
    fireEvent.change(screen.getByLabelText('Blend mode'), { target: { value: 'multiply' } });
    expect(change).toHaveBeenLastCalledWith('blendMode', 'multiply');
  });
});
