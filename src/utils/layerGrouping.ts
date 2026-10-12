import type {
  CharacterPart,
  Keyframe,
  PropertyKeyframe,
  Track,
  TrackChannel,
  Transform,
} from '../types/animator';
import { getPartLocalBounds, getPartWorldBounds, type PartLocalBounds, type PartWorldBounds } from './bounds';
import { worldToContainerLocal } from './containerMath';
import { makeEmptyChannels } from './defaults';
import { isRelationshipChainRelated, relationshipParentId } from './partBinding';

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
 * Directories, scales and mirrors are all affine, so only rotation is refused,
 * and only for an animated child.
 */

/** The container layer type: a freeform with no path or points draws nothing. */
export const GROUP_CONTAINER_TYPE: CharacterPart['type'] = 'custom_freeform';

/** The local transform channels a fold rewrites (opacity is never inherited). */
const LOCAL_CHANNELS = ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const;
type LocalChannel = (typeof LOCAL_CHANNELS)[number];

const IDENTITY: Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

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

// ─── Fold math ────────────────────────────────────────────────────────────

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
): Record<TrackChannel, PropertyKeyframe[]> => {
  const next = { ...channels };
  LOCAL_CHANNELS.forEach((channel) => {
    next[channel] = (channels[channel] ?? []).map((keyframe) => ({
      ...keyframe,
      value: fold[channel].a * keyframe.value + fold[channel].b,
    }));
  });
  return next;
};

const foldLegacyKeyframes = (keyframes: Keyframe[] | undefined, fold: LocalFold): Keyframe[] | undefined => (
  keyframes?.map((keyframe) => ({ ...keyframe, transform: foldTransform(keyframe.transform, fold) }))
);

/** True when the layer's own transform is animated on any sequence. */
const isLocalTransformAnimated = (track: Track | undefined): boolean => {
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
  worldOf: (partId: string) => Transform;
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
 */
const localBoundsInContainer = (
  parts: CharacterPart[],
  part: CharacterPart,
  local: Transform,
  worldOf: (partId: string) => Transform,
  depth: number,
): PartLocalBounds | null => {
  // A group has no geometry of its own: its own children define its box, which
  // is what makes a nested group measure as the art inside it. A container with
  // nothing measurable inside contributes NOTHING — falling back to its own
  // bounds would put `getPartLocalBounds`'s placeholder square inside the parent
  // group's aggregate envelope.
  const bounds = part.isGroup
    ? aggregateLocalBounds(parts, part.id, worldOf, depth + 1)
    : getPartLocalBounds(part, local);
  if (!bounds) return null;
  const radians = (local.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corners = [
    [bounds.minX, bounds.minY],
    [bounds.maxX, bounds.minY],
    [bounds.maxX, bounds.maxY],
    [bounds.minX, bounds.maxY],
  ].map(([x, y]) => {
    const scaledX = x * local.scaleX;
    const scaledY = y * local.scaleY;
    return { x: local.x + scaledX * cos - scaledY * sin, y: local.y + scaledX * sin + scaledY * cos };
  });
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
  worldOf: (partId: string) => Transform,
  depth: number,
): PartLocalBounds | null => {
  if (depth > MAX_GROUP_DEPTH) return null;
  const groupWorld = worldOf(groupId);
  const bounds = getGroupChildren(parts, groupId)
    .map((child) => localBoundsInContainer(parts, child, worldToContainerLocal(worldOf(child.id), groupWorld), worldOf, depth))
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
  worldOf: (partId: string) => Transform,
): PartLocalBounds | null => aggregateLocalBounds(parts, groupId, worldOf, 0);

/** World bounds of a layer, walking a nested group's children when it is a container. */
const layerWorldBounds = (
  parts: CharacterPart[],
  part: CharacterPart,
  worldOf: (partId: string) => Transform,
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

/** Why the selected group cannot be ungrouped, or `null` when it can. */
export const ungroupBlockReason = (parts: CharacterPart[], tracks: Track[], groupId: string): string | null => {
  const group = parts.find((part) => part.id === groupId);
  if (!group || !group.isGroup) return 'Select a layer group to ungroup.';
  if (getGroupChildren(parts, groupId).length === 0) return 'This group has no layers.';
  if (isLocalTransformAnimated(tracks.find((track) => track.partId === groupId))) {
    return 'Ungroup cannot redistribute an animated group. Remove the group keyframes first.';
  }
  return null;
};

// ─── Group creation ───────────────────────────────────────────────────────

export interface GroupCreationContext {
  groupId: string;
  trackId: string;
  name: string;
  worldOf: (partId: string) => Transform;
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
  | { ok: true; parts: CharacterPart[]; tracks: Track[]; childIds: string[]; parentId?: string }
  | { ok: false; reason: string };

/**
 * Dissolve a group: every child keeps its exact current world pose and moves up
 * to the group's own parent, then the container and its track are removed.
 */
export const dissolveLayerGroup = (
  parts: CharacterPart[],
  tracks: Track[],
  groupId: string,
  worldOf: (partId: string) => Transform,
): UngroupOutcome => {
  const blocked = ungroupBlockReason(parts, tracks, groupId);
  if (blocked) return { ok: false, reason: blocked };
  const group = parts.find((part) => part.id === groupId)!;
  const children = getGroupChildren(parts, groupId);
  const parentId = group.parentId;
  const parentWorld = parentId ? worldOf(parentId) : IDENTITY;
  // Removing the container means composing its own parent-local transform back
  // onto each child, the exact inverse of what grouping did.
  const containerLocal = worldToContainerLocal(worldOf(groupId), parentWorld);
  const childIds = children.map((child) => child.id);
  const tracksByPart = new Map(tracks.map((track) => [track.partId, track]));

  if (!foldAffine(containerLocal) && animatedChildNames(childIds, tracksByPart, parts).length > 0) {
    return {
      ok: false,
      reason: 'Ungroup is exact only while the group has no rotation. Reset the group rotation to 0 to ungroup keyframed layers.',
    };
  }

  const folded = foldChildrenInto({
    parts: parts.filter((part) => part.id !== groupId),
    tracks: tracks.filter((track) => track.partId !== groupId),
    childIds,
    parentId,
    compose: containerLocal,
    newParentWorld: parentWorld,
    worldOf,
  });

  return {
    ok: true,
    parts: folded.parts,
    tracks: folded.tracks,
    childIds,
    ...(parentId ? { parentId } : {}),
  };
};

/** The display name for the next group in a document. */
export const createGroupDisplayName = (parts: CharacterPart[]): string => {
  const taken = new Set(parts.map((part) => part.name));
  let index = 1;
  while (taken.has(index === 1 ? 'Group' : `Group ${index}`)) index += 1;
  return index === 1 ? 'Group' : `Group ${index}`;
};
