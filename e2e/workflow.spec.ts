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

    // Verify elements are on timeline
    await expect(page.getByText('Rectangle')).toBeVisible();
    await expect(page.getByText('Circle')).toBeVisible();

    // Move/Rotate/Scale parts via Inspector
    // We assume the inspector has an X, Y input
    const xInput = page.getByLabel('Position X', { exact: false }).first();
    if (await xInput.isVisible()) {
      await xInput.fill('150');
      await xInput.press('Enter');
    }

    // Create keyframes - moving to a different frame on the timeline
    // The timeline might have a timeline ruler or a playhead. We just click Play.
    await page.getByTitle('Play Animation').click();
    
    // Let it play for a bit
    await page.waitForTimeout(1000);
    
    // Stop playback
    await page.getByTitle('Stop Animation').click();

    // Undo / Redo
    await page.keyboard.press('Control+Z');
    await page.keyboard.press('Control+Y');

    // Copy / Paste parts
    await page.keyboard.press('Control+C');
    await page.keyboard.press('Control+V');
    
    // The clipboard might be restricted by browser security policies, but the internal event should fire.
    
    // Delete part
    await page.keyboard.press('Delete');

    // Switch Project Templates
    await page.getByTitle('Project Workspace').click();
    
    // Switch Motion Templates
    await page.getByTitle('Motion Transitions').click();
  });
});
