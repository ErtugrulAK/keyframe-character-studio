// U1 — the ruler is the keyboard playhead slider: mapping, bounds and semantics.
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimeRuler } from '../components/Timeline/TimeRuler';

const render_ = (currentFrame: number, onSeekFrame = vi.fn()) => {
  render(
    <TimeRuler
      frameNumbers={[0, 1, 2, 3]}
      frameWidth={10}
      totalFrames={120}
      currentFrame={currentFrame}
      onPointerDown={() => undefined}
      onSeekFrame={onSeekFrame}
    />,
  );
  return onSeekFrame;
};

describe('U1 — TimeRuler keyboard seek', () => {
  it('exposes slider semantics bound to the playhead frame', () => {
    render_(7);
    const ruler = screen.getByRole('slider', { name: 'Playhead position' });
    expect(ruler).toHaveAttribute('aria-valuenow', '7');
    expect(ruler).toHaveAttribute('aria-valuemin', '0');
    expect(ruler).toHaveAttribute('aria-valuemax', '120');
    expect(ruler).toHaveAttribute('aria-valuetext', 'Frame 7 of 120');
    expect(ruler).toHaveAttribute('tabindex', '0');
  });

  it('steps one frame per arrow and ten with shift', () => {
    const seek = render_(50);
    const ruler = screen.getByRole('slider');
    fireEvent.keyDown(ruler, { key: 'ArrowRight' });
    fireEvent.keyDown(ruler, { key: 'ArrowLeft' });
    fireEvent.keyDown(ruler, { key: 'ArrowRight', shiftKey: true });
    expect(seek.mock.calls.map((c) => c[0])).toEqual([51, 49, 60]);
  });

  it('jumps to the ends with Home and End', () => {
    const seek = render_(50);
    const ruler = screen.getByRole('slider');
    fireEvent.keyDown(ruler, { key: 'Home' });
    fireEvent.keyDown(ruler, { key: 'End' });
    expect(seek.mock.calls.map((c) => c[0])).toEqual([0, 120]);
  });

  it('leaves unrelated keys to the rest of the app', () => {
    const seek = render_(50);
    const ruler = screen.getByRole('slider');
    fireEvent.keyDown(ruler, { key: 'ArrowUp' });
    fireEvent.keyDown(ruler, { key: ' ' });
    expect(seek).not.toHaveBeenCalled();
  });
});
