import type { CharacterPart, Track, Transform } from '../types/animator';
import type { ProjectResolution } from '../utils/geometry/projectCoordinates';
import { getLayerWorldBounds } from '../utils/layers/layerGrouping';
import { unionWorldBounds } from '../utils/geometry/layoutGeometry';
import { collectArrangeTargets } from '../utils/layers/vectorArrange';
import {
  clampStageCropRect,
  isFullStageCropRect,
  resolveStageCropShiftRoots,
  shiftStageCropLayers,
  shiftStageCropTracks,
  stageCropRectFromWorldBounds,
  stageCropResolution,
  stageCropShift,
  type StageCropRect,
} from '../utils/geometry/stageCrop';
import type { ToastOptions } from './useToast';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info', options?: ToastOptions) => void;

/**
 * The one stage-crop authoring authority.
 *
 * Every crop — the region the user drew, the region that encloses the current
 * selection and the region that encloses all canvas-visible content — runs
 * through `commitCrop` below, so all three produce the same document mutation
 * (one uniform centre-relative shift of the top-level layers plus the new stage
 * size) inside ONE batch interaction, and one crop is exactly one undo entry.
 *
 * ── Frame semantics of the two convenience commands ────────────────────────
 * Both measure the EVALUATED world bounds at the CURRENT AUTHORED FRAME, which
 * is what the user is looking at, and neither claims to enclose every frame of
 * any animated property: a layer whose position or scale animates away from the
 * crop will still travel outside the new frame at the frames that move it. That
 * is why the commands name the frame they measured, and why no "crop to all
 * animation frames" command exists: it would need a bounded scan of every frame
 * of every sequence, and inventing an unbounded one would misdescribe the result.
 *
 * A selection crop measures the SELECTION as a whole (its collective evaluated
 * box, the same measurement the align/distribute commands arrange with), and a
 * visible-content crop measures every canvas-visible layer (`editVisible`, the
 * predicate the marquee, the snapping drag and the Outliner's eye all use). The
 * union over every visible layer equals the union over only the outermost ones
 * because a container's box IS the union of its children.
 */
interface StageCrop {
  /** Why this document cannot be cropped, or `null` when the commands can run. */
  blockReason: string | null;
  /** The region that encloses the current selection at the current frame. */
  canCropToSelection: boolean;
  /** The region that encloses all canvas-visible content at the current frame. */
  canCropToVisibleContent: boolean;
  /** Applies a region (defaults to the one on screen). ONE history entry. */
  applyCropRegion: (rect?: StageCropRect | null) => boolean;
  /** Crop to the current selection, measured at the current authored frame. */
  cropToSelection: () => boolean;
  /** Crop to all canvas-visible content, measured at the current authored frame. */
  cropToVisibleContent: () => boolean;
}

/**
 * The inputs the crop authority reads. They are taken explicitly rather than
 * from the context so the state provider can build the commands once and expose
 * them to every caller — the Crop band and the stage overlay are two surfaces of
 * ONE implementation, and there is no second copy of the crop law.
 */
interface StageCropDependencies {
  currentFrame: number;
  characterParts: CharacterPart[];
  tracks: Track[];
  selectedPartId: string | null;
  selectedPartIds: string[];
  projectResolution: ProjectResolution;
  getComputedTransform: (partId: string, frame: number) => Transform;
  startBatchInteraction: () => void;
  endBatchInteraction: () => void;
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  setProjectResolution: React.Dispatch<React.SetStateAction<ProjectResolution>>;
  /** Clears the on-screen region once it has been applied. */
  onRegionApplied: () => void;
  showToast?: ShowToast;
}

/**
 * A layer pinned by a stage anchor ignores its authored `x`/`y` entirely: the
 * evaluator replaces them with the anchor's fixed stage offsets, so no crop can
 * move that layer to the new origin. The crop is refused instead of silently
 * leaving the layer behind.
 */
const ANCHOR_BLOCK_REASON =
  'A layer pinned by a stage anchor cannot be moved by a crop. Set its anchor to None first.';

export const createStageCropActions = ({
  currentFrame,
  characterParts,
  tracks,
  selectedPartId,
  selectedPartIds,
  projectResolution,
  getComputedTransform,
  startBatchInteraction,
  endBatchInteraction,
  setCharacterParts,
  setTracks,
  setProjectResolution,
  onRegionApplied,
  showToast,
}: StageCropDependencies): StageCrop => {
  const worldOf = (partId: string) => getComputedTransform(partId, currentFrame);
  const rootIds = resolveStageCropShiftRoots(characterParts);
  const roots = new Set(rootIds);
  const anchoredRoot = characterParts.find(
    (part) => roots.has(part.id) && part.anchor !== undefined && part.anchor !== 'none',
  );
  const blockReason = anchoredRoot ? ANCHOR_BLOCK_REASON : null;

  /** The collective evaluated box of the layers a command would enclose. */
  const boundsOfLayers = (parts: CharacterPart[]): StageCropRect | null => {
    const boxes = parts
      .map((part) => getLayerWorldBounds(characterParts, part.id, worldOf))
      .filter((bounds): bounds is NonNullable<typeof bounds> => bounds !== null);
    if (boxes.length === 0) return null;
    return stageCropRectFromWorldBounds(unionWorldBounds(boxes), projectResolution);
  };

  // The canonical selection: the set, plus the primary when a single-target
  // caller (the marquee, the context menu) moved only that one.
  const selectionIds = selectedPartId && !selectedPartIds.includes(selectedPartId)
    ? [...selectedPartIds, selectedPartId]
    : selectedPartIds;
  const selectionTargets = collectArrangeTargets(characterParts, selectionIds, worldOf);
  const selectionCropRect = selectionTargets.length > 0
    ? stageCropRectFromWorldBounds(unionWorldBounds(selectionTargets.map((target) => target.bounds)), projectResolution)
    : null;
  // The visible-content rectangle is computed only when that crop runs.
  // The commands are rebuilt on every provider render (every playback frame),
  // and the availability flag only needs ONE visible layer with bounds, so it
  // stops at the first one instead of evaluating every layer's world box.
  const hiddenIds = new Set(tracks.filter((track) => track.editVisible === false).map((track) => track.partId));
  const visibleParts = () => characterParts.filter((part) => !hiddenIds.has(part.id));
  const hasVisibleContent = blockReason === null
    && characterParts.some((part) => !hiddenIds.has(part.id) && getLayerWorldBounds(characterParts, part.id, worldOf) !== null);

  /**
   * The ONE crop write: shift every top-level layer, move the whole scene to the
   * region's top-left, then set the stage size — all inside one batch
   * interaction, so Undo restores the previous dimensions AND the previous
   * positions in a single step.
   */
  const commitCrop = (rect: StageCropRect | null, label: string): boolean => {
    if (blockReason) {
      showToast?.(blockReason, 'info');
      return false;
    }
    const clamped = rect ? clampStageCropRect(rect, projectResolution) : null;
    if (!clamped) {
      showToast?.('Select a crop region that overlaps the stage.', 'info');
      return false;
    }
    if (isFullStageCropRect(clamped, projectResolution)) {
      showToast?.('That region is the whole stage — there is nothing to crop.', 'info');
      return false;
    }

    const shift = stageCropShift(clamped, projectResolution);
    const nextResolution = stageCropResolution(clamped);
    startBatchInteraction();
    setCharacterParts((previous) => shiftStageCropLayers(previous, rootIds, shift));
    setTracks((previous) => shiftStageCropTracks(previous, rootIds, shift));
    setProjectResolution(nextResolution);
    endBatchInteraction();
    onRegionApplied();
    showToast?.(`${label} · stage ${nextResolution.width}×${nextResolution.height}`, 'success');
    return true;
  };

  return {
    blockReason,
    canCropToSelection: blockReason === null && selectionCropRect !== null,
    canCropToVisibleContent: hasVisibleContent,
    applyCropRegion: (rect) => commitCrop(rect ?? null, 'Cropped the stage'),
    cropToSelection: () => commitCrop(selectionCropRect, 'Cropped the stage to the selection'),
    cropToVisibleContent: () => commitCrop(boundsOfLayers(visibleParts()), 'Cropped the stage to the visible content'),
  };
};
