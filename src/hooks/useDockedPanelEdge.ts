import { useCallback, useEffect, useRef, useState } from 'react';
import { PANEL_EDGE_TRANSITION_MS, commitWorkspaceLayout, createFrameEase, type FrameEase } from '../utils/workspaceLayout';

export interface DockedPanelEdge {
  /** The panel's target visibility (its class state), flipped on the toggle. */
  visible: boolean;
  /**
   * The panel's width, in border-box pixels, while its edge is travelling;
   * `null` at rest, when the stylesheet owns the width again.
   */
  edgeWidth: number | null;
  /** Attach to the docked panel element — the box whose edge is animated. */
  panelRef: React.RefObject<HTMLElement | null>;
  toggle: () => void;
}

const prefersReducedMotion = (): boolean => (
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

/**
 * Drives a docked panel's width, so its edge eases without ever moving the
 * authored world.
 *
 * A browser-side `transition: width` animates the panel inside the frame's own
 * style/layout step, which leaves the stage's camera compensation to an
 * asynchronous ResizeObserver notification — one painted frame of new geometry
 * with old compensation, i.e. a visible counter-move of the scene. This hook
 * instead eases the edge itself and commits every frame through
 * `commitWorkspaceLayout`, so the width and the camera fold into the same task,
 * inside the frame's callback, before anything is painted.
 *
 * The stylesheet keeps owning both resting widths (docked and collapsed): the
 * hook only writes an inline width while the edge travels, and hands it back on
 * the exact final frame, so the resting width can never be a rounded copy of a
 * CSS expression. The ResizeObserver stays the measurement fallback.
 */
export const useDockedPanelEdge = (initiallyVisible: boolean): DockedPanelEdge => {
  const [visible, setVisible] = useState<boolean>(initiallyVisible);
  const [edgeWidth, setEdgeWidth] = useState<number | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const easeRef = useRef<FrameEase | null>(null);
  const visibleRef = useRef(visible);
  // oxlint-disable-next-line react/refs
  visibleRef.current = visible;

  const toggle = useCallback(() => {
    const panel = panelRef.current;
    const next = !visibleRef.current;
    // Reduced motion (and any environment without the media query, as in jsdom)
    // snaps to the target: the stylesheet's own `transition: none` contract.
    if (!panel || prefersReducedMotion()) {
      easeRef.current?.cancel();
      commitWorkspaceLayout(() => {
        setEdgeWidth(null);
        setVisible(next);
      });
      return;
    }
    const ease = easeRef.current ?? (easeRef.current = createFrameEase(
      (width) => commitWorkspaceLayout(() => setEdgeWidth(width)),
      () => commitWorkspaceLayout(() => setEdgeWidth(null)),
    ));
    // The width the panel has RIGHT NOW: the in-flight interpolated width while
    // the edge is still travelling, otherwise the resting width the stylesheet
    // resolved. Measured before the target class flips, because that flip is what
    // moves the edge.
    const from = ease.current() ?? panel.getBoundingClientRect().width;
    ease.cancel();
    // Hand the width back to the stylesheet and flip the target class in ONE
    // task — the commit also folds the box the class resolves to into the camera.
    commitWorkspaceLayout(() => {
      setEdgeWidth(null);
      setVisible(next);
    });
    // The width that class resolves to, read from the layout that commit
    // produced. Never re-derived from the CSS expression here: the stylesheet
    // remains the single source of both resting widths.
    const to = panel.getBoundingClientRect().width;
    ease.start(from, to, PANEL_EDGE_TRANSITION_MS);
  }, []);

  useEffect(() => () => easeRef.current?.cancel(), []);

  return { visible, edgeWidth, panelRef, toggle };
};
