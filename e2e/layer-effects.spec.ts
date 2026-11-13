/**
 * Layer effects paint real pixels on the stage: a glow colours the stage
 * around a shape, and Multiply darkens what it covers. Round 6 (OGraf Studio
 * review). The same filter is drawn by the static SVG and the OGraf graphic
 * (`src/tests/layerEffects.test.tsx`).
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const rect = (id: string, x: number, fillColor: string, extra: Record<string, unknown> = {}) => ({
  id, name: id, type: 'custom_rect', x, y: 0, rotation: 0, scaleX: 2, scaleY: 2, opacity: 1, visible: true, zIndex: 1,
  fillColor, strokeColor: fillColor, strokeEnabled: false, ...extra,
});

async function seed(page: Page, layers: Array<Record<string, unknown>>) {
  await page.goto('/');
  await page.evaluate(([key, value]) => { localStorage.clear(); localStorage.setItem(key, value); }, [STORAGE_KEY, JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 30, layers,
    tracks: layers.map((layer) => ({ id: `track-${layer.id}`, partId: layer.id, name: layer.id, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: {} })),
  })] as const);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  // Grid and axes off: nothing but the layers on the sampled pixels.
  await page.getByRole('button', { name: 'Toggle grid' }).first().click();
  await page.getByRole('button', { name: 'Toggle coordinate overlay' }).first().click();
}

/** RGB at screen points, read from a real screenshot. */
const pixels = async (page: Page, points: Array<[number, number]>) => {
  const shot = (await page.screenshot()).toString('base64');
  return page.evaluate(async ([data, at]) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const g = canvas.getContext('2d')!;
    g.drawImage(image, 0, 0);
    return at.map(([x, y]) => Array.from(g.getImageData(Math.round(x), Math.round(y), 1, 1).data).slice(0, 3));
  }, [shot, points] as const);
};

const boxOf = async (page: Page, id: string) => (await page.locator(`.stage-svg g[data-part-id="${id}"]`).first().boundingBox())!;

test('a glow colours the stage around the shape', async ({ page }) => {
  await seed(page, [rect('plain', -300, '#ffffff'), rect('glowing', 300, '#ffffff', { glowColor: '#ffd000', glowSize: 14, glowStrength: 1 })]);
  const plain = await boxOf(page, 'plain');
  // The same distance outside the right edge of each shape (the glowing layer's
  // own box includes its glow, so its shape element is measured).
  const shape = (await page.locator('.stage-svg g[data-part-id="glowing"] rect, .stage-svg g[data-part-id="glowing"] path').first().boundingBox())!;
  const [nearPlain, besideShape] = await pixels(page, [
    [plain.x + plain.width + 4, plain.y + plain.height / 2],
    [shape.x + shape.width + 4, shape.y + shape.height / 2],
  ]);
  expect(nearPlain[0]).toBeLessThan(80);
  expect(besideShape[0]).toBeGreaterThan(nearPlain[0] + 60);
  expect(besideShape[1]).toBeGreaterThan(nearPlain[1] + 40);
  expect(besideShape[2]).toBeLessThan(besideShape[0] - 40);
});

test('Multiply darkens what it covers; Normal does not', async ({ page }) => {
  await seed(page, [
    rect('green', 0, '#00ff00'),
    { ...rect('red', 0, '#ff0000', { blendMode: 'multiply' }), zIndex: 2, scaleX: 1, scaleY: 1 },
  ]);
  const red = await boxOf(page, 'red');
  const [overlap] = await pixels(page, [[red.x + red.width / 2, red.y + red.height / 2]]);
  // Red × green = black.
  expect(Math.max(...overlap)).toBeLessThan(40);

  await page.locator('[role="tree"] [data-layer-id="red"]').click();
  const expand = page.getByRole('button', { name: /^Expand (APPEARANCE|EFFECTS)$/ });
  for (let index = 0; index < await expand.count(); index += 1) await expand.nth(0).click().catch(() => undefined);
  await page.getByLabel('Blend mode').selectOption('normal');
  await page.keyboard.press('Escape');
  await page.mouse.move(5, 5);
  const [normal] = await pixels(page, [[red.x + red.width / 2, red.y + red.height / 2]]);
  expect(normal[0]).toBeGreaterThan(200);
  expect(normal[1]).toBeLessThan(60);
});
