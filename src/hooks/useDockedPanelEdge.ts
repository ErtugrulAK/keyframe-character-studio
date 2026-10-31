import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { PANEL_EDGE_TRANSITION_MS, commitWorkspaceLayout, createFrameEase, prefersReducedMotion, type FrameEase } from '../utils/workspaceLayout';

type DockSide = 'left' | 'right';

interface DockedPanelEdge {
  /** The panel's target visibility (its class state), flipped on the toggle. */
  visible: boolean;
  /**
   * The panel's inline style while it travels (it is lifted out of the row and
   * slides over the stage); `undefined` at rest, when the stylesheet owns it.
   */
  edgeStyle: CSSProperties | undefined;
  /** Attach to the docked panel element — the box that slides. */
  panelRef: React.RefObject<HTMLElement | null>;
  /** Attach to the panel's edge handle: it rides the sliding edge frame by frame. */
  handleRef: React.RefObject<HTMLElement | null>;
  toggle: () => void;
  /** Sets the visibility at once, without the slide (layout decisions, not user toggles). */
  snap: (visible: boolean) => void;
}

/** The slide offset for a panel that shows `shown` (0..1) of itself, as a CSS transform. */
const slideTransform = (side: DockSide, shown: number): string => (
  `translateX(${(side === 'left' ? -1 : 1) * (1 - shown) * 100}%)`
);

/** The edge handle's resting inset from its side: centred on an open edge, flush when closed. */
const HANDLE_HALF_WIDTH = 10;
const handleInset = (width: number, shown: number): number => shown * Math.max(0, width - HANDLE_HALF_WIDTH);

/**
 * How much of the stage the travelling panel covers right now, as a CSS
 * variable on the editor shell. Chrome pinned to a stage edge (the coordinate
 * readout, the edit-target strip) offsets by it, so it rides the sliding panel
 * edge instead of jumping when the stage box changes once at the start (hide)
 * or the end (show) of the slide.
 */
const overlapVariable = (side: DockSide): string => `--kcs-dock-${side}-overlap`;

/**
 * Drives a docked panel's show/hide so the authored world never moves AND the
 * stage box changes only once per toggle.
 *
 * While the panel travels it is lifted out of the workspace row
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
  const handleRef = useRef<HTMLElement | null>(null);
  /** The panel width of the slide in flight, and the state it slides to. */
  const travelWidthRef = useRef<number>(0);
  const travelTargetRef = useRef<boolean>(initiallyVisible);
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
    panel?.closest<HTMLElement>('.app-container')?.style.setProperty(overlapVariable(side), `${shown * travelWidthRef.current}px`);
    // The handle's stylesheet position is already the TARGET state's (the
    // class flips when the slide starts); this offset keeps it on the moving
    // edge until the slide settles, instead of a separate CSS transition that
    // lagged behind the panel and nudged it after the panel had stopped.
    const handle = handleRef.current;
    if (handle) {
      const width = travelWidthRef.current;
      const offset = handleInset(width, shown) - handleInset(width, travelTargetRef.current ? 1 : 0);
      handle.style.transform = `translateX(${(side === 'left' ? 1 : -1) * offset}px)`;
    }
  }, [side]);
  const clearShown = useCallback((shown: number) => {
    shownRef.current = shown;
    const panel = panelRef.current;
    if (panel) panel.style.transform = '';
    // At rest the panel is in the row again: it covers none of the stage.
    panel?.closest<HTMLElement>('.app-container')?.style.removeProperty(overlapVariable(side));
    if (handleRef.current) handleRef.current.style.transform = '';
  }, [side]);

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
    travelTargetRef.current = next;
    if (width !== null) travelWidthRef.current = width;
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
      travelWidthRef.current = openWidth;
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

  return { visible, edgeStyle, panelRef, handleRef, toggle, snap };
};
