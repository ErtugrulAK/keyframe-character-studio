import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SmartNumberInput } from '../components/Inspector/inputs/SmartNumberInput';

/**
 * QA 2026-11-13: clicking a field showing "0" and typing "30" gave "030",
 * because the caret landed after the 0. Focusing now selects the value, so
 * what is typed replaces it.
 */
describe('SmartNumberInput selects its value on focus', () => {
  it('selects the whole value when focused', () => {
    render(<SmartNumberInput ariaLabel="Rotation" value={0} onChange={vi.fn()} />);
    const input = screen.getByLabelText('Rotation') as HTMLInputElement;
    const select = vi.spyOn(input, 'select');
    fireEvent.focus(input);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('keeps that selection through the mouse-up of the focusing click only', () => {
    render(<SmartNumberInput ariaLabel="Rotation" value={0} onChange={vi.fn()} />);
    const input = screen.getByLabelText('Rotation');
    fireEvent.mouseDown(input);
    fireEvent.focus(input);
    // The focusing click's mouse-up is cancelled, so the caret does not drop the selection.
    expect(fireEvent.mouseUp(input)).toBe(false);
    // Later clicks in the focused field place the caret normally.
    input.focus();
    fireEvent.mouseDown(input);
    expect(fireEvent.mouseUp(input)).toBe(true);
  });
});
