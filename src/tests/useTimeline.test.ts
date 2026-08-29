import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTimeline } from '../hooks/useTimeline';
import { Track, CharacterPart } from '../types/animator';
import { makeEmptyChannels } from '../utils/defaults';

describe('useTimeline Hook', () => {
  const mockSetCharacterParts = vi.fn();
  const mockSetTracks = vi.fn();
  const mockSetSelectedPartId = vi.fn();
  const mockSetSelectedPartIds = vi.fn();
  const mockSetSelectedKeyframeId = vi.fn();
  const mockGetComputedTransform = vi.fn().mockReturnValue({ x:0, y:0, rotation:0, scaleX:1, scaleY:1, opacity:1 });
  const mockShowToast = vi.fn();

  const mockParts: CharacterPart[] = [
    { id: 'p1', type: 'head', name: 'Head', zIndex: 1, baseTransform: { x:0, y:0, rotation:0, scaleX:1, scaleY:1, opacity:1 } }
  ];

  const mockTracks: Track[] = [
    { id: 't1', partId: 'p1', name: 'Head Track', channels: { customProps: [] }, keyframes: [] }
  ] as any;

  it('initializes timeline state', () => {
    const { result } = renderHook(() => useTimeline({
      characterParts: mockParts,
      setCharacterParts: mockSetCharacterParts,
      tracks: mockTracks,
      setTracks: mockSetTracks,
      selectedPartId: 'p1',
      setSelectedPartId: mockSetSelectedPartId,
      selectedPartIds: ['p1'],
      setSelectedPartIds: mockSetSelectedPartIds,
      selectedKeyframeId: null,
      setSelectedKeyframeId: mockSetSelectedKeyframeId,
      currentFrame: 0,
      totalFrames: 60,
      activeTemplateId: 'Sequence',
      getComputedTransform: mockGetComputedTransform,
      showToast: mockShowToast
    }));

    expect(result.current.timelineZoom).toBe(18);
    expect(result.current.showGrid).toBe(true);
  });

  it('deletes a part and associated track', () => {
    const { result } = renderHook(() => useTimeline({
      characterParts: mockParts,
      setCharacterParts: mockSetCharacterParts,
      tracks: mockTracks,
      setTracks: mockSetTracks,
      selectedPartId: 'p1',
      setSelectedPartId: mockSetSelectedPartId,
      selectedPartIds: ['p1'],
      setSelectedPartIds: mockSetSelectedPartIds,
      selectedKeyframeId: null,
      setSelectedKeyframeId: mockSetSelectedKeyframeId,
      currentFrame: 0,
      totalFrames: 60,
      activeTemplateId: 'Sequence',
      getComputedTransform: mockGetComputedTransform,
      showToast: mockShowToast
    }));

    act(() => {
      result.current.deletePart('p1');
    });

    expect(mockSetCharacterParts).toHaveBeenCalled();
    expect(mockSetTracks).toHaveBeenCalled();
    expect(mockSetSelectedPartId).toHaveBeenCalledWith(null);
    expect(mockSetSelectedPartIds).toHaveBeenCalledWith([]);
  });

  it('deletes a Boolean parent, owned operands, tracks, and editing state', () => {
    const group = { ...mockParts[0], id: 'group', booleanOperandIds: ['a', 'b'], booleanOperation: 'union' as const };
    const operandA = { ...mockParts[0], id: 'a', booleanGroupId: 'group' };
    const operandB = { ...mockParts[0], id: 'b', booleanGroupId: 'group' };
    const unrelated = { ...mockParts[0], id: 'circle' };
    const parts = [group, operandA, operandB, unrelated];
    const tracks = parts.map((item) => ({ ...mockTracks[0], id: `${item.id}-track`, partId: item.id }));
    const setBooleanOperandEditingGroupId = vi.fn();
    const { result } = renderHook(() => useTimeline({
      characterParts: parts,
      setCharacterParts: mockSetCharacterParts,
      tracks,
      setTracks: mockSetTracks,
      selectedPartId: 'group',
      setSelectedPartId: mockSetSelectedPartId,
      selectedPartIds: ['group'],
      setSelectedPartIds: mockSetSelectedPartIds,
      booleanOperandEditingGroupId: 'group',
      setBooleanOperandEditingGroupId,
      selectedKeyframeId: 'group-key',
      setSelectedKeyframeId: mockSetSelectedKeyframeId,
      currentFrame: 0,
      totalFrames: 60,
      activeTemplateId: 'Sequence',
      getComputedTransform: mockGetComputedTransform,
      showToast: mockShowToast,
    }));

    act(() => result.current.deletePart('group'));

    const nextParts = mockSetCharacterParts.mock.calls.at(-1)![0] as CharacterPart[];
    const nextTracks = mockSetTracks.mock.calls.at(-1)![0] as Track[];
    expect(nextParts.map((item) => item.id)).toEqual(['circle']);
    expect(nextTracks.map((item) => item.partId)).toEqual(['circle']);
    expect(mockSetSelectedPartIds).toHaveBeenCalledWith([]);
    expect(mockSetSelectedKeyframeId).toHaveBeenCalledWith(null);
    expect(mockSetSelectedPartId).toHaveBeenCalledWith(null);
    expect(setBooleanOperandEditingGroupId).toHaveBeenCalledWith(null);
  });

  it('toggles track visibility', () => {
    const { result } = renderHook(() => useTimeline({
      characterParts: mockParts,
      setCharacterParts: mockSetCharacterParts,
      tracks: mockTracks,
      setTracks: mockSetTracks,
      selectedPartId: 'p1',
      setSelectedPartId: mockSetSelectedPartId,
      selectedPartIds: ['p1'],
      setSelectedPartIds: mockSetSelectedPartIds,
      selectedKeyframeId: null,
      setSelectedKeyframeId: mockSetSelectedKeyframeId,
      currentFrame: 0,
      totalFrames: 60,
      activeTemplateId: 'Sequence',
      getComputedTransform: mockGetComputedTransform,
      showToast: mockShowToast
    }));

    act(() => {
      result.current.toggleTrackVisibility('t1');
    });

    expect(mockSetTracks).toHaveBeenCalled();
  });

  it('deletes the selected canonical frame group in one update and clears selection', () => {
    const channels = makeEmptyChannels();
    channels.x = [
      { id: 'x10', frame: 10, value: 10, easing: 'linear', templateId: 'Sequence' },
      { id: 'x20', frame: 20, value: 20, easing: 'linear', templateId: 'Sequence' },
    ];
    channels.y = [{ id: 'y10', frame: 10, value: 30, easing: 'linear', templateId: 'Sequence' }];
    const track = { ...mockTracks[0], channels } as Track;
    const setTracks = vi.fn();
    const setSelectedKeyframeId = vi.fn();
    const { result } = renderHook(() => useTimeline({
      setCharacterParts: mockSetCharacterParts,
      tracks: [track],
      setTracks,
      selectedPartId: 'p1',
      setSelectedPartId: mockSetSelectedPartId,
      selectedPartIds: ['p1'],
      setSelectedPartIds: mockSetSelectedPartIds,
      selectedKeyframeId: 'x10',
      setSelectedKeyframeId,
      currentFrame: 10,
      totalFrames: 60,
      activeTemplateId: 'Sequence',
      getComputedTransform: mockGetComputedTransform,
      showToast: mockShowToast,
    }));

    let deleted = false;
    act(() => { deleted = result.current.deleteSelectedKeyframe(); });

    expect(deleted).toBe(true);
    expect(setTracks).toHaveBeenCalledOnce();
    const updated = setTracks.mock.calls[0][0]([track]) as Track[];
    expect(updated[0].channels.x.map((keyframe) => keyframe.id)).toEqual(['x20']);
    expect(updated[0].channels.y).toEqual([]);
    expect(setSelectedKeyframeId).toHaveBeenCalledWith(null);
  });

  it('does not mutate or clear an invalid keyframe selection', () => {
    const setTracks = vi.fn();
    const setSelectedKeyframeId = vi.fn();
    const { result } = renderHook(() => useTimeline({
      setCharacterParts: mockSetCharacterParts,
      tracks: mockTracks,
      setTracks,
      selectedPartId: 'p1',
      setSelectedPartId: mockSetSelectedPartId,
      selectedPartIds: ['p1'],
      setSelectedPartIds: mockSetSelectedPartIds,
      selectedKeyframeId: 'missing',
      setSelectedKeyframeId,
      currentFrame: 0,
      totalFrames: 60,
      activeTemplateId: 'Sequence',
      getComputedTransform: mockGetComputedTransform,
      showToast: mockShowToast,
    }));

    expect(result.current.deleteSelectedKeyframe()).toBe(false);
    expect(setTracks).not.toHaveBeenCalled();
    expect(setSelectedKeyframeId).not.toHaveBeenCalled();
  });
});
