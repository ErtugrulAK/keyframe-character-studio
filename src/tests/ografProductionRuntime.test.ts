// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { expect, test } from 'vitest';

/** The host executes the module exported by production-minified compiler code. */
test('a production-exported OGraf module loads and renders a deep affine child', async () => {
  const base = {
    type: 'custom_rect', y: 0, rotation: 0, scaleX: 1, scaleY: 1,
    opacity: 1, visible: true, zIndex: 1, fillColor: '#ff0000',
    strokeColor: '#000000', fillEnabled: true, strokeEnabled: false,
    width: 200, height: 120,
  };
  const layers = [
    { ...base, id: 'root', name: 'Root', x: 40, scaleX: 2, visible: false },
    { ...base, id: 'middle', name: 'Middle', parentId: 'root', x: -100, rotation: 30, visible: false },
    { ...base, id: 'child', name: 'Child', parentId: 'middle', x: 40, y: 15, rotation: 15 },
  ];
  const scene = {
    version: 1, coordinateSystem: 'project-unit-center-v1',
    width: 400, height: 300, fps: 30, totalFrames: 30,
    layers, tracks: layers.map((layer) => ({ partId: layer.id, channels: {} })),
  };
  const runtimePath = fileURLToPath(new URL('../ograf/runtimeTemplate.ts', import.meta.url)).replaceAll('\\', '/');
  const entry = 'virtual:kcs-production-runtime-regression';
  const resolvedEntry = `\0${entry}`;
  const result = await build({
    configFile: false,
    root: fileURLToPath(new URL('../../', import.meta.url)),
    logLevel: 'silent',
    plugins: [{
      name: 'kcs-production-runtime-regression',
      resolveId: (id) => id.endsWith(entry) ? resolvedEntry : undefined,
      load: (id) => id === resolvedEntry
        ? `import { generateGraphicModule } from ${JSON.stringify(runtimePath)}; export const moduleSource = generateGraphicModule(${JSON.stringify(scene)});`
        : undefined,
    }],
    build: { write: false, minify: true, lib: { entry, formats: ['iife'], name: 'KcsProductionCompiler' } },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs.flatMap((output) => 'output' in output ? output.output : [])
    .find((output) => output.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('The production compiler did not emit its module.');
  const moduleSource = new Function(`${chunk.code}\nreturn KcsProductionCompiler.moduleSource;`)() as string;
  const source = moduleSource
    .replace('export default class Graphic', 'return class Graphic')
    .replaceAll('import.meta.url', JSON.stringify('https://example.test/graphic.mjs'));
  class HostElement { innerHTML = ''; }
  const Graphic = new Function('HTMLElement', source)(HostElement) as new () => HostElement & {
    load: (params: { renderType: string }) => Promise<{ statusCode: number }>;
  };
  const graphic = new Graphic();
  expect((await graphic.load({ renderType: 'realtime' })).statusCode).toBe(200);
  const transform = /data-layer-id="child"[^>]*><g transform="([^"]+)"/u.exec(graphic.innerHTML)?.[1];
  const matrix = transform && /matrix\(([^)]+)\)/u.exec(transform);
  if (!matrix) throw new Error('The sheared child was not rendered with its exact affine map.');
  const coefficients = matrix[1].trim().split(/\s+/u).map(Number);
  const expected = [Math.SQRT2, Math.SQRT1_2, -Math.SQRT2, Math.SQRT1_2, -105.7179676972449, 32.99038105676658];
  expected.forEach((value, index) => expect(coefficients[index]).toBeCloseTo(value, 9));
});
