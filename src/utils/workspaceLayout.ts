import { flushSync } from 'react-dom';
import type { CSSProperties } from 'react';

/**
 * THE workspace layout authority.
 *
 * Every chrome geometry change in the editor (the timeline workspace, the docked
 * panels) goes through `commitWorkspaceLayout`. It exists because the stage
 * camera is a *projection* of the stage box: the SVG's translate is
 * `camera centre - stage box centre`, so a box that the DOM has already changed
 * but the camera has not yet been told about paints the authored world against a
 * box it no longer has. That one frame is a real, visible counter-move of the
 * scene, and it is exactly what a browser-side `transition: width` on a panel
 * produces, because the panel's own layout animation runs inside the frame's
 * style/layout step while the stage can only learn about the new box from a
 * ResizeObserver notification — which Chromium is free to deliver a frame late
 * (it reports the box it gathered, not the box that is about to be painted).
 *
 * `commitWorkspaceLayout` closes that window by construction: the size write is
 * flushed synchronously, then the stage re-measures the box it now has and folds
 * it into the camera in the SAME task. A caller that runs inside an animation
 * frame therefore commits geometry and compensation before that frame paints.
 *
 * The ResizeObserver on the stage container stays as the measurement fallback
 * for every layout change that is not driven from here (window resizes, the left
 * toolbar, mode switches) — never as the timing authority for an animation.
 */
export const WORKSPACE_LAYOUT_COMMAND_EVENT = 'canvas-viewport-command';

/** Command payload that makes the stage re-measure and re-fold its box. */
export const REMEASURE_STAGE_BOX_COMMAND = 'remeasure-stage-box';

export const commitWorkspaceLayout = (apply: () => void): void => {
  flushSync(apply);
  window.dispatchEvent(new CustomEvent(WORKSPACE_LAYOUT_COMMAND_EVENT, { detail: { type: REMEASURE_STAGE_BOX_COMMAND } }));
};

/**
 * How long a docked panel edge takes to travel. Mirrors the browser-side
 * duration this replaces (the inspector's former `transition: width 240ms`) so
 * opening and closing read exactly as they always did.
 */
export const PANEL_EDGE_TRANSITION_MS = 240;

/**
 * How an eased docked edge is expressed while it travels: all three properties
 * the row reads for the panel's main size, in border-box pixels. Both docked
 * panels write their travelling width through this, so their geometry can never
 * be described two slightly different ways. `null` means at rest — the
 * stylesheet owns the width again, including the clamp it resolves it with.
 */
export const panelEdgeStyle = (width: number | null): CSSProperties | undefined => (
  width === null ? undefined : { width: `${width}px`, minWidth: `${width}px`, flexBasis: `${width}px` }
);

export interface FrameEase {
  /**
   * Eases to `to` from `from`, cancelling any in-flight run. Re-targeting from
   * the value the running frame last wrote is what makes a rapid toggle
   * continuous: no jump, no second animation racing the first.
   */
  start(from: number, to: number, durationMs: number): void;
  cancel(): void;
  /** The value the last frame wrote, or null while the ease is at rest. */
  current(): number | null;
  isRunning(): boolean;
}

/**
 * A monotone ease-out cubic driven one frame at a time.
 *
 * `write` is called once per animation frame with the value for that frame, so
 * an app can commit the value through `commitWorkspaceLayout` and have layout and
 * camera land together. `settle` runs once with the exact final value, which is
 * never off by a frame of rounding. The curve is monotone, so an eased edge never
 * overshoots and never counter-moves.
 */
export const createFrameEase = (
  write: (value: number) => void,
  settle: (finalValue: number) => void,
): FrameEase => {
  let frame: number | null = null;
  let value: number | null = null;
  const stop = (): void => {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  };
  return {
    current: () => value,
    isRunning: () => frame !== null,
    cancel: stop,
    start: (from, to, durationMs) => {
      stop();
      if (from === to) {
        value = null;
        settle(to);
        return;
      }
      value = from;
      let startedAt: number | null = null;
      const step = (now: number): void => {
        startedAt = startedAt ?? now;
        const progress = Math.min(1, (now - startedAt) / durationMs);
        if (progress < 1) {
          value = from + (to - from) * (1 - (1 - progress) ** 3);
          write(value);
          frame = requestAnimationFrame(step);
          return;
        }
        value = null;
        frame = null;
        settle(to);
      };
      frame = requestAnimationFrame(step);
    },
  };
};
