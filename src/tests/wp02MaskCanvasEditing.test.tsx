/**
 * WP-02 — canvas mask editing mode, wired through the real provider: entering
 * from the Inspector, the one-level Escape chain, target invalidation, and the
 * gesture cancellation seam (restores inside the batch → no history entry,
 * redo stack kept).
 */
import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { EditorContextMenuProvider } from '../context/EditorContextMenuContext';
import { DetailsPanel } from '../components/Inspector/DetailsPanel';
import { StageCanvas } from '../components/Canvas/StageCanvas';
import type { BezierPath, CharacterPart, LayerMask, Track } from '../types/animator';
import { layerMaskPathChannel } from '../types/animator';
import { translateMaskPath } from '../utils/geometry/maskPathEditing';

const path: BezierPath = {
  version: 1,
  coordinateSpace: 'normalized',
  closed: true,
  points: [{ id: 'a', x: 0.2, y: 0.2 }, { id: 'b', x: 0.8, y: 0.2 }, { id: 'c', x: 0.8, y: 0.8 }],
};
const mask = (overrides: Partial<LayerMask> = {}): LayerMask => ({ id: 'm1', name: 'Window', mode: 'add', enabled: true, path, ...overrides });

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

const renderEditor = () => {
  let live: AnimatorContextType | null = null;
  const view = render(
    <AnimatorProvider>
      <EditorContextMenuProvider>
        <Consumer onCtx={(context) => { live = context; }} />
        <StageCanvas />
        <DetailsPanel />
      </EditorContextMenuProvider>
    </AnimatorProvider>,
  );
  const ctx = (): AnimatorContextType => {
    if (!live) throw new Error('provider context not captured yet');
    return live;
  };
  return { ...view, ctx };
};

const seed = (h: ReturnType<typeof renderEditor>, masks: LayerMask[] = [mask()]) => {
  act(() => { h.ctx().addCustomPart('custom_rect', 'Owner'); });
  const partId = h.ctx().characterParts[h.ctx().characterParts.length - 1].id;
  act(() => {
    h.ctx().setCharacterParts((prev: CharacterPart[]) => prev.map((part) => part.id === partId ? { ...part, width: 200, height: 100, masks } : part));
  });
  act(() => { h.ctx().setSelectedPartId(partId); h.ctx().setSelectedPartIds([partId]); });
  // C7 — masks and mattes live on the Inspector's Masks tab (Radix activates on mouse-down).
  fireEvent.mouseDown(screen.getByRole('tab', { name: /^Masks/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Expand LAYER MASKS' }));
  return partId;
};

const overlay = (h: ReturnType<typeof renderEditor>) => h.container.querySelector('[data-testid="mask-path-overlay"]');
const escape = () => act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });

describe('WP-02 canvas mask editing mode', () => {
  afterEach(() => cleanup());

  it('enters from the Inspector, hides the layer gizmo, and Escape leaves one level', () => {
    const h = renderEditor();
    const partId = seed(h);
    expect(h.container.querySelector('[data-testid="transform-gizmo"]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit on Canvas' }));
    expect(h.ctx().maskEditTarget).toEqual({ ownerPartId: partId, maskId: 'm1' });
    expect(overlay(h)?.getAttribute('data-mask-id')).toBe('m1');
    expect(h.container.querySelector('[data-testid="transform-gizmo"]')).toBeNull();
    expect(screen.getByTestId('mask-edit-banner').textContent).toContain('Window');
    expect(screen.getByRole('button', { name: 'Exit Mask Editing', pressed: true })).toBeTruthy();

    // A gesture in flight takes the first Escape; the mode stays.
    let cancelled = 0;
    act(() => { h.ctx().registerMaskGestureCancel(() => { cancelled += 1; h.ctx().registerMaskGestureCancel(null); }); });
    escape();
    expect(cancelled).toBe(1);
    expect(h.ctx().maskEditTarget).not.toBeNull();

    // The next Escape leaves mask editing; the owner stays selected.
    escape();
    expect(h.ctx().maskEditTarget).toBeNull();
    expect(overlay(h)).toBeNull();
    expect(h.ctx().selectedPartId).toBe(partId);
    expect(h.container.querySelector('[data-testid="transform-gizmo"]')).not.toBeNull();
  });

  it('keeps Delete and Select All on the mask target: the owner layer is neither deleted nor deselected', () => {
    const h = renderEditor();
    const partId = seed(h);
    fireEvent.click(screen.getByRole('button', { name: 'Edit on Canvas' }));
    (document.activeElement as HTMLElement | null)?.blur();
    act(() => { fireEvent.keyDown(window, { key: 'Delete' }); });
    act(() => { fireEvent.keyDown(window, { key: 'a', ctrlKey: true }); });
    expect(h.ctx().characterParts.some((part) => part.id === partId)).toBe(true);
    expect(h.ctx().selectedPartIds).toEqual([partId]);
    expect(h.ctx().maskEditTarget).toEqual({ ownerPartId: partId, maskId: 'm1' });
    // Outside mask editing the same key deletes the layer as before.
    escape();
    act(() => { fireEvent.keyDown(window, { key: 'Delete' }); });
    expect(h.ctx().characterParts.some((part) => part.id === partId)).toBe(false);
  });

  it('drops the target when the owner is deleted or deselected, never retargeting another layer', () => {
    const h = renderEditor();
    const partId = seed(h);
    fireEvent.click(screen.getByRole('button', { name: 'Edit on Canvas' }));
    expect(h.ctx().maskEditTarget).not.toBeNull();

    act(() => { h.ctx().setSelectedPartId(null); });
    expect(h.ctx().maskEditTarget).toBeNull();
    act(() => { h.ctx().setSelectedPartId(partId); });
    // Re-selecting does not revive the dropped target.
    expect(h.ctx().maskEditTarget).toBeNull();

    act(() => { h.ctx().enterMaskEditing(partId, 'm1'); });
    expect(h.ctx().maskEditTarget).not.toBeNull();
    act(() => { h.ctx().deletePart(partId); });
    expect(h.ctx().maskEditTarget).toBeNull();
    expect(overlay(h)).toBeNull();
  });

  it('refuses a locked mask with a reason', () => {
    const h = renderEditor();
    const partId = seed(h, [mask({ locked: true })]);
    expect((screen.getByRole('button', { name: 'Edit on Canvas' }) as HTMLButtonElement).disabled).toBe(true);
    let refusal: string | null = null;
    act(() => { refusal = h.ctx().enterMaskEditing(partId, 'm1'); });
    expect(refusal).toMatch(/locked/i);
    expect(h.ctx().maskEditTarget).toBeNull();
  });

  it('cancels a between-key path gesture inside its batch: no history entry, redo kept', () => {
    const h = renderEditor();
    const partId = seed(h);
    const channel = layerMaskPathChannel('m1');
    act(() => {
      h.ctx().setTracks((prev: Track[]) => prev.map((track) => track.partId === partId
        ? {
          ...track,
          maskPathChannels: {
            [channel]: [
              { id: 'p0', frame: 0, value: path, easing: 'linear', templateId: 'Sequence' },
              { id: 'p20', frame: 20, value: translateMaskPath(path, { x: 0.1, y: 0 }), easing: 'linear', templateId: 'Sequence' },
            ],
          },
        }
        : track));
    });
    // An undoable edit, undone, leaves one redo step to protect.
    act(() => { h.ctx().setCharacterParts((prev: CharacterPart[]) => prev.map((part) => part.id === partId ? { ...part, name: 'Renamed' } : part)); });
    act(() => { h.ctx().undo(); });
    expect(h.ctx().canRedo).toBe(true);
    act(() => { h.ctx().setCurrentFrame(10); });
    const tracksBefore = structuredClone(h.ctx().tracks);
    const partsBefore = structuredClone(h.ctx().characterParts);

    act(() => { h.ctx().startBatchInteraction(); });
    const snapshot = h.ctx().captureMaskGestureSnapshot(partId);
    act(() => { h.ctx().authorMaskPath(partId, 'm1', translateMaskPath(path, { x: 0.3, y: 0.3 })); });
    // The drag preview inserted a key at frame 10.
    expect(h.ctx().tracks.find((track) => track.partId === partId)!.maskPathChannels![channel].map((key) => key.frame)).toEqual([0, 10, 20]);
    act(() => { h.ctx().cancelMaskGesture(snapshot); });

    expect(h.ctx().tracks).toEqual(tracksBefore);
    expect(h.ctx().characterParts).toEqual(partsBefore);
    expect(h.ctx().canRedo).toBe(true);
    act(() => { h.ctx().redo(); });
    expect(h.ctx().characterParts.find((part) => part.id === partId)!.name).toBe('Renamed');
  });

  it('commits one gesture as ONE undo entry that restores parts and tracks together', () => {
    const h = renderEditor();
    const partId = seed(h);
    const partsBefore = structuredClone(h.ctx().characterParts);
    const tracksBefore = structuredClone(h.ctx().tracks);

    act(() => { h.ctx().startBatchInteraction(); });
    for (let step = 1; step <= 5; step += 1) {
      act(() => { h.ctx().authorMaskPath(partId, 'm1', translateMaskPath(path, { x: step * 0.01, y: 0 })); });
    }
    act(() => { h.ctx().endBatchInteraction(); });
    expect(h.ctx().characterParts.find((part) => part.id === partId)!.masks![0].path.points[0].x).toBeCloseTo(0.25);
    // The owner layer's own transform never moved.
    expect(h.ctx().characterParts.find((part) => part.id === partId)!.baseTransform)
      .toEqual(partsBefore.find((part) => part.id === partId)!.baseTransform);

    act(() => { h.ctx().undo(); });
    expect(h.ctx().characterParts).toEqual(partsBefore);
    expect(h.ctx().tracks).toEqual(tracksBefore);
  });
});
