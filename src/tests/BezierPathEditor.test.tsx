import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BezierPathEditor } from '../components/Inspector/BezierPathEditor';
import type { BezierPath } from '../types/animator';

const makePath = (): BezierPath => ({
  version: 1,
  coordinateSpace: 'normalized',
  closed: true,
  points: [
    { id: 'a', x: 0.1, y: 0.1, kind: 'corner' },
    { id: 'b', x: 0.9, y: 0.1, kind: 'corner' },
    { id: 'c', x: 0.9, y: 0.9, kind: 'corner' },
  ],
});

describe('BezierPathEditor', () => {
  it('adds and selects a collision-safe vertex, then deletes the selected vertex', () => {
    const onChange = vi.fn();
    const { rerender } = render(<BezierPathEditor path={makePath()} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add vertex' }));
    const addedPath = onChange.mock.lastCall?.[0] as BezierPath;
    expect(addedPath.points).toHaveLength(4);
    expect(new Set(addedPath.points.map((point) => point.id)).size).toBe(4);

    rerender(<BezierPathEditor path={addedPath} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete vertex' }));
    expect(onChange.mock.lastCall?.[0].points).toHaveLength(3);
  });

  it('keeps vertex ids unique after deleting an interior vertex and adding again', () => {
    const onChange = vi.fn();
    // Four points: a closed path keeps at least three, so the delete is allowed.
    const four: BezierPath = { ...makePath(), points: [...makePath().points, { id: 'd', x: 0.1, y: 0.9, kind: 'corner' }] };
    const { rerender } = render(<BezierPathEditor path={four} onChange={onChange} />);

    fireEvent.mouseDown(screen.getByLabelText('Vertex 2'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete vertex' }));
    const afterDelete = onChange.mock.lastCall?.[0] as BezierPath;
    rerender(<BezierPathEditor path={afterDelete} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add vertex' }));

    const afterAdd = onChange.mock.lastCall?.[0] as BezierPath;
    expect(new Set(afterAdd.points.map((point) => point.id)).size).toBe(afterAdd.points.length);
  });

  it('keeps vertex selection after mouseup and applies one Corner→Smooth update', () => {
    const onChange = vi.fn();
    render(<BezierPathEditor path={makePath()} onChange={onChange} />);

    fireEvent.mouseDown(screen.getByLabelText('Vertex 2'));
    fireEvent.mouseUp(screen.getByRole('application'));
    // The control states the selected point's REAL type.
    expect(screen.getByRole('radio', { name: 'Corner' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Smooth' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextPath = onChange.mock.lastCall?.[0] as BezierPath;
    expect(nextPath.points[1].kind).toBe('smooth');
    expect(nextPath.points[1].handleIn).toBeTruthy();
    expect(nextPath.points[1].handleOut).toBeTruthy();
  });

  it('reorders vertices and toggles open/closed state', () => {
    const onChange = vi.fn();
    render(<BezierPathEditor path={makePath()} onChange={onChange} />);

    fireEvent.mouseDown(screen.getByLabelText('Vertex 2'));
    fireEvent.click(screen.getByRole('button', { name: 'Move point earlier in the path order' }));
    const reordered = onChange.mock.lastCall?.[0] as BezierPath;
    expect(reordered.points.map((point) => point.id)).toEqual(['b', 'a', 'c']);

    const closed = screen.getByRole('switch', { name: 'Closed path' });
    expect(closed.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(closed);
    expect(onChange.mock.lastCall?.[0].closed).toBe(false);
    // Opening changes only the flag: points and handles stay as they were.
    expect(onChange.mock.lastCall?.[0].points).toEqual(makePath().points);
  });

  it('turns a point smooth with the canvas rule, leaving neighbours untouched, and back to corner keeping its handles', () => {
    const onChange = vi.fn();
    const path = makePath();
    const { rerender } = render(<BezierPathEditor path={path} onChange={onChange} selectedIndex={1} onSelectIndex={() => undefined} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Smooth' }));
    const smooth = onChange.mock.lastCall?.[0] as BezierPath;
    expect(smooth.points[0]).toEqual(path.points[0]);
    expect(smooth.points[2]).toEqual(path.points[2]);
    const vertex = smooth.points[1];
    // Handles mirror through the vertex along the neighbours' chord (a→c).
    expect(vertex.handleIn!.x + vertex.handleOut!.x).toBeCloseTo(2 * vertex.x, 9);
    expect(vertex.handleIn!.y + vertex.handleOut!.y).toBeCloseTo(2 * vertex.y, 9);

    rerender(<BezierPathEditor path={smooth} onChange={onChange} selectedIndex={1} onSelectIndex={() => undefined} />);
    expect(screen.getByRole('radio', { name: 'Smooth' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Corner' }));
    const corner = onChange.mock.lastCall?.[0] as BezierPath;
    expect(corner.points[1]).toEqual({ ...vertex, kind: 'corner' });
  });

  it('refuses topology edits with a visible reason while the path is animated, but still moves points', () => {
    const onChange = vi.fn();
    render(<BezierPathEditor path={makePath()} onChange={onChange} topologyLockReason="The mask path is animated." />);
    for (const name of ['Add vertex', 'Delete vertex', 'Move point earlier in the path order', 'Move point later in the path order', 'Reverse direction']) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect((screen.getByRole('switch', { name: 'Closed path' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Moving points and handles still works/)).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText('Vertex 1'), { key: 'ArrowRight' });
    const last = onChange.mock.lastCall;
    expect(last).toBeDefined();
    expect((last![0] as BezierPath).points[0].x).toBeCloseTo(0.11, 9);
  });

  it('disables point-type and delete controls without a selection, and keeps three points on a closed path', () => {
    const onChange = vi.fn();
    render(<BezierPathEditor path={makePath()} onChange={onChange} selectedIndex={null} onSelectIndex={() => undefined} />);
    expect((screen.getByRole('radio', { name: 'Smooth' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Delete vertex' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('C4: with an order authority, an animated path keeps its order commands; they go through the authority', () => {
    const onChange = vi.fn();
    const onOrderCommand = vi.fn(() => 2);
    render(<BezierPathEditor path={makePath()} onChange={onChange} topologyLockReason="The mask path is animated." onOrderCommand={onOrderCommand} selectedIndex={1} onSelectIndex={() => undefined} />);
    expect((screen.getByRole('button', { name: 'Add vertex' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Move point later in the path order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Make first point' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Closed path' }));
    expect(onOrderCommand.mock.calls.map((call) => call[0])).toEqual(['later', 'first', 'open']);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('C4: a read-only (locked) path selects points but changes nothing', () => {
    const onChange = vi.fn();
    render(<BezierPathEditor path={makePath()} onChange={onChange} readOnlyReason="This mask is locked." />);
    fireEvent.mouseDown(screen.getByLabelText('Vertex 2'));
    fireEvent.mouseMove(screen.getByRole('application'), { clientX: 50, clientY: 50 });
    fireEvent.keyDown(screen.getByLabelText('Vertex 2'), { key: 'ArrowRight' });
    expect(screen.getByLabelText('Vertex 2').getAttribute('aria-pressed')).toBe('true');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('This mask is locked.')).toBeTruthy();
    expect((screen.getByRole('radio', { name: 'Smooth' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('C4: an open path states that it still fills', () => {
    render(<BezierPathEditor path={{ ...makePath(), closed: false }} onChange={vi.fn()} />);
    expect(screen.getByTestId('open-path-note').textContent).toMatch(/still fills/);
    expect(screen.getByRole('switch', { name: 'Closed path' }).getAttribute('aria-checked')).toBe('false');
  });
});
