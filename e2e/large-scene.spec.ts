import { test, expect, type Page } from '@playwright/test';

/**
 * Manual QA (rc.6 round 4, item 3): large scenes. A scene of a few thousand
 * layers must open (the import limit counts layers, not layers plus their
 * tracks), and a very large selection is framed by one box, not a frame per
 * layer redrawn on every frame.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const sceneOf = (count: number) => {
  const cols = Math.ceil(Math.sqrt(count));
  const layers = Array.from({ length: count }, (_, index) => ({
    id: `l${index}`, name: `Layer ${index}`, type: index % 2 ? 'custom_rect' : 'custom_circle',
    x: -300 + (index % cols) * (600 / cols), y: -200 + Math.floor(index / cols) * (400 / cols),
    rotation: 0, scaleX: 0.1, scaleY: 0.1, opacity: 1, visible: true, zIndex: index + 1,
    fillColor: '#4a8fe7', strokeColor: '#000000',
  }));
  return {
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers, tracks: layers.map((layer) => ({ partId: layer.id, channels: {} })),
  };
};

async function seed(page: Page, count: number) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([key, value]: [string, string]) => localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(sceneOf(count))]);
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

test('a 3000-layer scene opens from the autosave', async ({ page }) => {
  await seed(page, 3000);
  await expect(page.locator('.stage-canvas-container [data-part-id]')).toHaveCount(3000, { timeout: 60000 });
});

test('a selection of 250 layers is framed by one box; a small one by a frame per layer', async ({ page }) => {
  await seed(page, 250);
  await expect(page.locator('.stage-canvas-container [data-part-id]')).toHaveCount(250, { timeout: 30000 });
  const stage = await page.locator('.stage-canvas-container').boundingBox();
  await page.mouse.click(stage!.x + 8, stage!.y + stage!.height - 8);
  await page.keyboard.press('Control+a');
  await expect(page.getByText('250 selected')).toBeVisible();
  await expect(page.locator('[data-testid="transform-gizmo"]')).toHaveCount(1);

  // Two layers from the layer list: a frame each.
  await page.mouse.click(stage!.x + 8, stage!.y + stage!.height - 8);
  await page.locator('[role="tree"] [data-layer-id="l0"]').click();
  await page.locator('[role="tree"] [data-layer-id="l1"]').click({ modifiers: ['Control'] });
  await expect(page.getByText('2 selected')).toBeVisible();
  await expect(page.locator('[data-testid="transform-gizmo"]')).toHaveCount(2);
});
