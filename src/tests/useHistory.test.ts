import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useHistory } from '../hooks/useHistory';
import type { CharacterPart, MotionTemplate, Track } from '../types/animator';

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

  it('M11: matte (on CharacterPart) is included in undo/redo snapshots', () => {
    // characterParts are structuredClone'd in history snapshots — a matte
    // field on the part must be captured automatically (no production change).
    let currentParts: CharacterPart[] = [{ id: 'p1', name: 'P', type: 'custom_box', zIndex: 1, baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } }];
    const partsRef = { current: currentParts };
    const { result, rerender } = renderHook(
      (props: { parts: CharacterPart[] }) =>
        useHistory({
          tracks: emptyTracks,
          setTracks: mockSetTracks,
          tracksRef: emptyTracksRef,
          characterParts: props.parts,
          setCharacterParts: mockSetCharacterParts,
          characterPartsRef: partsRef,
        }),
      { initialProps: { parts: currentParts } }
    );

    // Matte added to the part
    currentParts = [{ ...currentParts[0], matte: { sourcePartId: 'src', mode: 'clip' } }];
    partsRef.current = currentParts;
    rerender({ parts: currentParts });
    expect(result.current.canUndo).toBe(true);

    // Undo → matte removed (snapshot restore)
    mockSetCharacterParts.mockClear();
    act(() => {
      result.current.undo();
    });
    const afterUndo = mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[];
    expect(afterUndo[0].matte).toBeUndefined();

    // Redo → matte restored
    mockSetCharacterParts.mockClear();
    act(() => {
      result.current.redo();
    });
    const afterRedo = mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[];
    expect(afterRedo[0].matte).toEqual({ sourcePartId: 'src', mode: 'clip' });
  });

  it('M11: matte source A → B and enabled toggle are undoable/redoable', () => {
    let currentParts: CharacterPart[] = [{
      id: 'p1', name: 'P', type: 'custom_box', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      matte: { sourcePartId: 'A', mode: 'clip' },
    }];
    const partsRef = { current: currentParts };
    const { result, rerender } = renderHook(
      (props: { parts: CharacterPart[] }) =>
        useHistory({
          tracks: emptyTracks,
          setTracks: mockSetTracks,
          tracksRef: emptyTracksRef,
          characterParts: props.parts,
          setCharacterParts: mockSetCharacterParts,
          characterPartsRef: partsRef,
        }),
      { initialProps: { parts: currentParts } }
    );

    // Source A → B
    currentParts = [{ ...currentParts[0], matte: { sourcePartId: 'B', mode: 'clip' } }];
    partsRef.current = currentParts;
    rerender({ parts: currentParts });

    // Enabled true → false
    currentParts = [{ ...currentParts[0], matte: { sourcePartId: 'B', mode: 'clip', enabled: false } }];
    partsRef.current = currentParts;
    rerender({ parts: currentParts });

    // Undo 1 → enabled restored to undefined(active)
    act(() => { result.current.undo(); });
    expect((mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[])[0].matte).toEqual({ sourcePartId: 'B', mode: 'clip' });

    // Undo 2 → source back to A
    act(() => { result.current.undo(); });
    expect((mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[])[0].matte).toEqual({ sourcePartId: 'A', mode: 'clip' });

    // Redo 1 → source B again
    act(() => { result.current.redo(); });
    expect((mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[])[0].matte).toEqual({ sourcePartId: 'B', mode: 'clip' });

    // Redo 2 → enabled false again
    act(() => { result.current.redo(); });
    expect((mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[])[0].matte).toEqual({ sourcePartId: 'B', mode: 'clip', enabled: false });
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

  it('includes sequence metadata in undo/redo snapshots when provided', () => {
    let currentTemplates: MotionTemplate[] = [{ id: 'Sequence', name: 'Sequence', type: 'in', durationFrames: 60 }];
    const setMotionTemplates: React.Dispatch<React.SetStateAction<MotionTemplate[]>> = (value) => {
      currentTemplates = typeof value === 'function'
        ? (value as (prev: MotionTemplate[]) => MotionTemplate[])(currentTemplates)
        : value;
    };

    const { result, rerender } = renderHook(
      (props: { templates: MotionTemplate[] }) => useHistory({
        tracks: emptyTracks,
        setTracks: mockSetTracks,
        tracksRef: emptyTracksRef,
        characterParts: emptyParts,
        setCharacterParts: mockSetCharacterParts,
        characterPartsRef: emptyPartsRef,
        motionTemplates: props.templates,
        setMotionTemplates,
      }),
      { initialProps: { templates: currentTemplates } },
    );

    currentTemplates = [{ ...currentTemplates[0], name: 'Renamed' }];
    rerender({ templates: currentTemplates });
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(currentTemplates[0].name).toBe('Sequence');
    expect(result.current.canRedo).toBe(true);
  });
});
