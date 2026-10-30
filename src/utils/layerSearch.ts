import type { CharacterPart } from '../types/animator';
import { relationshipAncestorIds } from './partBinding';

/**
 * C5 — "find a layer" in a large scene.
 *
 * The layer list mounts only the rows near its viewport (C4 row windowing), so
 * the browser's own find (Ctrl+F) cannot reach a row that is scrolled away. The
 * search therefore runs on the scene DATA: every layer whose name contains the
 * query (case- and accent-insensitive) matches, and its ancestors are kept so
 * each match is shown in its place in the hierarchy.
 */
interface LayerSearchResult {
  /** Layers whose name matches, in layer order. */
  matchIds: string[];
  /** Matches plus every ancestor of a match: the rows the filtered tree shows. */
  shownIds: Set<string>;
}

const fold = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase();

const normalizeLayerQuery = (query: string): string => fold(query.trim());

export const searchLayers = (parts: CharacterPart[], query: string): LayerSearchResult | null => {
  const needle = normalizeLayerQuery(query);
  if (!needle) return null;
  const matchIds = parts.filter((part) => fold(part.name || part.id).includes(needle)).map((part) => part.id);
  const shownIds = new Set<string>(matchIds);
  matchIds.forEach((id) => relationshipAncestorIds(parts, id).forEach((ancestor) => shownIds.add(ancestor)));
  return { matchIds, shownIds };
};
