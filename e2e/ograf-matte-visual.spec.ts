import { test, expect, type Page } from '@playwright/test';
import { evaluateOGrafScene } from '../src/ograf/evaluation';
import { renderOGrafSvg } from '../src/ograf/svgRenderer';
import { compileOGrafPackage } from '../src/ograf/packageCompiler';
import type { SceneData, SceneLayer } from '../src/types/composition';

/**
 * The track matte is a *visual* contract: what matters is which pixels the target
 * keeps. String assertions on the mask markup cannot tell an inverted matte from
 * a broken one — an alpha mask whose source is painted black is still opaque
 * everywhere — so these cases rasterize the real exported SVG in Chromium and
 * sample the pixels inside and outside the matte source.
 *
 * The scene is fixed: a full-canvas target and a circle at the centre, so
 * "inside" is the circle and "outside" is the corner.
 */

const WIDTH = 200;
const HEIGHT = 200;
/** Inside the matte source (the circle's centre). */
const INSIDE_SOURCE: [number, number] = [100, 100];
/** Inside the target but outside the source: the point the matte decides. */
const OUTSIDE_SOURCE: [number, number] = [50, 100];

/** A target covering the whole canvas, so every sample point is inside it. */
const canvasPath = {
  version: 1 as const,
  coordinateSpace: 'local' as const,
  closed: true,
  points: [
    { x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }, { x: -100, y: 100 },
  ],
};

const matteScene = (mode: 'alpha' | 'luminance', inverted: boolean): SceneData => {
  const source: SceneLayer = {
    id: 'source', name: 'Source', type: 'custom_circle',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 0,
    fillColor: '#ffffff', strokeColor: '#000000', strokeEnabled: false, width: 60, height: 60,
  };
  const target: SceneLayer = {
    id: 'target', name: 'Target', type: 'custom_freeform',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
    fillColor: '#ff0000', strokeColor: '#000000', strokeEnabled: false,
    path: canvasPath,
    trackMatte: { sourceLayerId: 'source', mode, inverted, sourceVisible: false },
  };
  return {
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    name: 'Matte visual probe',
    width: WIDTH,
    height: HEIGHT,
    fps: 30,
    totalFrames: 30,
    layers: [source, target],
    tracks: [],
  };
};

/** Rasterizes an SVG document in the page and reports the alpha of both points. */
const sampleAlpha = (page: Page, svg: string) => page.evaluate(async ({ markup, points }) => {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('the SVG did not load'));
    image.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 200;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2d context');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  return points.map(([x, y]) => context.getImageData(x, y, 1, 1).data[3]);
}, { markup: svg, points: [INSIDE_SOURCE, OUTSIDE_SOURCE] });

test.beforeEach(async ({ page }) => {
  await page.setContent('<!doctype html><html><body></body></html>');
});

test('an inverted alpha matte is transparent where the source draws and opaque around it', async ({ page }) => {
  const svg = renderOGrafSvg(evaluateOGrafScene(matteScene('alpha', true), 0));
  const [inside, outside] = await sampleAlpha(page, svg);

  expect(inside).toBe(0);
  expect(outside).toBe(255);
});

test('a normal alpha matte keeps the source and drops everything around it', async ({ page }) => {
  const svg = renderOGrafSvg(evaluateOGrafScene(matteScene('alpha', false), 0));
  const [inside, outside] = await sampleAlpha(page, svg);

  expect(inside).toBe(255);
  expect(outside).toBe(0);
});

test('an inverted luminance matte still inverts after the alpha fix', async ({ page }) => {
  const svg = renderOGrafSvg(evaluateOGrafScene(matteScene('luminance', true), 0));
  const [inside, outside] = await sampleAlpha(page, svg);

  expect(inside).toBe(0);
  expect(outside).toBe(255);
});

test('the generated runtime renders the same inverted alpha matte as the canonical renderer', async ({ page }) => {
  const authored = matteScene('alpha', true);
  const plan = compileOGrafPackage(authored);
  const source = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';
  expect(source).not.toBe('');

  const runtimeSvg = await page.evaluate(async (moduleSource) => {
    // The specifier only exists at runtime: it is the compiled package the
    // exporter just produced, so a static import cannot name it.
    const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(moduleSource.replaceAll('import.meta.url', 'location.href'))}`;
    const module = await import(/* @vite-ignore */ url);
    const tag = `x-ograf-matte-visual-${Math.random().toString(36).slice(2)}`;
    customElements.define(tag, module.default);
    const graphic = document.createElement(tag) as HTMLElement & { load: (params: unknown) => Promise<unknown> };
    document.body.appendChild(graphic);
    await graphic.load({ renderType: 'realtime', data: {} });
    return graphic.innerHTML;
  }, source);

  const [inside, outside] = await sampleAlpha(page, runtimeSvg);
  expect(inside).toBe(0);
  expect(outside).toBe(255);
});
