import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePlayback } from '../hooks/usePlayback';

describe('usePlayback Hook', () => {
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

  it('initializes with default values', () => {
    const { result } = renderHook(() => usePlayback());
    expect(result.current.currentFrame).toBe(0);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.fps).toBe(60);
    expect(result.current.totalFrames).toBe(60);
    expect(result.current.isLooping).toBe(false);
  });

  it('clamps totalFrames between 10 and 1200', () => {
    const { result } = renderHook(() => usePlayback());

    act(() => {
      result.current.setTotalFrames(5);
    });
    expect(result.current.totalFrames).toBe(10);

    act(() => {
      result.current.setTotalFrames(5000);
    });
    expect(result.current.totalFrames).toBe(1200);
  });

  it('increments frames while playing', () => {
    const { result } = renderHook(() => usePlayback());
    
    act(() => {
      result.current.setIsPlaying(true);
    });

    // Fast-forward 1 second (at 60fps, should be 60 frames)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.currentFrame).toBeGreaterThan(0);
  });

  it('stops at totalFrames if not looping', () => {
    const { result } = renderHook(() => usePlayback());
    
    act(() => {
      result.current.setTotalFrames(10);
      result.current.setCurrentFrame(9);
      result.current.setIsPlaying(true);
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.currentFrame).toBe(10);
    expect(result.current.isPlaying).toBe(false);
  });
});
