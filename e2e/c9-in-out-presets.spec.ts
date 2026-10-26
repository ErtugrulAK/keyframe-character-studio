import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openDetailsTab } from './fixtures/inspectorTabs';
import { DEFAULT_INITIAL_PRESETS } from '../src/context/initialStateData';

/**
 * C9 — the IN/OUT preset card is back in the Layer tab: picking a preset is
 * one undoable scene edit, saving makes a user preset, and the user library
 * exports and imports through the M30 format.
 */
const SCENE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const PRESET_KEY = 'keyframe_custom_motion_presets';

async function seed(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate((key) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      layers: [{
        id: 'a', name: 'Preset Target', type: 'custom_box', x: 0, y: 0,
        rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true,
        zIndex: 1, width: 120, height: 120, fillColor: '#ff2080',
      }],
      tracks: [], fps: 30, totalFrames: 90,
      projectResolution: { width: 1920, height: 1080 },
    }));
  }, SCENE_KEY);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible();
  await page.locator('.actor-node', { hasText: 'Preset Target' }).click();
  await openDetailsTab(page, 'Layer');
  const disclosure = page.getByRole('button', { name: /(?:Expand|Collapse) ANIMATION IN \/ OUT/ });
  if (await disclosure.getAttribute('aria-expanded') === 'false') await disclosure.click();
}

async function savedLayer(page: Page): Promise<Record<string, unknown>> {
  const before = await page.locator('.autosave-status-badge').getAttribute('data-last-saved-at');
  await page.locator('.autosave-status-badge').click();
  await expect
    .poll(async () => Number((await page.locator('.autosave-status-badge').getAttribute('data-last-saved-at')) || '0'), { timeout: 10_000 })
    .toBeGreaterThan(Number(before || '0'));
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').layers?.[0] ?? {}, SCENE_KEY);
}

// The default presets share the user ID prefix; the default list is the
// authority for which library entries are not the user's.
const DEFAULT_IDS = DEFAULT_INITIAL_PRESETS.map((preset) => preset.id);
const userPresets = (page: Page) => page.evaluate(
  ([key, defaults]) => (JSON.parse(localStorage.getItem(key as string) ?? '[]') as { id: string; name: string }[])
    .filter((preset) => !(defaults as string[]).includes(preset.id))
    .map((preset) => preset.name),
  [PRESET_KEY, DEFAULT_IDS] as const,
);

test('picking an IN preset and its duration writes the layer; one Ctrl+Z undoes the pick', async ({ page }) => {
  await seed(page);
  const inPreset = page.getByLabel('Animation In Preset');
  await expect(inPreset).toHaveValue('none');

  await inPreset.selectOption('fade');
  const duration = page.getByLabel('Animation In Duration');
  await duration.fill('12');
  await duration.press('Enter');
  expect(await savedLayer(page)).toMatchObject({ inAnimPreset: 'fade', inAnimDuration: 12 });

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Control+z');
  await expect(page.getByLabel('Animation In Duration')).toHaveValue('30');
  await expect(inPreset).toHaveValue('fade');
  await page.keyboard.press('Control+z');
  await expect(inPreset).toHaveValue('none');
});

test('Save Current as Preset adds a user preset that the OUT list does not show', async ({ page }) => {
  await seed(page);
  await page.getByLabel('Animation In Preset').selectOption('pop');
  await page.getByRole('button', { name: 'Save Current as Preset' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Save Animation Preset' });
  await dialog.getByLabel('Preset Name').fill('My Pop');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await expect.poll(() => userPresets(page)).toEqual(['My Pop']);
  await expect(page.getByLabel('Animation In Preset').locator('option', { hasText: 'My Pop' })).toHaveCount(1);
  await expect(page.getByLabel('Animation Out Preset').locator('option', { hasText: 'My Pop' })).toHaveCount(0);
});

test('the user library exports to a version-1 file and imports back without replacing it', async ({ page }, testInfo) => {
  await seed(page);
  await page.getByLabel('Animation In Preset').selectOption('fade');
  await page.getByRole('button', { name: 'Save Current as Preset' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Save Animation Preset' });
  await dialog.getByLabel('Preset Name').fill('Exported Fade');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => userPresets(page)).toEqual(['Exported Fade']);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Animation Presets' }).click();
  const download = await downloadPromise;
  const file = testInfo.outputPath('presets.json');
  await download.saveAs(file);
  const payload = JSON.parse(await readFile(file, 'utf-8'));
  expect(payload.version).toBe(1);
  expect(payload.presets.map((preset: { name: string }) => preset.name)).toEqual(['Exported Fade']);

  // Import the same file: the existing preset stays and the import is added
  // (its colliding ID is remapped), so the library holds both.
  await page.locator('input[aria-label="Import custom animation presets file"]').setInputFiles(file);
  await expect.poll(() => userPresets(page)).toEqual(['Exported Fade', 'Exported Fade']);
});
