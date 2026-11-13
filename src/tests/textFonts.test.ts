import { describe, expect, it } from 'vitest';
import { KCS_DEFAULT_TEXT_FONT, KCS_TEXT_FONT_FAMILIES, matchTextFontFamily, normalizeTextFontName } from '../utils/layers/textFonts';

/**
 * The one list of text families KCS renders, and the matcher the Lottie
 * importer and the OGraf font bundling use to map a source font name onto it.
 */
describe('text font families', () => {
  it('stores multi-word families with their CSS quotes and single words bare', () => {
    for (const family of KCS_TEXT_FONT_FAMILIES) {
      const bare = family.replace(/'/gu, '');
      expect(family).toBe(bare.includes(' ') ? `'${bare}'` : bare);
    }
    expect(KCS_TEXT_FONT_FAMILIES).toContain(KCS_DEFAULT_TEXT_FONT);
  });

  it('every family matches itself, quoted or bare', () => {
    for (const family of KCS_TEXT_FONT_FAMILIES) {
      expect(matchTextFontFamily(family)).toBe(family);
      expect(matchTextFontFamily(family.replace(/'/gu, ''))).toBe(family);
    }
  });
});

describe('normalizeTextFontName', () => {
  it.each([
    ["'Bebas Neue'", 'bebasneue'],
    ['"Playfair Display"', 'playfairdisplay'],
    ['Roboto-Bold', 'roboto'],
    ['BebasNeue-Regular', 'bebasneue'],
    ['JetBrains_Mono', 'jetbrains'],
    ['Inter, sans-serif', 'inter'],
    ['  MONTSERRAT  ', 'montserrat'],
  ])('%s -> %s', (source, expected) => {
    expect(normalizeTextFontName(source)).toBe(expected);
  });
});

describe('matchTextFontFamily', () => {
  it('maps the PostScript-style names a Lottie document carries onto the KCS family', () => {
    expect(matchTextFontFamily('Montserrat-SemiBold')).toBe('Montserrat');
    expect(matchTextFontFamily('PlayfairDisplay-Bold')).toBe("'Playfair Display'");
    expect(matchTextFontFamily('BebasNeue-Regular')).toBe("'Bebas Neue'");
    expect(matchTextFontFamily('inter')).toBe('Inter');
    expect(matchTextFontFamily('Roboto, Arial, sans-serif')).toBe('Roboto');
  });

  it('a family KCS cannot render, or no name at all, matches nothing', () => {
    expect(matchTextFontFamily('Helvetica Neue')).toBeUndefined();
    expect(matchTextFontFamily('Roboto Mono')).toBeUndefined();
    expect(matchTextFontFamily('Arial, Roboto')).toBeUndefined();
    expect(matchTextFontFamily('')).toBeUndefined();
    expect(matchTextFontFamily('   ')).toBeUndefined();
    expect(matchTextFontFamily(undefined)).toBeUndefined();
  });
});
