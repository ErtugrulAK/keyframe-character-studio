/**
 * WP-04 — Track Matte navigation through the real provider + Inspector:
 * Select Source / Back to Target are selection-only (no history entry), a
 * hidden source stays hidden (its relationship is never rewritten), and the
 * visibility conflict and legacy-preserved readings are shown.
 */
import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { DetailsPanel } from '../components/Inspector/DetailsPanel';
import type { CharacterPart } from '../types/animator';

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

const renderInspector = () => {
  let live: AnimatorContextType | null = null;
  const view = render(
    <AnimatorProvider>
      <Consumer onCtx={(context) => { live = context; }} />
      <DetailsPanel />
    </AnimatorProvider>,
  );
  const ctx = (): AnimatorContextType => {
    if (!live) throw new Error('provider context not captured yet');
    return live;
  };
  return { ...view, ctx };
};

const seed = (h: ReturnType<typeof renderInspector>) => {
  act(() => {
    h.ctx().addCustomPart('custom_rect', 'Landscape');
    h.ctx().addCustomPart('custom_circle', 'Circle');
    h.ctx().addCustomPart('custom_rect', 'Lower third');
  });
  const idOf = (name: string) => h.ctx().characterParts.find((part) => part.name === name)!.id;
  const [landscape, circle, lower] = [idOf('Landscape'), idOf('Circle'), idOf('Lower third')];
  act(() => {
    h.ctx().setCharacterParts((prev: CharacterPart[]) => prev.map((part) => {
      if (part.id === landscape) return { ...part, trackMatte: { sourceLayerId: circle, mode: 'alpha', sourceVisible: true }, matte: { sourcePartId: lower, mode: 'clip', feather: 3 } };
      if (part.id === lower) return { ...part, trackMatte: { sourceLayerId: circle, mode: 'luminance', sourceVisible: false } };
      return part;
    }));
  });
  act(() => { h.ctx().setSelectedPartId(landscape); h.ctx().setSelectedPartIds([landscape]); });
  // C7 — the Track Matte card lives on the Inspector's Masks tab (Radix activates on mouse-down).
  fireEvent.mouseDown(screen.getByRole('tab', { name: /^Masks/ }));
  return { landscape, circle, lower };
};

describe('WP-04 Track Matte navigation', () => {
  afterEach(() => cleanup());

  it('shows the effective source, the shared-visibility conflict and the preserved legacy settings', () => {
    const h = renderInspector();
    seed(h);
    const summary = screen.getByTestId('track-matte-summary');
    expect(summary.textContent).toContain('Matte source: Circle');
    expect(summary.textContent).toContain('Alpha');
    expect(screen.getByTestId('track-matte-visibility-conflict').textContent).toContain('Lower third');
    expect(summary.textContent).toContain('Legacy clip matte settings are preserved but inactive');
    // Product language only: no version names in the card titles.
    expect(screen.queryByRole('button', { name: /TRACK MATTE V2/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand TRACK MATTE' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Expand LEGACY CLIP MATTE' })).toBeTruthy();
  });

  it('selects the hidden source and returns to the target without touching scene data or history', () => {
    const h = renderInspector();
    const { landscape, circle } = seed(h);
    const partsBefore = structuredClone(h.ctx().characterParts);
    const tracksBefore = structuredClone(h.ctx().tracks);
    const couldUndo = h.ctx().canUndo;

    fireEvent.click(screen.getByRole('button', { name: 'Select Source' }));
    expect(h.ctx().selectedPartId).toBe(circle);
    expect(h.ctx().matteReturnTargetId).toBe(landscape);
    const targetsText = screen.getByTestId('track-matte-targets').textContent ?? '';
    expect(targetsText).toContain('Landscape');
    expect(targetsText).toContain('Lower third');

    fireEvent.click(screen.getByRole('button', { name: 'Back to Landscape' }));
    expect(h.ctx().selectedPartId).toBe(landscape);
    expect(h.ctx().matteReturnTargetId).toBeNull();

    expect(h.ctx().characterParts).toEqual(partsBefore);
    expect(h.ctx().tracks).toEqual(tracksBefore);
    expect(h.ctx().canUndo).toBe(couldUndo);
  });

  it('drops the return trail when the user selects something else, and reports a missing source after delete', () => {
    const h = renderInspector();
    const { landscape, circle, lower } = seed(h);
    fireEvent.click(screen.getByRole('button', { name: 'Select Source' }));
    act(() => { h.ctx().setSelectedPartId(lower); });
    expect(h.ctx().matteReturnTargetId).toBeNull();

    act(() => { h.ctx().deletePart(circle); });
    // C2: the source has dependents, so the delete waits for the user, naming them.
    expect(h.ctx().characterParts.some((part) => part.id === circle)).toBe(true);
    const dialog = screen.getByTestId('delete-dependents-dialog');
    expect(dialog.querySelector(`[data-dependent-id="${landscape}"]`)).not.toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(h.ctx().characterParts.some((part) => part.id === circle)).toBe(false);
    act(() => { h.ctx().setSelectedPartId(landscape); h.ctx().setSelectedPartIds([landscape]); });
    expect(screen.getByTestId('track-matte-summary').textContent).toContain('is missing');
    // The stored reference is kept for Undo.
    expect(h.ctx().characterParts.find((part) => part.id === landscape)!.trackMatte!.sourceLayerId).toBe(circle);
    act(() => { h.ctx().undo(); });
    expect(screen.getByTestId('track-matte-summary').textContent).toContain('Matte source: Circle');
  });
});
