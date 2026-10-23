/**
 * WP-02 visual evidence: the landscape user task on the same fixture, frame and
 * viewport — layer mode, mask editing entered, mask moved (image fixed), undo,
 * exit; plus the 1024×720 layout of the editing banner.
 */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { evidenceDir, imageLayer, normalizedRectPath, savedScene, seedScene, track, watchPage } from './fixtures';

const OUT = evidenceDir('wp02');
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

const center = async (page: Page, testId: string) => {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(testId);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 720 }]) {
  test(`WP-02 — move an existing mask on the landscape at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize(viewport);
    const watch = watchPage(page);
    await seedScene(page, {
      layers: [imageLayer({ rotation: 0, masks: [{ id: 'm1', name: 'Window', mode: 'add', enabled: true, feather: 0, opacity: 1, expansion: 0, path: normalizedRectPath(0.15, 0.2, 0.55, 0.8) }] })],
      tracks: [track('landscape')],
    });
    const tag = `${viewport.width}`;
    await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().click();
    await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
    await shot(page, `${tag}_01_layer_mode`);

    await page.getByRole('button', { name: 'Edit on Canvas' }).click();
    await expect(page.getByTestId('mask-edit-banner')).toBeVisible();
    // The banner and its Exit control are fully inside the stage at this width.
    const stageBox = await page.locator('.stage-canvas-container').boundingBox();
    const exitBox = await page.getByRole('button', { name: 'Exit Mask Editing' }).first().boundingBox();
    expect(stageBox && exitBox && exitBox.x >= stageBox.x && exitBox.x + exitBox.width <= stageBox.x + stageBox.width).toBeTruthy();
    await shot(page, `${tag}_02_mask_editing`);

    const before = await savedScene(page);
    const from = await center(page, 'mask-path-move-handle');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 90, from.y - 10, { steps: 10 });
    await page.mouse.up();
    await shot(page, `${tag}_03_mask_moved`);
    const after = await savedScene(page);
    expect([after.layers[0].x, after.layers[0].y, after.layers[0].scaleX, after.layers[0].rotation])
      .toEqual([before.layers[0].x, before.layers[0].y, before.layers[0].scaleX, before.layers[0].rotation]);
    expect(after.layers[0].masks[0].path).not.toEqual(before.layers[0].masks[0].path);

    await page.getByTitle('Undo').click();
    await shot(page, `${tag}_04_undo`);
    await page.getByTitle('Redo').click();
    await shot(page, `${tag}_05_redo`);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('mask-path-overlay')).toHaveCount(0);
    await shot(page, `${tag}_06_exit_layer_mode`);

    expect(watch.errors).toEqual([]);
  });
}
