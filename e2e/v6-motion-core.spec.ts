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

  test('renders canonical Bezier geometry, all layer masks, and V2 track mattes in Chromium', async ({ page }) => {
    await expect(page.locator('#kcs-layer-mask-target-mask-1-add-add')).toHaveCount(1);
    await expect(page.locator('#kcs-layer-mask-target-mask-2-subtract')).toHaveCount(1);
    await expect(page.locator('#kcs-layer-mask-target-mask-3-intersect')).toHaveCount(1);
    await expect(page.locator('#kcs-layer-mask-target-mask-4-difference')).toHaveCount(1);
    await expect(page.locator('[mask="url(#kcs-layer-mask-target-mask-1-add-add)"]')).toHaveCount(1);
    await expect(page.locator('#kcs-mask-source-alpha-alpha')).toHaveCount(1);
    await expect(page.locator('#kcs-mask-source-luma-luminance-inv')).toHaveCount(1);
    await expect(page.locator('[mask="url(#kcs-mask-source-alpha-alpha)"]')).toHaveCount(1);
    await expect(page.locator('[mask="url(#kcs-mask-source-luma-luminance-inv)"]')).toHaveCount(1);
    await expect(page.locator('#kcs-layer-mask-filter-kcs-layer-mask-target-mask-1-add-add')).toHaveCount(1);
    await expect(page.locator('path[d*="C"]')).toHaveCount(3);
  });

  test('preserves V6 path channels and matte relationships through the browser boundary', async ({ page }) => {
    const state = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, STORAGE_KEY);
    expect(state.version).toBe(2);
    expect(state.layers.find((layer: { id: string }) => layer.id === 'target').trackMatte.mode).toBe('alpha');
    expect(state.tracks.find((track: { partId: string }) => track.partId === 'target').maskPathChannels['mask-1-add:path']).toHaveLength(2);
    await page.reload();
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#kcs-layer-mask-target-mask-4-difference')).toHaveCount(1);
  });
  test('opens the timeline graph studio with both derived graph modes', async ({ page }) => {
    await page.getByRole('button', { name: 'Motion Curves' }).click();
    await expect(page.getByRole('button', { name: 'Value Graph' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Speed Graph' })).toBeVisible();
    await page.getByRole('button', { name: 'Speed Graph' }).click();
    await expect(page.getByTestId('speed-graph-panel')).toBeVisible();
  });

});
