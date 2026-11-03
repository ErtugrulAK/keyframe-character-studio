import { useCallback } from 'react';
import type { CharacterPart, Track } from '../types/animator';
import { compensateLayoutChange } from '../utils/layers/layoutModifiers';

type ModifierField = 'textFit' | 'fitToText' | 'follow' | 'justify' | 'repeater';
export type ModifierPatch = Partial<Pick<CharacterPart, ModifierField>>;

interface ModifierEditingDeps {
  characterParts: CharacterPart[];
  tracks: Track[];
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  startBatchInteraction: () => void;
  endBatchInteraction: () => void;
}

/**
 * Writes a layer's modifier settings as one undoable edit that keeps the
 * picture still (`compensateLayoutChange`): binding a follow, changing an
 * anchor or an alignment, or justifying a group changes how the layers react to
 * their content, not where they are now. A field set to `undefined` removes
 * that modifier.
 */
export function useModifierEditing({
  characterParts,
  tracks,
  setCharacterParts,
  setTracks,
  startBatchInteraction,
  endBatchInteraction,
}: ModifierEditingDeps) {
  return useCallback((partId: string, patch: ModifierPatch) => {
    const after = characterParts.map((part) => {
      if (part.id !== partId) return part;
      const next = { ...part, ...patch };
      for (const key of Object.keys(patch) as ModifierField[]) if (patch[key] === undefined) delete next[key];
      return next;
    });
    const settled = compensateLayoutChange(characterParts, after, tracks);
    startBatchInteraction();
    setCharacterParts(settled.parts);
    if (settled.tracks !== tracks) setTracks(settled.tracks);
    endBatchInteraction();
  }, [characterParts, tracks, setCharacterParts, setTracks, startBatchInteraction, endBatchInteraction]);
}
