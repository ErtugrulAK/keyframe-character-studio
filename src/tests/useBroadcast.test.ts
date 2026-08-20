import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { useBroadcast } from '../hooks/useBroadcast';
import { CharacterPart } from '../types/animator';

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
      characterParts: [],
      characterPartsRef: { current: [] },
      customPresetsRef: { current: [] },
      fpsRef: { current: 30 }
    }));

    expect(result.current.appMode).toBe('edit');
    expect(result.current.broadcastState).toEqual({});
    expect(result.current.broadcastSessionActivated).toBe(false);
    expect(result.current.liveStuntsState).toEqual({});
    expect(result.current.namedSequenceRuntime).toEqual({
      sequenceId: null,
      status: 'idle',
      frame: 0,
      durationFrames: 0,
    });
  });

  it('switches to broadcast mode, stops edit playback, and preserves the edit playhead', () => {
    const { result } = renderHook(() => useBroadcast({
      setIsPlaying: mockSetIsPlaying,
      setCurrentFrame: mockSetCurrentFrame,
      tracksRef: { current: [] },
      characterParts: [],
      characterPartsRef: { current: [] },
      customPresetsRef: { current: [] },
      fpsRef: { current: 30 }
    }));

    act(() => {
      result.current.setAppMode('broadcast');
    });

    expect(result.current.appMode).toBe('broadcast');
    expect(result.current.broadcastSessionActivated).toBe(false);
    expect(mockSetIsPlaying).toHaveBeenCalledWith(false);
    expect(mockSetCurrentFrame).not.toHaveBeenCalled();
  });

  it('keeps edit frame 60 across named-sequence play, interrupt, replay, and Broadcast exit', () => {
    const { result } = renderHook(() => {
      const [currentFrame, setCurrentFrame] = useState(60);
      const broadcast = useBroadcast({
        setIsPlaying: mockSetIsPlaying,
        setCurrentFrame,
        tracksRef: { current: [] },
        characterParts: [],
        characterPartsRef: { current: [] },
        customPresetsRef: { current: [] },
        fpsRef: { current: 30 },
        showToast: vi.fn(),
      });
      return { currentFrame, broadcast };
    });

    act(() => result.current.broadcast.setAppMode('broadcast'));
    expect(result.current.currentFrame).toBe(60);

    act(() => result.current.broadcast.playNamedSequence('IN', 30));
    expect(result.current.broadcast.broadcastSessionActivated).toBe(true);
    expect(result.current.broadcast.namedSequenceRuntime.frame).toBe(0);
    act(() => vi.advanceTimersByTime(160));
    expect(result.current.broadcast.namedSequenceRuntime.frame).toBeGreaterThan(0);
    expect(result.current.currentFrame).toBe(60);

    act(() => result.current.broadcast.playNamedSequence('OUT', 30));
    expect(result.current.broadcast.namedSequenceRuntime).toMatchObject({ sequenceId: 'OUT', frame: 0 });
    expect(result.current.currentFrame).toBe(60);

    act(() => result.current.broadcast.playNamedSequence('IN', 30));
    expect(result.current.broadcast.namedSequenceRuntime).toMatchObject({ sequenceId: 'IN', frame: 0 });
    expect(result.current.currentFrame).toBe(60);

    act(() => result.current.broadcast.setAppMode('edit'));
    expect(result.current.currentFrame).toBe(60);

    act(() => result.current.broadcast.setAppMode('broadcast'));
    expect(result.current.broadcast.broadcastSessionActivated).toBe(false);
    expect(result.current.currentFrame).toBe(60);
  });

  it('triggers broadcast in for a part', () => {
    const mockParts: CharacterPart[] = [{ id: 'p1', type: 'head', name: 'Head', zIndex: 1, baseTransform: { x:0, y:0, rotation:0, scaleX:1, scaleY:1, opacity:1 } }];
    const { result } = renderHook(() => useBroadcast({
      setIsPlaying: mockSetIsPlaying,
      setCurrentFrame: mockSetCurrentFrame,
      tracksRef: { current: [] },
      characterParts: mockParts,
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
      characterParts: mockParts,
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

  it('ticks named sequences through the existing broadcast RAF and holds the final frame', () => {
    const { result } = renderHook(() => useBroadcast({
      setIsPlaying: mockSetIsPlaying,
      setCurrentFrame: mockSetCurrentFrame,
      tracksRef: { current: [] },
      characterParts: [],
      characterPartsRef: { current: [] },
      customPresetsRef: { current: [] },
      fpsRef: { current: 30 },
      showToast: vi.fn(),
    }));

    act(() => result.current.setAppMode('broadcast'));
    mockSetIsPlaying.mockClear();
    mockSetCurrentFrame.mockClear();

    act(() => result.current.playNamedSequence('SPECIAL', 30));
    expect(result.current.namedSequenceRuntime).toEqual({
      sequenceId: 'SPECIAL', status: 'playing', frame: 0, durationFrames: 30,
    });

    act(() => vi.advanceTimersByTime(500));
    expect(result.current.namedSequenceRuntime.status).toBe('playing');
    expect(result.current.namedSequenceRuntime.frame).toBeGreaterThan(0);
    expect(result.current.namedSequenceRuntime.frame).toBeLessThan(30);

    act(() => vi.advanceTimersByTime(600));
    expect(result.current.namedSequenceRuntime).toEqual({
      sequenceId: 'SPECIAL', status: 'holding', frame: 30, durationFrames: 30,
    });

    act(() => vi.advanceTimersByTime(500));
    expect(result.current.namedSequenceRuntime.frame).toBe(30);
    expect(result.current.namedSequenceRuntime.status).toBe('holding');
    expect(mockSetIsPlaying).not.toHaveBeenCalled();
    expect(mockSetCurrentFrame).not.toHaveBeenCalled();
  });

  it('replays, interrupts, and treats sequence identities without name semantics', () => {
    const { result } = renderHook(() => useBroadcast({
      setIsPlaying: mockSetIsPlaying,
      setCurrentFrame: mockSetCurrentFrame,
      tracksRef: { current: [] },
      characterParts: [],
      characterPartsRef: { current: [] },
      customPresetsRef: { current: [] },
      fpsRef: { current: 30 },
      showToast: vi.fn(),
    }));

    act(() => result.current.setAppMode('broadcast'));

    for (const sequenceId of ['IN', 'OUT', 'SPECIAL']) {
      act(() => result.current.playNamedSequence(sequenceId, 10));
      expect(result.current.namedSequenceRuntime).toEqual({
        sequenceId, status: 'playing', frame: 0, durationFrames: 10,
      });
    }

    act(() => vi.advanceTimersByTime(400));
    expect(result.current.namedSequenceRuntime.status).toBe('holding');

    act(() => result.current.playNamedSequence('SPECIAL', 10));
    expect(result.current.namedSequenceRuntime.status).toBe('playing');
    expect(result.current.namedSequenceRuntime.frame).toBe(0);

    act(() => vi.advanceTimersByTime(160));
    act(() => result.current.playNamedSequence('OTHER', 20));
    expect(result.current.namedSequenceRuntime).toEqual({
      sequenceId: 'OTHER', status: 'playing', frame: 0, durationFrames: 20,
    });
  });

  it('stops named runtime progression outside broadcast while legacy transition and stunt ticking remain active', () => {
    const part: CharacterPart = {
      id: 'p1', type: 'head', name: 'Head', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    };
    const { result } = renderHook(() => useBroadcast({
      setIsPlaying: mockSetIsPlaying,
      setCurrentFrame: mockSetCurrentFrame,
      tracksRef: { current: [] },
      characterParts: [part],
      characterPartsRef: { current: [part] },
      customPresetsRef: { current: [] },
      fpsRef: { current: 30 },
      showToast: vi.fn(),
    }));

    act(() => result.current.setAppMode('broadcast'));
    act(() => {
      result.current.triggerBroadcastIn('p1');
      result.current.triggerLiveStunt('p1', 'bounce');
      result.current.playNamedSequence('SPECIAL', 60);
    });
    expect(result.current.broadcastSessionActivated).toBe(true);
    act(() => vi.advanceTimersByTime(160));

    expect(result.current.broadcastState.p1.progress).toBeGreaterThan(0);
    expect(result.current.liveStuntsState.p1.progress).toBeGreaterThan(0);
    expect(result.current.namedSequenceRuntime.frame).toBeGreaterThan(0);

    act(() => result.current.triggerBroadcastOut('p1'));
    expect(result.current.broadcastState.p1).toEqual({ state: 'animating_out', progress: 0 });
    act(() => vi.advanceTimersByTime(160));
    expect(result.current.broadcastState.p1.state).toBe('animating_out');
    expect(result.current.broadcastState.p1.progress).toBeGreaterThan(0);
    expect(result.current.liveStuntsState.p1.progress).toBeGreaterThan(0);

    act(() => result.current.setAppMode('edit'));
    expect(result.current.namedSequenceRuntime.status).toBe('idle');
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.namedSequenceRuntime).toEqual({
      sequenceId: null, status: 'idle', frame: 0, durationFrames: 0,
    });
  });
});
