import type { CharacterPart } from '../../types/animator';
import { relationshipParentId } from './partBinding';

/**
 * The tracks in the order the Layers panel shows their layers: each layer in
 * stacking order, its children right under it (depth first). Tracks whose
 * layer is missing keep their place at the end. The depth tells the timeline
 * how far to indent a row.
 */
export const orderTracksByLayerTree = <T extends { partId: string }>(
  parts: CharacterPart[],
  tracks: T[],
): { ordered: T[]; depth: Map<string, number> } => {
  const partById = new Map(parts.map((part) => [part.id, part]));
  const trackByPart = new Map(tracks.map((track) => [track.partId, track]));
  const childrenOf = new Map<string, CharacterPart[]>();
  const roots: CharacterPart[] = [];
  for (const part of parts) {
    const parentId = relationshipParentId(part);
    if (parentId && partById.has(parentId)) {
      const siblings = childrenOf.get(parentId) ?? [];
      siblings.push(part);
      childrenOf.set(parentId, siblings);
    } else roots.push(part);
  }
  const ordered: T[] = [];
  const depth = new Map<string, number>();
  const seen = new Set<string>();
  const visit = (part: CharacterPart, level: number) => {
    if (seen.has(part.id)) return;
    seen.add(part.id);
    const track = trackByPart.get(part.id);
    if (track) {
      ordered.push(track);
      depth.set(part.id, level);
    }
    (childrenOf.get(part.id) ?? []).forEach((child) => visit(child, level + 1));
  };
  roots.forEach((part) => visit(part, 0));
  // A cycle or a track without a layer: still listed, at the top level.
  for (const track of tracks) {
    if (!depth.has(track.partId)) {
      ordered.push(track);
      depth.set(track.partId, 0);
    }
  }
  return { ordered, depth };
};
