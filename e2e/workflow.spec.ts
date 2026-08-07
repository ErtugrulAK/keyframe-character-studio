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

    // The tool automatically returns to the select tool after committing
    await expect(page.getByTitle('Vector Shapes & Graphic Elements')).toBeVisible();
  });

  test('Put a freeform shape inside a rectangle container (clipped + moves together)', async ({ page }) => {
    test.setTimeout(60000);
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

    // Add a Rectangle (the container)
    await page.getByTitle('Vector Shapes & Graphic Elements').click();
    await page.getByRole('button', { name: 'Rectangle', exact: true }).click();

    // Draw a small freeform INSIDE the rectangle's area (rect sits at center 300,240)
    await page.getByRole('button', { name: 'Free Draw', exact: true }).click();
    const svg = page.locator('.stage-svg');
    await svg.click({ position: { x: 275, y: 220 } });
    await svg.click({ position: { x: 325, y: 225 } });
    await svg.click({ position: { x: 300, y: 255 } });
    await svg.dblclick({ position: { x: 300, y: 255 } });
    await expect(page.locator('.ue-outliner').getByText('Freeform Shape').first()).toBeVisible();

    // Open the Transform tab and put the freeform into the rectangle via CONTAINER
    await page.getByRole('button', { name: 'Transform', exact: true }).click();
    const containerSelect = page.locator('.details-body select').first();
    await containerSelect.selectOption({ label: 'Rectangle' });
    await page.waitForTimeout(400);

    // The child's <g> must now carry the container clip path, and the def must exist
    const clipCheck = await page.evaluate(() => {
      const clipped = [...document.querySelectorAll('g')].filter((g) => (g.getAttribute('clip-path') || '').startsWith('url(#containerClip-'));
      const clipIds = [...document.querySelectorAll('clipPath')].map((c) => c.id);
      return { clippedCount: clipped.length, hasDef: clipped.length > 0 && clipIds.includes(clipped[0].getAttribute('clip-path')!.slice(5, -1)) };
    });
    expect(clipCheck.clippedCount).toBe(1);
    expect(clipCheck.hasDef).toBe(true);

    // Drag the rectangle; the child must move with it
    const childTranslateBefore = await page.evaluate(() => {
      const g = [...document.querySelectorAll('g')].find((el) => (el.getAttribute('clip-path') || '').startsWith('url(#containerClip-'));
      return g ? g.getAttribute('transform') : null;
    });
    // Find the rectangle's rendered position: the clipPath def sits right before
    // the container's <g> (defs + g are siblings inside the PartRenderer fragment)
    const rectCenter = await page.evaluate(() => {
      const clipPath = document.querySelector('clipPath[id^="containerClip-"]');
      if (!clipPath) return null;
      const defs = clipPath.closest('defs');
      const g = defs ? (defs.nextElementSibling as SVGGElement | null) : null;
      if (!g) return null;
      const r = g.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    expect(rectCenter).not.toBeNull();
    await page.mouse.move(rectCenter!.x, rectCenter!.y);
    await page.mouse.down();
    await page.mouse.move(rectCenter!.x + 80, rectCenter!.y + 50, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(400);

    const childTranslateAfter = await page.evaluate(() => {
      const g = [...document.querySelectorAll('g')].find((el) => (el.getAttribute('clip-path') || '').startsWith('url(#containerClip-'));
      return g ? g.getAttribute('transform') : null;
    });
    expect(childTranslateAfter).not.toBe(childTranslateBefore);
  });
});
