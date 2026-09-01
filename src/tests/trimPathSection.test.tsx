import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrimPathSection } from '../components/Inspector/sections/style/TrimPathSection';
import type { CharacterPart } from '../types/animator';

const part = {
  id: 'shape',
  name: 'Trim Shape',
  type: 'custom_rect',
  trimPathEnabled: true,
  trimPathStart: 0.25,
  trimPathEnd: 0.75,
  trimPathOffset: 45,
} as CharacterPart;

describe('TrimPathSection compact presentation', () => {
  it('keeps the section closed and renders Start, End, and Offset in one row when opened', () => {
    const { container } = render(<TrimPathSection selectedPart={part} onPartPropChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Expand TRIM PATH' })).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('.trim-path-fields')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expand TRIM PATH' }));
    expect(container.querySelectorAll('.trim-path-fields > .appearance-field')).toHaveLength(3);
    expect(screen.getByLabelText('Trim Path Start')).toHaveValue(25);
    expect(screen.getByLabelText('Trim Path End')).toHaveValue(75);
    expect(screen.getByLabelText('Trim Path Offset')).toHaveValue(45);
  });

  it('preserves enable, Start, End, and normalized Offset callbacks', () => {
    const onPartPropChange = vi.fn();
    render(<TrimPathSection selectedPart={part} onPartPropChange={onPartPropChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand TRIM PATH' }));

    fireEvent.click(screen.getByLabelText('Trim Path Enabled'));
    fireEvent.change(screen.getByLabelText('Trim Path Start'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Trim Path End'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Trim Path Offset'), { target: { value: '450' } });

    expect(onPartPropChange).toHaveBeenNthCalledWith(1, 'trimPathEnabled', false);
    expect(onPartPropChange).toHaveBeenNthCalledWith(2, 'trimPathStart', 0.3);
    expect(onPartPropChange).toHaveBeenNthCalledWith(3, 'trimPathEnd', 0.6);
    expect(onPartPropChange).toHaveBeenNthCalledWith(4, 'trimPathOffset', 90);
  });
});
