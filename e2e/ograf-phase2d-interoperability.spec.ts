import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, normalize, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { test, expect } from '@playwright/test';
import type { AnimationTrackData, PropertyKeyframe } from '../src/types/animator';
import type { SceneData, SceneLayer } from '../src/types/composition';
import { compileOGrafPackage } from '../src/ograf/packageCompiler';
import { materializeOGrafPackage } from '../src/ograf/packageWriter';

const ONE_PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

function makeLayer(overrides: Partial<SceneLayer> = {}): SceneLayer {
  return {
    id: 'target',
    name: 'Target',
    type: 'custom_rect',
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    visible: true,
    zIndex: 1,
    fillColor: '#e11d48',
    strokeColor: '#111827',
    fillEnabled: true,
    strokeEnabled: true,
    strokeWidth: 4,
    strokeAlignment: 'inside',
    trimPathEnabled: true,
    trimPathStart: 0.15,
    trimPathEnd: 0.85,
    trimPathOffset: 30,
    width: 120,
    height: 60,
    ...overrides,
  };
}

function makeTrack(partId: string): AnimationTrackData {
  const x: PropertyKeyframe[] = [
    { id: 'x0', frame: 0, value: -40, easing: 'easeInOut' },
    { id: 'x1', frame: 60, value: 40, easing: 'easeInOut' },
  ];
  return {
    partId,
    channels: {
      x,
      y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
      trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
    },
  };
}

function makeFixture(sourceImage: string): SceneData {
  return {
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    name: 'Phase 2D Interoperability Fixture',
    width: 320,
    height: 180,
    fps: 60,
    totalFrames: 60,
    layers: [
      makeLayer({ id: 'source', name: 'Matte Source', type: 'custom_circle', zIndex: 0, strokeEnabled: false, trimPathEnabled: undefined }),
      makeLayer({ id: 'target', parentId: undefined, matte: { sourcePartId: 'source', mode: 'clip' } }),
      makeLayer({ id: 'headline', name: 'Headline', type: 'custom_text', zIndex: 2, textValue: 'Initial', fillColor: '#ffffff', strokeColor: 'none', trimPathEnabled: undefined }),
      makeLayer({ id: 'image', name: 'Logo', type: 'custom_image', zIndex: 3, imageUrl: sourceImage, width: 32, height: 32, fillColor: 'none', strokeColor: 'none', trimPathEnabled: undefined }),
    ],
    tracks: [makeTrack('target')],
  };
}

async function startPackageServer(root: string): Promise<{ server: Server; url: string }> {
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
      if (pathname === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        response.end('<!doctype html><html><body></body></html>');
        return;
      }
      const relativePath = pathname.replace(/^\//u, '');
      const filePath = join(root, normalize(relativePath));
      if (relative(root, filePath).startsWith('..')) {
        response.writeHead(403).end();
        return;
      }
      const content = await readFile(filePath);
      const contentType = filePath.endsWith('.mjs') || filePath.endsWith('.json') ? 'application/javascript; charset=utf-8' : 'image/png';
      response.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
      response.end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(0, '127.0.0.1', () => resolvePromise());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Package server did not expose a TCP address.');
  return { server, url: `http://127.0.0.1:${address.port}` };
}

test('materialized KCS OGraf package interoperates with Chromium', async ({ page }) => {
  const root = await mkdtemp(join(tmpdir(), 'kcs-ograf-phase2d-'));
  const sourceImage = join(root, 'source-logo.png');
  const packageRoot = join(root, 'package');
  await writeFile(sourceImage, ONE_PIXEL_PNG);
  const authored = makeFixture('assets/source-logo.png');
  const plan = compileOGrafPackage(authored, {
    publicTextFields: [{ id: 'headlineText', layerId: 'headline' }],
    assetCatalog: {
      'assets/source-logo.png': {
        kind: 'local',
        sourcePath: sourceImage,
        packagedPath: 'assets/images/logo.png',
      },
    },
  });
  expect(plan.status).toBe('ready-to-materialize');
  const materialized = await materializeOGrafPackage(plan, packageRoot);
  expect(materialized.status).toBe('complete');
  const manifestPath = materialized.files.find((file) => file.kind === 'manifest')?.path;
  const manifest = JSON.parse(await readFile(join(packageRoot, manifestPath || ''), 'utf8')) as Record<string, unknown>;
  expect(materialized.files.filter((file) => file.kind === 'manifest')).toHaveLength(1);
  expect(manifest.$schema).toBe('https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json');
  expect(manifest.main).toBe('graphic.mjs');
  expect(manifest.supportsRealTime).toBe(true);
  expect(manifest.supportsNonRealTime).toBe(false);
  expect(manifest.customActions).toBeUndefined();
  const generatedScene = await readFile(join(packageRoot, 'scene.kcs'), 'utf8');
  expect(generatedScene).not.toMatch(/(?:[A-Z]:\\\\|\/Users\/|\/home\/|localhost|node_modules|react|src\/)/iu);
  const generatedRuntime = await readFile(join(packageRoot, 'graphic.mjs'), 'utf8');
  expect(generatedRuntime).not.toMatch(/localhost|node_modules|react-dom|(?:^|['"])src\//iu);
  expect(generatedRuntime).not.toMatch(/(?:[A-Z]:\\\\|\/Users\/|\/home\/)/u);
  const { server, url } = await startPackageServer(packageRoot);

  try {
    await page.goto(`${url}/`);
    const result = await page.evaluate(async () => {
      const guard = (label: string, promise: Promise<unknown>) => Promise.race([
        promise,
        new Promise((resolve) => setTimeout(() => resolve({ timeout: label }), 5000)),
      ]);
      const module = await import(`/graphic.mjs?phase2d=${Date.now()}`);
      const tagName = 'x-kcs-phase2d-graphic';
      customElements.define(tagName, module.default);
      const graphic = document.createElement(tagName);
      document.body.append(graphic);
      const loadResult = await guard('load', graphic.load({ renderType: 'realtime', data: { headlineText: 'Updated' } }));
      const initialSvg = graphic.innerHTML;
      const imageHref = graphic.querySelector('image')?.getAttribute('href') || '';
      const imageResponse = await guard('asset-fetch', fetch(new URL(imageHref, location.href)));
      const _activePlay = graphic.playAction({});
      await new Promise((resolve) => setTimeout(resolve, 50));
      const intermediateSvg = graphic.innerHTML;
      const stopResult = await guard('stop', graphic.stopAction({ skipAnimation: true }));
      const finalPlayResult = await guard('final-play', graphic.playAction({ skipAnimation: true }));
      const finalSvg = graphic.innerHTML;
      const updateResult = await guard('update', graphic.updateAction({ data: { headlineText: 'Updated Again' } }));
      const updatedSvg = graphic.innerHTML;
      const disposeResult = await guard('dispose', graphic.dispose());
      return {
        loadResult,
        initialSvg,
        intermediateSvg,
        finalSvg,
        updatedSvg,
        imageHref,
        imageOk: imageResponse.ok,
        finalPlayResult,
        stopResult,
        updateResult,
        disposeResult,
        disposedMarkup: graphic.innerHTML,
      };
    });

    expect(result.loadResult).toMatchObject({ statusCode: 200 });
    expect(result.initialSvg).toContain('<svg');
    expect(result.initialSvg).toContain('Updated');
    expect(result.initialSvg).toContain('stroke-dasharray');
    expect(result.initialSvg).toContain('inside-stroke-target');
    expect(result.initialSvg).toContain('kcs-clip-source');
    expect(result.imageHref).toBe('assets/images/logo.png');
    expect(result.imageOk).toBe(true);
    expect(result.intermediateSvg).toContain('data-layer-id="target"');
    expect(result.finalSvg).not.toBe(result.intermediateSvg);
    expect(result.finalPlayResult).toMatchObject({ statusCode: 200, currentStep: 0 });
    expect(result.stopResult).toMatchObject({ statusCode: 200 });
    expect(result.updateResult).toMatchObject({ statusCode: 200 });
    expect(result.updatedSvg).toContain('Updated Again');
    expect(result.disposeResult).toMatchObject({ statusCode: 200 });
    expect(result.disposedMarkup).toBe('');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    await rm(root, { recursive: true, force: true });
  }
});
