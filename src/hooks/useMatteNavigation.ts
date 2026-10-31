import { useCallback, useEffect, useState } from 'react';
import type { CharacterPart } from '../types/animator';

interface UseMatteNavigationOptions {
  characterParts: CharacterPart[];
  selectedPartId: string | null;
  handleSelectPart: (id: string | null, additive?: boolean) => void;
}

/**
 * "Select Source" / "Back to Target" for a Track Matte. Both are
 * SELECTION changes only (selection is never scene data or history), and the
 * remembered target is transient: it is dropped once the source is no longer
 * the selection or the target no longer exists — never redirected elsewhere.
 * Selecting a hidden source does not write any visibility.
 */
export const useMatteNavigation = ({ characterParts, selectedPartId, handleSelectPart }: UseMatteNavigationOptions) => {
  const [trail, setTrail] = useState<{ targetId: string; sourceId: string } | null>(null);
  const valid = trail
    && selectedPartId === trail.sourceId
    && characterParts.some((part) => part.id === trail.targetId)
    ? trail
    : null;
  useEffect(() => {
    // A stale trail is dropped so a later selection cannot revive it.
    // oxlint-disable-next-line react/set-state-in-effect
    if (trail && !valid) setTrail(null);
  }, [trail, valid]);

  const selectMatteSource = useCallback((targetId: string, sourceId: string) => {
    if (!characterParts.some((part) => part.id === sourceId)) return;
    handleSelectPart(sourceId);
    setTrail({ targetId, sourceId });
  }, [characterParts, handleSelectPart]);

  const backToMatteTarget = useCallback(() => {
    if (!valid) return;
    handleSelectPart(valid.targetId);
    setTrail(null);
  }, [handleSelectPart, valid]);

  return {
    /** The target the user came from, while they are on its source. */
    matteReturnTargetId: valid?.targetId ?? null,
    selectMatteSource,
    backToMatteTarget,
  };
};
