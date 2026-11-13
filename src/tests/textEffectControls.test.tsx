import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CharacterPart } from '../types/animator';

vi.mock('../context/useAnimator', () => ({ useAnimatorSlice: () => ({ fps: 30 }) }));
import { TextEffectControls } from '../components/Inspector/sections/style/TextEffectControls';

const text = (extra: Partial<CharacterPart> = {}): CharacterPart => ({
  id: 't', name: 'T', type: 'custom_text', zIndex: 1, textValue: '87 %',
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, ...extra,
} as CharacterPart);

describe('text effect controls', () => {
  it('picks a typewriter of one second, and None removes the effect', () => {
    const change = vi.fn();
    const { rerender } = render(<TextEffectControls selectedPart={text()} onPartPropChange={change} />);
    fireEvent.change(screen.getByLabelText('ANIMATE TEXT'), { target: { value: 'typewriter' } });
    expect(change).toHaveBeenLastCalledWith('textEffect', { kind: 'typewriter', startFrame: 0, durationFrames: 30 });
    rerender(<TextEffectControls selectedPart={text({ textEffect: { kind: 'typewriter', startFrame: 0, durationFrames: 30 } })} onPartPropChange={change} />);
    fireEvent.change(screen.getByLabelText('ANIMATE TEXT'), { target: { value: 'none' } });
    expect(change).toHaveBeenLastCalledWith('textEffect', undefined);
  });

  it('shows start and length in seconds and stores them in frames; a count has a start value', () => {
    const change = vi.fn();
    render(<TextEffectControls selectedPart={text({ textEffect: { kind: 'count', startFrame: 15, durationFrames: 45, from: 0 } })} onPartPropChange={change} />);
    const start = screen.getByLabelText('Text effect start in seconds') as HTMLInputElement;
    expect(start.value).toBe('0.5');
    expect((screen.getByLabelText('Text effect length in seconds') as HTMLInputElement).value).toBe('1.5');
    fireEvent.focus(start);
    fireEvent.change(start, { target: { value: '2' } });
    fireEvent.keyDown(start, { key: 'Enter' });
    expect(change).toHaveBeenLastCalledWith('textEffect', { kind: 'count', startFrame: 60, durationFrames: 45, from: 0 });
    const from = screen.getByLabelText('Count from') as HTMLInputElement;
    fireEvent.focus(from);
    fireEvent.change(from, { target: { value: '50' } });
    fireEvent.keyDown(from, { key: 'Enter' });
    expect(change).toHaveBeenLastCalledWith('textEffect', { kind: 'count', startFrame: 15, durationFrames: 45, from: 50 });
  });
});
