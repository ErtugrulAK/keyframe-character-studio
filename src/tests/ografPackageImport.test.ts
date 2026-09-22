import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { OGRAF_PACKAGE_LIMITS, readOGrafPackage } from '../ograf/packageImport';

/**
 * Milestone F item 12 — reading an OGraf package back into an editable scene.
 *
 * The archive is untrusted input: these tests pin the guards (entry count, entry
 * size, package paths, reserved and duplicate names, prototype keys) and the
 * happy path (a package the exporter wrote imports its `scene.kcs`).
 */

const encode = (value: string) => new TextEncoder().encode(value);

const scene = JSON.stringify({ version: 1, width: 320, height: 180, fps: 24, totalFrames: 24, layers: [], tracks: [] });

const manifest = JSON.stringify({ $schema: 'https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json', id: 'demo', name: 'Demo Graphic', main: 'graphic.mjs', version: '1.0.0' });

const codes = (result: { diagnostics: { code: string }[] }) => result.diagnostics.map((entry) => entry.code);

describe('OGraf package import', () => {
  it('reads the scene out of a package the exporter wrote', () => {
    const bytes = zipSync({ 'demo.ograf.json': encode(manifest), 'scene.kcs': encode(scene), 'graphic.mjs': encode('export default 1;') });
    const result = readOGrafPackage(bytes);

    expect(result.ok).toBe(true);
    expect(result.sceneText).toBe(scene);
    expect(result.name).toBe('Demo Graphic');
    expect(codes(result)).toContain('OGRAF_PACKAGE_ASSETS_OMITTED');
  });

  it('refuses a package without a scene, an empty file and a non-archive', () => {
    const noScene = zipSync({ 'demo.ograf.json': encode(manifest) });

    expect(codes(readOGrafPackage(new Uint8Array()))).toEqual(['OGRAF_PACKAGE_UNREADABLE']);
    expect(codes(readOGrafPackage(encode('PK not a zip')))).toEqual(['OGRAF_PACKAGE_UNREADABLE']);
    expect(codes(readOGrafPackage(noScene))).toEqual(['OGRAF_PACKAGE_MISSING_SCENE']);
  });

  it('refuses traversal paths, reserved names and case-only duplicates', () => {
    const traversal = zipSync({ '../escape.kcs': encode(scene), 'scene.kcs': encode(scene) });
    const absolute = zipSync({ '/etc/passwd': encode('x'), 'scene.kcs': encode(scene) });
    const reserved = zipSync({ 'scene.kcs': encode(scene), 'CON.txt': encode('x') });
    const collision = zipSync({ 'scene.kcs': encode(scene), 'Assets/Img.png': encode('x'), 'assets/img.png': encode('y') });

    expect(codes(readOGrafPackage(traversal))).toEqual(['OGRAF_PACKAGE_UNSAFE_PATH']);
    expect(codes(readOGrafPackage(absolute))).toEqual(['OGRAF_PACKAGE_UNSAFE_PATH']);
    expect(codes(readOGrafPackage(reserved))).toEqual(['OGRAF_PACKAGE_UNSAFE_PATH']);
    expect(codes(readOGrafPackage(collision))).toEqual(['OGRAF_PACKAGE_DUPLICATE_PATH']);
  });

  it('refuses a manifest with a prototype-sensitive key', () => {
    const unsafeManifest = '{"$schema":"https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json","__proto__":{"x":1}}';
    const bytes = zipSync({ 'demo.ograf.json': encode(unsafeManifest), 'scene.kcs': encode(scene) });

    expect(codes(readOGrafPackage(bytes))).toEqual(['OGRAF_PACKAGE_UNSAFE_KEY']);
  });

  it('bounds the archive and its entries', () => {
    const tooMany = Object.fromEntries(Array.from({ length: OGRAF_PACKAGE_LIMITS.entries + 1 }, (_, index) => [`file_${index}.txt`, encode('x')]));
    const tooManyBytes = zipSync({ ...tooMany, 'scene.kcs': encode(scene) });

    expect(codes(readOGrafPackage(tooManyBytes))).toEqual(['OGRAF_PACKAGE_TOO_MANY_ENTRIES']);
    expect(codes(readOGrafPackage(new Uint8Array(OGRAF_PACKAGE_LIMITS.bytes + 1)))).toEqual(['OGRAF_PACKAGE_TOO_LARGE']);
    // An entry above the limit is refused instead of silently dropped: the filter
    // stops it before decompression, and the drop is reported.
    const oversizedEntry = zipSync({ 'scene.kcs': encode(scene), 'big.bin': new Uint8Array(OGRAF_PACKAGE_LIMITS.entryBytes + 1) });
    expect(codes(readOGrafPackage(oversizedEntry))).toEqual(['OGRAF_PACKAGE_ENTRY_TOO_LARGE']);
  });

  it('imports a package whose manifest is unreadable, and reports it', () => {
    const bytes = zipSync({ 'demo.ograf.json': encode('{ not json'), 'scene.kcs': encode(scene) });
    const result = readOGrafPackage(bytes);

    expect(result.ok).toBe(true);
    expect(result.sceneText).toBe(scene);
    expect(codes(result)).toContain('OGRAF_PACKAGE_UNREADABLE_MANIFEST');
  });
});
