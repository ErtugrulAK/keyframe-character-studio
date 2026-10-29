import { useLayoutEffect, useState } from 'react';
import { placeFloatingPanel } from '../utils/floatingPanel';

/**
 * Keeps a menu opened at a pointer position inside the viewport, with the same
 * flip/clamp math as the stage context menu. Returns null until the open menu
 * has been measured, which happens before paint; callers fall back to the
 * pointer position.
 */
export const usePointerMenuPlacement = (
  menuRef: React.RefObject<HTMLElement | null>,
  point: { x: number; y: number } | null,
): { left: number; top: number } | null => {
  const [placement, setPlacement] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!point || !menu) {
      // oxlint-disable-next-line react/set-state-in-effect
      setPlacement(null);
      return;
    }
    const box = menu.getBoundingClientRect();
    const next = placeFloatingPanel(
      { left: point.x, top: point.y, width: 0, height: 0 },
      { width: box.width || menu.offsetWidth, height: box.height || menu.offsetHeight },
      { width: window.innerWidth || 0, height: window.innerHeight || 0 },
      { gap: 0 },
    );
    setPlacement({ left: next.left, top: next.top });
  }, [menuRef, point]);

  return placement;
};
