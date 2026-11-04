import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useHistory, type HistoryDocumentState, type HistorySelection } from '../hooks/useHistory';
import type { CharacterPart, Track } from '../types/animator';

const documentState: HistoryDocumentState = {
  fps: 24, totalFrames: 48, projectResolution: { width: 1920, height: 1080 },
  coordinateSystem: 'project-unit-center-v1', sceneTitle: 'Fixture', activeTemplateId: 'Sequence',
};
const part = (id: string): CharacterPart => ({ id, name: id, type: 'custom_rect', zIndex: 1, baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } } as CharacterPart);
const tracks: Track[] = [];

describe('undo keeps the selection the edit started from', () => {
  it('a Boolean of three selected shapes: undo selects the three again, redo the result', () => {
    const shapes = [part('a'), part('b'), part('c')];
    const withGroup = [part('bool'), ...shapes];
    const restoreSelection = vi.fn();
    const three: HistorySelection = { primary: 'c', ids: ['a', 'b', 'c'] };
    const { result, rerender } = renderHook(
      ({ parts, selection }: { parts: CharacterPart[]; selection: HistorySelection }) => useHistory({
        tracks, setTracks: vi.fn(), tracksRef: { current: tracks },
        characterParts: parts, setCharacterParts: vi.fn(), characterPartsRef: { current: parts },
        documentState, restoreDocumentState: vi.fn(),
        selection, restoreSelection,
      }),
      { initialProps: { parts: shapes, selection: { primary: null, ids: [] } as HistorySelection } },
    );
    // The user selects the three shapes (no scene change)…
    rerender({ parts: shapes, selection: three });
    // …and the Boolean replaces them by its group, which becomes the selection, in one render.
    rerender({ parts: withGroup, selection: { primary: 'bool', ids: ['bool'] } });
    act(() => result.current.undo());
    expect(restoreSelection).toHaveBeenLastCalledWith(three);
    // The app applies it: the undone scene shows with the three selected.
    rerender({ parts: shapes, selection: three });
    act(() => result.current.redo());
    expect(restoreSelection).toHaveBeenLastCalledWith({ primary: 'bool', ids: ['bool'] });
  });

  it('a batched drag restores the selection it started with', () => {
    const before = [part('a')];
    const moved = [{ ...part('a'), baseTransform: { ...part('a').baseTransform, x: 50 } }];
    const restoreSelection = vi.fn();
    const ref = { current: before };
    const selection: HistorySelection = { primary: 'a', ids: ['a'] };
    const { result, rerender } = renderHook(
      ({ parts }: { parts: CharacterPart[] }) => useHistory({
        tracks, setTracks: vi.fn(), tracksRef: { current: tracks },
        characterParts: parts, setCharacterParts: vi.fn(), characterPartsRef: ref,
        documentState, restoreDocumentState: vi.fn(),
        selection, restoreSelection,
      }),
      { initialProps: { parts: before } },
    );
    act(() => result.current.startBatchInteraction());
    ref.current = moved;
    rerender({ parts: moved });
    act(() => result.current.endBatchInteraction());
    act(() => result.current.undo());
    expect(restoreSelection).toHaveBeenLastCalledWith(selection);
  });
});

describe('undo leaves a selection the user made since the edit alone', () => {
  it('delete a layer, select another one, undo: the other layer stays selected', () => {
    const all = [part('a'), part('b')];
    const withoutA = [part('b')];
    const restoreSelection = vi.fn();
    const { result, rerender } = renderHook(
      ({ parts, selection }: { parts: CharacterPart[]; selection: HistorySelection }) => useHistory({
        tracks, setTracks: vi.fn(), tracksRef: { current: tracks },
        characterParts: parts, setCharacterParts: vi.fn(), characterPartsRef: { current: parts },
        documentState, restoreDocumentState: vi.fn(),
        selection, restoreSelection,
      }),
      { initialProps: { parts: all, selection: { primary: 'a', ids: ['a'] } as HistorySelection } },
    );
    // Delete A (the selection empties), then the user selects B.
    rerender({ parts: withoutA, selection: { primary: null, ids: [] } });
    rerender({ parts: withoutA, selection: { primary: 'b', ids: ['b'] } });
    act(() => result.current.undo());
    expect(restoreSelection).not.toHaveBeenCalled();
  });
});
