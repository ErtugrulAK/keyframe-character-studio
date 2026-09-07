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
    const { rerender } = render(<BezierPathEditor path={makePath()} onChange={onChange} />);

    fireEvent.mouseDown(screen.getByLabelText('Vertex 2'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete vertex' }));
    const afterDelete = onChange.mock.lastCall?.[0] as BezierPath;
    rerender(<BezierPathEditor path={afterDelete} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add vertex' }));

    const afterAdd = onChange.mock.lastCall?.[0] as BezierPath;
    expect(new Set(afterAdd.points.map((point) => point.id)).size).toBe(afterAdd.points.length);
  });

  it('keeps vertex selection after mouseup and applies one smooth toggle update', () => {
    const onChange = vi.fn();
    render(<BezierPathEditor path={makePath()} onChange={onChange} />);

    fireEvent.mouseDown(screen.getByLabelText('Vertex 2'));
    fireEvent.mouseUp(screen.getByRole('application'));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle corner/smooth' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Move left' }));
    const reordered = onChange.mock.lastCall?.[0] as BezierPath;
    expect(reordered.points.map((point) => point.id)).toEqual(['b', 'a', 'c']);

    fireEvent.click(screen.getByRole('button', { name: 'Open path' }));
    expect(onChange.mock.lastCall?.[0].closed).toBe(false);
  });
});
