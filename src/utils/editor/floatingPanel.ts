/**
 * Placement math for the authoring chrome that has to float over the editor:
 * the color picker popover and the stage/layer context menu.
 *
 * Kept pure so the flip/clamp contract is unit-testable without a browser: the
 * panel stays inside the viewport, opens downward by default and flips above the
 * anchor when the space below is too small.
 */
export interface PanelAnchorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PanelSize {
  width: number;
  height: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

export interface FloatingPanelPlacement {
  left: number;
  top: number;
  /** True when the panel opened upwards because the space below the anchor was too small. */
  flipped: boolean;
}

/** Space between the anchor and the panel, and the smallest allowed viewport inset. */
const FLOATING_PANEL_GAP = 6;
const FLOATING_PANEL_MARGIN = 8;

/** Positions a panel along one axis, keeping it inside the viewport when it fits. */
const clampAxis = (preferred: number, panelExtent: number, viewportExtent: number): number => {
  const maximum = viewportExtent - panelExtent - FLOATING_PANEL_MARGIN;
  if (maximum < FLOATING_PANEL_MARGIN) return FLOATING_PANEL_MARGIN;
  return Math.min(Math.max(preferred, FLOATING_PANEL_MARGIN), maximum);
};

/**
 * Places a floating panel against an anchor rectangle.
 *
 * `side: 'left'` prefers the space beside the anchor — the Inspector swatches sit
 * on the right edge, so their popover floats over the canvas instead of covering
 * the neighbouring controls. `align: 'end'` right-aligns the panel with the
 * anchor.
 */
export const placeFloatingPanel = (
  anchor: PanelAnchorRect,
  panel: PanelSize,
  viewport: ViewportSize,
  options: { gap?: number; align?: 'start' | 'end'; side?: 'below' | 'left' } = {},
): FloatingPanelPlacement => {
  const gap = options.gap ?? FLOATING_PANEL_GAP;

  if (options.side === 'left') {
    const besideLeft = anchor.left - gap - panel.width;
    if (besideLeft >= FLOATING_PANEL_MARGIN) {
      return { left: besideLeft, top: clampAxis(anchor.top, panel.height, viewport.height), flipped: false };
    }
  }

  const preferredLeft = options.align === 'end' ? anchor.left + anchor.width - panel.width : anchor.left;
  const left = clampAxis(preferredLeft, panel.width, viewport.width);

  const below = anchor.top + anchor.height + gap;
  const above = anchor.top - gap - panel.height;
  const fitsBelow = below + panel.height + FLOATING_PANEL_MARGIN <= viewport.height;
  const fitsAbove = above >= FLOATING_PANEL_MARGIN;

  if (!fitsBelow && fitsAbove) {
    return { left, top: above, flipped: true };
  }
  return { left, top: clampAxis(below, panel.height, viewport.height), flipped: false };
};
