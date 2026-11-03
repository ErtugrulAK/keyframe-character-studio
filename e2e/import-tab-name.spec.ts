import { test, expect } from '@playwright/test';

/**
 * Manual QA (rc.6 review): importing "A.json" replaced the active tab's content
 * but left the tab under its old name. A scene import names the active tab after
 * the file, and adds no tab.
 */
const INPUT = 'input[aria-label="Choose a KCS project, legacy project, Lottie file, or OGraf manifest/package to import"]';

const scene = JSON.stringify({
  version: 1, coordinateSystem: 'project-unit-center-v1',
  width: 1920, height: 1080, fps: 30, totalFrames: 30, name: 'Name inside the file',
  layers: [{ id: 'one', name: 'One', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218' }],
  tracks: [],
});

test('a scene import names the active tab after the file', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  const tabs = page.locator('.header-tab:not(.add-tab)');
  const tabCount = await tabs.count();

  await page.setInputFiles(INPUT, { name: 'A.json', mimeType: 'application/json', buffer: Buffer.from(scene) });

  await expect(page.locator('.actor-node', { hasText: 'One' })).toHaveCount(1);
  await expect(tabs).toHaveCount(tabCount);
  await expect(page.locator('.header-tab.active')).toContainText('A');
  await expect(page.locator('.header-tab.active')).not.toContainText('Name inside the file');
});
