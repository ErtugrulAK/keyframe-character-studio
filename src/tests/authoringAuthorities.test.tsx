import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterPart, LayerMask, Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/defaults';
import { layerMaskChannel } from '../types/animator';
import { updateShapeAppearance } from '../utils/shapeAppearance';
import { updateTrimPath } from '../utils/trimPathAuthoring';

const shape = (id: string, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id,
  type: 'custom_rect',
  zIndex: 1,
  fillColor: '#336699',
  fillOpacity: 0.5,
  strokeColor: '#101218',
  strokeOpacity: 1,
  width: 100,
  height: 100,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...overrides,
});

const animatorCtx = {
  selectedPartId: null as string | null,
  selectedPartIds: [] as string[],
  characterParts: [] as CharacterPart[],
  setCharacterParts: vi.fn(),
  setTracks: vi.fn(),
  tracks: [] as Track[],
  currentFrame: 0,
  activeTemplateId: 'Sequence',
  updatePropertyKeyframeValue: vi.fn(),
  setSelectedPartId: vi.fn(),
  setSelectedPartIds: vi.fn(),
  getComputedTransform: vi.fn((partId: string) => animatorCtx.characterParts
    .find((part) => part.id === partId)?.baseTransform
    ?? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }),
  showToast: vi.fn(),
  startBatchInteraction: vi.fn(),
  endBatchInteraction: vi.fn(),
  booleanOperandEditingGroupId: null as string | null,
  setBooleanOperandEditingGroupId: vi.fn(),
};

vi.mock('../context/useAnimator', () => ({ useAnimator: () => animatorCtx, useAnimatorSlice: () => animatorCtx, useAnimatorReader: () => () => animatorCtx, useAnimatorAuthority: (create: (state: typeof animatorCtx) => object) => create(animatorCtx) }));

import { useBooleanAuthoring } from '../hooks/useBooleanAuthoring';
import { useLayerGrouping } from '../hooks/useLayerGrouping';
import { usePartBindingAuthoring } from '../hooks/usePartBindingAuthoring';
import { usePartPropertyAuthoring } from '../hooks/usePartPropertyAuthoring';

/** Renders every extracted authority exactly as DetailsPanel/toolbar consume them. */
const renderAuthoring = () => renderHook(() => ({
  part: usePartPropertyAuthoring(),
  boolean: useBooleanAuthoring(),
  grouping: useLayerGrouping(),
  binding: usePartBindingAuthoring(),
}));

/** The document the most recent `setCharacterParts` write would produce. */
const appliedParts = (previous: CharacterPart[]): CharacterPart[] => {
  const calls = animatorCtx.setCharacterParts.mock.calls;
  const updater = calls[calls.length - 1][0] as (parts: CharacterPart[]) => CharacterPart[];
  return updater(previous);
};

describe('shared authoring authorities', () => {
  beforeEach(() => {
    animatorCtx.characterParts = [];
    animatorCtx.tracks = [];
    animatorCtx.selectedPartId = null;
    animatorCtx.selectedPartIds = [];
    vi.clearAllMocks();
  });

  it('routes shape paint edits through the shape-appearance authority', () => {
    const part = shape('a');
    animatorCtx.characterParts = [part];
    animatorCtx.selectedPartId = 'a';
    const authoring = renderAuthoring().result.current;

    authoring.part.handlePartPropChange('fillColor', '#ff0000');
    expect(appliedParts([part])).toEqual([updateShapeAppearance(part, { fillColor: '#ff0000' })]);

    authoring.part.handlePartColorChange('strokeColor', '#00ff00');
    expect(appliedParts([part])).toEqual([updateShapeAppearance(part, { strokeColor: '#00ff00' })]);
  });

  it('routes Trim Path edits through the Trim Path authority', () => {
    const part = shape('a');
    animatorCtx.characterParts = [part];
    animatorCtx.selectedPartId = 'a';
    const authoring = renderAuthoring().result.current;

    authoring.part.handlePartPropChange('trimPathEnd', 0.25);
    expect(appliedParts([part])).toEqual([updateTrimPath(part, { trimPathEnd: 0.25 })]);
  });

  it('passes every other property straight through, including the layer index', () => {
    const part = shape('a');
    animatorCtx.characterParts = [part];
    animatorCtx.selectedPartId = 'a';
    const authoring = renderAuthoring().result.current;

    authoring.part.handlePartPropChange('name', 'Renamed');
    expect(appliedParts([part])).toEqual([{ ...part, name: 'Renamed' }]);

    authoring.part.handleZIndexChange(7);
    expect(appliedParts([part])).toEqual([{ ...part, zIndex: 7 }]);
  });

  it('writes a keyframed mask scalar to the keyframe and keeps the base mask value', () => {
    const mask: LayerMask = {
      id: 'm1',
      name: 'Mask',
      mode: 'add',
      feather: 2,
      opacity: 1,
      path: { version: 1, coordinateSpace: 'local', closed: true, points: [] },
    };
    const part = shape('a', { masks: [mask] });
    const track = {
      id: 't1',
      partId: 'a',
      maskChannels: {
        [layerMaskChannel('m1', 'feather')]: [{ id: 'k1', frame: 0, value: 10, easing: 'linear' as const }],
      },
    } as unknown as Track;
    animatorCtx.characterParts = [part];
    animatorCtx.tracks = [track];
    animatorCtx.selectedPartId = 'a';
    const authoring = renderAuthoring().result.current;

    const edited: LayerMask = { ...mask, feather: 40 };
    authoring.part.handleDisplayedPartPropChange('masks', [edited]);

    // WP-01: the exact-frame key is updated in place through the track mutator,
    // so its id, frame, easing and sequence survive.
    const trackCalls = animatorCtx.setTracks.mock.calls;
    const [writtenTrack] = (trackCalls[trackCalls.length - 1][0] as (tracks: Track[]) => Track[])([track]);
    expect(writtenTrack.maskChannels?.[layerMaskChannel('m1', 'feather')]).toEqual([
      { id: 'k1', frame: 0, value: 40, easing: 'linear' },
    ]);
    const [written] = appliedParts([part]);
    expect(written.masks?.[0].feather).toBe(2);
    expect(written.masks?.[0].path).toEqual(mask.path);
  });

  it('writes an edited mask scalar to the base mask when the layer has no track (WP-01)', () => {
    const mask: LayerMask = {
      id: 'm1',
      name: 'Mask',
      mode: 'add',
      feather: 2,
      path: { version: 1, coordinateSpace: 'local', closed: true, points: [] },
    };
    const part = shape('a', { masks: [mask] });
    animatorCtx.characterParts = [part];
    animatorCtx.tracks = [];
    animatorCtx.selectedPartId = 'a';
    const authoring = renderAuthoring().result.current;

    // The Inspector shows evaluated defaults (opacity 1, expansion 0) the base
    // mask does not store; only the edited feather may reach the base mask.
    authoring.part.handleDisplayedPartPropChange('masks', [{ ...mask, feather: 9, opacity: 1, expansion: 0 }]);

    expect(animatorCtx.setTracks).not.toHaveBeenCalled();
    const [written] = appliedParts([part]);
    expect(written.masks).toEqual([{ ...mask, feather: 9 }]);
    expect(written.masks?.[0]).not.toHaveProperty('opacity');
  });

  it('creates a Boolean group from two eligible operands through one batch', () => {
    const a = shape('a');
    const b = shape('b', { baseTransform: { x: 40, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } });
    animatorCtx.characterParts = [a, b];
    animatorCtx.selectedPartIds = ['a', 'b'];
    animatorCtx.selectedPartId = 'b';
    const authoring = renderAuthoring().result.current;

    authoring.boolean.createBooleanGroup('union');

    expect(animatorCtx.startBatchInteraction).toHaveBeenCalledTimes(1);
    expect(animatorCtx.endBatchInteraction).toHaveBeenCalledTimes(1);
    const next = appliedParts([a, b]);
    const group = next.find((part) => part.booleanOperandIds?.length === 2);
    expect(group?.booleanOperation).toBe('union');
    expect(next.filter((part) => part.booleanGroupId === group?.id).map((part) => part.id)).toEqual(['a', 'b']);
    expect(animatorCtx.setTracks).toHaveBeenCalledTimes(1);
    expect(animatorCtx.setSelectedPartIds).toHaveBeenCalledWith([group?.id]);
    expect(animatorCtx.setSelectedPartId).toHaveBeenCalledWith(group?.id);
    // C8: a visible result needs no confirmation toast.
    expect(animatorCtx.showToast).not.toHaveBeenCalled();
  });

  it('refuses Boolean creation below two eligible operands', () => {
    const a = shape('a');
    animatorCtx.characterParts = [a];
    animatorCtx.selectedPartIds = ['a'];
    animatorCtx.selectedPartId = 'a';
    const authoring = renderAuthoring().result.current;

    authoring.boolean.createBooleanGroup('union');
    expect(animatorCtx.setCharacterParts).not.toHaveBeenCalled();
  });

  it('groups the selection in one batch, re-parents the layers and selects the container', () => {
    const a = shape('a', { baseTransform: { x: -100, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } });
    const b = shape('b', { baseTransform: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } });
    animatorCtx.characterParts = [a, b];
    animatorCtx.selectedPartIds = ['a', 'b'];
    animatorCtx.selectedPartId = 'b';
    const authoring = renderAuthoring().result.current;

    expect(authoring.grouping.canGroup).toBe(true);
    authoring.grouping.groupSelection();

    expect(animatorCtx.startBatchInteraction).toHaveBeenCalledTimes(1);
    expect(animatorCtx.endBatchInteraction).toHaveBeenCalledTimes(1);
    const next = animatorCtx.setCharacterParts.mock.calls[0][0] as CharacterPart[];
    const group = next.find((part) => part.isGroup)!;
    expect(group.type).toBe('custom_freeform');
    expect(group.baseTransform.x).toBe(0);
    expect(next.filter((part) => part.parentId === group.id).map((part) => part.id)).toEqual(['a', 'b']);
    expect(animatorCtx.setTracks).toHaveBeenCalledTimes(1);
    expect(animatorCtx.setSelectedPartIds).toHaveBeenCalledWith([group.id]);
    expect(animatorCtx.setSelectedPartId).toHaveBeenCalledWith(group.id);
    // C8: a visible result needs no confirmation toast.
    expect(animatorCtx.showToast).not.toHaveBeenCalled();
  });

  it('reports why a single layer cannot be grouped instead of writing state', () => {
    animatorCtx.characterParts = [shape('a')];
    animatorCtx.selectedPartIds = ['a'];
    animatorCtx.selectedPartId = 'a';
    const authoring = renderAuthoring().result.current;

    expect(authoring.grouping.canGroup).toBe(false);
    expect(authoring.grouping.groupBlockReason).toBe('Select at least two layers to group.');
    authoring.grouping.groupSelection();
    expect(animatorCtx.setCharacterParts).not.toHaveBeenCalled();
    expect(animatorCtx.showToast).toHaveBeenCalledWith('Select at least two layers to group.', 'error');
  });

  it('ungroups the selected container, keeps the layers and removes the container track', () => {
    const group = shape('g', { isGroup: true }) as CharacterPart;
    const a = shape('a', { parentId: 'g' });
    const b = shape('b', { parentId: 'g' });
    animatorCtx.characterParts = [a, b, group];
    animatorCtx.tracks = [
      { id: 't_a', partId: 'a', name: 'a', color: '#fff', visible: true, locked: false, keyframes: [], channels: makeEmptyChannels() },
      { id: 't_g', partId: 'g', name: 'g', color: '#fff', visible: true, locked: false, keyframes: [], channels: makeEmptyChannels() },
    ];
    animatorCtx.selectedPartIds = ['g'];
    animatorCtx.selectedPartId = 'g';
    const authoring = renderAuthoring().result.current;

    expect(authoring.grouping.selectedGroup?.id).toBe('g');
    authoring.grouping.ungroupSelection();

    const next = animatorCtx.setCharacterParts.mock.calls[0][0] as CharacterPart[];
    expect(next.map((part) => part.id)).toEqual(['a', 'b']);
    expect(next.every((part) => part.parentId === undefined)).toBe(true);
    const nextTracks = animatorCtx.setTracks.mock.calls[0][0] as Track[];
    expect(nextTracks.map((track) => track.partId)).toEqual(['a']);
    expect(animatorCtx.setSelectedPartIds).toHaveBeenCalledWith(['a', 'b']);
    expect(animatorCtx.setSelectedPartId).toHaveBeenCalledWith('a');
    // C8: a visible result needs no confirmation toast.
    expect(animatorCtx.showToast).not.toHaveBeenCalled();
  });

  it('bonds the selection in one batch, through the shared bind authority', () => {
    const a = shape('a');
    const b = shape('b');
    animatorCtx.characterParts = [a, b];
    animatorCtx.selectedPartIds = ['a', 'b'];
    animatorCtx.selectedPartId = 'b';
    const authoring = renderAuthoring().result.current;

    expect(authoring.binding.canBind).toBe(true);
    authoring.binding.bindSelection();

    expect(animatorCtx.startBatchInteraction).toHaveBeenCalledTimes(1);
    expect(animatorCtx.endBatchInteraction).toHaveBeenCalledTimes(1);
    const next = appliedParts([a, b]);
    expect(next.find((part) => part.id === 'a')?.boundPartIds).toEqual(['b']);
    expect(next.find((part) => part.id === 'b')?.boundPartIds).toEqual(['a']);
    // C8: a visible result needs no confirmation toast.
    expect(animatorCtx.showToast).not.toHaveBeenCalled();
  });

  it('refuses to bond a parent and its own child, and reports why', () => {
    const parent = shape('p');
    const child = shape('c', { parentId: 'p' });
    animatorCtx.characterParts = [parent, child];
    animatorCtx.selectedPartIds = ['p', 'c'];
    animatorCtx.selectedPartId = 'c';
    const authoring = renderAuthoring().result.current;

    expect(authoring.binding.canBind).toBe(false);
    expect(authoring.binding.bindBlockReason)
      .toBe('Those layers are already parent and child; bonding them would move the child twice.');
    authoring.binding.bindSelection();
    expect(animatorCtx.setCharacterParts).not.toHaveBeenCalled();
    expect(animatorCtx.showToast).toHaveBeenCalledWith(
      'Those layers are already parent and child; bonding them would move the child twice.',
      'info',
    );
  });

  it('releases the bond of the selected layer and reports an unbonded selection instead', () => {
    const a = shape('a', { boundPartIds: ['b'] });
    const b = shape('b', { boundPartIds: ['a'] });
    const free = shape('free');
    animatorCtx.characterParts = [a, b, free];
    animatorCtx.selectedPartId = 'a';
    animatorCtx.selectedPartIds = ['a'];
    const authoring = renderAuthoring().result.current;

    expect(authoring.binding.canRelease).toBe(true);
    authoring.binding.releaseBinding();
    const next = appliedParts([a, b, free]);
    expect(next.find((part) => part.id === 'a')?.boundPartIds).toBeUndefined();
    expect(next.find((part) => part.id === 'b')?.boundPartIds).toBeUndefined();
    // C8: a visible result needs no confirmation toast.
    expect(animatorCtx.showToast).not.toHaveBeenCalled();

    vi.clearAllMocks();
    animatorCtx.selectedPartId = 'free';
    animatorCtx.selectedPartIds = ['free'];
    const second = renderAuthoring().result.current;
    expect(second.binding.canRelease).toBe(false);
    second.binding.releaseBinding();
    expect(animatorCtx.setCharacterParts).not.toHaveBeenCalled();
    // A refusal still says why nothing happened.
    expect(animatorCtx.showToast).toHaveBeenCalledWith('Select a bonded layer to release its bond.', 'info');
  });
});
