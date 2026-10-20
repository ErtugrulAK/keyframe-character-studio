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

describe('TemporalGraphPanel — G2 badge truth under the handle override', () => {
  const pair: PropertyKeyframe[] = [
    { id: 'a', frame: 0, value: 0, easing: 'linear', bezierOut: { x: 0.42, y: 0 } },
    { id: 'b', frame: 10, value: 100, easing: 'linear', bezierIn: { x: 0.58, y: 1 } },
  ];
  const halfPair: PropertyKeyframe[] = [
    { id: 'a', frame: 0, value: 0, easing: 'linear', bezierOut: { x: 0.42, y: 0 } },
    { id: 'b', frame: 10, value: 100, easing: 'linear' },
  ];
  const holdWithPair: PropertyKeyframe[] = [
    { id: 'a', frame: 0, value: 0, easing: 'hold', bezierOut: { x: 0.42, y: 0 } },
    { id: 'b', frame: 10, value: 100, easing: 'linear', bezierIn: { x: 0.58, y: 1 } },
  ];

  const badgeOf = (container: HTMLElement, index = 0) => container.querySelectorAll('.temporal-graph-segment-badge')[index];

  it('badges a complete handle pair as BEZ although the stored name is still linear', () => {
    const { container } = render(<TemporalGraphPanel keyframes={pair} mode="value" />);
    expect(badgeOf(container).getAttribute('data-segment-easing')).toBe('bezier');
    expect(badgeOf(container).textContent).toBe('BEZ');
  });

  it('an incomplete pair keeps the stored name (pairing is the authority predicate)', () => {
    const { container } = render(<TemporalGraphPanel keyframes={halfPair} mode="value" />);
    expect(badgeOf(container).getAttribute('data-segment-easing')).toBe('linear');
    expect(badgeOf(container).textContent).toBe('LIN');
  });

  it('hold outranks a complete pair — matching applyEasing check order', () => {
    const { container } = render(<TemporalGraphPanel keyframes={holdWithPair} mode="value" />);
    expect(badgeOf(container).getAttribute('data-segment-easing')).toBe('hold');
    expect(badgeOf(container).textContent).toBe('HOLD');
  });
});

describe('TemporalGraphPanel — V6 full authority precedence', () => {
  const pair2 = (over: Record<string, unknown>): PropertyKeyframe[] => [
    { id: 'a', frame: 0, value: 0, easing: 'linear', ...over },
    { id: 'b', frame: 10, value: 100, easing: 'linear' },
  ] as PropertyKeyframe[];

  it('stored controlPoints outrank the easing NAME: linear+cp badges BEZ, not LIN', () => {
    const { container } = render(<TemporalGraphPanel keyframes={pair2({ bezierControlPoints: [0.42, 0, 1, 1] })} mode="value" />);
    const badge = container.querySelectorAll('.temporal-graph-segment-badge')[0];
    expect(badge.getAttribute('data-segment-easing')).toBe('cubic_bezier');
    expect(badge.textContent).toBe('BEZ');
  });

  it('autoBezier badges AUTO (derived control points, named fallback impossible)', () => {
    const { container } = render(<TemporalGraphPanel keyframes={pair2({ easing: 'autoBezier' })} mode="value" />);
    const badge = container.querySelectorAll('.temporal-graph-segment-badge')[0];
    expect(badge.textContent).toBe('AUTO');
  });

  it('a complete pair outranks stored controlPoints', () => {
    const keys: PropertyKeyframe[] = [
      { id: 'a', frame: 0, value: 0, easing: 'linear', bezierControlPoints: [0.42, 0, 1, 1], bezierOut: { x: 0.2, y: 0.8 } },
      { id: 'b', frame: 10, value: 100, easing: 'linear', bezierIn: { x: 0.8, y: 0.2 } },
    ];
    const { container } = render(<TemporalGraphPanel keyframes={keys} mode="value" />);
    expect(container.querySelectorAll('.temporal-graph-segment-badge')[0].getAttribute('data-segment-easing')).toBe('bezier');
  });

  it('the segment truth is exposed to assistive tech on the badge itself', () => {
    const { container } = render(<TemporalGraphPanel keyframes={pair2({})} mode="value" />);
    const badge = container.querySelectorAll('.temporal-graph-segment-badge')[0];
    expect(badge.getAttribute('role')).toBe('img');
    expect(badge.getAttribute('aria-label')).toBe('Segment frame 0 to 10: LIN');
  });

  it('classifier agrees with the evaluator branch order behaviorally', async () => {
    const { applyEasing, effectiveSegmentAuthority } = await import('../utils/defaults');
    const cp: [number, number, number, number] = [0.42, 0, 1, 1];
    const out = { x: 0.2, y: 0.8 };
    const inH = { x: 0.8, y: 0.2 };
    // hold wins over everything: eased value 0 regardless of pair/cp
    expect(applyEasing(0.5, 'hold', cp, { in: inH, out })).toBe(0);
    expect(effectiveSegmentAuthority({ easing: 'hold', bezierControlPoints: cp, bezierOut: out }, { bezierIn: inH })).toBe('hold');
    // pair outranks cp: output equals the pair's solve, not the cp's
    const viaPair = applyEasing(0.5, 'linear', cp, { in: inH, out });
    expect(viaPair).toBe(applyEasing(0.5, 'linear', undefined, { in: inH, out }));
    expect(effectiveSegmentAuthority({ easing: 'linear', bezierControlPoints: cp, bezierOut: out }, { bezierIn: inH })).toBe('handles');
    // cp outranks the named branch: a 'linear' key with cp does NOT ease linearly
    expect(applyEasing(0.5, 'linear', cp)).not.toBe(0.5);
    expect(effectiveSegmentAuthority({ easing: 'linear', bezierControlPoints: cp }, {})).toBe('controlPoints');
    expect(effectiveSegmentAuthority({ easing: 'easeInOut' }, {})).toBe('named');
  });
});
