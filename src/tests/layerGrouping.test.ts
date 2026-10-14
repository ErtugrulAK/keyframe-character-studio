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
  resolveMarqueeSelection,
  resolveOutermostGroupAncestor,
  resolveStageSelectionTarget,
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

const channel = (frames: [number, number][], templateId = 'Sequence'): PropertyKeyframe[] => frames.map(([frame, value], index) => ({
  id: `${templateId}_${frame}_${index}`,
  frame,
  value,
  easing: 'linear' as const,
  templateId,
}));

const worldAt = (parts: CharacterPart[], tracks: Track[], frame: number) => (
  (partId: string): Transform => evaluateTransform(parts, tracks, 'Sequence', partId, frame)
);

const POSE_CHANNELS = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as const;

/**
 * The bake's contract: after ungrouping, every child evaluates to the pose it
 * had inside the container, at every frame of the sampled range.
 */
const expectSameEvaluatedPose = (
  before: { parts: CharacterPart[]; tracks: Track[] },
  after: { parts: CharacterPart[]; tracks: Track[] },
  ids: string[],
  frames: number[],
  scope = 'Sequence',
) => {
  ids.forEach((id) => frames.forEach((frame) => {
    const expected = evaluateTransform(before.parts, before.tracks, scope, id, frame);
    const actual = evaluateTransform(after.parts, after.tracks, scope, id, frame);
    POSE_CHANNELS.forEach((poseChannel) => {
      expect(actual[poseChannel], `${id}.${poseChannel} at frame ${frame} in ${scope}`)
        .toBeCloseTo(expected[poseChannel], 9);
    });
  }));
};

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
  /**
   * R4-09 — the canvas click target. A plain click selects the group the
   * geometry belongs to; the layer itself is only the target while the
   * selection already lives inside that group (the explicit drill-in paths).
   */
  describe('canvas selection target', () => {
    // outer > { inner > { leaf, sibling }, lone }
    const nested = [
      makePart('outer', 0, { isGroup: true }),
      makePart('inner', 0, { isGroup: true, parentId: 'outer' }),
      makePart('leaf', 10, { parentId: 'inner' }),
      makePart('sibling', 30, { parentId: 'inner' }),
      makePart('lone', 60, { parentId: 'outer' }),
      makePart('free', 90),
    ];

    it('resolves the outermost group of a nested layer', () => {
      expect(resolveOutermostGroupAncestor(nested, 'leaf')).toBe('outer');
      expect(resolveOutermostGroupAncestor(nested, 'inner')).toBe('outer');
      expect(resolveOutermostGroupAncestor(nested, 'outer')).toBeNull();
      expect(resolveOutermostGroupAncestor(nested, 'free')).toBeNull();
    });

    it('a click on a child of an unselected group selects the group', () => {
      expect(resolveStageSelectionTarget(nested, 'leaf', [])).toBe('outer');
      expect(resolveStageSelectionTarget(nested, 'lone', [])).toBe('outer');
      // Nested groups behave the same way: the outermost container wins.
      expect(resolveStageSelectionTarget(nested, 'inner', [])).toBe('outer');
    });

    it('a click on an ungrouped layer selects the layer', () => {
      expect(resolveStageSelectionTarget(nested, 'free', [])).toBe('free');
    });

    it('keeps the container when the container itself is the selection', () => {
      expect(resolveStageSelectionTarget(nested, 'leaf', ['outer'])).toBe('outer');
      expect(resolveStageSelectionTarget(nested, 'inner', ['outer'])).toBe('outer');
    });

    it('targets the layer once the selection already lives inside the group', () => {
      // A drilled-in child (canvas double-click / Outliner row).
      expect(resolveStageSelectionTarget(nested, 'sibling', ['leaf'])).toBe('sibling');
      expect(resolveStageSelectionTarget(nested, 'leaf', ['leaf'])).toBe('leaf');
      // A Shift-selected pair of children stays a child-level selection.
      expect(resolveStageSelectionTarget(nested, 'leaf', ['leaf', 'sibling'])).toBe('leaf');
    });

    it('a selection inside another group never unlocks this one', () => {
      const parts = [
        ...nested,
        makePart('other', 0, { isGroup: true }),
        makePart('otherChild', 10, { parentId: 'other' }),
      ];
      expect(resolveStageSelectionTarget(parts, 'leaf', ['otherChild'])).toBe('outer');
      // ...but it stays inside its own group.
      expect(resolveStageSelectionTarget(parts, 'otherChild', ['otherChild'])).toBe('otherChild');
    });
  });

  /**
   * R5-08 — the marquee folds into the SAME canonical selection a click does: a
   * box over grouped children normalizes to the container, never to the children,
   * and a geometryless container is never hit directly (so a gap between its
   * children cannot select it).
   */
  describe('marquee selection', () => {
    const nested = [
      makePart('outer', 0, { isGroup: true }),
      makePart('inner', 0, { isGroup: true, parentId: 'outer' }),
      makePart('leaf', 10, { parentId: 'inner' }),
      makePart('sibling', 30, { parentId: 'inner' }),
      makePart('lone', 60, { parentId: 'outer' }),
      makePart('free', 90),
    ];

    it('normalizes a box over grouped children to the group container', () => {
      expect(resolveMarqueeSelection(nested, ['leaf', 'sibling'], [])).toEqual(['outer']);
      // ...and to the OUTERMOST container for a nested group.
      expect(resolveMarqueeSelection(nested, ['inner', 'leaf'], [])).toEqual(['outer']);
    });

    it('keeps sibling groups as separate members of the selection', () => {
      const parts = [
        ...nested,
        makePart('other', 0, { isGroup: true }),
        makePart('otherChild', 10, { parentId: 'other' }),
      ];
      expect(resolveMarqueeSelection(parts, ['leaf', 'otherChild'], [])).toEqual(['outer', 'other']);
      // ...and an ungrouped layer stays itself.
      expect(resolveMarqueeSelection(parts, ['free', 'leaf'], [])).toEqual(['free', 'outer']);
    });

    it('never hits a geometryless container directly', () => {
      // Only the container's own id is in the hit list: a gap between children.
      expect(resolveMarqueeSelection(nested, ['inner', 'outer'], [])).toEqual([]);
    });

    it('targets the children once the selection already lives inside the group', () => {
      expect(resolveMarqueeSelection(nested, ['leaf', 'sibling'], ['sibling'])).toEqual(['leaf', 'sibling']);
      // ...while a selection that IS the container stays the container.
      expect(resolveMarqueeSelection(nested, ['leaf', 'lone'], ['outer'])).toEqual(['outer']);
    });

    it('deduplicates the hits of one container and ignores unknown ids', () => {
      expect(resolveMarqueeSelection(nested, ['leaf', 'sibling', 'leaf', 'ghost'], [])).toEqual(['outer']);
      expect(resolveMarqueeSelection(nested, [], [])).toEqual([]);
    });
  });

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
      const outcome = dissolveLayerGroup(moved.parts, moved.tracks, 'g');
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
      const outcome = dissolveLayerGroup(scaled.parts, scaled.tracks, 'g');
      if (!outcome.ok) throw new Error(outcome.reason);
      expectSameEvaluatedPose(scaled, outcome, ['a', 'b'], [0, 7, 20]);
    });

    it('keeps the animated child’s own key times and easing when the group is static', () => {
      const eased = (frame: number, value: number, easing: 'linear' | 'easeIn'): PropertyKeyframe => ({
        id: `kf_${frame}`, frame, value, easing, templateId: 'Sequence',
      });
      const animated = makeTrack('a', { channels: { ...makeEmptyChannels(), x: [eased(0, -100, 'linear'), eased(20, 100, 'easeIn')] } });
      const group = groupOf([makePart('a', 0), makePart('b', 100)], [animated, makeTrack('b')], ['a', 'b']);
      const moved = {
        parts: group.parts.map((part) => (part.id === 'g' ? { ...part, baseTransform: { ...part.baseTransform, x: 30, scaleX: 2 } } : part)),
        tracks: group.tracks,
      };
      const outcome = dissolveLayerGroup(moved.parts, moved.tracks, 'g');
      if (!outcome.ok) throw new Error(outcome.reason);

      const baked = outcome.tracks.find((track) => track.partId === 'a')!.channels.x;
      // Two authored keys, two folded keys: the affine fold re-bases values and
      // never rewrites an author's timing or easing.
      expect(baked.map((key) => [key.frame, key.easing])).toEqual([[0, 'linear'], [20, 'easeIn']]);
      expect(baked[0].value).toBeCloseTo(30 + 2 * -100, 9);
      expect(baked[1].value).toBeCloseTo(30 + 2 * 100, 9);
    });

    it('bakes a travelling container into a static child with the container’s OWN key times', () => {
      const group = groupOf([makePart('a', -100), makePart('b', 100)], [makeTrack('a'), makeTrack('b')], ['a', 'b']);
      const animated = {
        parts: group.parts,
        tracks: group.tracks.map((track) => (track.partId === 'g'
          ? { ...track, channels: { ...makeEmptyChannels(), x: channel([[0, 0], [10, 90], [20, 10]]) } }
          : track)),
      };
      const outcome = dissolveLayerGroup(animated.parts, animated.tracks, 'g');
      if (!outcome.ok) throw new Error(outcome.reason);

      // The exact pose first, at every sampled frame...
      expectSameEvaluatedPose(animated, outcome, ['a', 'b'], [0, 1, 5, 10, 15, 20, 25]);
      // ...then the sparse rule that carries it: a channel the composition merely
      // translates keeps the container's OWN key times (three, not twenty-one), and
      // a channel the composition leaves constant needs exactly one key.
      const baked = outcome.tracks.find((track) => track.partId === 'b')!.channels;
      expect(baked.x.map((key) => key.frame)).toEqual([0, 10, 20]);
      expect(baked.x.every((key) => key.easing === 'linear')).toBe(true);
      ['y', 'rotation', 'scaleX', 'scaleY'].forEach((localChannel) => {
        expect(baked[localChannel].map((key) => key.frame), localChannel).toEqual([0]);
      });
      expect(baked.opacity).toHaveLength(0);
    });

    it('bakes a rotating and scaling container into an animated child at every frame', () => {
      const child = makeTrack('a', { channels: { ...makeEmptyChannels(), y: channel([[0, -100], [20, 100]]) } });
      const group = groupOf([makePart('a', 0), makePart('b', 100)], [child, makeTrack('b')], ['a', 'b']);
      const animated = {
        parts: group.parts,
        tracks: group.tracks.map((track) => (track.partId === 'g'
          ? {
            ...track,
            channels: {
              ...makeEmptyChannels(),
              rotation: channel([[0, 0], [10, 90], [20, -45]]),
              scaleX: channel([[0, 1], [10, 2], [20, 0.5]]),
              scaleY: channel([[0, 1], [10, 0.25], [20, 3]]),
            },
          }
          : track)),
      };
      const outcome = dissolveLayerGroup(animated.parts, animated.tracks, 'g');
      if (!outcome.ok) throw new Error(outcome.reason);
      expectSameEvaluatedPose(animated, outcome, ['a', 'b'], [0, 3, 7, 10, 14, 20]);
    });

    it('bakes a combined container transform onto every child of the group', () => {
      const child = makeTrack('b', { channels: { ...makeEmptyChannels(), rotation: channel([[0, 0], [16, 180]]) } });
      const group = groupOf([makePart('a', -100), makePart('b', 100), makePart('c', 300)], [makeTrack('a'), child, makeTrack('c')], ['a', 'b', 'c']);
      const animated = {
        parts: group.parts,
        tracks: group.tracks.map((track) => (track.partId === 'g'
          ? {
            ...track,
            channels: {
              ...makeEmptyChannels(),
              x: channel([[0, 0], [8, 60], [16, -40]]),
              y: channel([[0, 0], [8, -30], [16, 20]]),
              rotation: channel([[0, 0], [8, 30], [16, -60]]),
              scaleX: channel([[0, 1], [8, 1.5], [16, 0.75]]),
              scaleY: channel([[0, 1], [8, 0.5], [16, 2]]),
            },
          }
          : track)),
      };
      const outcome = dissolveLayerGroup(animated.parts, animated.tracks, 'g');
      if (!outcome.ok) throw new Error(outcome.reason);

      expect(outcome.parts.map((part) => part.id)).toEqual(['a', 'b', 'c']);
      expect(outcome.parts.every((part) => part.parentId === undefined)).toBe(true);
      expect(outcome.parts.every((part) => part.baseTransform.opacity === 1)).toBe(true);
      expectSameEvaluatedPose(animated, outcome, ['a', 'b', 'c'], [0, 2, 8, 12, 16, 20]);
    });

    it('bakes the container’s motion per sequence and folds the scopes it never animated', () => {
      const childTrack = makeTrack('a', {
        channels: {
          ...makeEmptyChannels(),
          x: channel([[0, -100], [20, 100]], 'Boot'),
          y: channel([[0, -50], [12, 50]]),
        },
      });
      const staticTrack = makeTrack('b');
      const group = groupOf([makePart('a', 0), makePart('b', 100)], [childTrack, staticTrack], ['a', 'b']);
      const animated = {
        parts: group.parts.map((part) => (part.id === 'g'
          ? { ...part, baseTransform: { ...part.baseTransform, x: 30, scaleX: 2, scaleY: 2 } }
          : part)),
        tracks: group.tracks.map((track) => (track.partId === 'g'
          ? { ...track, channels: { ...makeEmptyChannels(), x: channel([[0, 0], [20, 120]], 'Boot') } }
          : track)),
      };
      const outcome = dissolveLayerGroup(animated.parts, animated.tracks, 'g');
      if (!outcome.ok) throw new Error(outcome.reason);

      expectSameEvaluatedPose(animated, outcome, ['a', 'b'], [0, 4, 9, 14, 20], 'Boot');
      expectSameEvaluatedPose(animated, outcome, ['a', 'b'], [0, 6, 12, 20], 'Sequence');

      const baked = outcome.tracks.find((track) => track.partId === 'a')!.channels;
      // 'Sequence' was never animated by the container, so the affine fold
      // re-bases the child's own key: same frame, same easing, value composed
      // by the container's constant local transform. 'Boot' is sampled frame by
      // frame on all five channels — a sampled scope must not fall back to a
      // stale channel value.
      const groupLocal = animated.parts.find((part) => part.id === 'g')!.baseTransform;
      expect(groupLocal.rotation).toBe(0);
      const authoredY = animated.tracks.find((track) => track.partId === 'a')!.channels.y
        .filter((key) => (key.templateId || 'Sequence') === 'Sequence');
      const foldedY = baked.y.filter((key) => (key.templateId || 'Sequence') === 'Sequence');
      expect(foldedY.map((key) => [key.frame, key.easing])).toEqual(authoredY.map((key) => [key.frame, key.easing]));
      foldedY.forEach((key, index) => {
        expect(key.value).toBeCloseTo(groupLocal.y + groupLocal.scaleY * authoredY[index].value, 9);
      });
      expect(baked.x.filter((key) => (key.templateId || 'Sequence') === 'Sequence')).toEqual([]);
      expect(baked.x.filter((key) => key.templateId === 'Boot').map((key) => key.frame)).toEqual([0, 20]);
      // Every local channel is baked for 'Boot' (a stale fallback would leak the
      // child's un-baked value): the travelling channel keeps the container's own
      // key times and the constant ones carry one key each.
      ['y', 'rotation', 'scaleX', 'scaleY'].forEach((localChannel) => {
        expect(baked[localChannel].filter((key) => key.templateId === 'Boot').map((key) => key.frame), localChannel)
          .toEqual([0]);
      });
      expect(baked.opacity.filter((key) => key.templateId === 'Boot')).toHaveLength(0);
    });

    it('ungroups an animated group whose children are static or animated', () => {
      const group = groupOf([makePart('a', -100), makePart('b', 100)], [makeTrack('a'), makeTrack('b')], ['a', 'b']);
      const animatedGroup = {
        parts: group.parts,
        tracks: group.tracks.map((track) => (track.partId === 'g'
          ? { ...track, channels: { ...track.channels, x: channel([[0, 0], [20, 200]]) } }
          : track)),
      };
      expect(ungroupBlockReason(animatedGroup.parts, animatedGroup.tracks, 'g')).toBeNull();
      expect(dissolveLayerGroup(animatedGroup.parts, animatedGroup.tracks, 'g').ok).toBe(true);
    });

    it('refuses an animated group only when a child is pinned by a stage anchor', () => {
      const parts = [makePart('a', -100), makePart('b', 100)];
      const tracks = [makeTrack('a'), makeTrack('b')];
      const group = groupOf(parts, tracks, ['a', 'b']);
      // The anchor is set on a layer that was grouped while it had none — the
      // only way a container can hold one (`groupSelectionBlockReason` refuses
      // to group an anchored layer in the first place).
      const anchored = group.parts.map((part) => (part.id === 'a' ? { ...part, anchor: 'center' as const } : part));
      const animatedGroup = {
        parts: anchored,
        tracks: group.tracks.map((track) => (track.partId === 'g'
          ? { ...track, channels: { ...track.channels, x: channel([[0, 0], [20, 200]]) } }
          : track)),
      };
      // The evaluator re-pins an anchored child's position after keyframe
      // resolution, so a baked position could never survive.
      expect(ungroupBlockReason(animatedGroup.parts, animatedGroup.tracks, 'g'))
        .toBe('An animated group cannot be ungrouped onto "a": a stage anchor pins that layer\'s position. Clear the anchor first.');
      expect(dissolveLayerGroup(animatedGroup.parts, animatedGroup.tracks, 'g')).toEqual({
        ok: false,
        reason: 'An animated group cannot be ungrouped onto "a": a stage anchor pins that layer\'s position. Clear the anchor first.',
      });
      // The same container ungroups as soon as the anchor is cleared.
      const cleared = { parts: group.parts, tracks: animatedGroup.tracks };
      expect(ungroupBlockReason(cleared.parts, cleared.tracks, 'g')).toBeNull();
    });

    it('still ungroups a rotated group whose children are static', () => {
      const parts = [makePart('a', -100), makePart('b', 100)];
      const tracks = [makeTrack('a'), makeTrack('b')];
      const group = groupOf(parts, tracks, ['a', 'b']);
      const rotated = {
        parts: group.parts.map((part) => (part.id === 'g' ? { ...part, baseTransform: { ...part.baseTransform, rotation: 30, scaleX: 1.5 } } : part)),
        tracks: group.tracks,
      };
      const outcome = dissolveLayerGroup(rotated.parts, rotated.tracks, 'g');
      if (!outcome.ok) throw new Error(outcome.reason);
      expectSameEvaluatedPose(rotated, outcome, ['a', 'b'], [0, 5]);
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

      const innerOut = dissolveLayerGroup(transformed.parts, transformed.tracks, 'inner');
      if (!innerOut.ok) throw new Error(innerOut.reason);
      expect(innerOut.parentId).toBe('outer');
      expect(innerOut.parts.filter((part) => part.parentId === 'outer').map((part) => part.id))
        .toEqual(['a', 'b', 'c']);
      expectSamePose(innerOut.parts, innerOut.tracks);

      const outerOut = dissolveLayerGroup(innerOut.parts, innerOut.tracks, 'outer');
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
