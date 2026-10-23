/**
 * WP-01 — mask authoring follows the active sequence and the current frame.
 *
 * C-02: the Inspector shows the ACTIVE sequence's evaluated mask.
 * C-03: a mask scalar edited between two keys of the active sequence authors a
 *       key at the playhead; unchanged keyed scalars are never copied onto the
 *       base mask.
 * C-04: a new mask never reuses an ID held by the layer or by its track.
 * C-05: the mask path's "is animated" decision is scoped to the active sequence,
 *       and an exact-frame update keeps the key's easing and temporal handles.
 */

import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { DetailsPanel } from '../components/Inspector/DetailsPanel';
import { useTimeline } from '../hooks/useTimeline';
import type { BezierPath, CharacterPart, LayerMask, PathKeyframe, PropertyKeyframe, Track } from '../types/animator';
import { layerMaskChannel, layerMaskPathChannel } from '../types/animator';
import { authorPropertyValueAtFrameMutator } from '../utils/trackMutations';
import { layerMaskIdsReferencedByTrack, nextLayerMaskId } from '../utils/layerMasks';

const path = (x: number): BezierPath => ({
  version: 1,
  coordinateSpace: 'normalized',
  closed: true,
  points: [
    { x, y: 0.2 },
    { x: x + 0.4, y: 0.2 },
    { x: x + 0.4, y: 0.8 },
  ],
});

const mask = (overrides: Partial<LayerMask> = {}): LayerMask => ({
  id: 'm1',
  name: 'Mask 1',
  mode: 'add',
  enabled: true,
  feather: 2,
  opacity: 1,
  expansion: 0,
  path: path(0.1),
  ...overrides,
});

const key = (id: string, frame: number, value: number, templateId: string, extra: Partial<PropertyKeyframe> = {}): PropertyKeyframe => ({
  id, frame, value, easing: 'linear', templateId, ...extra,
});

describe('WP-01 pure helpers', () => {
  it('updates an exact-frame key in place and keeps its easing, handles and sequence', () => {
    const channel = layerMaskChannel('m1', 'feather');
    const exact = key('k10', 10, 4, 'Intro', { easing: 'easeIn', bezierIn: { x: 0.3, y: 0 }, bezierOut: { x: 0.7, y: 1 } });
    const tracks = [{ id: 't1', partId: 'a', maskChannels: { [channel]: [key('k0', 0, 0, 'Intro'), exact] } } as unknown as Track];

    const [next] = authorPropertyValueAtFrameMutator(tracks, 't1', channel, 10, 9, 'Intro');

    expect(next.maskChannels?.[channel]).toEqual([key('k0', 0, 0, 'Intro'), { ...exact, value: 9 }]);
  });

  it('inserts a key between keys with the sequence easing and leaves other sequences alone', () => {
    const channel = layerMaskChannel('m1', 'feather');
    const other = key('s0', 10, 77, 'Sequence', { easing: 'easeOut' });
    const tracks = [{
      id: 't1',
      partId: 'a',
      maskChannels: { [channel]: [key('k0', 0, 0, 'Intro', { easing: 'easeIn' }), other, key('k20', 20, 20, 'Intro')] },
    } as unknown as Track];

    const [next] = authorPropertyValueAtFrameMutator(tracks, 't1', channel, 10, 30, 'Intro');
    const keys = next.maskChannels?.[channel] ?? [];

    expect(keys).toContainEqual(other);
    const inserted = keys.filter((candidate) => candidate.frame === 10 && candidate.templateId === 'Intro');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ value: 30, easing: 'easeIn', templateId: 'Intro' });
  });

  it('allocates a mask ID that neither the layer nor its track uses', () => {
    expect(nextLayerMaskId([], [])).toBe('mask-1');
    // An imported layer whose only mask is `mask-2` (C-04).
    expect(nextLayerMaskId([mask({ id: 'mask-2' })], [])).toBe('mask-3');
    // A deleted mask's channels still on the track must not be inherited.
    expect(nextLayerMaskId([], ['mask-1'])).toBe('mask-2');
    expect(nextLayerMaskId([mask({ id: 'mask-1' })], ['mask-2', 'mask-3'])).toBe('mask-4');
  });

  it('reads the mask IDs referenced by scalar and path channels', () => {
    const track = {
      id: 't1',
      partId: 'a',
      maskChannels: { [layerMaskChannel('mask-1', 'opacity')]: [], [layerMaskChannel('my:mask', 'feather')]: [] },
      maskPathChannels: { [layerMaskPathChannel('mask-7')]: [] },
    } as unknown as Track;
    expect(layerMaskIdsReferencedByTrack(track).sort()).toEqual(['mask-1', 'mask-7', 'my:mask']);
    expect(layerMaskIdsReferencedByTrack(undefined)).toEqual([]);
  });
});

/** `useTimeline` with captured setters, so the written documents can be inspected. */
const renderTimeline = (parts: CharacterPart[], tracks: Track[], frame: number, sequence: string) => {
  const setCharacterParts = vi.fn();
  const setTracks = vi.fn();
  const { result } = renderHook(() => useTimeline({
    characterParts: parts,
    setCharacterParts,
    tracks,
    setTracks,
    tracksRef: { current: tracks },
    selectedPartId: 'a',
    setSelectedPartId: vi.fn(),
    selectedPartIds: ['a'],
    setSelectedPartIds: vi.fn(),
    selectedKeyframeId: null,
    selectedKeyframeIds: [],
    setSelectedKeyframeId: vi.fn(),
    currentFrame: frame,
    totalFrames: 60,
    activeTemplateId: sequence,
    getComputedTransform: vi.fn(() => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 })),
    showToast: vi.fn(),
  }));
  const apply = <T,>(setter: ReturnType<typeof vi.fn>, previous: T): T => {
    const calls = setter.mock.calls;
    return (calls[calls.length - 1][0] as (value: T) => T)(previous);
  };
  return { timeline: result.current, setCharacterParts, setTracks, apply };
};

const pathKey = (id: string, frame: number, x: number, templateId: string, extra: Partial<PathKeyframe> = {}): PathKeyframe => ({
  id, frame, value: path(x), easing: 'linear', templateId, ...extra,
});

const ownerPart = (masks: LayerMask[] = [mask()]): CharacterPart => ({
  id: 'a',
  name: 'Owner',
  type: 'custom_rect',
  zIndex: 1,
  width: 100,
  height: 100,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  masks,
});

describe('WP-01 authorMaskPath', () => {
  const channel = layerMaskPathChannel('m1');

  it('writes the base path when only ANOTHER sequence animates the mask path (C-05)', () => {
    const tracks = [{ id: 't1', partId: 'a', maskPathChannels: { [channel]: [pathKey('i0', 0, 0.3, 'Intro')] } } as unknown as Track];
    const parts = [ownerPart()];
    const h = renderTimeline(parts, tracks, 10, 'Sequence');

    act(() => h.timeline.authorMaskPath('a', 'm1', path(0.5)));

    expect(h.setTracks).not.toHaveBeenCalled();
    expect(h.apply(h.setCharacterParts, parts)[0].masks?.[0].path).toEqual(path(0.5));
  });

  it('inserts a key between keys of the active sequence with its easing', () => {
    const tracks = [{
      id: 't1',
      partId: 'a',
      maskPathChannels: { [channel]: [pathKey('i0', 0, 0.1, 'Intro', { easing: 'easeOut' }), pathKey('i20', 20, 0.3, 'Intro')] },
    } as unknown as Track];
    const h = renderTimeline([ownerPart()], tracks, 10, 'Intro');

    act(() => h.timeline.authorMaskPath('a', 'm1', path(0.5)));

    expect(h.setCharacterParts).not.toHaveBeenCalled();
    const keys = h.apply(h.setTracks, tracks)[0].maskPathChannels?.[channel] ?? [];
    expect(keys.map((candidate) => candidate.frame)).toEqual([0, 10, 20]);
    expect(keys[1]).toMatchObject({ value: path(0.5), easing: 'easeOut', templateId: 'Intro' });
  });

  it('updates an exact-frame key without dropping its easing or temporal handles', () => {
    const exact = pathKey('i10', 10, 0.2, 'Intro', { easing: 'hold', bezierIn: { x: 0.2, y: 0 }, bezierOut: { x: 0.8, y: 1 } });
    const tracks = [{ id: 't1', partId: 'a', maskPathChannels: { [channel]: [pathKey('i0', 0, 0.1, 'Intro'), exact] } } as unknown as Track];
    const h = renderTimeline([ownerPart()], tracks, 10, 'Intro');

    act(() => h.timeline.authorMaskPath('a', 'm1', path(0.6)));

    const keys = h.apply(h.setTracks, tracks)[0].maskPathChannels?.[channel] ?? [];
    expect(keys[1]).toEqual({ ...exact, value: path(0.6) });
  });

  it('is a no-op for a deleted mask or a missing owner', () => {
    const tracks = [{ id: 't1', partId: 'a', maskPathChannels: { [channel]: [pathKey('i0', 0, 0.1, 'Sequence')] } } as unknown as Track];
    const h = renderTimeline([ownerPart([])], tracks, 10, 'Sequence');

    act(() => {
      h.timeline.authorMaskPath('a', 'm1', path(0.6));
      h.timeline.authorMaskPath('missing', 'm1', path(0.6));
    });

    expect(h.setTracks).not.toHaveBeenCalled();
    expect(h.setCharacterParts).not.toHaveBeenCalled();
  });
});

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

/** The real provider + Inspector, so routing, history and display are exercised together. */
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

/** Seeds one masked layer whose feather is keyed differently in two sequences. */
const seedTwoSequenceMask = (h: ReturnType<typeof renderInspector>) => {
  act(() => { h.ctx().addCustomPart('custom_rect', 'Owner'); });
  const partId = h.ctx().characterParts[h.ctx().characterParts.length - 1].id;
  act(() => { h.ctx().addMotionTemplate('Intro'); });
  const introId = h.ctx().activeTemplateId;
  const featherChannel = layerMaskChannel('m1', 'feather');
  const opacityChannel = layerMaskChannel('m1', 'opacity');
  act(() => {
    h.ctx().setCharacterParts((prev: CharacterPart[]) => prev.map((part) => part.id === partId ? { ...part, masks: [mask()] } : part));
    h.ctx().setTracks((prev: Track[]) => prev.map((track) => track.partId === partId
      ? {
        ...track,
        maskChannels: {
          [featherChannel]: [
            key('seq0', 0, 5, 'Sequence'),
            key('intro0', 0, 0, introId),
            key('intro20', 20, 40, introId),
          ],
          [opacityChannel]: [key('op0', 0, 0.2, introId), key('op20', 20, 1, introId)],
        },
      }
      : track));
  });
  act(() => { h.ctx().setSelectedPartId(partId); });
  // C7 — masks and mattes live on the Inspector's Masks tab (Radix activates on mouse-down).
  fireEvent.mouseDown(screen.getByRole('tab', { name: /^Masks/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Expand LAYER MASKS' }));
  return { partId, introId, featherChannel, opacityChannel };
};

describe('WP-01 Inspector integration', () => {
  afterEach(() => cleanup());

  it('shows the active sequence mask and authors a between-key edit as one undoable key (C-02, C-03)', () => {
    const h = renderInspector();
    const { partId, introId, featherChannel, opacityChannel } = seedTwoSequenceMask(h);
    act(() => { h.ctx().setCurrentFrame(10); });

    const feather = screen.getByLabelText('Mask feather') as HTMLInputElement;
    // Intro animates 0 → 40 over 0..20 (linear), so frame 10 reads 20, not the
    // default Sequence's 5.
    expect(Number(feather.value)).toBeCloseTo(20);

    const partsBefore = structuredClone(h.ctx().characterParts);
    const tracksBefore = structuredClone(h.ctx().tracks);

    fireEvent.change(feather, { target: { value: '30' } });

    const track = h.ctx().tracks.find((candidate) => candidate.partId === partId)!;
    const featherKeys = track.maskChannels?.[featherChannel] ?? [];
    expect(featherKeys.filter((candidate) => candidate.templateId === introId).map((candidate) => [candidate.frame, candidate.value]))
      .toEqual([[0, 0], [10, 30], [20, 40]]);
    expect(featherKeys.find((candidate) => candidate.id === 'seq0')).toEqual(key('seq0', 0, 5, 'Sequence'));
    // Unrelated keyed opacity is untouched and its evaluated value is NOT copied onto the base mask.
    expect(track.maskChannels?.[opacityChannel]).toEqual(tracksBefore.find((candidate) => candidate.partId === partId)!.maskChannels?.[opacityChannel]);
    const baseMask = h.ctx().characterParts.find((part) => part.id === partId)!.masks![0];
    expect(baseMask).toEqual(mask());
    expect(Number((screen.getByLabelText('Mask feather') as HTMLInputElement).value)).toBeCloseTo(30);

    act(() => { h.ctx().undo(); });
    expect(h.ctx().tracks).toEqual(tracksBefore);
    expect(h.ctx().characterParts).toEqual(partsBefore);

    act(() => { h.ctx().redo(); });
    const redone = h.ctx().tracks.find((candidate) => candidate.partId === partId)!;
    expect((redone.maskChannels?.[featherChannel] ?? []).some((candidate) => candidate.frame === 10 && candidate.value === 30)).toBe(true);
  });

  it('writes the base mask when the active sequence does not animate the scalar', () => {
    const h = renderInspector();
    const { partId, featherChannel } = seedTwoSequenceMask(h);
    act(() => { h.ctx().setActiveTemplateId('Sequence'); });
    act(() => { h.ctx().setCurrentFrame(10); });

    const expansion = screen.getByLabelText('Mask expansion') as HTMLInputElement;
    fireEvent.change(expansion, { target: { value: '6' } });

    const baseMask = h.ctx().characterParts.find((part) => part.id === partId)!.masks![0];
    expect(baseMask).toEqual(mask({ expansion: 6 }));
    // Sequence's feather key is untouched: only the edited property was written.
    const track = h.ctx().tracks.find((candidate) => candidate.partId === partId)!;
    expect(track.maskChannels?.[featherChannel]?.find((candidate) => candidate.id === 'seq0')?.value).toBe(5);
  });

  it('adds a mask with a fresh ID next to an imported mask-2', () => {
    const h = renderInspector();
    act(() => { h.ctx().addCustomPart('custom_rect', 'Imported'); });
    const partId = h.ctx().characterParts[h.ctx().characterParts.length - 1].id;
    act(() => {
      h.ctx().setCharacterParts((prev: CharacterPart[]) => prev.map((part) => part.id === partId ? { ...part, masks: [mask({ id: 'mask-2', name: 'Imported' })] } : part));
    });
    act(() => { h.ctx().setSelectedPartId(partId); });
    // C7 — masks and mattes live on the Inspector's Masks tab (Radix activates on mouse-down).
    fireEvent.mouseDown(screen.getByRole('tab', { name: /^Masks/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand LAYER MASKS' }));

    fireEvent.click(screen.getByRole('button', { name: 'Add mask' }));

    const ids = h.ctx().characterParts.find((part) => part.id === partId)!.masks!.map((candidate) => candidate.id);
    expect(ids).toEqual(['mask-2', 'mask-3']);
  });
});
