import type { CharacterPart } from '../types/animator';

/**
 * Position bonding between layers: the bonded parts list each other in
 * `boundPartIds`, and a position change on one is written to the others as the
 * same world-space delta (see `useInspector.updateCurrentTransform`).
 *
 * This is "move together", not a parent-child transform: rotation, scale and
 * opacity stay independent, and neither part owns the other. The list is mutual
 * so a lookup never depends on which side the UI wrote first — the union of both
 * sides below is the authority.
 */

/** Every part bonded to `partId`, in document order. */
export const resolveBoundPartners = (parts: CharacterPart[], partId: string): CharacterPart[] => {
  const ownList = parts.find((part) => part.id === partId)?.boundPartIds ?? [];
  const listed = new Set(ownList);
  return parts.filter((part) => part.id !== partId && (listed.has(part.id) || (part.boundPartIds ?? []).includes(partId)));
};

/** The part and everything bonded to it, as ids. */
export const resolveBondGroup = (parts: CharacterPart[], partId: string): string[] => [
  partId,
  ...resolveBoundPartners(parts, partId).map((part) => part.id),
];

/** The relationship a part inherits its transform from; both models use one chain. */
const relationshipParentOf = (parts: CharacterPart[], partId: string): string | undefined => {
  const part = parts.find((candidate) => candidate.id === partId);
  return part?.parentId ?? part?.booleanGroupId;
};

/**
 * True when one part is the other's ancestor or descendant.
 *
 * A bonded ancestor/descendant pair would move twice: the hierarchy already
 * carries the parent's position into the child, and the bond would add the same
 * delta again on the child's own transform.
 */
export const isRelationshipChainRelated = (parts: CharacterPart[], aId: string, bId: string): boolean => {
  const reachable = (startId: string, targetId: string): boolean => {
    const seen = new Set<string>();
    let cursor = relationshipParentOf(parts, startId);
    while (cursor && !seen.has(cursor)) {
      if (cursor === targetId) return true;
      seen.add(cursor);
      cursor = relationshipParentOf(parts, cursor);
    }
    return false;
  };
  return aId !== bId && (reachable(aId, bId) || reachable(bId, aId));
};

/**
 * Bond the given parts to each other, dropping each one's links to parts outside
 * the group (a layer belongs to one bond at a time) and clearing any bond the
 * group replaces. Returns the same array when nothing changes.
 */
export const bindParts = (parts: CharacterPart[], ids: string[]): CharacterPart[] => {
  const group = [...new Set(ids)].filter((id) => parts.some((part) => part.id === id));
  if (group.length < 2) return parts;
  const inGroup = new Set(group);
  return parts.map((part) => {
    const current = part.boundPartIds ?? [];
    if (inGroup.has(part.id)) {
      const next = group.filter((id) => id !== part.id);
      const unchanged = current.length === next.length && next.every((id) => current.includes(id));
      if (unchanged) return part;
      return { ...part, boundPartIds: next };
    }
    // A layer left outside the new group must not keep pointing into it: the
    // lookup reads both sides, so a stale one-sided link would still move it.
    const kept = current.filter((id) => !inGroup.has(id));
    if (kept.length === current.length) return part;
    return { ...part, boundPartIds: kept.length > 0 ? kept : undefined };
  });
};

/** Release `partId` from every bond it is part of, and its partners from it. */
export const unbindPart = (parts: CharacterPart[], partId: string): CharacterPart[] => {
  return parts.map((part) => {
    if (part.id === partId) {
      return part.boundPartIds?.length ? { ...part, boundPartIds: undefined } : part;
    }
    if (!(part.boundPartIds ?? []).includes(partId)) return part;
    const next = part.boundPartIds!.filter((id) => id !== partId);
    return { ...part, boundPartIds: next.length > 0 ? next : undefined };
  });
};
