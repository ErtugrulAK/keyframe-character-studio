/**
 * The one KCS visual stacking rule.
 *
 * Ascending `zIndex` paints first, so a higher `zIndex` ends up on top — the
 * rule the editor stage has always used. Painter's-model consumers (the stage,
 * the frame evaluator, the generated OGraf runtime) must all follow it, because
 * the authored array order is NOT the paint order: the outliner keeps index 0 at
 * the top, so `addCustomPart` prepends with `max + 1` and `reorderParts` assigns
 * `zIndex = total - index`. Sorting the array by `zIndex` therefore reverses it.
 *
 * `Array.prototype.sort` is stable per spec, so layers that share a `zIndex`
 * keep their authored order rather than an engine-dependent one.
 */

/** The stacking comparator, for callers that already own a sort. */
export const compareByStackingOrder = (a: { zIndex: number }, b: { zIndex: number }): number => a.zIndex - b.zIndex;

/** A stably stacking-ordered copy; the input is never mutated. */
export const stackingOrder = <T extends { zIndex: number }>(items: readonly T[]): T[] =>
  [...items].sort(compareByStackingOrder);
