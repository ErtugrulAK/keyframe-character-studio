/**
 * C10 — the LAYER MASKS card after the QA clean-up: no Add mask, path lock,
 * path rotate/scale, Enabled or Cuts layer controls; MODE is one "Cut a hole"
 * box (subtract), and an older Intersect / Difference mask is named, not lost.
 */
import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { EditorContextMenuProvider } from '../context/EditorContextMenuContext';
import { DetailsPanel } from '../components/Inspector/DetailsPanel';
import type { BezierPath, CharacterPart, LayerMask } from '../types/animator';

const path: BezierPath = {
  version: 1,
  coordinateSpace: 'normalized',
  closed: true,
  points: [{ id: 'a', x: 0.2, y: 0.2 }, { id: 'b', x: 0.8, y: 0.2 }, { id: 'c', x: 0.8, y: 0.8 }],
};
const mask = (extra: Partial<LayerMask> = {}): LayerMask => ({ id: 'm1', name: 'Window', mode: 'add', enabled: true, path, ...extra });

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

const renderWithMask = (layerMask: LayerMask) => {
  let live: AnimatorContextType | null = null;
  render(
    <AnimatorProvider>
      <EditorContextMenuProvider>
        <Consumer onCtx={(context) => { live = context; }} />
        <DetailsPanel />
      </EditorContextMenuProvider>
    </AnimatorProvider>,
  );
  const ctx = (): AnimatorContextType => live!;
  const before = new Set(ctx().characterParts.map((part) => part.id));
  act(() => { ctx().addCustomPart('custom_rect', 'Owner'); });
  const partId = ctx().characterParts.find((part) => !before.has(part.id))!.id;
  act(() => {
    ctx().setCharacterParts((prev: CharacterPart[]) => prev.map((part) => (part.id === partId ? { ...part, masks: [layerMask] } : part)));
  });
  act(() => { ctx().setSelectedPartId(partId); ctx().setSelectedPartIds([partId]); });
  act(() => { fireEvent.mouseDown(screen.getByRole('tab', { name: /^Masks/ })); });
  fireEvent.click(screen.getByRole('button', { name: 'Expand LAYER MASKS' }));
  const savedMask = () => ctx().characterParts.find((part) => part.id === partId)!.masks![0];
  return { savedMask };
};

describe('C10 LAYER MASKS card', () => {
  afterEach(() => cleanup());

  it('offers none of the removed controls', () => {
    renderWithMask(mask());
    for (const name of ['Add mask', 'Lock path of Window', 'Rotate mask path 15 degrees clockwise', 'Scale mask path up 10 percent', 'Expand']) {
      expect(screen.queryByRole('button', { name }), name).toBeNull();
    }
    for (const name of ['Lock path', 'Enabled', 'Mask cuts the layer']) {
      expect(screen.queryByRole('checkbox', { name }), name).toBeNull();
    }
    expect(screen.queryByRole('combobox', { name: /mode/i })).toBeNull();
    // The row's own on/off switch stays.
    expect(screen.getByRole('button', { name: 'Enable Window' })).toBeTruthy();
  });

  it('"Cut a hole" switches the mask between add and subtract', () => {
    const { savedMask } = renderWithMask(mask());
    const hole = screen.getByRole('checkbox', { name: /Cut a hole/ }) as HTMLInputElement;
    expect(hole.checked).toBe(false);
    fireEvent.click(hole);
    expect(savedMask().mode).toBe('subtract');
    fireEvent.click(hole);
    expect(savedMask().mode).toBe('add');
  });

  it('keeps and names an older Intersect mask until the box replaces it; a saved lock can be unlocked', () => {
    const { savedMask } = renderWithMask(mask({ mode: 'intersect', locked: true }));
    expect(savedMask().mode).toBe('intersect');
    expect(screen.getByText(/From an older project: Intersect/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock path of Window' }));
    expect(savedMask().locked).toBe(false);
    expect(screen.queryByRole('button', { name: 'Unlock path of Window' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /Cut a hole/ }));
    expect(savedMask().mode).toBe('subtract');
  });
});
