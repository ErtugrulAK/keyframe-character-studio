import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * The authoring paint popover: one floating editor per Fill/Stroke swatch.
 *
 * jsdom covers the control contract; this spec is the real-browser proof for
 * pointer drags, viewport containment, the camera invariant and the single
 * history entry a completed drag has to produce.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const ORIGINAL_FILL = '#22d3ee';
const ALPHA = { x: 0, y: 0 };

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const shape = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, type: 'custom_rect', x: ALPHA.x, y: ALPHA.y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: ORIGINAL_FILL, strokeColor: '#101218',
  fillEnabled: true, strokeEnabled: true, width: 160, height: 120,
  ...extra,
});

async function seed(page: Page, layer: Record<string, unknown>): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1',
    width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [layer],
    tracks: [{ partId: layer.id, channels: channel() }],
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: scene },
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('.actor-node', { hasText: String(layer.name) }).first().click();
  await expect(page.locator(`[data-part-id="${layer.id}"]`)).toHaveCount(1);
  await page.getByRole('button', { name: 'Expand APPEARANCE' }).click();
}

const swatch = (page: Page, label: string) => page.getByRole('button', { name: `${label} Color Preview` });
const popover = (page: Page) => page.getByRole('dialog', { name: /Color Picker$/ });

/** The authored paint the swatch renders, read back as the hex the project stores. */
const readPaint = async (page: Page, label = 'FILL COLOR'): Promise<string> => {
  const css = await swatch(page, label).locator('.color-swatch-color').evaluate((node) => (node as HTMLElement).style.backgroundColor);
  const channels = css.match(/\d+/g) ?? ['0', '0', '0'];
  return `#${channels.map((channelValue) => Number(channelValue).toString(16).padStart(2, '0')).join('')}`;
};

const readAlpha = (page: Page, label = 'FILL COLOR') =>
  swatch(page, label).locator('.color-swatch-color').evaluate((node) => (node as HTMLElement).style.opacity);

async function dragWithin(page: Page, target: Locator, from: { fx: number; fy: number }, to: { fx: number; fy: number }) {
  const box = await target.boundingBox();
  if (!box) throw new Error('drag target has no box');
  await page.mouse.move(box.x + box.width * from.fx, box.y + box.height * from.fy);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to.fx, box.y + box.height * to.fy, { steps: 8 });
  await page.mouse.up();
}

async function persistedFill(page: Page): Promise<string | undefined> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').layers?.[0]?.fillColor, STORAGE_KEY);
}

test('opening the paint popover writes nothing to the project', async ({ page }) => {
  await seed(page, shape('alpha', 'Alpha'));
  await page.locator('.autosave-status-badge').click();
  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

  await swatch(page, 'FILL COLOR').click();

  await expect(popover(page)).toHaveCount(1);
  await expect(swatch(page, 'FILL COLOR')).toHaveAttribute('aria-expanded', 'true');
  // A read-only open: opening and closing leaves the persisted project identical.
  expect(await readPaint(page)).toBe(ORIGINAL_FILL);
  await swatch(page, 'FILL COLOR').click();
  await expect(popover(page)).toHaveCount(0);

  await page.locator('.autosave-status-badge').click();
  await expect.poll(() => persistedFill(page)).toBe(ORIGINAL_FILL);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(before);
});

test('a completed saturation/value drag is one undo entry and redo restores it exactly', async ({ page }) => {
  await seed(page, shape('alpha', 'Alpha'));
  await swatch(page, 'FILL COLOR').click();

  const area = page.getByRole('slider', { name: 'FILL COLOR Saturation and Brightness' });
  await dragWithin(page, area, { fx: 0.2, fy: 0.2 }, { fx: 0.8, fy: 0.7 });

  const dragged = await readPaint(page);
  expect(dragged).not.toBe(ORIGINAL_FILL);

  // Escape closes and hands focus back, so the shortcut authority owns the keys.
  await page.keyboard.press('Escape');
  await expect(popover(page)).toHaveCount(0);
  await expect(swatch(page, 'FILL COLOR')).toBeFocused();

  await page.keyboard.press('Control+z');
  await expect.poll(() => readPaint(page)).toBe(ORIGINAL_FILL);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => readPaint(page)).toBe(dragged);
});

test('two gestures are exactly two undo entries', async ({ page }) => {
  await seed(page, shape('alpha', 'Alpha'));
  const area = page.getByRole('slider', { name: 'FILL COLOR Saturation and Brightness' });

  await swatch(page, 'FILL COLOR').click();
  await dragWithin(page, area, { fx: 0.15, fy: 0.15 }, { fx: 0.45, fy: 0.35 });
  const first = await readPaint(page);
  await dragWithin(page, area, { fx: 0.45, fy: 0.35 }, { fx: 0.9, fy: 0.8 });
  const second = await readPaint(page);
  expect(first).not.toBe(second);
  await page.keyboard.press('Escape');

  await page.keyboard.press('Control+z');
  await expect.poll(() => readPaint(page)).toBe(first);
  await page.keyboard.press('Control+z');
  await expect.poll(() => readPaint(page)).toBe(ORIGINAL_FILL);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => readPaint(page)).toBe(first);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => readPaint(page)).toBe(second);
});

test('real pointer drags on the hue and alpha sliders author and persist the paint', async ({ page }) => {
  await seed(page, shape('alpha', 'Alpha'));
  await swatch(page, 'FILL COLOR').click();

  const hue = page.getByRole('slider', { name: 'FILL COLOR Hue' });
  await dragWithin(page, hue, { fx: 0.05, fy: 0.5 }, { fx: 0.7, fy: 0.5 });
  const afterHue = await readPaint(page);
  expect(afterHue).not.toBe(ORIGINAL_FILL);

  const alphaSlider = page.getByRole('slider', { name: 'FILL COLOR Alpha' });
  await dragWithin(page, alphaSlider, { fx: 0.95, fy: 0.5 }, { fx: 0.4, fy: 0.5 });
  const alpha = Number(await readAlpha(page));
  expect(alpha).toBeGreaterThan(0);
  expect(alpha).toBeLessThan(1);

  await page.keyboard.press('Escape');
  await page.locator('.autosave-status-badge').click();
  await expect.poll(() => persistedFill(page)).toBe(afterHue);
  const persistedOpacity = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || '{}').layers?.[0]?.fillOpacity as number,
    STORAGE_KEY,
  );
  // The authored alpha is what the project stored and what the A channel reports.
  expect(persistedOpacity).toBeGreaterThan(0);
  expect(persistedOpacity).toBeLessThan(1);
  await swatch(page, 'FILL COLOR').click();
  await expect(page.getByRole('spinbutton', { name: 'FILL COLOR A' })).toHaveValue(String(Math.round(persistedOpacity * 255)));
});

test('Escape and an outside press close it, and reopening shows the exact current value', async ({ page }) => {
  await seed(page, shape('alpha', 'Alpha'));
  await swatch(page, 'FILL COLOR').click();
  await expect(popover(page)).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(popover(page)).toHaveCount(0);
  await expect(swatch(page, 'FILL COLOR')).toBeFocused();
  await expect(swatch(page, 'FILL COLOR')).toHaveAttribute('aria-expanded', 'false');

  // Author a precise hue with the keyboard, then read it back on reopen.
  await swatch(page, 'FILL COLOR').click();
  const hue = page.getByRole('slider', { name: 'FILL COLOR Hue' });
  await hue.focus();
  await page.keyboard.press('End');
  await expect(hue).toHaveAttribute('aria-valuenow', '360');
  const authored = await readPaint(page);

  // An outside press on non-focusable inspector chrome closes without authoring.
  await page.locator('.details-container').click({ position: { x: 4, y: 4 } });
  await expect(popover(page)).toHaveCount(0);
  expect(await readPaint(page)).toBe(authored);

  await swatch(page, 'FILL COLOR').click();
  await expect(popover(page)).toHaveCount(1);
  await expect(page.getByRole('slider', { name: 'FILL COLOR Hue' })).toHaveAttribute('aria-valuenow', '360');
  await expect(page.getByRole('slider', { name: 'FILL COLOR Alpha' })).toHaveAttribute('aria-valuenow', '255');
});

test('fill and stroke stay independent paints', async ({ page }) => {
  await seed(page, shape('alpha', 'Alpha', { strokeWidth: 4 }));

  await swatch(page, 'FILL COLOR').click();
  await dragWithin(page, page.getByRole('slider', { name: 'FILL COLOR Saturation and Brightness' }), { fx: 0.3, fy: 0.3 }, { fx: 0.7, fy: 0.5 });
  const fill = await readPaint(page, 'FILL COLOR');
  await expect(page.getByTitle('Undo')).toBeEnabled();

  // Opening the stroke swatch closes the fill popover and keeps its own channel.
  await swatch(page, 'STROKE COLOR').click();
  await expect(popover(page)).toHaveCount(1);
  await expect(page.getByRole('dialog', { name: 'STROKE COLOR Color Picker' })).toHaveCount(1);
  await dragWithin(page, page.getByRole('slider', { name: 'STROKE COLOR Saturation and Brightness' }), { fx: 0.1, fy: 0.9 }, { fx: 0.6, fy: 0.2 });
  const stroke = await readPaint(page, 'STROKE COLOR');

  expect(stroke).not.toBe(fill);
  expect(await readPaint(page, 'FILL COLOR')).toBe(fill);
  await page.keyboard.press('Escape');
  await page.locator('.autosave-status-badge').click();
  await expect.poll(() => persistedFill(page)).toBe(fill);
  await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').layers?.[0]?.strokeColor, STORAGE_KEY))
    .not.toBe(fill);
});

test('the popover stays inside the viewport and never moves the authored world', async ({ page }) => {
  await seed(page, shape('alpha', 'Alpha'));
  const worldBefore = await page.locator('[data-part-id="alpha"]').boundingBox();

  await swatch(page, 'FILL COLOR').click();
  const box = await popover(page).boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);

  // The Effects paint sits at the bottom of the sidebar: its popover must still fit.
  await swatch(page, 'SHADOW / GLOW COLOR').click();
  const bottomBox = await popover(page).boundingBox();
  expect(bottomBox!.y).toBeGreaterThanOrEqual(0);
  expect(bottomBox!.y + bottomBox!.height).toBeLessThanOrEqual(viewport!.height);

  await page.keyboard.press('Escape');
  const worldAfter = await page.locator('[data-part-id="alpha"]').boundingBox();
  expect(Math.abs(worldAfter!.x - worldBefore!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(worldAfter!.y - worldBefore!.y)).toBeLessThanOrEqual(1);
});
