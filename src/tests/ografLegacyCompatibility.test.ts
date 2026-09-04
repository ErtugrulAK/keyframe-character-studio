import { describe, expect, test } from 'vitest';
import { unzipSync } from 'fflate';
import type { SceneData, SceneLayer } from '../types/composition';
import { prepareLegacyOGrafExport } from '../ograf/legacyCompatibility';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { createOGrafBrowserZip } from '../ograf/browserZip';

function makeLayer(overrides: Partial<SceneLayer> = {}): SceneLayer {
  return {
    id: 'layer-1', name: 'Layer', type: 'custom_image', x: 0, y: 0, rotation: 0,
    scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 0,
    fillColor: '#ffffff', strokeColor: 'none', imageUrl: 'assets/source.png',
    width: 100, height: 50, ...overrides,
  };
}

function makeScene(layer = makeLayer()): SceneData {
  return { version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Legacy', width: 320, height: 180, fps: 30, totalFrames: 30, layers: [layer], tracks: [] };
}

const embeddedSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="red"/></svg>';
const embeddedSvgUrl = `data:image/svg+xml;base64,${btoa(embeddedSvg)}`;

const unsafeSvgUrl = `data:image/svg+xml;base64,${btoa('<svg><script>alert(1)</script></svg>')}`;
describe('legacy OGraf asset compatibility', () => {
  test('normalizes embedded images into deterministic package bytes without mutating SceneData', async () => {
    const scene = makeScene(makeLayer({ imageUrl: embeddedSvgUrl }));
    const prepared = prepareLegacyOGrafExport(scene);
    expect(prepared).not.toBeInstanceOf(Promise);
    const result = prepared instanceof Promise ? await prepared : prepared;
    const preparedLayer = result.sceneData.layers[0];
    const packagedPath = preparedLayer.imageUrl || '';

    expect(scene.layers[0].imageUrl).toBe(embeddedSvgUrl);
    expect(packagedPath).toMatch(/^assets\/images\/legacy-[0-9a-f]{8}\.svg$/u);
    expect(Array.from(result.options.assetCatalog?.[packagedPath]?.binaryContent || [])).toEqual(Array.from(new TextEncoder().encode(embeddedSvg)));
    expect(compileOGrafPackage(result.sceneData, result.options).status).toBe('ready-to-materialize');
  });

  test('includes normalized embedded images in the browser ZIP', async () => {
    const prepared = prepareLegacyOGrafExport(makeScene(makeLayer({ imageUrl: embeddedSvgUrl })));
    const result = prepared instanceof Promise ? await prepared : prepared;
    const plan = compileOGrafPackage(result.sceneData, result.options);
    const archive = await createOGrafBrowserZip(plan);
    const files = unzipSync(archive.bytes);
    const imagePath = Object.keys(files).find((path) => path.endsWith('.svg'));

    expect(imagePath).toMatch(/^assets\/images\/legacy-[0-9a-f]{8}\.svg$/u);
    expect(Array.from(files[imagePath as string])).toEqual(Array.from(new TextEncoder().encode(embeddedSvg)));
    expect(new TextDecoder().decode(files['graphic.mjs'])).not.toContain('data:image/svg+xml');
  });

  test('keeps remote and executable image sources rejected by the canonical policy', () => {
    for (const imageUrl of ['https://example.com/image.png', 'javascript:alert(1)', 'file:///tmp/image.png', 'data:text/html;base64,PGh0bWw+', unsafeSvgUrl]) {
      const plan = compileOGrafPackage(makeScene(makeLayer({ imageUrl })));
      expect(plan.status).toBe('blocked');
      expect(plan.diagnostics.some((diagnostic) => diagnostic.severity === 'ERROR' && diagnostic.feature === 'image')).toBe(true);
    }
  });

  test('packages a verified local font and blocks an unverified font with remediation', async () => {
    const bytes = new Uint8Array([0, 1, 2, 3]);
    const scene = makeScene(makeLayer({ type: 'custom_text', imageUrl: undefined, textValue: 'Title', fontFamily: 'Inter' }));
    const ready = compileOGrafPackage(scene, {
      assetCatalog: { 'font:Inter': { kind: 'local', packagedPath: 'fonts/inter.woff2', binaryContent: bytes } },
    });
    expect(ready.status).toBe('ready-to-materialize');
    expect(ready.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'font:Inter', packagedPath: 'fonts/inter.woff2', binaryContent: bytes }),
    ]));
    expect(ready.files.find((file) => file.path === 'graphic.mjs')?.content).toContain('@font-face');
    const archive = await createOGrafBrowserZip(ready);
    expect(unzipSync(archive.bytes)['fonts/inter.woff2']).toEqual(bytes);

    const blocked = compileOGrafPackage(scene);
    expect(blocked.status).toBe('blocked');
    expect(blocked.diagnostics.find((diagnostic) => diagnostic.code === 'OGRAF_FONT_UNVERIFIED')?.message).toContain('assetCatalog["font:Inter"]');
  });
});
