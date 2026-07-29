import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useHistory } from '../hooks/useHistory';

describe('useHistory Hook', () => {
  const mockSetTracks = vi.fn();
  const mockSetCharacterParts = vi.fn();

  it('initializes with empty history', () => {
    const { result } = renderHook(() => useHistory({
      tracks: [],
      setTracks: mockSetTracks,
      tracksRef: { current: [] },
      characterParts: [],
      setCharacterParts: mockSetCharacterParts,
      characterPartsRef: { current: [] }
    }));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('records state changes', () => {
    let currentTracks: any[] = [];
    const { result, rerender } = renderHook((props: any) => useHistory({
      tracks: props.tracks,
      setTracks: mockSetTracks,
      tracksRef: { current: props.tracks },
      characterParts: [],
      setCharacterParts: mockSetCharacterParts,
      characterPartsRef: { current: [] }
    }), {
      initialProps: { tracks: currentTracks }
    });

    // Simulate tracks changing
    currentTracks = [{ id: 't1', partId: 'p1', name: 'T1', keyframes: [] }];
    rerender({ tracks: currentTracks });

    expect(result.current.canUndo).toBe(true);
  });

  it('handles batch interaction correctly', () => {
    let currentTracks: any[] = [];
    const { result, rerender } = renderHook((props: any) => useHistory({
      tracks: props.tracks,
      setTracks: mockSetTracks,
      tracksRef: { current: props.tracks },
      characterParts: [],
      setCharacterParts: mockSetCharacterParts,
      characterPartsRef: { current: [] }
    }), {
      initialProps: { tracks: currentTracks }
    });

    act(() => {
      result.current.startBatchInteraction();
    });

    currentTracks = [{ id: 't1', partId: 'p1', name: 'T1', keyframes: [] }];
    rerender({ tracks: currentTracks });
    
    // Batch is active, so history shouldn't record intermediate states directly
    // Then we end it
    act(() => {
      result.current.endBatchInteraction();
    });

    expect(result.current.canUndo).toBe(true);
  });
});
