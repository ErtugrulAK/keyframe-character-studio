import { useState } from 'react';
import { BodyPartType, CharacterPart, ToolType, Track } from '../types/animator';
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
    const { newPart, newTrack } = createCustomPart(type, name, characterParts.length + 1, extraProps);

    const nextTracks = [newTrack, ...tracks];
    const total = nextTracks.length;
    setTracks(nextTracks);
    setCharacterParts((prev) => {
      const updated = [newPart, ...prev];
      return updated.map((p) => {
        const idx = nextTracks.findIndex((t) => t.partId === p.id);
        return { ...p, zIndex: idx >= 0 ? total - idx : p.zIndex };
      });
    });
    setSelectedPartId(newPart.id);
  };

  return {
    activeTool,
    setActiveTool,
    addCustomPart,
  };
};
