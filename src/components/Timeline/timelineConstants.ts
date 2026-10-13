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
