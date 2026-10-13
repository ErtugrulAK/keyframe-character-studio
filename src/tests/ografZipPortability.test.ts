import { describe, expect, it } from 'vitest';
import { unzipSync, zipSync } from 'fflate';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { createOGrafBrowserZip, sanitizeOGrafDownloadName } from '../ograf/browserZip';
import { readOGrafPackage } from '../ograf/packageImport';
import { isSafePackageRelativePath, normalizePackagePath } from '../utils/pathSafety';
import type { SceneData, SceneLayer } from '../types/composition';

/**
 * Manual QA Round 4 — R4-13: the exported OGraf ZIP must open on macOS.
 *
 * The audit is structural rather than a guess: the archive is decoded by a
 * reader written for this test — the central directory itself — so the claims
 * about separators, absolute paths, compression methods, CRCs and the
 * end-of-central-directory record do not rest on the same library that wrote
 * the file. Cross-extractor evidence (bsdtar / Info-ZIP / Python `zipfile`) is
 * recorded in the round-four report.
 */

interface CentralEntry {
  name: string;
  method: number;
  flags: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

const u16 = (bytes: Uint8Array, offset: number): number => bytes[offset] | (bytes[offset + 1] << 8);
const u32 = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;

/** Walk the ZIP end-of-central-directory record and its central directory. */
const readCentralDirectory = (bytes: Uint8Array) => {
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (u32(bytes, offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('no end-of-central-directory record');

  const declaredCount = u16(bytes, eocd + 10);
  const directoryOffset = u32(bytes, eocd + 16);
  const entries: CentralEntry[] = [];
  let cursor = directoryOffset;
  while (cursor + 46 <= bytes.length && u32(bytes, cursor) === 0x02014b50) {
    const nameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    entries.push({
      name: new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)),
      method: u16(bytes, cursor + 10),
      flags: u16(bytes, cursor + 8),
      crc32: u32(bytes, cursor + 16),
      compressedSize: u32(bytes, cursor + 20),
      uncompressedSize: u32(bytes, cursor + 24),
      localHeaderOffset: u32(bytes, cursor + 42),
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return { declaredCount, entries };
};

const shape = (overrides: Partial<SceneLayer> = {}): SceneLayer => ({
  id: 'shape', name: 'Shape', type: 'custom_box', x: 0, y: 0, rotation: 0,
  scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 0,
  fillColor: '#fff', strokeColor: '#000', ...overrides,
});

const scene = (layers: SceneLayer[], name = 'Portable Graphic'): SceneData => ({
  version: 1, coordinateSystem: 'project-unit-center-v1', name,
  width: 320, height: 180, fps: 30, totalFrames: 30, layers, tracks: [],
});

const exportZip = async (sceneData: SceneData, assetCatalog?: Parameters<typeof compileOGrafPackage>[1]) => {
  const plan = compileOGrafPackage(sceneData, assetCatalog);
  expect(plan.status).toBe('ready-to-materialize');
  return createOGrafBrowserZip(plan);
};

describe('R4-13 — the exported ZIP is structurally portable', () => {
  it('uses forward slashes, relative paths, a supported method and a valid central directory', async () => {
    const { bytes } = await exportZip(
      scene([shape(), shape({ id: 'image', name: 'Logo', type: 'custom_image', imageUrl: 'assets/source.png' })]),
      { assetCatalog: { 'assets/source.png': { kind: 'local', packagedPath: 'assets/images/logo.png', binaryContent: new Uint8Array([137, 80, 78, 71]) } } },
    );
    const { declaredCount, entries } = readCentralDirectory(bytes);

    expect(declaredCount).toBe(entries.length);
    expect(entries.map((entry) => entry.name).sort()).toEqual([
      'assets/images/logo.png', 'graphic.mjs', 'portable-graphic.ograf.json', 'scene.kcs',
    ]);

    for (const entry of entries) {
      expect(entry.name, entry.name).not.toContain('\\');
      expect(entry.name.startsWith('/'), entry.name).toBe(false);
      expect(/^[A-Za-z]:/.test(entry.name), entry.name).toBe(false);
      expect(entry.name.split('/'), entry.name).not.toContain('..');
      expect([0, 8], `${entry.name} method`).toContain(entry.method);
      // A local header precedes every central-directory record, and its method
      // and name must agree with it (a mismatched pair is what makes an
      // extractor on another OS report a corrupt archive).
      expect(u32(bytes, entry.localHeaderOffset), entry.name).toBe(0x04034b50);
      expect(u16(bytes, entry.localHeaderOffset + 8), entry.name).toBe(entry.method);
      const localNameLength = u16(bytes, entry.localHeaderOffset + 26);
      const localName = new TextDecoder().decode(bytes.subarray(entry.localHeaderOffset + 30, entry.localHeaderOffset + 30 + localNameLength));
      expect(localName, entry.name).toBe(entry.name);
      if (entry.uncompressedSize > 0) expect(entry.crc32, `${entry.name} crc`).not.toBe(0);
    }

    // The 8.3-era MS-DOS attribute byte and the UTF-8 name flag: names are ASCII
    // here, so no entry needs the UTF-8 flag set, and none may claim it falsely.
    for (const entry of entries) {
      expect((entry.flags & 0x800), entry.name).toBe(0);
    }
  });

  it('preserves every package file through a round trip', async () => {
    const authored = scene([shape({ id: 'image', name: 'Logo', type: 'custom_image', imageUrl: 'assets/source.png' })]);
    const { bytes } = await exportZip(authored, {
      assetCatalog: { 'assets/source.png': { kind: 'local', packagedPath: 'assets/images/logo.png', binaryContent: new Uint8Array([1, 2, 3, 4, 5]) } },
    });

    const extracted = unzipSync(bytes);
    expect(Object.keys(extracted).sort()).toEqual([
      'assets/images/logo.png', 'graphic.mjs', 'portable-graphic.ograf.json', 'scene.kcs',
    ]);
    expect(Array.from(extracted['assets/images/logo.png'])).toEqual([1, 2, 3, 4, 5]);
    expect(new TextDecoder().decode(extracted['scene.kcs'])).toContain('project-unit-center-v1');
    expect(new TextDecoder().decode(extracted['graphic.mjs'])).toContain('class Graphic');

    const reimported = readOGrafPackage(bytes);
    expect(reimported.ok).toBe(true);
  });

  it('keeps a path with a space intact, and never emits a non-ASCII name', async () => {
    const { fileName, bytes } = await exportZip(
      scene([shape({ id: 'image', name: 'Logo', type: 'custom_image', imageUrl: 'assets/source.png' })], 'Café / Démo'),
      { assetCatalog: { 'assets/source.png': { kind: 'local', packagedPath: 'assets/images/my logo.png', binaryContent: new Uint8Array([9]) } } },
    );

    // The user-facing download name is ASCII-folded, so the file a macOS user
    // saves cannot be mangled by an encoding it never declared.
    expect(fileName).toBe('cafe-demo-ograf.zip');
    expect([...fileName].every((character) => character.charCodeAt(0) < 0x80)).toBe(true);

    const names = Object.keys(unzipSync(bytes));
    expect(names).toContain('assets/images/my logo.png');
    for (const name of names) {
      expect(/[^\x20-\x7E]/u.test(name), name).toBe(false);
      expect(normalizePackagePath(name)).toBe(name);
    }
  });
});

describe('R4-13 — a foreign package is refused instead of mis-decoded', () => {
  it('refuses a non-ASCII entry name with a diagnostic, never a mangled import', () => {
    const bytes = zipSync({
      'scene.kcs': new TextEncoder().encode(JSON.stringify({ version: 1 })),
      'assets/images/biléd.png': new TextEncoder().encode('x'),
    });

    const result = readOGrafPackage(bytes);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('OGRAF_PACKAGE_UNSAFE_PATH');
  });

  it('refuses a drive letter and a traversal, and normalizes a Windows separator', () => {
    // A backslash is NORMALIZED to the package separator rather than refused:
    // the writer can never emit one, and treating it as the same relative path
    // is what keeps a Windows-authored archive from resolving differently.
    expect(normalizePackagePath('assets\\images\\logo.png')).toBe('assets/images/logo.png');
    expect(isSafePackageRelativePath('assets\\images\\logo.png')).toBe(true);
    expect(readOGrafPackage(zipSync({
      'scene.kcs': new TextEncoder().encode(JSON.stringify({ version: 1 })),
      'assets\\images\\logo.png': new TextEncoder().encode('x'),
    })).ok).toBe(true);

    for (const unsafe of ['C:/logo.png', '/etc/passwd', '../logo.png']) {
      expect(isSafePackageRelativePath(unsafe), unsafe).toBe(false);
      const result = readOGrafPackage(zipSync({
        'scene.kcs': new TextEncoder().encode(JSON.stringify({ version: 1 })),
        [unsafe]: new TextEncoder().encode('x'),
      }));
      expect(result.ok, unsafe).toBe(false);
    }
  });

  it('refuses a case-insensitive duplicate that macOS would collapse into one file', () => {
    const result = readOGrafPackage(zipSync({
      'scene.kcs': new TextEncoder().encode(JSON.stringify({ version: 1 })),
      'Assets/Img.png': new TextEncoder().encode('a'),
      'assets/img.png': new TextEncoder().encode('b'),
    }));

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('OGRAF_PACKAGE_DUPLICATE_PATH');
  });
});

describe('R4-13 — the download name is a safe file name on every platform', () => {
  it('folds accents, drops path separators and reserved names', () => {
    expect(sanitizeOGrafDownloadName(' Ä Project / Demo ')).toBe('a-project-demo');
    expect(sanitizeOGrafDownloadName('Café Démo')).toBe('cafe-demo');
    // A reserved Windows device name falls back instead of shipping a file the
    // platform refuses to create.
    expect(sanitizeOGrafDownloadName('CON')).toBe('graphic');
    expect(sanitizeOGrafDownloadName('..')).toBe('graphic');
    expect(sanitizeOGrafDownloadName('')).toBe('graphic');
  });
});
