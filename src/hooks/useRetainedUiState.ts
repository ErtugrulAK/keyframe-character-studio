import { useCallback, useLayoutEffect, useState } from 'react';

/**
 * C2-G — panel-local UI state (a collapsed tree row, an open Inspector card,
 * a pane height) that survives its panel being unmounted, e.g. by an
 * Edit → Broadcast → Edit round trip, for the rest of the browser session.
 *
 * It is deliberately NOT scene data, NOT persisted and NOT in history: a
 * module-level memo keyed by a fixed, component-chosen key, read once on mount
 * and written on every change. A reload starts from the defaults again.
 */
const retained = new Map<string, unknown>();

/** A `null` key keeps the state per mount only (plain `useState` semantics). */
export const useRetainedUiState = <T,>(key: string | null, initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void] => {
  const [value, setValue] = useState<T>(() => (
    key !== null && retained.has(key) ? retained.get(key) as T : (typeof initial === 'function' ? (initial as () => T)() : initial)
  ));
  const set = useCallback((next: T | ((previous: T) => T)) => {
    setValue((previous) => {
      const resolved = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
      if (key !== null) retained.set(key, resolved);
      return resolved;
    });
  }, [key]);
  return [value, set];
};

/**
 * C4 — a scroll container's vertical offset, kept the same way (session-only
 * UI memory) without ever re-rendering: written on scroll, restored when the
 * container mounts — before the first paint, and before any layout effect
 * declared AFTER this call in the same component reads the offset (e.g. the
 * row window), so a remounted list opens where the user left it.
 */
export const useRetainedScrollTop = (key: string, ref: React.RefObject<HTMLElement | null>): void => {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const saved = retained.get(key);
    if (typeof saved === 'number' && saved > 0) element.scrollTop = saved;
    const save = () => {
      retained.set(key, element.scrollTop);
    };
    element.addEventListener('scroll', save, { passive: true });
    return () => element.removeEventListener('scroll', save);
  }, [key, ref]);
};

/** Test seam: forget everything (each test starts from the defaults). */
export const resetRetainedUiState = (): void => retained.clear();
