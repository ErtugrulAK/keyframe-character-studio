import { test, expect } from '@playwright/test';

const SCENE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const PRESET_KEY = 'keyframe_custom_motion_presets';

test('M25 — preset library remains separate while its legacy Transform UI stays absent', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(([sceneKey, presetKey]) => {
    localStorage.clear();
    localStorage.setItem(sceneKey, JSON.stringify({
      version: 1,
      layers: [{
        id: 'a', name: 'Preset Reference', type: 'custom_box', x: 0, y: 0,
        rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true,
        zIndex: 1, width: 100, height: 100, inAnimPreset: 'custom_keep', inAnimDuration: 20,
      }],
      tracks: [], fps: 30, totalFrames: 90,
      projectResolution: { width: 1920, height: 1080 },
    }));
    localStorage.setItem(presetKey, JSON.stringify([{
      id: 'custom_keep', name: 'Keep Me', type: 'in', durationFrames: 20,
      keyframes: [{ frame: 0, x: -100, opacity: 0 }, { frame: 20, x: 0, opacity: 1 }],
    }]));
  }, [SCENE_KEY, PRESET_KEY]);
  await page.reload();
  await page.locator('.actor-node', { hasText: 'Preset Reference' }).click();

  await expect(page.locator('[title="Save current animation as a custom preset"]')).toHaveCount(0);
  await expect(page.locator('[aria-label="Animation In Preset"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), PRESET_KEY))
    .toEqual(expect.arrayContaining([expect.objectContaining({ id: 'custom_keep', name: 'Keep Me' })]));
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').layers?.[0]?.inAnimPreset, SCENE_KEY))
    .toBe('custom_keep');
});
