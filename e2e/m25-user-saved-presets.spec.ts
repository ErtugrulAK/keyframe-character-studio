import { test, expect } from '@playwright/test';

const SCENE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const PRESET_KEY = 'keyframe_custom_motion_presets';

test('M25/V2 — saved preset metadata and stable scene references survive the current animation-data workflow', async ({ page }) => {
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
    localStorage.setItem(presetKey, JSON.stringify([
      {
        id: 'custom_keep', name: 'Keep Me', type: 'in', durationFrames: 20,
        keyframes: [{ progress: 0, deltaX: -100, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0 }],
      },
      {
        id: 'custom_other', name: 'Other Preset', type: 'in', durationFrames: 20,
        keyframes: [{ progress: 0, deltaX: 100, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0 }],
      },
    ]));
  }, [SCENE_KEY, PRESET_KEY]);
  await page.reload();
  await page.locator('.actor-node', { hasText: 'Preset Reference' }).click();

  const animationData = page.getByRole('button', { name: /(?:Expand|Collapse) ANIMATION DATA/ });
  await expect(animationData).toBeVisible();
  if (await animationData.getAttribute('aria-expanded') === 'false') {
    await animationData.click();
  }
  await expect(page.getByRole('button', { name: 'Copy Animation', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear Animation', exact: true })).toBeVisible();

  await page.locator('.autosave-status-badge').click();
  await expect.poll(() => page.evaluate(([sceneKey, presetKey]) => {
    const scene = JSON.parse(localStorage.getItem(sceneKey) ?? '{}');
    const presets = JSON.parse(localStorage.getItem(presetKey) ?? '[]');
    return {
      scenePresetId: scene.layers?.[0]?.inAnimPreset,
      presets: presets.map((preset: { id: string; name: string }) => [preset.id, preset.name]),
    };
  }, [SCENE_KEY, PRESET_KEY])).toEqual({
    scenePresetId: 'custom_keep',
    presets: [['custom_keep', 'Keep Me'], ['custom_other', 'Other Preset']],
  });
});
