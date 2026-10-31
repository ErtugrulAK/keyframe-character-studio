import { useAnimatorAuthority } from '../context/useAnimator';
import type { AnimatorContextType } from '../context/AnimatorContext';
import { makeEmptyChannels } from '../utils/animation/defaults';
import { generateId } from '../utils/layers/idGenerator';
import type { CharacterPart } from '../types/animator';
import {
  isBooleanEligible,
  computeBooleanContours,
  deriveBooleanGeometry,
  inspectBooleanOperands,
  dissolveBooleanGroup as dissolveBooleanGroupState,
  createBooleanDisplayName,
  isGeneratedBooleanName,
  type BooleanOperation,
} from '../utils/geometry/booleanGeometry';

/**
 * The one Boolean authoring authority for the current selection.
 *
 * Lifted out of `DetailsPanel` unchanged: it reads the selection, traces the
 * operands through `utils/geometry/booleanGeometry` and writes the group through the
 * ordinary `setCharacterParts`/`setTracks` state setters inside a single batch
 * interaction. The Inspector and the authoring toolbar both drive these same
 * functions, so there is exactly one Boolean write path.
 */
interface BooleanAuthoring {
  /** Boolean-eligible parts in the current selection (2+ enables creation). */
  booleanEligibleParts: CharacterPart[];
  /** The Boolean group the selection points at, when one is selected. */
  selectedBooleanGroup: CharacterPart | undefined;
  createBooleanGroup: (operation: BooleanOperation) => void;
  updateBooleanOperation: (operation: BooleanOperation) => void;
  dissolveBooleanGroup: () => void;
}

/** The Boolean authority over one store state (see `useBooleanAuthoring`). */
const createBooleanAuthoring = ({
    currentFrame,
    selectedPartId,
    selectedPartIds,
    characterParts,
    setCharacterParts,
    setTracks,
    setSelectedPartId,
    setSelectedPartIds,
    getComputedTransform,
    startBatchInteraction,
    endBatchInteraction,
    showToast,
    tracks,
    setBooleanOperandEditingGroupId,
}: AnimatorContextType): BooleanAuthoring => {

  const booleanEligibleParts = selectedPartIds
    .map((id) => characterParts.find((part) => part.id === id))
    .filter((part): part is NonNullable<typeof part> => Boolean(part && isBooleanEligible(part)));

  const createBooleanGroup = (operation: BooleanOperation) => {
    if (booleanEligibleParts.length < 2) return;
    const transforms = Object.fromEntries(booleanEligibleParts.map((part) => [part.id, getComputedTransform(part.id, currentFrame)]));
    const readiness = inspectBooleanOperands(booleanEligibleParts, transforms);
    if (!readiness.ready) {
      const names = readiness.unresolved.map((part) => part.name).join(', ');
      showToast(`Could not build the Boolean: no geometry for ${names}. Nothing was created.`, 'error');
      return;
    }
    const contours = computeBooleanContours(operation, booleanEligibleParts, transforms);
    if (contours.length === 0) {
      showToast('The selected shapes produce an empty result.', 'info');
      return;
    }
    const groupId = generateId('boolean');
    const groupPart = {
      ...booleanEligibleParts[0],
      id: groupId,
      name: createBooleanDisplayName(operation, characterParts, undefined, booleanEligibleParts.map((part) => part.name)),
      type: 'custom_freeform' as const,
      zIndex: Math.max(...booleanEligibleParts.map((part) => part.zIndex)) + 1,
      parentId: undefined,
      booleanGroupId: undefined,
      boundPartIds: undefined,
      matte: undefined,
      booleanOperation: operation,
      booleanOperandIds: booleanEligibleParts.map((part) => part.id),
      booleanContours: contours,
      points: contours[0],
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    };
    startBatchInteraction();
    setCharacterParts((parts) => [
      ...parts.map((part) => booleanEligibleParts.some((operand) => operand.id === part.id) ? { ...part, booleanGroupId: groupId } : part),
      groupPart,
    ]);
    setTracks((currentTracks) => [
      ...currentTracks,
      {
        id: generateId('track'),
        partId: groupId,
        name: groupPart.name,
        color: '#38bdf8',
        visible: true,
        locked: false,
        channels: makeEmptyChannels(),
      },
    ]);
    endBatchInteraction();
    setSelectedPartIds([groupId]);
    setSelectedPartId(groupId);
  };

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const selectedBooleanGroup = selectedPart?.booleanOperandIds?.length
    ? selectedPart
    : characterParts.find((part) => part.id === selectedPart?.booleanGroupId);

  const updateBooleanOperation = (operation: BooleanOperation) => {
    if (!selectedBooleanGroup || !selectedBooleanGroup.booleanOperandIds) return;
    const operands = selectedBooleanGroup.booleanOperandIds
      .map((id) => characterParts.find((part) => part.id === id))
      .filter((part): part is NonNullable<typeof part> => Boolean(part));
    const transforms = Object.fromEntries(
      operands.map((operand) => [operand.id, getComputedTransform(operand.id, currentFrame)]),
    );
    const groupTransform = getComputedTransform(selectedBooleanGroup.id, currentFrame);
    const operandNames = operands.map((operand) => operand.name);
    // Switching the operation is refused when an operand has no geometry, so a
    // failed trace never silently becomes a different operation.
    const readiness = inspectBooleanOperands(operands, transforms);
    if (!readiness.ready) {
      const names = readiness.unresolved.map((part) => part.name).join(', ');
      showToast(`Could not switch the Boolean operation: no geometry for ${names}.`, 'error');
      return;
    }
    const derived = deriveBooleanGeometry(operation, operands, transforms, groupTransform);
    const contours = derived.localContours;
    startBatchInteraction();
    setCharacterParts((parts) => parts.map((part) => part.id === selectedBooleanGroup.id
      ? {
        ...part,
        name: isGeneratedBooleanName(part.name)
          ? createBooleanDisplayName(operation, parts, part.name, operandNames)
          : part.name,
        booleanOperation: operation,
        booleanContours: contours,
        points: contours[0] ?? [],
      }
      : part));
    endBatchInteraction();
    if (contours.length === 0) showToast('Boolean result is empty.', 'info');
  };

  const dissolveBooleanGroup = () => {
    if (!selectedBooleanGroup?.booleanOperandIds) return;
    const operandWorldTransforms = Object.fromEntries(
      selectedBooleanGroup.booleanOperandIds.map((id) => [id, getComputedTransform(id, currentFrame)]),
    );
    const result = dissolveBooleanGroupState(characterParts, tracks, selectedBooleanGroup.id);
    if (result.operandIds.length === 0) return;
    const bakedParts = result.parts.map((part) => {
      const world = operandWorldTransforms[part.id];
      return world
        ? { ...part, baseTransform: { ...part.baseTransform, ...world }, booleanGroupId: undefined }
        : part;
    });
    startBatchInteraction();
    setCharacterParts(bakedParts);
    setTracks(result.tracks);
    setBooleanOperandEditingGroupId(null);
    setSelectedPartIds(result.operandIds);
    setSelectedPartId(result.operandIds[result.operandIds.length - 1] ?? null);
    endBatchInteraction();
  };

  return { booleanEligibleParts, selectedBooleanGroup, createBooleanGroup, updateBooleanOperation, dissolveBooleanGroup };
};

export const useBooleanAuthoring = (): BooleanAuthoring => useAnimatorAuthority(
  createBooleanAuthoring,
  // The eligible operands and the selected Boolean group come from these.
  'characterParts', 'selectedPartId', 'selectedPartIds',
);
