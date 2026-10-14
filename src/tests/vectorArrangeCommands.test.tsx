import React, { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { AuthoringToolbar } from '../components/Toolbar/AuthoringToolbar';

/**
 * The vector authoring commands, driven through the real toolbar on the real
 * provider: what the strip writes is what the evaluator reads, a command is ONE
 * history entry, and a group moves as the one target it is.
 */

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

interface Harness {
  container: HTMLElement;
  ctx: () => AnimatorContextType;
  document: () => string;
  worldX: (id: string) => number;
}

const renderHarness = (): Harness => {
  let live: AnimatorContextType | null = null;
  const { container } = render(
    <AnimatorProvider>
      <Consumer onCtx={(context) => { live = context; }} />
      <AuthoringToolbar />
    </AnimatorProvider>,
  );
  const ctx = (): AnimatorContextType => {
    if (!live) throw new Error('provider context not captured yet');
    return live;
  };
  return {
    container,
    ctx,
    document: () => JSON.stringify({ parts: ctx().characterParts, tracks: ctx().tracks }),
    worldX: (id: string) => ctx().getComputedTransform(id, ctx().currentFrame).x,
  };
};

/**
 * Three rectangles, placed where the test needs them.
 *
 * `addCustomPart` prepends its layer AND its track, and it reads the track list
 * from its own render, so each layer is created in its own `act` — exactly how
 * the editor's own creation gesture runs it.
 */
const seed = (h: Harness, positions: Array<[number, number]>): string[] => {
  const ids: string[] = [];
  positions.forEach(([x, y], index) => {
    act(() => { h.ctx().addCustomPart('custom_rect', `Layer ${index}`); });
    const created = h.ctx().characterParts[0].id;
    ids.push(created);
    act(() => {
      h.ctx().setCharacterParts((previous) => previous.map((part) => (part.id === created
        ? { ...part, baseTransform: { ...part.baseTransform, x, y, rotation: 0, scaleX: 1, scaleY: 1 } }
        : part)));
    });
  });
  return ids;
};

const select = (h: Harness, ids: string[]) => {
  act(() => {
    h.ctx().setSelectedPartIds(ids);
    h.ctx().setSelectedPartId(ids[ids.length - 1] ?? null);
  });
};

/** Opens a command-set band and runs one of its items. */
const runFromMenu = (band: string, item: string) => {
  act(() => { fireEvent.click(screen.getByRole('button', { name: band, exact: true })); });
  const menu = screen.getByRole('menu', { name: band });
  act(() => { fireEvent.click(within(menu).getByRole('menuitem', { name: item })); });
};

describe('vector authoring commands', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('aligns two selected layers and records exactly one undoable command', () => {
    const h = renderHarness();
    const [a, b] = seed(h, [[0, 40], [200, 0]]);
    select(h, [a, b]);
    const before = h.document();

    runFromMenu('Align', 'Align left');
    expect(h.worldX(b)).toBeCloseTo(0, 6);
    const after = h.document();
    expect(after).not.toBe(before);

    // ONE entry: a single undo is back at the document the command started from.
    act(() => { h.ctx().undo(); });
    expect(h.document()).toBe(before);
    expect(h.worldX(b)).toBeCloseTo(200, 6);

    act(() => { h.ctx().redo(); });
    expect(h.document()).toBe(after);
    expect(h.worldX(b)).toBeCloseTo(0, 6);
  });

  it('distributes three selected layers, and keeps its trigger unavailable below three', () => {
    const h = renderHarness();
    const [a, b, c] = seed(h, [[0, 0], [40, 0], [400, 0]]);

    select(h, [a, b]);
    expect(screen.getByRole('button', { name: 'Distribute' })).toBeDisabled();

    select(h, [a, b, c]);
    expect(screen.getByRole('button', { name: 'Distribute' })).toBeEnabled();
    const before = h.document();

    runFromMenu('Distribute', 'Distribute horizontally');
    expect(h.worldX(b)).toBeCloseTo(200, 6);

    act(() => { h.ctx().undo(); });
    expect(h.document()).toBe(before);
  });

  it('rotates and flips through the same authority the keyboard commands use', () => {
    const h = renderHarness();
    const [a, b] = seed(h, [[0, 0], [200, 0]]);
    select(h, [a, b]);

    expect(screen.getByRole('button', { name: 'Rotate clockwise' })).toHaveAttribute('aria-keyshortcuts', 'Control+Shift+ArrowRight');
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Rotate clockwise' })); });
    expect(h.ctx().getComputedTransform(a, 0).rotation).toBeCloseTo(90, 6);
    // Pivot invariance: the pair turned about its own centre.
    expect(h.worldX(a)).toBeCloseTo(100, 6);
    expect(h.worldX(b)).toBeCloseTo(100, 6);

    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Flip horizontal' })); });
    expect(h.ctx().getComputedTransform(a, 0).scaleX).toBeCloseTo(-1, 6);
  });

  it('runs the transform commands from the keyboard, through the same write path', () => {
    const h = renderHarness();
    const [a] = seed(h, [[0, 0]]);
    select(h, [a]);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
    });
    expect(h.ctx().getComputedTransform(a, 0).rotation).toBeCloseTo(90, 6);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'V', shiftKey: true, bubbles: true, cancelable: true }));
    });
    expect(h.ctx().getComputedTransform(a, 0).scaleY).toBeCloseTo(-1, 6);

    // Two commands, two entries: undo walks them back one at a time.
    act(() => { h.ctx().undo(); });
    expect(h.ctx().getComputedTransform(a, 0).scaleY).toBeCloseTo(1, 6);
    expect(h.ctx().getComputedTransform(a, 0).rotation).toBeCloseTo(90, 6);
    act(() => { h.ctx().undo(); });
    expect(h.ctx().getComputedTransform(a, 0).rotation).toBeCloseTo(0, 6);
  });

  it('moves a group as one target and never writes its children twice', () => {
    const h = renderHarness();
    const [a, b, c] = seed(h, [[0, 0], [200, 0], [500, 0]]);

    select(h, [a, b]);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Group layers' })); });
    const group = h.ctx().selectedPartIds[0];
    expect(h.ctx().characterParts.find((part) => part.id === group)?.isGroup).toBe(true);

    select(h, [group, c]);
    const groupBefore = h.worldX(group);
    const childBefore = [a, b].map((id) => h.worldX(id));
    runFromMenu('Align', 'Align right');

    // The container moved, and BOTH children moved by exactly the same delta:
    // the group was addressed once, as the one target it is.
    const shift = h.worldX(group) - groupBefore;
    expect(shift).toBeCloseTo(300, 6);
    expect(h.worldX(a) - childBefore[0]).toBeCloseTo(shift, 6);
    expect(h.worldX(b) - childBefore[1]).toBeCloseTo(shift, 6);

    // ...and the aggregate box now agrees with the layer it aligned to.
    const groupRight = Math.max(...[a, b].map((id) => h.worldX(id) + 60));
    expect(groupRight).toBeCloseTo(h.worldX(c) + 60, 6);
  });

  it('leaves the document untouched when the selection cannot use a command', () => {
    const h = renderHarness();
    const [a] = seed(h, [[0, 0]]);
    select(h, []);
    const before = h.document();

    expect(screen.getByRole('button', { name: 'Align' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rotate clockwise' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Flip vertical' })).toBeDisabled();

    select(h, [a]);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Flip vertical' })); });
    expect(h.worldX(a)).toBeCloseTo(0, 6);
    // A flip is a real change, so the one layer command did record.
    expect(h.document()).not.toBe(before);
    act(() => { h.ctx().undo(); });
    expect(h.document()).toBe(before);
  });
});
