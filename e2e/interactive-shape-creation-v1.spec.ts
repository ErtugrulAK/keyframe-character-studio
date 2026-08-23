import { test, expect } from '@playwright/test';

async function openElements(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.getByTitle('Vector Shapes & Graphic Elements').click();
}

test('rectangle click arms creation and drag commits one selected shape', async ({ page }) => {
  await openElements(page);
  const canvas = page.locator('.stage-canvas-container');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await expect(page.locator('.actor-node', { hasText: 'Rectangle' })).toHaveCount(0);

  const start = { x: box!.x + box!.width * 0.68, y: box!.y + box!.height * 0.68 };
  const end = { x: box!.x + box!.width * 0.42, y: box!.y + box!.height * 0.42 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  await expect(page.locator('[data-testid="shape-creation-preview"]')).toBeVisible();
  await page.mouse.up();

  await expect(page.locator('.actor-node', { hasText: 'Rectangle' })).toHaveCount(1);
  await expect(page.locator('.actor-node', { hasText: 'Rectangle' })).toHaveClass(/selected/);
  await expect(page.locator('[data-testid="shape-creation-preview"]')).toHaveCount(0);

  await page.keyboard.press('Control+Z');
  await expect(page.locator('.actor-node', { hasText: 'Rectangle' })).toHaveCount(0);
  await page.keyboard.press('Control+Y');
  await expect(page.locator('.actor-node', { hasText: 'Rectangle' })).toHaveCount(1);
});

test('reverse circle drag normalizes bounds and Escape cancels the next tool', async ({ page }) => {
  await openElements(page);
  const canvas = page.locator('.stage-canvas-container');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await page.getByRole('button', { name: 'Circle', exact: true }).click();
  const start = { x: box!.x + box!.width * 0.72, y: box!.y + box!.height * 0.7 };
  const end = { x: box!.x + box!.width * 0.48, y: box!.y + box!.height * 0.48 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  await page.mouse.up();
  await expect(page.locator('.actor-node', { hasText: 'Circle' })).toHaveCount(1);
  await expect(page.locator('[data-testid="shape-creation-preview"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Triangle', exact: true }).click();
  await expect(page.locator('.actor-node', { hasText: 'Triangle' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.actor-node', { hasText: 'Triangle' })).toHaveCount(0);
});
