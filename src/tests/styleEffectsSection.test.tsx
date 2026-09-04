import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StyleEffectsSection } from '../components/Inspector/sections/style/StyleEffectsSection';
import type { CharacterPart } from '../types/animator';

const makePart = (overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id: 'part-1',
  name: 'Part 1',
  type: 'custom_rect',
  zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  shadowColor: '#336699',
  shadowBlur: 12,
  shadowOffsetX: -3,
  shadowOffsetY: 6,
  ...overrides,
} as CharacterPart);

const renderEffects = (part = makePart()) => {
  const onPartPropChange = vi.fn();
  const result = render(
    <StyleEffectsSection selectedPart={part} onPartPropChange={onPartPropChange} />,
  );
  return { ...result, onPartPropChange };
};

describe('StyleEffectsSection compact editor', () => {
  it('keeps the existing Effects editor closed without firing a mutation', () => {
    const { onPartPropChange } = renderEffects();

    const disclosure = screen.getByRole('button', { name: 'Expand EFFECTS' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('SHADOW / GLOW COLOR')).toBeNull();
    expect(onPartPropChange).not.toHaveBeenCalled();
  });

  it('groups the existing shadow values and preserves each callback contract', () => {
    const { container, onPartPropChange } = renderEffects();
    fireEvent.click(screen.getByRole('button', { name: 'Expand EFFECTS' }));

    const grid = container.querySelector('.effects-property-grid');
    expect(grid).toBeTruthy();
    expect(grid?.querySelectorAll('.effects-property-field')).toHaveLength(3);
    expect(screen.getByText('BLUR RADIUS')).toBeVisible();
    expect(screen.getByText('OFFSET X')).toBeVisible();
    expect(screen.getByText('OFFSET Y')).toBeVisible();

    const numericInputs = Array.from(grid?.querySelectorAll('input[type="number"]') ?? []);
    expect(numericInputs.map((input) => input.value)).toEqual(['12', '-3', '6']);
    expect(numericInputs[0]).toHaveAttribute('min', '0');
    expect(numericInputs[0]).toHaveAttribute('max', '50');
    expect(numericInputs[1]).toHaveAttribute('min', '-50');
    expect(numericInputs[1]).toHaveAttribute('max', '50');

    fireEvent.change(numericInputs[0], { target: { value: '20' } });
    fireEvent.change(numericInputs[1], { target: { value: '-8' } });
    fireEvent.change(numericInputs[2], { target: { value: '10' } });
    expect(onPartPropChange).toHaveBeenNthCalledWith(1, 'shadowBlur', 20);
    expect(onPartPropChange).toHaveBeenNthCalledWith(2, 'shadowOffsetX', -8);
    expect(onPartPropChange).toHaveBeenNthCalledWith(3, 'shadowOffsetY', 10);

    const colorInput = container.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.change(colorInput, { target: { value: '#abcdef' } });
    expect(onPartPropChange).toHaveBeenNthCalledWith(4, 'shadowColor', '#abcdef');

    fireEvent.click(screen.getByRole('button', { name: 'Clear Shadow' }));
    expect(onPartPropChange).toHaveBeenNthCalledWith(5, 'shadowColor', undefined);
  });
});
