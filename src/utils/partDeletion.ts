import type { CharacterPart, Track } from '../types/animator';

export interface DeletePartsResult {
  parts: CharacterPart[];
  tracks: Track[];
  deletedIds: string[];
}

/**
 * Expand requested removals through Boolean-parent ownership without touching
 * unrelated parts. A Set makes duplicate parent/operand requests harmless and
 * the queue guard makes malformed cyclic references finite.
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
    if (!part?.booleanOperandIds) continue;
    for (const operandId of part.booleanOperandIds) {
      if (!partById.has(operandId) || ids.has(operandId)) continue;
      ids.add(operandId);
      pending.push(operandId);
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
