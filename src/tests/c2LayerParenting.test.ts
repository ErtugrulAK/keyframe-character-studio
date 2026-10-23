import { describe, expect, it } from 'vitest';
import type { CharacterPart, Track } from '../types/animator';
import { evaluateTransform } from '../utils/evaluateTransform';
import { worldAffineOf, affineEquals } from '../utils/containerMath';
import { moveLayerInOrder, planLayerDrop, planReparent, reparentBlockReason } from '../utils/layerParenting';
import { deleteParts, matteDependentsOfDeletion } from '../utils/partDeletion';

const part = (id: string, base: Partial<CharacterPart['baseTransform']> = {}, extra: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  type: 'custom_rect',
  zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, ...base },
  ...extra,
} as CharacterPart);

const track = (partId: string, channels: Record<string, unknown> = {}): Track => ({
  id: `track-${partId}`, partId, name: partId, keyframes: [], channels,
} as unknown as Track);

const world = (parts: CharacterPart[], tracks: Track[], id: string, frame = 0) => worldAffineOf(evaluateTransform(parts, tracks, 'Sequence', id, frame));

const scene = () => {
  const parts = [
    part('square', { x: 100, y: 50, rotation: 30, scaleX: 2, scaleY: 2 }),
    part('triangle', { x: -40, y: 80, rotation: -15, scaleX: 0.5, scaleY: 0.5 }),
    part('star', { x: 300, y: -120, rotation: 70, scaleX: 1.5, scaleY: 1.5, opacity: 0.4 }),
    part('circle', { x: -200, y: 10 }),
  ];
  return { parts, tracks: parts.map((p) => track(p.id)) };
};

describe('C2-E planReparent — the world pose is kept exactly', () => {
  it('Square → Triangle → Star chain: each nest keeps every layer where it was; Circle stays independent', () => {
    const { parts, tracks } = scene();
    const before = Object.fromEntries(parts.map((p) => [p.id, world(parts, tracks, p.id)]));
    const nestStar = planReparent(parts, tracks, 'star', 'triangle', 'Sequence', 0);
    expect(nestStar.ok).toBe(true);
    if (!nestStar.ok) return;
    const nestTriangle = planReparent(nestStar.parts, tracks, 'triangle', 'square', 'Sequence', 0);
    expect(nestTriangle.ok).toBe(true);
    if (!nestTriangle.ok) return;
    const after = nestTriangle.parts;
    for (const p of parts) expect(affineEquals(world(after, tracks, p.id), before[p.id]), p.id).toBe(true);
    expect(after.find((p) => p.id === 'star')!.parentId).toBe('triangle');
    expect(after.find((p) => p.id === 'triangle')!.parentId).toBe('square');
    expect(after.find((p) => p.id === 'circle')).toBe(parts.find((p) => p.id === 'circle'));
    // Opacity is never inherited, so it is never rewritten.
    expect(after.find((p) => p.id === 'star')!.baseTransform.opacity).toBe(0.4);

    // Moving Square moves the chain; Circle does not move.
    const moved = after.map((p) => (p.id === 'square' ? { ...p, baseTransform: { ...p.baseTransform, x: p.baseTransform.x + 50 } } : p));
    expect(world(moved, tracks, 'star').e).toBeCloseTo(before.star.e + 50, 6);
    expect(world(moved, tracks, 'triangle').e).toBeCloseTo(before.triangle.e + 50, 6);
    expect(affineEquals(world(moved, tracks, 'circle'), before.circle)).toBe(true);

    // Unparent keeps the pose too and removes the field.
    const out = planReparent(after, tracks, 'star', null, 'Sequence', 0);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect('parentId' in out.parts.find((p) => p.id === 'star')!).toBe(false);
    expect(affineEquals(world(out.parts, tracks, 'star'), before.star)).toBe(true);
  });

  it('refuses self-parenting and cycles with a reason, writing nothing', () => {
    const { parts, tracks } = scene();
    expect(reparentBlockReason(parts, tracks, 'star', 'star')).toMatch(/own parent/);
    const chained = parts.map((p) => (p.id === 'star' ? { ...p, parentId: 'triangle' } : p.id === 'triangle' ? { ...p, parentId: 'square' } : p));
    const cycle = planReparent(chained, tracks, 'square', 'star', 'Sequence', 0);
    expect(cycle).toEqual({ ok: false, reason: expect.stringMatching(/loop/) });
  });

  // C4 changed this contract (approved): an animated layer or parent chain is no
  // longer refused — the animation is re-based (c4ReparentAnimated.test.ts).
  it('C4: re-bases an animated layer or an animated parent chain, keeping the world pose', () => {
    const { parts } = scene();
    const animatedStar = parts.map((p) => track(p.id, p.id === 'star' ? { x: [{ id: 'k', frame: 0, value: 1 }] } : {}));
    const star = planReparent(parts, animatedStar, 'star', 'triangle', 'Sequence', 0);
    expect(star.ok && star.tracks !== undefined).toBe(true);
    const animatedParent = parts.map((p) => track(p.id, p.id === 'triangle' ? { rotation: [{ id: 'k', frame: 4, value: 10, templateId: 'Other' }] } : {}));
    const underAnimated = planReparent(parts, animatedParent, 'star', 'triangle', 'Sequence', 0);
    expect(underAnimated.ok && underAnimated.rebased?.id).toBe('star');
    // Animation elsewhere in the scene does not block it.
    const animatedCircle = parts.map((p) => track(p.id, p.id === 'circle' ? { x: [{ id: 'k', frame: 0, value: 1 }] } : {}));
    expect(planReparent(parts, animatedCircle, 'star', 'triangle', 'Sequence', 0).ok).toBe(true);
  });

  it('refuses Boolean structures, anchored layers and a pose that would need skew', () => {
    const { parts, tracks } = scene();
    const withBoolean = [...parts, part('bool', {}, { booleanOperandIds: ['op'] }), part('op', {}, { booleanGroupId: 'bool' })];
    const booleanTracks = withBoolean.map((p) => track(p.id));
    expect(reparentBlockReason(withBoolean, booleanTracks, 'star', 'bool')).toMatch(/Boolean group/);
    expect(reparentBlockReason(withBoolean, booleanTracks, 'op', null)).toMatch(/Boolean operand/);
    const anchored = parts.map((p) => (p.id === 'star' ? { ...p, anchor: 'center' as CharacterPart['anchor'] } : p));
    expect(reparentBlockReason(anchored, tracks, 'star', 'square')).toMatch(/anchor/);
    const skewing = parts.map((p) => (p.id === 'square' ? { ...p, baseTransform: { ...p.baseTransform, scaleX: 3, scaleY: 1 } } : p));
    expect(planReparent(skewing, tracks, 'star', 'square', 'Sequence', 0)).toEqual({ ok: false, reason: expect.stringMatching(/skew/) });
  });
});

describe('C2-E planLayerDrop — before/after are siblings, nest is a child', () => {
  it('Before/After place the layer beside the target under the target\'s parent and re-derive zIndex', () => {
    const { parts, tracks } = scene();
    const chained = parts.map((p) => (p.id === 'triangle' ? { ...p, parentId: 'square' } : p));
    const drop = planLayerDrop(chained, tracks, 'circle', 'triangle', 'before', 'Sequence', 0);
    expect(drop.ok).toBe(true);
    if (!drop.ok) return;
    expect(drop.parts.map((p) => p.id)).toEqual(['square', 'circle', 'triangle', 'star']);
    expect(drop.parts.find((p) => p.id === 'circle')!.parentId).toBe('square');
    expect(drop.parts.map((p) => p.zIndex)).toEqual([4, 3, 2, 1]);
    expect(drop.tracks.map((t) => t.partId)).toEqual(['square', 'circle', 'triangle', 'star']);
  });

  it('a same-parent reorder of an animated layer is allowed (no parent change)', () => {
    const { parts } = scene();
    const tracks = parts.map((p) => track(p.id, p.id === 'star' ? { x: [{ id: 'k', frame: 0, value: 1 }] } : {}));
    const drop = planLayerDrop(parts, tracks, 'star', 'square', 'before', 'Sequence', 0);
    expect(drop.ok && drop.parts.map((p) => p.id)).toEqual(['star', 'square', 'triangle', 'circle']);
    // C4: nesting it is now a re-base, not a refusal.
    expect(planLayerDrop(parts, tracks, 'star', 'square', 'nest', 'Sequence', 0).ok).toBe(true);
  });

  it('moveLayerInOrder keeps tracks without a part at the end', () => {
    const { parts, tracks } = scene();
    const orphan = { ...track('ghost'), id: 'track-ghost' } as Track;
    const moved = moveLayerInOrder(parts, [...tracks, orphan], 'circle', 'square', 'before');
    expect(moved.tracks.map((t) => t.partId)).toEqual(['circle', 'square', 'triangle', 'star', 'ghost']);
  });
});

describe('C2 matteDependentsOfDeletion — named before the delete, never rewritten by it', () => {
  const matteScene = () => [
    part('logo'),
    part('caption', {}, { trackMatte: { sourceLayerId: 'logo', mode: 'alpha' } } as Partial<CharacterPart>),
    part('legacy', {}, { matte: { sourcePartId: 'logo', mode: 'alpha' } } as Partial<CharacterPart>),
    part('plain'),
  ];

  it('lists the surviving targets of a deleted source, with the relationship kind', () => {
    const parts = matteScene();
    expect(matteDependentsOfDeletion(parts, ['logo']).map((d) => [d.target.id, d.kind])).toEqual([['caption', 'track'], ['legacy', 'legacy']]);
    expect(matteDependentsOfDeletion(parts, ['plain'])).toEqual([]);
    // A target deleted together with its source is not a dependent.
    expect(matteDependentsOfDeletion(parts, ['logo', 'caption']).map((d) => d.target.id)).toEqual(['legacy']);
  });

  it('the delete itself leaves the relationship as authored (missing source until undo)', () => {
    const parts = matteScene();
    const result = deleteParts(parts, parts.map((p) => track(p.id)), ['logo']);
    expect(result.parts.find((p) => p.id === 'caption')).toBe(parts[1]);
    expect(result.parts.find((p) => p.id === 'legacy')).toBe(parts[2]);
  });
});
