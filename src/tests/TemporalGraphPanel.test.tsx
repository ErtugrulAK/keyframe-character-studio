import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TemporalGraphPanel } from '../components/Inspector/TemporalGraphPanel';
import type { PropertyKeyframe } from '../types/animator';

const keyframes: PropertyKeyframe[] = [
  { id: 'a', frame: 0, value: 0, easing: 'linear' },
  { id: 'b', frame: 10, value: 100, easing: 'linear' },
];

const graphGroup = () => screen.getByRole('group', { name: 'Value Graph' });

describe('TemporalGraphPanel', () => {
  it('exposes the graph as a labelled group whose keyframe points stay reachable', () => {
    const { container } = render(<TemporalGraphPanel keyframes={keyframes} mode="value" />);

    expect(screen.getByText('EDITABLE')).toBeTruthy();
    // The graph is a group (not role="img"): an image role would hide the
    // focusable keyframe points from assistive technology.
    expect(graphGroup()).toBeTruthy();
    const points = screen.getAllByRole('button');
    expect(points).toHaveLength(2);
    expect(points[0].getAttribute('aria-label')).toContain('frame 0');
    expect(points[0].getAttribute('aria-label')).toContain('value 0.00');
    expect(points[1].getAttribute('aria-label')).toContain('frame 10');
    expect(points[1].getAttribute('tabindex')).toBe('0');
    // The decorative grid lines and curve are hidden from the accessibility tree.
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });

  it('points the group at the visible helper text so the keyboard contract is announced', () => {
    render(<TemporalGraphPanel keyframes={keyframes} mode="value" />);
    const describedBy = graphGroup().getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const helper = document.getElementById(describedBy!);
    expect(helper?.textContent).toContain('arrow keys');
  });

  it('writes a dragged value keyframe through the callback', () => {
    const onChange = vi.fn();
    render(<TemporalGraphPanel keyframes={keyframes} mode="value" onChangeKeyframeValue={onChange} />);
    fireEvent.mouseDown(screen.getByRole('button', { name: /frame 10/ }));
    fireEvent.mouseMove(graphGroup(), { clientY: 40 });
    expect(onChange).toHaveBeenCalledWith('b', expect.any(Number));
  });

  it('edits a focused keyframe point with the arrow keys', () => {
    const onChange = vi.fn();
    render(<TemporalGraphPanel keyframes={keyframes} mode="value" onChangeKeyframeValue={onChange} />);
    const point = screen.getByRole('button', { name: /frame 10/ });

    fireEvent.keyDown(point, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBe('b');
    expect(onChange.mock.calls[0][1]).toBeGreaterThan(100);

    onChange.mockClear();
    fireEvent.keyDown(point, { key: 'ArrowDown' });
    expect(onChange.mock.calls[0][1]).toBeLessThan(100);
  });

  it('ignores arrow keys in the derived speed graph', () => {
    const onChange = vi.fn();
    render(<TemporalGraphPanel keyframes={keyframes} mode="speed" onChangeKeyframeValue={onChange} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('DERIVED · READ ONLY')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
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
