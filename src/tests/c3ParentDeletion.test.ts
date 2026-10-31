import { describe, expect, it } from 'vitest';
import type { CharacterPart, Track } from '../types/animator';
import { evaluateTransform } from '../utils/animation/evaluateTransform';
import { worldAffineOf, type WorldAffine } from '../utils/geometry/containerMath';
import { makeEmptyChannels } from '../utils/animation/defaults';
import { planReparent } from '../utils/layers/layerParenting';
import { collectOwnedDeletionIds, planPartDeletion } from '../utils/layers/partDeletion';
import { evaluateFrame } from '../utils/animation/evaluateFrame';
import type { RuntimeData } from '../types/composition';

const part = (id: string, base: Partial<CharacterPart['baseTransform']> = {}, extra: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  type: 'custom_rect',
  zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, ...base },
  ...extra,
} as CharacterPart);

const track = (partId: string, channels: Partial<Track['channels']> = {}): Track => ({
  id: `track-${partId}`, partId, name: partId, keyframes: [], channels: { ...makeEmptyChannels(), ...channels },
} as unknown as Track);

const key = (id: string, frame: number, value: number, templateId?: string) => ({ id, frame, value, easing: 'easeInOut' as const, ...(templateId ? { templateId } : {}) });

const world = (parts: CharacterPart[], tracks: Track[], id: string, frame = 0, scope = 'Sequence') => worldAffineOf(evaluateTransform(parts, tracks, scope, id, frame));

const expectSameAffine = (actual: WorldAffine, expected: WorldAffine, label: string) => {
  (['a', 'b', 'c', 'd', 'e', 'f'] as const).forEach((k) => expect(actual[k], `${label}.${k}`).toBeCloseTo(expected[k], 4));
};

/** Square → Triangle → Star, Circle independent, all built through the real reparent planner. */
const chainScene = (tracks?: Track[]) => {
  const raw = [
    part('square', { x: 100, y: 50, rotation: 30, scaleX: 2, scaleY: 2 }),
    part('triangle', { x: -40, y: 80, rotation: -15, scaleX: 0.5, scaleY: 0.5 }),
    part('star', { x: 300, y: -120, rotation: 70, scaleX: 1.5, scaleY: 1.5, opacity: 0.4 }),
    part('circle', { x: -200, y: 10 }),
  ];
  const plain = raw.map((p) => track(p.id));
  const a = planReparent(raw, plain, 'star', 'triangle', 'Sequence', 0);
  if (!a.ok) throw new Error(a.reason);
  const b = planReparent(a.parts, plain, 'triangle', 'square', 'Sequence', 0);
  if (!b.ok) throw new Error(b.reason);
  return { parts: b.parts, tracks: tracks ?? plain };
};

describe('C3 hierarchy — Square → Triangle → Star, Circle independent', () => {
  it('a parent change reaches every descendant; a child change never reaches its parent or Circle', () => {
    const { parts, tracks } = chainScene();
    const before = Object.fromEntries(parts.map((p) => [p.id, world(parts, tracks, p.id)]));
    const edit = (id: string, dx: number) => parts.map((p) => (p.id === id ? { ...p, baseTransform: { ...p.baseTransform, x: p.baseTransform.x + dx } } : p));

    const squareMoved = edit('square', 80);
    expect(world(squareMoved, tracks, 'triangle').e).toBeCloseTo(before.triangle.e + 80, 6);
    expect(world(squareMoved, tracks, 'star').e).toBeCloseTo(before.star.e + 80, 6);
    expectSameAffine(world(squareMoved, tracks, 'circle'), before.circle, 'circle');

    const starMoved = edit('star', -40);
    expectSameAffine(world(starMoved, tracks, 'square'), before.square, 'square');
    expectSameAffine(world(starMoved, tracks, 'triangle'), before.triangle, 'triangle');
    expectSameAffine(world(starMoved, tracks, 'circle'), before.circle, 'circle');
  });
});

describe('C3 planPartDeletion — a plain parent never leaves children on a deleted parent', () => {
  it('deleting Triangle (static) moves Star up to Square and keeps its world pose; Circle untouched', () => {
    const { parts, tracks } = chainScene();
    const before = world(parts, tracks, 'star');
    const plan = planPartDeletion(parts, tracks, ['triangle']);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.parts.map((p) => p.id)).toEqual(['square', 'star', 'circle']);
    expect(plan.parts.find((p) => p.id === 'star')!.parentId).toBe('square');
    expect(plan.parts.some((p) => p.parentId && !plan.parts.some((q) => q.id === p.parentId))).toBe(false);
    expect(plan.tracks.map((t) => t.partId)).toEqual(['square', 'star', 'circle']);
    expect(plan.releasedChildIds).toEqual(['star']);
    expect(plan.deletedIds).toEqual(['triangle']);
    expectSameAffine(world(plan.parts, plan.tracks, 'star'), before, 'star');
    expect(plan.parts.find((p) => p.id === 'circle')).toBe(parts.find((p) => p.id === 'circle'));
    // Opacity is not inherited, so it is not rewritten.
    expect(plan.parts.find((p) => p.id === 'star')!.baseTransform.opacity).toBe(0.4);
    // Square still drives Star afterwards.
    const moved = plan.parts.map((p) => (p.id === 'square' ? { ...p, baseTransform: { ...p.baseTransform, x: p.baseTransform.x + 50 } } : p));
    expect(world(moved, plan.tracks, 'star').e).toBeCloseTo(before.e + 50, 6);
  });

  it('deleting the root Square releases Triangle (with Star) to the top level, poses kept', () => {
    const { parts, tracks } = chainScene();
    const before = { triangle: world(parts, tracks, 'triangle'), star: world(parts, tracks, 'star') };
    const plan = planPartDeletion(parts, tracks, ['square']);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect('parentId' in plan.parts.find((p) => p.id === 'triangle')! && plan.parts.find((p) => p.id === 'triangle')!.parentId).toBeFalsy();
    expect(plan.parts.find((p) => p.id === 'star')!.parentId).toBe('triangle');
    expectSameAffine(world(plan.parts, plan.tracks, 'triangle'), before.triangle, 'triangle');
    expectSameAffine(world(plan.parts, plan.tracks, 'star'), before.star, 'star');
  });

  it('deleting Square AND Triangle together folds Star into the nearest surviving ancestor (none)', () => {
    const { parts, tracks } = chainScene();
    const before = world(parts, tracks, 'star');
    const plan = planPartDeletion(parts, tracks, ['square', 'triangle']);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.parts.map((p) => p.id)).toEqual(['star', 'circle']);
    expect(plan.parts.find((p) => p.id === 'star')!.parentId).toBeFalsy();
    expectSameAffine(world(plan.parts, plan.tracks, 'star'), before, 'star');
  });

  it('an ANIMATED parent is baked into the child: the world pose matches at every frame of every sequence', () => {
    const animated = [
      track('square', { x: [key('k1', 0, 100), key('k2', 30, 400)], rotation: [key('r1', 0, 30), key('r2', 30, 90)] }),
      track('triangle'),
      track('star', { y: [key('s1', 10, -120), key('s2', 50, 60)] }),
      track('circle'),
      // A second sequence animates Square differently.
    ];
    animated[0].channels.x.push(key('i1', 0, -300, 'Intro'), key('i2', 20, 0, 'Intro'));
    const { parts, tracks } = chainScene(animated);
    const before = (scope: string, frame: number) => world(parts, tracks, 'triangle', frame, scope);
    const beforeStar = (scope: string, frame: number) => world(parts, tracks, 'star', frame, scope);
    const plan = planPartDeletion(parts, tracks, ['square']);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    for (const scope of ['Sequence', 'Intro']) {
      for (let frame = 0; frame <= 60; frame += 1) {
        expectSameAffine(world(plan.parts, plan.tracks, 'triangle', frame, scope), before(scope, frame), `${scope}@${frame} triangle`);
        expectSameAffine(world(plan.parts, plan.tracks, 'star', frame, scope), beforeStar(scope, frame), `${scope}@${frame} star`);
      }
    }
  });

  it('refuses, writing nothing, when a child is pinned by a stage anchor', () => {
    const { parts, tracks } = chainScene();
    const pinned = parts.map((p) => (p.id === 'star' ? { ...p, anchor: 'top-left' as CharacterPart['anchor'] } : p));
    const plan = planPartDeletion(pinned, tracks, ['triangle']);
    expect(plan).toEqual({ ok: false, reason: expect.stringMatching(/stage anchor/) });
  });

  it('refuses when the child pose would need a skew (rotated parent with non-uniform scale)', () => {
    const parts = [
      part('parent', { rotation: 30, scaleX: 3, scaleY: 1 }),
      part('child', { x: 20, rotation: 45 }, { parentId: 'parent' }),
    ];
    const plan = planPartDeletion(parts, parts.map((p) => track(p.id)), ['parent']);
    expect(plan).toEqual({ ok: false, reason: expect.stringMatching(/skew/) });
  });

  it('keeps the group and Boolean contracts: a group takes its children, a Boolean group its operands', () => {
    const parts = [
      part('g', {}, { isGroup: true }),
      part('a', { x: 10 }, { parentId: 'g' }),
      part('bool', {}, { booleanOperandIds: ['o1', 'o2'] }),
      part('o1', {}, { booleanGroupId: 'bool' }),
      part('o2', {}, { booleanGroupId: 'bool' }),
      part('free'),
    ];
    const tracks = parts.map((p) => track(p.id));
    const group = planPartDeletion(parts, tracks, ['g']);
    expect(group.ok && group.parts.map((p) => p.id)).toEqual(['bool', 'o1', 'o2', 'free']);
    expect(group.ok && group.releasedChildIds).toEqual([]);
    const bool = planPartDeletion(parts, tracks, ['bool']);
    expect(bool.ok && bool.parts.map((p) => p.id)).toEqual(['g', 'a', 'free']);
    expect([...collectOwnedDeletionIds(parts, ['bool'])].sort()).toEqual(['bool', 'o1', 'o2']);
  });

  it('a STATIC unrotated parent folds into an animated child: key times and easings stay authored, no extra keys', () => {
    const parts = [
      part('frame', { x: 120, y: -40, scaleX: 2, scaleY: 2 }),
      part('dot', { x: 10, y: 5 }, { parentId: 'frame' }),
    ];
    const tracks = [
      track('frame'),
      track('dot', { x: [key('d1', 10, 0), key('d2', 40, 50)], y: [{ ...key('e1', 10, 0), easing: 'easeIn' as const }, key('e2', 40, -30)] }),
    ];
    const plan = planPartDeletion(parts, tracks, ['frame']);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const dot = plan.tracks.find((t) => t.partId === 'dot')!;
    expect(dot.channels.x.map((k) => [k.frame, k.easing])).toEqual([[10, 'easeInOut'], [40, 'easeInOut']]);
    expect(dot.channels.y.map((k) => [k.frame, k.easing])).toEqual([[10, 'easeIn'], [40, 'easeInOut']]);
    expect(plan.bakeNotes).toBeUndefined();
    for (let frame = 0; frame <= 60; frame += 1) {
      expectSameAffine(world(plan.parts, plan.tracks, 'dot', frame), world(parts, tracks, 'dot', frame), `dot@${frame}`);
    }
  });

  it('a parent animated only by LEGACY composite keyframes is carried into the child as canonical channels', () => {
    const base = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    const parts = [part('rig', { x: -100 }), part('hand', { x: 60, y: 30 }, { parentId: 'rig' })];
    const legacy = {
      ...track('rig'),
      keyframes: [
        { id: 'l0', frame: 0, transform: { ...base, x: -100 }, easing: 'linear' as const },
        { id: 'l1', frame: 30, transform: { ...base, x: 200, rotation: 45 }, easing: 'linear' as const },
      ],
    } as unknown as Track;
    const tracks = [legacy, track('hand')];
    const plan = planPartDeletion(parts, tracks, ['rig']);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const hand = plan.tracks.find((t) => t.partId === 'hand')!;
    // The parent's motion now lives in the child's canonical channels.
    expect(hand.channels.x.length).toBeGreaterThan(0);
    expect(hand.channels.rotation.length).toBeGreaterThan(0);
    for (let frame = 0; frame <= 45; frame += 1) {
      expectSameAffine(world(plan.parts, plan.tracks, 'hand', frame), world(parts, tracks, 'hand', frame), `hand@${frame}`);
    }
  });

  it('procedural presets are untouched: the child keeps its preset ids and its evaluated frame (edit and broadcast) is unchanged', () => {
    const animated = [
      track('square', { x: [key('k1', 0, 100), key('k2', 30, 400)], rotation: [key('r1', 0, 30), key('r2', 30, 90)] }),
      track('triangle'),
      track('star'),
      track('circle'),
    ];
    const { parts: chain, tracks } = chainScene(animated);
    const parts = chain.map((p) => (p.id === 'triangle'
      ? { ...p, inAnimPreset: 'pop', inAnimDuration: 20, outAnimPreset: 'fade' } as CharacterPart
      : p.id === 'square' ? { ...p, inAnimPreset: 'fade' } as CharacterPart : p));
    const plan = planPartDeletion(parts, tracks, ['square']);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const triangle = plan.parts.find((p) => p.id === 'triangle')!;
    expect([triangle.inAnimPreset, triangle.inAnimDuration, triangle.outAnimPreset]).toEqual(['pop', 20, 'fade']);
    const runtimes: RuntimeData[] = [
      { appMode: 'edit', broadcast: {}, liveStunts: {} },
      { appMode: 'broadcast', broadcast: { triangle: { state: 'animating_in', progress: 0.4 }, star: { state: 'visible', progress: 1 } }, liveStunts: {} },
    ];
    for (const runtime of runtimes) {
      for (const frame of [0, 7, 15, 30, 45]) {
        const before = evaluateFrame(parts, tracks, 60, frame, runtime, []);
        const after = evaluateFrame(plan.parts, plan.tracks, 60, frame, runtime, []);
        for (const id of ['triangle', 'star']) {
          const a = after.layers.find((l) => l.id === id)!;
          const b = before.layers.find((l) => l.id === id)!;
          expectSameAffine(worldAffineOf(a.transform), worldAffineOf(b.transform), `${runtime.appMode} ${id}@${frame}`);
          expect(a.opacity, `${runtime.appMode} ${id}@${frame} opacity`).toBeCloseTo(b.opacity, 10);
        }
      }
    }
  });

  it('a CHILD animated by legacy composite keyframes keeps its exact pose under a static parent and under a moving one', () => {
    const base = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    const legacyChild = {
      ...track('hand'),
      keyframes: [
        { id: 'h0', frame: 5, transform: { ...base, x: 60, y: 30 }, easing: 'easeInOut' as const },
        { id: 'h1', frame: 35, transform: { ...base, x: 140, y: -20, rotation: 30 }, easing: 'easeInOut' as const },
      ],
    } as unknown as Track;
    const parts = [part('rig', { x: -100, scaleX: 1.5, scaleY: 1.5 }), part('hand', { x: 60, y: 30 }, { parentId: 'rig' })];
    for (const parentTrack of [track('rig'), track('rig', { x: [key('r0', 0, -100), key('r1', 40, 250)], rotation: [key('q0', 0, 0), key('q1', 40, 60)] })]) {
      const tracks = [parentTrack, legacyChild];
      const plan = planPartDeletion(parts, tracks, ['rig']);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      for (let frame = 0; frame <= 50; frame += 1) {
        expectSameAffine(world(plan.parts, plan.tracks, 'hand', frame), world(parts, tracks, 'hand', frame), `hand@${frame}`);
      }
    }
  });

  it('several UNRELATED parents deleted together: each family is released to its own surviving ancestor', () => {
    const parts = [
      part('a', { x: -200, rotation: 20 }),
      part('a1', { x: 30 }, { parentId: 'a' }),
      part('b', { x: 200, scaleX: 2, scaleY: 2 }),
      part('b1', { y: 40 }, { parentId: 'b' }),
      part('b2', { y: -40 }, { parentId: 'b' }),
      part('root', { y: 100 }),
      part('c', { x: 50 }, { parentId: 'root' }),
      part('c1', { x: 10, rotation: 15 }, { parentId: 'c' }),
    ];
    const tracks = parts.map((p) => track(p.id));
    const before = Object.fromEntries(parts.map((p) => [p.id, world(parts, tracks, p.id)]));
    const plan = planPartDeletion(parts, tracks, ['a', 'b', 'c']);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.parts.map((p) => p.id)).toEqual(['a1', 'b1', 'b2', 'root', 'c1']);
    expect(plan.releasedChildIds.sort()).toEqual(['a1', 'b1', 'b2', 'c1']);
    expect(plan.parts.find((p) => p.id === 'a1')!.parentId).toBeFalsy();
    expect(plan.parts.find((p) => p.id === 'b1')!.parentId).toBeFalsy();
    expect(plan.parts.find((p) => p.id === 'c1')!.parentId).toBe('root');
    for (const id of ['a1', 'b1', 'b2', 'c1', 'root']) expectSameAffine(world(plan.parts, plan.tracks, id), before[id], id);
    // Static parents add no keyframes: nothing to announce before the delete.
    expect(plan.bakedChildren).toEqual([]);
  });

  it('bakedChildren announces the keyframes a moving parent adds, and marks a per-frame bake', () => {
    const animated = [
      track('square', { x: [key('k1', 0, 100), key('k2', 30, 400)], rotation: [key('r1', 0, 30), key('r2', 30, 90)] }),
      track('triangle'), track('star'), track('circle'),
    ];
    const { parts, tracks } = chainScene(animated);
    const plan = planPartDeletion(parts, tracks, ['square']);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.bakedChildren).toHaveLength(1);
    const [triangle] = plan.bakedChildren;
    expect(triangle).toMatchObject({ id: 'triangle', name: 'Triangle', keyframesBefore: 0, perFrame: true });
    expect(triangle.keyframesAfter).toBeGreaterThan(30);
    // A translate-only parent bakes sparsely: keys, but no per-frame warning.
    const translating = [track('square', { x: [key('k1', 0, 100), key('k2', 30, 400)] }), track('triangle'), track('star'), track('circle')];
    const sparse = planPartDeletion(parts, translating, ['square']);
    expect(sparse.ok && sparse.bakedChildren[0]).toMatchObject({ id: 'triangle', perFrame: false });
  });

  it('a layer without children is deleted exactly as before', () => {
    const { parts, tracks } = chainScene();
    const plan = planPartDeletion(parts, tracks, ['circle']);
    expect(plan.ok && plan.parts).toEqual(parts.filter((p) => p.id !== 'circle'));
    expect(plan.ok && plan.releasedChildIds).toEqual([]);
  });
});
