import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterPart, LayerMask, Track } from '../types/animator';
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
  getComputedTransform: vi.fn(() => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 })),
  showToast: vi.fn(),
  startBatchInteraction: vi.fn(),
  endBatchInteraction: vi.fn(),
  booleanOperandEditingGroupId: null as string | null,
  setBooleanOperandEditingGroupId: vi.fn(),
};

vi.mock('../context/useAnimator', () => ({ useAnimator: () => animatorCtx }));

import { useBooleanAuthoring } from '../hooks/useBooleanAuthoring';
import { usePartPropertyAuthoring } from '../hooks/usePartPropertyAuthoring';

/** Renders both extracted authorities exactly as DetailsPanel/toolbar consume them. */
const renderAuthoring = () => renderHook(() => ({
  part: usePartPropertyAuthoring(),
  boolean: useBooleanAuthoring(),
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

    expect(animatorCtx.updatePropertyKeyframeValue).toHaveBeenCalledWith('t1', layerMaskChannel('m1', 'feather'), 'k1', 40);
    const [written] = appliedParts([part]);
    expect(written.masks?.[0].feather).toBe(2);
    expect(written.masks?.[0].path).toEqual(mask.path);
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
    expect(animatorCtx.showToast).toHaveBeenCalledWith('Union boolean created', 'success');
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
});
