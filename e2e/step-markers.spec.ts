import { test, expect, type Page } from '@playwright/test';

/**
 * Multi-step OGraf: a step marker at the playhead splits the sequence into
 * steps the exported graphic plays one by one (each Next to the next marker).
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

async function seed(page: Page) {
  const layer = { id: 'box', name: 'Box', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#4a8fe7', strokeColor: '#000000' };
  const scene = {
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [layer], tracks: [{ partId: 'box', channels: {} }],
    activeTemplateId: 'Sequence', motionTemplates: [{ id: 'Sequence', name: 'Sequence', type: 'in', durationFrames: 60 }],
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([key, value]: [string, string]) => localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(scene)]);
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

async function setFrame(page: Page, frame: number) {
  const grid = page.locator('.timeline-grid-container');
  const gridBox = await grid.boundingBox();
  const rulerBox = await page.locator('.time-ruler').boundingBox();
  const scrollLeft = await grid.evaluate((node) => node.scrollLeft);
  await page.mouse.click(gridBox!.x - scrollLeft + frame * 18 + 4, rulerBox!.y + rulerBox!.height / 2);
  await expect(page.locator('.playhead-frame-label')).toHaveText(String(frame));
}

const savedMarkers = (page: Page) => page.evaluate((key) => {
  const scene = JSON.parse(localStorage.getItem(key) || '{}');
  return (scene.motionTemplates || [])[0]?.stepMarkers ?? [];
}, STORAGE_KEY);

test('Step adds a marker at the playhead, a right-click removes it, and the save keeps it', async ({ page }) => {
  await seed(page);
  const step = page.locator('.step-marker-btn');

  await setFrame(page, 20);
  await step.click();
  await expect(step).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-step-marker="20"]')).toBeVisible();

  await setFrame(page, 40);
  await expect(step).toHaveAttribute('aria-pressed', 'false');
  await step.click();
  await expect(page.locator('[data-step-marker]')).toHaveCount(2);

  // A click on a flag goes to its frame.
  await page.locator('[data-step-marker="20"]').click();
  await expect(page.locator('.playhead-frame-label')).toHaveText('20');

  const badge = page.locator('.autosave-status-badge');
  const before = await badge.getAttribute('data-last-saved-at');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10_000 }).toBeGreaterThan(Number(before || '0'));
  expect(await savedMarkers(page)).toEqual([20, 40]);

  await page.locator('[data-step-marker="40"]').click({ button: 'right' });
  await expect(page.locator('[data-step-marker]')).toHaveCount(1);

  // On frame 0 there is no step to end.
  await setFrame(page, 0);
  await step.click();
  await expect(page.locator('[data-step-marker]')).toHaveCount(1);
});
