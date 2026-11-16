import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useHistory, type HistorySelection } from '../hooks/useHistory';
import type { CharacterPart, Track } from '../types/animator';

const pose = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
const part = (id: string, x = 0): CharacterPart => (
  { id, name: id.toUpperCase(), type: 'custom_rect', zIndex: 1, baseTransform: { ...pose, x } } as CharacterPart
);
const documentState = {
  fps: 30, totalFrames: 60, projectResolution: { width: 1920, height: 1080 },
  coordinateSystem: 'project-unit-center-v1' as const, sceneTitle: 'T', activeTemplateId: 'Sequence',
};
const restoreDocumentState = vi.fn();

/** A live scene around the hook: real state, so a restore is what the next render shows. */
const useScene = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [characterParts, setCharacterParts] = useState<CharacterPart[]>([]);
  const [selection, setSelection] = useState<HistorySelection>({ primary: null, ids: [] });
  const tracksRef = useRef(tracks);
  const characterPartsRef = useRef(characterParts);
  // Mirrors the production latest-ref wiring (`hooks/useProjectState`).
  // oxlint-disable-next-line react/refs
  tracksRef.current = tracks;
  // oxlint-disable-next-line react/refs
  characterPartsRef.current = characterParts;
  const history = useHistory({
    tracks, setTracks, tracksRef, characterParts, setCharacterParts, characterPartsRef,
    documentState, restoreDocumentState, selection, restoreSelection: setSelection,
  });
  return { history, characterParts, setCharacterParts, selection, setSelection };
};

/** Start, Add A, Add B, Move A, Delete B. */
const build = () => {
  const view = renderHook(() => useScene());
  const edit = (next: CharacterPart[], select?: string) => {
    act(() => {
      view.result.current.setCharacterParts(next);
      if (select) view.result.current.setSelection({ primary: select, ids: [select] });
    });
  };
  edit([part('a')], 'a');
  edit([part('a'), part('b')], 'b');
  edit([part('a', 40), part('b')]);
  edit([part('a', 40)]);
  return view;
};

describe('the History list', () => {
  it('names every step and marks the current one', () => {
    const view = build();
    expect(view.result.current.history.historySteps).toEqual(['Start', 'Add A', 'Add B', 'Move A', 'Delete B']);
    expect(view.result.current.history.historyIndex).toBe(4);
  });

  it('jumping to a step shows what that many undos would, and keeps the later steps for redo', () => {
    const jumped = build();
    act(() => jumped.result.current.history.jumpTo(1));
    const undone = build();
    for (let step = 0; step < 3; step += 1) act(() => undone.result.current.history.undo());
    expect(jumped.result.current.characterParts).toEqual(undone.result.current.characterParts);
    expect(jumped.result.current.characterParts.map((item) => item.id)).toEqual(['a']);
    expect(jumped.result.current.characterParts[0].baseTransform.x).toBe(0);
    expect(jumped.result.current.history.historyIndex).toBe(1);
    // Nothing was recorded by the jump itself, and the later steps are still there.
    expect(jumped.result.current.history.historySteps).toHaveLength(5);
    expect(jumped.result.current.history.canRedo).toBe(true);

    act(() => jumped.result.current.history.jumpTo(3));
    expect(jumped.result.current.characterParts.map((item) => [item.id, item.baseTransform.x])).toEqual([['a', 40], ['b', 0]]);
    act(() => jumped.result.current.history.redo());
    expect(jumped.result.current.characterParts.map((item) => item.id)).toEqual(['a']);
    expect(jumped.result.current.history.historyIndex).toBe(4);
  });

  it('a new edit after a jump replaces the steps after it', () => {
    const view = build();
    act(() => view.result.current.history.jumpTo(2));
    act(() => view.result.current.setCharacterParts([part('a'), part('b'), part('c')]));
    expect(view.result.current.history.historySteps).toEqual(['Start', 'Add A', 'Add B', 'Add C']);
    expect(view.result.current.history.canRedo).toBe(false);
  });

  it('going back puts back the selection the next step started from', () => {
    const view = build();
    // The layer selected now (b) is gone at step 1, so the remembered one returns.
    act(() => view.result.current.history.jumpTo(1));
    expect(view.result.current.selection).toEqual({ primary: 'a', ids: ['a'] });
  });

  it('ignores a step that does not exist and the step it is already on', () => {
    const view = build();
    const before = view.result.current.characterParts;
    for (const index of [-1, 5, 4, 1.5, Number.NaN]) act(() => view.result.current.history.jumpTo(index));
    expect(view.result.current.characterParts).toBe(before);
    expect(view.result.current.history.historyIndex).toBe(4);
  });
});
