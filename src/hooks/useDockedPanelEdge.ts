import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { PANEL_EDGE_TRANSITION_MS, commitWorkspaceLayout, createFrameEase, type FrameEase } from '../utils/workspaceLayout';

export type DockSide = 'left' | 'right';

export interface DockedPanelEdge {
  /** The panel's target visibility (its class state), flipped on the toggle. */
  visible: boolean;
  /**
   * The panel's inline style while it travels (it is lifted out of the row and
   * slides over the stage); `undefined` at rest, when the stylesheet owns it.
   */
  edgeStyle: CSSProperties | undefined;
  /** Attach to the docked panel element — the box that slides. */
  panelRef: React.RefObject<HTMLElement | null>;
  toggle: () => void;
  /** Sets the visibility at once, without the slide (layout decisions, not user toggles). */
  snap: (visible: boolean) => void;
}

const prefersReducedMotion = (): boolean => (
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

/** The slide offset for a panel that shows `shown` (0..1) of itself, as a CSS transform. */
const slideTransform = (side: DockSide, shown: number): string => (
  `translateX(${(side === 'left' ? -1 : 1) * (1 - shown) * 100}%)`
);

/**
 * Drives a docked panel's show/hide so the authored world never moves AND the
 * stage box changes only once per toggle.
 *
 * C3 — while the panel travels it is lifted out of the workspace row
 * (`position: absolute`) and slides over the stage with a compositor transform
 * written straight to its element each frame: no React render, no layout of the
 * row, no camera work per frame. The stage box therefore changes exactly once,
 * through `commitWorkspaceLayout` (layout and camera compensation in the same
 * task, before paint):
 *   - hiding: at the START, when the panel leaves the row (the stage widens
 *     under the panel that is about to slide away);
 *   - showing: at the END, when the panel re-enters the row (the stage narrows
 *     only once the panel has slid fully in over it).
 * A toggle while the panel travels re-targets from where it is (no jump). The
 * stylesheet keeps owning both resting geometries; at rest no inline style is
 * left behind. Reduced motion snaps.
 */
export const useDockedPanelEdge = (initiallyVisible: boolean, side: DockSide): DockedPanelEdge => {
  const [visible, setVisible] = useState<boolean>(initiallyVisible);
  /** The width the panel keeps while it slides out (its class width is 0 by then); null = its own width. */
  const [travel, setTravel] = useState<{ width: number | null } | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const easeRef = useRef<FrameEase | null>(null);
  /** How much of the panel is on screen right now (0..1), while it travels. */
  const shownRef = useRef<number>(initiallyVisible ? 1 : 0);
  const visibleRef = useRef(visible);
  // oxlint-disable-next-line react/refs
  visibleRef.current = visible;

  // The slide transform is owned HERE, imperatively, never by React's style
  // prop: a re-render during the slide therefore cannot reset it, and at rest it
  // is removed so the stylesheet's own transform applies again.
  const writeShown = useCallback((shown: number) => {
    shownRef.current = shown;
    const panel = panelRef.current;
    if (panel) panel.style.transform = slideTransform(side, shown);
  }, [side]);
  const clearShown = useCallback((shown: number) => {
    shownRef.current = shown;
    const panel = panelRef.current;
    if (panel) panel.style.transform = '';
  }, []);

  const toggle = useCallback(() => {
    const panel = panelRef.current;
    const next = !visibleRef.current;
    if (!panel || prefersReducedMotion()) {
      easeRef.current?.cancel();
      commitWorkspaceLayout(() => {
        setTravel(null);
        setVisible(next);
      });
      clearShown(next ? 1 : 0);
      return;
    }
    const ease = easeRef.current ?? (easeRef.current = createFrameEase(
      (shown) => writeShown(shown),
      (shown) => {
        // Back into the row: for a panel that came in, THIS is the one stage-box change.
        commitWorkspaceLayout(() => setTravel(null));
        clearShown(shown);
      },
    ));
    const travelling = ease.isRunning();
    const from = travelling ? shownRef.current : (next ? 0 : 1);
    ease.cancel();
    // The width it slides with: a panel going away keeps the width it has now.
    const width = next ? null : panel.getBoundingClientRect().width;
    // Lift it out of the row and flip the target class in ONE commit; for a
    // panel going away this is the one stage-box change (folded into the camera).
    commitWorkspaceLayout(() => {
      setVisible(next);
      setTravel({ width });
    });
    // A panel coming in slides at the width its class now resolves to — pinned
    // inline, so the travel is observable as "not yet at rest" until it settles.
    if (width === null) {
      const openWidth = panel.getBoundingClientRect().width;
      flushSync(() => setTravel({ width: openWidth }));
    }
    writeShown(from);
    ease.start(from, next ? 1 : 0, PANEL_EDGE_TRANSITION_MS * Math.max(0.25, Math.abs((next ? 1 : 0) - from)));
  }, [clearShown, writeShown]);

  const snap = useCallback((next: boolean) => {
    easeRef.current?.cancel();
    if (visibleRef.current === next) return;
    commitWorkspaceLayout(() => {
      setTravel(null);
      setVisible(next);
    });
    clearShown(next ? 1 : 0);
  }, [clearShown]);

  useEffect(() => () => easeRef.current?.cancel(), []);

  const edgeStyle: CSSProperties | undefined = travel === null ? undefined : {
    position: 'absolute',
    top: 0,
    bottom: 0,
    [side]: 0,
    ...(travel.width !== null ? { width: `${travel.width}px`, minWidth: `${travel.width}px` } : {}),
    flexBasis: 'auto',
    // (the slide transform itself is written by `writeShown`, see above)
    // Its own compositor layer while it slides: the stage under it is not
    // repainted for every frame of the slide.
    willChange: 'transform',
    // The resting classes' own fade/offset must not run under the slide.
    opacity: 1,
    visibility: 'visible',
    transition: 'none',
    // Above the stage it slides over, below the dock handles and chrome overlays.
    zIndex: 6,
  };

  return { visible, edgeStyle, panelRef, toggle, snap };
};
