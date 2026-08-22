import { test, expect } from '@playwright/test';

const SCENE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

test('M24 — combination preset data remains compatible in the approved Transform Inspector UI', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      layers: [{
        id: 'a', name: 'Combination Legacy', type: 'custom_box', x: 0, y: 0,
        rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true,
        zIndex: 1, width: 100, height: 100,
        inAnimPreset: 'slide-scale-left', inAnimDuration: 18,
        outAnimPreset: 'soft-pop', outAnimDuration: 24,
      }],
      tracks: [], fps: 30, totalFrames: 90,
      projectResolution: { width: 1920, height: 1080 },
    }));
  }, SCENE_KEY);
  await page.reload();
  await page.locator('.actor-node', { hasText: 'Combination Legacy' }).click();

  await expect(page.locator('[aria-label="Animation In Preset"]')).toHaveValue('slide-scale-left');
  await expect(page.locator('[aria-label="Animation Out Preset"]')).toHaveValue('soft-pop');
  await page.locator('.autosave-status-badge').click();
  await expect.poll(() => page.evaluate((key) => {
    const layer = JSON.parse(localStorage.getItem(key) ?? '{}').layers?.[0] ?? {};
    return [layer.inAnimPreset, layer.inAnimDuration, layer.outAnimPreset, layer.outAnimDuration];
  }, SCENE_KEY)).toEqual(['slide-scale-left', 18, 'soft-pop', 24]);
});
