/**
 * Row windowing for long editor lists (the Inspector layer tree, the timeline
 * layer list and its lanes).
 *
 * A list with many rows mounts only the rows inside its scroll viewport (plus
 * an overscan margin) and any PINNED rows — the focused, renamed, dragged or
 * selected ones, which must stay in the DOM so focus, text entry and gestures
 * never lose their element. Every run of rows that is not mounted becomes one
 * spacer of exactly their height, so the scroll height, the scrollbar and the
 * position of every mounted row are the same as with the full list.
 *
 * Short lists are never windowed (`ROW_WINDOW_MIN_ROWS`): below it the whole
 * list is cheap to mount and stays fully in the DOM.
 */

/** Lists with at least this many rows are windowed. */
export const ROW_WINDOW_MIN_ROWS = 60;
/** Rows within this distance (px) above and below the viewport stay mounted. */
const ROW_WINDOW_OVERSCAN_PX = 240;

export type RowWindowSegment =
  | { kind: 'rows'; start: number; end: number }
  | { kind: 'gap'; start: number; end: number; height: number };

export interface RowWindowRange {
  /** First mounted row of the viewport window (inclusive). */
  start: number;
  /** Last mounted row of the viewport window (exclusive). */
  end: number;
}

/** Running offsets: `offsets[i]` is the top of row i, `offsets[count]` the total height. */
export const rowOffsets = (count: number, heightAt: (index: number) => number): number[] => {
  const offsets = new Array<number>(count + 1);
  offsets[0] = 0;
  for (let index = 0; index < count; index += 1) {
    const height = heightAt(index);
    offsets[index + 1] = offsets[index] + (Number.isFinite(height) && height > 0 ? height : 0);
  }
  return offsets;
};

/** The last index whose offset is <= y (0 when y is above the list). */
const rowAt = (offsets: number[], y: number): number => {
  let low = 0;
  let high = offsets.length - 2;
  if (high < 0) return 0;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (offsets[middle] <= y) low = middle;
    else high = middle - 1;
  }
  return low;
};

/** The rows that intersect [top - overscan, top + height + overscan]. */
export const rowWindowRange = (
  offsets: number[],
  viewportTop: number,
  viewportHeight: number,
  overscanPx: number = ROW_WINDOW_OVERSCAN_PX,
): RowWindowRange => {
  const count = offsets.length - 1;
  if (count <= 0) return { start: 0, end: 0 };
  const top = Math.max(0, viewportTop - overscanPx);
  const bottom = Math.max(top, viewportTop + Math.max(0, viewportHeight) + overscanPx);
  const start = rowAt(offsets, top);
  const end = Math.min(count, rowAt(offsets, bottom) + 1);
  return { start, end: Math.max(start, end) };
};

/**
 * The segments to render: the window range plus every pinned row, in list
 * order, with one spacer per unmounted run.
 */
export const planRowWindow = (offsets: number[], range: RowWindowRange, pinned: readonly number[]): RowWindowSegment[] => {
  const count = offsets.length - 1;
  if (count <= 0) return [];
  const mounted = new Set<number>();
  for (let index = Math.max(0, range.start); index < Math.min(count, range.end); index += 1) mounted.add(index);
  pinned.forEach((index) => {
    if (Number.isInteger(index) && index >= 0 && index < count) mounted.add(index);
  });
  const segments: RowWindowSegment[] = [];
  let cursor = 0;
  const sorted = [...mounted].sort((a, b) => a - b);
  let runStart = -1;
  let runEnd = -1;
  const flushRun = () => {
    if (runStart < 0) return;
    segments.push({ kind: 'rows', start: runStart, end: runEnd });
    cursor = runEnd;
    runStart = -1;
  };
  for (const index of sorted) {
    if (runStart >= 0 && index === runEnd) {
      runEnd += 1;
      continue;
    }
    flushRun();
    if (index > cursor) segments.push({ kind: 'gap', start: cursor, end: index, height: offsets[index] - offsets[cursor] });
    runStart = index;
    runEnd = index + 1;
  }
  flushRun();
  if (cursor < count) segments.push({ kind: 'gap', start: cursor, end: count, height: offsets[count] - offsets[cursor] });
  return segments;
};

/** The whole list as one run (an unwindowed list). */
export const fullRowWindow = (count: number): RowWindowSegment[] => (count > 0 ? [{ kind: 'rows', start: 0, end: count }] : []);
