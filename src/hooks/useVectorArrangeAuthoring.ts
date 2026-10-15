import { useAnimator } from '../context/useAnimator';
import type { CharacterPart, Transform } from '../types/animator';
import type { ToastOptions } from './useToast';
import {
  collectArrangeTargets,
  planAlign,
  planDistribute,
  planDistributeByGap,
  planFlip,
  planRotate,
  type AlignEdge,
  type ArrangePlan,
  type DistributeAxis,
  type FlipAxis,
  type RotateDirection,
} from '../utils/vectorArrange';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info', options?: ToastOptions) => void;

/**
 * The one vector-arrange authoring authority for the current selection.
 *
 * It reads the selection, plans the command with the pure helpers in
 * `utils/vectorArrange` and writes the plan through the ONE transform write path
 * (`updateCurrentTransform`: world space in, container-local out) inside a single
 * batch interaction — so a command is one undo step and one history entry, and
 * it works on animated and static layers alike. The toolbar and the keyboard
 * commands run the SAME actions, so no second geometry rule exists.
 */
export interface VectorArrange {
  /** How many measurable layers the current selection would arrange. */
  targetCount: number;
  /** Aligning needs two measurable layers. */
  canAlign: boolean;
  /** Distributing needs three measurable layers. */
  canDistribute: boolean;
  /** Rotating or flipping needs one. */
  canTransform: boolean;
  align: (edge: AlignEdge) => void;
  distribute: (axis: DistributeAxis) => void;
  /** Equal EDGE-GAP distribution (the equal-spacing command). */
  distributeGap: (axis: DistributeAxis) => void;
  rotate: (direction: RotateDirection) => void;
  flip: (axis: FlipAxis) => void;
}

/**
 * The inputs the arrange authority reads. They are taken explicitly rather than
 * from the context so the state provider can build the SAME actions for the
 * keyboard commands without a second implementation.
 */
export interface VectorArrangeDependencies {
  currentFrame: number;
  selectedPartId: string | null;
  selectedPartIds: string[];
  characterParts: CharacterPart[];
  getComputedTransform: (partId: string, frame: number) => Transform;
  /** The ONE transform write path: world-space patch in, container-local out. */
  updateCurrentTransform: (newTransform: Partial<Transform>, partIdOverride?: string) => void;
  startBatchInteraction: () => void;
  endBatchInteraction: () => void;
  showToast?: ShowToast;
}


export const createVectorArrangeActions = ({
  currentFrame,
  selectedPartId,
  selectedPartIds,
  characterParts,
  getComputedTransform,
  updateCurrentTransform,
  startBatchInteraction,
  endBatchInteraction,
  showToast,
}: VectorArrangeDependencies): VectorArrange => {
  // The canonical selection: the set, plus the primary when a single-target
  // caller (the marquee, the context menu) moved only that one.
  const selectionIds = selectedPartId && !selectedPartIds.includes(selectedPartId)
    ? [...selectedPartIds, selectedPartId]
    : selectedPartIds;
  const targets = collectArrangeTargets(
    characterParts,
    selectionIds,
    (partId) => getComputedTransform(partId, currentFrame),
  );

  /** One command: write the plan as ONE batch interaction, or explain why not. */
  const commit = (plan: ArrangePlan | null, unavailable: string) => {
    if (plan === null) {
      showToast?.(unavailable, 'info');
      return;
    }
    const entries = Object.entries(plan);
    // A command that would not move anything writes nothing at all: no empty
    // history entry and no keyframe on a property that did not change.
    if (entries.length === 0) return;

    startBatchInteraction();
    entries.forEach(([id, patch]) => updateCurrentTransform(patch, id));
    endBatchInteraction();
  };

  return {
    targetCount: targets.length,
    canAlign: targets.length >= 2,
    canDistribute: targets.length >= 3,
    canTransform: targets.length >= 1,
    align: (edge) => commit(planAlign(targets, edge), 'Align needs two measurable layers.'),
    distribute: (axis) => commit(planDistribute(targets, axis), 'Distribute needs three measurable layers.'),
    distributeGap: (axis) => commit(
      planDistributeByGap(targets, axis),
      'Distribution needs three measurable layers.',
    ),
    rotate: (direction) => commit(
      planRotate(targets, direction),
      'Select a layer to rotate.',
    ),
    flip: (axis) => commit(
      planFlip(targets, axis),
      'Select a layer to flip.',
    ),
  };
};

/** The same authority, wired to the animator context for UI callers. */
export const useVectorArrangeAuthoring = (): VectorArrange => createVectorArrangeActions(useAnimator());
