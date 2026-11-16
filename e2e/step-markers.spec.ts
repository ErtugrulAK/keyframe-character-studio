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

test('a right-click on the ruler retimes that step: its keys stretch, later keys and markers move, one undo puts it all back', async ({ page }) => {
  // Round 6 (OGraf Studio review, "Set length").
  const layer = { id: 'box', name: 'Box', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#4a8fe7', strokeColor: '#000000' };
  const kf = (id: string, frame: number) => ({ id, frame, value: frame, easing: 'linear' });
  const scene = {
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [layer], tracks: [{ id: 'track-box', partId: 'box', name: 'Box', color: '#22d3ee', visible: true, locked: false, keyframes: [], channels: { x: [kf('k0', 0), kf('k10', 10), kf('k20', 20), kf('k30', 30), kf('k50', 50)] } }],
    activeTemplateId: 'Sequence', motionTemplates: [{ id: 'Sequence', name: 'Sequence', type: 'in', durationFrames: 60, stepMarkers: [20, 40] }],
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([key, value]: [string, string]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, value); sessionStorage.setItem('seeded', '1'); } }, [STORAGE_KEY, JSON.stringify(scene)]);
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

  const saved = async () => {
    const badge = page.locator('.autosave-status-badge');
    const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
    await badge.click();
    await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10_000 }).toBeGreaterThan(before);
    return page.evaluate((key) => {
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      const template = data.motionTemplates[0];
      return { x: data.tracks[0].channels.x.map((k: { frame: number }) => k.frame), markers: template.stepMarkers ?? [], duration: template.durationFrames };
    }, STORAGE_KEY);
  };

  await setFrame(page, 30);
  // A right-click on the ruler inside step 1 (0 → 20, 0.67 s at 30 fps).
  const grid = page.locator('.timeline-grid-container');
  const gridBox = (await grid.boundingBox())!;
  const rulerBox = (await page.locator('.time-ruler').boundingBox())!;
  const scrollLeft = await grid.evaluate((node) => node.scrollLeft);
  await page.mouse.click(gridBox.x - scrollLeft + 10 * 18 + 4, rulerBox.y + rulerBox.height / 2, { button: 'right' });
  const menu = page.getByRole('dialog', { name: 'Retime step' });
  await expect(menu).toContainText('Step 1 (frames 0–20)');
  const field = menu.getByRole('spinbutton');
  await expect(field).toHaveValue('0.67');
  // 40 frames = 1.3333 s.
  await field.fill('1.3333');
  await field.press('Enter');
  await expect(menu).toHaveCount(0);
  expect(await saved()).toEqual({ x: [0, 20, 40, 50, 70], markers: [40, 60], duration: 80 });

  await page.locator('.stage-canvas-container').hover();
  await page.keyboard.press('Control+z');
  expect(await saved()).toEqual({ x: [0, 10, 20, 30, 50], markers: [20, 40], duration: 60 });
});
