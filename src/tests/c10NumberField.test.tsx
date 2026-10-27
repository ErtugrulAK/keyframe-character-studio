import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NumberField } from '../components/Inspector/inputs/NumberField';

describe('C10 NumberField', () => {
  afterEach(() => cleanup());

  it('keeps an emptied field empty while focused and writes only complete numbers', () => {
    const onValue = vi.fn();
    render(<NumberField aria-label="Opacity" value={1} onValue={onValue} />);
    const input = screen.getByLabelText('Opacity') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    // The stored 1 does not come back while the user is typing.
    expect(input.value).toBe('');
    expect(onValue).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '0.1' } });
    expect(onValue).toHaveBeenLastCalledWith(0.1);
    expect(input.value).toBe('0.1');
  });

  it('shows the stored value again after an unfinished edit', () => {
    const onValue = vi.fn();
    render(<NumberField aria-label="Feather" value={4} onValue={onValue} />);
    const input = screen.getByLabelText('Feather') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('4');
    expect(onValue).not.toHaveBeenCalled();
  });

  it("'blur' writes once when the edit ends (Enter), not on every keystroke", () => {
    const onValue = vi.fn();
    render(<NumberField aria-label="Duration" commit="blur" value={2} onValue={onValue} />);
    const input = screen.getByLabelText('Duration') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.change(input, { target: { value: '15' } });
    expect(onValue).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(onValue).toHaveBeenCalledTimes(1);
    expect(onValue).toHaveBeenCalledWith(15);
  });
});
