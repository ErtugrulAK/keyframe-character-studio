/**
 * D-01 / D-03 — Playfair OGraf portability: the `@font-face` identity must be
 * the primary face (not a CSS fallback list), and the project-owned font bytes
 * are pinned to their exact SHA-256 instead of the 4-byte sfnt signature.
 */

import { describe, expect, test, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import type { SceneData, SceneLayer } from '../types/composition';
import { prepareLegacyOGrafExport } from '../ograf/legacyCompatibility';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { createOGrafBrowserZip } from '../ograf/browserZip';

const realFont = (): Uint8Array => new Uint8Array(readFileSync('src/assets/fonts/playfair-display/PlayfairDisplay.ttf'));

/** A Response body over the bytes; `slice()` narrows the view to a plain ArrayBuffer. */
const fontResponse = (bytes: Uint8Array): Response => new Response(bytes.slice().buffer);

const textLayer = (fontFamily: string): SceneLayer => ({
  id: 'title', name: 'Cinematic Title', type: 'custom_text', x: 0, y: 0, rotation: 0,
  scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 0,
  fillColor: '#ffffff', strokeColor: 'none', width: 400, height: 200,
  textValue: 'Editable title', fontSize: 96, fontFamily,
});

const scene = (fontFamily: string): SceneData => ({
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Legacy',
  width: 320, height: 180, fps: 30, totalFrames: 30, layers: [textLayer(fontFamily)], tracks: [],
});

const runtimeOf = async (fontFamily: string, bytes: Uint8Array): Promise<string> => {
  vi.stubGlobal('fetch', async () => fontResponse(bytes));
  const prepared = await prepareLegacyOGrafExport(scene(fontFamily));
  const plan = compileOGrafPackage(prepared.sceneData, prepared.options);
  expect(plan.status).toBe('ready-to-materialize');
  return plan.files.find((file) => file.kind === 'runtime')?.content ?? '';
};

afterEach(() => vi.unstubAllGlobals());

describe('D-01 — a fallback-list family registers the primary face', () => {
  test('emits a single-family @font-face while the element keeps the full list', async () => {
    const runtime = await runtimeOf("'Playfair Display', serif", realFont());

    // The generated runtime registers ONE face identity, not the CSS list: the
    // @font-face descriptor takes a single family name.
    expect(runtime).toContain('[["Playfair Display","assets/fonts/playfair-display.ttf"]]');
    expect(runtime).not.toContain('"\'Playfair Display\', serif","assets/fonts/playfair-display.ttf"');
    // The element keeps the authored fallback list.
    expect(runtime).toContain("\"'Playfair Display', serif\"");
  });

  test('a bare and a quoted family both register the same face identity', async () => {
    const bare = await runtimeOf('Playfair Display', realFont());
    const quoted = await runtimeOf("'Playfair Display'", realFont());
    expect(bare).toContain('[["Playfair Display","assets/fonts/playfair-display.ttf"]]');
    expect(quoted).toContain('[["Playfair Display","assets/fonts/playfair-display.ttf"]]');
  });

  test('the packaged ZIP keeps the owned font and its license', async () => {
    vi.stubGlobal('fetch', async () => fontResponse(realFont()));
    const prepared = await prepareLegacyOGrafExport(scene("'Playfair Display', serif"));
    const plan = compileOGrafPackage(prepared.sceneData, prepared.options);
    const files = unzipSync((await createOGrafBrowserZip(plan)).bytes);
    expect(files['assets/fonts/playfair-display.ttf']).toEqual(realFont());
    expect(new TextDecoder().decode(files['assets/fonts/playfair-display.ttf.LICENSE.txt'])).toContain('SIL OPEN FONT LICENSE');
  });
});

describe('D-03 — the owned font is pinned to its exact bytes', () => {
  test('the real owned font is accepted', async () => {
    vi.stubGlobal('fetch', async () => fontResponse(realFont()));
    const prepared = await prepareLegacyOGrafExport(scene('Playfair Display'));
    const plan = compileOGrafPackage(prepared.sceneData, prepared.options);
    expect(plan.status).toBe('ready-to-materialize');
  });

  test('a 4-byte sfnt signature alone is refused', async () => {
    vi.stubGlobal('fetch', async () => fontResponse(new Uint8Array([0, 1, 0, 0])));
    const prepared = await prepareLegacyOGrafExport(scene('Playfair Display'));
    const plan = compileOGrafPackage(prepared.sceneData, prepared.options);
    expect(plan.status).toBe('blocked');
    expect(plan.diagnostics).toContainEqual(expect.objectContaining({ code: 'OGRAF_FONT_UNVERIFIED', severity: 'ERROR' }));
  });

  test('a single mutated byte is refused', async () => {
    const mutated = realFont();
    mutated[mutated.length - 1] ^= 0xff;
    vi.stubGlobal('fetch', async () => fontResponse(mutated));
    const prepared = await prepareLegacyOGrafExport(scene('Playfair Display'));
    const plan = compileOGrafPackage(prepared.sceneData, prepared.options);
    expect(plan.status).toBe('blocked');
    expect(plan.diagnostics).toContainEqual(expect.objectContaining({ code: 'OGRAF_FONT_UNVERIFIED' }));
  });

  test('a truncated owned font is refused', async () => {
    const truncated = realFont().slice(0, 4096);
    vi.stubGlobal('fetch', async () => fontResponse(truncated));
    const prepared = await prepareLegacyOGrafExport(scene('Playfair Display'));
    const plan = compileOGrafPackage(prepared.sceneData, prepared.options);
    expect(plan.status).toBe('blocked');
  });

  test('a caller-supplied font is never checked against the owned hash', async () => {
    const supplied = new Uint8Array([0, 1, 0, 0, 9, 9, 9, 9]);
    const prepared = await prepareLegacyOGrafExport(scene('Playfair Display'), {
      assetCatalog: { 'font:Playfair Display': { kind: 'local', packagedPath: 'fonts/owned.ttf', binaryContent: supplied } },
    });
    const plan = compileOGrafPackage(prepared.sceneData, prepared.options);
    expect(plan.status).toBe('ready-to-materialize');
    const files = unzipSync((await createOGrafBrowserZip(plan)).bytes);
    expect(files['fonts/owned.ttf']).toEqual(supplied);
  });
});
