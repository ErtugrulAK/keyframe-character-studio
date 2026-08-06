import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useHistory } from '../hooks/useHistory';
import type { CharacterPart, Track } from '../types/animator';

describe('useHistory Hook', () => {
  const mockSetTracks = vi.fn();
  const mockSetCharacterParts = vi.fn();

  // Stable references: useHistory records snapshots in an effect keyed on
  // `tracks`/`characterParts`. Passing fresh array literals on every render
  // would re-trigger that effect infinitely (render loop), so the fixtures
  // must hold stable references between renders.
  const emptyTracks: Track[] = [];
  const emptyParts: CharacterPart[] = [];
  const emptyTracksRef = { current: emptyTracks };
  const emptyPartsRef = { current: emptyParts };

  it('initializes with empty history', () => {
    const { result } = renderHook(() =>
      useHistory({
        tracks: emptyTracks,
        setTracks: mockSetTracks,
        tracksRef: emptyTracksRef,
        characterParts: emptyParts,
        setCharacterParts: mockSetCharacterParts,
        characterPartsRef: emptyPartsRef,
      })
    );

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('records state changes', () => {
    let currentTracks: Track[] = emptyTracks;
    // Refs must be stable across renders (as the app provides them via
    // useProjectState); callbacks like endBatchInteraction close over the
    // first render's ref object and read its `.current` at call time.
    const tracksRef = { current: currentTracks };
    const { result, rerender } = renderHook(
      (props: { tracks: Track[] }) =>
        useHistory({
          tracks: props.tracks,
          setTracks: mockSetTracks,
          tracksRef,
          characterParts: emptyParts,
          setCharacterParts: mockSetCharacterParts,
          characterPartsRef: emptyPartsRef,
        }),
      { initialProps: { tracks: currentTracks } }
    );

    // Simulate tracks changing
    currentTracks = [{ id: 't1', partId: 'p1', name: 'T1', keyframes: [] }];
    tracksRef.current = currentTracks;
    rerender({ tracks: currentTracks });

    expect(result.current.canUndo).toBe(true);
  });

  it('handles batch interaction correctly', () => {
    let currentTracks: Track[] = emptyTracks;
    const tracksRef = { current: currentTracks };
    const { result, rerender } = renderHook(
      (props: { tracks: Track[] }) =>
        useHistory({
          tracks: props.tracks,
          setTracks: mockSetTracks,
          tracksRef,
          characterParts: emptyParts,
          setCharacterParts: mockSetCharacterParts,
          characterPartsRef: emptyPartsRef,
        }),
      { initialProps: { tracks: currentTracks } }
    );

    act(() => {
      result.current.startBatchInteraction();
    });

    currentTracks = [{ id: 't1', partId: 'p1', name: 'T1', keyframes: [] }];
    tracksRef.current = currentTracks;
    rerender({ tracks: currentTracks });

    // Batch is active, so history shouldn't record intermediate states directly
    // Then we end it
    act(() => {
      result.current.endBatchInteraction();
    });

    expect(result.current.canUndo).toBe(true);
  });
});
