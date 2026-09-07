import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const fixturePath = path.join(process.cwd(), 'e2e', 'fixtures', 'v6-motion-core.scene.json');
const fixture = fs.readFileSync(fixturePath, 'utf8');

test.describe('V6 Motion Core and Compositing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.addInitScript(([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    }, [STORAGE_KEY, fixture]);
    await page.goto('/');
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  });

  test('renders canonical Bezier geometry, layer masks, and V2 track matte in Chromium', async ({ page }) => {
    await expect(page.locator('#kcs-layer-mask-target-mask-1-add')).toHaveCount(1);
    await expect(page.locator('[mask="url(#kcs-layer-mask-target-mask-1-add)"]')).toHaveCount(1);
    await expect(page.locator('#kcs-mask-source-alpha')).toHaveCount(1);
    await expect(page.locator('[mask="url(#kcs-mask-source-alpha)"]')).toHaveCount(1);
    await expect(page.locator('#kcs-layer-mask-filter-kcs-layer-mask-target-mask-1-add')).toHaveCount(1);
    await expect(page.locator('path[d*="C"]')).toHaveCount(2);
  });
  test('opens the timeline graph studio with both derived graph modes', async ({ page }) => {
    await page.getByRole('button', { name: 'Motion Curves' }).click();
    await expect(page.getByRole('button', { name: 'Value Graph' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Speed Graph' })).toBeVisible();
    await page.getByRole('button', { name: 'Speed Graph' }).click();
    await expect(page.getByTestId('speed-graph-panel')).toBeVisible();
  });

});
