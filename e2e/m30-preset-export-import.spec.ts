import { test, expect } from '@playwright/test';

const PRESET_KEY = 'keyframe_custom_motion_presets';

test('M30 — preset data survives startup while obsolete Transform import/export controls stay absent', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify([{
      id: 'portable_1', name: 'Portable', type: 'in', durationFrames: 12,
      keyframes: [{ frame: 0, opacity: 0 }, { frame: 12, opacity: 1 }],
    }]));
  }, PRESET_KEY);
  await page.reload();

  await expect(page.locator('[aria-label="Export Animation Presets"]')).toHaveCount(0);
  await expect(page.locator('[aria-label="Import Animation Presets"]')).toHaveCount(0);
  await expect(page.locator('input[aria-label="Import custom animation presets file"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), PRESET_KEY))
    .toEqual(expect.arrayContaining([expect.objectContaining({ id: 'portable_1', name: 'Portable' })]));
});
