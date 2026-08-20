import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useInspector } from '../hooks/useInspector';
import { Track } from '../types/animator';

describe('useInspector Hook', () => {
  const mockSetTracks = vi.fn();
  const mockSetCharacterParts = vi.fn();
  const mockGetComputedTransform = vi.fn().mockReturnValue({ x:0, y:0, rotation:0, scaleX:1, scaleY:1, opacity:1 });
  const mockAddKeyframeToTrack = vi.fn();

  const mockTracks: Track[] = [
    {
      id: 'track_1', partId: 'part_1', name: 'T1', channels: { customProps: [] },
      keyframes: [{ id: 'kf_1', frame: 0, templateId: 'Sequence', transform: { x:0, y:0, rotation:0, scaleX:1, scaleY:1, opacity:1 }, easing: 'linear' }]
    }
  ] as any;

  it('updates current transform on existing keyframe', () => {
    const { result } = renderHook(() => useInspector({
      selectedPartId: 'part_1',
      selectedPartIds: ['part_1'],
      activeTemplateId: 'Sequence',
      currentFrame: 0,
      tracks: mockTracks,
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      getComputedTransform: mockGetComputedTransform,
      addKeyframeToTrack: mockAddKeyframeToTrack
    }));

    act(() => {
      result.current.updateCurrentTransform({ x: 50 });
    });

    expect(mockSetTracks).toHaveBeenCalled();
    const updateFn = mockSetTracks.mock.calls[0][0];
    const newTracks = updateFn(mockTracks);
    expect(newTracks[0].keyframes[0].transform.x).toBe(50);
  });

  it('adds keyframe if none exists on current frame when updating transform', () => {
    const { result } = renderHook(() => useInspector({
      selectedPartId: 'part_1',
      selectedPartIds: ['part_1'],
      activeTemplateId: 'Sequence',
      currentFrame: 10, // No keyframe at 10
      tracks: mockTracks,
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      getComputedTransform: mockGetComputedTransform,
      addKeyframeToTrack: mockAddKeyframeToTrack
    }));

    act(() => {
      result.current.updateCurrentTransform({ y: 100 });
    });

    expect(mockAddKeyframeToTrack).toHaveBeenCalledWith('track_1', 10);
  });
});
