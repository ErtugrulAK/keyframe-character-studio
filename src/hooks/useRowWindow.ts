import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ROW_WINDOW_MIN_ROWS,
  fullRowWindow,
  planRowWindow,
  rowOffsets,
  rowWindowRange,
  type RowWindowRange,
  type RowWindowSegment,
} from '../utils/rowWindow';

export interface RowViewport {
  /** Top of the visible area, in the row content's own coordinates. */
  top: number;
  height: number;
}

interface UseRowWindowOptions {
  count: number;
  /** Height of row i in px; its identity is the cache key of the row offsets. */
  heightAt: (index: number) => number;
  /** Rows that stay mounted wherever they are (focused, renamed, dragged…). */
  pinned: readonly number[];
  /** The element whose scrolling moves the rows. */
  scrollRef: React.RefObject<HTMLElement | null>;
  /** The visible area of the rows, read from the scroll element. */
  viewportOf: (scrollElement: HTMLElement) => RowViewport;
}

export interface RowWindow {
  /** False for a short list: every row is mounted. */
  windowed: boolean;
  segments: RowWindowSegment[];
}

const sameRange = (a: RowWindowRange, b: RowWindowRange): boolean => a.start === b.start && a.end === b.end;

/**
 * Mounts only the rows of a long list that are in (or near) its scroll
 * viewport, plus the pinned rows — see `utils/rowWindow`. The viewport is read
 * on scroll and on resize, but the list re-renders only when the set of rows
 * to mount changes, never for every scrolled pixel.
 */
export const useRowWindow = ({ count, heightAt, pinned, scrollRef, viewportOf }: UseRowWindowOptions): RowWindow => {
  const windowed = count >= ROW_WINDOW_MIN_ROWS;
  const offsets = useMemo(() => (windowed ? rowOffsets(count, heightAt) : []), [windowed, count, heightAt]);
  // Before the first measurement: the top of the list and its overscan only.
  // The real viewport is read before the first paint (layout effect below) and
  // ADDS what it shows, so a mount never builds rows it then throws away.
  const [viewport, setViewport] = useState<RowViewport>({ top: 0, height: 0 });
  const range = useMemo(() => (windowed ? rowWindowRange(offsets, viewport.top, viewport.height) : { start: 0, end: count }), [windowed, offsets, viewport, count]);

  const latest = useRef({ offsets, range, viewportOf });
  useLayoutEffect(() => {
    latest.current = { offsets, range, viewportOf };
  });

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!windowed || !element) return undefined;
    const changedViewport = (): RowViewport | null => {
      const next = latest.current.viewportOf(element);
      const nextRange = rowWindowRange(latest.current.offsets, next.top, next.height);
      return sameRange(nextRange, latest.current.range) ? null : next;
    };
    const initial = changedViewport();
    if (initial) setViewport(initial);
    // A scroll that brings new rows into view mounts them in the SAME frame
    // (synchronously, before the browser paints the scrolled list), so a fast
    // scroll never shows an empty spacer.
    const handleScroll = () => {
      const next = changedViewport();
      if (next) flushSync(() => setViewport(next));
    };
    const handleResize = () => {
      const next = changedViewport();
      if (next) setViewport(next);
    };
    element.addEventListener('scroll', handleScroll, { passive: true });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(handleResize) : null;
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', handleScroll);
      observer?.disconnect();
    };
  }, [windowed, scrollRef]);

  // Offsets change (rows added, removed, resized): re-check the window against
  // the CURRENT scroll position, which may itself have been clamped.
  useEffect(() => {
    const element = scrollRef.current;
    if (!windowed || !element) return;
    const next = viewportOf(element);
    const nextRange = rowWindowRange(offsets, next.top, next.height);
    if (!sameRange(nextRange, range)) setViewport(next);
    // `range`/`viewportOf` are read for comparison only.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [windowed, offsets, scrollRef]);

  const segments = useMemo(
    () => (windowed ? planRowWindow(offsets, range, pinned) : fullRowWindow(count)),
    [windowed, offsets, range, pinned, count],
  );
  return { windowed, segments };
};
