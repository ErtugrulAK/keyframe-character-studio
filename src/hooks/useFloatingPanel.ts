import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { placeFloatingPanel, type FloatingPanelPlacement, type PanelAnchorRect } from '../utils/floatingPanel';

interface UseFloatingPanelOptions {
  isOpen: boolean;
  /**
   * Closes the panel (outside press, or the caller's own Escape handling). The
   * press target is supplied for an outside press so the caller can decide
   * whether the dismissal should reclaim focus.
   */
  onClose: (pressTarget?: EventTarget | null) => void;
  /** Element the panel hangs off (Inspector swatch). */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** Pointer position the panel hangs off (context menu); wins over `anchorRef`. */
  point?: { x: number; y: number } | null;
  align?: 'start' | 'end';
  /** Where the panel prefers to open; it still clamps inside the viewport. */
  side?: 'below' | 'left';
  gap?: number;
}

interface UseFloatingPanelResult {
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** Null only until the first measurement, which happens before paint. */
  placement: FloatingPanelPlacement | null;
}

/**
 * Anchors a floating authoring panel (color popover, context menu) to an element
 * or a pointer position, keeps it inside the viewport, and closes it when the
 * user presses outside it.
 *
 * The panel owns no document state: opening it writes nothing to the project.
 */
export const useFloatingPanel = ({
  isOpen,
  onClose,
  anchorRef,
  point,
  align = 'start',
  side,
  gap,
}: UseFloatingPanelOptions): UseFloatingPanelResult => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<FloatingPanelPlacement | null>(null);
  const pointX = point?.x ?? null;
  const pointY = point?.y ?? null;

  const reposition = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    let anchor: PanelAnchorRect | null = null;
    if (pointX !== null && pointY !== null) {
      // A pointer position is a zero-size anchor rectangle.
      anchor = { left: pointX, top: pointY, width: 0, height: 0 };
    } else if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      anchor = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }
    if (!anchor) return;
    const measured = panel.getBoundingClientRect();
    const next = placeFloatingPanel(
      anchor,
      { width: measured.width || panel.offsetWidth, height: measured.height || panel.offsetHeight },
      { width: window.innerWidth || 0, height: window.innerHeight || 0 },
      { align, side, gap },
    );
    setPlacement((current) => (
      current && current.left === next.left && current.top === next.top && current.flipped === next.flipped
        ? current
        : next
    ));
  }, [align, anchorRef, gap, pointX, pointY, side]);

  // Measure and place in the same frame the panel mounts, so it never paints at
  // its fallback position. `set-state-in-effect` is the point here: the placement
  // is derived from the committed DOM box.
  useLayoutEffect(() => {
    if (!isOpen) {
      // oxlint-disable-next-line react/set-state-in-effect
      setPlacement(null);
      return;
    }
    reposition();
  }, [isOpen, reposition]);

  useEffect(() => {
    if (!isOpen) return;
    const handle = () => reposition();
    window.addEventListener('resize', handle);
    // Capture phase: the Inspector and the timeline both scroll their own panes.
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [isOpen, reposition]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose(event.target);
    };
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [anchorRef, isOpen, onClose]);

  return { panelRef, placement };
};
