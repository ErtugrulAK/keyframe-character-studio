import type { CharacterPart, Track } from '../types/animator';
import { evaluateTransform } from './evaluateTransform';
import {
  affineHasShear,
  affineOfTransform,
  affineToTransform,
  composeAffine,
  invertAffine,
  worldAffineOf,
  type WorldAffine,
} from './containerMath';
import { isLocalTransformAnimated, rebaseLayerOntoParent, type RebasedChild } from './layerGrouping';
import { relationshipAncestorIds, relationshipParentId } from './partBinding';

/**
 * The one plan for "this layer gets a different parent".
 *
 * A layer's `parentId` makes `evaluateTransform` compose the parent's world
 * transform onto the layer's own (local) one. Changing the parent therefore has
 * to rewrite the local base transform, or the layer jumps on screen. The plan
 * keeps the WORLD pose exactly: `newLocal = inverse(newParentWorld) ∘ world`,
 * written as TRS only when that map is a TRS (no shear) and verified by
 * re-composing it.
 *
 * When the layer's own transform, or a layer of the old or new parent
 * chain, is ANIMATED, a static rewrite cannot keep the pose at every frame; the
 * plan then re-bases the layer's animation into the new parent
 * (`rebaseLayerOntoParent`: key times and easings kept where exact, baked
 * otherwise, verified at every sequence) and reports what it adds
 * (`rebased`) so the caller can ask first. Cycles, self-parenting, Boolean
 * structures, bonds across the new chain, anchored layers (whose position is
 * owned by the anchor preset) and skew-needing poses are refused.
 *
 * Pure: no React, no state; the caller writes the result in one history step.
 */
type ReparentOutcome =
  | { ok: true; parts: CharacterPart[]; unchanged: boolean; tracks?: Track[]; rebased?: RebasedChild | null }
  | { ok: false; reason: string };

/** Whether the layer, or a layer of its old or new parent chain, animates its transform. */
const reparentInvolvesAnimation = (parts: CharacterPart[], tracks: Track[], childId: string, newParentId: string | null): boolean => {
  const trackOf = (id: string) => tracks.find((track) => track.partId === id);
  const chain = [childId, ...relationshipAncestorIds(parts, childId), ...(newParentId ? [newParentId, ...relationshipAncestorIds(parts, newParentId)] : [])];
  return chain.some((id) => isLocalTransformAnimated(trackOf(id)));
};

const nameOf = (part: CharacterPart | undefined, fallback: string): string => `“${part?.name || fallback}”`;

/** Every layer whose relationship chain passes through `partId` (children, grandchildren …). */
export const relationshipDescendantIds = (parts: CharacterPart[], partId: string): string[] => (
  parts
    .filter((part) => part.id !== partId && relationshipAncestorIds(parts, part.id).includes(partId))
    .map((part) => part.id)
);

/** Why `childId` cannot get `newParentId` (null = no parent) as its parent, or null. */
export const reparentBlockReason = (
  parts: CharacterPart[],
  // Kept for callers: the structural rules no longer depend on animation (C4).
  _tracks: Track[],
  childId: string,
  newParentId: string | null,
): string | null => {
  const partById = new Map(parts.map((part) => [part.id, part]));
  const child = partById.get(childId);
  if (!child) return 'The layer no longer exists.';
  const parent = newParentId ? partById.get(newParentId) : undefined;
  if (newParentId && !parent) return 'The new parent layer no longer exists.';
  if (newParentId === childId) return 'A layer cannot be its own parent.';
  if (child.booleanGroupId) return `${nameOf(child, childId)} is a Boolean operand; it belongs to its Boolean group.`;
  if (parent?.booleanOperandIds?.length) return `${nameOf(parent, newParentId!)} is a Boolean group; it only contains its operands.`;
  if (parent?.booleanGroupId) return `${nameOf(parent, newParentId!)} is a Boolean operand and cannot be a parent.`;
  if (newParentId && relationshipAncestorIds(parts, newParentId).includes(childId)) {
    return `${nameOf(parent, newParentId)} is inside ${nameOf(child, childId)}; that parent would create a loop.`;
  }
  if (child.anchor && child.anchor !== 'none') {
    return `${nameOf(child, childId)} is placed by an anchor preset; set Anchor to None before changing its parent.`;
  }

  // Animation is no longer a refusal: `planReparent` re-bases it.
  const newChain = newParentId ? [newParentId, ...relationshipAncestorIds(parts, newParentId)] : [];

  // A bond across an ancestor/descendant pair would move the bonded layer twice.
  const moving = [childId, ...relationshipDescendantIds(parts, childId)];
  const bonded = moving.find((id) => (partById.get(id)?.boundPartIds ?? []).some((partner) => newChain.includes(partner)));
  if (bonded) {
    return `${nameOf(partById.get(bonded), bonded)} is bonded to a layer in the new parent chain; unbind them first.`;
  }
  return null;
};

/** Collapsed map test, local so the reason can name it. */
const isInvertible = (affine: WorldAffine): boolean => invertAffine(affine) !== null;

/**
 * Plans the parent change. `scope`/`frame` only choose where the (static) world
 * pose is read; every refused case above is exactly the one where that choice
 * would matter.
 */
export const planReparent = (
  parts: CharacterPart[],
  tracks: Track[],
  childId: string,
  newParentId: string | null,
  scope: string,
  frame: number,
): ReparentOutcome => {
  const child = parts.find((part) => part.id === childId);
  if (child && (relationshipParentId(child) ?? null) === newParentId) return { ok: true, parts, unchanged: true };
  const reason = reparentBlockReason(parts, tracks, childId, newParentId);
  if (reason || !child) return { ok: false, reason: reason ?? 'The layer no longer exists.' };
  if (newParentId) {
    const parentBase = worldAffineOf(evaluateTransform(parts, tracks, scope, newParentId, frame));
    if (!isInvertible(parentBase)) return { ok: false, reason: 'The new parent is scaled to zero, so a child position inside it cannot be computed.' };
  }
  if (reparentInvolvesAnimation(parts, tracks, childId, newParentId)) {
    const rebase = rebaseLayerOntoParent(parts, tracks, childId, newParentId);
    if (!rebase.ok) return rebase;
    return { ok: true, parts: rebase.parts, tracks: rebase.tracks, rebased: rebase.rebased, unchanged: false };
  }

  const world = worldAffineOf(evaluateTransform(parts, tracks, scope, childId, frame));
  let localAffine = world;
  let parentAffine: WorldAffine | null = null;
  if (newParentId) {
    parentAffine = worldAffineOf(evaluateTransform(parts, tracks, scope, newParentId, frame));
    const inverse = invertAffine(parentAffine);
    if (!inverse || !isInvertible(parentAffine)) {
      return { ok: false, reason: 'The new parent is scaled to zero, so a child position inside it cannot be computed.' };
    }
    localAffine = composeAffine(inverse, world);
  }
  if (affineHasShear(localAffine, 1e-6)) {
    return { ok: false, reason: 'The new parent combines rotation with non-uniform scale; the layer’s pose inside it would need a skew, which layers cannot store.' };
  }
  const trs = affineToTransform(localAffine);
  const nextBase = { ...child.baseTransform, ...trs };
  // Re-compose and compare: the written TRS must reproduce the world pose.
  const recomposed = parentAffine ? composeAffine(parentAffine, affineOfTransform(nextBase)) : affineOfTransform(nextBase);
  const tolerance = 1e-6 * Math.max(1, ...(['a', 'b', 'c', 'd', 'e', 'f'] as const).map((key) => Math.abs(world[key])));
  if ((['a', 'b', 'c', 'd', 'e', 'f'] as const).some((key) => Math.abs(recomposed[key] - world[key]) > tolerance)) {
    return { ok: false, reason: 'The layer’s current pose cannot be represented inside the new parent.' };
  }

  const nextParts = parts.map((part) => {
    if (part.id !== childId) return part;
    const next: CharacterPart = { ...part, baseTransform: nextBase };
    if (newParentId) next.parentId = newParentId;
    else delete next.parentId;
    return next;
  });
  return { ok: true, parts: nextParts, unchanged: false };
};

export type LayerDropPosition = 'before' | 'after' | 'nest';

/**
 * Array order is the layer order (index 0 is the front-most layer, `zIndex`
 * descends with it) — the contract `reorderParts` writes. Moves `id` to just
 * before/after `targetId`, re-derives `zIndex`, and orders the tracks like the
 * parts, exactly as `reorderParts` does.
 */
export const moveLayerInOrder = (
  parts: CharacterPart[],
  tracks: Track[],
  id: string,
  targetId: string,
  position: 'before' | 'after',
): { parts: CharacterPart[]; tracks: Track[] } => {
  const moving = parts.find((part) => part.id === id);
  if (!moving || id === targetId || !parts.some((part) => part.id === targetId)) return { parts, tracks };
  const without = parts.filter((part) => part.id !== id);
  const targetIndex = without.findIndex((part) => part.id === targetId);
  without.splice(position === 'before' ? targetIndex : targetIndex + 1, 0, moving);
  const total = without.length;
  const reindexed = without.map((part, index) => (part.zIndex === total - index ? part : { ...part, zIndex: total - index }));
  const sortedTracks = reindexed
    .map((part) => tracks.find((track) => track.partId === part.id))
    .filter((track): track is Track => Boolean(track));
  tracks.forEach((track) => { if (!sortedTracks.includes(track)) sortedTracks.push(track); });
  return { parts: reindexed, tracks: sortedTracks };
};

type LayerDropOutcome =
  | { ok: true; parts: CharacterPart[]; tracks: Track[]; parentChanged: boolean; unchanged: boolean; rebased?: RebasedChild | null }
  | { ok: false; reason: string };

/**
 * One drop in the layer tree. `nest` makes the target the parent (order kept);
 * `before`/`after` places the layer beside the target AND makes it the target's
 * sibling (same parent), so the row lands where the indicator showed it.
 */
export const planLayerDrop = (
  parts: CharacterPart[],
  tracks: Track[],
  id: string,
  targetId: string,
  position: LayerDropPosition,
  scope: string,
  frame: number,
): LayerDropOutcome => {
  if (id === targetId) return { ok: false, reason: 'A layer cannot be dropped onto itself.' };
  const target = parts.find((part) => part.id === targetId);
  if (!target) return { ok: false, reason: 'The target layer no longer exists.' };
  const nextParentId = position === 'nest' ? targetId : (relationshipParentId(target) ?? null);
  const reparent = planReparent(parts, tracks, id, nextParentId, scope, frame);
  if (!reparent.ok) return reparent;
  const reparentTracks = reparent.tracks ?? tracks;
  if (position === 'nest') {
    return { ok: true, parts: reparent.parts, tracks: reparentTracks, parentChanged: !reparent.unchanged, unchanged: reparent.unchanged, rebased: reparent.rebased ?? null };
  }
  const moved = moveLayerInOrder(reparent.parts, reparentTracks, id, targetId, position);
  const orderUnchanged = moved.parts.every((part, index) => part.id === parts[index]?.id);
  return {
    ok: true,
    parts: moved.parts,
    tracks: moved.tracks,
    parentChanged: !reparent.unchanged,
    unchanged: reparent.unchanged && orderUnchanged,
    rebased: reparent.rebased ?? null,
  };
};
