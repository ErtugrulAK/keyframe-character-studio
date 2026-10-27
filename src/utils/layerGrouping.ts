import type {
  CharacterPart,
  EasingType,
  Keyframe,
  PropertyKeyframe,
  Track,
  TrackChannel,
  Transform,
} from '../types/animator';
import { getPartLocalBounds, getPartWorldBounds, type PartLocalBounds, type PartWorldBounds } from './bounds';
import { PART_ANCHOR_OFFSETS, TOOLBAR_COLORS } from './constants';
import {
  affineToTransform,
  applyAffine,
  composeAffine,
  composeWorldTransform,
  invertAffine,
  worldAffineOf,
  worldToContainerLocal,
  type WorldAffine,
} from './containerMath';
import { applyEasing, deriveAutoBezierControlPoints, interpolateChannel, lerp, makeEmptyChannels } from './defaults';
import { evaluateTransform } from './evaluateTransform';
import { generateId } from './idGenerator';
import { isRelationshipChainRelated, relationshipAncestorIds, relationshipParentId } from './partBinding';

/**
 * Layer groups — an authoring surface over the parent-child transform KCS
 * already evaluates.
 *
 * A group is a real container layer (`CharacterPart.isGroup`) whose children
 * point at it through the existing `parentId` relationship. Evaluation is
 * therefore unchanged: `utils/evaluateTransform` composes the container's
 * translation, rotation and scale into every child, and the Inspector already
 * converts world edits back into container-local space. Group move, scale and
 * rotation are just edits to the container, and children keep their relative
 * poses because grouping re-expresses each child in the container's space.
 *
 * The container is a freeform layer with no geometry, so it draws nothing and
 * the document renders exactly as it did before grouping. Nothing here changes
 * evaluation, save/load or OGraf export: children are exported from their
 * evaluated world transforms, which grouping preserves.
 *
 * Exactness. Folding is the one non-obvious part. A child's new local pose is
 * always `worldToContainerLocal(world, newParentWorld)`, the same conversion the
 * Inspector uses. It is applied two ways:
 *   - A child whose local pose is a constant takes the converted value straight
 *     into its base transform, which is exact at every frame for ANY container
 *     transform.
 *   - An animated child keeps its keyframes and gets an affine map per channel,
 *     which preserves every keyframe time and easing exactly. That map only
 *     exists while the composed container rotation is 0 (a rotation would mix a
 *     child's x and y across channels, which independent channels cannot carry).
 * Directories, scales and mirrors are all affine, so grouping refuses only the
 * rotation case, and only for an animated child. Ungrouping never refuses it: an
 * animated container is baked into its children instead (see the ungroup section
 * below).
 */

/** The container layer type: a freeform with no path or points draws nothing. */
export const GROUP_CONTAINER_TYPE: CharacterPart['type'] = 'custom_freeform';

/** The local transform channels a fold rewrites (opacity is never inherited). */
const LOCAL_CHANNELS = ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const;
type LocalChannel = (typeof LOCAL_CHANNELS)[number];

const IDENTITY: Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

const IDENTITY_AFFINE: WorldAffine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/**
 * A world-pose reader: the authored TRS reading plus the derived affine the
 * evaluator attaches when a TRS cannot re-create the nested map. Consumers read
 * the world MAP through `worldAffineOf`, never by hand-rolling R·S again.
 */
type WorldOf = (partId: string) => Transform & { affine?: WorldAffine };

/** How deep nested groups are walked before falling back to the container box. */
const MAX_GROUP_DEPTH = 4;

const normalizeDegrees = (degrees: number): number => ((degrees % 360) + 360) % 360;

/** Every direct child of a group, in document order. */
export const getGroupChildren = (parts: CharacterPart[], groupId: string): CharacterPart[] => (
  parts.filter((part) => part.parentId === groupId)
);

/** Every layer inside a group, nested groups included, in document order. */
export const getGroupDescendants = (parts: CharacterPart[], groupId: string): CharacterPart[] => {
  const collected = new Set<string>();
  const pending = [groupId];
  while (pending.length > 0) {
    const current = pending.shift()!;
    parts.forEach((candidate) => {
      if (candidate.parentId !== current || collected.has(candidate.id)) return;
      collected.add(candidate.id);
      pending.push(candidate.id);
    });
  }
  return parts.filter((part) => collected.has(part.id));
};

/**
 * The relationship chain above `partId`, nearest ancestor first, cycle-safe.
 * This is the chain the evaluator and every grouping operation walk.
 */
const ancestorChain = (parts: CharacterPart[], partId: string): CharacterPart[] => {
  const byId = new Map(parts.map((part) => [part.id, part]));
  const chain: CharacterPart[] = [];
  const seen = new Set<string>();
  let current = byId.get(partId)?.parentId ?? null;
  while (current && !seen.has(current)) {
    seen.add(current);
    const parent = byId.get(current);
    if (!parent) break;
    chain.push(parent);
    current = parent.parentId ?? null;
  }
  return chain;
};

/**
 * The OUTERMOST group a layer belongs to, or `null` when it is not grouped.
 *
 * Walking the chain to the top rather than stopping at the first group is what
 * makes nested groups predictable: a layer inside an inner group inside an outer
 * group belongs to the outer group.
 */
export const resolveOutermostGroupAncestor = (
  parts: CharacterPart[],
  partId: string,
): string | null => {
  const outerMostFirst = ancestorChain(parts, partId).reverse();
  return outerMostFirst.find((ancestor) => ancestor.isGroup)?.id ?? null;
};

/** True when `partId` sits inside `groupId`. A layer is never inside itself. */
const liesInsideGroup = (parts: CharacterPart[], partId: string, groupId: string): boolean => (
  ancestorChain(parts, partId).some((ancestor) => ancestor.id === groupId)
);

/**
 * R4-09 — the layer a CANVAS click targets (vector-editor model).
 *
 * A plain click on any child geometry selects the GROUP the child belongs to
 * (the outermost group ancestor), never the child itself: grouping would be
 * meaningless if the first click on a child stole the selection back from the
 * container. An empty gap between children never reaches this resolver at all —
 * the renderer hit-tests real child geometry — so the aggregate box can never be
 * selected by clicking through a hole.
 *
 * Child editing stays available through the two EXPLICIT direct-selection paths,
 * which both leave the same trace: the layer itself becomes part of the
 * selection.
 *   - Double-click a child on the canvas (`onDrillIn` in `PartRenderer`).
 *   - Click the child's row in the timeline Outliner.
 * Once the selection is a set of layers that live INSIDE one group, the user is
 * working inside that group: a click there targets the layer under the pointer
 * again (that is what lets a Shift-selected pair of children be dragged as a
 * set, and what keeps an Outliner-selected child draggable on the canvas).
 * Clicking another group, or an ungrouped layer, targets that thing's own group,
 * so the container can never be lost by accident.
 */
export const resolveStageSelectionTarget = (
  parts: CharacterPart[],
  partId: string,
  selectionIds: string[],
): string => {
  const outermost = resolveOutermostGroupAncestor(parts, partId);
  if (outermost === null) return partId;
  const insideGroup = selectionIds.some((id) => id !== outermost && liesInsideGroup(parts, id, outermost));
  return insideGroup ? partId : outermost;
};

/**
 * R5-08 — the canvas marquee's hit list folded into the canonical selection.
 *
 * The box hit-tests real layer geometry, so a hit is a LAYER, and a marquee that
 * encloses grouped children must land on the same thing a click on those
 * children lands on — the group container. It therefore resolves every hit
 * through `resolveStageSelectionTarget`, with the selection that was live when
 * the box began standing in for "what am I working inside": the two gesture
 * kinds can never disagree about container versus child, and nothing here is a
 * second rule.
 *
 * A geometryless container (`isGroup`) is dropped from the hits entirely. It
 * owns no geometry, so its only candidate box would be `getPartLocalBounds`'s
 * placeholder square around its own origin — and an empty gap BETWEEN its
 * children would then select the container out of thin air. A container enters
 * the selection the one legitimate way: by normalizing the child hit inside it.
 */
export const resolveMarqueeSelection = (
  parts: CharacterPart[],
  hitIds: string[],
  selectionIds: string[],
): string[] => {
  const byId = new Map(parts.map((part) => [part.id, part]));
  const targets: string[] = [];
  const seen = new Set<string>();
  for (const hitId of hitIds) {
    const hit = byId.get(hitId);
    if (!hit || hit.isGroup) continue;
    const target = resolveStageSelectionTarget(parts, hitId, selectionIds);
    if (seen.has(target)) continue;
    seen.add(target);
    targets.push(target);
  }
  return targets;
};


// ─── Fold math ────────────────────────────────────────────────────────────

/**
 * The sequence scope a keyframe belongs to. This is the evaluator's own rule
 * (`evaluateTransform` filters by `keyframe.templateId || 'Sequence'`), so every
 * decision below is taken with exactly the scope the evaluator will use.
 */
const keyframeScope = (keyframe: { templateId?: string }): string => keyframe.templateId || 'Sequence';

interface ChannelAffine {
  a: number;
  b: number;
}

type LocalFold = Record<LocalChannel, ChannelAffine>;

/**
 * The per-channel affine map of composing `compose` onto a child's authored
 * locals, or `null` when `compose` rotates and x/y would mix across channels.
 */
const foldAffine = (compose: Transform): LocalFold | null => {
  if (normalizeDegrees(compose.rotation) !== 0) return null;
  const scaleX = compose.scaleX || 1;
  const scaleY = compose.scaleY || 1;
  return {
    x: { a: scaleX, b: compose.x },
    y: { a: scaleY, b: compose.y },
    rotation: { a: 1, b: compose.rotation },
    scaleX: { a: scaleX, b: 0 },
    scaleY: { a: scaleY, b: 0 },
  };
};

const foldTransform = (transform: Transform, fold: LocalFold): Transform => {
  const next: Transform = { ...transform };
  LOCAL_CHANNELS.forEach((channel) => {
    next[channel] = fold[channel].a * transform[channel] + fold[channel].b;
  });
  return next;
};

const foldChannels = (
  channels: Record<TrackChannel, PropertyKeyframe[]>,
  fold: LocalFold,
  scope?: string,
): Record<TrackChannel, PropertyKeyframe[]> => {
  const next = { ...channels };
  LOCAL_CHANNELS.forEach((channel) => {
    next[channel] = (channels[channel] ?? []).map((keyframe) => (
      scope !== undefined && keyframeScope(keyframe) !== scope
        ? keyframe
        : { ...keyframe, value: fold[channel].a * keyframe.value + fold[channel].b }
    ));
  });
  return next;
};

const foldLegacyKeyframes = (
  keyframes: Keyframe[] | undefined,
  fold: LocalFold,
  scope?: string,
): Keyframe[] | undefined => (
  keyframes?.map((keyframe) => (
    scope !== undefined && keyframeScope(keyframe) !== scope
      ? keyframe
      : { ...keyframe, transform: foldTransform(keyframe.transform, fold) }
  ))
);

/** True when the layer's own transform is animated on any sequence. */
export const isLocalTransformAnimated = (track: Track | undefined): boolean => {
  if (!track) return false;
  if (LOCAL_CHANNELS.some((channel) => (track.channels?.[channel]?.length ?? 0) > 0)) return true;
  return (track.keyframes?.length ?? 0) > 0;
};

const animatedChildNames = (
  childIds: string[],
  tracksByPart: Map<string, Track>,
  parts: CharacterPart[],
): string[] => childIds
  .filter((id) => isLocalTransformAnimated(tracksByPart.get(id)))
  .map((id) => parts.find((part) => part.id === id)?.name ?? id);

/**
 * Re-express the given children in a new parent's space: the constant children
 * get their exact converted pose, the animated ones get the affine channel map.
 * Callers must have refused the combinations `fold` cannot carry.
 */
const foldChildrenInto = (options: {
  parts: CharacterPart[];
  tracks: Track[];
  childIds: string[];
  parentId: string | undefined;
  compose: Transform;
  newParentWorld: Transform;
  worldOf: WorldOf;
}): { parts: CharacterPart[]; tracks: Track[] } => {
  const { parts, tracks, childIds, parentId, compose, newParentWorld, worldOf } = options;
  const fold = foldAffine(compose);
  const nextParts = parts.map((part) => {
    if (!childIds.includes(part.id)) return part;
    return {
      ...part,
      parentId,
      baseTransform: fold
        ? foldTransform(part.baseTransform, fold)
        : worldToContainerLocal(worldOf(part.id), newParentWorld),
    };
  });
  if (!fold) return { parts: nextParts, tracks };
  const nextTracks = tracks.map((track) => (
    childIds.includes(track.partId)
      ? { ...track, channels: foldChannels(track.channels, fold), keyframes: foldLegacyKeyframes(track.keyframes, fold) }
      : track
  ));
  return { parts: nextParts, tracks: nextTracks };
};

// ─── Bounds ───────────────────────────────────────────────────────────────

const unionLocalBounds = (bounds: PartLocalBounds[]): PartLocalBounds | null => {
  if (bounds.length === 0) return null;
  const minX = Math.min(...bounds.map((item) => item.minX));
  const minY = Math.min(...bounds.map((item) => item.minY));
  const maxX = Math.max(...bounds.map((item) => item.maxX));
  const maxY = Math.max(...bounds.map((item) => item.maxY));
  return {
    minX,
    minY,
    maxX,
    maxY,
    halfW: Math.max(1, (maxX - minX) / 2),
    halfH: Math.max(1, (maxY - minY) / 2),
    offsetX: (minX + maxX) / 2,
    offsetY: (minY + maxY) / 2,
  };
};

const unionWorldBounds = (bounds: PartWorldBounds[]): PartWorldBounds => ({
  minX: Math.min(...bounds.map((item) => item.minX)),
  minY: Math.min(...bounds.map((item) => item.minY)),
  maxX: Math.max(...bounds.map((item) => item.maxX)),
  maxY: Math.max(...bounds.map((item) => item.maxY)),
});

/**
 * Bounds of one layer as it sits in the container's local space, using the same
 * rendered-geometry authority the single-layer selection frame uses (so image
 * layers describe their visible pixels and Boolean groups their live contours).
 *
 * `map` is the EXACT affine from the child's own local space into the group's
 * local space (computed by `aggregateLocalBounds`). For a direct child it is the
 * child's own local affine; a rotated child of an anisotropically scaled group
 * therefore keeps its true, possibly sheared parallelogram instead of being
 * re-scaled along its own rotated axes.
 */
const localBoundsInContainer = (
  parts: CharacterPart[],
  part: CharacterPart,
  map: WorldAffine,
  worldOf: WorldOf,
  depth: number,
): PartLocalBounds | null => {
  // A group has no geometry of its own: its own children define its box, which
  // is what makes a nested group measure as the art inside it. A container with
  // nothing measurable inside contributes NOTHING — falling back to its own
  // bounds would put `getPartLocalBounds`'s placeholder square inside the parent
  // group's aggregate envelope.
  const bounds = part.isGroup
    ? aggregateLocalBounds(parts, part.id, worldOf, depth + 1)
    : getPartLocalBounds(part, affineToTransform(map));
  if (!bounds) return null;
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ].map((corner) => applyAffine(map, corner));
  return unionLocalBounds(corners.map((point) => ({
    minX: point.x,
    minY: point.y,
    maxX: point.x,
    maxY: point.y,
    halfW: 1,
    halfH: 1,
    offsetX: point.x,
    offsetY: point.y,
  })));
};

const aggregateLocalBounds = (
  parts: CharacterPart[],
  groupId: string,
  worldOf: WorldOf,
  depth: number,
): PartLocalBounds | null => {
  if (depth > MAX_GROUP_DEPTH) return null;
  const groupWorld = worldOf(groupId);
  // Undo the group's world map, then apply the child's own: the exact affine
  // from the child's local space into the group's. When the group's map is
  // collapsed (no inverse) we use the identity rather than fabricating a TRS
  // from a degenerate one, so the child's exact map survives and the bounds
  // stay its real, unsheared shape.
  const groupInverse = invertAffine(worldAffineOf(groupWorld)) ?? IDENTITY_AFFINE;
  const bounds = getGroupChildren(parts, groupId)
    .map((child) => localBoundsInContainer(
      parts,
      child,
      composeAffine(groupInverse, worldAffineOf(worldOf(child.id))),
      worldOf,
      depth,
    ))
    .filter((item): item is PartLocalBounds => item !== null);
  return unionLocalBounds(bounds);
};

/**
 * One bounding box for the whole group, in the group's own local space. This is
 * the box the group selection frame draws: the container has no geometry, so
 * the children define it, live, from the evaluated transforms of this frame.
 */
export const getGroupAggregateBounds = (
  parts: CharacterPart[],
  groupId: string,
  worldOf: WorldOf,
): PartLocalBounds | null => aggregateLocalBounds(parts, groupId, worldOf, 0);

/** World bounds of a layer, walking a nested group's children when it is a container. */
const layerWorldBounds = (
  parts: CharacterPart[],
  part: CharacterPart,
  worldOf: WorldOf,
  depth: number,
): PartWorldBounds | null => {
  if (part.isGroup) {
    if (depth > MAX_GROUP_DEPTH) return null;
    // A container measures as the art inside it, never as a placeholder box of
    // its own: an empty group has no world bounds to contribute.
    const childBounds = getGroupChildren(parts, part.id)
      .map((child) => layerWorldBounds(parts, child, worldOf, depth + 1))
      .filter((item): item is PartWorldBounds => item !== null);
    return childBounds.length > 0 ? unionWorldBounds(childBounds) : null;
  }
  return getPartWorldBounds(part, worldOf(part.id), 0, 0);
};

/**
 * World bounds of ONE layer, walked exactly as the group machinery walks it: a
 * container measures as the art inside it (nested groups included) and a
 * container with nothing measurable inside has NO bounds at all.
 *
 * This is the measurement the alignment commands arrange with — the same box
 * `createLayerGroup` centres a new container on — so an arrange command and a
 * group operation can never disagree about where a layer is.
 */
export const getLayerWorldBounds = (
  parts: CharacterPart[],
  partId: string,
  worldOf: WorldOf,
): PartWorldBounds | null => {
  const part = parts.find((candidate) => candidate.id === partId);
  return part ? layerWorldBounds(parts, part, worldOf, 0) : null;
};

// ─── Selection rules ──────────────────────────────────────────────────────

const resolveSelection = (parts: CharacterPart[], ids: string[]): CharacterPart[] => {
  const seen = new Set<string>();
  const selected: CharacterPart[] = [];
  ids.forEach((id) => {
    if (seen.has(id)) return;
    const part = parts.find((candidate) => candidate.id === id);
    if (!part) return;
    seen.add(id);
    selected.push(part);
  });
  return selected;
};

/**
 * Why the current selection cannot become a group, or `null` when it can.
 *
 * The selected layers must share one relationship parent (or all be top-level):
 * the new container is placed in that parent's space, so no child ever changes
 * which ancestor chain carries its animation.
 */
export const groupSelectionBlockReason = (parts: CharacterPart[], ids: string[]): string | null => {
  const selected = resolveSelection(parts, ids);
  if (selected.length < 2) return 'Select at least two layers to group.';
  if (selected.some((part) => part.booleanGroupId)) {
    return 'A Boolean operand moves with its Boolean group. Group the Boolean group instead.';
  }
  if (selected.some((part) => part.anchor && part.anchor !== 'none')) {
    return 'A layer that uses a stage anchor cannot be grouped yet.';
  }
  const related = selected.some((part, index) => selected
    .slice(index + 1)
    .some((other) => isRelationshipChainRelated(parts, part.id, other.id)));
  if (related) return 'A layer cannot be grouped with its own child.';
  const parents = new Set(selected.map((part) => relationshipParentId(part)));
  if (parents.size > 1) return 'Group layers that share one parent, or only top-level layers.';
  return null;
};

/**
 * Why the selected group cannot be ungrouped, or `null` when it can.
 *
 * An animated container ungroups: its motion is baked into every child (see
 * `dissolveLayerGroup`). The one combination the bake cannot carry is a child
 * whose position is pinned by a stage anchor: `evaluateTransform` replaces such
 * a child's x/y with the anchor offsets AFTER keyframe resolution, so a baked
 * position would be discarded and the layer would jump to its pin the moment the
 * container's motion stopped holding it. The refusal names the layer, so it is
 * actionable, and it only fires for a container that actually animates.
 */
export const ungroupBlockReason = (parts: CharacterPart[], tracks: Track[], groupId: string): string | null => {
  const group = parts.find((part) => part.id === groupId);
  if (!group || !group.isGroup) return 'Select a layer group to ungroup.';
  const children = getGroupChildren(parts, groupId);
  if (children.length === 0) return 'This group has no layers.';
  if (isLocalTransformAnimated(tracks.find((track) => track.partId === groupId))) {
    const anchored = children.find((child) => child.anchor && child.anchor !== 'none');
    if (anchored) {
      return `An animated group cannot be ungrouped onto "${anchored.name}": a stage anchor pins that layer's position. Clear the anchor first.`;
    }
  }
  return null;
};

// ─── Group creation ───────────────────────────────────────────────────────

export interface GroupCreationContext {
  groupId: string;
  trackId: string;
  name: string;
  worldOf: WorldOf;
}

export type GroupCreationOutcome =
  | { ok: true; parts: CharacterPart[]; tracks: Track[]; groupId: string; parentId?: string; childIds: string[] }
  | { ok: false; reason: string };

export const createLayerGroup = (
  parts: CharacterPart[],
  tracks: Track[],
  ids: string[],
  context: GroupCreationContext,
): GroupCreationOutcome => {
  const blocked = groupSelectionBlockReason(parts, ids);
  if (blocked) return { ok: false, reason: blocked };
  const selected = resolveSelection(parts, ids);
  const parentId = relationshipParentId(selected[0]);
  const parentWorld = parentId ? context.worldOf(parentId) : IDENTITY;

  // A selected container contributes the bounds of the art inside it; one with
  // nothing measurable inside contributes nothing, so the new container is
  // centred on real geometry only.
  const worldBounds = selected
    .map((part) => layerWorldBounds(parts, part, context.worldOf, 0))
    .filter((item): item is PartWorldBounds => item !== null);
  if (worldBounds.length === 0) {
    return { ok: false, reason: 'Nothing measurable is selected, so there is nothing to group yet.' };
  }
  const groupWorld: Transform = {
    x: (Math.min(...worldBounds.map((item) => item.minX)) + Math.max(...worldBounds.map((item) => item.maxX))) / 2,
    y: (Math.min(...worldBounds.map((item) => item.minY)) + Math.max(...worldBounds.map((item) => item.maxY))) / 2,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  };
  const containerLocal = worldToContainerLocal(groupWorld, parentWorld);
  const childIds = selected.map((part) => part.id);
  const tracksByPart = new Map(tracks.map((track) => [track.partId, track]));

  // A brand-new container is a pure translation of the parent's space, so the
  // fold only loses exactness when the parent itself is rotated.
  const compose = worldToContainerLocal(IDENTITY, containerLocal);
  if (!foldAffine(compose) && animatedChildNames(childIds, tracksByPart, parts).length > 0) {
    return {
      ok: false,
      reason: 'Grouping animated layers inside a rotated parent is not exact yet. Reset the parent rotation first.',
    };
  }

  const folded = foldChildrenInto({
    parts,
    tracks,
    childIds,
    parentId: context.groupId,
    compose,
    newParentWorld: groupWorld,
    worldOf: context.worldOf,
  });

  // A container owns no paint, so it is authored fully transparent as well as
  // geometry-less: the editor renderer draws nothing for it, and every OGraf
  // render path skips a zero-opacity layer instead of asking it for geometry.
  // Opacity is never inherited, so the children keep their own.
  const groupPart: CharacterPart = {
    id: context.groupId,
    name: context.name,
    type: GROUP_CONTAINER_TYPE,
    isGroup: true,
    zIndex: Math.max(...selected.map((part) => part.zIndex)) + 1,
    pivot: { x: 0, y: 0 },
    anchor: 'none',
    fillColor: 'none',
    strokeColor: 'none',
    baseTransform: { ...containerLocal, opacity: 0 },
    ...(parentId ? { parentId } : {}),
  };

  const groupTrack: Track = {
    id: context.trackId,
    partId: context.groupId,
    name: context.name,
    color: '#a78bfa',
    visible: true,
    locked: false,
    expanded: true,
    keyframes: [],
    channels: makeEmptyChannels(),
  };

  return {
    ok: true,
    parts: [...folded.parts, groupPart],
    tracks: [...folded.tracks, groupTrack],
    groupId: context.groupId,
    ...(parentId ? { parentId } : {}),
    childIds,
  };
};

// ─── Ungroup ──────────────────────────────────────────────────────────────

export type UngroupOutcome =
  | {
    ok: true;
    parts: CharacterPart[];
    tracks: Track[];
    childIds: string[];
    parentId?: string;
    /**
     * Every channel the bake could not carry with fewer keys, with the reason:
     * the dense per-frame fallback is recorded rather than silent, because the
     * timeline it produces is the one a user would ask about.
     */
    bakeNotes?: string[];
  }
  | { ok: false; reason: string };

/**
 * Ungrouping removes a container layer, so the container's motion has to end up
 * inside every child: afterwards a child's `parentId` is the container's parent,
 * and `evaluateTransform` must produce the same world pose it produced before —
 * `childStandalone(t) = containerLocal(t) ∘ childLocal(t)` — at every frame.
 *
 * Two exact paths, chosen per sequence scope:
 *
 *   - Affine fold (no key explosion). While the container's own local transform
 *     is constant in a scope and carries no rotation, composing it onto a child
 *     is a per-channel affine map (`foldAffine`). Every authored key keeps its
 *     frame time and easing verbatim: an animated child under a still container
 *     keeps the animation its author wrote, merely re-based.
 *
 *   - Sampled bake (a rotated or moving container). The product evaluates whole
 *     frames, and composing two channel interpolations is not representable as
 *     channel keys in general (a container rotation mixes a child's x and y
 *     across channels; a moving container multiplies two curves). So the bake
 *     samples the exact standalone transform at EVERY integer frame of the union
 *     span `[min, max]` of the container's and the child's own local key frames
 *     in that scope and writes the samples as linear channel keys.
 *     `interpolateChannel` returns a key's value at its own frame and clamps
 *     outside the authored range, so the baked track reproduces the value the
 *     product displayed at every integer frame, and the end keys carry the same
 *     clamped constants the two source curves held outside the span. Inside a
 *     sampled scope a child's own easing cannot survive the composition; it is
 *     replaced by the per-frame truth of what the product displayed.
 *
 * Nothing else is rewritten. Opacity, masks and Trim Path are never inherited
 * from the container, so they stay exactly as authored; the container and its
 * track are removed.
 */

/** The authored transform the evaluator starts a layer from, anchor applied. */
const authoredLocalTransform = (part: CharacterPart): Transform => {
  const anchor = part.anchor && part.anchor !== 'none' ? part.anchor : null;
  if (!anchor) return part.baseTransform;
  const offsets = PART_ANCHOR_OFFSETS[anchor] || PART_ANCHOR_OFFSETS.none;
  return {
    ...part.baseTransform,
    x: offsets.ax + (part.anchorOffsetX ?? 0),
    y: offsets.ay + (part.anchorOffsetY ?? 0),
  };
};

/** The frames at which this layer's OWN local transform is keyed in one scope. */
const localKeyFramesInScope = (track: Track | undefined, scope: string): number[] => {
  if (!track) return [];
  const frames: number[] = [];
  const collect = (keyframes: { frame: number; templateId?: string }[]) => keyframes.forEach((keyframe) => {
    if (keyframeScope(keyframe) === scope) frames.push(keyframe.frame);
  });
  LOCAL_CHANNELS.forEach((channel) => collect(track.channels?.[channel] ?? []));
  collect(track.keyframes ?? []);
  return frames;
};

/** Every scope this layer's own local transform animates in, in a stable order. */
const localTransformScopes = (track: Track | undefined): string[] => {
  if (!track) return [];
  const scopes = new Set<string>();
  const collect = (keyframes: { templateId?: string }[]) => keyframes.forEach((keyframe) => scopes.add(keyframeScope(keyframe)));
  LOCAL_CHANNELS.forEach((channel) => collect(track.channels?.[channel] ?? []));
  collect(track.keyframes ?? []);
  return [...scopes].sort();
};

/** A child's own transform once the container is gone, at one frame and scope. */
const standaloneTransformAt = (
  parts: CharacterPart[],
  tracks: Track[],
  childId: string,
  parentId: string | undefined,
  scope: string,
  frame: number,
): Transform => {
  const world = evaluateTransform(parts, tracks, scope, childId, frame);
  if (!parentId) return world;
  return worldToContainerLocal(world, evaluateTransform(parts, tracks, scope, parentId, frame));
};

/**
 * The strict bound a baked channel may leave at a displayed frame: the evaluated
 * pose must be the same number the product drew (float noise only), not merely a
 * close one.
 */
const BAKE_TOLERANCE = 1e-10;

/** An easing a baked segment may be authored with, copied from a source key when it has one. */
interface SegmentEasing {
  easing: EasingType;
  bezierControlPoints?: [number, number, number, number];
}

/** The easings a segment may take when no source key at its start names one. */
const BAKE_FALLBACK_EASINGS: EasingType[] = ['linear', 'easeIn', 'easeOut', 'easeInOut'];

/** The keys of one channel of one track inside one sequence scope, in time order. */
const scopeChannelKeys = (track: Track | undefined, channel: LocalChannel, scope: string): PropertyKeyframe[] => (
  [...(track?.channels?.[channel] ?? [])]
    .filter((keyframe) => keyframeScope(keyframe) === scope)
    .sort((left, right) => left.frame - right.frame)
);

/**
 * The easings a baked segment starting at `frame` may take: whatever the source
 * key sitting on that frame authored — which is what keeps an authored curve
 * verbatim when the composition preserves it — then the standard set, so a
 * segment the sources never eased still has something exact to fit.
 *
 * `autoBezier` is resolved to the concrete control points the evaluator would
 * derive from the source's own neighbours: the evaluator never reads the name,
 * and a baked key must be able to reproduce the curve it stood for.
 */
const segmentEasingsAt = (
  sources: Array<Track | undefined>,
  channel: LocalChannel,
  scope: string,
  frame: number,
): SegmentEasing[] => {
  const named: SegmentEasing[] = [];
  sources.forEach((track) => {
    const keys = scopeChannelKeys(track, channel, scope);
    const index = keys.findIndex((keyframe) => keyframe.frame === frame);
    if (index === -1) return;
    const keyframe = keys[index];
    if (keyframe.easing === 'autoBezier') {
      named.push({
        easing: 'bezier',
        bezierControlPoints: deriveAutoBezierControlPoints(
          keyframe,
          keys[index + 1] ?? keyframe,
          keys[index - 1],
          keys[index + 2],
        ),
      });
      return;
    }
    named.push({
      easing: keyframe.easing,
      ...(keyframe.bezierControlPoints ? { bezierControlPoints: keyframe.bezierControlPoints } : {}),
    });
  });
  const taken = new Set(named.map((basis) => basis.easing));
  return [...named, ...BAKE_FALLBACK_EASINGS.filter((easing) => !taken.has(easing)).map((easing) => ({ easing }))];
};

/**
 * Bake ONE channel of ONE scope into the sparsest key list that still evaluates
 * to the exact standalone value at every displayed frame. The ladder, in order:
 *
 *  1. Key-union composition: keys at the union of the two layers' own key frames,
 *     each segment keeping the easing its source key authored. Exact whenever the
 *     composition is itself a per-channel curve — a purely translated container, a
 *     container whose rotation and scale never change, or an animation both layers
 *     share — and that is the common case, where the timeline used to receive one
 *     key per frame of the whole span.
 *  2. Adaptive subdivision, and only in the segments whose measured error exceeds
 *     `BAKE_TOLERANCE`: a segment that cannot be carried by one easing is split at
 *     the frame where it misses worst, until it is exact.
 *  3. The dense per-frame bake, last resort, for a channel that is genuinely not
 *     representable (a rotating container mixing a child's x and y across
 *     channels). `dense` reports that the reason had to be taken.
 */
const bakeScopeChannel = (options: {
  channel: LocalChannel;
  childId: string;
  scope: string;
  /** Every integer frame of the span, in order. */
  displayed: number[];
  /** The exact standalone value of this channel at one frame of the span. */
  truthAt: (frame: number) => number;
  sources: Array<Track | undefined>;
}): { keys: PropertyKeyframe[]; dense: boolean } => {
  const { channel, childId, scope, displayed, truthAt, sources } = options;
  const min = displayed[0];
  const truth = displayed.map(truthAt);
  const valueAt = (frame: number) => truth[frame - min];
  /** A channel the composition leaves constant needs exactly one key, not a span. */
  const constantValue = truth[0];
  const isConstant = truth.every((value) => Math.abs(value - constantValue) <= BAKE_TOLERANCE);
  const build = (frames: number[], easings: SegmentEasing[]): PropertyKeyframe[] => frames.map((frame, index) => {
    const basis = easings[index] ?? { easing: 'linear' as const };
    return {
      id: `bake_${childId}_${channel}_${frame}_${scope}`,
      frame,
      value: valueAt(frame),
      easing: basis.easing,
      ...(basis.bezierControlPoints ? { bezierControlPoints: basis.bezierControlPoints } : {}),
      templateId: scope,
    };
  });
  /** How far the authored list strays from the truth at the frames the product draws. */
  const errorOf = (keys: PropertyKeyframe[]): number => displayed.reduce((worst, frame) => (
    Math.max(worst, Math.abs(interpolateChannel(keys, frame, valueAt(frame)) - valueAt(frame)))
  ), 0);
  /** The largest error strictly inside one segment, and where it sits. */
  const segmentMiss = (left: PropertyKeyframe, right: PropertyKeyframe): { miss: number; frame: number } => {
    const duration = right.frame - left.frame;
    let worst = { miss: 0, frame: left.frame };
    for (let frame = left.frame + 1; frame < right.frame; frame += 1) {
      const progress = (frame - left.frame) / duration;
      const eased = applyEasing(progress, left.easing, left.bezierControlPoints);
      const miss = Math.abs(lerp(left.value, right.value, eased) - valueAt(frame));
      if (miss > worst.miss) worst = { miss, frame };
    }
    return worst;
  };

  if (isConstant) return { keys: build([displayed[0]], [{ easing: 'linear' }]), dense: false };
  // The union of the two layers' OWN key times: the sparse candidate the sources
  // themselves authored. Anything beyond it is a frame the bake had to invent.
  const sourceFrames = [...new Set([...displayed.filter((frame) => sources.some(
    (track) => scopeChannelKeys(track, channel, scope).some((keyframe) => keyframe.frame === frame),
  )), displayed[0], displayed[displayed.length - 1]])].sort((left, right) => left - right);
  let frames = sourceFrames;
  let keys = build(frames, frames.map((frame) => segmentEasingsAt(sources, channel, scope, frame)[0]));
  let error = errorOf(keys);
  while (error > BAKE_TOLERANCE) {
    const missing: number[] = [];
    keys.forEach((key, index) => {
      const right = keys[index + 1];
      if (!right) return;
      // The segment is re-eased to whichever candidate carries it best BEFORE it is
      // split, so a segment one easing can already hold exactly is never subdivided.
      let best: SegmentEasing | null = null;
      let bestMiss = Number.POSITIVE_INFINITY;
      segmentEasingsAt(sources, channel, scope, key.frame).forEach((basis) => {
        const miss = segmentMiss({ ...key, easing: basis.easing, bezierControlPoints: basis.bezierControlPoints }, right).miss;
        if (miss < bestMiss) {
          bestMiss = miss;
          best = basis;
        }
      });
      if (best && bestMiss <= BAKE_TOLERANCE) {
        keys = keys.map((candidate, position) => (
          position === index
            ? { ...candidate, easing: best!.easing, ...(best!.bezierControlPoints ? { bezierControlPoints: best!.bezierControlPoints } : {}) }
            : candidate
        ));
        return;
      }
      missing.push(segmentMiss(key, right).frame);
    });
    // C4 — the re-easing above may already have made the list exact: measure
    // again before deciding that only a split (or the dense bake) can help.
    error = errorOf(keys);
    if (error <= BAKE_TOLERANCE) break;
    const next = [...new Set([...frames, ...missing])].sort((left, right) => left - right);
    // Nothing left to split: no frame the bake could add carries the segment.
    if (next.length === frames.length) break;
    frames = next;
    keys = build(frames, frames.map((frame) => segmentEasingsAt(sources, channel, scope, frame)[0]));
    error = errorOf(keys);
  }
  if (error > BAKE_TOLERANCE) {
    // Last resort: every frame of the span carries a key, so the pose is exact by
    // construction. It only happens for a channel whose composition a single
    // easing can never carry.
    frames = displayed;
    keys = build(frames, frames.map((frame) => segmentEasingsAt(sources, channel, scope, frame)[0]));
  }
  return { keys, dense: frames.length > sourceFrames.length };
};

/** Replace one scope's local channels with the sparsest exact standalone pose. */
const bakeScopeChannels = (options: {
  channels: Record<TrackChannel, PropertyKeyframe[]>;
  childId: string;
  childName: string;
  scope: string;
  span: number[];
  sampleAt: (frame: number) => Transform;
  sources: Array<Track | undefined>;
  notes: string[];
}): Record<TrackChannel, PropertyKeyframe[]> => {
  const { channels, childId, childName, scope, span, sampleAt, sources, notes } = options;
  const min = Math.min(...span);
  const max = Math.max(...span);
  const displayed: number[] = [];
  for (let frame = min; frame <= max; frame += 1) displayed.push(frame);
  // ONE evaluation per displayed frame, shared by every channel: the exact pose
  // the product drew, sampled where it draws.
  const poses: Transform[] = displayed.map((frame) => sampleAt(frame));
  const next = { ...channels };
  LOCAL_CHANNELS.forEach((channel) => {
    const kept = (channels[channel] ?? []).filter((keyframe) => keyframeScope(keyframe) !== scope);
    const baked = bakeScopeChannel({
      channel,
      childId,
      scope,
      displayed,
      truthAt: (frame) => poses[frame - min][channel],
      sources,
    });
    if (baked.dense) {
      notes.push(`"${childName}" ${scope} · ${channel}: baked per frame (this composition has no sparse per-channel equivalent)`);
    }
    next[channel] = [...kept, ...baked.keys].sort((left, right) => left.frame - right.frame);
  });
  return next;
};

/**
 * Fold the container's motion into one child's animation, or return the child's
 * track unchanged when there is nothing to re-base.
 */
const bakeChildAnimation = (options: {
  child: CharacterPart;
  track: Track | undefined;
  groupTrack: Track | undefined;
  groupLocal: Transform;
  scopes: string[];
  parts: CharacterPart[];
  tracks: Track[];
  parentId: string | undefined;
  /** Dense-bake reasons, collected for the ungroup outcome. */
  notes: string[];
}): Track | undefined => {
  const { child, track, groupTrack, groupLocal, scopes, parts, tracks, parentId, notes } = options;
  const fold = foldAffine(groupLocal);
  // A rotated container mixes a child's x and y across channels, and a zero
  // scale has no matching per-channel map, so both take the sampled path.
  const canFold = fold !== null && groupLocal.scaleX !== 0 && groupLocal.scaleY !== 0;
  let channels = track ? { ...makeEmptyChannels(), ...track.channels } : undefined;
  let keyframes = track?.keyframes;
  let changed = false;

  scopes.forEach((scope) => {
    if (!localKeyFramesInScope(groupTrack, scope).length && canFold) {
      if (track && localKeyFramesInScope(track, scope).length) {
        channels = foldChannels(channels!, fold!, scope);
        keyframes = foldLegacyKeyframes(keyframes, fold!, scope);
        changed = true;
      }
      return;
    }
    // The union span of both layers' local keys. An empty span means neither
    // layer animates its own transform in this scope: the base fold carries it.
    const span = [...localKeyFramesInScope(groupTrack, scope), ...localKeyFramesInScope(track, scope)];
    if (span.length === 0) return;
    channels = bakeScopeChannels({
      channels: channels!,
      childId: child.id,
      childName: child.name,
      scope,
      span,
      sampleAt: (frame) => standaloneTransformAt(parts, tracks, child.id, parentId, scope, frame),
      // The two curves the composition is built from: the sparsest exact bake
      // keeps the key times and easings these two actually authored.
      sources: [groupTrack, track],
      notes,
    });
    changed = true;
  });

  if (!changed) return track;
  const base: Track = track ?? {
    id: generateId('track'),
    partId: child.id,
    name: child.name,
    color: TOOLBAR_COLORS[0],
    visible: true,
    locked: false,
    expanded: false,
    keyframes: [],
    channels: makeEmptyChannels(),
  };
  return { ...base, channels: channels ?? makeEmptyChannels(), keyframes: keyframes ?? [] };
};

/**
 * Dissolve a group: every child keeps its exact evaluated world pose at every
 * frame and moves up to the group's own parent, then the container and its track
 * are removed. See the bake rules above for how a moving container is carried.
 */
export const dissolveLayerGroup = (
  parts: CharacterPart[],
  tracks: Track[],
  groupId: string,
): UngroupOutcome => {
  const blocked = ungroupBlockReason(parts, tracks, groupId);
  if (blocked) return { ok: false, reason: blocked };
  return dissolveContainer(parts, tracks, groupId);
};

/**
 * The container-removal core shared by ungroup and by deleting a plain parent
 * layer: the container and its track go, its direct children move up to its
 * parent and keep their evaluated world pose (base fold + per-scope bake). The
 * caller owns the preconditions.
 */
const dissolveContainer = (
  parts: CharacterPart[],
  tracks: Track[],
  groupId: string,
): Extract<UngroupOutcome, { ok: true }> => {
  const group = parts.find((part) => part.id === groupId)!;
  const children = getGroupChildren(parts, groupId);
  const parentId = group.parentId;
  const childIds = children.map((child) => child.id);
  const groupTrack = tracks.find((track) => track.partId === groupId);
  const groupLocal = authoredLocalTransform(group);
  // Every scope either layer animates its own local transform in. A scope
  // nobody animates sees both layers at their authored base, which is what the
  // base fold below writes — no key is invented for it.
  const scopes = [...new Set(
    [groupTrack, ...tracks.filter((track) => childIds.includes(track.partId))]
      .flatMap((track) => localTransformScopes(track)),
  )].sort();

  const nextParts = parts
    .filter((part) => part.id !== groupId)
    .map((part) => {
      if (!childIds.includes(part.id)) return part;
      // The container's authored local transform is what a child still sees in
      // every scope nobody animates, so its children take that exact pose.
      const local = composeWorldTransform(groupLocal, part.baseTransform);
      return {
        ...part,
        parentId,
        baseTransform: {
          ...part.baseTransform,
          x: local.x,
          y: local.y,
          rotation: local.rotation,
          scaleX: local.scaleX,
          scaleY: local.scaleY,
        },
      };
    });

  const bakeNotes: string[] = [];
  const nextTracks = tracks
    .filter((track) => track.partId !== groupId)
    .map((track) => (childIds.includes(track.partId)
      ? bakeChildAnimation({
        child: children.find((child) => child.id === track.partId)!,
        track,
        groupTrack,
        groupLocal,
        scopes,
        parts,
        tracks,
        parentId,
        notes: bakeNotes,
      }) ?? track
      : track));
  children.forEach((child) => {
    if (tracks.some((track) => track.partId === child.id)) return;
    const baked = bakeChildAnimation({
      child, track: undefined, groupTrack, groupLocal, scopes, parts, tracks, parentId, notes: bakeNotes,
    });
    if (baked) nextTracks.push(baked);
  });

  return {
    ok: true,
    parts: nextParts,
    tracks: nextTracks,
    childIds,
    ...(parentId ? { parentId } : {}),
    ...(bakeNotes.length > 0 ? { bakeNotes } : {}),
  };
};

// ─── Deleting a plain parent ──────────────────────────────────────────────

export type ParentReleaseOutcome =
  | { ok: true; parts: CharacterPart[]; tracks: Track[]; releasedChildIds: string[]; bakeNotes?: string[] }
  | { ok: false; reason: string };

/** Every integer frame where a layer's world pose could differ, per scope. */
const verificationFrames = (tracks: Track[], ids: string[], scope: string): number[] => {
  const keyed = ids.flatMap((id) => localKeyFramesInScope(tracks.find((track) => track.partId === id), scope));
  const frames = new Set<number>([0, ...keyed.map((frame) => Math.round(frame))]);
  const sorted = [...frames].sort((a, b) => a - b);
  // Between two keys the bake writes every integer frame; check one inside each gap.
  sorted.slice(1).forEach((frame, index) => frames.add(Math.round((sorted[index] + frame) / 2)));
  return [...frames].sort((a, b) => a - b);
};

/**
 * Deleting a layer that is NOT a group container but still parents surviving
 * layers. Its children must not keep a `parentId` to a layer that no longer
 * exists — `evaluateTransform` would drop the parent and every child would jump
 * to its bare local pose. They move up to the deleted layer's own parent and
 * keep their evaluated world pose at every frame of every sequence, through
 * the same container-removal core as ungroup (`dissolveContainer`).
 *
 * Deepest parents are released first, so a chain of deleted parents folds into
 * the nearest surviving ancestor. The result is then VERIFIED: every released
 * child's world affine is compared at the key frames (and one frame inside each
 * key gap) of every sequence it or a released ancestor animates in. When it
 * cannot be kept — a stage-anchored child (the anchor replaces its position),
 * a Boolean operand as parent, or a pose that would need a skew — nothing is
 * written and the reason is returned.
 *
 * `deletedIds` is the full deletion closure; the released parents are removed
 * here, the caller deletes the rest as before.
 */
export const releaseChildrenOfDeletedParents = (
  parts: CharacterPart[],
  tracks: Track[],
  deletedIds: Set<string>,
): ParentReleaseOutcome => {
  const partById = new Map(parts.map((part) => [part.id, part]));
  const nameOf = (part: CharacterPart) => `"${part.name || part.id}"`;
  const survivingChildren = (current: CharacterPart[], id: string) => current.filter((part) => part.parentId === id && !deletedIds.has(part.id));
  // The next deleted parent to release: the deepest one that (now) holds a
  // surviving child. Releasing it can hand its children to a deleted
  // grandparent, which is then released in turn.
  const nextParent = (current: CharacterPart[]) => [...deletedIds]
    .filter((id) => current.some((part) => part.id === id) && survivingChildren(current, id).length > 0)
    .sort((a, b) => relationshipAncestorDepth(current, b) - relationshipAncestorDepth(current, a))[0];

  let nextParts = parts;
  let nextTracks = tracks;
  const bakeNotes: string[] = [];
  const released = new Set<string>();
  const parents: string[] = [];
  for (let id = nextParent(nextParts); id; id = nextParent(nextParts)) {
    const parent = partById.get(id)!;
    if (parent.booleanGroupId) {
      return { ok: false, reason: `${nameOf(parent)} is a Boolean operand with child layers; their position cannot be kept. Unparent them first.` };
    }
    const anchored = survivingChildren(nextParts, id).find((child) => child.anchor && child.anchor !== 'none');
    if (anchored) {
      return { ok: false, reason: `${nameOf(anchored)} is placed by a stage anchor inside ${nameOf(parent)}; deleting the parent would move it. Set its Anchor to None or unparent it first.` };
    }
    const outcome = dissolveContainer(nextParts, nextTracks, id);
    nextParts = outcome.parts;
    nextTracks = outcome.tracks;
    parents.push(id);
    outcome.childIds.forEach((childId) => { if (!deletedIds.has(childId)) released.add(childId); });
    bakeNotes.push(...(outcome.bakeNotes ?? []));
  }
  if (parents.length === 0) return { ok: true, parts, tracks, releasedChildIds: [] };

  const releasedChildIds = [...released];
  const chainIds = [...new Set([...releasedChildIds, ...parents, ...releasedChildIds.flatMap((childId) => relationshipAncestorIds(parts, childId))])];
  const scopes = [...new Set(['Sequence', ...chainIds.flatMap((chainId) => localTransformScopes(tracks.find((track) => track.partId === chainId)))])];
  for (const scope of scopes) {
    for (const frame of verificationFrames(tracks, chainIds, scope)) {
      for (const childId of releasedChildIds) {
        const before = worldAffineOf(evaluateTransform(parts, tracks, scope, childId, frame));
        const after = worldAffineOf(evaluateTransform(nextParts, nextTracks, scope, childId, frame));
        const tolerance = 1e-4 * Math.max(1, ...AFFINE_KEYS.map((key) => Math.abs(before[key])));
        if (AFFINE_KEYS.some((key) => Math.abs(after[key] - before[key]) > tolerance)) {
          const child = partById.get(childId)!;
          return { ok: false, reason: `${nameOf(child)} cannot keep its exact place without its parent (its pose would need a skew). Unparent it first.` };
        }
      }
    }
  }

  return { ok: true, parts: nextParts, tracks: nextTracks, releasedChildIds, ...(bakeNotes.length > 0 ? { bakeNotes } : {}) };
};

// ─── Re-parenting an animated layer ───────────────────────────────────────

/**
 * A scope no key belongs to: evaluating in it gives every layer its authored
 * base pose (the pose a sequence nobody animates shows).
 */
const REST_SCOPE = '\u0000kcs-rest';

export interface RebasedChild {
  id: string;
  name: string;
  keyframesBefore: number;
  keyframesAfter: number;
  /** A channel had to be baked one key per frame (no sparse exact equivalent). */
  perFrame: boolean;
  notes: string[];
}

export type RebaseOutcome =
  | { ok: true; parts: CharacterPart[]; tracks: Track[]; rebased: RebasedChild | null }
  | { ok: false; reason: string };

const localKeyCount = (track: Track | undefined): number => (track
  ? LOCAL_CHANNELS.reduce((sum, channel) => sum + (track.channels?.[channel]?.length ?? 0), 0) + (track.keyframes?.length ?? 0)
  : 0);

/**
 * C4 — gives `childId` a new parent (`newParentId`, or none) and keeps its
 * WORLD pose at every integer frame of every sequence, also when the layer or
 * a layer of the old or new parent chain is animated.
 *
 * - The base transform becomes `inverse(newParentBase) ∘ oldWorldBase`.
 * - In every sequence where the layer or one of those chains animates its own
 *   transform, the layer's local x/y/rotation/scale are re-expressed in the new
 *   parent: `inverse(newParentWorld(t)) ∘ oldWorld(t)`, through the same bake
 *   ladder ungroup uses — the source key times and easings first, adaptive
 *   subdivision next, one key per frame only where nothing sparser is exact.
 *   Keys go into the canonical channels (legacy keys stay stored, as ungroup).
 * - The result is VERIFIED against the old world affines at the key frames
 *   and a frame inside every key gap of every sequence; a pose that would need
 *   a skew (rotation inside a non-uniformly scaled parent) refuses the change.
 *
 * Between integer frames a re-based rotating composition can differ slightly
 * from the original (it was exact at the frames the product draws). Descendants
 * keep their own local poses and follow the layer as before. The caller has
 * already checked the structural rules (cycles, Boolean, anchors, bonds).
 */
export const rebaseLayerOntoParent = (
  parts: CharacterPart[],
  tracks: Track[],
  childId: string,
  newParentId: string | null,
): RebaseOutcome => {
  const child = parts.find((part) => part.id === childId);
  if (!child) return { ok: false, reason: 'The layer no longer exists.' };
  const trackOf = (id: string) => tracks.find((track) => track.partId === id);
  const oldChain = relationshipAncestorIds(parts, childId);
  const newChain = newParentId ? [newParentId, ...relationshipAncestorIds(parts, newParentId)] : [];
  const involved = [...new Set([childId, ...oldChain, ...newChain])];

  // The base pose, re-expressed in the new parent.
  const baseWorld = evaluateTransform(parts, tracks, REST_SCOPE, childId, 0);
  const baseLocal = newParentId ? worldToContainerLocal(baseWorld, evaluateTransform(parts, tracks, REST_SCOPE, newParentId, 0)) : baseWorld;
  const nextParts = parts.map((part) => {
    if (part.id !== childId) return part;
    const next: CharacterPart = {
      ...part,
      baseTransform: { ...part.baseTransform, x: baseLocal.x, y: baseLocal.y, rotation: baseLocal.rotation, scaleX: baseLocal.scaleX, scaleY: baseLocal.scaleY },
    };
    if (newParentId) next.parentId = newParentId;
    else delete next.parentId;
    return next;
  });

  // Every sequence one of the involved layers animates its own transform in.
  const scopes = [...new Set(involved.flatMap((id) => localTransformScopes(trackOf(id))))].sort();
  const childTrack = trackOf(childId);
  const notes: string[] = [];
  let channels = childTrack ? { ...makeEmptyChannels(), ...childTrack.channels } : makeEmptyChannels();
  scopes.forEach((scope) => {
    const span = involved.flatMap((id) => localKeyFramesInScope(trackOf(id), scope));
    if (span.length === 0) return;
    channels = bakeScopeChannels({
      channels,
      childId,
      childName: child.name,
      scope,
      span,
      sampleAt: (frame) => {
        const world = evaluateTransform(parts, tracks, scope, childId, frame);
        return newParentId ? worldToContainerLocal(world, evaluateTransform(parts, tracks, scope, newParentId, frame)) : world;
      },
      sources: involved.map(trackOf),
      notes,
    });
    // A channel the layer never keyed in this scope and that stays at the new
    // base value needs no key: the base already shows it (fewer invented keys).
    LOCAL_CHANNELS.forEach((channel) => {
      const inScope = channels[channel].filter((keyframe) => keyframeScope(keyframe) === scope);
      const hadKeys = scopeChannelKeys(childTrack, channel, scope).length > 0
        || (childTrack?.keyframes ?? []).some((keyframe) => keyframeScope(keyframe) === scope);
      if (!hadKeys && inScope.length === 1 && Math.abs(inScope[0].value - baseLocal[channel]) <= BAKE_TOLERANCE) {
        channels = { ...channels, [channel]: channels[channel].filter((keyframe) => keyframeScope(keyframe) !== scope) };
      }
    });
  });

  let nextTracks = tracks;
  let rebased: RebasedChild | null = null;
  if (scopes.length > 0) {
    const base: Track = childTrack ?? {
      id: generateId('track'),
      partId: childId,
      name: child.name,
      color: TOOLBAR_COLORS[0],
      visible: true,
      locked: false,
      expanded: false,
      keyframes: [],
      channels: makeEmptyChannels(),
    };
    const nextTrack: Track = { ...base, channels };
    nextTracks = childTrack ? tracks.map((track) => (track === childTrack ? nextTrack : track)) : [...tracks, nextTrack];
    rebased = {
      id: childId,
      name: child.name || childId,
      keyframesBefore: localKeyCount(childTrack),
      keyframesAfter: localKeyCount(nextTrack),
      perFrame: notes.length > 0,
      notes,
    };
  }

  // Verify the world pose wherever it could differ.
  const verifyIds = [...involved, ...parts.filter((part) => relationshipAncestorIds(parts, part.id).includes(childId)).map((part) => part.id)];
  // (the rest scope checks the base pose every unanimated sequence shows)
  for (const scope of [...new Set([REST_SCOPE, 'Sequence', ...scopes])]) {
    for (const frame of verificationFrames(tracks, involved, scope)) {
      for (const id of verifyIds) {
        const before = worldAffineOf(evaluateTransform(parts, tracks, scope, id, frame));
        const after = worldAffineOf(evaluateTransform(nextParts, nextTracks, scope, id, frame));
        const tolerance = 1e-4 * Math.max(1, ...AFFINE_KEYS.map((key) => Math.abs(before[key])));
        if (AFFINE_KEYS.some((key) => Math.abs(after[key] - before[key]) > tolerance)) {
          return { ok: false, reason: `“${child.name || childId}” cannot keep its exact place inside the new parent at every frame (its pose would need a skew — a rotation inside a non-uniformly scaled parent). Nothing was changed.` };
        }
      }
    }
  }
  return { ok: true, parts: nextParts, tracks: nextTracks, rebased };
};

const AFFINE_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

const relationshipAncestorDepth = (parts: CharacterPart[], partId: string): number => relationshipAncestorIds(parts, partId).length;

/** The display name for the next group in a document. */
export const createGroupDisplayName = (parts: CharacterPart[]): string => {
  const taken = new Set(parts.map((part) => part.name));
  let index = 1;
  while (taken.has(index === 1 ? 'Group' : `Group ${index}`)) index += 1;
  return index === 1 ? 'Group' : `Group ${index}`;
};
