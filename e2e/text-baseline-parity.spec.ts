import { test, expect, type Page } from '@playwright/test';

/**
 * A text layer's glyphs land in the same place on the stage, in its text matte
 * and in the OGraf/GIF renderer.
 *
 * The stage draws text on its baseline. The text matte mask and the OGraf/GIF
 * renderer used dominant-baseline="middle", which put their glyphs about a
 * quarter of a line lower (19px on screen, 21 units, for 80px Arial): a text
 * matte cut below the letters the user saw, and an export moved the text down.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const layer = (id: string, name: string, type: string, overrides: Record<string, unknown> = {}) => ({
  id, name, type,
  x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1,
  fillColor: '#ff0000', strokeColor: '#101218', strokeWidth: 2, borderRadius: 0,
  width: 60, height: 60,
  ...overrides,
});

const textSource = (overrides: Record<string, unknown> = {}) =>
  layer('txt', 'Source', 'custom_text', { textValue: 'HHH', fontSize: 80, fontFamily: 'Arial', strokeEnabled: false, ...overrides });

/** A green target far larger than the text, so the mask is never clipped by it. */
const coveringTarget = () =>
  layer('tgt', 'Target', 'custom_rect', { zIndex: 2, fillColor: '#00ff00', scaleX: 12, scaleY: 8, matte: { sourcePartId: 'txt', mode: 'alpha' } });

const scene = (layers: Record<string, unknown>[]) => ({
  version: 1, layers, tracks: [],
  fps: 30, totalFrames: 90, width: 1920, height: 1080,
  projectResolution: { width: 1920, height: 1080 },
  _sceneTitle: 'Text baseline parity',
});

async function seed(page: Page, layers: Record<string, unknown>[]): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(([key, data]) => localStorage.setItem(key, data), [STORAGE_KEY, JSON.stringify(scene(layers))]);
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  const overlayToggle = page.getByRole('button', { name: 'Toggle coordinate overlay' });
  if (await overlayToggle.getAttribute('aria-pressed') === 'true') await overlayToggle.click();
  await expect(page.locator('.canvas-coordinate-overlay')).toHaveCount(0);
  await expect(page.locator('.stage-svg [data-part-id="txt"] text').first()).toBeAttached();
}

type InkBox = { x0: number; x1: number; y0: number; y1: number };

/** The screen box of the pure-red (stage text) or pure-green (matted target) pixels on the stage. */
async function inkBox(page: Page, channel: 'red' | 'green'): Promise<InkBox | null> {
  const stage = page.locator('.stage-svg').first();
  const png = await stage.screenshot();
  return page.evaluate(async ([base64, wanted]) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const i = (y * canvas.width + x) * 4;
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        const hit = wanted === 'red' ? r > 180 && g < 80 && b < 80 : g > 180 && r < 80 && b < 80;
        if (!hit) continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    return Number.isFinite(x0) ? { x0, x1, y0, y1 } : null;
  }, [png.toString('base64'), channel] as const);
}

test('a text matte cuts exactly where the stage draws the letters', async ({ page }) => {
  await seed(page, [textSource()]);
  const letters = await inkBox(page, 'red');

  // The same source, hidden, now only drives the matte of a covering green target.
  await seed(page, [textSource({ visible: false }), coveringTarget()]);
  const cut = await inkBox(page, 'green');

  expect(letters, 'the stage drew no text').not.toBeNull();
  expect(cut, 'the matte let no green through').not.toBeNull();
  // Same glyph box within anti-aliasing (the old middle-baseline mask sat 19px lower).
  for (const edge of ['x0', 'x1', 'y0', 'y1'] as const) {
    expect(Math.abs(cut![edge] - letters![edge]), `matte ${edge} vs stage ${edge}`).toBeLessThanOrEqual(2);
  }
});

test('the OGraf/GIF renderer puts the text where the stage does', async ({ page }) => {
  await seed(page, [textSource()]);
  const boxes = await page.evaluate(async () => {
    const stageText = document.querySelector<SVGTextElement>('.stage-svg [data-part-id="txt"] text')!;
    const stage = stageText.getBBox();
    const { evaluateSceneFrame } = await import('/src/ograf/evaluation.ts');
    const { renderOGrafSvg } = await import('/src/ograf/svgRenderer.ts');
    const persisted = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5')!);
    const host = document.createElement('div');
    host.innerHTML = renderOGrafSvg(evaluateSceneFrame(persisted, 0));
    document.body.appendChild(host);
    const exported = host.querySelector<SVGTextElement>('text')!.getBBox();
    host.remove();
    return { stage: { y: stage.y, height: stage.height }, exported: { y: exported.y, height: exported.height } };
  });
  // Both boxes are in the layer's local units (origin on the layer position).
  expect(Math.abs(boxes.exported.y - boxes.stage.y), 'export vs stage glyph top').toBeLessThanOrEqual(1);
  expect(Math.abs(boxes.exported.height - boxes.stage.height)).toBeLessThanOrEqual(1);
});

for (const origin of ['center', 'baseline'] as const) {
  test(`a ${origin}-origin text: its matte cut and its OGraf render match the stage`, async ({ page }) => {
    await seed(page, [textSource({ textOrigin: origin })]);
    const letters = await inkBox(page, 'red');
    const boxes = await page.evaluate(async () => {
      const stage = document.querySelector<SVGTextElement>('.stage-svg [data-part-id="txt"] text')!.getBBox();
      const { evaluateSceneFrame } = await import('/src/ograf/evaluation.ts');
      const { renderOGrafSvg } = await import('/src/ograf/svgRenderer.ts');
      const host = document.createElement('div');
      host.innerHTML = renderOGrafSvg(evaluateSceneFrame(JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5')!), 0));
      document.body.appendChild(host);
      const exported = host.querySelector<SVGTextElement>('text')!.getBBox();
      host.remove();
      return { stage: { y: stage.y, height: stage.height }, exported: { y: exported.y, height: exported.height } };
    });
    expect(Math.abs(boxes.exported.y - boxes.stage.y), 'export vs stage glyph top').toBeLessThanOrEqual(1);

    await seed(page, [textSource({ textOrigin: origin, visible: false }), coveringTarget()]);
    const cut = await inkBox(page, 'green');
    for (const edge of ['x0', 'x1', 'y0', 'y1'] as const) {
      expect(Math.abs(cut![edge] - letters![edge]), `matte ${edge} vs stage ${edge}`).toBeLessThanOrEqual(2);
    }
  });
}

test('a centre-origin text sits with its box centred on the origin; a baseline text sits above it', async ({ page }) => {
  const glyphCentreY = async (origin: 'center' | 'baseline') => {
    await seed(page, [textSource({ textOrigin: origin })]);
    return page.evaluate(() => {
      const box = document.querySelector<SVGTextElement>('.stage-svg [data-part-id="txt"] text')!.getBBox();
      return box.y + box.height / 2;
    });
  };
  // Local units, origin at 0: the em box centre of 80px text is 0.346 em above its baseline.
  expect(Math.abs(await glyphCentreY('center')), 'centred text box centre').toBeLessThanOrEqual(3);
  expect(await glyphCentreY('baseline'), 'baseline text box centre').toBeLessThan(-20);
});
