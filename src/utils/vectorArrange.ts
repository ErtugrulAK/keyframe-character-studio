import type { CharacterPart, Transform } from '../types/animator';
import type { PartWorldBounds } from './bounds';
import { getLayerWorldBounds } from './layerGrouping';
import { mirrorTransform } from './mirror';
import { relationshipAncestorIds } from './partBinding';
import { rotateAboutWorldPivot } from './rotationGesture';

/**
 * THE vector arrange authority: align, distribute, rotate and flip for the
 * current layer selection.
 *
 * It is pure planning only — it decides WHICH world-space patch every target
 * receives and hands it back; nothing here writes the document. The authoring
 * hook (`useVectorArrangeAuthoring`) writes the plan through the ONE transform
 * write path (`updateCurrentTransform`, which converts world space into each
 * layer's container-local space) inside ONE batch interaction, so a command is
 * exactly one undo step.
 *
 * ── What a target is ───────────────────────────────────────────────────────
 * A target is a LAYER of the canonical selection, measured in world space by
 * `getLayerWorldBounds` — the group-aware measurement the grouping authority
 * already uses, so a container is arranged by the box its children define and
 * the two can never disagree.
 *
 * A layer whose ancestor is ALSO selected is dropped: the ancestor already
 * carries it, and writing both would move it twice (the evaluator composes the
 * chain). The ancestor relationship is read from `utils/partBinding`, which is
 * the one place `parentId`/`booleanGroupId` precedence is defined, so this file
 * cannot drift from the evaluator's own walk.
 *
 * ── The four documented policies ────────────────────────────────────────────
 * ALIGN — the reference box is the COLLECTIVE selection bounds (the union of
 *   every target's world box). The editor has no reference-object ("key
 *   object") authority, so inventing one here would be a second selection rule;
 *   the collective box is what the selection frame already draws. Only the
 *   aligned axis is written, so the other axis cannot drift, and a target that
 *   is already on the edge is left completely alone (no zero-delta write, so no
 *   keyframe is created for a property that did not move).
 *
 * DISTRIBUTE — needs at least three measurable targets. Targets are ordered by
 *   their box CENTRE along the axis, ties broken by layer id, so the plan is
 *   deterministic for equal centres. The two extreme targets keep their
 *   positions (the span of the selection is never changed by a distribute) and
 *   every interior target's centre is placed at an even step between the two
 *   extremes: `first + (last - first) * i / (n - 1)`. This is distribution by
 *   centres, not by gaps: it is defined for overlapping layers as well.
 *
 * ROTATE — ±90°, pivoting on the COLLECTIVE selection centre (a single target
 *   pivots on its own visual centre, of which the collective box is the same
 *   point). One pivot for the whole selection turns it as one rigid body, and
 *   every target's new place comes from `rotateAboutWorldPivot` — the same
 *   pivot-rotation authority the canvas gizmo uses — evaluated against the
 *   transform captured before the command, so the pivot cannot drift.
 *
 * FLIP — about the COLLECTIVE selection centre, and world placement is
 *   preserved: a single target flips in place around its own visual centre, and
 *   a multi-selection mirrors as one picture (this is precisely the box the user
 *   sees). The sign law is `utils/mirror`'s (`scaleX`/`scaleY` and `rotation`
 *   negate), applied about the origin line and then translated onto the flip
 *   axis, so the flip is the exact mirror of a rotated, non-uniformly scaled
 *   layer rather than an approximation.
 */

export type AlignEdge = 'left' | 'right' | 'top' | 'bottom' | 'horizontal-centers' | 'vertical-centers';
export type DistributeAxis = 'horizontal' | 'vertical';
export type RotateDirection = 'ccw' | 'cw';
export type FlipAxis = 'horizontal' | 'vertical';

/** The world-space patch a command writes, in the editor's own transform fields. */
export type ArrangePatch = Partial<Pick<Transform, 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY'>>;

/** The world-space patches of one command, keyed by layer id, in write order. */
export type ArrangePlan = Record<string, ArrangePatch>;

export interface ArrangeTarget {
  id: string;
  /** The layer's evaluated world transform, captured before any write. */
  transform: Transform;
  /** The layer's world bounds, group-aware. */
  bounds: PartWorldBounds;
}

/** Sub-pixel deltas are not a move: they must not create a keyframe. */
const POSITION_EPSILON = 1e-6;

const unionBounds = (bounds: PartWorldBounds[]): PartWorldBounds => ({
  minX: Math.min(...bounds.map((item) => item.minX)),
  minY: Math.min(...bounds.map((item) => item.minY)),
  maxX: Math.max(...bounds.map((item) => item.maxX)),
  maxY: Math.max(...bounds.map((item) => item.maxY)),
});

const boundsCenter = (bounds: PartWorldBounds): { x: number; y: number } => ({
  x: (bounds.minX + bounds.maxX) / 2,
  y: (bounds.minY + bounds.maxY) / 2,
});

/**
 * The layers an arrange command acts on: the canonical selection, minus every
 * layer an also-selected ancestor already carries.
 */
export const resolveArrangeTargets = (parts: CharacterPart[], ids: string[]): string[] => {
  const present: string[] = [];
  const seen = new Set<string>();
  ids.forEach((id) => {
    if (seen.has(id) || !parts.some((part) => part.id === id)) return;
    seen.add(id);
    present.push(id);
  });
  const selected = new Set(present);
  return present.filter((id) => !relationshipAncestorIds(parts, id).some((ancestor) => selected.has(ancestor)));
};

/**
 * The measurable targets of a selection: a layer with no world bounds (an empty
 * container, a Boolean group whose operands currently resolve to nothing) is
 * simply not part of the arrangement.
 */
export const collectArrangeTargets = (
  parts: CharacterPart[],
  ids: string[],
  worldOf: (partId: string) => Transform,
): ArrangeTarget[] => {
  const targets: ArrangeTarget[] = [];
  resolveArrangeTargets(parts, ids).forEach((id) => {
    const bounds = getLayerWorldBounds(parts, id, worldOf);
    if (!bounds) return;
    const transform = worldOf(id);
    if (!Number.isFinite(transform.x) || !Number.isFinite(transform.y)) return;
    targets.push({ id, transform, bounds });
  });
  return targets;
};

/**
 * Align every target's box edge (or centre) onto the collective selection box.
 * Returns `null` when the selection cannot be aligned at all.
 */
export const planAlign = (targets: ArrangeTarget[], edge: AlignEdge): ArrangePlan | null => {
  if (targets.length < 2) return null;
  const reference = unionBounds(targets.map((target) => target.bounds));
  const referenceCenter = boundsCenter(reference);
  const plan: ArrangePlan = {};

  targets.forEach(({ id, transform, bounds }) => {
    const center = boundsCenter(bounds);
    let deltaX = 0;
    let deltaY = 0;
    if (edge === 'left') deltaX = reference.minX - bounds.minX;
    else if (edge === 'right') deltaX = reference.maxX - bounds.maxX;
    else if (edge === 'top') deltaY = reference.minY - bounds.minY;
    else if (edge === 'bottom') deltaY = reference.maxY - bounds.maxY;
    else if (edge === 'horizontal-centers') deltaX = referenceCenter.x - center.x;
    else deltaY = referenceCenter.y - center.y;

    const x = transform.x + deltaX;
    const y = transform.y + deltaY;
    const patch: ArrangePatch = {};
    if (Math.abs(deltaX) > POSITION_EPSILON && Number.isFinite(x)) patch.x = x;
    if (Math.abs(deltaY) > POSITION_EPSILON && Number.isFinite(y)) patch.y = y;
    if (patch.x !== undefined || patch.y !== undefined) plan[id] = patch;
  });

  return plan;
};

/**
 * Even out the spacing of three or more targets' centres along one axis. The
 * extremes stay where they are; the interior targets take an even step between
 * them. Returns `null` when the selection cannot be distributed.
 */
export const planDistribute = (targets: ArrangeTarget[], axis: DistributeAxis): ArrangePlan | null => {
  if (targets.length < 3) return null;
  const axisCenter = (target: ArrangeTarget) => axis === 'horizontal'
    ? boundsCenter(target.bounds).x
    : boundsCenter(target.bounds).y;

  // Deterministic order: by centre along the axis, ties broken by layer id.
  const ordered = [...targets].sort((a, b) => (
    axisCenter(a) - axisCenter(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  ));

  const first = axisCenter(ordered[0]);
  const last = axisCenter(ordered[ordered.length - 1]);
  const step = (last - first) / (ordered.length - 1);
  const plan: ArrangePlan = {};

  ordered.slice(1, -1).forEach((target, index) => {
    const desired = first + step * (index + 1);
    const delta = desired - axisCenter(target);
    if (Math.abs(delta) <= POSITION_EPSILON) return;
    const patch: ArrangePatch = axis === 'horizontal' ? { x: target.transform.x + delta } : { y: target.transform.y + delta };
    if (Number.isFinite(patch.x ?? patch.y)) plan[target.id] = patch;
  });

  return plan;
};

/**
 * Turn every target ±90° about the collective selection centre, as one rigid
 * body: each target keeps its place in the arrangement because they all share
 * the same pivot.
 */
export const planRotate = (targets: ArrangeTarget[], direction: RotateDirection): ArrangePlan => {
  if (targets.length === 0) return {};
  const pivot = boundsCenter(unionBounds(targets.map((target) => target.bounds)));
  const degrees = direction === 'cw' ? 90 : -90;
  const plan: ArrangePlan = {};

  targets.forEach(({ id, transform }) => {
    const rotated = rotateAboutWorldPivot({ transform, pivot, rotation: transform.rotation + degrees });
    if (!Number.isFinite(rotated.x) || !Number.isFinite(rotated.y)) return;
    plan[id] = { x: rotated.x, y: rotated.y, rotation: rotated.rotation };
  });

  return plan;
};

/**
 * Mirror every target about the collective selection centre's axis, keeping the
 * box the user sees exactly where it is.
 */
export const planFlip = (targets: ArrangeTarget[], axis: FlipAxis): ArrangePlan => {
  if (targets.length === 0) return {};
  const center = boundsCenter(unionBounds(targets.map((target) => target.bounds)));
  const plan: ArrangePlan = {};

  targets.forEach(({ id, transform }) => {
    // `mirrorTransform` negates the axis component, the two scale signs it owns
    // and the rotation — i.e. it mirrors about the world origin line. Shifting
    // the result by twice the flip axis moves that mirror onto the selection
    // centre without touching the sign law.
    const mirrored = mirrorTransform(transform, axis === 'horizontal' ? 'y' : 'x');
    const x = mirrored.x + (axis === 'horizontal' ? 2 * center.x : 0);
    const y = mirrored.y + (axis === 'vertical' ? 2 * center.y : 0);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    plan[id] = {
      x,
      y,
      rotation: mirrored.rotation,
      scaleX: mirrored.scaleX,
      scaleY: mirrored.scaleY,
    };
  });

  return plan;
};
