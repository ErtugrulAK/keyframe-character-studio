import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFreeformDraw, PEN_DRAG_THRESHOLD_PX } from '../hooks/useFreeformDraw';
import { addPenAnchor, dedupePenAnchors, dragPenTangent, offsetPenAnchors, penAnchorsToPath } from '../utils/geometry/penDraft';
import type { BezierPath } from '../types/animator';

/**
 * C6 — the Pen: a click is a corner, a press-and-drag is ONE smooth point whose
 * tangent follows the pointer (never a rain of points), the release ends that
 * point, and "place + drag its tangent" is one draft undo step.
 */

/** Client px map 1:1 onto stage units, so distances read directly. */
const setup = () => {
  const onComplete = vi.fn<(path: BezierPath, reason: string) => void>();
  const hook = renderHook(() => useFreeformDraw({
    enabled: true,
    getStagePoint: (x, y) => ({ x, y }),
    onComplete,
  }));
  return { ...hook, onComplete };
};
type Result = ReturnType<typeof setup>['result'];

const move = (x: number, y: number) => act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y })); });
const up = (x: number, y: number) => act(() => { window.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y, button: 0 })); });
const click = (result: Result, x: number, y: number) => {
  act(() => result.current.beginDraw(x, y));
  up(x, y);
};
/** Press at (x, y), drag through several moves to (tx, ty), release. */
const drag = (result: Result, x: number, y: number, tx: number, ty: number, steps = 12) => {
  act(() => result.current.beginDraw(x, y));
  for (let step = 1; step <= steps; step += 1) move(x + ((tx - x) * step) / steps, y + ((ty - y) * step) / steps);
  up(tx, ty);
};

describe('C6 Pen — click vs drag', () => {
  it('a click places a corner point without handles', () => {
    const { result } = setup();
    click(result, 10, 10);
    expect(result.current.points).toEqual([{ x: 10, y: 10 }]);
  });

  it('a press-and-drag places ONE point and pulls its mirrored tangent', () => {
    const { result } = setup();
    click(result, 0, 0);
    drag(result, 100, 0, 140, 30);
    expect(result.current.points).toHaveLength(2);
    expect(result.current.points[1]).toEqual({ x: 100, y: 0, handleOut: { x: 140, y: 30 }, handleIn: { x: 60, y: -30 } });
  });

  it('moving the mouse while pressed never adds points; the next press is a new point', () => {
    const { result } = setup();
    drag(result, 0, 0, 200, 200, 40);
    expect(result.current.points).toHaveLength(1);
    click(result, 300, 0);
    expect(result.current.points).toHaveLength(2);
    // Hovering after the release adds nothing either.
    move(350, 50);
    move(400, 80);
    expect(result.current.points).toHaveLength(2);
  });

  it('a jitter under the drag threshold stays a corner', () => {
    const { result } = setup();
    act(() => result.current.beginDraw(50, 50));
    move(50 + PEN_DRAG_THRESHOLD_PX - 1, 50);
    up(50 + PEN_DRAG_THRESHOLD_PX - 1, 50);
    expect(result.current.points).toEqual([{ x: 50, y: 50 }]);
  });

  it('placing a point and dragging its tangent is ONE undo step; redo restores both', () => {
    const { result } = setup();
    click(result, 0, 0);
    drag(result, 100, 0, 150, 20);
    expect(result.current.canUndoDraft).toBe(true);
    act(() => result.current.undoDraft());
    expect(result.current.points).toEqual([{ x: 0, y: 0 }]);
    act(() => result.current.redoDraft());
    expect(result.current.points[1]).toMatchObject({ x: 100, y: 0, handleOut: { x: 150, y: 20 } });
    act(() => result.current.undoDraft());
    act(() => result.current.undoDraft());
    expect(result.current.points).toEqual([]);
  });

  it('a press on the first point closes and finishes; the path keeps corners and smooth points', () => {
    const { result, onComplete } = setup();
    click(result, 0, 0);
    drag(result, 100, 0, 120, 40);
    click(result, 100, 100);
    click(result, 0, 0); // the first point
    expect(onComplete).toHaveBeenCalledTimes(1);
    const [path, reason] = onComplete.mock.calls[0];
    expect(reason).toBe('finish');
    expect(path.closed).toBe(true);
    expect(path.points.map((point) => point.kind)).toEqual(['corner', 'smooth', 'corner']);
    expect(path.points[1]).toMatchObject({ handleIn: { x: 80, y: -40 }, handleOut: { x: 120, y: 40 } });
    expect(result.current.isDrawing).toBe(false);
  });

  it('dragging the closing press shapes the first point\'s tangent', () => {
    const { result, onComplete } = setup();
    click(result, 0, 0);
    click(result, 100, 0);
    click(result, 100, 100);
    drag(result, 0, 0, -30, 20);
    const [path] = onComplete.mock.calls[0];
    expect(path.points[0]).toMatchObject({ kind: 'smooth', handleOut: { x: -30, y: 20 }, handleIn: { x: 30, y: -20 } });
  });

  it('the second press of a double-click adds nothing; Enter finishes', () => {
    const { result, onComplete } = setup();
    click(result, 0, 0);
    click(result, 100, 0);
    click(result, 100, 100);
    click(result, 101, 100);
    expect(result.current.points).toHaveLength(3);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('only a stage press starts a point (C3 rule kept)', () => {
    const { result } = setup();
    click(result, 10, 10);
    up(400, 5); // a release that did not begin on the stage
    act(() => { window.dispatchEvent(new MouseEvent('mouseup', { clientX: 60, clientY: 60, button: 2 })); });
    expect(result.current.points).toHaveLength(1);
  });
});

describe('C6 Pen — draft helpers', () => {
  it('builds a canonical path and re-centres handles with their anchors', () => {
    const anchors = dragPenTangent(addPenAnchor(addPenAnchor([], { x: 10, y: 10 }), { x: 50, y: 10 }), 1, { x: 60, y: 20 });
    const centred = offsetPenAnchors(anchors, 30, 10);
    expect(centred[1]).toEqual({ x: 20, y: 0, handleOut: { x: 30, y: 10 }, handleIn: { x: 10, y: -10 } });
    const path = penAnchorsToPath(centred, 'local', true);
    expect(path.points.map((point) => point.id)).toEqual(['vertex-0', 'vertex-1']);
    expect(path.points[1].kind).toBe('smooth');
  });

  it('a tangent dragged back onto its anchor makes it a corner again', () => {
    const anchors = dragPenTangent([{ x: 0, y: 0, handleOut: { x: 5, y: 5 }, handleIn: { x: -5, y: -5 } }], 0, { x: 0, y: 0 });
    expect(anchors[0]).toEqual({ x: 0, y: 0 });
  });

  it('dedupes only exact repeated corners', () => {
    expect(dedupePenAnchors([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }])).toHaveLength(2);
  });
});
