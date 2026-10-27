/**
 * WP-04 visual evidence: the Track Matte summary on the target, the hidden
 * source selected with its edit-only frame, the moved source, back to the
 * target, the shared-visibility conflict and the missing-source warning.
 */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { evidenceDir, imageLayer, seedScene, track, watchPage } from './fixtures';

const OUT = evidenceDir('wp04');
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

const shape = (id: string, name: string, type: string, overrides: Record<string, unknown> = {}) => ({
  id, name, type, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#ffffff', strokeColor: '#000000', width: 160, height: 160, ...overrides,
});

test('WP-04 — target ⇄ hidden source navigation on the landscape', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const watch = watchPage(page);
  await seedScene(page, {
    layers: [
      imageLayer({ trackMatte: { sourceLayerId: 'circle', mode: 'alpha', sourceVisible: false } }),
      shape('circle', 'Circle', 'custom_circle', { zIndex: 2, x: -80 }),
      shape('caption', 'Caption', 'custom_rect', { zIndex: 3, y: 170, width: 260, height: 40, fillColor: '#f59e0b', trackMatte: { sourceLayerId: 'circle', mode: 'alpha', sourceVisible: true } }),
    ],
    tracks: [track('landscape'), track('circle'), track('caption')],
  });
  await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().click();
  await expect(page.getByTestId('track-matte-summary')).toBeVisible();
  await shot(page, '01_target_summary');

  await page.getByRole('button', { name: 'Select Source' }).click();
  await shot(page, '02_hidden_source_selected');
  const hit = await page.locator('[data-testid="matte-editor-hit-area"][data-hidden-matte-source="true"]').boundingBox();
  if (!hit) throw new Error('hit');
  await page.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 2);
  await page.mouse.down();
  await page.mouse.move(hit.x + hit.width / 2 + 120, hit.y + hit.height / 2 - 20, { steps: 10 });
  await page.mouse.up();
  await shot(page, '03_source_moved_target_fixed');

  await page.getByRole('button', { name: 'Back to Landscape' }).click();
  await shot(page, '04_back_to_target');

  await page.locator('.ue-track-row', { hasText: 'Caption' }).first().click();
  await expect(page.getByTestId('track-matte-visibility-conflict')).toBeVisible();
  await shot(page, '05_shared_source_conflict');

  await page.locator('.ue-track-row', { hasText: 'Circle' }).first().click();
  await page.getByRole('button', { name: 'Delete Actor Instance' }).click();
  await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().click();
  await expect(page.getByTestId('track-matte-summary')).toContainText('is missing');
  await shot(page, '06_missing_source');
  await page.getByTitle('Undo').click();
  await expect(page.getByTestId('track-matte-summary')).toContainText('Matte source: Circle');
  await shot(page, '07_undo_restored');

  expect(watch.errors).toEqual([]);
});
