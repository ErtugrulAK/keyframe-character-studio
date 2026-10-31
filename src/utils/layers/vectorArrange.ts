import type { CharacterPart, Transform } from '../../types/animator';
import type { PartWorldBounds } from '../geometry/bounds';
import { getLayerWorldBounds } from './layerGrouping';
import { unionWorldBounds, worldBoundsCenter } from '../geometry/layoutGeometry';
import { mirrorTransform } from '../animation/mirror';
import { relationshipAncestorIds } from './partBinding';
import { rotateAboutWorldPivot } from '../geometry/rotationGesture';

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
 * chain). The ancestor relationship is read from `utils/layers/partBinding`, which is
 * the one place `parentId`/`booleanGroupId` precedence is defined, so this file
 * cannot drift from the evaluator's own walk.
 *
 * ── The four documented policies ────────────────────────────────────────────
 * ALIGN — the reference box is the COLLECTIVE selection bounds (the union of
 *   every target's world box). The editor has no reference-object ("key
 *   object") authority, so inventing one here would be a second selection rule;
 *   the collective box is what the selection frame already draws. Edges align
 *   one axis (`left`/`right` move X, `top`/`bottom` move Y), the centre edges
 *   align one axis onto the collective centre (`horizontal-centers` moves X,
 *   `vertical-centers` moves Y), and `center` aligns BOTH axes — every target's
 *   centre lands on the collective centre in one step. Only the aligned axes are
 *   written, so the other axis cannot drift, and a target that is already on the
 *   line is left completely alone (no zero-delta write, so no keyframe is
 *   created for a property that did not move).
 *
 * DISTRIBUTE — needs at least three measurable targets, and the authority ships
 *   TWO policies, each its own command:
 *     · `planDistribute` — by box CENTRE (round five, unchanged). Targets ordered
 *       by centre along the axis, ties broken by layer id; the two extremes keep
 *       their positions and every interior centre takes an even step
 *       `first + (last - first) * i / (n - 1)`. Defined for overlapping layers.
 *     · `planDistributeByGap` — by EDGE GAP (this round, the equal-spacing
 *       command). Targets ordered by leading edge, ties broken by layer id; the
 *       two extremes keep their outer edges and the interior boxes slide so the
 *       gap between consecutive boxes is equal. This is the AE "distribute
 *       spacing" behaviour and it is the right one for objects of DIFFERENT
 *       widths or heights, which centre spacing spaces unevenly.
 *   The two are separate on purpose: neither can be expressed as the other
 *   without changing a shipped command's result, and each is documented here as
 *   the policy of its own command.
 *
 * ROTATE — ±90°, pivoting on the COLLECTIVE selection centre (a single target
 *   pivots on its own visual centre, of which the collective box is the same
 *   point). One pivot for the whole selection turns it as one rigid body, and
 *   every target's new place comes from `rotateAboutWorldPivot`, evaluated
 *   against the transform captured before the command, so the pivot cannot
 *   drift. (The canvas rotation handle instead turns one layer about its own
 *   origin, as a keyframed rotation does.)
 *
 * FLIP — about the COLLECTIVE selection centre, and world placement is
 *   preserved: a single target flips in place around its own visual centre, and
 *   a multi-selection mirrors as one picture (this is precisely the box the user
 *   sees). The sign law is `utils/animation/mirror`'s (`scaleX`/`scaleY` and `rotation`
 *   negate), applied about the origin line and then translated onto the flip
 *   axis, so the flip is the exact mirror of a rotated, non-uniformly scaled
 *   layer rather than an approximation.
 */

export type AlignEdge = 'left' | 'right' | 'top' | 'bottom' | 'horizontal-centers' | 'vertical-centers' | 'center';
export type DistributeAxis = 'horizontal' | 'vertical';
export type RotateDirection = 'ccw' | 'cw';
export type FlipAxis = 'horizontal' | 'vertical';

/** The world-space patch a command writes, in the editor's own transform fields. */
export type ArrangePatch = Partial<Pick<Transform, 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY'>>;

/** The world-space patches of one command, keyed by layer id, in write order. */
export type ArrangePlan = Record<string, ArrangePatch>;

interface ArrangeTarget {
  id: string;
  /** The layer's evaluated world transform, captured before any write. */
  transform: Transform;
  /** The layer's world bounds, group-aware. */
  bounds: PartWorldBounds;
}

/** Sub-pixel deltas are not a move: they must not create a keyframe. */
const POSITION_EPSILON = 1e-6;

/**
 * The layers an arrange command acts on: the canonical selection, minus every
 * layer an also-selected ancestor already carries.
 */
const resolveArrangeTargets = (parts: CharacterPart[], ids: string[]): string[] => {
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
  const reference = unionWorldBounds(targets.map((target) => target.bounds));
  const referenceCenter = worldBoundsCenter(reference);
  const plan: ArrangePlan = {};

  targets.forEach(({ id, transform, bounds }) => {
    const center = worldBoundsCenter(bounds);
    let deltaX = 0;
    let deltaY = 0;
    if (edge === 'left') deltaX = reference.minX - bounds.minX;
    else if (edge === 'right') deltaX = reference.maxX - bounds.maxX;
    else if (edge === 'top') deltaY = reference.minY - bounds.minY;
    else if (edge === 'bottom') deltaY = reference.maxY - bounds.maxY;
    else if (edge === 'center') {
      deltaX = referenceCenter.x - center.x;
      deltaY = referenceCenter.y - center.y;
    }
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
    ? worldBoundsCenter(target.bounds).x
    : worldBoundsCenter(target.bounds).y;

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
 * Even out the spacing of three or more targets' EDGE GAPS along one axis: the
 * gap between consecutive boxes (edge to edge) is made equal, so objects of
 * different widths read as evenly spaced — the look AE calls "distribute
 * spacing". The extreme boxes hold the span (their outer edges never move) and
 * the interior boxes slide until every gap matches. Returns `null` when the
 * selection cannot be distributed.
 *
 * This is the SECOND, additive distribute policy of the authority. Round five's
 * `planDistribute` distributes by CENTRE and is left exactly as it shipped (its
 * command and its documentation are unchanged); this one distributes by GAP and
 * backs the new equal-spacing commands. They are deliberately separate: centre
 * spacing is right for equal-size objects and gap spacing is right for objects
 * of different widths, and neither can be expressed as the other without
 * changing an already-shipped command's result.
 *
 * A negative gap is meaningful and allowed (the boxes overlap); the arithmetic
 * is the same, and the extremes still hold the span.
 */
export const planDistributeByGap = (targets: ArrangeTarget[], axis: DistributeAxis): ArrangePlan | null => {
  if (targets.length < 3) return null;
  // Three call sites for the same box edge, so it is a named local.
  const leading = (target: ArrangeTarget) => axis === 'horizontal' ? target.bounds.minX : target.bounds.minY;
  const size = (target: ArrangeTarget) => axis === 'horizontal'
    ? target.bounds.maxX - target.bounds.minX
    : target.bounds.maxY - target.bounds.minY;

  // Deterministic order: by leading edge along the axis, ties broken by layer id.
  const ordered = [...targets].sort((a, b) => (
    leading(a) - leading(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  ));

  const start = leading(ordered[0]);
  const last = ordered[ordered.length - 1];
  const end = axis === 'horizontal' ? last.bounds.maxX : last.bounds.maxY;
  const gap = (end - start - targets.reduce((sum, target) => sum + size(target), 0)) / (ordered.length - 1);

  const plan: ArrangePlan = {};
  let cursor = start;
  ordered.forEach((target, index) => {
    if (index > 0) {
      // The exterior targets (first and last) stay exactly where they are: their
      // outer edges ARE the span. Only the interior boxes take the even step.
      const delta = cursor - leading(target);
      if (index < ordered.length - 1 && Math.abs(delta) > POSITION_EPSILON) {
        const patch: ArrangePatch = axis === 'horizontal' ? { x: target.transform.x + delta } : { y: target.transform.y + delta };
        if (Number.isFinite(patch.x ?? patch.y)) plan[target.id] = patch;
      }
    }
    cursor += size(target) + gap;
  });

  return plan;
};

/**
 * Move every target by the same world offset (the arrow-key nudge). The targets
 * carry the transforms captured when the nudge started, so a held key writes
 * start + total offset instead of adding to a value it might read stale.
 */
export const planTranslate = (targets: ArrangeTarget[], dx: number, dy: number): ArrangePlan => {
  const plan: ArrangePlan = {};
  targets.forEach(({ id, transform }) => {
    const patch: ArrangePatch = {};
    if (Math.abs(dx) > POSITION_EPSILON) patch.x = transform.x + dx;
    if (Math.abs(dy) > POSITION_EPSILON) patch.y = transform.y + dy;
    if (patch.x !== undefined || patch.y !== undefined) plan[id] = patch;
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
  const pivot = worldBoundsCenter(unionWorldBounds(targets.map((target) => target.bounds)));
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
  const center = worldBoundsCenter(unionWorldBounds(targets.map((target) => target.bounds)));
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
