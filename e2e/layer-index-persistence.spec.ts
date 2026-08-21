import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

test('authored layer index survives new layers, template switching, autosave, and reload', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByTitle('Vector Shapes & Graphic Elements').click();
  for (const shape of ['Rectangle', 'Circle', 'Triangle']) {
    await page.getByRole('button', { name: shape, exact: true }).click();
  }

  await page.locator('.actor-node', { hasText: 'Rectangle' }).click();
  await page.getByRole('button', { name: 'Bring Forward (+1)', exact: true }).click();
  await expect(page.getByText('Index 2', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+Z');
  await expect(page.getByText('Index 1', { exact: true })).toBeVisible();
  await expect(page.getByTitle('Redo')).toBeEnabled();
  await page.getByTitle('Redo').click();
  await expect(page.getByText('Index 2', { exact: true })).toBeVisible();

  // Adding a new shape used to silently reindex every existing part.
  await page.getByRole('button', { name: 'Square', exact: true }).click();
  await page.locator('.actor-node', { hasText: 'Rectangle' }).click();
  await expect(page.getByText('Index 2', { exact: true })).toBeVisible();

  // Selection changes and an unrelated style-tab visit must not reconstruct
  // the selected part from an older/default layer index.
  await page.locator('.actor-node', { hasText: 'Triangle' }).click();
  await page.locator('.actor-node', { hasText: 'Rectangle' }).click();
  await page.getByText('Style', { exact: true }).click();
  await page.getByText('Transform', { exact: true }).click();
  await expect(page.getByText('Index 2', { exact: true })).toBeVisible();

  // Project template switching is part of the active-state contract.
  await page.getByTitle('Create New Template').click();
  await page.getByPlaceholder('Template name (e.g. LowerThird_v2)...').fill('Other Template');
  await page.getByRole('button', { name: 'Create Template', exact: true }).click();
  await page.getByTitle('Template: Template').click();
  await page.locator('.actor-node', { hasText: 'Rectangle' }).click();
  await expect(page.getByText('Index 2', { exact: true })).toBeVisible();

  // Edit/Broadcast mode transitions do not own the authored zIndex state.
  await page.getByText('BROADCAST', { exact: true }).click();
  await page.getByText('EDIT MODE', { exact: true }).click();
  await page.locator('.actor-node', { hasText: 'Rectangle' }).click();
  await expect(page.getByText('Index 2', { exact: true })).toBeVisible();

  // Wait for the observable autosave payload rather than sleeping for an
  // unexplained duration.
  await expect.poll(async () => page.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key) || '{}') as { layers?: { name?: string; zIndex?: number }[] };
    return data.layers?.find((layer) => layer.name === 'Rectangle')?.zIndex;
  }, STORAGE_KEY), { timeout: 15000 }).toBe(2);

  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('.actor-node', { hasText: 'Rectangle' }).click();
  await expect(page.getByText('Index 2', { exact: true })).toBeVisible();

  const persisted = await page.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key) || '{}') as { layers?: { name?: string; zIndex?: number }[] };
    const layers = data.layers || [];
    return {
      values: layers.map((layer) => [layer.name, layer.zIndex]),
      renderOrder: [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map((layer) => layer.name),
    };
  }, STORAGE_KEY);

  expect(persisted.values.find(([name]) => name === 'Rectangle')?.[1]).toBe(2);
  expect(persisted.renderOrder).toEqual(['Circle', 'Rectangle', 'Triangle', 'Square']);
});
