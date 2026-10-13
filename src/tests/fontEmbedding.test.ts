import { describe, expect, it } from 'vitest';
import {
  collectSceneFontFamilies,
  embedSceneFonts,
  normalizeFontFamily,
  parseFontFaceCss,
  selectFontFaces,
  toBase64,
} from '../export/fontEmbedding';

/** The two shapes an editor sees: a Google sheet and the bundled local font. */
const GOOGLE_SHEET = `
/* latin-ext */
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/outfit/v1/latin-ext.woff2) format('woff2');
  unicode-range: U+0100-024F;
}
/* latin */
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/outfit/v1/latin.woff2) format('woff2');
}
/* cyrillic */
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/outfit/v1/cyrillic.woff2) format('woff2');
}
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 400;
  src: url("https://fonts.gstatic.com/s/outfit/v1/latin-400.woff2") format('woff2');
}
`;

const LOCAL_SHEET = `
@font-face {
  font-family: 'Playfair Display';
  src: url(/src/assets/fonts/playfair-display/PlayfairDisplay.ttf) format('truetype');
  font-style: normal;
  font-weight: 400 900;
}
`;

describe('font embedding', () => {
  it('reads every @font-face block, with its subset comment and weight', () => {
    const faces = parseFontFaceCss(GOOGLE_SHEET);

    expect(faces).toHaveLength(4);
    expect(faces[0]).toMatchObject({
      family: 'Outfit',
      weight: '700',
      subset: 'latin-ext',
      url: 'https://fonts.gstatic.com/s/outfit/v1/latin-ext.woff2',
    });
    expect(faces[3].url).toBe('https://fonts.gstatic.com/s/outfit/v1/latin-400.woff2');
    expect(parseFontFaceCss(LOCAL_SHEET)[0]).toMatchObject({
      family: 'Playfair Display',
      weight: '400 900',
      url: '/src/assets/fonts/playfair-display/PlayfairDisplay.ttf',
    });
  });

  it('keeps only the used families, the written weights and the latin subsets', () => {
    const faces = parseFontFaceCss(GOOGLE_SHEET);
    const selected = selectFontFaces(faces, ['Outfit', 'Unused']);

    expect(selected.map((face) => face.url)).toEqual([
      'https://fonts.gstatic.com/s/outfit/v1/latin-ext.woff2',
      'https://fonts.gstatic.com/s/outfit/v1/latin.woff2',
      'https://fonts.gstatic.com/s/outfit/v1/latin-400.woff2',
    ]);
    // A family the scene never draws with is never fetched.
    expect(selectFontFaces(faces, ['Inter'])).toEqual([]);
    expect(selectFontFaces(faces, [])).toEqual([]);
  });

  it('accepts a variable-weight font that covers the rendered weights', () => {
    const selected = selectFontFaces(parseFontFaceCss(LOCAL_SHEET), ['Playfair Display']);
    expect(selected).toHaveLength(1);
  });

  it('normalizes a CSS family list down to the family name', () => {
    expect(normalizeFontFamily("'Playfair Display', serif")).toBe('Playfair Display');
    expect(normalizeFontFamily('Outfit')).toBe('Outfit');
    expect(normalizeFontFamily('  "JetBrains Mono" ')).toBe('JetBrains Mono');
  });

  it('collects the families a scene draws with, in first-use order', () => {
    expect(collectSceneFontFamilies([
      { type: 'custom_rect' },
      { type: 'custom_text', fontFamily: 'Outfit' },
      { type: 'custom_text', fontFamily: 'Outfit' },
      { type: 'custom_text', fontFamily: "'Bebas Neue'" },
      { type: 'custom_text' },
    ], 'Inter')).toEqual(['Outfit', 'Bebas Neue', 'Inter']);
    expect(collectSceneFontFamilies([{ type: 'custom_rect' }], 'Outfit')).toEqual([]);
  });

  it('base64-encodes bytes larger than one String.fromCharCode call', () => {
    const bytes = new Uint8Array(70000);
    bytes[0] = 0xFF;
    bytes[bytes.length - 1] = 0x01;
    const encoded = toBase64(bytes);
    expect(encoded.length).toBeGreaterThan(90000);
    expect(encoded.startsWith('/w')).toBe(true);
  });

  it('degrades to no embedded font instead of failing when nothing can be read', async () => {
    // jsdom has no stylesheets here, so there is nothing to embed and nothing to fetch.
    await expect(embedSceneFonts(['Outfit'])).resolves.toEqual({ css: '', families: [] });
    await expect(embedSceneFonts([])).resolves.toEqual({ css: '', families: [] });
  });
});
