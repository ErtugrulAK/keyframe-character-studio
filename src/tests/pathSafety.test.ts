import { describe, expect, test } from 'vitest';
import {
  hasCaseInsensitiveCollision,
  isReservedWindowsName,
  isSafePackageRelativePath,
  normalizePackagePath,
  sanitizeFilenameComponent,
} from '../utils/pathSafety';

describe('Windows path safety', () => {
  test('sanitizes invalid filename characters and trailing separators', () => {
    expect(sanitizeFilenameComponent('report:final?.json. ')).toBe('report-final-.json');
    expect(sanitizeFilenameComponent('   ...   ', 'untitled')).toBe('untitled');
  });

  test('recognizes superscript Windows device names across case and extensions', () => {
    const reservedNames = [
      'COM¹',
      'COM²',
      'COM³',
      'LPT¹',
      'LPT²',
      'LPT³',
    ];

    for (const name of reservedNames) {
      expect(isReservedWindowsName(name)).toBe(true);
      expect(isReservedWindowsName(`${name.toLowerCase()}.txt`)).toBe(true);
      expect(isReservedWindowsName(`${name}.PNG`)).toBe(true);
    }
  });

  test('uses the requested deterministic fallback for reserved sanitized components', () => {
    const cases = [
      ['COM¹', 'com-one'],
      ['cOm².ttf', 'com-two'],
      ['COM³.png', 'com-three'],
      ['LPT¹', 'lpt-one'],
      ['lPt².ttf', 'lpt-two'],
      ['LPT³.svg', 'lpt-three'],
    ] as const;

    for (const [input, fallback] of cases) {
      expect(sanitizeFilenameComponent(input, fallback)).toBe(fallback);
    }
  });

  test('falls back for reserved Windows device names including extensions', () => {
    expect(isReservedWindowsName('CON')).toBe(true);
    expect(isReservedWindowsName('con.txt')).toBe(true);
    expect(isReservedWindowsName('AUX.png')).toBe(true);
    expect(isReservedWindowsName('LPT9.svg')).toBe(true);
    expect(sanitizeFilenameComponent('NUL', 'graphic')).toBe('graphic');
  });

  test('preserves reasonable Unicode filename content', () => {
    expect(sanitizeFilenameComponent('キャラクター')).toBe('キャラクター');
    expect(sanitizeFilenameComponent('résumé_日本語.png')).toBe('résumé_日本語.png');
  });

  test('normalizes package separators and rejects unsafe entries', () => {
    expect(normalizePackagePath('assets\\images\\logo.png')).toBe('assets/images/logo.png');
    expect(isSafePackageRelativePath('assets/images/foo.png')).toBe(true);
    expect(isSafePackageRelativePath('assets/fonts/font.woff2')).toBe(true);
    expect(isSafePackageRelativePath('../secret')).toBe(false);
    expect(isSafePackageRelativePath('assets/../secret')).toBe(false);
    expect(isSafePackageRelativePath('..\\secret')).toBe(false);
    expect(isSafePackageRelativePath('C:/secret')).toBe(false);
    expect(isSafePackageRelativePath('\\\\server\\share')).toBe(false);
    expect(isSafePackageRelativePath('assets/images/CON.png')).toBe(false);
    expect(isSafePackageRelativePath('assets/images/COM¹.png')).toBe(false);
    expect(isSafePackageRelativePath('assets/fonts/LPT².ttf')).toBe(false);
    expect(isSafePackageRelativePath('assets/images/logo.')).toBe(false);
  });

  test('accepts printable ASCII package paths but rejects Unicode package paths', () => {
    expect(isSafePackageRelativePath('assets/images/logo-2.png')).toBe(true);
    expect(isSafePackageRelativePath('assets/images/キャラクター.png')).toBe(false);
  });

  test('detects case-insensitive package collisions', () => {
    expect(hasCaseInsensitiveCollision(['assets/images/Logo.png', 'assets/images/logo.PNG'])).toBe(true);
    expect(hasCaseInsensitiveCollision(['assets/images/logo.png', 'assets/images/other.png'])).toBe(false);
  });
});
