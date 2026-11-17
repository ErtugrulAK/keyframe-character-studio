import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TimelineTimeField } from '../components/Timeline/TimelineTimeField';

const Harness = ({ onSeek }: { onSeek: (frame: number) => void }) => {
  const [frame, setFrame] = useState(0);
  return <TimelineTimeField currentFrame={frame} totalFrames={300} fps={30} onSeek={(next) => { onSeek(next); setFrame(next); }} />;
};

const type = (text: string, key = 'Enter') => {
  const field = screen.getByRole('textbox', { name: 'Current time' });
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value: text } });
  fireEvent.keyDown(field, { key });
  return field as HTMLInputElement;
};

describe('timeline time field', () => {
  it('moves the playhead to a typed time in any unit', () => {
    const onSeek = vi.fn();
    render(<Harness onSeek={onSeek} />);
    expect(type('1.5s').value).toBe('00:01:15');
    expect(onSeek).toHaveBeenLastCalledWith(45);
    type('20f');
    expect(onSeek).toHaveBeenLastCalledWith(20);
    type('00:00:02:00');
    expect(onSeek).toHaveBeenLastCalledWith(60);
  });

  it('keeps the playhead inside the sequence', () => {
    const onSeek = vi.fn();
    render(<Harness onSeek={onSeek} />);
    type('90s');
    expect(onSeek).toHaveBeenLastCalledWith(300);
  });

  it('puts the current time back on Escape or on text that is not a time', () => {
    const onSeek = vi.fn();
    render(<Harness onSeek={onSeek} />);
    expect(type('hello').value).toBe('00:00:00');
    expect(type('2s', 'Escape').value).toBe('00:00:00');
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('switches between timecode and frames', () => {
    render(<Harness onSeek={() => {}} />);
    type('37');
    fireEvent.click(screen.getByRole('button', { name: 'Show the time in frames' }));
    expect((screen.getByRole('textbox', { name: 'Current time' }) as HTMLInputElement).value).toBe('37f');
    expect(screen.getByText('/ 300f')).toBeTruthy();
  });
});
