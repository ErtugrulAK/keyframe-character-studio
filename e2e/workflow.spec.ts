import { test, expect } from '@playwright/test';

test.describe('Phase 6.4 E2E Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto('/');
  });

  test('Create a new project, add parts, edit, and play', async ({ page }) => {
    test.setTimeout(60000);
    // The application should initialize and render the canvas
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

    // Navigate to Vector Shapes Toolbar
    await page.getByTitle('Vector Shapes & Graphic Elements').click();

    // Add a Rectangle
    await page.getByRole('button', { name: 'Rectangle', exact: true }).click();

    // Add a Circle
    await page.getByRole('button', { name: 'Circle', exact: true }).click();

    // Verify elements appear in the timeline outliner (scoped to the outliner
    // because 'Rectangle'/'Circle' also appear in the toolbar and on the canvas)
    await expect(page.locator('.ue-outliner').getByText('Rectangle').first()).toBeVisible();
    await expect(page.locator('.ue-outliner').getByText('Circle').first()).toBeVisible();

    // Play the sequence, then pause it (the transport button toggles its title)
    await page.getByTitle('Play', { exact: true }).click();
    await page.waitForTimeout(1000);
    await page.getByTitle('Pause', { exact: true }).click();

    // Undo / Redo
    await page.keyboard.press('Control+Z');
    await page.keyboard.press('Control+Y');

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

    // The tool automatically returns to the select tool after committing
    await expect(page.getByTitle('Vector Shapes & Graphic Elements')).toBeVisible();
  });
});
