import type { TrackChannel } from '../../types/animator';

// Visual metadata for each Transform channel
export const CHANNEL_META: Record<TrackChannel, { label: string; color: string; shortLabel: string }> = {
  x:            { label: 'Location X',  shortLabel: 'X',   color: '#ef4444' },
  y:            { label: 'Location Y',  shortLabel: 'Y',   color: '#22c55e' },
  rotation:     { label: 'Rotation',    shortLabel: 'R°',  color: '#3b82f6' },
  scaleX:       { label: 'Scale X',     shortLabel: 'SX',  color: '#a855f7' },
  scaleY:       { label: 'Scale Y',     shortLabel: 'SY',  color: '#ec4899' },
  opacity:      { label: 'Opacity',     shortLabel: 'Op',  color: '#f59e0b' },
  maskOffsetX:  { label: 'Mask X',      shortLabel: 'MX',  color: '#14b8a6' },
  maskOffsetY:  { label: 'Mask Y',      shortLabel: 'MY',  color: '#06b6d4' },
  maskScale:    { label: 'Mask Scale',   shortLabel: 'MS',  color: '#8b5cf6' },
  maskRotation: { label: 'Mask Rot',     shortLabel: 'MR°', color: '#f97316' },
  trimPathStart: { label: 'Trim Start', shortLabel: 'TS', color: '#22d3ee' },
  trimPathEnd: { label: 'Trim End', shortLabel: 'TE', color: '#2dd4bf' },
  trimPathOffset: { label: 'Trim Offset', shortLabel: 'TO°', color: '#a78bfa' },
};

export const TRACK_ROW_HEIGHT = 30;   // parent track row
export const CHANNEL_ROW_HEIGHT = 24; // sub-channel row

/**
 * A press on a keyframe diamond that travels less than this is a click, not a
 * drag (the same rule the marquee uses). The press is armed on the way down and
 * only becomes a moving gesture once the pointer crosses it, so a click never
 * opens a history transaction.
 */
export const KEYFRAME_DRAG_THRESHOLD_PX = 3;

/**
 * R4-08 — the clearance between a keyframe glyph and the interpolation connector
 * that runs into it. The glyph is an 8px box rotated 45° (≈11.3px across, ≈14.1px
 * while hovered); 9px clears even the hovered corner, so a hollow keyframe never
 * shows the connector through its interior and the glyph never grows to hide it.
 */
export const KEYFRAME_GLYPH_GAP_PX = 9;

/**
 * Timeline workspace sizing. These are the ONLY bounds of the timeline panel:
 * the height resizer and the outliner column divider both clamp through
 * `clampPanelSize`, so a drag can never leave the workspace in a size the other
 * control disagrees with.
 */
export const TIMELINE_DEFAULT_HEIGHT = 320;
export const TIMELINE_MIN_HEIGHT = 150;
export const TIMELINE_MAX_HEIGHT = 700;
export const OUTLINER_DEFAULT_WIDTH = 280;
export const OUTLINER_MIN_WIDTH = 180;
export const OUTLINER_MAX_WIDTH = 520;

/**
 * The collapsed strip, in the panel's own border-box units: its 1px top border
 * plus the 38px sequence-tabs bar it keeps (`.timeline-template-tabs-bar`). It is
 * a real length, not `auto`, because that is what lets the edge EASE between the
 * collapsed and the authored height.
 */
export const TIMELINE_COLLAPSED_HEIGHT = 39;

/**
 * C4 — the height the timeline OPENS with (a session's first mount only; the
 * user's later resize or collapse is kept for the rest of the session). A tall
 * window keeps the historic 320 px; a shorter one gives the timeline about a
 * third of its height, so the stage and the layer list are not squeezed by a
 * fixed 320 px; a very short window (a 200 %-zoomed browser) opens the timeline
 * collapsed to its strip — one click on the strip expands it.
 */
export const TALL_WINDOW_MIN_HEIGHT = 860;
export const SHORT_WINDOW_TIMELINE_RATIO = 0.34;
export const COLLAPSED_OPENING_MAX_WINDOW_HEIGHT = 520;

export const resolveOpeningTimelineHeight = (windowHeight: number): number => (
  windowHeight >= TALL_WINDOW_MIN_HEIGHT
    ? TIMELINE_DEFAULT_HEIGHT
    : Math.max(TIMELINE_MIN_HEIGHT, Math.min(TIMELINE_DEFAULT_HEIGHT, Math.round(windowHeight * SHORT_WINDOW_TIMELINE_RATIO)))
);

export const shouldOpenTimelineCollapsed = (windowHeight: number): boolean => windowHeight < COLLAPSED_OPENING_MAX_WINDOW_HEIGHT;

/**
 * R5-03 — how long the collapse/expand edge takes. Short enough to read as one
 * motion of the same edge, long enough that the eye follows the strip instead of
 * seeing it jump. C8: 320 ms (was 180), the same soft ease-in-out as the
 * side docks.
 */
export const TIMELINE_EDGE_TRANSITION_MS = 320;

export const clampPanelSize = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, Math.round(value)))
);

/**
 * The stage keeps at least this much room. The timeline is chrome: it may crop
 * the canvas, never swallow it, so the height ceiling is the smaller of the
 * authored bound and the room the window actually has.
 */
export const MIN_STAGE_HEIGHT = 160;

/**
 * The tallest the timeline may be without squeezing the stage below
 * `MIN_STAGE_HEIGHT`. `chromeAbove` is the stage's client top — the header,
 * toolbar and every other band the panel shares the window with.
 */
export const resolveTimelineHeightCeiling = (windowHeight: number, chromeAbove: number): number => (
  clampPanelSize(
    Math.min(TIMELINE_MAX_HEIGHT, windowHeight - chromeAbove - MIN_STAGE_HEIGHT),
    TIMELINE_MIN_HEIGHT,
    TIMELINE_MAX_HEIGHT,
  )
);
