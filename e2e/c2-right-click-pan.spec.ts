/**
 * C2-F — the right mouse button means two things on the stage, and one press
 * is only ever one of them: a right-DRAG pans the camera and opens no menu; a
 * right-CLICK (no travel) opens the context menu and does not move the camera.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

async function seed(page: Page): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [{ id: 'box', name: 'Box', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#000', width: 300, height: 200 }],
    tracks: [{ id: 'track-box', partId: 'box', name: 'Box', color: '#22d3ee', visible: true, locked: false, expanded: false, channels: {} }],
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const artboardCentre = async (page: Page) => {
  const box = await page.locator('.stage-svg rect.canvas-bg').first().boundingBox();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
};

test('a right-drag pans and opens no menu; a right-click opens the menu and does not pan', async ({ page }) => {
  await seed(page);
  const layer = await page.locator('.stage-svg g[data-part-id="box"]').boundingBox();
  const start = { x: layer!.x + layer!.width / 2, y: layer!.y + layer!.height / 2 };
  const before = await artboardCentre(page);

  // Right-drag starting ON a layer.
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(start.x + 60, start.y + 30, { steps: 6 });
  await page.mouse.move(start.x + 120, start.y + 40, { steps: 6 });
  await page.mouse.up({ button: 'right' });
  await expect.poll(async () => (await artboardCentre(page)).x - before.x).toBeGreaterThan(100);
  await expect(page.getByRole('menu')).toHaveCount(0);

  // Right-click (no travel) on the layer: the menu, and the camera stays.
  const panned = await artboardCentre(page);
  const moved = await page.locator('.stage-svg g[data-part-id="box"]').boundingBox();
  await page.mouse.click(moved!.x + moved!.width / 2, moved!.y + moved!.height / 2, { button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
  const after = await artboardCentre(page);
  expect(Math.hypot(after.x - panned.x, after.y - panned.y)).toBeLessThan(0.5);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);

  // A small jitter inside the slop is still a click.
  await page.mouse.move(moved!.x + moved!.width / 2, moved!.y + moved!.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(moved!.x + moved!.width / 2 + 2, moved!.y + moved!.height / 2 + 1);
  await page.mouse.up({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
  const jitter = await artboardCentre(page);
  expect(Math.hypot(jitter.x - panned.x, jitter.y - panned.y)).toBeLessThan(0.5);
});
