import { describe, expect, it } from 'vitest';
import type { CharacterPart, Track } from '../types/animator';
import type { RuntimeData } from '../types/composition';
import { evaluateTransform } from '../utils/evaluateTransform';
import { evaluateFrame } from '../utils/evaluateFrame';
import { worldAffineOf, type WorldAffine } from '../utils/containerMath';
import { makeEmptyChannels } from '../utils/defaults';
import { planLayerDrop, planReparent } from '../utils/layerParenting';

const part = (id: string, base: Partial<CharacterPart['baseTransform']> = {}, extra: Partial<CharacterPart> = {}): CharacterPart => ({
  id, name: id[0].toUpperCase() + id.slice(1), type: 'custom_rect', zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, ...base },
  ...extra,
} as CharacterPart);
const track = (partId: string, channels: Partial<Track['channels']> = {}, extra: Partial<Track> = {}): Track => ({
  id: `track-${partId}`, partId, name: partId, keyframes: [], channels: { ...makeEmptyChannels(), ...channels }, ...extra,
} as unknown as Track);
const key = (id: string, frame: number, value: number, easing: 'linear' | 'easeInOut' | 'easeIn' = 'easeInOut', templateId?: string) => ({ id, frame, value, easing, ...(templateId ? { templateId } : {}) });
const world = (parts: CharacterPart[], tracks: Track[], id: string, frame: number, scope = 'Sequence') => worldAffineOf(evaluateTransform(parts, tracks, scope, id, frame));
const same = (actual: WorldAffine, expected: WorldAffine, label: string) => {
  (['a', 'b', 'c', 'd', 'e', 'f'] as const).forEach((k) => expect(actual[k], `${label}.${k}`).toBeCloseTo(expected[k], 6));
};
const expectWorldKept = (before: { parts: CharacterPart[]; tracks: Track[] }, after: { parts: CharacterPart[]; tracks?: Track[] }, ids: string[], frames: number, scope = 'Sequence') => {
  for (let frame = 0; frame <= frames; frame += 1) {
    for (const id of ids) same(world(after.parts, after.tracks ?? before.tracks, id, frame, scope), world(before.parts, before.tracks, id, frame, scope), `${scope} ${id}@${frame}`);
  }
};
/** Largest world-position deviation (project units) sampled every quarter frame. */
const fractionalDeviation = (before: { parts: CharacterPart[]; tracks: Track[] }, after: { parts: CharacterPart[]; tracks: Track[] }, id: string, frames: number) => {
  let worst = 0;
  for (let frame = 0; frame <= frames; frame += 0.25) {
    const a = world(before.parts, before.tracks, id, frame);
    const b = world(after.parts, after.tracks, id, frame);
    worst = Math.max(worst, Math.hypot(a.e - b.e, a.f - b.f));
  }
  return worst;
};

describe('C4 re-parenting an animated layer keeps its world pose', () => {
  const statics = () => [
    part('arm', { x: 100, y: 50, rotation: 30, scaleX: 2, scaleY: 2 }),
    part('body', { x: -200, y: 40, rotation: -20, scaleX: 0.5, scaleY: 0.5 }),
    part('hand', { x: 30, y: -10, rotation: 10 }, { parentId: 'arm' }),
  ];

  it('an animated child moves to another static (rotated, scaled) parent: exact, and its key times and easings are kept', () => {
    const parts = statics();
    const tracks = [track('arm'), track('body'), track('hand', { x: [key('h0', 0, 30), key('h1', 40, 180)], rotation: [key('r0', 10, 10, 'easeIn'), key('r1', 30, 80, 'easeIn')] })];
    const plan = planReparent(parts, tracks, 'hand', 'body', 'Sequence', 0);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.parts.find((p) => p.id === 'hand')!.parentId).toBe('body');
    expectWorldKept({ parts, tracks }, plan, ['hand'], 45);
    const hand = plan.tracks!.find((t) => t.partId === 'hand')!;
    // A static parent change is an affine map of the child's own channels: the authored key times and
    // easings survive (rotation 10/30 easeIn, x 0/40 easeInOut); the bake may add constant holds at the span ends.
    const at = (channel: 'x' | 'rotation', frame: number) => hand.channels[channel].find((k) => k.frame === frame);
    expect([at('rotation', 10)?.easing, at('rotation', 30)?.easing]).toEqual(['easeIn', 'easeIn']);
    expect(at('x', 0)?.easing).toBe('easeInOut');
    expect(at('x', 40)).toBeDefined();
    expect(hand.channels.rotation.length).toBeLessThanOrEqual(4);
    expect(plan.rebased?.perFrame).toBe(false);
  });

  it('a static child leaves an ANIMATED parent (unparent) and keeps its motion, baked into its own channels', () => {
    const parts = statics();
    const tracks = [track('arm', { x: [key('a0', 0, 100), key('a1', 30, 400)], rotation: [key('ar0', 0, 30), key('ar1', 30, 120)] }), track('body'), track('hand')];
    const plan = planReparent(parts, tracks, 'hand', null, 'Sequence', 0);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.parts.find((p) => p.id === 'hand')!.parentId).toBeUndefined();
    expectWorldKept({ parts, tracks }, plan, ['hand'], 40);
    expect(plan.rebased!.keyframesAfter).toBeGreaterThan(plan.rebased!.keyframesBefore);
    // Measured, reported in project units: exact at integer frames; between frames a rotating composition differs a little.
    const deviation = fractionalDeviation({ parts, tracks }, { parts: plan.parts, tracks: plan.tracks! }, 'hand', 30);
    expect(deviation).toBeLessThan(1);
  });

  it('a static child nests into a MOVING new parent: it stays put on screen while the parent moves', () => {
    const parts = [part('mover', { x: 0, y: 0 }), part('dot', { x: 200, y: 100 })];
    const tracks = [track('mover', { x: [key('m0', 0, 0, 'linear'), key('m1', 20, 300, 'linear')] }), track('dot')];
    const plan = planReparent(parts, tracks, 'dot', 'mover', 'Sequence', 0);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expectWorldKept({ parts, tracks }, plan, ['dot'], 25);
    // A pure translation is carried with the parent's own key times and easing.
    expect(plan.tracks!.find((t) => t.partId === 'dot')!.channels.x.map((k) => [k.frame, k.easing])).toEqual([[0, 'linear'], [20, 'linear']]);
  });

  it('every sequence keeps its own motion; a sequence nobody animates keeps the base pose', () => {
    const parts = statics();
    const tracks = [
      track('arm', { rotation: [key('s0', 0, 30, 'linear', 'Intro'), key('s1', 20, 90, 'linear', 'Intro')] }),
      track('body'),
      track('hand', { x: [key('h0', 0, 30), key('h1', 40, 180)] }),
    ];
    const plan = planReparent(parts, tracks, 'hand', 'body', 'Sequence', 0);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expectWorldKept({ parts, tracks }, plan, ['hand'], 45, 'Sequence');
    expectWorldKept({ parts, tracks }, plan, ['hand'], 25, 'Intro');
    expectWorldKept({ parts, tracks }, plan, ['hand'], 5, 'Outro');
  });

  it('legacy composite keyframes on the child are carried', () => {
    const parts = statics();
    const legacy = track('hand', {}, { keyframes: [
      { id: 'l0', frame: 0, transform: { x: 30, y: -10, rotation: 10, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' },
      { id: 'l1', frame: 20, transform: { x: 90, y: 40, rotation: 50, scaleX: 1.2, scaleY: 1.2, opacity: 1 }, easing: 'linear' },
    ] } as unknown as Partial<Track>);
    const tracks = [track('arm'), track('body'), legacy];
    const plan = planReparent(parts, tracks, 'hand', 'body', 'Sequence', 0);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expectWorldKept({ parts, tracks }, plan, ['hand'], 25);
  });

  it('descendants of the moved layer follow it exactly', () => {
    const parts = [...statics(), part('finger', { x: 5, y: 5, rotation: 15 }, { parentId: 'hand' })];
    const tracks = [track('arm', { rotation: [key('a0', 0, 30), key('a1', 20, 70)] }), track('body'), track('hand', { x: [key('h0', 0, 30), key('h1', 20, 60)] }), track('finger', { rotation: [key('f0', 0, 15), key('f1', 20, 45)] })];
    const plan = planReparent(parts, tracks, 'hand', 'body', 'Sequence', 0);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expectWorldKept({ parts, tracks }, plan, ['hand', 'finger'], 25);
  });

  it('procedural presets: ids untouched, edit and broadcast frames unchanged', () => {
    const parts = statics().map((p) => (p.id === 'hand' ? { ...p, inAnimPreset: 'pop', inAnimDuration: 20 } as CharacterPart : p));
    const tracks = [track('arm', { x: [key('a0', 0, 100), key('a1', 30, 300)] }), track('body'), track('hand', { rotation: [key('r0', 0, 10), key('r1', 30, 60)] })];
    const plan = planReparent(parts, tracks, 'hand', 'body', 'Sequence', 0);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.parts.find((p) => p.id === 'hand')!.inAnimPreset).toBe('pop');
    const runtimes: RuntimeData[] = [
      { appMode: 'edit', broadcast: {}, liveStunts: {} },
      { appMode: 'broadcast', broadcast: { hand: { state: 'animating_in', progress: 0.4 }, arm: { state: 'visible', progress: 1 }, body: { state: 'visible', progress: 1 } }, liveStunts: {} },
    ];
    for (const runtime of runtimes) {
      for (const frame of [0, 7, 15, 30]) {
        const before = evaluateFrame(parts, tracks, 60, frame, runtime, []).layers.find((l) => l.id === 'hand')!;
        const after = evaluateFrame(plan.parts, plan.tracks!, 60, frame, runtime, []).layers.find((l) => l.id === 'hand')!;
        same(worldAffineOf(after.transform), worldAffineOf(before.transform), `${runtime.appMode}@${frame}`);
        expect(after.opacity).toBeCloseTo(before.opacity, 10);
      }
    }
  });

  it('a pose that needs a skew (rotating child inside a non-uniformly scaled parent) is refused; nothing changes', () => {
    const parts = [part('wide', { scaleX: 3, scaleY: 1 }), part('spinner', { x: 50 })];
    const tracks = [track('wide'), track('spinner', { rotation: [key('s0', 0, 0, 'linear'), key('s1', 20, 90, 'linear')] })];
    const plan = planReparent(parts, tracks, 'spinner', 'wide', 'Sequence', 0);
    expect(plan).toMatchObject({ ok: false, reason: expect.stringMatching(/skew/) });
  });

  it('cycles and self-parenting stay refused', () => {
    const parts = statics();
    const tracks = [track('arm', { x: [key('a0', 0, 1), key('a1', 5, 2)] }), track('body'), track('hand')];
    expect(planReparent(parts, tracks, 'arm', 'hand', 'Sequence', 0)).toMatchObject({ ok: false, reason: expect.stringMatching(/loop/) });
    expect(planReparent(parts, tracks, 'hand', 'hand', 'Sequence', 0)).toMatchObject({ ok: false });
  });

  it('a tree drop that nests an animated layer carries the re-based tracks', () => {
    const parts = statics();
    const tracks = [track('arm'), track('body'), track('hand', { x: [key('h0', 0, 30), key('h1', 40, 180)] })];
    const drop = planLayerDrop(parts, tracks, 'hand', 'body', 'nest', 'Sequence', 0);
    expect(drop.ok).toBe(true);
    if (!drop.ok) return;
    expectWorldKept({ parts, tracks }, { parts: drop.parts, tracks: drop.tracks }, ['hand'], 45);
  });
});
