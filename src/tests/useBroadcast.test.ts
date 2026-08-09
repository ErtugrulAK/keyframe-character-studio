import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBroadcast } from '../hooks/useBroadcast';
import { CharacterPart, Track, CustomMotionPreset } from '../types/animator';

describe('useBroadcast Hook', () => {
  const mockSetIsPlaying = vi.fn();
  const mockSetCurrentFrame = vi.fn();

  let mockRaf: any;
  let mockCancelRaf: any;

  beforeEach(() => {
    mockRaf = vi.fn((cb: any) => {
      return setTimeout(() => cb(performance.now()), 16) as any;
    });
    mockCancelRaf = vi.fn((id: any) => {
      clearTimeout(id);
    });
    window.requestAnimationFrame = mockRaf;
    window.cancelAnimationFrame = mockCancelRaf;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('initializes with design mode', () => {
    const { result } = renderHook(() => useBroadcast({
      setIsPlaying: mockSetIsPlaying,
      setCurrentFrame: mockSetCurrentFrame,
      tracksRef: { current: [] },
      characterPartsRef: { current: [] },
      customPresetsRef: { current: [] },
      fpsRef: { current: 30 }
    }));

    expect(result.current.appMode).toBe('edit');
    expect(result.current.broadcastState).toEqual({});
    expect(result.current.liveStuntsState).toEqual({});
  });

  it('switches to broadcast mode and stops playback', () => {
    const { result } = renderHook(() => useBroadcast({
      setIsPlaying: mockSetIsPlaying,
      setCurrentFrame: mockSetCurrentFrame,
      tracksRef: { current: [] },
      characterPartsRef: { current: [] },
      customPresetsRef: { current: [] },
      fpsRef: { current: 30 }
    }));

    act(() => {
      result.current.setAppMode('broadcast');
    });

    expect(result.current.appMode).toBe('broadcast');
    expect(mockSetIsPlaying).toHaveBeenCalledWith(false);
    expect(mockSetCurrentFrame).toHaveBeenCalledWith(0);
  });

  it('triggers broadcast in for a part', () => {
    const mockParts: CharacterPart[] = [{ id: 'p1', type: 'head', name: 'Head', zIndex: 1, baseTransform: { x:0, y:0, rotation:0, scaleX:1, scaleY:1, opacity:1 } }];
    const { result } = renderHook(() => useBroadcast({
      setIsPlaying: mockSetIsPlaying,
      setCurrentFrame: mockSetCurrentFrame,
      tracksRef: { current: [] },
      characterPartsRef: { current: mockParts },
      customPresetsRef: { current: [] },
      fpsRef: { current: 30 }
    }));

    act(() => {
      result.current.setAppMode('broadcast');
    });

    act(() => {
      result.current.triggerBroadcastIn('p1');
    });

    expect(result.current.broadcastState['p1']).toBeDefined();
    expect(result.current.broadcastState['p1'].state).toBe('animating_in');
    expect(result.current.broadcastState['p1'].progress).toBe(0);
  });

  it('triggerAllBroadcastIn animates visible parts and skips hidden tracks', () => {
    const mockParts: CharacterPart[] = [
      { id: 'p1', type: 'head', name: 'Head', zIndex: 1, baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } },
      { id: 'p2', type: 'torso', name: 'Torso', zIndex: 2, baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } },
    ];
    const mockTracks = [
      { id: 't1', partId: 'p1', name: 'T1', color: '#f00', visible: true, keyframes: [], channels: {} },
      { id: 't2', partId: 'p2', name: 'T2', color: '#0f0', visible: false, keyframes: [], channels: {} },
    ] as any[];

    const { result } = renderHook(() => useBroadcast({
      setIsPlaying: mockSetIsPlaying,
      setCurrentFrame: mockSetCurrentFrame,
      tracksRef: { current: mockTracks },
      characterPartsRef: { current: mockParts },
      customPresetsRef: { current: [] },
      fpsRef: { current: 30 }
    }));

    act(() => {
      result.current.setAppMode('broadcast');
    });

    act(() => {
      result.current.triggerAllBroadcastIn();
    });

    // visible part animates in
    expect(result.current.broadcastState['p1']).toBeDefined();
    expect(result.current.broadcastState['p1'].state).toBe('animating_in');
    expect(result.current.broadcastState['p1'].progress).toBe(0);
    // hidden-track part is skipped entirely
    expect(result.current.broadcastState['p2']).toBeUndefined();
  });
});
