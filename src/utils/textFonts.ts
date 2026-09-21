/**
 * The text font families KCS can render.
 *
 * This is the single list of families the editor offers and the Lottie importer
 * maps onto: the inspector renders its options from it, and an imported text
 * layer only receives a `fontFamily` when the source document names one of
 * these. Keeping one list is what stops the importer from inventing a family the
 * editor cannot show or the renderer cannot draw.
 *
 * The values are the exact strings stored on a layer (multi-word families carry
 * their CSS quotes, matching what the renderer writes into the SVG attribute).
 */
export const KCS_TEXT_FONT_FAMILIES = [
  'Outfit',
  'Inter',
  'Roboto',
  'Montserrat',
  "'Playfair Display'",
  "'Bebas Neue'",
  "'JetBrains Mono'",
] as const;

export type KcsTextFontFamily = (typeof KCS_TEXT_FONT_FAMILIES)[number];

/**
 * Normalises a font name for comparison: drop CSS quotes, drop everything from a
 * style separator (`Roboto-Bold` → `Roboto`, `BebasNeue-Regular` → `BebasNeue`)
 * and ignore case and spaces.
 */
export const normalizeTextFontName = (value: string): string =>
  value
    .replace(/['"]/gu, '')
    .split(',')[0]
    .split(/[-_]/u)[0]
    .replace(/\s+/gu, '')
    .toLowerCase();

/** The canonical KCS family a source font name refers to, or `undefined`. */
export const matchTextFontFamily = (name: string | undefined): KcsTextFontFamily | undefined => {
  if (typeof name !== 'string' || name.trim().length === 0) return undefined;
  const needle = normalizeTextFontName(name);
  return KCS_TEXT_FONT_FAMILIES.find((family) => normalizeTextFontName(family) === needle);
};

/** The family the renderer falls back to when a layer names none. */
export const KCS_DEFAULT_TEXT_FONT = 'Outfit';
