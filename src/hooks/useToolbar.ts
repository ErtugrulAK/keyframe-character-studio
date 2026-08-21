import { useState } from 'react';
import type { BodyPartType, CharacterPart, ToolType, Track } from '../types/animator';
import { createCustomPart } from '../utils/partFactory';

interface UseToolbarOptions {
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  characterParts: CharacterPart[];
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  setSelectedPartId: (id: string | null) => void;
}

export const useToolbar = ({
  tracks,
  setTracks,
  characterParts,
  setCharacterParts,
  setSelectedPartId,
}: UseToolbarOptions) => {
  const [activeTool, setActiveTool] = useState<ToolType>('select');

  const addCustomPart = (type: BodyPartType, name: string, extraProps?: Partial<CharacterPart>) => {
    // Preserve authored zIndex values on existing parts. New parts are placed
    // above the current highest layer instead of rebuilding every index from
    // the array order (which silently reset user edits after adding a part).
    const nextZIndex = characterParts.reduce((max, part) => Math.max(max, part.zIndex), 0) + 1;
    const { newPart, newTrack } = createCustomPart(type, name, nextZIndex, extraProps);

    const nextTracks = [newTrack, ...tracks];
    setTracks(nextTracks);
    setCharacterParts((prev) => [newPart, ...prev]);
    setSelectedPartId(newPart.id);
  };

  return {
    activeTool,
    setActiveTool,
    addCustomPart,
  };
};
