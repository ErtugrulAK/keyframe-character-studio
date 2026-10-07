/**
 * B-01…B-04 — bonded layer movement correctness.
 *
 * One explicit contract: `updateCurrentTransform` takes WORLD x/y and converts
 * every written part to its own container-local space, then propagates the same
 * world delta to bonded partners exactly once. The engine under test is the real
 * `evaluateTransform` hierarchy resolver, not a hand-rolled world model.
 */

import { renderHook, act } from '@testing-library/react';
import type React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { useInspector } from '../hooks/useInspector';
import { evaluateTransform } from '../utils/evaluateTransform';
import { makeEmptyChannels } from '../utils/defaults';
import type { CharacterPart, Track, Transform, TrackChannel, PropertyKeyframe } from '../types/animator';

const base = (over: Partial<Transform> = {}): Transform =>
  ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, ...over });

const part = (id: string, over: Partial<CharacterPart> = {}): CharacterPart => ({
  id, name: id, type: 'custom_box', zIndex: 1,
  fillColor: '#fff', strokeColor: '#000', pivot: { x: 0, y: 0 },
  baseTransform: base(),
  ...over,
} as CharacterPart);

const track = (partId: string, channels?: Partial<Record<TrackChannel, PropertyKeyframe[]>>): Track => ({
  id: `track_${partId}`, partId, name: partId, color: '#f00', keyframes: [],
  channels: { ...makeEmptyChannels(), ...(channels ?? {}) },
  visible: true, locked: false,
});

const pk = (id: string, frame: number, value: number): PropertyKeyframe =>
  ({ id, frame, value, easing: 'linear', templateId: 'Sequence' } as PropertyKeyframe);

const bind = (partners: string[]): Partial<CharacterPart> => ({ boundPartIds: partners });

/**
 * Mirrors React's batching: the state updaters are queued and composed after
 * the act, while `getComputedTransform` keeps reading the pre-update snapshot.
 */
function harness(initialParts: CharacterPart[], initialTracks: Track[], selected: string[], primary: string, frame = 0) {
  let parts = initialParts;
  let tracks = initialTracks;
  const partUpdaters: Array<(prev: CharacterPart[]) => CharacterPart[]> = [];
  const trackUpdaters: Array<(prev: Track[]) => Track[]> = [];

  const { result } = renderHook(() => useInspector({
    selectedPartId: primary,
    selectedPartIds: selected,
    activeTemplateId: 'Sequence',
    currentFrame: frame,
    tracks,
    characterParts: parts,
    setTracks: (update: React.SetStateAction<Track[]>) => { trackUpdaters.push(update as (prev: Track[]) => Track[]); },
    setCharacterParts: (update: React.SetStateAction<CharacterPart[]>) => { partUpdaters.push(update as (prev: CharacterPart[]) => CharacterPart[]); },
    getComputedTransform: (id: string, f: number) => evaluateTransform(parts, tracks, 'Sequence', id, f),
    addKeyframeToTrack: vi.fn(),
  }));

  const commit = () => {
    for (const update of partUpdaters) parts = update(parts);
    for (const update of trackUpdaters) tracks = update(tracks);
    partUpdaters.length = 0;
    trackUpdaters.length = 0;
  };
  const world = (id: string) => evaluateTransform(parts, tracks, 'Sequence', id, frame);
  return { result, commit, world, currentParts: () => parts, currentTracks: () => tracks };
}

describe('B-01 — Stage drag of a parented bonded layer uses world delta', () => {
  it('moves the source to the requested world position and the buddy by the same delta', () => {
    const parts = [
      part('p', { baseTransform: base({ x: 100 }) }),
      part('child', { parentId: 'p', baseTransform: base({ x: 20 }), ...bind(['buddy']) }),
      part('buddy', { baseTransform: base({ x: 300 }), ...bind(['child']) }),
    ];
    const h = harness(parts, [track('p'), track('child'), track('buddy')], ['child'], 'child');

    expect(h.world('child').x).toBe(120);
    expect(h.world('buddy').x).toBe(300);

    // Stage passes the WORLD target (initial world 120 + delta 10).
    act(() => h.result.current.updateCurrentTransform({ x: 130 }));
    h.commit();

    expect(h.world('child').x).toBeCloseTo(130, 5);
    expect(h.world('buddy').x).toBeCloseTo(310, 5);
  });

  it('matches the Inspector path for the same world target (single contract)', () => {
    const build = () => [
      part('p', { baseTransform: base({ x: 100 }) }),
      part('child', { parentId: 'p', baseTransform: base({ x: 20 }) }),
    ];
    const viaStage = harness(build(), [track('p'), track('child')], ['child'], 'child');
    act(() => viaStage.result.current.updateCurrentTransform({ x: 130 }));
    viaStage.commit();

    const viaInspector = harness(build(), [track('p'), track('child')], ['child'], 'child');
    act(() => viaInspector.result.current.updateCurrentTransform({ x: 130 }));
    viaInspector.commit();

    expect(viaStage.world('child')).toMatchObject(viaInspector.world('child'));
  });
});

describe('B-02 — every selected source propagates its own bond', () => {
  it('moves both bond groups exactly once', () => {
    const parts = [
      part('a', { ...bind(['b']) }),
      part('b', { baseTransform: base({ x: 100 }), ...bind(['a']) }),
      part('c', { ...bind(['d']) }),
      part('d', { baseTransform: base({ x: 50 }), ...bind(['c']) }),
    ];
    const h = harness(parts, [track('a'), track('b'), track('c'), track('d')], ['a', 'c'], 'a');

    act(() => h.result.current.updateCurrentTransform({ x: 10 }));
    h.commit();

    expect(h.world('a').x).toBeCloseTo(10, 5);
    expect(h.world('b').x).toBeCloseTo(110, 5);
    expect(h.world('c').x).toBeCloseTo(10, 5);
    expect(h.world('d').x).toBeCloseTo(60, 5);
  });
});

describe('B-03 — a moving ancestor is not applied twice', () => {
  it('gives a parented partner the total delta once', () => {
    const parts = [
      part('p', { baseTransform: base({ x: 100 }) }),
      part('a', { ...bind(['b']) }),
      part('b', { parentId: 'p', baseTransform: base({ x: 20 }), ...bind(['a']) }),
    ];
    const h = harness(parts, [track('p'), track('a'), track('b')], ['a', 'p'], 'a');

    expect(h.world('b').x).toBe(120);

    act(() => h.result.current.updateCurrentTransform({ x: 10 }));
    h.commit();

    expect(h.world('p').x).toBeCloseTo(110, 5);
    expect(h.world('a').x).toBeCloseTo(10, 5);
    expect(h.world('b').x).toBeCloseTo(130, 5);
  });
});

describe('B-04 — an X-only edit never rewrites the partner Y animation', () => {
  it('leaves the partner Y channel and its evaluation untouched', () => {
    const parts = [
      part('a', { ...bind(['b']) }),
      part('b', { baseTransform: base({ x: 100, y: 40 }), ...bind(['a']) }),
    ];
    const tracks = [
      track('a'),
      track('b', { y: [pk('y0', 0, 0), pk('y20', 20, 100)] }),
    ];
    const h = harness(parts, tracks, ['a'], 'a', 10);

    const yBefore = evaluateTransform(parts, tracks, 'Sequence', 'b', 10).y;

    act(() => h.result.current.updateCurrentTransform({ x: 10 }));
    h.commit();

    const bTrack = h.currentTracks().find((t) => t.partId === 'b')!;
    expect(bTrack.channels.y.map((k) => k.id)).toEqual(['y0', 'y20']);
    expect(bTrack.channels.y.some((k) => k.frame === 10)).toBe(false);
    expect(h.world('b').y).toBeCloseTo(yBefore, 5);
    expect(h.world('b').x).toBeCloseTo(110, 5);
  });

  it('still writes local Y when a rotated parent genuinely changes it', () => {
    const parts = [
      part('p', { baseTransform: base({ x: 100, rotation: 90 }) }),
      part('child', { parentId: 'p', baseTransform: base({ x: 20 }) }),
    ];
    const h = harness(parts, [track('p'), track('child')], ['child'], 'child');

    const before = h.world('child');
    expect(before.x).toBeCloseTo(100, 5);
    expect(before.y).toBeCloseTo(20, 5);

    act(() => h.result.current.updateCurrentTransform({ x: 110, y: 20 }));
    h.commit();

    expect(h.world('child').x).toBeCloseTo(110, 5);
    expect(h.world('child').y).toBeCloseTo(20, 5);
  });
});

describe('B — lifecycle guards', () => {
  it('a deleted partner is skipped without crashing', () => {
    const parts = [
      part('a', { ...bind(['ghost']) }),
      part('b', { baseTransform: base({ x: 50 }) }),
    ];
    const h = harness(parts, [track('a'), track('b')], ['a'], 'a');

    act(() => h.result.current.updateCurrentTransform({ x: 10 }));
    h.commit();

    expect(h.world('a').x).toBeCloseTo(10, 5);
    expect(h.world('b').x).toBeCloseTo(50, 5);
  });
});
