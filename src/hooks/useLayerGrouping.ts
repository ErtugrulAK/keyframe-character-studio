import { useAnimatorAuthority } from '../context/useAnimator';
import { generateId } from '../utils/layers/idGenerator';
import {
  createGroupDisplayName,
  createLayerGroup,
  dissolveLayerGroup,
  groupSelectionBlockReason,
  ungroupBlockReason,
} from '../utils/layers/layerGrouping';
import type { CharacterPart, Track, Transform } from '../types/animator';
import { lockedOutcomeRefusal } from '../utils/layers/layerLocks';
import type { ToastOptions } from './useToast';

/** The toast writer the context exposes. */
type ShowToast = (message: string, type?: 'success' | 'error' | 'info', options?: ToastOptions) => void;

/**
 * The one layer-group authoring authority for the current selection.
 *
 * It reads the selection, plans the change with the pure helpers in
 * `utils/layers/layerGrouping` and writes the result through the ordinary
 * `setCharacterParts`/`setTracks` setters inside a single batch interaction —
 * the same shape as the Boolean and bind authorities, so grouping is one undo
 * step and one history entry. There is exactly one group write path, shared by
 * the Inspector, the authoring toolbar and the editor context menu.
 */
export interface LayerGrouping {
  /** The selected layer when it is a group container. */
  selectedGroup: CharacterPart | undefined;
  /** Whether the current selection can become a group right now. */
  canGroup: boolean;
  /** Why the current selection cannot become a group, when it cannot. */
  groupBlockReason: string | null;
  groupSelection: () => void;
  ungroupSelection: () => void;
}

/**
 * The inputs the group authority reads. It takes them explicitly rather than
 * from the context so the state provider can build the SAME actions for the
 * keyboard commands without a second implementation.
 */
interface LayerGroupingDependencies {
  currentFrame: number;
  selectedPartId: string | null;
  selectedPartIds: string[];
  characterParts: CharacterPart[];
  tracks: Track[];
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  setSelectedPartId: (id: string | null) => void;
  setSelectedPartIds: (ids: string[]) => void;
  getComputedTransform: (partId: string, frame: number) => Transform;
  startBatchInteraction: () => void;
  endBatchInteraction: () => void;
  showToast: ShowToast;
}

export const createLayerGroupingActions = ({
  currentFrame,
  selectedPartId,
  selectedPartIds,
  characterParts,
  tracks,
  setCharacterParts,
  setTracks,
  setSelectedPartId,
  setSelectedPartIds,
  getComputedTransform,
  startBatchInteraction,
  endBatchInteraction,
  showToast,
}: LayerGroupingDependencies): LayerGrouping => {

  const selectedGroup = characterParts.find((part) => part.id === selectedPartId && part.isGroup === true);
  const groupBlockReason = groupSelectionBlockReason(characterParts, selectedPartIds);

  const groupSelection = () => {
    const outcome = createLayerGroup(characterParts, tracks, selectedPartIds, {
      groupId: generateId('group'),
      trackId: generateId('track'),
      name: createGroupDisplayName(characterParts),
      worldOf: (partId) => getComputedTransform(partId, currentFrame),
    });
    if (!outcome.ok) {
      showToast(outcome.reason, 'error');
      return;
    }
    // Refused whole when it would change a locked layer (nothing written).
    const lockRefusal = lockedOutcomeRefusal(characterParts, tracks, outcome.parts, outcome.tracks);
    if (lockRefusal) {
      showToast(lockRefusal, 'error');
      return;
    }
    startBatchInteraction();
    setCharacterParts(outcome.parts);
    setTracks(outcome.tracks);
    endBatchInteraction();
    setSelectedPartIds([outcome.groupId]);
    setSelectedPartId(outcome.groupId);
  };

  const ungroupSelection = () => {
    if (!selectedGroup) {
      showToast(ungroupBlockReason(characterParts, tracks, selectedPartId ?? '') ?? 'Select a layer group to ungroup.', 'info');
      return;
    }
    const outcome = dissolveLayerGroup(characterParts, tracks, selectedGroup.id);
    if (!outcome.ok) {
      showToast(outcome.reason, 'error');
      return;
    }
    // Refused whole when it would change a locked layer (nothing written).
    const lockRefusal = lockedOutcomeRefusal(characterParts, tracks, outcome.parts, outcome.tracks);
    if (lockRefusal) {
      showToast(lockRefusal, 'error');
      return;
    }
    startBatchInteraction();
    setCharacterParts(outcome.parts);
    setTracks(outcome.tracks);
    endBatchInteraction();
    setSelectedPartIds(outcome.childIds);
    setSelectedPartId(outcome.childIds[0] ?? null);
  };

  return {
    selectedGroup,
    canGroup: groupBlockReason === null,
    groupBlockReason,
    groupSelection,
    ungroupSelection,
  };
};

/** The same authority, wired to the animator context for UI callers. */
export const useLayerGrouping = (): LayerGrouping => useAnimatorAuthority(
  createLayerGroupingActions,
  // `selectedGroup` and the group block reason come from these.
  'characterParts', 'selectedPartId', 'selectedPartIds',
);
