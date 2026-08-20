import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function scene(coordinateSystem: string, x = 0, y = 0) {
  return {
    version: 1,
    coordinateSystem,
    width: 1920,
    height: 1080,
    fps: 30,
    totalFrames: 60,
    layers: [{
      id: 'box', name: 'Coordinate Box', type: 'custom_box', x, y,
      rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true,
      zIndex: 1, fillColor: '#f00', strokeColor: '#000', width: 100, height: 100,
    }],
    tracks: [],
  };
}

async function seed(page: Page, data: Record<string, unknown>) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([key, value]: [string, string]) => localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(data)]);
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

test('project-unit inspector and persistence remain raw project units', async ({ page }) => {
  await seed(page, scene('project-unit-center-v1', 300, -100));
  await page.getByText('Coordinate Box', { exact: true }).first().click();
  await page.getByText('Transform', { exact: true }).first().click();

  const positionCard = page.locator('.panel-card', { hasText: 'POSITION' }).first();
  const xInput = positionCard.locator('input[type="number"]').nth(0);
  const yInput = positionCard.locator('input[type="number"]').nth(1);
  await expect(xInput).toHaveValue('300');
  await expect(yInput).toHaveValue('100');
  const saveBadge = page.locator('.autosave-status-badge');
  if (await saveBadge.count()) await saveBadge.click();
  await page.waitForTimeout(150);

  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
  expect(saved.coordinateSystem).toBe('project-unit-center-v1');
  expect(saved.layers[0].x).toBe(300);
  expect(saved.layers[0].y).toBe(-100);
});

test('legacy-unknown scene is preserved without magnitude inference', async ({ page }) => {
  await seed(page, scene('legacy-unknown', 30000, -10000));
  await page.waitForTimeout(250);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
  expect(saved.coordinateSystem).toBe('legacy-unknown');
  expect(saved.layers[0].x).toBe(30000);
  expect(saved.layers[0].y).toBe(-10000);
});

for (const resolution of [[1920, 1080], [1280, 720], [1080, 1920]] as const) {
  test(`project-unit metadata survives ${resolution[0]}x${resolution[1]} resolution`, async ({ page }) => {
    const data = scene('project-unit-center-v1');
    data.width = resolution[0];
    data.height = resolution[1];
    await seed(page, data);
    const loaded = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
    expect(loaded.coordinateSystem).toBe('project-unit-center-v1');
    expect(loaded.width).toBe(resolution[0]);
    expect(loaded.height).toBe(resolution[1]);
  });
}
