/**
 * A text layer's letter case: what it SHOWS, while its written text stays as
 * typed (the field, the canvas editor and an OGraf operator's input keep the
 * operator's own letters; the graphic shows them in capitals).
 *
 * Applied wherever a text's characters are drawn or measured: the draw
 * descriptor, its text effects, its bounds, its outline, its matte, its layout
 * box and the OGraf runtime. `toUpperCase` is locale-independent on purpose:
 * the same scene shows the same letters on every machine. (In Turkish, "i"
 * becomes "I", not "İ".)
 *
 * The self-contained modules the OGraf runtime embeds (`describeText`,
 * `createLayoutModifiers`) cannot import this module; they repeat the one-line
 * rule, and the parity tests hold them to it.
 */

export type TextCase = 'upper';
export const TEXT_CASES: readonly TextCase[] = ['upper'];

export const isTextCase = (value: unknown): value is TextCase => (TEXT_CASES as readonly unknown[]).includes(value);

/** The letters a text shows for this written text and case. */
export const applyTextCase = (text: string, textCase: unknown): string => (textCase === 'upper' ? text.toUpperCase() : text);
