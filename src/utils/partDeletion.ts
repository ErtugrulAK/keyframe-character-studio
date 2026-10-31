import type { CharacterPart, Track } from '../types/animator';
import { releaseChildrenOfDeletedParents } from './layerGrouping';
import { resolveMatteSource } from './matte';

interface DeletePartsResult {
  parts: CharacterPart[];
  tracks: Track[];
  deletedIds: string[];
}

/**
 * Expand requested removals through container ownership without touching
 * unrelated parts. A Set makes duplicate parent/operand requests harmless and
 * the queue guard makes malformed cyclic references finite.
 *
 * Two containers own their contents: a Boolean group owns its operands, and a
 * layer group (`isGroup`) owns its `parentId` children — deleting a group takes
 * its layers with it rather than leaving them orphaned at their local poses.
 */
export const collectOwnedDeletionIds = (
  parts: CharacterPart[],
  requestedIds: string[],
): Set<string> => {
  const partById = new Map(parts.map((part) => [part.id, part]));
  const ids = new Set(requestedIds.filter((id) => partById.has(id)));
  const pending = [...ids];

  while (pending.length > 0) {
    const id = pending.pop();
    if (!id) continue;
    const part = partById.get(id);
    if (!part) continue;
    const owned = [
      ...(part.booleanOperandIds ?? []),
      ...(part.isGroup ? parts.filter((candidate) => candidate.parentId === part.id).map((candidate) => candidate.id) : []),
    ];
    for (const ownedId of owned) {
      if (!partById.has(ownedId) || ids.has(ownedId)) continue;
      ids.add(ownedId);
      pending.push(ownedId);
    }
  }

  return ids;
};

/** Remove a normalized deletion closure and all associated part tracks. */
export const deleteParts = (
  parts: CharacterPart[],
  tracks: Track[],
  requestedIds: string[],
): DeletePartsResult => {
  const ids = collectOwnedDeletionIds(parts, requestedIds);
  const existingIds = new Set(parts.map((part) => part.id));
  const remainingParts = parts
    .filter((part) => !ids.has(part.id))
    .map((part) => {
      const nextOperandIds = part.booleanOperandIds?.filter((operandId) => existingIds.has(operandId) && !ids.has(operandId));
      const nextGroupId = part.booleanGroupId && ids.has(part.booleanGroupId)
        ? undefined
        : part.booleanGroupId;
      if (nextOperandIds === undefined && nextGroupId === part.booleanGroupId) return part;
      return {
        ...part,
        booleanGroupId: nextGroupId,
        ...(nextOperandIds && nextOperandIds.length > 0
          ? { booleanOperandIds: nextOperandIds }
          : { booleanOperandIds: undefined }),
      };
    });
  return {
    parts: remainingParts,
    tracks: tracks.filter((track) => !ids.has(track.partId)),
    deletedIds: [...ids],
  };
};

/**
 * A released child whose transform keyframes the delete rewrites: what the
 * user is told BEFORE confirming (C3). `perFrame` = at least one channel could
 * only be carried with one key per frame.
 */
export interface BakedChild {
  id: string;
  name: string;
  keyframesBefore: number;
  keyframesAfter: number;
  perFrame: boolean;
}

const TRANSFORM_CHANNELS = ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const;
const transformKeyCount = (track: Track | undefined): number => (
  TRANSFORM_CHANNELS.reduce((sum, channel) => sum + (track?.channels?.[channel]?.length ?? 0), 0)
);

type PartDeletionPlan =
  | (DeletePartsResult & { ok: true; releasedChildIds: string[]; bakeNotes?: string[]; bakedChildren: BakedChild[] })
  | { ok: false; reason: string };

/**
 * The full delete: containers take what they own (`deleteParts`), and a plain
 * parent's surviving children are first moved up with their world pose kept
 * (`releaseChildrenOfDeletedParents`), so no layer is left pointing at a
 * deleted parent. When that pose cannot be kept, nothing is deleted.
 */
export const planPartDeletion = (
  parts: CharacterPart[],
  tracks: Track[],
  requestedIds: string[],
): PartDeletionPlan => {
  const closure = collectOwnedDeletionIds(parts, requestedIds);
  const release = releaseChildrenOfDeletedParents(parts, tracks, closure);
  if (!release.ok) return release;
  const deletion = deleteParts(release.parts, release.tracks, [...closure]);
  const bakedChildren = release.releasedChildIds.flatMap((childId): BakedChild[] => {
    const before = tracks.find((track) => track.partId === childId);
    const after = deletion.tracks.find((track) => track.partId === childId);
    if (before === after) return [];
    const part = parts.find((candidate) => candidate.id === childId);
    const name = part?.name || childId;
    return [{
      id: childId,
      name,
      keyframesBefore: transformKeyCount(before),
      keyframesAfter: transformKeyCount(after),
      perFrame: (release.bakeNotes ?? []).some((note) => note.startsWith(`"${name}" `)),
    }];
  });
  return {
    ok: true,
    parts: deletion.parts,
    tracks: deletion.tracks,
    // The released parents are already gone from `release.parts`.
    deletedIds: [...closure],
    releasedChildIds: release.releasedChildIds,
    ...(release.bakeNotes ? { bakeNotes: release.bakeNotes } : {}),
    bakedChildren,
  };
};

/** A layer that keeps pointing at a layer the deletion removes. */
export interface DeletionDependent {
  target: CharacterPart;
  sourceId: string;
  /** `track` = Track Matte, `legacy` = legacy clip matte. */
  kind: 'track' | 'legacy';
}

/**
 * The layers whose active matte reads a layer this deletion removes and
 * that themselves survive it. Deletion never rewrites them: their relationship
 * stays as authored and reports a missing source until the source is restored
 * (Undo) or replaced by the user. The caller shows these BEFORE deleting.
 */
export const matteDependentsOfDeletion = (
  parts: CharacterPart[],
  requestedIds: string[],
): DeletionDependent[] => {
  const removed = collectOwnedDeletionIds(parts, requestedIds);
  return parts.flatMap((part) => {
    if (removed.has(part.id)) return [];
    const reference = resolveMatteSource(part);
    return reference && removed.has(reference.sourceId)
      ? [{ target: part, sourceId: reference.sourceId, kind: reference.kind }]
      : [];
  });
};

/**
 * What a delete takes and what it keeps, named BEFORE anything changes.
 *
 * A group (and a Boolean group) is a CONTAINER: its layers are deleted with it
 * (`ownedContents`). A plain layer that other layers are parented to is a
 * TRANSFORM relationship only: its children survive, move up one level and keep
 * their place on screen (`keptChildren`). A Track Matte is a DISPLAY
 * relationship and never extends the delete (see `matteDependentsOfDeletion`).
 */
interface DeletionScope {
  /** The layers the user asked to delete (that exist). */
  requested: CharacterPart[];
  /** Layers deleted only because a deleted container owns them. */
  ownedContents: CharacterPart[];
  /** Children of a deleted plain parent that survive the delete. */
  keptChildren: CharacterPart[];
}

export const describeDeletionScope = (parts: CharacterPart[], requestedIds: string[]): DeletionScope => {
  const closure = collectOwnedDeletionIds(parts, requestedIds);
  const requestedSet = new Set(requestedIds);
  return {
    requested: parts.filter((part) => requestedSet.has(part.id)),
    ownedContents: parts.filter((part) => closure.has(part.id) && !requestedSet.has(part.id)),
    keptChildren: parts.filter((part) => !closure.has(part.id) && Boolean(part.parentId && closure.has(part.parentId))),
  };
};

/** The Delete command's label for that scope ("Delete", "Delete Group and 3 Layers", "Delete (Keeps 2 Children)"). */
export const deletionCommandLabel = (scope: DeletionScope): string => {
  const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
  const isGroupDelete = scope.ownedContents.length > 0;
  if (isGroupDelete) {
    const only = scope.requested.length === 1 ? scope.requested[0] : undefined;
    const subject = only && (only.isGroup || (only.booleanOperandIds?.length ?? 0) > 0) ? 'Group' : 'Selection';
    return `Delete ${subject} and ${plural(scope.ownedContents.length, 'Layer')}`;
  }
  const kept = scope.keptChildren.length;
  if (kept > 0) return `Delete (Keeps ${kept} ${kept === 1 ? 'Child' : 'Children'})`;
  return 'Delete';
};
