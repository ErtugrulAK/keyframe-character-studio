import { useCallback, useEffect, useState } from 'react';
import type { BezierPath, CharacterPart, Track } from '../types/animator';
import type { ToastOptions } from './useToast';
import { convertShapeToEditablePath } from '../utils/shapeToPath';
import { deleteMaskVertex } from '../utils/maskPathCreation';
import { resolveFreeformPath } from '../utils/freeform';

/** The selected point of an editable path layer (transient editor state, never scene data). */
export interface PathVertexSelection {
  partId: string;
  index: number;
}

interface UsePathEditingOptions {
  characterParts: CharacterPart[];
  tracks: Track[];
  /** The lock-guarded scene setter: one call is one undo step. */
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  selectedPartId: string | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info', options?: ToastOptions) => void;
}

/**
 * Editable paths: converting a basic shape into a path layer, and the
 * point selection the canvas and the Inspector share. Every write goes through
 * the editor's (lock-guarded) part setter, so convert / add / remove / move
 * are ordinary scene edits with their usual undo step.
 */
export const usePathEditing = ({ characterParts, tracks, setCharacterParts, selectedPartId, showToast }: UsePathEditingOptions) => {
  const [pathVertex, setPathVertex] = useState<PathVertexSelection | null>(null);

  // The selection belongs to one layer: selecting another layer clears it.
  useEffect(() => {
    if (pathVertex && pathVertex.partId !== selectedPartId) {
      // The point selection follows the layer selection (external change).
      // oxlint-disable-next-line react/set-state-in-effect
      setPathVertex(null);
    }
  }, [pathVertex, selectedPartId]);

  /** Converts a basic shape into an editable path layer in place (same id). Returns whether it did. */
  const convertToEditablePath = useCallback((partId: string): boolean => {
    const part = characterParts.find((candidate) => candidate.id === partId);
    if (!part) return false;
    const result = convertShapeToEditablePath(part, tracks);
    if (!result.ok) {
      showToast(result.reason, 'error', { title: 'Cannot convert to path' });
      return false;
    }
    setCharacterParts((previous) => previous.map((candidate) => (candidate.id === partId ? result.part : candidate)));
    return true;
  }, [characterParts, tracks, setCharacterParts, showToast]);

  /** Writes a path layer's canonical path (and its legacy anchor list). */
  const setPartPath = useCallback((partId: string, path: BezierPath) => {
    setCharacterParts((previous) => previous.map((candidate) => (
      candidate.id === partId && candidate.type === 'custom_freeform'
        ? { ...candidate, path, points: path.points.map(({ x, y }) => ({ x, y })) }
        : candidate
    )));
  }, [setCharacterParts]);

  const selectPathVertex = useCallback((partId: string, index: number | null) => {
    setPathVertex(index === null ? null : { partId, index });
  }, []);

  /**
   * Delete on a selected path point removes that point (not the layer). True
   * when the key was used for the path; a path keeps at least three points.
   */
  const deleteSelectedPathVertex = useCallback((): boolean => {
    if (!pathVertex || pathVertex.partId !== selectedPartId) return false;
    const part = characterParts.find((candidate) => candidate.id === pathVertex.partId);
    const path = part?.type === 'custom_freeform' ? resolveFreeformPath(part) : undefined;
    if (!part || !path || !path.points[pathVertex.index]) return false;
    const next = deleteMaskVertex(path, pathVertex.index);
    if (!next) {
      showToast('A closed path keeps at least three points.', 'info');
      return true;
    }
    setPartPath(part.id, next);
    setPathVertex(null);
    return true;
  }, [characterParts, pathVertex, selectedPartId, setPartPath, showToast]);

  return { pathVertex, selectPathVertex, convertToEditablePath, setPartPath, deleteSelectedPathVertex };
};
