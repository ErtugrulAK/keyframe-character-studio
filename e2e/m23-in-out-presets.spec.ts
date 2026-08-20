import { test, expect, type Page } from '@playwright/test';

const SCENE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

async function seedLegacyProceduralScene(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate((key) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      layers: [{
        id: 'a', name: 'Legacy Procedural', type: 'custom_box', x: 0, y: 0,
        rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true,
        zIndex: 1, width: 120, height: 120, fillColor: '#ff2080',
        inAnimPreset: 'fade', inAnimDuration: 15,
        outAnimPreset: 'slide-right', outAnimDuration: 24,
      }],
      tracks: [], fps: 30, totalFrames: 90,
      projectResolution: { width: 1920, height: 1080 },
    }));
  }, SCENE_KEY);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible();
}

test.describe('M23 — legacy procedural compatibility under named-sequence primary UX', () => {
  test('procedural fields load and persist while the removed editor stays absent', async ({ page }) => {
    await seedLegacyProceduralScene(page);
    await page.locator('.actor-node', { hasText: 'Legacy Procedural' }).click();

    await expect(page.getByText('ANIMATION DATA')).toBeVisible();
    await expect(page.locator('[aria-label="Animation In Preset"]')).toHaveCount(0);
    await expect(page.locator('[aria-label="Animation Out Preset"]')).toHaveCount(0);
    await expect(page.locator('[aria-label="Animation In Duration"]')).toHaveCount(0);
    await expect(page.locator('[aria-label="Animation Out Duration"]')).toHaveCount(0);

    await page.locator('.autosave-status-badge').click();
    await expect.poll(() => page.evaluate((key) => {
      const layer = JSON.parse(localStorage.getItem(key) ?? '{}').layers?.[0] ?? {};
      return [layer.inAnimPreset, layer.inAnimDuration, layer.outAnimPreset, layer.outAnimDuration];
    }, SCENE_KEY)).toEqual(['fade', 15, 'slide-right', 24]);
  });
});
