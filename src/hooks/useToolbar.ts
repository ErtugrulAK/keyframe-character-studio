import { useCallback, useState } from 'react';
import type { BodyPartType, CharacterPart, ToolType, Track } from '../types/animator';
import { createCustomPart } from '../utils/partFactory';

interface UseToolbarOptions {
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  characterParts: CharacterPart[];
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  setSelectedPartId: (id: string | null) => void;
  /** The canonical selection set; a new part replaces it (optional for older callers). */
  setSelectedPartIds?: (ids: string[]) => void;
}

export const useToolbar = ({
  tracks,
  setTracks,
  characterParts,
  setCharacterParts,
  setSelectedPartId,
  setSelectedPartIds,
}: UseToolbarOptions) => {
  const [activeTool, setActiveToolState] = useState<ToolType>('select');
  const [pendingShapeType, setPendingShapeType] = useState<BodyPartType | null>(null);
  const [pendingShapeName, setPendingShapeName] = useState<string | null>(null);

  const clearShapeCreation = useCallback(() => {
    setPendingShapeType(null);
    setPendingShapeName(null);
    setActiveToolState((current) => current === 'shape_create' ? 'select' : current);
  }, []);

  const setActiveTool = useCallback((tool: ToolType) => {
    if (tool !== 'shape_create') {
      setPendingShapeType(null);
      setPendingShapeName(null);
    }
    setActiveToolState(tool);
  }, []);

  const armShapeCreation = useCallback((type: BodyPartType, name: string) => {
    setPendingShapeType(type);
    setPendingShapeName(name);
    setActiveToolState('shape_create');
  }, []);

  const addCustomPart = (type: BodyPartType, name: string, extraProps?: Partial<CharacterPart>) => {
    const nextZIndex = characterParts.reduce((max, part) => Math.max(max, part.zIndex), 0) + 1;
    const { newPart, newTrack } = createCustomPart(type, name, nextZIndex, extraProps);
    setTracks([newTrack, ...tracks]);
    setCharacterParts((prev) => [newPart, ...prev]);
    setSelectedPartId(newPart.id);
    // The new part becomes THE selection — a layer selected before the
    // shape was drawn must not stay selected beside it.
    setSelectedPartIds?.([newPart.id]);
  };

  return {
    activeTool,
    setActiveTool,
    pendingShapeType,
    pendingShapeName,
    armShapeCreation,
    clearShapeCreation,
    addCustomPart,
  };
};
