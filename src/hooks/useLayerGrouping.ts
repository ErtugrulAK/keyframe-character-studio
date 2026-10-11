import { useAnimator } from '../context/useAnimator';
import { generateId } from '../utils/idGenerator';
import {
  createGroupDisplayName,
  createLayerGroup,
  dissolveLayerGroup,
  groupSelectionBlockReason,
  ungroupBlockReason,
} from '../utils/layerGrouping';
import type { CharacterPart } from '../types/animator';

/**
 * The one layer-group authoring authority for the current selection.
 *
 * It reads the selection, plans the change with the pure helpers in
 * `utils/layerGrouping` and writes the result through the ordinary
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

export const useLayerGrouping = (): LayerGrouping => {
  const {
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
  } = useAnimator();

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
    startBatchInteraction();
    setCharacterParts(outcome.parts);
    setTracks(outcome.tracks);
    endBatchInteraction();
    setSelectedPartIds([outcome.groupId]);
    setSelectedPartId(outcome.groupId);
    showToast(`Grouped ${outcome.childIds.length} layers`, 'success');
  };

  const ungroupSelection = () => {
    if (!selectedGroup) {
      showToast(ungroupBlockReason(characterParts, tracks, selectedPartId ?? '') ?? 'Select a layer group to ungroup.', 'info');
      return;
    }
    const outcome = dissolveLayerGroup(characterParts, tracks, selectedGroup.id, (partId) => getComputedTransform(partId, currentFrame));
    if (!outcome.ok) {
      showToast(outcome.reason, 'error');
      return;
    }
    startBatchInteraction();
    setCharacterParts(outcome.parts);
    setTracks(outcome.tracks);
    endBatchInteraction();
    setSelectedPartIds(outcome.childIds);
    setSelectedPartId(outcome.childIds[0] ?? null);
    showToast(`Ungrouped ${outcome.childIds.length} layers; positions kept.`, 'success');
  };

  return {
    selectedGroup,
    canGroup: groupBlockReason === null,
    groupBlockReason,
    groupSelection,
    ungroupSelection,
  };
};
