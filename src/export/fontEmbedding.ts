/**
 * Font embedding for the GIF raster step.
 *
 * A GIF frame is rasterised by loading the generated SVG into an isolated image
 * context, and such a context loads NO external resources: a web font declared
 * only by a network `@font-face` is not available there, while a font embedded in
 * the document itself as a `data:` URL is. This module therefore takes the web
 * fonts the editor is rendering with, reads their bytes, and hands back one
 * `@font-face` stylesheet with the fonts inline — best effort: a font that cannot
 * be fetched is simply left out, and the caller reports that the export fell back
 * to the system family for that text instead of failing the whole export.
 *
 * The parsing and the selection are pure functions so the policy is testable
 * without a network: which `@font-face` blocks are kept (the used families, the
 * weights the renderer writes, and the latin subsets) is a decision, not an
 * accident of what the network returned.
 */

/** The weights the KCS text renderer writes (`font-weight="bold"`). */
export const KCS_RENDERED_TEXT_WEIGHTS = ['400', '700'];

/** The unicode subsets worth embedding for a graphic's text; the rest are for other scripts. */
export const EMBEDDED_FONT_SUBSETS = ['latin', 'latin-ext'];

export interface FontFaceSource {
  family: string;
  /** The raw `font-weight` descriptor, e.g. `700` or `400 900`. */
  weight: string;
  url: string;
  /** The subset comment Google Fonts writes above the block, when present. */
  subset?: string;
  /** The stylesheet's own URL, so a relative `url()` resolves the way the browser resolves it. */
  baseUrl?: string;
}

const FONT_FACE_BLOCK = /(?:\/\*\s*([A-Za-z-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/gu;
const FONT_FAMILY_DESCRIPTOR = /font-family\s*:\s*([^;]+);/iu;
const FONT_WEIGHT_DESCRIPTOR = /font-weight\s*:\s*([^;]+);/iu;
const FONT_SOURCE_URL = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)'"]+))\s*\)/iu;

/** The CSS family name without its quotes and trailing list. */
export const normalizeFontFamily = (value: string): string =>
  value.split(',')[0].replace(/['"]/gu, '').trim();

/** Every `@font-face` block in a stylesheet, in document order. */
export const parseFontFaceCss = (cssText: string): FontFaceSource[] => {
  const faces: FontFaceSource[] = [];
  for (const match of cssText.matchAll(FONT_FACE_BLOCK)) {
    const [, subset, body] = match;
    const family = FONT_FAMILY_DESCRIPTOR.exec(body)?.[1];
    const source = FONT_SOURCE_URL.exec(body);
    if (!family || !source) continue;
    const url = source[1] ?? source[2] ?? source[3];
    if (!url) continue;
    faces.push({
      family: normalizeFontFamily(family),
      weight: (FONT_WEIGHT_DESCRIPTOR.exec(body)?.[1] ?? '').trim(),
      url: url.trim(),
      ...(subset ? { subset } : {}),
    });
  }
  return faces;
};

/** True when a `font-weight` descriptor covers one of the wanted weights. */
const coversWeight = (descriptor: string, wanted: readonly string[]): boolean => {
  if (descriptor.length === 0) return false;
  const range = descriptor.split(/\s+/u).map((part) => Number.parseInt(part, 10));
  if (range.some((value) => Number.isNaN(value))) return false;
  const low = range[0];
  const high = range.length > 1 ? range[range.length - 1] : range[0];
  return wanted.some((weight) => Number.parseInt(weight, 10) >= low && Number.parseInt(weight, 10) <= high);
};

/**
 * The faces worth embedding for a set of families: only the families the scene
 * actually draws with, only the weights the renderer writes, and only the latin
 * subsets — a font's other subsets would multiply the payload for text this
 * editor cannot be showing.
 */
export const selectFontFaces = (
  faces: readonly FontFaceSource[],
  families: readonly string[],
  weights: readonly string[] = KCS_RENDERED_TEXT_WEIGHTS,
): FontFaceSource[] => {
  const wanted = new Set(families.map(normalizeFontFamily).filter((family) => family.length > 0));
  if (wanted.size === 0) return [];
  const hasSubsets = faces.some((face) => face.subset !== undefined);
  return faces.filter((face) => {
    if (!wanted.has(face.family)) return false;
    if (!coversWeight(face.weight, weights)) return false;
    if (hasSubsets && face.subset !== undefined && !EMBEDDED_FONT_SUBSETS.includes(face.subset)) return false;
    return true;
  });
};

/** The font families a scene's text layers draw with, in first-use order. */
export const collectSceneFontFamilies = (
  layers: readonly { type: string; fontFamily?: string }[],
  fallbackFamily: string,
): string[] => {
  const families: string[] = [];
  for (const layer of layers) {
    if (layer.type !== 'custom_text') continue;
    const family = normalizeFontFamily(layer.fontFamily ?? fallbackFamily);
    if (family.length === 0 || families.includes(family)) continue;
    families.push(family);
  }
  return families;
};

/** Base64 without blowing the argument limit of `String.fromCharCode`. */
export const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
};

/** The `@font-face` block for one embedded face. */
const toFontFaceRule = (face: FontFaceSource, dataUrl: string): string =>
  `@font-face{font-family:"${face.family}";font-style:normal;font-weight:${face.weight || '400'};src:url("${dataUrl}")}`;

export interface EmbeddedFontStyles {
  /** The stylesheet to place inside the rasterised SVG (empty when nothing was embedded). */
  css: string;
  /** The families that were embedded, so the caller can report what it managed. */
  families: string[];
}

/** The stylesheet text of every sheet the document can read directly (same-origin sheets). */
const readDocumentStylesheetText = (): { text: string; baseUrl: string }[] => {
  const texts: { text: string; baseUrl: string }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      texts.push({
        text: Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n'),
        baseUrl: sheet.href ?? document.baseURI,
      });
    } catch {
      // A cross-origin sheet's rules are not readable; its href is fetched instead.
    }
  }
  return texts;
};

/** The stylesheet URLs that must be fetched because their rules are not readable. */
const readCrossOriginStylesheetUrls = (): string[] => {
  const urls: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      void sheet.cssRules;
    } catch {
      if (sheet.href) urls.push(sheet.href);
    }
  }
  return urls;
};

/** The bytes of one font file, as a data URL, or `null` when it cannot be read. */
const fetchFontDataUrl = async (face: FontFaceSource): Promise<string | null> => {
  const url = new URL(face.url, face.baseUrl ?? document.baseURI).href;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) return null;
    const extension = url.split(/[?#]/u)[0].split('.').pop()?.toLowerCase() ?? 'woff2';
    const mime = extension === 'ttf' ? 'font/ttf' : extension === 'otf' ? 'font/otf' : 'font/woff2';
    return `data:${mime};base64,${toBase64(bytes)}`;
  } catch {
    return null;
  }
};

/** The faces available to the document, from readable rules and cross-origin sheets. */
const collectAvailableFaces = async (): Promise<FontFaceSource[]> => {
  const fromDocument = readDocumentStylesheetText().flatMap((sheet) =>
    parseFontFaceCss(sheet.text).map((face) => ({ ...face, baseUrl: sheet.baseUrl })));
  const fromLinks: FontFaceSource[] = [];
  for (const url of readCrossOriginStylesheetUrls()) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      fromLinks.push(...parseFontFaceCss(await response.text()).map((face) => ({ ...face, baseUrl: url })));
    } catch {
      // A sheet that cannot be fetched contributes nothing; the caller reports the fallback.
    }
  }
  return [...fromDocument, ...fromLinks];
};

/**
 * One `@font-face` stylesheet with the scene's fonts inlined. Best effort by
 * design: every failure is swallowed and reported through the returned families,
 * because a font is a fidelity detail and never a reason to fail an export.
 */
export const embedSceneFonts = async (families: readonly string[]): Promise<EmbeddedFontStyles> => {
  if (families.length === 0) return { css: '', families: [] };
  try {
    const faces = selectFontFaces(await collectAvailableFaces(), families);
    const rules: string[] = [];
    const embedded: string[] = [];
    for (const face of faces) {
      const dataUrl = await fetchFontDataUrl(face);
      if (!dataUrl) continue;
      rules.push(toFontFaceRule(face, dataUrl));
      if (!embedded.includes(face.family)) embedded.push(face.family);
    }
    return { css: rules.join('\n'), families: embedded };
  } catch {
    return { css: '', families: [] };
  }
};
