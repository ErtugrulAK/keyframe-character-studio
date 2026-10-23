import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFreeformDraw } from '../hooks/useFreeformDraw';

/** Client px map 1:1 onto stage units, so distances read directly. */
const setup = () => renderHook(() => useFreeformDraw({
  enabled: true,
  getStagePoint: (x, y) => ({ x, y }),
  onComplete: vi.fn(),
}));

const press = (result: ReturnType<typeof setup>['result'], x: number, y: number) => {
  act(() => result.current.beginDraw(x, y));
  act(() => { window.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y, button: 0 })); });
};

describe('C3 useFreeformDraw — only a stage press makes a vertex', () => {
  it('a click on the stage adds a point; a later window click elsewhere (toolbar, header) does not', () => {
    const { result } = setup();
    press(result, 10, 10);
    press(result, 100, 10);
    expect(result.current.points).toHaveLength(2);
    // A primary release that did not start with a stage press (beginDraw).
    act(() => { window.dispatchEvent(new MouseEvent('mouseup', { clientX: 400, clientY: 5, button: 0 })); });
    expect(result.current.points).toHaveLength(2);
  });

  it('a right or middle release (temporary pan) never adds a point', () => {
    const { result } = setup();
    press(result, 10, 10);
    act(() => { window.dispatchEvent(new MouseEvent('mouseup', { clientX: 60, clientY: 60, button: 2 })); });
    act(() => { window.dispatchEvent(new MouseEvent('mouseup', { clientX: 70, clientY: 70, button: 1 })); });
    expect(result.current.points).toHaveLength(1);
    // Drawing continues normally afterwards; undo/redo stay per click.
    press(result, 100, 10);
    expect(result.current.points).toHaveLength(2);
    act(() => result.current.undoDraft());
    expect(result.current.points).toHaveLength(1);
    act(() => result.current.redoDraft());
    expect(result.current.points).toHaveLength(2);
  });
});
