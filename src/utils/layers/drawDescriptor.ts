/**
 * What a layer draws, apart from how a renderer writes it.
 *
 * The editor stage (JSX), the static SVG renderer (GIF and the OGraf check)
 * and the OGraf runtime (a string in the host) each wrote their own text and
 * paint attributes, and every disagreement between them was a parity bug: the
 * runtime drew text in sans-serif with a 1.5 outline where the editor drew
 * Outfit with 0.5, painted a legacy outline the editor suppresses, and wrote
 * opacity outside 0..1. These descriptors are the one answer; each renderer
 * only spells it.
 *
 * Both functions are self-contained (no module-scope references), so the
 * runtime embeds their source (see `ograf/runtimeSnippets`).
 */
import type { StrokeAlignment } from '../../types/animator';
import type { ResolvedShapeAppearance } from './shapeAppearance';

export interface PaintDescriptor {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number;
  strokeAlignment: StrokeAlignment;
  /** True when the outline is drawn at all. */
  stroked: boolean;
}

export interface TextDescriptor {
  /** The baseline, below the layer origin (`utils/geometry/textOrigin`). */
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'bold';
}

/** The paint a resolved appearance draws with. */
export const describePaint = (appearance: ResolvedShapeAppearance): PaintDescriptor => ({
  fill: appearance.fillEnabled ? appearance.fillColor || 'none' : 'none',
  fillOpacity: appearance.fillOpacity,
  stroke: appearance.strokeEnabled ? appearance.strokeColor || 'none' : 'none',
  strokeOpacity: appearance.strokeOpacity,
  strokeWidth: appearance.strokeWidth,
  strokeAlignment: appearance.strokeAlignment,
  stroked: appearance.strokeEnabled && appearance.strokeWidth > 0,
});

/** The glyph run of a text layer: its content, font and baseline. */
export const describeText = (
  part: { textValue?: string; fontSize?: number; fontFamily?: string },
  baselineY: number,
): TextDescriptor => ({
  y: baselineY,
  text: part.textValue || 'TEXT',
  fontSize: part.fontSize || 24,
  fontFamily: part.fontFamily || 'Outfit',
  fontWeight: 'bold',
});
