import type { CharacterPart } from '../types/animator';

/**
 * WP-05 — the DISPLAY ordinal of every authored layer: its 1-based position in
 * the full layer list, top to bottom, exactly as the Outliner tree lays it out
 * (authored array order, each container followed depth-first by its children —
 * a group's children and a Boolean group's operands).
 *
 * It is a derived, transient view value: never written to a part, never used
 * as a reference, and never reused as an identity. Deleting a layer simply
 * renumbers the rest (A B C D E → delete C → 1 2 3 4); collapsing or filtering
 * a row does not change any number, because the rank is taken over the whole
 * authored list. zIndex gaps never create phantom rows, and IDs / zIndex are
 * left exactly as they are.
 */
export const projectLayerOrdinals = (parts: readonly CharacterPart[]): Map<string, number> => {
  const ids = new Set(parts.map((part) => part.id));
  const parentOf = (part: CharacterPart): string | undefined => {
    const parentId = part.parentId ?? part.booleanGroupId;
    return parentId && ids.has(parentId) && parentId !== part.id ? parentId : undefined;
  };
  const children = new Map<string, CharacterPart[]>();
  const roots: CharacterPart[] = [];
  for (const part of parts) {
    const parentId = parentOf(part);
    if (!parentId) {
      roots.push(part);
      continue;
    }
    const siblings = children.get(parentId) ?? [];
    siblings.push(part);
    children.set(parentId, siblings);
  }

  const ordinals = new Map<string, number>();
  const visit = (part: CharacterPart) => {
    // A malformed parent cycle can never loop or number a layer twice.
    if (ordinals.has(part.id)) return;
    ordinals.set(part.id, ordinals.size + 1);
    for (const child of children.get(part.id) ?? []) visit(child);
  };
  roots.forEach(visit);
  // Layers only reachable through a parent cycle still get a number, in authored order.
  parts.forEach(visit);
  return ordinals;
};
