/**
 * WP-03 visual evidence on the landscape fixture: drawing an ellipse mask
 * (preview, committed), a pen mask in progress, the rotated path, and the
 * circle → move → path key @20 demo.
 */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { evidenceDir, imageLayer, savedScene, seedScene, seekFrame, track, watchPage } from './fixtures';

const OUT = evidenceDir('wp03');
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

test('WP-03 — ellipse, pen, rotate and the path key demo', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const watch = watchPage(page);
  await seedScene(page, { layers: [imageLayer({ rotation: 0 })], tracks: [track('landscape')] });
  await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().click();
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
  const stage = await page.locator('.stage-canvas-container').boundingBox();
  if (!stage) throw new Error('stage');
  const c = { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 + 30 };

  await page.getByRole('button', { name: 'Draw ellipse mask' }).click();
  await page.mouse.move(c.x - 70, c.y - 70);
  await page.mouse.down();
  await page.mouse.move(c.x + 70, c.y + 70, { steps: 8 });
  await shot(page, '01_ellipse_preview');
  await page.mouse.up();
  await expect(page.getByTestId('mask-path-overlay')).toBeVisible();
  await shot(page, '02_ellipse_committed');

  await page.getByRole('button', { name: 'Rotate mask path 15 degrees clockwise' }).click();
  await page.getByRole('button', { name: 'Scale mask path down 10 percent' }).click();
  await shot(page, '03_path_rotated_scaled');

  // Circle → path key @20 via the path stopwatch.
  await page.locator('.ue-expand-btn').first().click();
  await page.locator('.ue-subgroup-header', { hasText: 'Mask' }).click();
  await page.locator('button.ue-channel-stopwatch[data-property-channel="mask-1:path"]').click();
  await seekFrame(page, 20);
  const handle = await page.getByTestId('mask-path-move-handle').boundingBox();
  if (!handle) throw new Error('handle');
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 80, handle.y + handle.height / 2 - 10, { steps: 8 });
  await page.mouse.up();
  await shot(page, '04_path_key_at_20');
  await seekFrame(page, 10);
  await shot(page, '05_frame_10_interpolated');
  const scene = await savedScene(page);
  expect(scene.tracks[0].maskPathChannels['mask-1:path'].map((key: { frame: number }) => key.frame)).toEqual([0, 20]);

  // A second mask drawn with the Pen, in progress.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Draw pen mask' }).click();
  for (const [dx, dy] of [[-150, -60], [-60, -90], [-40, 10]]) await page.mouse.click(c.x + dx, c.y + dy);
  await page.mouse.move(c.x - 120, c.y + 30);
  await shot(page, '06_pen_in_progress');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('mask-path-overlay')).toBeVisible();
  await shot(page, '07_pen_committed');

  expect(watch.errors).toEqual([]);
});
