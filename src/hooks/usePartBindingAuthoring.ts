import { useAnimator } from '../context/useAnimator';
import { bindParts, isRelationshipChainRelated, resolveBondGroup, unbindPart } from '../utils/partBinding';

/**
 * The one layer-bond authoring authority for the current selection.
 *
 * Bind/Bond is position-only: it writes `boundPartIds` through
 * `utils/partBinding` and nothing else. The write goes through the ordinary
 * `setCharacterParts` setter inside a single batch interaction — the same shape
 * as the grouping and Boolean authorities — so bonding is one undo step and one
 * history entry. There is exactly one bind write path, and it is shared by every
 * authoring surface (the toolbars and the editor context menu), so Details can
 * stay an information surface with no structural command of its own.
 */
interface PartBindingAuthoring {
  /** The bond group of the selected layer (empty when it is not bonded). */
  bondGroupIds: string[];
  /** Whether the current selection can be bonded right now. */
  canBind: boolean;
  /** Why the current selection cannot be bonded, when it cannot. */
  bindBlockReason: string | null;
  /** Whether the selected layer is in a bond that can be released. */
  canRelease: boolean;
  bindSelection: () => void;
  releaseBinding: () => void;
}

export const usePartBindingAuthoring = (): PartBindingAuthoring => {
  const {
    selectedPartId,
    selectedPartIds,
    characterParts,
    setCharacterParts,
    startBatchInteraction,
    endBatchInteraction,
    showToast,
  } = useAnimator();

  const selectedIds = selectedPartIds ?? [];
  const bondGroupIds = selectedPartId ? resolveBondGroup(characterParts, selectedPartId) : [];
  /**
   * A bond between layers that already move together — a parent and its child,
   * or a container and its member — would apply the same motion twice, so the
   * pair is refused instead of silently double-transforming the child.
   */
  const relatedPair = selectedIds.some((first, index) =>
    selectedIds.slice(index + 1).some((second) => isRelationshipChainRelated(characterParts, first, second)));
  const bindBlockReason = selectedIds.length < 2
    ? 'Bond needs two or more selected layers.'
    : relatedPair
      ? 'Those layers are already parent and child; bonding them would move the child twice.'
      : null;

  const bindSelection = () => {
    if (bindBlockReason !== null) {
      showToast(bindBlockReason, 'info');
      return;
    }
    startBatchInteraction();
    setCharacterParts((parts) => bindParts(parts, selectedIds));
    endBatchInteraction();
  };

  const releaseBinding = () => {
    if (!selectedPartId || bondGroupIds.length < 2) {
      showToast('Select a bonded layer to release its bond.', 'info');
      return;
    }
    startBatchInteraction();
    setCharacterParts((parts) => unbindPart(parts, selectedPartId));
    endBatchInteraction();
  };

  return {
    bondGroupIds,
    canBind: bindBlockReason === null,
    bindBlockReason,
    canRelease: Boolean(selectedPartId) && bondGroupIds.length > 1,
    bindSelection,
    releaseBinding,
  };
};
