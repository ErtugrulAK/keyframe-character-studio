/**
 * C2 — while an unfinished drawing owns Undo/Redo, the editor's Undo/Redo
 * commands (keyboard and the exposed context command) act on the draft only;
 * releasing ownership hands them back to scene history. Text fields keep their
 * own Undo.
 */
import { useEffect } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

const renderProvider = () => {
  let live: AnimatorContextType | null = null;
  const view = render(<AnimatorProvider><Consumer onCtx={(context) => { live = context; }} /><input aria-label="Name" /></AnimatorProvider>);
  return { ...view, ctx: () => live! };
};

describe('C2 draft history ownership', () => {
  afterEach(() => cleanup());

  it('routes Undo/Redo to the open draft and never to scene history', () => {
    const h = renderProvider();
    act(() => { h.ctx().addCustomPart('custom_rect', 'Finished'); });
    const partsWithShape = structuredClone(h.ctx().characterParts);
    const draft = { undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: true };
    act(() => { h.ctx().registerDraftHistory(draft); });

    // Even with nothing left to undo in the draft, Undo stays with the draft.
    act(() => { fireEvent.keyDown(window, { key: 'z', ctrlKey: true }); });
    act(() => { fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true }); });
    act(() => { h.ctx().undo(); });
    expect(draft.undo).toHaveBeenCalledTimes(2);
    expect(draft.redo).toHaveBeenCalledTimes(1);
    expect(h.ctx().characterParts).toEqual(partsWithShape);
    // The buttons read the draft's own availability.
    expect(h.ctx().canUndo).toBe(false);
    expect(h.ctx().canRedo).toBe(true);

    act(() => { h.ctx().registerDraftHistory(null); });
    act(() => { fireEvent.keyDown(window, { key: 'z', ctrlKey: true }); });
    expect(h.ctx().characterParts.some((part) => part.name === 'Finished')).toBe(false);
  });

  it('leaves Undo to a focused text field', () => {
    const h = renderProvider();
    const draft = { undo: vi.fn(), redo: vi.fn(), canUndo: true, canRedo: false };
    act(() => { h.ctx().registerDraftHistory(draft); });
    const input = h.getByLabelText('Name');
    input.focus();
    act(() => { fireEvent.keyDown(input, { key: 'z', ctrlKey: true }); });
    expect(draft.undo).not.toHaveBeenCalled();
  });
});
