/**
 * C2 — Mask Pen: the first point is a screen-space close target that stays
 * correct after zoom and pan; a click just outside it adds a point instead of
 * closing; closing never duplicates the first point; the draft's Undo/Redo
 * never touches masks that already exist; Finish is a visible control.
 */
import { expect, test, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const IMAGE = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#3b82f6"/></svg>',
).toString('base64')}`;

const existingMask = {
  id: 'existing', name: 'Existing', mode: 'add', enabled: true,
  path: { version: 1, coordinateSpace: 'normalized', closed: true, points: [{ id: 'a', x: 0.05, y: 0.05 }, { id: 'b', x: 0.95, y: 0.05 }, { id: 'c', x: 0.95, y: 0.95 }, { id: 'd', x: 0.05, y: 0.95 }] },
};

async function seed(page: Page, layer: Record<string, unknown> = {}): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [{ id: 'img', name: 'Landscape', type: 'custom_image', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#fff', strokeColor: '#000', width: 1200, height: 800, imageUrl: IMAGE, masks: [existingMask], ...layer }],
    tracks: [{ id: 'track-img', partId: 'img', name: 'img', color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() }],
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => {
    localStorage.clear();
    localStorage.setItem(entry.key, entry.value);
  }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().click();
  await openDetailsTab(page, 'Masks');
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
}

async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

async function zoomTo(page: Page, steps: number, direction: 'zoom-in' | 'zoom-out') {
  for (let step = 0; step < steps; step += 1) {
    await page.evaluate((type) => window.dispatchEvent(new CustomEvent('canvas-viewport-command', { detail: { type } })), direction);
  }
}

async function center(page: Page) {
  const box = await page.locator('.stage-canvas-container').boundingBox();
  if (!box) throw new Error('stage');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 + 20 };
}

const firstPointCenter = async (page: Page) => {
  const box = await page.getByTestId('mask-draw-point').first().boundingBox();
  if (!box) throw new Error('no first point');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

for (const zoom of [{ label: 'zoomed out', steps: 4, direction: 'zoom-out' as const }, { label: '100 %', steps: 0, direction: 'zoom-in' as const }, { label: 'zoomed in', steps: 4, direction: 'zoom-in' as const }]) {
  test(`Mask Pen closes on its first point at ${zoom.label}, after a pan, without a duplicate point`, async ({ page }) => {
    await seed(page);
    await zoomTo(page, zoom.steps, zoom.direction);
    const c = await center(page);
    await page.getByRole('button', { name: 'Draw pen mask' }).click();
    for (const [dx, dy] of [[-60, -40], [60, -40], [70, 40], [-50, 50]]) await page.mouse.click(c.x + dx, c.y + dy);
    const points = page.getByTestId('mask-draw-point');
    await expect(points).toHaveCount(4);

    // Move the stage on screen after the points were placed (a layout resize
    // shifts the camera centre): the close target must follow the point's
    // CURRENT screen position, not where it was clicked.
    const beforeResize = await firstPointCenter(page);
    await page.setViewportSize({ width: 1380, height: 900 });
    // The camera re-centres a few frames after the resize; reading the point
    // before that sent the hover to its OLD place (seen as an intermittent
    // miss, 9 in 20 runs on a production build). Wait for the shift itself.
    await expect.poll(async () => Math.abs((await firstPointCenter(page)).x - beforeResize.x)).toBeGreaterThan(10);
    const first = await firstPointCenter(page);

    // Just outside the close radius: adds a point, does not close.
    await page.mouse.click(first.x + 20, first.y);
    await expect(points).toHaveCount(5);
    // Hover inside the radius shows the close target; the click closes.
    await page.mouse.move(first.x + 7, first.y + 5);
    await expect(points.first()).toHaveAttribute('data-close-target', 'true');
    await page.mouse.click(first.x + 7, first.y + 5);
    await expect(page.getByTestId('mask-draw-banner')).toHaveCount(0);

    const scene = await savedScene(page);
    const masks = scene.layers[0].masks;
    expect(masks).toHaveLength(2);
    expect(masks[0]).toEqual(existingMask);
    const created = masks[1].path.points;
    expect(created).toHaveLength(5);
    expect(masks[1].path.closed).toBe(true);
    // No duplicate of the first point at the end.
    const last = created[created.length - 1];
    expect(Math.hypot(last.x - created[0].x, last.y - created[0].y)).toBeGreaterThan(0.001);
  });
}

test('Mask Pen draft Undo/Redo stay inside the draft; Finish is a visible control', async ({ page }) => {
  await seed(page);
  const before = await savedScene(page);
  const c = await center(page);
  await page.getByRole('button', { name: 'Draw pen mask' }).click();
  for (const [dx, dy] of [[-60, -40], [60, -40], [70, 40], [-50, 50]]) await page.mouse.click(c.x + dx, c.y + dy);
  const points = page.getByTestId('mask-draw-point');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(points).toHaveCount(2);
  await page.keyboard.press('Control+Shift+z');
  await expect(points).toHaveCount(3);
  // Undo all the way down: the existing mask is never touched.
  for (let step = 0; step < 5; step += 1) await page.keyboard.press('Control+z');
  await expect(points).toHaveCount(0);
  expect((await savedScene(page)).layers[0].masks).toEqual(before.layers[0].masks);

  for (const [dx, dy] of [[-60, -40], [60, -40], [70, 40]]) await page.mouse.click(c.x + dx, c.y + dy);
  await page.getByRole('button', { name: /Finish mask/ }).click();
  const after = await savedScene(page);
  expect(after.layers[0].masks).toHaveLength(2);
  // One scene Undo removes only the new mask.
  await page.getByTitle('Undo').click();
  expect((await savedScene(page)).layers[0].masks).toEqual(before.layers[0].masks);
});
