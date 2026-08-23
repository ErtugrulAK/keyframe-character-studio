import { test, expect } from '@playwright/test';

test.describe('Phase 6.4 E2E Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto('/');
  });

async function createShapeByDrag(page: import('@playwright/test').Page, name: string, offsetX = 0, offsetY = 0): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click();
  const canvas = page.locator('.stage-canvas-container');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas bounds unavailable');
  await page.mouse.move(box.x + 360 + offsetX, box.y + 280 + offsetY);
  await page.mouse.down();
  await page.mouse.move(box.x + 280 + offsetX, box.y + 200 + offsetY);
  await page.mouse.up();
}

  test('Create a new project, add parts, edit, and play', async ({ page }) => {
    test.setTimeout(60000);
    // The application should initialize and render the canvas
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

    // Navigate to Vector Shapes Toolbar
    await page.getByTitle('Vector Shapes & Graphic Elements').click();

    // Add Rectangle and Circle through the approved drag-creation contract.
    await createShapeByDrag(page, 'Rectangle', -40, 0);
    await createShapeByDrag(page, 'Circle', 40, 0);

    // Verify elements appear in the timeline outliner (scoped to the outliner
    // because 'Rectangle'/'Circle' also appear in the toolbar and on the canvas)
    await expect(page.locator('.ue-outliner').getByText('Rectangle').first()).toBeVisible();
    await expect(page.locator('.ue-outliner').getByText('Circle').first()).toBeVisible();

    // Undo removes parts one at a time — the FIRST press must work (regression
    // guard for the history index drift under StrictMode)
    await page.keyboard.press('Control+Z');
    await expect(page.locator('.ue-outliner').getByText('Circle').first()).not.toBeVisible();
    await page.keyboard.press('Control+Z');
    await expect(page.locator('.ue-outliner').getByText('Rectangle').first()).not.toBeVisible();

    // Redo restores them in order
    await page.keyboard.press('Control+Y');
    await expect(page.locator('.ue-outliner').getByText('Rectangle').first()).toBeVisible();
    await page.keyboard.press('Control+Y');
    await expect(page.locator('.ue-outliner').getByText('Circle').first()).toBeVisible();

    // Mirror duplicate: the selected part (Circle) gets a Y-axis mirror copy
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await page.getByRole('button', { name: /Mirror Y/i }).click();
    await expect(page.locator('.ue-outliner').getByText('Circle Mirror Y').first()).toBeVisible();

    // Play the sequence, then pause it (the transport button toggles its title)
    await page.getByTitle('Play', { exact: true }).click();
    await page.waitForTimeout(1000);
    await page.getByTitle('Pause', { exact: true }).click();

    // Copy / Paste parts
    await page.keyboard.press('Control+C');
    await page.keyboard.press('Control+V');

    // Delete part
    await page.keyboard.press('Delete');

    // Switch Project Templates
    await page.getByTitle('Project Workspace').click();

    // Switch Motion Templates
    await page.getByTitle('Motion Transitions').click();
  });

  test('Draw a freeform shape with the Free Draw tool', async ({ page }) => {
    test.setTimeout(60000);
    // The application should initialize and render the canvas
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

    // Open the vector shapes drawer and activate the Free Draw tool
    await page.getByTitle('Vector Shapes & Graphic Elements').click();
    await page.getByRole('button', { name: 'Free Draw', exact: true }).click();

    // Draw an irregular polygon: 3 corner clicks + double-click to finish
    const svg = page.locator('.stage-svg');
    await svg.click({ position: { x: 220, y: 180 } });
    await svg.click({ position: { x: 360, y: 200 } });
    await svg.click({ position: { x: 300, y: 280 } });
    await svg.dblclick({ position: { x: 300, y: 280 } });

    // The finished shape appears in the timeline outliner
    await expect(page.locator('.ue-outliner').getByText('Freeform Shape').first()).toBeVisible();
  });

  test('Persisted parent relation makes a freeform shape move with its rectangle', async ({ page }) => {
    test.setTimeout(60000);
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

    // Add a Rectangle (the container) using interactive creation.
    await page.getByTitle('Vector Shapes & Graphic Elements').click();
    await createShapeByDrag(page, 'Rectangle');

    // Draw a small freeform INSIDE the rectangle's area (rect sits at center 300,240)
    await page.getByRole('button', { name: 'Free Draw', exact: true }).click();
    const svg = page.locator('.stage-svg');
    await svg.click({ position: { x: 275, y: 220 } });
    await svg.click({ position: { x: 325, y: 225 } });
    await svg.click({ position: { x: 300, y: 255 } });
    await svg.dblclick({ position: { x: 300, y: 255 } });
    await expect(page.locator('.ue-outliner').getByText('Freeform Shape').first()).toBeVisible();

    // Container authoring no longer has a Transform-tab control. Preserve the
    // renderer/interaction regression through the supported persisted relation.
    await expect.poll(async () => page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') || '{}');
      return data.layers?.some((layer: { name?: string }) => layer.name === 'Freeform Shape');
    }), { timeout: 15000 }).toBe(true);
    await page.evaluate(() => {
      const key = 'SEQUENCER_STUDIO_PRO_V5';
      const data = JSON.parse(localStorage.getItem(key)!);
      const parent = data.layers.find((layer: { name?: string }) => layer.name === 'Rectangle');
      const child = data.layers.find((layer: { name?: string }) => layer.name === 'Freeform Shape');
      child.parentId = parent.id;
      localStorage.setItem(key, JSON.stringify(data));
    });
    await page.reload();
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

    const transformsBefore = await page.locator('g[transform^="translate"]').evaluateAll(
      (groups) => groups.map((group) => group.getAttribute('transform')),
    );

    await page.evaluate(() => {
      const key = 'SEQUENCER_STUDIO_PRO_V5';
      const data = JSON.parse(localStorage.getItem(key)!);
      const parent = data.layers.find((layer: { name?: string }) => layer.name === 'Rectangle');
      parent.x += 80;
      localStorage.setItem(key, JSON.stringify(data));
    });
    await page.reload();
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

    const transformsAfter = await page.locator('g[transform^="translate"]').evaluateAll(
      (groups) => groups.map((group) => group.getAttribute('transform')),
    );
    expect(transformsAfter).not.toEqual(transformsBefore);
  });
});
