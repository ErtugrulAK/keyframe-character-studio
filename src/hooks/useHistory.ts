import { useState, useCallback, useRef, useEffect } from 'react';
import type { CharacterPart, MotionTemplate, Track } from '../types/animator';

export interface HistoryState {
  tracks: Track[];
  characterParts: CharacterPart[];
  motionTemplates?: MotionTemplate[];
}

interface UseHistoryOptions {
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  tracksRef: React.MutableRefObject<Track[]>;
  characterParts: CharacterPart[];
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  characterPartsRef: React.MutableRefObject<CharacterPart[]>;
  motionTemplates?: MotionTemplate[];
  setMotionTemplates?: React.Dispatch<React.SetStateAction<MotionTemplate[]>>;
}

/**
 * Undo/redo history for tracks + character parts.
 *
 * History invariant: `history[i]` is the state after the i-th committed change
 * and `historyIndex` always points at the current state (index of the last
 * appended snapshot). The index is derived from the actual history array via a
 * ref mirror, so it can never drift — even when React StrictMode double-fires
 * the recording effect on mount or when two consecutive states are identical.
 */
export const useHistory = ({
  tracks,
  setTracks,
  tracksRef,
  characterParts,
  setCharacterParts,
  characterPartsRef,
  motionTemplates,
  setMotionTemplates,
}: UseHistoryOptions) => {
  // Undo / Redo Stack State
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const isUndoRedoRef = useRef<boolean>(false);
  const isBatchInteractingRef = useRef<boolean>(false);
  const batchStartSnapshotRef = useRef<HistoryState | null>(null);

  // Mirrors of the latest committed history/index (safe to read in callbacks).
  const historyRef = useRef<HistoryState[]>([]);
  const historyIndexRef = useRef<number>(-1);
  historyRef.current = history;
  historyIndexRef.current = historyIndex;

  /** Replace the history stack and point the index at the new current state. */
  const commitHistory = useCallback((next: HistoryState[]) => {
    historyRef.current = next;
    setHistory(next);
    setHistoryIndex(next.length - 1);
  }, []);

  const startBatchInteraction = useCallback(() => {
    if (!isBatchInteractingRef.current) {
      isBatchInteractingRef.current = true;
      batchStartSnapshotRef.current = {
        tracks: structuredClone(tracksRef.current),
        characterParts: structuredClone(characterPartsRef.current),
        ...(motionTemplates ? { motionTemplates: structuredClone(motionTemplates) } : {}),
      };
    }
  }, [motionTemplates]);

  const endBatchInteraction = useCallback(() => {
    if (isBatchInteractingRef.current) {
      const initialSnap = batchStartSnapshotRef.current;
      isBatchInteractingRef.current = false;
      batchStartSnapshotRef.current = null;

      const finalSnap: HistoryState = {
        tracks: structuredClone(tracksRef.current),
        characterParts: structuredClone(characterPartsRef.current),
        ...(motionTemplates ? { motionTemplates: structuredClone(motionTemplates) } : {}),
      };

      if (initialSnap && JSON.stringify(initialSnap) !== JSON.stringify(finalSnap)) {
        const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
        // Defensive bootstrap: if the stack is somehow empty, seed it with the
        // pre-interaction state so undo can always restore it.
        const base = trimmed.length === 0 ? [initialSnap] : trimmed;
        commitHistory([...base, finalSnap].slice(-50));
      }
    }
  }, [commitHistory, motionTemplates]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isBatchInteractingRef.current) {
        endBatchInteraction();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [endBatchInteraction]);

  // Record a history snapshot whenever tracks or characterParts change.
  // On mount this seeds the initial state (S0), making the first action
  // undoable. Identical consecutive states are deduplicated WITHOUT touching
  // the index (StrictMode double-invocation safe).
  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    if (isBatchInteractingRef.current) {
      return;
    }
    const snap: HistoryState = {
      tracks: structuredClone(tracks),
      characterParts: structuredClone(characterParts),
      ...(motionTemplates ? { motionTemplates: structuredClone(motionTemplates) } : {}),
    };

    const current = historyRef.current;
    const last = current[current.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(snap)) {
      return; // no change — do not touch the index
    }

    if (current.length === 0) {
      // Initial state seed (S0): history = [S0], index = 0.
      commitHistory([snap]);
      return;
    }

    const trimmed = current.slice(0, historyIndexRef.current + 1);
    commitHistory([...trimmed, snap].slice(-50));
  }, [tracks, characterParts, motionTemplates, commitHistory]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (isBatchInteractingRef.current) {
      endBatchInteraction();
    }
    const idx = historyIndexRef.current;
    if (idx > 0) {
      const targetState = historyRef.current[idx - 1];
      if (targetState) {
        isUndoRedoRef.current = true;
        setTracks(structuredClone(targetState.tracks));
        setCharacterParts(structuredClone(targetState.characterParts));
        if (setMotionTemplates && targetState.motionTemplates) {
          setMotionTemplates(structuredClone(targetState.motionTemplates));
        }
        setHistoryIndex(idx - 1);
        historyIndexRef.current = idx - 1;
      }
    }
  }, [endBatchInteraction, setTracks, setCharacterParts, setMotionTemplates]);

  const redo = useCallback(() => {
    if (isBatchInteractingRef.current) {
      endBatchInteraction();
    }
    const idx = historyIndexRef.current;
    if (idx < historyRef.current.length - 1) {
      const targetState = historyRef.current[idx + 1];
      if (targetState) {
        isUndoRedoRef.current = true;
        setTracks(structuredClone(targetState.tracks));
        setCharacterParts(structuredClone(targetState.characterParts));
        if (setMotionTemplates && targetState.motionTemplates) {
          setMotionTemplates(structuredClone(targetState.motionTemplates));
        }
        setHistoryIndex(idx + 1);
        historyIndexRef.current = idx + 1;
      }
    }
  }, [endBatchInteraction, setTracks, setCharacterParts, setMotionTemplates]);

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    startBatchInteraction,
    endBatchInteraction,
  };
};
