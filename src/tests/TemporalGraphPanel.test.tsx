import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TemporalGraphPanel } from '../components/Inspector/TemporalGraphPanel';
import type { PropertyKeyframe } from '../types/animator';

const keyframes: PropertyKeyframe[] = [
  { id: 'a', frame: 0, value: 0, easing: 'linear' },
  { id: 'b', frame: 10, value: 100, easing: 'linear' },
];

describe('TemporalGraphPanel', () => {
  it('renders a value graph from the shared evaluator and exposes keyframe points', () => {
    render(<TemporalGraphPanel keyframes={keyframes} mode="value" />);
    expect(screen.getByText('EDITABLE')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Value graph' })).toBeTruthy();
    expect(screen.getByLabelText('Keyframe 0')).toBeTruthy();
    expect(screen.getByLabelText('Keyframe 10')).toBeTruthy();
  });

  it('writes a dragged value keyframe through the callback', () => {
    const onChange = vi.fn();
    render(<TemporalGraphPanel keyframes={keyframes} mode="value" onChangeKeyframeValue={onChange} />);
    const graph = screen.getByRole('img', { name: 'Value graph' });
    fireEvent.mouseDown(screen.getByLabelText('Keyframe 10'));
    fireEvent.mouseMove(graph, { clientY: 40 });
    expect(onChange).toHaveBeenCalledWith('b', expect.any(Number));
  });

  it('renders a derived speed graph without editable value points', () => {
    render(<TemporalGraphPanel keyframes={keyframes} mode="speed" onChangeKeyframeValue={vi.fn()} />);
    expect(screen.getByText('DERIVED · READ ONLY')).toBeTruthy();
    expect(screen.queryByLabelText('Keyframe 0')).toBeNull();
    expect(screen.queryByLabelText('Keyframe 10')).toBeNull();
  });
  it('edits temporal handle coordinates from the Value Graph controls', () => {
    const onChange = vi.fn();
    render(<TemporalGraphPanel keyframes={keyframes} mode="value" onChangeKeyframeHandles={onChange} />);
    fireEvent.change(screen.getByLabelText('Keyframe 0 bezierOut x'), { target: { value: '0.5' } });
    expect(onChange).toHaveBeenCalledWith('a', {
      bezierOut: { x: 0.5, y: 0 },
    });
  });
});
