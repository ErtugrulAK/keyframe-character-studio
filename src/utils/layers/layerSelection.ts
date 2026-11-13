/**
 * Selecting every layer — one implementation for the editor's Select All.
 *
 * The context menu's Select All row and the `Ctrl/Cmd+A` command both come
 * through here, so the two can never disagree about what "all" means or about
 * which layer ends up primary. The layer array's own order decides the primary
 * layer (its last member), exactly as the outliner presents it.
 *
 * "all" is everything the canvas can pick: locked layers (`lockedIds`)
 * are left out, as After Effects leaves locked layers out of a selection.
 */
interface LayerSelectionSetters {
  setSelectedPartIds: (ids: string[]) => void;
  setSelectedPartId: (id: string | null) => void;
}

export const selectAllLayers = (
  parts: readonly { id: string }[],
  { setSelectedPartIds, setSelectedPartId }: LayerSelectionSetters,
  lockedIds: ReadonlySet<string> = new Set(),
): string[] => {
  const ids = parts.map((part) => part.id).filter((id) => !lockedIds.has(id));
  setSelectedPartIds(ids);
  setSelectedPartId(ids.length > 0 ? ids[ids.length - 1] : null);
  return ids;
};
