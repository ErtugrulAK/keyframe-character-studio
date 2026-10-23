/**
 * C7 — the Inspector's Details tabs (Radix Tabs): Properties, Masks, Layer.
 * Each section lives on exactly one tab, the Masks tab says how many masks or
 * mattes the layer uses, a group container (no geometry) has no Masks tab, and
 * a mask session started elsewhere (e.g. from the canvas) opens the Masks tab,
 * where its controls are.
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
const mask = (id: string): LayerMask => ({ id, name: `Mask ${id}`, mode: 'add', enabled: true, path });

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

const renderDetails = () => {
  let live: AnimatorContextType | null = null;
  const view = render(
    <AnimatorProvider>
      <EditorContextMenuProvider>
        <Consumer onCtx={(context) => { live = context; }} />
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

const addLayer = (h: ReturnType<typeof renderDetails>, extra: Partial<CharacterPart> = {}): string => {
  const before = new Set(h.ctx().characterParts.map((part) => part.id));
  act(() => { h.ctx().addCustomPart('custom_rect', 'Owner'); });
  const partId = h.ctx().characterParts.find((part) => !before.has(part.id))!.id;
  act(() => {
    h.ctx().setCharacterParts((prev: CharacterPart[]) => prev.map((part) => (part.id === partId ? { ...part, ...extra } : part)));
  });
  act(() => { h.ctx().setSelectedPartId(partId); h.ctx().setSelectedPartIds([partId]); });
  return partId;
};

const tab = (name: RegExp) => screen.getByRole('tab', { name });
const cardTitles = () => [...document.querySelectorAll('[role="tabpanel"] .inspector-section-title')].map((node) => node.textContent);

describe('C7 Details tabs', () => {
  afterEach(() => cleanup());

  it('puts every section on exactly one tab', () => {
    const h = renderDetails();
    addLayer(h, { masks: [mask('m1')] });

    expect(screen.getAllByRole('tab').map((node) => node.textContent)).toEqual(['Properties', 'Masks1', 'Layer']);
    act(() => { fireEvent.mouseDown(tab(/^Properties/)); });
    expect(tab(/^Properties/).getAttribute('aria-selected')).toBe('true');
    const properties = cardTitles();
    expect(properties).toContain('TRANSFORM');
    expect(properties).not.toContain('LAYER MASKS');
    expect(properties).not.toContain('TRACK MATTE');
    expect(properties).not.toContain('HIERARCHY');
    expect(properties).not.toContain('ANIMATION DATA');

    act(() => { fireEvent.mouseDown(tab(/^Masks/)); });
    expect(cardTitles()).toEqual(['LAYER MASKS', 'TRACK MATTE', 'LEGACY CLIP MATTE']);

    act(() => { fireEvent.mouseDown(tab(/^Layer/)); });
    expect(cardTitles()).toEqual(['HIERARCHY', 'ANIMATION DATA']);
    expect(screen.getByLabelText('Parent')).toBeTruthy();
  });

  it('counts the masks and mattes in use on the Masks tab, and shows no count when there are none', () => {
    const h = renderDetails();
    addLayer(h, { masks: [mask('m1'), mask('m2')] });
    expect(tab(/^Masks/).textContent).toBe('Masks2');

    addLayer(h);
    expect(tab(/^Masks/).textContent).toBe('Masks');
  });

  it('a group container has no Masks tab and falls back to Properties', () => {
    const h = renderDetails();
    addLayer(h, { masks: [mask('m1')] });
    act(() => { fireEvent.mouseDown(tab(/^Masks/)); });
    expect(tab(/^Masks/).getAttribute('aria-selected')).toBe('true');

    addLayer(h, { isGroup: true });
    expect(screen.queryByRole('tab', { name: /^Masks/ })).toBeNull();
    expect(tab(/^Properties/).getAttribute('aria-selected')).toBe('true');
  });

  it('a mask editing session started elsewhere opens the Masks tab', () => {
    const h = renderDetails();
    const partId = addLayer(h, { masks: [mask('m1')] });
    act(() => { fireEvent.mouseDown(tab(/^Layer/)); });
    expect(tab(/^Layer/).getAttribute('aria-selected')).toBe('true');

    act(() => { h.ctx().enterMaskEditing(partId, 'm1'); });
    expect(h.ctx().maskEditTarget).toEqual({ ownerPartId: partId, maskId: 'm1' });
    expect(tab(/^Masks/).getAttribute('aria-selected')).toBe('true');
    expect(cardTitles()).toContain('LAYER MASKS');
  });

  it('editing an effect-only mask keeps the Properties tab (its controls are in Color Correction)', () => {
    const h = renderDetails();
    const partId = addLayer(h, { masks: [{ ...mask('fx'), affectsAlpha: false }] });
    act(() => { fireEvent.mouseDown(tab(/^Properties/)); });
    act(() => { h.ctx().enterMaskEditing(partId, 'fx'); });
    expect(h.ctx().maskEditTarget).toEqual({ ownerPartId: partId, maskId: 'fx' });
    expect(tab(/^Properties/).getAttribute('aria-selected')).toBe('true');
  });

  it('switching tabs is UI only: no scene write, no history entry', () => {
    const h = renderDetails();
    addLayer(h, { masks: [mask('m1')] });
    const parts = h.ctx().characterParts;
    const tracks = h.ctx().tracks;
    const canUndo = h.ctx().canUndo;
    act(() => { fireEvent.mouseDown(tab(/^Masks/)); });
    act(() => { fireEvent.mouseDown(tab(/^Layer/)); });
    act(() => { fireEvent.mouseDown(tab(/^Properties/)); });
    expect(h.ctx().characterParts).toBe(parts);
    expect(h.ctx().tracks).toBe(tracks);
    expect(h.ctx().canUndo).toBe(canUndo);
  });
});
