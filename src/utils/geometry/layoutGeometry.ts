import type { CharacterPart, Transform } from '../../types/animator';
import type { PartWorldBounds } from './bounds';
import { getLayerWorldBounds } from '../layers/layerGrouping';
import { relationshipAncestorIds } from '../layers/partBinding';

/**
 * THE shared layout geometry authority.
 *
 * It owns the two primitives every layout command in this round is measured
 * against — the EVALUATED WORLD bounds of a set of layers, and the snapping
 * resolver — so align, distribute, equal-spacing distribution and the translate
 * drag all read the same numbers. Nothing here writes the document, and nothing
 * here owns a transform: bounds are always derived from the canonical evaluator
 * (`getLayerWorldBounds`, which is itself built on the part-local bounds the
 * renderer draws), never from the DOM and never from an authored local box.
 *
 * ── Why the bounds primitives live here ────────────────────────────────────
 * The vector arrange planner (`utils/layers/vectorArrange`) and the snapping drag both
 * need to union world boxes and read their centres. Those two helpers used to be
 * private to the planner; they live here so a second copy cannot drift. The
 * planner imports them, the snap resolver imports them, and this module imports
 * neither — it is the lower layer, so there is exactly one union and one centre.
 *
 * ── Why a rotated layer measures right ─────────────────────────────────────
 * `getLayerWorldBounds` transforms the layer's four local corners through the
 * evaluated transform (rotation and scale included) and unions them, so a
 * rotated or non-uniformly scaled layer reports the box the user actually sees.
 * Snapping to that box is therefore correct for rotated art by construction.
 *
 * ── The snapping policy (ONE resolver) ─────────────────────────────────────
 * SNAP TARGETS — the stage box (left/right/top/bottom edge and the horizontal and
 *   vertical centre line) and every OTHER visible outermost layer's box
 *   (left/right/top/bottom edge and centre line). "Outermost" is deliberate: a
 *   real Group container is ONE visual item, so its children are represented by
 *   the container's aggregate box and never become independent targets on their
 *   own — a selected group snaps by its aggregate bounds, and an external layer
 *   can snap to that aggregate.
 *
 * SNAP POINTS — the moving item's own box: left/right/top/bottom edges and the
 *   horizontal/vertical centre. The candidate with the SMALLEST screen-space
 *   delta wins, and X and Y resolve INDEPENDENTLY, so a corner snap is two
 *   independent axis snaps that happen to fire on the same move.
 *
 * GUIDE EXTENT — a guide is chrome that has to say WHICH two things line up, so
 *   every guide carries a finite world band: the moving box's band on the guide's
 *   opposite axis, widened to reach the matched box's band when the target is a
 *   layer. A stage line is a reference (`span: null`) and therefore spans the
 *   moving item alone. Nothing here ever asks for the canvas: the overlay draws
 *   exactly the band the resolver reports, and a guide whose target is out of the
 *   moving box's neighbourhood still only covers the distance between the two.
 *
 * THRESHOLD — `SNAP_THRESHOLD_SCREEN_PX`, in SCREEN pixels, converted to world
 *   units by the caller through the camera scale. Keeping the threshold in screen
 *   pixels is what makes the feel identical at 25%, 100% and 400% zoom.
 *
 * DETERMINISM — ties (two candidates within the same delta) resolve by the
 *   candidate's position in the caller's deterministic target list, which the
 *   collectors below build in a fixed order: stage first, then layers in the
 *   caller's (stacking) order, edges before centre within a box.
 */

/** The screen-pixel snap radius. One named constant, converted by the caller. */
export const SNAP_THRESHOLD_SCREEN_PX = 8;

/** The axis a candidate line constrains: a vertical line constrains X, a horizontal one Y. */
export type SnapAxis = 'x' | 'y';

/** What produced a candidate line — used to document and to rank guides. */
export type SnapTargetKind = 'stage-edge' | 'stage-center' | 'layer-edge' | 'layer-center';

/** The band a box covers on ONE axis (its min..max span), in world units. */
export interface SnapSpan {
  min: number;
  max: number;
}

export interface SnapLine {
  axis: SnapAxis;
  /** The world coordinate of the line (an X for `axis: 'x'`, a Y for `axis: 'y'`). */
  value: number;
  kind: SnapTargetKind;
  /**
   * The band the line's OWN box covers on the OPPOSITE axis (`y` for an `x`
   * line), in world units — the geometry a guide for this line has to reach.
   * `null` for a REFERENCE line (a stage edge or centre): the stage is not a box
   * the moving item is compared against, so a guide for it covers the moving item
   * itself instead of the whole artboard.
   */
  span: SnapSpan | null;
}

/**
 * A guide the drag draws while a snap is active: the matched target line PLUS the
 * finite band it is drawn over.
 *
 * The band is exactly the relation that produced the snap — the union of the
 * moving box's band and the matched box's band on the guide's opposite axis, in
 * world units — so the chrome always touches both things it aligns and is never a
 * full-canvas line. The overlay that draws it converts these world extents to
 * editor coordinates and does no geometry of its own.
 */
export interface SnapGuide {
  axis: SnapAxis;
  value: number;
  kind: SnapTargetKind;
  extent: SnapSpan;
}

interface SnapResolution {
  /** The world delta after snapping (unchanged per axis when nothing matched). */
  delta: { x: number; y: number };
  /** The target lines the move locked onto, one per snapped axis. */
  guides: SnapGuide[];
  snappedX: boolean;
  snappedY: boolean;
}

/** The union of zero or more world boxes. Callers pass at least one. */
export const unionWorldBounds = (bounds: PartWorldBounds[]): PartWorldBounds => ({
  minX: Math.min(...bounds.map((item) => item.minX)),
  minY: Math.min(...bounds.map((item) => item.minY)),
  maxX: Math.max(...bounds.map((item) => item.maxX)),
  maxY: Math.max(...bounds.map((item) => item.maxY)),
});

export const worldBoundsCenter = (bounds: PartWorldBounds): { x: number; y: number } => ({
  x: (bounds.minX + bounds.maxX) / 2,
  y: (bounds.minY + bounds.maxY) / 2,
});

/** Shift a world box by a world delta — the moving item's box at the proposed drag delta. */
export const translateWorldBounds = (
  bounds: PartWorldBounds,
  delta: { x: number; y: number },
): PartWorldBounds => ({
  minX: bounds.minX + delta.x,
  minY: bounds.minY + delta.y,
  maxX: bounds.maxX + delta.x,
  maxY: bounds.maxY + delta.y,
});

/**
 * The six snap lines of the stage box: four edges and the two centre lines.
 * `bounds` is the stage's world box (the artboard), computed by the caller from
 * the project resolution and the output origin.
 */
export const collectStageSnapCandidates = (bounds: PartWorldBounds): SnapLine[] => {
  const center = worldBoundsCenter(bounds);
  // A stage line is a REFERENCE: `span: null` means a guide for it is drawn over
  // the moving item, never over the artboard it would otherwise inherit.
  return [
    { axis: 'x', value: bounds.minX, kind: 'stage-edge', span: null },
    { axis: 'x', value: center.x, kind: 'stage-center', span: null },
    { axis: 'x', value: bounds.maxX, kind: 'stage-edge', span: null },
    { axis: 'y', value: bounds.minY, kind: 'stage-edge', span: null },
    { axis: 'y', value: center.y, kind: 'stage-center', span: null },
    { axis: 'y', value: bounds.maxY, kind: 'stage-edge', span: null },
  ];
};

interface LayerSnapCandidateContext {
  parts: CharacterPart[];
  /** The layers the drag is moving (the resolved selection targets). */
  movingIds: string[];
  worldOf: (partId: string) => Transform;
  /** Edit visibility, the same predicate the marquee uses (`track.editVisible !== false`). */
  isVisible: (part: CharacterPart) => boolean;
}

/**
 * The snap lines of every OTHER visible outermost layer, in a deterministic
 * order (the caller's layer order, edges before centre).
 *
 * A layer is skipped when it is moving, when it lives inside a moving container
 * (it moves with it), or when it is a container that CARRIES a moving layer: a
 * container's box is derived from its children, so while a child moves that box
 * is not a stable target — and if every child is moving it would be the moving
 * item's own box, i.e. snapping to itself.
 */
export const collectLayerSnapCandidates = ({
  parts,
  movingIds,
  worldOf,
  isVisible,
}: LayerSnapCandidateContext): SnapLine[] => {
  const moving = new Set(movingIds);
  const carriedContainers = new Set<string>();
  moving.forEach((id) => {
    relationshipAncestorIds(parts, id).forEach((ancestor) => carriedContainers.add(ancestor));
  });
  const lines: SnapLine[] = [];

  parts.forEach((part) => {
    if (moving.has(part.id)) return;
    const ancestors = relationshipAncestorIds(parts, part.id);
    // A descendant of a moving container moves with it; a descendant of any
    // container is represented by that container's aggregate box.
    if (ancestors.some((ancestor) => moving.has(ancestor)) || ancestors.length > 0) return;
    if (carriedContainers.has(part.id)) return;
    if (!isVisible(part)) return;
    const bounds = getLayerWorldBounds(parts, part.id, worldOf);
    if (!bounds) return;
    const center = worldBoundsCenter(bounds);
    // Each line carries the band its own box covers on the opposite axis, so a
    // guide for it spans from the moving item to this layer and no further.
    const spanX: SnapSpan = { min: bounds.minY, max: bounds.maxY };
    const spanY: SnapSpan = { min: bounds.minX, max: bounds.maxX };
    lines.push(
      { axis: 'x', value: bounds.minX, kind: 'layer-edge', span: spanX },
      { axis: 'x', value: center.x, kind: 'layer-center', span: spanX },
      { axis: 'x', value: bounds.maxX, kind: 'layer-edge', span: spanX },
      { axis: 'y', value: bounds.minY, kind: 'layer-edge', span: spanY },
      { axis: 'y', value: center.y, kind: 'layer-center', span: spanY },
      { axis: 'y', value: bounds.maxY, kind: 'layer-edge', span: spanY },
    );
  });

  return lines;
};

interface ResolveSnapInput {
  /** The moving item's world box at the START of the drag (before the delta). */
  movingBounds: PartWorldBounds;
  /** The raw world delta the pointer produced this move. */
  delta: { x: number; y: number };
  /** The candidate lines, in deterministic order (see the collectors). */
  candidates: SnapLine[];
  /** The snap radius in WORLD units (screen threshold / camera scale). */
  thresholdWorld: number;
  /** When false the raw delta is returned unchanged and no guide is produced. */
  enabled: boolean;
}

/**
 * Snap a proposed translation onto the nearest candidate per axis.
 *
 * The moving box is placed at the raw delta first, then each axis independently
 * searches every moving snap point (min/centre/max) against every candidate of
 * that axis and takes the candidate with the smallest absolute adjustment within
 * the threshold. Ties keep the first candidate in the list, so the result is
 * deterministic. X and Y are independent; a corner lock is simply both firing.
 */
export const resolveSnap = ({
  movingBounds,
  delta,
  candidates,
  thresholdWorld,
  enabled,
}: ResolveSnapInput): SnapResolution => {
  const unchanged: SnapResolution = { delta: { ...delta }, guides: [], snappedX: false, snappedY: false };
  if (!enabled || thresholdWorld <= 0 || candidates.length === 0) return unchanged;

  const proposed = translateWorldBounds(movingBounds, delta);
  const center = worldBoundsCenter(proposed);
  const movingPoints: Record<SnapAxis, number[]> = {
    x: [proposed.minX, center.x, proposed.maxX],
    y: [proposed.minY, center.y, proposed.maxY],
  };

  const resolveAxis = (axis: SnapAxis): { adjustment: number; line: SnapLine } | null => {
    let best: { adjustment: number; line: SnapLine } | null = null;
    for (const line of candidates) {
      if (line.axis !== axis) continue;
      for (const point of movingPoints[axis]) {
        const adjustment = line.value - point;
        const distance = Math.abs(adjustment);
        if (distance > thresholdWorld) continue;
        if (best === null || distance < Math.abs(best.adjustment)) best = { adjustment, line };
      }
    }
    return best;
  };

  const x = resolveAxis('x');
  const y = resolveAxis('y');
  const finalDelta = {
    x: delta.x + (x?.adjustment ?? 0),
    y: delta.y + (y?.adjustment ?? 0),
  };
  // The extents describe where the item IS, so they are measured from the box at
  // the SNAPPED delta — the box the write commits and the renderer draws — not
  // from the raw pointer delta a snap may still move.
  const finalBounds = translateWorldBounds(movingBounds, finalDelta);

  // The band a guide is drawn over: the moving box's band on the guide's opposite
  // axis, widened to reach the matched box when the target IS a box. A reference
  // line (the stage) has no band of its own, so the moving box's band stands alone
  // — the guide then underlines the item instead of covering the artboard.
  const guideFor = (axis: SnapAxis, line: SnapLine): SnapGuide => {
    const moving = axis === 'x'
      ? { min: finalBounds.minY, max: finalBounds.maxY }
      : { min: finalBounds.minX, max: finalBounds.maxX };
    return {
      axis,
      value: line.value,
      kind: line.kind,
      extent: line.span
        ? { min: Math.min(moving.min, line.span.min), max: Math.max(moving.max, line.span.max) }
        : moving,
    };
  };

  return {
    delta: finalDelta,
    guides: [...(x ? [guideFor('x', x.line)] : []), ...(y ? [guideFor('y', y.line)] : [])],
    snappedX: x !== null,
    snappedY: y !== null,
  };
};
