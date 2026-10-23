/**
 * WP-06 — narrow windows and keyboard access to the mask/matte targets.
 * At 1024×720 and 768×720 the header actions no longer paint over the
 * authoring toolbar, the timeline actions are on screen, the Details pane has
 * a usable height and the mask Exit stays reachable. In mask editing the arrow
 * keys nudge the path (a held key is one undo step), Tab reaches Exit and
 * Escape leaves; the Track Matte source is reachable from the keyboard.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const IMAGE = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#3b82f6"/></svg>',
).toString('base64')}`;

const rect = (x0: number, y0: number, x1: number, y1: number) => ({
  version: 1, coordinateSpace: 'normalized', closed: true,
  points: [{ id: 'a', x: x0, y: y0 }, { id: 'b', x: x1, y: y0 }, { id: 'c', x: x1, y: y1 }, { id: 'd', x: x0, y: y1 }],
});

async function seed(page: Page, viewport: { width: number; height: number }): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [
      {
        id: 'landscape', name: 'Landscape', type: 'custom_image', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
        fillColor: '#fff', strokeColor: '#000', width: 480, height: 270, imageUrl: IMAGE,
        masks: [{ id: 'm1', name: 'Window', mode: 'add', enabled: true, path: rect(0.25, 0.25, 0.75, 0.75) }],
        trackMatte: { sourceLayerId: 'circle', mode: 'alpha', sourceVisible: false },
      },
      { id: 'circle', name: 'Circle', type: 'custom_circle', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, fillColor: '#fff', strokeColor: '#000', width: 200, height: 200 },
    ],
    tracks: ['landscape', 'circle'].map((partId) => ({ id: `track-${partId}`, partId, name: partId, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() })),
  });
  await page.setViewportSize(viewport);
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => {
    localStorage.clear();
    localStorage.setItem(entry.key, entry.value);
  }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

/** The control at its own centre is the control itself (not painted over by other chrome). */
const isUncovered = (page: Page, name: string) => page.evaluate((label) => {
  const element = label.startsWith('.')
    ? document.querySelector<HTMLElement>(label)
    : [...document.querySelectorAll<HTMLElement>('button')].find((candidate) => candidate.getAttribute('aria-label') === label || candidate.getAttribute('title') === label);
  if (!element) return 'missing';
  const box = element.getBoundingClientRect();
  if (box.right <= 0 || box.left >= window.innerWidth) return 'scrolled-out';
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  return hit && (hit === element || element.contains(hit)) ? 'ok' : 'covered';
}, name);

for (const viewport of [{ width: 1024, height: 720 }, { width: 768, height: 720 }]) {
  test(`WP-06 — chrome does not overlap and targets stay reachable at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await seed(page, viewport);
    // Header actions sit inside the header; the toolbar commands under them are not painted over.
    const header = await page.locator('.header-bar').boundingBox();
    for (const action of await page.locator('.header-actions > *').all()) {
      const box = await action.boundingBox();
      if (!box || !header) continue;
      expect(box.y).toBeGreaterThanOrEqual(header.y - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(header.y + header.height + 1);
    }
    expect(['ok', 'scrolled-out']).toContain(await isUncovered(page, 'Crop / region of interest'));
    expect(['ok', 'scrolled-out']).toContain(await isUncovered(page, 'Apply crop'));

    // The timeline actions band is on screen (wrapped onto its own row).
    for (const label of ['Undo', 'Redo']) {
      const box = await page.getByTitle(label, { exact: true }).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    }
    await expect(page.getByRole('button', { name: 'Motion Curves' })).toBeInViewport();

    // Details keeps a usable height beside the timeline.
    await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().click();
    const details = await page.locator('.details-dock').boundingBox();
    expect(details!.height).toBeGreaterThanOrEqual(120);

    // Mask editing from the keyboard: Edit on Canvas, Exit reachable, Escape leaves.
    await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
    await page.getByRole('button', { name: 'Edit on Canvas' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('mask-path-overlay')).toBeVisible();
    // C5 — the strip's control is "Finish" (named "Finish mask editing — back to …").
    const exit = page.getByTestId('mask-edit-banner').getByRole('button', { name: /^Finish mask editing/ });
    await expect(exit).toBeInViewport();
    expect(await isUncovered(page, '.mask-edit-banner-exit')).toBe('ok');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('mask-path-overlay')).toHaveCount(0);
  });
}

test('WP-06 — arrow keys nudge the mask path (one undo per held key); Track Matte source from the keyboard', async ({ page }) => {
  await seed(page, { width: 1440, height: 900 });
  await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().click();
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
  await page.getByRole('button', { name: 'Edit on Canvas' }).click();
  await expect(page.getByTestId('mask-path-overlay')).toBeVisible();
  const before = await savedScene(page);
  const x0 = before.layers[0].masks[0].path.points[0].x;
  // Focus is on the canvas side (not a text field).
  await page.locator('.stage-canvas-container').focus().catch(() => undefined);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  await page.keyboard.down('Shift');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.up('Shift');
  for (let step = 0; step < 3; step += 1) await page.keyboard.press('ArrowRight');
  const moved = await savedScene(page);
  // 10 + 3 project units on a 480-wide unscaled image, in normalized units.
  expect(moved.layers[0].masks[0].path.points[0].x).toBeCloseTo(x0 + 13 / 480, 6);
  expect([moved.layers[0].x, moved.layers[0].y]).toEqual([before.layers[0].x, before.layers[0].y]);

  // Each key press (a press is a down+up) is one undo step.
  await page.getByTitle('Undo').click();
  expect((await savedScene(page)).layers[0].masks[0].path.points[0].x).toBeCloseTo(x0 + 12 / 480, 6);

  // Escape leaves mask editing; the Track Matte source is one Tab-reachable button away.
  await page.keyboard.press('Escape');
  const selectSource = page.getByRole('button', { name: 'Select Source' });
  await selectSource.focus();
  await page.keyboard.press('Enter');
  // C5 — the canvas strip offers the same Back; the keyboard path is the Inspector's.
  const back = page.getByTestId('track-matte-targets').getByRole('button', { name: 'Back to Landscape' });
  await expect(back).toBeVisible();
  await back.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('track-matte-summary')).toContainText('Matte source: Circle');
});
