import { test, expect } from '@playwright/test';

const SCENE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const PRESET_KEY = 'keyframe_custom_motion_presets';

test('M25/V2 — preset rename and category persist without changing the stable scene reference', async ({ page }) => {
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

  await expect(page.locator('[aria-label="Animation In Preset"]')).toHaveValue('custom_keep');
  await page.getByLabel('Edit Animation Preset').click();
  await page.getByLabel('Edit Preset Name').fill('Brand Reveal');
  await page.getByLabel('Edit Preset Category').fill('Branding');
  await page.getByRole('dialog', { name: 'Edit Animation Preset' }).getByText('Save').click();

  await expect(page.locator('optgroup[label="Custom · Branding"]')).toHaveCount(1);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), PRESET_KEY))
    .toEqual(expect.arrayContaining([expect.objectContaining({
      id: 'custom_keep',
      name: 'Brand Reveal',
      category: 'Branding',
    })]));
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').layers?.[0]?.inAnimPreset, SCENE_KEY))
    .toBe('custom_keep');

  await page.getByLabel('Edit Animation Preset').click();
  await page.getByLabel('Edit Preset Name').fill('Must Not Apply');
  await page.getByLabel('Animation In Preset').selectOption('custom_other');
  await expect(page.getByRole('dialog', { name: 'Edit Animation Preset' })).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => {
    const presets = JSON.parse(localStorage.getItem(key) ?? '[]');
    return presets.map((preset: { id: string; name: string }) => [preset.id, preset.name]);
  }, PRESET_KEY)).toEqual([
    ['custom_keep', 'Brand Reveal'],
    ['custom_other', 'Other Preset'],
  ]);

  await page.getByLabel('Animation In Preset').selectOption('custom_keep');
  await page.locator('[title="Save current animation as a custom preset"]').first().click();
  await page.getByLabel('Preset Name').fill('Must Not Save');
  await page.getByLabel('Animation In Preset').selectOption('custom_other');
  await expect(page.getByRole('dialog', { name: 'Save Animation Preset' })).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => {
    const presets = JSON.parse(localStorage.getItem(key) ?? '[]');
    return presets.map((preset: { id: string; name: string }) => [preset.id, preset.name]);
  }, PRESET_KEY)).toEqual([
    ['custom_keep', 'Brand Reveal'],
    ['custom_other', 'Other Preset'],
  ]);
});
