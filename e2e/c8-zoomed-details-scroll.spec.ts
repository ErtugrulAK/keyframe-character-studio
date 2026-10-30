import { test, expect, type Page } from '@playwright/test';
import { openInspectorCard } from './fixtures/inspectorTabs';

/**
 * C8 #3 — at 200 % browser zoom the right sidebar's Details pane was ~134 CSS
 * px tall and its scrolling body a ~30 px strip under the fixed header, layer
 * name and tabs, so the properties could not be reached. A short pane now
 * scrolls as one column; a tall pane keeps its scrolling body.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

async function seed(page: Page): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1',
    width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [{
      id: 'rect', name: 'Rect', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
      visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218', fillEnabled: true, strokeEnabled: true,
    }],
    tracks: [{ partId: 'rect', channels: channel() }],
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: scene },
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('.actor-node', { hasText: 'Rect' }).click();
  await expect(page.locator('.details-actor-header')).toContainText('Rect');
}

const scrollState = (page: Page) => page.evaluate(() => {
  const container = document.querySelector('.details-container') as HTMLElement;
  const body = document.querySelector('.details-container .details-body') as HTMLElement;
  return {
    pane: container.clientHeight,
    containerScrolls: container.scrollHeight > container.clientHeight,
    containerTop: container.scrollTop,
    body: body.clientHeight,
    bodyTop: body.scrollTop,
  };
});

test.describe('200 % zoom (720 × 450 CSS px at 2× pixels)', () => {
  test.use({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 });

  test('the short Details pane scrolls as one column down to its last control', async ({ page }) => {
    await seed(page);
    // Cards start closed: open the one that holds the tab's last control, then
    // start from the top of the pane again.
    await openInspectorCard(page, 'SHAPE GEOMETRY');
    await page.evaluate(() => { (document.querySelector('.details-container') as HTMLElement).scrollTop = 0; });
    const before = await scrollState(page);
    expect(before.pane).toBeLessThan(180);
    expect(before.containerScrolls).toBe(true);

    const pane = await page.locator('.details-container').boundingBox();
    if (!pane) throw new Error('no Details pane');
    await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
    for (let step = 0; step < 10; step += 1) await page.mouse.wheel(0, 300);
    await expect.poll(async () => (await scrollState(page)).containerTop).toBeGreaterThan(0);

    // The last control of the Properties tab is now on screen, inside the pane.
    const convert = page.getByRole('button', { name: 'Convert to editable path' });
    await expect(convert).toBeInViewport();
    const button = await convert.boundingBox();
    expect(button!.y + button!.height).toBeLessThanOrEqual(pane.y + pane.height + 1);
  });
});

test('the default 1440 × 900 pane keeps the fixed header and tabs with a scrolling body', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page);
  const state = await scrollState(page);
  expect(state.pane).toBeGreaterThan(180);
  expect(state.containerScrolls).toBe(false);
  expect(state.body).toBeGreaterThan(75);
});
