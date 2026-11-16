import { useEffect, useRef } from 'react';

/**
 * Closes an open floating menu when a mouse button goes down anywhere outside
 * it (bubble phase, as the timeline's right-click menus always did). `close`
 * is read at event time, so callers may pass an inline function.
 */
export const useCloseOnOutsideMouseDown = (
  menuRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
): void => {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return undefined;
    const handleMouseDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) closeRef.current();
    };
    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [menuRef, open]);
};
