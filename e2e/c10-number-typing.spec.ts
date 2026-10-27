import { test, expect, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

/**
 * C10 — manual QA: "0.1 cannot be typed, and the 0 cannot be deleted". A
 * number field keeps the typed text while focused, so an emptied field stays
 * empty and "0." is not turned back into "0" before the 1 arrives.
 */
const SCENE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

async function seed(page: Page): Promise<void> {
  const path = { version: 1, coordinateSpace: 'normalized', closed: true, points: [{ id: 'a', x: 0.2, y: 0.2 }, { id: 'b', x: 0.8, y: 0.2 }, { id: 'c', x: 0.8, y: 0.8 }] };
  await page.goto('/');
  await page.evaluate(([key, value]) => { localStorage.clear(); localStorage.setItem(key, value); }, [SCENE_KEY, JSON.stringify({
    version: 1,
    layers: [{ id: 'box', name: 'Box', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 2, opacity: 1, visible: true, zIndex: 1, fillColor: '#3b82f6',
      masks: [{ id: 'm1', name: 'Window', mode: 'add', enabled: true, opacity: 1, path }] }],
    tracks: [], fps: 30, totalFrames: 60, projectResolution: { width: 1920, height: 1080 },
  })]);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible();
}

async function savedMaskOpacity(page: Page): Promise<number> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10_000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').layers[0].masks[0].opacity, SCENE_KEY);
}

test('the mask opacity field can be emptied and takes 0.1 typed key by key', async ({ page }) => {
  await seed(page);
  await page.locator('.actor-node', { hasText: 'Box' }).click();
  await openDetailsTab(page, 'Masks');
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
  const field = page.getByLabel('Mask opacity');
  await expect(field).toHaveValue('1');

  await field.click();
  await field.press('End');
  await field.press('Backspace');
  // Emptied, not snapped back to "0".
  await expect(field).toHaveValue('');
  await field.pressSequentially('0.1');
  await expect(field).toHaveValue('0.1');
  await field.press('Enter');
  await expect(field).toHaveValue('0.1');
  expect(await savedMaskOpacity(page)).toBe(0.1);
});
