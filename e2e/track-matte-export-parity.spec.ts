import { test, expect, type Page } from '@playwright/test';
import { evaluateOGrafScene } from '../src/ograf/evaluation';
import { renderOGrafSvg } from '../src/ograf/svgRenderer';
import { compileOGrafPackage } from '../src/ograf/packageCompiler';
import { validateSceneForOGraf } from '../src/ograf/validation';
import type { SceneData, SceneLayer } from '../src/types/composition';

/**
 * A Track Matte's soft edge, strength and gradient: the exported graphic (the
 * OGraf runtime and the static GIF/thumbnail renderer) keeps the pixels the
 * editor's stage keeps.
 *
 * Each scene is a pure red target covering the whole canvas, matted by one
 * source. The coverage the matte leaves is read on a grid of points: on the
 * stage from a screenshot (red over the grey artboard: coverage = (R - G) / 255),
 * and from each exported SVG rasterised at the stage's size over grey.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
// Small enough that the whole canvas is on the stage at its opening zoom.
const WIDTH = 480;
const HEIGHT = 270;

const base = (id: string, type: string, extra: Partial<SceneLayer>): SceneLayer => ({
  id, name: id, type, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#ffffff', strokeColor: '#000000', strokeEnabled: false, ...extra,
} as SceneLayer);

const matteScene = (source: SceneLayer, trackMatte: NonNullable<SceneLayer['trackMatte']>): SceneData => ({
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Track matte parity',
  width: WIDTH, height: HEIGHT, fps: 30, totalFrames: 30,
  layers: [
    { ...source, visible: true },
    // 120 x 60 scaled to the canvas.
    base('target', 'custom_rect', { zIndex: 2, fillColor: '#ff0000', scaleX: WIDTH / 120, scaleY: HEIGHT / 60, trackMatte: { ...trackMatte, sourceVisible: false } }),
  ],
  tracks: [],
});

const CASES: Array<{ name: string; scene: SceneData }> = [
  { name: 'a soft-edged alpha matte', scene: matteScene(base('source', 'custom_circle', { scaleX: 1.5, scaleY: 1.5 }), { sourceLayerId: 'source', mode: 'alpha', feather: 15 }) },
  { name: 'a half-strength inverted alpha matte', scene: matteScene(base('source', 'custom_circle', { scaleX: 1.5, scaleY: 1.5 }), { sourceLayerId: 'source', mode: 'alpha', inverted: true, strength: 0.5 }) },
  { name: 'a half-strength inverted luminance matte', scene: matteScene(base('source', 'custom_circle', { scaleX: 1.5, scaleY: 1.5 }), { sourceLayerId: 'source', mode: 'luminance', inverted: true, strength: 0.5 }) },
  { name: 'a linear gradient on a turned, stretched shape', scene: matteScene(base('source', 'custom_rect', { scaleX: 2.5, scaleY: 1.5, rotation: 30 }), { sourceLayerId: 'source', mode: 'alpha', gradient: { angle: 45 } }) },
  { name: 'a radial luminance gradient, soft and at 70 %', scene: matteScene(base('source', 'custom_box', { scaleX: 3, scaleY: 2 }), { sourceLayerId: 'source', mode: 'luminance', feather: 8, strength: 0.7, gradient: { type: 'radial', angle: 0 } }) },
  { name: 'a soft text matte under a gradient', scene: matteScene(base('source', 'custom_text', { textValue: 'MATTE', fontSize: 65, textOrigin: 'center' }), { sourceLayerId: 'source', mode: 'alpha', feather: 3, gradient: { angle: 0 } }) },
  { name: 'an inverted soft text matte', scene: matteScene(base('source', 'custom_text', { textValue: 'MATTE', fontSize: 65, textOrigin: 'center' }), { sourceLayerId: 'source', mode: 'alpha', inverted: true, feather: 3, strength: 0.8 }) },
];

const COLUMNS = 48;
const ROWS = 27;

async function seed(page: Page, scene: SceneData) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(([key, data]) => localStorage.setItem(key, data), [STORAGE_KEY, JSON.stringify(scene)]);
  await page.goto('/');
  await expect(page.locator('.stage-svg [data-part-id="target"]').first()).toBeAttached({ timeout: 30000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  for (const name of ['Toggle coordinate overlay', 'Toggle grid']) {
    const toggle = page.getByRole('button', { name });
    if (await toggle.count() && await toggle.first().getAttribute('aria-pressed') === 'true') await toggle.first().click();
  }
  await page.mouse.move(0, 0);
}

/** Coverage of the grid points in a PNG, within `box` (screen pixels of the PNG). */
const coverageOf = (page: Page, png: string, box: { x: number; y: number; width: number; height: number }) => page.evaluate(async ({ source, area, columns, rows }) => {
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#808080';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  const values: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = Math.round(area.x + ((column + 0.5) / columns) * area.width);
      const y = Math.round(area.y + ((row + 0.5) / rows) * area.height);
      const [r, g] = context.getImageData(x, y, 1, 1).data;
      values.push(Math.max(0, Math.min(1, (r - g) / 255)));
    }
  }
  return values;
}, { source: png, area: box, columns: COLUMNS, rows: ROWS });

/**
 * An exported SVG drawn in the page (so it uses the page's fonts, as the stage
 * does) at `width` x `height` over grey, screenshotted and read on the grid.
 */
const exportedCoverage = async (page: Page, svg: string, width: number, height: number) => {
  const sized = svg.replace(/<svg\b([^>]*)>/u, (_match, attributes: string) => `<svg${attributes.replace(/\s(width|height)="[^"]*"/gu, '')} width="${width}" height="${height}">`);
  await page.evaluate(({ markup, w, h }) => {
    const host = document.createElement('div');
    host.id = 'matte-parity-host';
    host.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;z-index:2147483647;background:#808080;line-height:0`;
    host.innerHTML = markup;
    document.body.appendChild(host);
  }, { markup: sized, w: width, h: height });
  await page.evaluate(async () => { await document.fonts.ready; });
  const shot = await page.screenshot({ clip: { x: 0, y: 0, width, height } });
  await page.evaluate(() => document.getElementById('matte-parity-host')?.remove());
  return coverageOf(page, `data:image/png;base64,${shot.toString('base64')}`, { x: 0, y: 0, width, height });
};

const runtimeSvg = (page: Page, scene: SceneData) => page.evaluate(async (moduleSource) => {
  const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(moduleSource.replaceAll('import.meta.url', 'location.href'))}`;
  const module = await import(/* @vite-ignore */ url);
  const tag = `x-matte-parity-${Math.random().toString(36).slice(2)}`;
  customElements.define(tag, module.default);
  const graphic = document.createElement(tag) as HTMLElement & { load: (params: unknown) => Promise<unknown>; playAction: (params: unknown) => Promise<unknown> };
  document.body.appendChild(graphic);
  await graphic.load({ renderType: 'realtime', data: {} });
  await graphic.playAction({ skipAnimation: true });
  const markup = graphic.querySelector('svg')!.outerHTML;
  graphic.remove();
  return markup;
}, compileOGrafPackage(scene).files.find((file) => file.path === 'graphic.mjs')?.content || '');

/**
 * Mean and worst coverage difference over the grid. A point on a HARD edge
 * (its 3x3 stage neighbourhood runs from covered to empty) reads that edge's
 * anti-aliasing, which a sub-pixel shift of the camera can move anywhere
 * between the two sides; there the export must stay within the range the stage
 * shows around the point. Every other point is compared exactly.
 */
const compare = (stage: number[], exported: number[]) => {
  let total = 0;
  let worst = 0;
  for (let index = 0; index < stage.length; index += 1) {
    const difference = Math.abs(stage[index] - exported[index]);
    total += difference;
    const column = index % COLUMNS;
    const neighbourhood = [-1, 0, 1].flatMap((dr) => [-1, 0, 1].map((dc) => (
      column + dc >= 0 && column + dc < COLUMNS ? stage[index + dr * COLUMNS + dc] : undefined
    ))).filter((value): value is number => value !== undefined);
    const low = Math.min(...neighbourhood);
    const high = Math.max(...neighbourhood);
    const onHardEdge = high - low > 0.8;
    const miss = onHardEdge ? Math.max(0, exported[index] - high, low - exported[index]) : difference;
    worst = Math.max(worst, miss);
  }
  return { mean: total / stage.length, worst };
};

for (const { name, scene } of CASES) {
  test(`${name}: the export keeps the pixels the stage keeps`, async ({ page }) => {
    expect(validateSceneForOGraf(scene).diagnostics.filter((diagnostic) => diagnostic.severity === 'ERROR')).toEqual([]);
    await seed(page, scene);
    const target = (await page.locator('.stage-svg [data-part-id="target"]').first().boundingBox())!;
    const shot = await page.screenshot({ clip: target });
    const width = Math.round(target.width);
    const height = Math.round(target.height);
    const stage = await coverageOf(page, `data:image/png;base64,${shot.toString('base64')}`, { x: 0, y: 0, width, height });

    const svgs = { runtime: await runtimeSvg(page, scene), static: renderOGrafSvg(evaluateOGrafScene(scene, 0)) };
    // The matte must do something: neither empty nor the whole canvas.
    const mean = stage.reduce((sum, value) => sum + value, 0) / stage.length;
    expect(mean).toBeGreaterThan(0.02);
    expect(mean).toBeLessThan(0.98);

    for (const [renderer, svg] of Object.entries(svgs)) {
      const result = compare(stage, await exportedCoverage(page, svg, width, height));
      // Measured (2026-11-03): mean 0.0004-0.0019 for every case. Hard-edge
      // points are held to the stage's local range (see `compare`): their
      // anti-aliasing depends on the camera's sub-pixel phase (2026-11-05: one
      // edge point read 0.52 on the stage and 0.16 in the export, between
      // neighbours of 0.00 and 0.96).
      expect(result.mean, `${renderer} mean coverage difference`).toBeLessThan(0.01);
      expect(result.worst, `${renderer} worst point`).toBeLessThan(0.3);
    }
  });
}
