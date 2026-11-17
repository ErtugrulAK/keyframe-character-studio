import { useEffect, useRef } from 'react';

/**
 * Closes an open floating menu when a mouse button goes down anywhere outside
 * it (bubble phase, as the timeline's right-click menus always did), or when
 * Escape is pressed. `close` is read at event time, so callers may pass an
 * inline function.
 *
 * Escape is taken in the capture phase and stopped there: the open menu is the
 * one thing that press cancels, so the editor's own Escape chain (deselect,
 * leave a mode) does not also run. One level per Escape.
 */
export const useDismissFloatingMenu = (
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current();
    };
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [menuRef, open]);
};
