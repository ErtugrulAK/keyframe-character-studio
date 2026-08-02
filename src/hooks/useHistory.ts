import { useState, useCallback, useRef, useEffect } from 'react';
import type { CharacterPart, Track } from '../types/animator';

export interface HistoryState {
  tracks: Track[];
  characterParts: CharacterPart[];
}

interface UseHistoryOptions {
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  tracksRef: React.MutableRefObject<Track[]>;
  characterParts: CharacterPart[];
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  characterPartsRef: React.MutableRefObject<CharacterPart[]>;
}

export const useHistory = ({
  tracks,
  setTracks,
  tracksRef,
  characterParts,
  setCharacterParts,
  characterPartsRef,
}: UseHistoryOptions) => {
  // Undo / Redo Stack State
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const isUndoRedoRef = useRef<boolean>(false);
  const isBatchInteractingRef = useRef<boolean>(false);
  const batchStartSnapshotRef = useRef<HistoryState | null>(null);

  const historyIndexRef = useRef(historyIndex);
  historyIndexRef.current = historyIndex;

  const startBatchInteraction = useCallback(() => {
    if (!isBatchInteractingRef.current) {
      isBatchInteractingRef.current = true;
      batchStartSnapshotRef.current = {
        tracks: structuredClone(tracksRef.current),
        characterParts: structuredClone(characterPartsRef.current),
      };
    }
  }, []);

  const endBatchInteraction = useCallback(() => {
    if (isBatchInteractingRef.current) {
      const initialSnap = batchStartSnapshotRef.current;
      isBatchInteractingRef.current = false;
      batchStartSnapshotRef.current = null;

      const finalSnap: HistoryState = {
        tracks: structuredClone(tracksRef.current),
        characterParts: structuredClone(characterPartsRef.current),
      };

      if (initialSnap && JSON.stringify(initialSnap) !== JSON.stringify(finalSnap)) {
        setHistory((prev) => {
          let trimmed = prev.slice(0, historyIndexRef.current + 1);
          if (trimmed.length === 0) {
            trimmed = [initialSnap];
          }
          return [...trimmed, finalSnap].slice(-50);
        });
        setHistoryIndex((prev) => Math.min(prev + 1, 49));
      }
    }
  }, []);

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

  // Record History Snapshot whenever tracks or characterParts change
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
    };
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndexRef.current + 1);
      if (trimmed.length > 0) {
        const last = trimmed[trimmed.length - 1];
        if (JSON.stringify(last) === JSON.stringify(snap)) {
          return trimmed;
        }
      }
      return [...trimmed.slice(-50), snap];
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [tracks, characterParts]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (isBatchInteractingRef.current) {
      endBatchInteraction();
    }
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const targetState = history[prevIndex];
      if (targetState) {
        isUndoRedoRef.current = true;
        setTracks(structuredClone(targetState.tracks));
        setCharacterParts(structuredClone(targetState.characterParts));
        setHistoryIndex(prevIndex);
      }
    }
  }, [history, historyIndex, endBatchInteraction]);

  const redo = useCallback(() => {
    if (isBatchInteractingRef.current) {
      endBatchInteraction();
    }
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const targetState = history[nextIndex];
      if (targetState) {
        isUndoRedoRef.current = true;
        setTracks(structuredClone(targetState.tracks));
        setCharacterParts(structuredClone(targetState.characterParts));
        setHistoryIndex(nextIndex);
      }
    }
  }, [history, historyIndex, endBatchInteraction]);

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    startBatchInteraction,
    endBatchInteraction,
  };
};
