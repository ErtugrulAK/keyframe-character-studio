import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTimeline } from '../hooks/useTimeline';
import { Track, CharacterPart } from '../types/animator';

describe('useTimeline Hook', () => {
  const mockSetCharacterParts = vi.fn();
  const mockSetTracks = vi.fn();
  const mockSetSelectedPartId = vi.fn();
  const mockSetSelectedPartIds = vi.fn();
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
      currentFrame: 0,
      totalFrames: 60,
      activeTemplateId: 'Sequence',
      getComputedTransform: mockGetComputedTransform,
      showToast: mockShowToast
    }));

    expect(result.current.timelineZoom).toBe(1);
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
});
