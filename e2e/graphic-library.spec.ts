import { expect, test, type Page } from '@playwright/test';

/**
 * The graphic library keeps templates in IndexedDB across reloads. Opening one
 * adds it as a new template tab (the current work is never replaced);
 * Duplicate and Delete (asked twice) manage the list.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const base = { rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, strokeColor: '#000', fillColor: '#4a8fe7' };
const scene = JSON.stringify({
  version: 1, coordinateSystem: 'project-unit-center-v1', width: 1280, height: 720, fps: 30, totalFrames: 60, name: 'Lower third',
  layers: [
    { ...base, id: 'panel', name: 'Panel', type: 'custom_rect', x: 0, y: 200, zIndex: 1 },
    { ...base, id: 'title', name: 'Title', type: 'custom_text', x: 0, y: 200, zIndex: 2, textValue: 'NEWS', fontSize: 40 },
  ],
  tracks: [],
});

async function seed(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async ([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
    await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase('kcs-library'); request.onsuccess = request.onerror = request.onblocked = () => resolve(); });
  }, [STORAGE_KEY, scene]);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Library' });
const rows = (page: Page) => dialog(page).getByRole('list', { name: 'Saved graphics' }).getByRole('listitem');

test('save the current graphic, find it after a reload, open it as a new tab, duplicate and delete', async ({ page }) => {
  await seed(page);
  await page.getByRole('button', { name: 'Library' }).click();
  await expect(dialog(page)).toContainText('Nothing saved yet');
  await dialog(page).getByLabel('Name to save the current graphic under').fill('News lower third');
  await dialog(page).getByRole('button', { name: 'Save current graphic' }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('News lower third');
  await expect(rows(page).first()).toContainText('2 layers');

  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  const tabsBefore = await page.locator('.header-tab:not(.add-tab)').count();
  const firstTabName = (await page.locator('.header-tab:not(.add-tab)').first().innerText()).trim();
  await page.getByRole('button', { name: 'Library' }).click();
  await expect(rows(page)).toHaveCount(1);

  await dialog(page).getByRole('button', { name: 'Duplicate News lower third' }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(dialog(page)).toContainText('News lower third copy');

  await dialog(page).getByRole('button', { name: 'Delete News lower third copy' }).click();
  await expect(dialog(page)).toContainText('Delete for good?');
  await dialog(page).getByRole('button', { name: 'Keep' }).click();
  await expect(rows(page)).toHaveCount(2);
  await dialog(page).getByRole('button', { name: 'Delete News lower third copy' }).click();
  await dialog(page).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);

  await dialog(page).getByRole('button', { name: 'Open News lower third' }).click();
  await expect(dialog(page)).toHaveCount(0);
  // A new tab, active, named after the entry; the tab that was open is still there.
  const tabs = page.locator('.header-tab:not(.add-tab)');
  await expect(tabs).toHaveCount(tabsBefore + 1);
  await expect(tabs.last()).toHaveClass(/active/);
  await expect(tabs.last()).toContainText('News lower third');
  await expect(tabs.first()).toContainText(firstTabName);
  await expect(page.locator('.actor-node', { hasText: 'Title' })).toHaveCount(1);
});
