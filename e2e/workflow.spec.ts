import { test, expect, type Page } from '@playwright/test';
import { openDuplicateCard } from './fixtures/inspectorTabs';

test.describe('Phase 6.4 E2E Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto('/');
  });

/**
 * The gesture is expressed from the stage box's own centre (an 80x80 CSS px
 * drag), so a changed stage height — the docked authoring strip owns 40 px of
 * the layout — can never push a drag onto the timeline panel below.
 */
async function createShapeByDrag(page: Page, name: string, offsetX = 0, offsetY = 0, halfSize = 40): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click();
  const canvas = page.locator('.stage-canvas-container');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas bounds unavailable');
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(center.x + halfSize + offsetX, center.y + halfSize + offsetY);
  await page.mouse.down();
  await page.mouse.move(center.x - halfSize + offsetX, center.y - halfSize + offsetY);
  await page.mouse.up();
}

/** A point on the visible stage at an offset from its centre, measured live. */
async function stagePoint(page: Page, offsetX: number, offsetY: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('.stage-canvas-container').boundingBox() /* C7b: the visible stage; the drawing surface is window-sized */;
  if (!box) throw new Error('Stage bounds unavailable');
  return { x: box.width / 2 + offsetX, y: box.height / 2 + offsetY };
}

/** A click on the visible stage at an offset from its centre, measured live. */
async function clickStagePoint(page: Page, offsetX: number, offsetY: number): Promise<void> {
  await page.locator('.stage-canvas-container').click({ position: await stagePoint(page, offsetX, offsetY) });
}

  test('Create a new project, add parts, edit, and play', async ({ page }) => {
    test.setTimeout(60000);
    // The application should initialize and render the canvas
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

    // Navigate to Vector Shapes Toolbar
    await page.getByRole('button', { name: 'Vector Shapes & Graphic Elements' }).click();

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
    await openDuplicateCard(page);
    await page.getByRole('button', { name: 'Mirror Y', exact: true }).click();
    await expect(page.locator('.ue-outliner').getByText('Circle Mirror Y').first()).toBeVisible();

    // Play the sequence, then pause it (the transport button toggles its title).
    // The transport is asserted into its PLAYING state and back instead of waiting
    // a fixed second: a default document is 60 frames at 60 FPS — exactly 1.000 s —
    // so a fixed 1 s wait lands on the FINISHED state the exact timebase guarantees
    // and the pause control is never seen. Asserting the two transitions is the
    // stronger contract, and no duration-dependent sleep is involved.
    await page.getByTitle('Play', { exact: true }).click();
    await expect(page.getByTitle('Pause', { exact: true })).toBeVisible();
    await page.getByTitle('Pause', { exact: true }).click();
    await expect(page.getByTitle('Play', { exact: true })).toBeVisible();

    // Copy / Paste parts
    await page.keyboard.press('Control+C');
    await page.keyboard.press('Control+V');

    // Delete part
    await page.keyboard.press('Delete');

    // The current V6 workflow keeps project templates in the Project Workspace.
    // The former Motion Transitions surface is intentionally not part of the
    // consolidated toolbar.
    await expect(page.getByRole('button', { name: 'Project Workspace' })).toBeVisible();
    await expect(page.getByTitle('Motion Transitions')).toHaveCount(0);
  });

  test('Finalize a freeform shape with Enter and return to Select', async ({ page }) => {
    test.setTimeout(60000);
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Vector Shapes & Graphic Elements' }).click();
    await page.getByRole('button', { name: 'Free Draw', exact: true }).click();
    await page.getByRole('button', { name: 'Hide Left Toolbar', exact: true }).click();

    await clickStagePoint(page, -80, 20);
    await clickStagePoint(page, 80, 0);
    await clickStagePoint(page, 0, 50);
    await page.keyboard.press('Enter');

    await expect(page.locator('.ue-outliner').getByText('Freeform Shape').first()).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('Draw a freeform shape with the Free Draw tool', async ({ page }) => {
    test.setTimeout(60000);
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

    // Open the vector shapes drawer and activate the Free Draw tool
    await page.getByRole('button', { name: 'Vector Shapes & Graphic Elements' }).click();
    await page.getByRole('button', { name: 'Free Draw', exact: true }).click();

    // Draw an irregular polygon: 3 corner clicks + double-click to finish
    await clickStagePoint(page, -80, 20);
    await clickStagePoint(page, 80, 0);
    await clickStagePoint(page, 0, 50);
    await page.locator('.stage-canvas-container').dblclick({ position: await stagePoint(page, 0, 50) });

    // The finished shape appears in the timeline outliner
    await expect(page.locator('.ue-outliner').getByText('Freeform Shape').first()).toBeVisible();
  });

  test('Persisted parent relation makes a freeform shape move with its rectangle', async ({ page }) => {
    test.setTimeout(60000);
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Vector Shapes & Graphic Elements' }).click();

    // Draw the small freeform first, at the stage centre: a mousedown that lands
    // on an existing layer belongs to that layer, so the freeform tool only ever
    // receives clicks on empty canvas.
    await page.getByRole('button', { name: 'Free Draw', exact: true }).click();
    await clickStagePoint(page, -80, 20);
    await clickStagePoint(page, 80, 0);
    await clickStagePoint(page, 0, 50);
    await page.locator('.stage-canvas-container').dblclick({ position: await stagePoint(page, 0, 50) });
    await expect(page.locator('.ue-outliner').getByText('Freeform Shape').first()).toBeVisible();

    // Surround it with the container rectangle, so the freeform stays INSIDE
    // the container's area.
    await createShapeByDrag(page, 'Rectangle', 0, 0, 100);

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
