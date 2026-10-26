/**
 * WP-03 — mask creation and path edits through the real provider: a drawn
 * mask is ONE undoable write with a collision-safe ID; Escape cancels a draw
 * with no mutation; Delete/Backspace never reach the owner layer; vertex
 * removal respects the animated-topology guard; whole-path transforms go
 * through the existing path writer (key at the playhead when animated).
 */
import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { EditorContextMenuProvider } from '../context/EditorContextMenuContext';
import { DetailsPanel } from '../components/Inspector/DetailsPanel';
import { StageCanvas } from '../components/Canvas/StageCanvas';
import type { CharacterPart, LayerMask, Track } from '../types/animator';
import { layerMaskPathChannel } from '../types/animator';
import { createEllipseMaskPath, createRectangleMaskPath, transformMaskPathInLayerSpace } from '../utils/maskPathCreation';
import { resolveChannelAnimationState } from '../utils/timelineMetrics';

const rect = createRectangleMaskPath('normalized', { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 });
const mask = (overrides: Partial<LayerMask> = {}): LayerMask => ({ id: 'mask-2', name: 'Imported', mode: 'add', enabled: true, path: rect, ...overrides });

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

const seed = (h: ReturnType<typeof renderEditor>, masks: LayerMask[]) => {
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

const owner = (h: ReturnType<typeof renderEditor>, partId: string) => h.ctx().characterParts.find((part) => part.id === partId);
const key = (name: string, options: Record<string, unknown> = {}) => act(() => { fireEvent.keyDown(window, { key: name, ...options }); });

describe('WP-03 mask creation flow', () => {
  afterEach(() => cleanup());

  it('commits a drawn mask as one undoable write with a fresh ID, then edits it', () => {
    const h = renderEditor();
    const partId = seed(h, [mask()]);
    fireEvent.click(screen.getByRole('button', { name: 'Draw ellipse mask' }));
    expect(h.ctx().maskDrawSession).toEqual({ ownerPartId: partId, shape: 'ellipse' });
    expect(screen.getByRole('button', { name: 'Draw ellipse mask', pressed: true })).toBeTruthy();
    expect(h.container.querySelector('[data-testid="mask-draw-overlay"]')).not.toBeNull();
    const partsBefore = structuredClone(h.ctx().characterParts);

    let id: string | null = null;
    act(() => { id = h.ctx().commitMaskDraw(createEllipseMaskPath('normalized', { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 })); });
    expect(id).toBe('mask-3');
    expect(owner(h, partId)!.masks!.map((candidate) => candidate.id)).toEqual(['mask-2', 'mask-3']);
    expect(owner(h, partId)!.masks![1]).toMatchObject({ name: 'Ellipse Mask 2', mode: 'add', enabled: true });
    expect(h.ctx().maskDrawSession).toBeNull();
    expect(h.ctx().maskEditTarget).toEqual({ ownerPartId: partId, maskId: 'mask-3' });

    act(() => { h.ctx().undo(); });
    expect(h.ctx().characterParts).toEqual(partsBefore);
    expect(h.ctx().maskEditTarget).toBeNull();
  });

  it('cancels a draw with Escape and never deletes the owner on Backspace', () => {
    const h = renderEditor();
    const partId = seed(h, [mask()]);
    const partsBefore = structuredClone(h.ctx().characterParts);
    fireEvent.click(screen.getByRole('button', { name: 'Draw pen mask' }));
    (document.activeElement as HTMLElement | null)?.blur();
    key('Backspace');
    key('Delete');
    expect(owner(h, partId)).toBeDefined();
    key('Escape');
    expect(h.ctx().maskDrawSession).toBeNull();
    expect(h.ctx().characterParts).toEqual(partsBefore);
    expect(h.ctx().selectedPartId).toBe(partId);
  });

  it('deletes the selected vertex of a static path, refuses below three points and on an animated path', () => {
    const h = renderEditor();
    const partId = seed(h, [mask()]);
    act(() => { h.ctx().enterMaskEditing(partId, 'mask-2'); });
    act(() => { h.ctx().setMaskVertexIndex(1); });
    (document.activeElement as HTMLElement | null)?.blur();
    key('Delete');
    expect(owner(h, partId)!.masks![0].path.points.map((point) => point.id)).toEqual(['vertex-0', 'vertex-2', 'vertex-3']);
    act(() => { h.ctx().setMaskVertexIndex(0); });
    key('Delete');
    expect(owner(h, partId)!.masks![0].path.points).toHaveLength(3);

    // Animated in another sequence: topology is locked, nothing is written.
    act(() => {
      h.ctx().setTracks((prev: Track[]) => prev.map((track) => track.partId === partId
        ? { ...track, maskPathChannels: { [layerMaskPathChannel('mask-2')]: [{ id: 'k', frame: 5, value: rect, easing: 'linear', templateId: 'Intro' }] } }
        : track));
    });
    const before = structuredClone(owner(h, partId)!.masks);
    act(() => { h.ctx().setMaskVertexIndex(0); });
    key('Delete');
    expect(owner(h, partId)!.masks).toEqual(before);
    expect(owner(h, partId)).toBeDefined();
  });

  it('arms a mask path at the playhead and disarms it keeping the displayed path (arm/disarm parity)', () => {
    const h = renderEditor();
    const partId = seed(h, [mask()]);
    const channel = layerMaskPathChannel('mask-2');
    const trackId = h.ctx().tracks.find((track) => track.partId === partId)!.id;
    const pathTrack = () => h.ctx().tracks.find((track) => track.id === trackId)!;
    expect(resolveChannelAnimationState(pathTrack(), channel, 0, 'Sequence')).toBe('off');

    act(() => { h.ctx().armChannel(trackId, channel); });
    expect(pathTrack().maskPathChannels![channel]).toEqual([expect.objectContaining({ frame: 0, value: rect, templateId: 'Sequence' })]);
    expect(resolveChannelAnimationState(pathTrack(), channel, 0, 'Sequence')).toBe('keyed');
    expect(resolveChannelAnimationState(pathTrack(), channel, 5, 'Sequence')).toBe('animated');
    // Arming twice never duplicates or re-initialises.
    act(() => { h.ctx().armChannel(trackId, channel); });
    expect(pathTrack().maskPathChannels![channel]).toHaveLength(1);

    const moved = transformMaskPathInLayerSpace(rect, owner(h, partId)!, { rotation: 30 });
    act(() => { h.ctx().setCurrentFrame(20); });
    act(() => { h.ctx().authorMaskPath(partId, 'mask-2', moved); });
    act(() => { h.ctx().setCurrentFrame(20); });
    act(() => { h.ctx().disableChannelAnimation(trackId, channel); });
    expect(pathTrack().maskPathChannels![channel]).toEqual([]);
    expect(owner(h, partId)!.masks![0].path).toEqual(moved);
  });
});
