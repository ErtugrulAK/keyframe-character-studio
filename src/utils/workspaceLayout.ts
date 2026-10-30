import { flushSync } from 'react-dom';

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

/**
 * C2 — sent once by the workspace when it corrected its own OPENING layout
 * (e.g. the timeline clamped to a short or 200 %-zoomed window). The stage
 * re-fits only while the camera is still the untouched opening camera (zoom 1,
 * never panned); any user camera is left exactly as it is.
 */
export const REFIT_UNTOUCHED_CAMERA_COMMAND = 'refit-untouched-camera';

/**
 * C3 — the stage width below which the editor OPENS with the left dock
 * (Project/Media/Elements/Texts) closed, so a narrow or browser-zoomed window
 * starts with a usable stage (Master Review UI spec: canvas target ≥ 400 CSS
 * px). Decided once, at mount; afterwards only the user opens or closes it.
 */
export const MIN_OPENING_STAGE_WIDTH = 400;

const shouldOpenWithLeftDockClosed = (stageWidth: number): boolean => (
  Number.isFinite(stageWidth) && stageWidth > 0 && stageWidth < MIN_OPENING_STAGE_WIDTH
);

/**
 * C11 — phone-width windows, where the docks open over the stage instead of
 * beside it (kcsEditorTheme.css uses the same 600 px breakpoint). Only there
 * does the inspector also open closed: it would cover the stage entirely.
 */
const PHONE_LAYOUT_QUERY = '(max-width: 600px)';

export const isPhoneLayout = (): boolean => (
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia(PHONE_LAYOUT_QUERY).matches
);

/**
 * C11 — closes the docks, left first, while the stage is narrower than
 * MIN_OPENING_STAGE_WIDTH. Used at mount and when the window is made narrower
 * (a phone, a tablet, a browser snapped to half the screen); never on the
 * user's own toggles, so a dock the user reopens stays open. `closers` must
 * re-layout synchronously (`snap` does), so the stage is re-measured between
 * them. Returns whether the stage was narrow at all.
 */
export const closeDocksForNarrowStage = (
  measureStageWidth: () => number,
  closers: ReadonlyArray<() => void>,
): boolean => {
  if (!shouldOpenWithLeftDockClosed(measureStageWidth())) return false;
  for (const close of closers) {
    close();
    if (!shouldOpenWithLeftDockClosed(measureStageWidth())) break;
  }
  return true;
};

export const commitWorkspaceLayout = (apply: () => void): void => {
  flushSync(apply);
  window.dispatchEvent(new CustomEvent(WORKSPACE_LAYOUT_COMMAND_EVENT, { detail: { type: REMEASURE_STAGE_BOX_COMMAND } }));
};

/**
 * How long a docked panel edge takes to travel. C8: 320 ms (was 240, the
 * inspector's former CSS `transition: width 240ms`), with the ease-in-out
 * curve below, so opening and closing read as one soft slide.
 */
export const PANEL_EDGE_TRANSITION_MS = 320;

/**
 * Whether the user asked the system for reduced motion. Eased workspace edges
 * (the side docks and the timeline) then move in one step instead of sliding.
 */
export const prefersReducedMotion = (): boolean => (
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
 * A monotone ease-in-out cubic driven one frame at a time (C8: was ease-out,
 * which started at full speed and read as abrupt; this one starts and lands
 * softly).
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
          const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - ((-2 * progress + 2) ** 3) / 2;
          value = from + (to - from) * eased;
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

/**
 * WP-06 — the Details pane keeps a usable height whenever the right sidebar has
 * room for both panes. The Outliner's stored height used to be bounded only by
 * the WINDOW, so in a 720 px window Details shrank to a sliver beside the
 * timeline. The bound is applied at render time (the stored height is kept)
 * and only when the sidebar can hold both panes; a sidebar squeezed by a
 * maximised timeline keeps the historic layout, so nothing slides under the
 * dock handle.
 */
// C4: 140 (was 160) — on a short window the layer list gets the 20 px; Details stays usable (WP-06: ≥ 120).
const DETAILS_MIN_HEIGHT = 140;
const TWO_PANE_MIN_SIDEBAR_HEIGHT = 280;
const OUTLINER_MIN_HEIGHT = 72;

/*
 * C4 — the window cap that used to be WRITTEN into the stored height
 * (`min(height, max(160, innerHeight − 320))`, which assumed a 320 px
 * timeline and permanently lowered the user's split) is now applied at render
 * time only, and only where the sidebar cannot hold both panes. A sidebar that
 * can is bounded by its own real height.
 */
/**
 * C5 — once the USER has sized the split (drag or keyboard on the divider),
 * their height is honoured up to the sidebar's own height: the Details pane may
 * then shrink to its header (it scrolls), because giving the layer list the
 * room is exactly what the user asked for. The caps above only shape the
 * untouched default.
 */
const DETAILS_HEADER_MIN_HEIGHT = 44;

export const outlinerHeightBounds = (sidebarHeight: number | null): { min: number; max: number } => ({
  min: OUTLINER_MIN_HEIGHT,
  max: sidebarHeight === null ? 650 : Math.max(OUTLINER_MIN_HEIGHT, sidebarHeight - DETAILS_HEADER_MIN_HEIGHT),
});

export const resolveOutlinerHeight = (stored: number, sidebarHeight: number | null, windowHeight?: number, userSized = false): number => {
  if (userSized) {
    const { min, max } = outlinerHeightBounds(sidebarHeight);
    return Math.max(min, Math.min(stored, max));
  }
  if (sidebarHeight !== null && sidebarHeight >= TWO_PANE_MIN_SIDEBAR_HEIGHT) {
    return Math.max(OUTLINER_MIN_HEIGHT, Math.min(stored, sidebarHeight - DETAILS_MIN_HEIGHT));
  }
  return windowHeight === undefined ? stored : Math.min(stored, Math.max(160, windowHeight - 320));
};
