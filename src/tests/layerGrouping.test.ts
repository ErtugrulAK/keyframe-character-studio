import { describe, expect, it } from 'vitest';
import type { CharacterPart, PropertyKeyframe, Track, Transform } from '../types/animator';
import { evaluateTransform } from '../utils/evaluateTransform';
import { makeEmptyChannels } from '../utils/defaults';
import { validateCritical } from '../utils/validateScene';
import { collectOwnedDeletionIds, deleteParts } from '../utils/partDeletion';
import {
  createGroupDisplayName,
  createLayerGroup,
  dissolveLayerGroup,
  getGroupAggregateBounds,
  getGroupChildren,
  getGroupDescendants,
  groupSelectionBlockReason,
  ungroupBlockReason,
} from '../utils/layerGrouping';

const makePart = (id: string, x: number, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id,
  type: 'custom_rect',
  zIndex: 1,
  fillColor: '#ffffff',
  strokeColor: '#101218',
  pivot: { x: 0, y: 0 },
  baseTransform: { x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...overrides,
});

const makeTrack = (partId: string, overrides: Partial<Track> = {}): Track => ({
  id: `track_${partId}`,
  partId,
  name: partId,
  color: '#38bdf8',
  visible: true,
  locked: false,
  keyframes: [],
  channels: makeEmptyChannels(),
  ...overrides,
});

const channel = (frames: [number, number][]): PropertyKeyframe[] => frames.map(([frame, value], index) => ({
  id: `${frame}_${index}`,
  frame,
  value,
  easing: 'linear' as const,
  templateId: 'Sequence',
}));

const worldAt = (parts: CharacterPart[], tracks: Track[], frame: number) => (
  (partId: string): Transform => evaluateTransform(parts, tracks, 'Sequence', partId, frame)
);

const groupOf = (parts: CharacterPart[], tracks: Track[], ids: string[], groupId = 'g', frame = 0) => {
  const outcome = createLayerGroup(parts, tracks, ids, {
    groupId,
    trackId: `track_${groupId}`,
    name: 'Group',
    worldOf: worldAt(parts, tracks, frame),
  });
  if (!outcome.ok) throw new Error(`grouping failed: ${outcome.reason}`);
  return outcome;
};

describe('layer group authoring', () => {
  describe('selection rules', () => {
    it('needs two layers', () => {
      const parts = [makePart('a', 0)];
      expect(groupSelectionBlockReason(parts, ['a'])).toBe('Select at least two layers to group.');
      expect(createLayerGroup(parts, [], ['a'], { groupId: 'g', trackId: 'tg', name: 'Group', worldOf: worldAt(parts, [], 0) }))
        .toEqual({ ok: false, reason: 'Select at least two layers to group.' });
    });

    it('refuses a Boolean operand, whose position belongs to its Boolean group', () => {
      const parts = [makePart('a', 0), makePart('b', 40, { booleanGroupId: 'bool' })];
      expect(groupSelectionBlockReason(parts, ['a', 'b']))
        .toBe('A Boolean operand moves with its Boolean group. Group the Boolean group instead.');
    });

    it('refuses a layer that uses a stage anchor', () => {
      const parts = [makePart('a', 0), makePart('b', 40, { anchor: 'center' })];
      expect(groupSelectionBlockReason(parts, ['a', 'b'])).toBe('A layer that uses a stage anchor cannot be grouped yet.');
    });

    it('refuses layers that do not share one parent', () => {
      const parts = [makePart('a', 0), makePart('parent', 0), makePart('child', 10, { parentId: 'parent' })];
      expect(groupSelectionBlockReason(parts, ['a', 'child']))
        .toBe('Group layers that share one parent, or only top-level layers.');
    });

    it('refuses grouping a container with its own child', () => {
      const parts = [makePart('parent', 0, { isGroup: true }), makePart('child', 10, { parentId: 'parent' })];
      expect(groupSelectionBlockReason(parts, ['parent', 'child'])).toBe('A layer cannot be grouped with its own child.');
    });

    it('accepts two top-level layers and two siblings', () => {
      expect(groupSelectionBlockReason([makePart('a', 0), makePart('b', 40)], ['a', 'b'])).toBeNull();
      const parts = [makePart('p', 0), makePart('a', 10, { parentId: 'p' }), makePart('b', 30, { parentId: 'p' })];
      expect(groupSelectionBlockReason(parts, ['a', 'b'])).toBeNull();
    });
  });

  describe('group creation', () => {
    const parts = [makePart('a', -100), makePart('b', 100)];
    const tracks = [makeTrack('a'), makeTrack('b')];

    it('places the container on the shared parent and keeps every world pose', () => {
      const outcome = groupOf(parts, tracks, ['a', 'b']);
      const group = outcome.parts.find((part) => part.id === 'g')!;
      const children = getGroupChildren(outcome.parts, 'g');

      expect(group.isGroup).toBe(true);
      expect(group.type).toBe('custom_freeform');
      expect(group.parentId).toBeUndefined();
      expect(group.baseTransform).toMatchObject({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
      expect(children.map((child) => child.id)).toEqual(['a', 'b']);
      ['a', 'b'].forEach((id, index) => {
        expect(evaluateTransform(outcome.parts, outcome.tracks, 'Sequence', id, 0))
          .toEqual(evaluateTransform(parts, tracks, 'Sequence', id, 0));
        expect(children[index].isGroup).toBeUndefined();
      });
      expect(outcome.tracks.find((track) => track.partId === 'g')).toBeDefined();
    });

    it('adds one container layer and one track, and no layer loses its id', () => {
      const outcome = groupOf(parts, tracks, ['a', 'b']);
      expect(outcome.parts).toHaveLength(3);
      expect(new Set(outcome.parts.map((part) => part.id)).size).toBe(3);
      expect(outcome.tracks).toHaveLength(3);
      const errors = validateCritical({ layers: outcome.parts });
      expect(errors.filter((error) => error.severity === 'critical')).toEqual([]);
    });

    it('takes over the parent role when the selection is one parent\'s children', () => {
      const nested = [makePart('parent', 0), makePart('a', -50, { parentId: 'parent' }), makePart('b', 50, { parentId: 'parent' })];
      const before = ['a', 'b'].map((id) => evaluateTransform(nested, tracks.slice(0, 2), 'Sequence', id, 0).x);
      const outcome = groupOf(nested, [makeTrack('parent'), makeTrack('a'), makeTrack('b')], ['a', 'b']);
      const group = outcome.parts.find((part) => part.id === 'g')!;
      expect(group.parentId).toBe('parent');
      expect(['a', 'b'].map((id) => evaluateTransform(outcome.parts, outcome.tracks, 'Sequence', id, 0).x)).toEqual(before);
    });

    it('folds an animated child by shifting its x/y channels only, so every frame is preserved', () => {
      const animated = makePart('a', 0, {});
      const animatedTrack = makeTrack('a', { channels: { ...makeEmptyChannels(), x: channel([[0, -100], [20, 100]]) } });
      const source = [animated, makePart('b', 0, { baseTransform: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })];
      const sourceTracks = [animatedTrack, makeTrack('b')];
      const outcome = groupOf(source, sourceTracks, ['a', 'b']);
      const center = outcome.parts.find((part) => part.id === 'g')!.baseTransform.x;

      [0, 5, 10, 20].forEach((frame) => {
        expect(evaluateTransform(outcome.parts, outcome.tracks, 'Sequence', 'a', frame).x)
          .toBeCloseTo(evaluateTransform(source, sourceTracks, 'Sequence', 'a', frame).x, 6);
      });
      const folded = outcome.tracks.find((track) => track.partId === 'a')!.channels.x;
      expect(folded.map((keyframe) => [keyframe.frame, keyframe.value]))
        .toEqual([[0, -100 - center], [20, 100 - center]]);
      expect(outcome.tracks.find((track) => track.partId === 'a')!.channels.rotation).toEqual([]);
    });

    it('refuses to group animated layers inside a rotated parent', () => {
      const parent = makePart('parent', 0, { baseTransform: { x: 0, y: 0, rotation: 45, scaleX: 1, scaleY: 1, opacity: 1 } });
      const animated = makePart('a', -50, { parentId: 'parent' });
      const still = makePart('b', 50, { parentId: 'parent' });
      const tracksWithAnimation = [
        makeTrack('parent'),
        makeTrack('a', { channels: { ...makeEmptyChannels(), x: channel([[0, -50]]) } }),
        makeTrack('b'),
      ];
      const outcome = createLayerGroup([parent, animated, still], tracksWithAnimation, ['a', 'b'], {
        groupId: 'g',
        trackId: 'tg',
        name: 'Group',
        worldOf: worldAt([parent, animated, still], tracksWithAnimation, 0),
      });
      expect(outcome).toEqual({
        ok: false,
        reason: 'Grouping animated layers inside a rotated parent is not exact yet. Reset the parent rotation first.',
      });
    });

    it('names groups in document order without reusing a taken name', () => {
      expect(createGroupDisplayName([])).toBe('Group');
      expect(createGroupDisplayName([makePart('a', 0, { name: 'Group' })])).toBe('Group 2');
      expect(createGroupDisplayName([makePart('a', 0, { name: 'Group' }), makePart('b', 0, { name: 'Group 2' })])).toBe('Group 3');
    });
  });

  describe('group transforms', () => {
    const parts = [makePart('a', -100), makePart('b', 100)];
    const tracks = [makeTrack('a'), makeTrack('b')];
    const group = groupOf(parts, tracks, ['a', 'b']);

    const withGroupTransform = (patch: Partial<Transform>) => ({
      parts: group.parts.map((part) => (part.id === 'g' ? { ...part, baseTransform: { ...part.baseTransform, ...patch } } : part)),
      tracks: group.tracks,
    });

    it('moves every child by the same world delta', () => {
      const moved = withGroupTransform({ x: 50 });
      expect(evaluateTransform(moved.parts, moved.tracks, 'Sequence', 'a', 0)).toMatchObject({ x: -50, y: 0 });
      expect(evaluateTransform(moved.parts, moved.tracks, 'Sequence', 'b', 0)).toMatchObject({ x: 150, y: 0 });
    });

    it('scales every child around the container origin', () => {
      const scaled = withGroupTransform({ scaleX: 2, scaleY: 2 });
      expect(evaluateTransform(scaled.parts, scaled.tracks, 'Sequence', 'a', 0)).toMatchObject({ x: -200, scaleX: 2 });
      expect(evaluateTransform(scaled.parts, scaled.tracks, 'Sequence', 'b', 0)).toMatchObject({ x: 200, scaleX: 2 });
    });

    it('rotates every child around the container origin', () => {
      const rotated = withGroupTransform({ rotation: 90 });
      const a = evaluateTransform(rotated.parts, rotated.tracks, 'Sequence', 'a', 0);
      const b = evaluateTransform(rotated.parts, rotated.tracks, 'Sequence', 'b', 0);
      expect(a.x).toBeCloseTo(0, 6);
      expect(a.y).toBeCloseTo(-100, 6);
      expect(a.rotation).toBeCloseTo(90, 6);
      expect(b.y).toBeCloseTo(100, 6);
    });

    it('keeps a child\'s own local edits inside the group', () => {
      const edited = {
        parts: group.parts.map((part) => (part.id === 'a' ? { ...part, baseTransform: { ...part.baseTransform, x: -80 } } : part)),
        tracks: group.tracks,
      };
      expect(evaluateTransform(edited.parts, edited.tracks, 'Sequence', 'a', 0)).toMatchObject({ x: -80 });
      expect(evaluateTransform(edited.parts, edited.tracks, 'Sequence', 'b', 0)).toMatchObject({ x: 100 });
    });
  });

  describe('aggregate bounds', () => {
    it('unions the children of the group in the group\'s own space', () => {
      const parts = [
        makePart('a', -100, { type: 'custom_image', width: 100, height: 40 }),
        makePart('b', 100, { type: 'custom_image', width: 100, height: 40 }),
      ];
      const tracks = [makeTrack('a'), makeTrack('b')];
      const group = groupOf(parts, tracks, ['a', 'b']);
      const bounds = getGroupAggregateBounds(group.parts, 'g', worldAt(group.parts, group.tracks, 0))!;

      expect(bounds.minX).toBeCloseTo(-150, 6);
      expect(bounds.maxX).toBeCloseTo(150, 6);
      expect(bounds.halfW).toBeCloseTo(150, 6);
      expect(bounds.offsetX).toBeCloseTo(0, 6);
      expect(bounds.halfH).toBeCloseTo(20, 6);
    });

    it('uses the visible pixels of an image layer', () => {
      const parts = [
        makePart('a', 0, {
          type: 'custom_image',
          width: 200,
          height: 200,
          imageContentBounds: { minX: -20, minY: -10, maxX: 20, maxY: 10 },
        }),
        makePart('b', 100, { type: 'custom_image', width: 40, height: 40 }),
      ];
      const tracks = [makeTrack('a'), makeTrack('b')];
      const group = groupOf(parts, tracks, ['a', 'b']);
      const bounds = getGroupAggregateBounds(group.parts, 'g', worldAt(group.parts, group.tracks, 0))!;
      // The group's origin is the aggregate centre, so the box is centred here.
      expect(bounds.minX).toBeCloseTo(-70, 6);
      expect(bounds.maxX).toBeCloseTo(70, 6);
      expect(bounds.offsetX).toBeCloseTo(0, 6);
    });

    it('follows a child that moves after grouping', () => {
      const parts = [makePart('a', -100), makePart('b', 100)];
      const tracks = [makeTrack('a'), makeTrack('b')];
      const group = groupOf(parts, tracks, ['a', 'b']);
      const moved = {
        parts: group.parts.map((part) => (part.id === 'a' ? { ...part, baseTransform: { ...part.baseTransform, x: -250 } } : part)),
        tracks: group.tracks,
      };
      const bounds = getGroupAggregateBounds(moved.parts, 'g', worldAt(moved.parts, moved.tracks, 0))!;
      expect(bounds.minX).toBeLessThan(-200);
      expect(bounds.maxX).toBeCloseTo(160, 6);
    });

    it('composes nested groups instead of using the container fallback box', () => {
      const parts = [makePart('a', -100), makePart('b', 100), makePart('c', 300)];
      const tracks = [makeTrack('a'), makeTrack('b'), makeTrack('c')];
      const inner = groupOf(parts, tracks, ['a', 'b'], 'inner');
      const outer = groupOf(inner.parts, inner.tracks, ['inner', 'c'], 'outer');
      const bounds = getGroupAggregateBounds(outer.parts, 'outer', worldAt(outer.parts, outer.tracks, 0))!;

      // The container's origin is the centre of the world union, so its local
      // box is centred here: the inner group measures as its two 120-wide rects
      // (not as the empty container fallback box) plus c.
      expect(bounds.minX).toBeCloseTo(-260, 6);
      expect(bounds.maxX).toBeCloseTo(260, 6);
      expect(bounds.offsetX).toBeCloseTo(0, 6);
    });
  });

  describe('ungroup', () => {
    it('keeps every layer in place at every frame and removes the container', () => {
      const parts = [makePart('a', -100), makePart('b', 100)];
      const tracks = [makeTrack('a'), makeTrack('b')];
      const group = groupOf(parts, tracks, ['a', 'b']);
      const moved = {
        parts: group.parts.map((part) => (part.id === 'g'
          ? { ...part, baseTransform: { ...part.baseTransform, x: 40, y: -25, scaleX: 2, scaleY: 2 } }
          : part)),
        tracks: group.tracks,
      };
      const outcome = dissolveLayerGroup(moved.parts, moved.tracks, 'g', worldAt(moved.parts, moved.tracks, 0));
      if (!outcome.ok) throw new Error(outcome.reason);

      expect(outcome.parts).toHaveLength(2);
      expect(outcome.tracks).toHaveLength(2);
      expect(outcome.parts.every((part) => part.parentId === undefined)).toBe(true);
      ['a', 'b'].forEach((id) => {
        expect(evaluateTransform(outcome.parts, outcome.tracks, 'Sequence', id, 0))
          .toEqual(evaluateTransform(moved.parts, moved.tracks, 'Sequence', id, 0));
      });
    });

    it('bakes an animated child exactly when the group carries no rotation', () => {
      const animated = makeTrack('a', { channels: { ...makeEmptyChannels(), x: channel([[0, -100], [20, 100]]) } });
      const source = [makePart('a', 0), makePart('b', 100)];
      const group = groupOf(source, [animated, makeTrack('b')], ['a', 'b']);
      const scaled = {
        parts: group.parts.map((part) => (part.id === 'g' ? { ...part, baseTransform: { ...part.baseTransform, x: 30, scaleX: 2, scaleY: 2 } } : part)),
        tracks: group.tracks,
      };
      const outcome = dissolveLayerGroup(scaled.parts, scaled.tracks, 'g', worldAt(scaled.parts, scaled.tracks, 0));
      if (!outcome.ok) throw new Error(outcome.reason);
      [0, 7, 20].forEach((frame) => {
        expect(evaluateTransform(outcome.parts, outcome.tracks, 'Sequence', 'a', frame).x)
          .toBeCloseTo(evaluateTransform(scaled.parts, scaled.tracks, 'Sequence', 'a', frame).x, 6);
      });
    });

    it('refuses to redistribute an animated group', () => {
      const parts = [makePart('a', -100), makePart('b', 100)];
      const tracks = [makeTrack('a'), makeTrack('b')];
      const group = groupOf(parts, tracks, ['a', 'b']);
      const animatedGroup = {
        parts: group.parts,
        tracks: group.tracks.map((track) => (track.partId === 'g' ? { ...track, channels: { ...track.channels, x: channel([[0, 0]]) } } : track)),
      };
      expect(ungroupBlockReason(animatedGroup.parts, animatedGroup.tracks, 'g'))
        .toBe('Ungroup cannot redistribute an animated group. Remove the group keyframes first.');
      expect(dissolveLayerGroup(animatedGroup.parts, animatedGroup.tracks, 'g', worldAt(animatedGroup.parts, animatedGroup.tracks, 0)))
        .toEqual({ ok: false, reason: 'Ungroup cannot redistribute an animated group. Remove the group keyframes first.' });
    });

    it('refuses a rotated group whose children are keyframed', () => {
      const animated = makeTrack('a', { channels: { ...makeEmptyChannels(), x: channel([[0, -100], [20, 100]]) } });
      const source = [makePart('a', 0), makePart('b', 100)];
      const group = groupOf(source, [animated, makeTrack('b')], ['a', 'b']);
      const rotated = {
        parts: group.parts.map((part) => (part.id === 'g' ? { ...part, baseTransform: { ...part.baseTransform, rotation: 30 } } : part)),
        tracks: group.tracks,
      };
      expect(dissolveLayerGroup(rotated.parts, rotated.tracks, 'g', worldAt(rotated.parts, rotated.tracks, 0))).toEqual({
        ok: false,
        reason: 'Ungroup is exact only while the group has no rotation. Reset the group rotation to 0 to ungroup keyframed layers.',
      });
    });

    it('still ungroups a rotated group whose children are static', () => {
      const parts = [makePart('a', -100), makePart('b', 100)];
      const tracks = [makeTrack('a'), makeTrack('b')];
      const group = groupOf(parts, tracks, ['a', 'b']);
      const rotated = {
        parts: group.parts.map((part) => (part.id === 'g' ? { ...part, baseTransform: { ...part.baseTransform, rotation: 30, scaleX: 1.5 } } : part)),
        tracks: group.tracks,
      };
      const outcome = dissolveLayerGroup(rotated.parts, rotated.tracks, 'g', worldAt(rotated.parts, rotated.tracks, 0));
      if (!outcome.ok) throw new Error(outcome.reason);
      ['a', 'b'].forEach((id) => {
        const kept = evaluateTransform(outcome.parts, outcome.tracks, 'Sequence', id, 0);
        const expected = evaluateTransform(rotated.parts, rotated.tracks, 'Sequence', id, 0);
        expect(kept.x).toBeCloseTo(expected.x, 6);
        expect(kept.y).toBeCloseTo(expected.y, 6);
        expect(kept.scaleX).toBeCloseTo(expected.scaleX, 6);
      });
    });

    it('reports a group with no layers and a selection that is not a group', () => {
      const parts = [makePart('a', 0, { isGroup: true }), makePart('b', 40)];
      expect(ungroupBlockReason(parts, [], 'a')).toBe('This group has no layers.');
      expect(ungroupBlockReason(parts, [], 'b')).toBe('Select a layer group to ungroup.');
    });
  });

  describe('nested groups', () => {
    it('round-trips an inner and an outer group through every frame', () => {
      const parts = [makePart('a', -100), makePart('b', 100), makePart('c', 300)];
      const tracks = [makeTrack('a'), makeTrack('b'), makeTrack('c')];
      const inner = groupOf(parts, tracks, ['a', 'b'], 'inner');
      const outer = groupOf(inner.parts, inner.tracks, ['inner', 'c'], 'outer');
      const transformed = {
        parts: outer.parts.map((part) => (part.id === 'outer'
          ? { ...part, baseTransform: { ...part.baseTransform, x: 25, rotation: 15 } }
          : part)),
        tracks: outer.tracks,
      };
      const before = ['a', 'b', 'c'].map((id) => evaluateTransform(transformed.parts, transformed.tracks, 'Sequence', id, 0));
      const expectSamePose = (nextParts: CharacterPart[], nextTracks: Track[]) => {
        ['a', 'b', 'c'].forEach((id, index) => {
          const pose = evaluateTransform(nextParts, nextTracks, 'Sequence', id, 0);
          expect(pose.x).toBeCloseTo(before[index].x, 6);
          expect(pose.y).toBeCloseTo(before[index].y, 6);
          expect(pose.rotation).toBeCloseTo(before[index].rotation, 6);
          expect(pose.scaleX).toBeCloseTo(before[index].scaleX, 6);
          expect(pose.scaleY).toBeCloseTo(before[index].scaleY, 6);
        });
      };

      const innerOut = dissolveLayerGroup(transformed.parts, transformed.tracks, 'inner', worldAt(transformed.parts, transformed.tracks, 0));
      if (!innerOut.ok) throw new Error(innerOut.reason);
      expect(innerOut.parentId).toBe('outer');
      expect(innerOut.parts.filter((part) => part.parentId === 'outer').map((part) => part.id))
        .toEqual(['a', 'b', 'c']);
      expectSamePose(innerOut.parts, innerOut.tracks);

      const outerOut = dissolveLayerGroup(innerOut.parts, innerOut.tracks, 'outer', worldAt(innerOut.parts, innerOut.tracks, 0));
      if (!outerOut.ok) throw new Error(outerOut.reason);
      expectSamePose(outerOut.parts, outerOut.tracks);
      expect(validateCritical({ layers: outerOut.parts }).filter((error) => error.severity === 'critical')).toEqual([]);
    });

    it('lists every nested layer as a descendant', () => {
      const parts = [makePart('a', -100), makePart('b', 100), makePart('c', 300)];
      const tracks = [makeTrack('a'), makeTrack('b'), makeTrack('c')];
      const inner = groupOf(parts, tracks, ['a', 'b'], 'inner');
      const outer = groupOf(inner.parts, inner.tracks, ['inner', 'c'], 'outer');
      expect(getGroupDescendants(outer.parts, 'outer').map((part) => part.id).sort()).toEqual(['a', 'b', 'c', 'inner']);
    });
  });

  describe('ownership', () => {
    it('deleting a group deletes the layers inside it', () => {
      const parts = [makePart('a', -100), makePart('b', 100), makePart('other', 400)];
      const tracks = [makeTrack('a'), makeTrack('b'), makeTrack('other')];
      const group = groupOf(parts, tracks, ['a', 'b']);
      const result = deleteParts(group.parts, group.tracks, ['g']);
      expect([...collectOwnedDeletionIds(group.parts, ['g'])].sort()).toEqual(['a', 'b', 'g']);
      expect(result.parts.map((part) => part.id)).toEqual(['other']);
      expect(result.tracks.map((track) => track.partId)).toEqual(['other']);
    });

    it('leaves the children of a non-group parent in the document', () => {
      const parts = [makePart('parent', 0), makePart('child', 20, { parentId: 'parent' })];
      expect([...collectOwnedDeletionIds(parts, ['parent'])]).toEqual(['parent']);
    });
  });
});
