import type { CharacterPart, Track } from '../types/animator';
import { useAnimatorAuthority } from '../context/useAnimator';
import { planLayerDrop, planReparent, type LayerDropPosition } from '../utils/layerParenting';
import type { RebasedChild } from '../utils/layerGrouping';
import { relationshipParentId } from '../utils/partBinding';
import { lockedLayersRefusal, lockedOutcomeRefusal } from '../utils/layerLocks';
import type { ToastOptions } from './useToast';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info', options?: ToastOptions) => void;

/**
 * C2-E — the one layer-parenting authority. The layer tree's drag and drop, its
 * keyboard commands, the context menu and the Inspector's Parent field all call
 * these actions; each plans with the pure `utils/layerParenting` helpers and
 * writes once inside a batch interaction, so one user action is one undo step.
 * A refused change writes nothing and says why.
 */
interface LayerParenting {
  /** Drop `id` before/after `targetId` (as its sibling) or nest it into it. */
  dropLayer: (id: string, targetId: string, position: LayerDropPosition) => boolean;
  /** Give `id` a new parent (null = top level), keeping its place on screen. */
  setLayerParent: (id: string, parentId: string | null) => boolean;
  /** Make the layer a child of the sibling row just above it. */
  nestIntoLayerAbove: (id: string) => boolean;
  /** Move the layer out of its parent, to the parent's level. */
  unparentLayer: (id: string) => boolean;
  /** Move the layer one step up/down among its siblings (the tree order). */
  moveLayerAmongSiblings: (id: string, direction: -1 | 1) => boolean;
}

interface LayerParentingDependencies {
  currentFrame: number;
  activeTemplateId: string;
  characterParts: CharacterPart[];
  tracks: Track[];
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  startBatchInteraction: () => void;
  endBatchInteraction: () => void;
  showToast: ShowToast;
  /** C4 — asked before a re-based animation is written; without it the change is written at once. */
  requestConfirmation?: (request: { title: string; description: string; confirmLabel?: string; onConfirm: () => void }) => void;
}

/** Siblings share a relationship parent; returned in tree (array) order. */
const siblingsOf = (parts: CharacterPart[], part: CharacterPart): CharacterPart[] => {
  const parentId = relationshipParentId(part);
  const hasParent = Boolean(parentId && parts.some((candidate) => candidate.id === parentId));
  return parts.filter((candidate) => {
    const candidateParent = relationshipParentId(candidate);
    const candidateHasParent = Boolean(candidateParent && parts.some((other) => other.id === candidateParent));
    return hasParent ? candidateParent === parentId : !candidateHasParent;
  });
};

export const createLayerParentingActions = ({
  currentFrame,
  activeTemplateId,
  characterParts,
  tracks,
  setCharacterParts,
  setTracks,
  startBatchInteraction,
  endBatchInteraction,
  showToast,
  requestConfirmation,
}: LayerParentingDependencies): LayerParenting => {
  const scope = activeTemplateId || 'Sequence';
  const nameOf = (id: string | null) => (id ? characterParts.find((part) => part.id === id)?.name ?? id : '');

  /** Writes a planned outcome as one undo step — or refuses it whole when it touches a locked layer. */
  const write = (parts: CharacterPart[], nextTracks: Track[] | null): boolean => {
    const lockRefusal = lockedOutcomeRefusal(characterParts, tracks, parts, nextTracks);
    if (lockRefusal) {
      showToast(lockRefusal, 'error');
      return false;
    }
    startBatchInteraction();
    setCharacterParts(parts);
    if (nextTracks) setTracks(nextTracks);
    endBatchInteraction();
    return true;
  };

  /**
   * C4 — a re-parent that keeps the layer's place by ADDING keyframes (its
   * animation, or its old/new parent's, re-based into the new parent) asks
   * first, naming the layer, the key counts and any per-frame bake; Cancel
   * writes nothing. A re-base that adds no key is written at once.
   */
  const confirmRebase = (rebased: RebasedChild | null | undefined, parentName: string, commit: () => void) => {
    if (!rebased || rebased.keyframesAfter <= rebased.keyframesBefore || !requestConfirmation) {
      commit();
      return;
    }
    requestConfirmation({
      title: `Re-base the animation of “${rebased.name}”?`,
      description: `To keep “${rebased.name}” exactly where it is at every frame ${parentName}, its position, rotation and scale keys are re-expressed in the new parent: ${rebased.keyframesBefore} → ${rebased.keyframesAfter} keyframes${rebased.perFrame ? ' (some channels one key per frame, because this combination has no sparser exact form)' : ''}. Key times and easings are kept where they stay exact. The pose is exact at every frame; between frames a rotating motion can differ by a fraction of a unit. One Undo restores everything.`,
      confirmLabel: 'Re-parent',
      onConfirm: commit,
    });
  };

  const dropLayer: LayerParenting['dropLayer'] = (id, targetId, position) => {
    // C4 — a locked layer keeps its place and its parent (a reorder of the
    // layer itself changes no record the outcome check would see).
    const lockRefusal = lockedLayersRefusal(characterParts, tracks, [id]);
    if (lockRefusal) {
      showToast(lockRefusal, 'error');
      return false;
    }
    const outcome = planLayerDrop(characterParts, tracks, id, targetId, position, scope, currentFrame);
    if (!outcome.ok) {
      showToast(outcome.reason, 'error');
      return false;
    }
    if (outcome.unchanged) return true;
    const nextParentId = position === 'nest' ? targetId : (relationshipParentId(characterParts.find((part) => part.id === targetId)) ?? null);
    confirmRebase(outcome.rebased, nextParentId ? `inside “${nameOf(nextParentId)}”` : 'at the top level', () => {
      write(outcome.parts, outcome.tracks === tracks ? null : outcome.tracks);
    });
    return true;
  };

  const setLayerParent: LayerParenting['setLayerParent'] = (id, parentId) => {
    const outcome = planReparent(characterParts, tracks, id, parentId, scope, currentFrame);
    if (!outcome.ok) {
      showToast(outcome.reason, 'error');
      return false;
    }
    if (outcome.unchanged) return true;
    confirmRebase(outcome.rebased, parentId ? `inside “${nameOf(parentId)}”` : 'at the top level', () => {
      write(outcome.parts, outcome.tracks ?? null);
    });
    return true;
  };

  const nestIntoLayerAbove: LayerParenting['nestIntoLayerAbove'] = (id) => {
    const part = characterParts.find((candidate) => candidate.id === id);
    if (!part) return false;
    const siblings = siblingsOf(characterParts, part);
    const above = siblings[siblings.indexOf(part) - 1];
    if (!above) {
      showToast(`There is no layer above “${part.name}” at its level to nest it into.`, 'info');
      return false;
    }
    return setLayerParent(id, above.id);
  };

  const unparentLayer: LayerParenting['unparentLayer'] = (id) => {
    const part = characterParts.find((candidate) => candidate.id === id);
    const parentId = relationshipParentId(part);
    const parent = characterParts.find((candidate) => candidate.id === parentId);
    if (!part || !parent) {
      if (part) showToast(`“${part.name}” has no parent.`, 'info');
      return false;
    }
    // Out of the parent, placed right after it: the row lands next to its old parent.
    return dropLayer(id, parent.id, 'after');
  };

  const moveLayerAmongSiblings: LayerParenting['moveLayerAmongSiblings'] = (id, direction) => {
    const part = characterParts.find((candidate) => candidate.id === id);
    if (!part) return false;
    const siblings = siblingsOf(characterParts, part);
    const neighbour = siblings[siblings.indexOf(part) + direction];
    if (!neighbour) return false;
    return dropLayer(id, neighbour.id, direction < 0 ? 'before' : 'after');
  };

  return { dropLayer, setLayerParent, nestIntoLayerAbove, unparentLayer, moveLayerAmongSiblings };
};

/** The parenting actions for a component inside the editor. */
export const useLayerParenting = (): LayerParenting => useAnimatorAuthority(createLayerParentingActions);
