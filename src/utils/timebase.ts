/**
 * FPS/TIMEBASE CONTRACT (KCS) — the ONE mapping between frames and time.
 *
 *   seconds = frame / fps        frame = seconds * fps
 *
 * - The project FPS is an authored TIME MAPPING, not a redraw budget. Changing
 *   the FPS of a document re-maps frames to seconds; it never changes what the
 *   viewer sees, and it never changes the animation's wall-clock duration unless
 *   the frame count changes with it.
 * - The monitor / browser refresh rate has no effect on the authored duration:
 *   playback integrates elapsed wall-clock time and steps the playhead by whole
 *   authored frames (see `usePlayback`).
 * - The FPS is a positive whole number of frames per second. Fractional rates
 *   such as 59.94 are NOT supported and are never faked: the Lottie importer
 *   rounds `fr` and reports LOTTIE_FRACTIONAL_FPS, and the editor offers
 *   24/30/60/120 FPS with 60 as the new-document default.
 * - The OGraf package carries the same `fps` on SceneData and asks for it in
 *   `renderRequirements.frameRate.ideal`; the generated runtime advances by
 *   elapsed time (`|targetFrame - startFrame| / fps * 1000` ms → progress), so an
 *   exported graphic keeps its wall-clock duration in a host whose own timeline
 *   FPS differs. A Reality Hub Timeline FPS therefore does NOT have to match the
 *   KCS FPS for timing to stay correct — only the graphic's frame count and FPS
 *   define its duration.
 * - The timeline's duration control writes `round(seconds * fps)` frames, so the
 *   seconds the user types are the seconds the animation lasts, at every rate.
 * - Any GIF/video export (manual QA round four, part three) must map
 *   `frameDelayMs = 1000 / fps` per authored frame for the same reason: frame
 *   count × delay = wall-clock duration, independent of the encoding cadence.
 */

/** The rates the editor offers; a new document starts at {@link DEFAULT_PROJECT_FPS}. */
export const SUPPORTED_PROJECT_FPS = [24, 30, 60, 120] as const;
export const DEFAULT_PROJECT_FPS = 60;

/**
 * A usable project frame rate: a positive whole number of frames per second.
 * A fractional rate is rounded to the nearest whole rate (never silently kept —
 * `seconds = frame / 59.94` is not a rate this editor authors), and a
 * non-finite or non-positive value falls back so a hand-edited document cannot
 * poison every later conversion with `Infinity` or `NaN`.
 */
export function sanitizeProjectFps(value: number, fallback: number = DEFAULT_PROJECT_FPS): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.round(value);
}

/** `seconds = frame / fps`, and 0 when the rate cannot carry the mapping. */
export function frameToSeconds(frame: number, fps: number): number {
  return fps > 0 ? frame / fps : 0;
}

/** `frame = seconds * fps`, and 0 when the rate cannot carry the mapping. */
export function secondsToFrame(seconds: number, fps: number): number {
  return fps > 0 ? seconds * fps : 0;
}
