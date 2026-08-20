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

  it('dedupes identical states without moving the index (StrictMode safety)', () => {
    const tracksRef = { current: emptyTracks };
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
      { initialProps: { tracks: emptyTracks } }
    );

    // Mount seeds the initial state: history = [S0], index = 0 -> nothing to undo.
    expect(result.current.canUndo).toBe(false);

    // A fresh array with identical content (StrictMode re-runs the effect)
    // must NOT advance the index.
    rerender({ tracks: [] });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    // A real change still records and enables undo.
    const changed = [{ id: 't1', partId: 'p1', name: 'T1', keyframes: [] }];
    tracksRef.current = changed;
    rerender({ tracks: changed });
    expect(result.current.canUndo).toBe(true);
  });

  it('undo restores the initial state on the first press', () => {
    let currentTracks: Track[] = emptyTracks;
    const tracksRef = { current: currentTracks };
    const setTracks: React.Dispatch<React.SetStateAction<Track[]>> = (value) => {
      currentTracks = typeof value === 'function' ? (value as (prev: Track[]) => Track[])(currentTracks) : value;
      tracksRef.current = currentTracks;
    };

    const { result, rerender } = renderHook(
      (props: { tracks: Track[] }) =>
        useHistory({
          tracks: props.tracks,
          setTracks,
          tracksRef,
          characterParts: emptyParts,
          setCharacterParts: mockSetCharacterParts,
          characterPartsRef: emptyPartsRef,
        }),
      { initialProps: { tracks: currentTracks } }
    );

    // First action: add a track.
    const changed = [{ id: 't1', partId: 'p1', name: 'T1', keyframes: [] }];
    currentTracks = changed;
    tracksRef.current = changed;
    rerender({ tracks: changed });
    expect(result.current.canUndo).toBe(true);

    // A single undo press must restore the pre-action (initial) state.
    act(() => {
      result.current.undo();
    });
    expect(result.current.canUndo).toBe(false);
    expect(tracksRef.current).toEqual([]);
  });
});
