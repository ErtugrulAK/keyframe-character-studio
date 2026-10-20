import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    // The decorative axes, curve and labels are hidden from the accessibility
    // tree; the interactive points are not.
    for (const node of container.querySelectorAll('line, path, svg text')) {
      expect(node.getAttribute('aria-hidden')).toBe('true');
    }
    expect(screen.getAllByRole('button').every((node) => node.getAttribute('aria-hidden') === null)).toBe(true);
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

describe('TemporalGraphPanel — D1 Increment 1 presentation', () => {
  const descending: PropertyKeyframe[] = [
    { id: 'a', frame: 0, value: 100, easing: 'hold' },
    { id: 'b', frame: 5, value: 40, easing: 'easeInOut' },
    { id: 'c', frame: 10, value: 0, easing: 'linear' },
  ];
  const axis = (mode: 'value' | 'speed') =>
    screen.getByRole('group', { name: mode === 'value' ? 'Value Graph' : 'Speed Graph' }) as SVGSVGElement;

  it('keeps the editable value domain frozen around the historical 0..1 baseline', () => {
    render(<TemporalGraphPanel keyframes={descending} mode="value" />);
    const svg = axis('value');
    expect(Number(svg.getAttribute('data-axis-min'))).toBeLessThanOrEqual(0);
    expect(Number(svg.getAttribute('data-axis-max'))).toBeGreaterThanOrEqual(1);
    expect(svg.getAttribute('data-axis-unit')).toBe('value-units');
  });

  it('gives the derived speed graph its own domain that shows negative slopes', () => {
    render(<TemporalGraphPanel keyframes={descending} mode="speed" />);
    const svg = axis('speed');
    // A decreasing channel must read below zero — the historical shared domain
    // pinned every speed curve into 0..1 and hid the sign entirely.
    expect(Number(svg.getAttribute('data-axis-min'))).toBeLessThan(0);
    expect(svg.getAttribute('data-axis-unit')).toBe('value-units/frame');
  });

  it('badges every segment with the easing the authority applies from its start key', () => {
    const { container } = render(<TemporalGraphPanel keyframes={descending} mode="value" />);
    const badges = container.querySelectorAll('.temporal-graph-segment-badge');
    expect(badges).toHaveLength(2);
    expect(badges[0].getAttribute('data-segment-easing')).toBe('hold');
    expect(badges[0].textContent).toBe('HOLD');
    expect(badges[1].getAttribute('data-segment-easing')).toBe('easeInOut');
    expect(badges[1].textContent).toBe('IN/OUT');
  });
});

describe('TemporalGraphPanel — E1 built-in easing presets', () => {
  const keyed: PropertyKeyframe[] = [
    { id: 'a', frame: 0, value: 0, easing: 'linear' },
    { id: 'b', frame: 10, value: 100, easing: 'linear' },
  ];

  it('offers every built-in preset per keyframe through the handle row', () => {
    const onChange = vi.fn();
    render(<TemporalGraphPanel keyframes={keyed} mode="value" onChangeKeyframeHandles={onChange} />);
    const selects = screen.getAllByRole('combobox', { name: /Apply easing preset to keyframe/ });
    expect(selects).toHaveLength(2);
    expect(selects[0]).toHaveAttribute('aria-label', 'Apply easing preset to keyframe 0');
    for (const label of ['Ease In Out', 'Overshoot', 'Anticipate', 'Elastic']) {
      expect(within(selects[0]).getByRole('option', { name: label, exact: true })).toBeInTheDocument();
    }
  });

  it('writes one handle patch per preset choice through the existing authority', () => {
    const onChange = vi.fn();
    render(<TemporalGraphPanel keyframes={keyed} mode="value" onChangeKeyframeHandles={onChange} />);
    const select = screen.getAllByRole('combobox', { name: /Apply easing preset to keyframe/ })[0];
    fireEvent.change(select, { target: { value: 'Ease In Out' } });
    // Exactly one call: the preset is one gesture, hence one undo transaction.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('a', {
      bezierOut: { x: 0.42, y: 0 },
      bezierIn: { x: 0.58, y: 1 },
    });
    // Transient affordance: the select never keeps a phantom selection.
    expect((select as unknown as HTMLSelectElement).value).toBe('');
  });

  it('keeps the derived speed graph free of editing affordances', () => {
    const onChange = vi.fn();
    render(<TemporalGraphPanel keyframes={keyed} mode="speed" onChangeKeyframeHandles={onChange} />);
    expect(screen.queryByRole('combobox', { name: /Apply easing preset/ })).not.toBeInTheDocument();
  });
});
