import type { CharacterPart, Track } from '../types/animator';
import { resolveFreeformPath } from './freeform';

/** Inputs the stage can supply for the tangent-overlay eligibility decision. */
export interface FreeformTangentEligibilityInput {
  appMode: 'edit' | 'broadcast';
  activeTool: string;
  selectedPartIds: string[];
  selectedPart: CharacterPart | undefined;
  /** Evaluated world transform of the selected part at the current frame. */
  selectedTransform: { scaleX: number; scaleY: number } | null | undefined;
  tracks: Track[];
  /** True while another stage drag (translate/rotate/scale/marquee/shape) is active. */
  isDragging: boolean;
}

/**
 * Decides whether the direct tangent-handle overlay may render for the current
 * selection. Pure and exhaustive so the whole guard list is testable in one place;
 * `StageCanvas` only forwards the state it already has.
 */
export const isFreeformTangentOverlayEligible = ({
  appMode,
  activeTool,
  selectedPartIds,
  selectedPart,
  selectedTransform,
  tracks,
  isDragging,
}: FreeformTangentEligibilityInput): boolean => {
  if (appMode === 'broadcast') return false;
  if (activeTool !== 'select') return false;
  if (isDragging) return false;
  if (selectedPartIds.length !== 1) return false;
  if (!selectedPart) return false;
  if (selectedPart.type !== 'custom_freeform') return false;
  if (selectedPart.booleanOperation) return false;
  if (selectedPart.booleanOperandIds?.length) return false;
  if (selectedPart.booleanGroupId) return false;
  if (tracks.find((track) => track.partId === selectedPart.id)?.editVisible === false) return false;
  if (selectedPart.trimPathEnabled === true) return false;
  if (!selectedTransform) return false;
  if (selectedTransform.scaleX === 0 || selectedTransform.scaleY === 0) return false;

  const path = resolveFreeformPath(selectedPart);
  if (!path || path.coordinateSpace !== 'local') return false;
  return path.points.length >= 2;
};
