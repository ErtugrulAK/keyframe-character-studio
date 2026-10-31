/**
 * Where a text layer's origin (its position, rotation and scale point — the
 * crosshair the coordinate overlay marks) sits on its text.
 *
 * - `baseline` (absent): the origin is on the baseline, centred. Every text made
 *   before `textOrigin` existed keeps it, so no saved scene moves.
 * - `center`: the origin is in the middle of the text box, as for a rectangle.
 *   New text layers use it.
 *
 * Every text renderer (stage, staggered text, matte mask, outline trace,
 * selection bounds, OGraf/GIF static renderer, OGraf runtime) places the
 * baseline at `textBaselineOffset` below the origin, so they all agree.
 */
export type TextOrigin = 'baseline' | 'center';

/**
 * The text box centre above the baseline, in em: the same constant the
 * selection bounds use (`getTextMetrics`).
 */
export const TEXT_BOX_CENTRE_EM = 0.346;

/** How far below the layer origin the baseline is drawn, in local units. */
export const textBaselineOffset = (part: { textOrigin?: TextOrigin; fontSize?: number }): number => (
  part.textOrigin === 'center' ? (part.fontSize || 24) * TEXT_BOX_CENTRE_EM : 0
);
