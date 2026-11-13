/**
 * The text fonts the editor bundles as WOFF2 subsets (src/fonts.css), described
 * for OGraf packaging: each family is a Latin and a Latin Extended face with
 * the unicode-range the browser uses to pick one, the exact SHA-256 of the
 * project-owned bytes (anything else is refused, as for Playfair Display) and
 * the SIL OFL text that travels with the files.
 */
import interLatin from '../assets/fonts/inter/latin.woff2?url';
import interLatinExt from '../assets/fonts/inter/latin-ext.woff2?url';
import interLicense from '../assets/fonts/inter/OFL.txt?raw';
import outfitLatin from '../assets/fonts/outfit/latin.woff2?url';
import outfitLatinExt from '../assets/fonts/outfit/latin-ext.woff2?url';
import outfitLicense from '../assets/fonts/outfit/OFL.txt?raw';
import montserratLatin from '../assets/fonts/montserrat/latin.woff2?url';
import montserratLatinExt from '../assets/fonts/montserrat/latin-ext.woff2?url';
import montserratLicense from '../assets/fonts/montserrat/OFL.txt?raw';
import robotoLatin from '../assets/fonts/roboto/latin.woff2?url';
import robotoLatinExt from '../assets/fonts/roboto/latin-ext.woff2?url';
import robotoLicense from '../assets/fonts/roboto/OFL.txt?raw';
import jetbrainsMonoLatin from '../assets/fonts/jetbrains-mono/latin.woff2?url';
import jetbrainsMonoLatinExt from '../assets/fonts/jetbrains-mono/latin-ext.woff2?url';
import jetbrainsMonoLicense from '../assets/fonts/jetbrains-mono/OFL.txt?raw';
import bebasNeueLatin from '../assets/fonts/bebas-neue/latin.woff2?url';
import bebasNeueLatinExt from '../assets/fonts/bebas-neue/latin-ext.woff2?url';
import bebasNeueLicense from '../assets/fonts/bebas-neue/OFL.txt?raw';

export const LATIN_UNICODE_RANGE = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
export const LATIN_EXT_UNICODE_RANGE = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

export interface BundledFontFace { subset: 'latin' | 'latin-ext'; url: string; sha256: string; unicodeRange: string }
export interface BundledFontFamily { slug: string; faces: [BundledFontFace, BundledFontFace]; licenseText: string; /** As src/fonts.css declares it. */ fontWeight: string }

/** Keyed by the KCS family string (`KCS_TEXT_FONT_FAMILIES`). */
export const BUNDLED_TEXT_FONTS: Readonly<Record<string, BundledFontFamily>> = {
  'Inter': {
    slug: 'inter',
    fontWeight: '100 900',
    faces: [
      { subset: 'latin', url: interLatin, sha256: '3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62', unicodeRange: LATIN_UNICODE_RANGE },
      { subset: 'latin-ext', url: interLatinExt, sha256: '34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956', unicodeRange: LATIN_EXT_UNICODE_RANGE },
    ],
    licenseText: interLicense,
  },
  'Outfit': {
    slug: 'outfit',
    fontWeight: '100 900',
    faces: [
      { subset: 'latin', url: outfitLatin, sha256: '6c18d579fd87c3776be068b762cbc83fde3acb543d49eabd3ade842eb987e887', unicodeRange: LATIN_UNICODE_RANGE },
      { subset: 'latin-ext', url: outfitLatinExt, sha256: '0f53d1c03b3918d744a843b5039001ee31695ca1e255e3914188df81beb461e9', unicodeRange: LATIN_EXT_UNICODE_RANGE },
    ],
    licenseText: outfitLicense,
  },
  'Montserrat': {
    slug: 'montserrat',
    fontWeight: '100 900',
    faces: [
      { subset: 'latin', url: montserratLatin, sha256: '06b16db7a969135d48d38c49183be7fb88d4452e2a3011957c7851941f4e4879', unicodeRange: LATIN_UNICODE_RANGE },
      { subset: 'latin-ext', url: montserratLatinExt, sha256: '54d9a78b7ff60b689ad9f3017ffac8547b5d871afec733f6c1c3ae36577ee504', unicodeRange: LATIN_EXT_UNICODE_RANGE },
    ],
    licenseText: montserratLicense,
  },
  'Roboto': {
    slug: 'roboto',
    fontWeight: '100 900',
    faces: [
      { subset: 'latin', url: robotoLatin, sha256: '1404ca348bd75ef836f4dd8b6f2cc719458642d1237c368296b2fc652dca47dc', unicodeRange: LATIN_UNICODE_RANGE },
      { subset: 'latin-ext', url: robotoLatinExt, sha256: 'cedb374b05a35034cf96db185db4eeb8f8ce49e1a56197673702ff11b5533d6e', unicodeRange: LATIN_EXT_UNICODE_RANGE },
    ],
    licenseText: robotoLicense,
  },
  "'JetBrains Mono'": {
    slug: 'jetbrains-mono',
    fontWeight: '100 800',
    faces: [
      { subset: 'latin', url: jetbrainsMonoLatin, sha256: '18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e', unicodeRange: LATIN_UNICODE_RANGE },
      { subset: 'latin-ext', url: jetbrainsMonoLatinExt, sha256: '79bfdab9ba467e26eea4122e6f2567e188dd8a09a8c730d501fc487c4ab99c6e', unicodeRange: LATIN_EXT_UNICODE_RANGE },
    ],
    licenseText: jetbrainsMonoLicense,
  },
  "'Bebas Neue'": {
    slug: 'bebas-neue',
    fontWeight: '400',
    faces: [
      { subset: 'latin', url: bebasNeueLatin, sha256: 'a7c90c89240c134f7fdd33d40c000ec90b79d675ea53e8cc5a6d423c073de412', unicodeRange: LATIN_UNICODE_RANGE },
      { subset: 'latin-ext', url: bebasNeueLatinExt, sha256: '16c95ce45a2922f52551d38d565d14c92cf257b8f219c89613407d81fdd21a39', unicodeRange: LATIN_EXT_UNICODE_RANGE },
    ],
    licenseText: bebasNeueLicense,
  },
};
