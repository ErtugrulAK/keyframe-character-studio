import { test, expect, type Page } from '@playwright/test';

/**
 * The authored layer index survives new layers, template switching, autosave and
 * reload.
 *
 * R5-15 — the index is observed where the user sees it: the STAGE'S PAINT ORDER.
 * The inspector no longer repeats z-order (Arrange lives on the authoring
 * toolbar, which writes through the same `handleZIndexChange` path), so the spec
 * drives that control and reads the generated stage — ascending `zIndex` paints
 * later, so the last rendered layer is the one on top.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

async function createShapeByDrag(page: Page, name: string, offsetX = 0): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click();
  const box = await page.locator('.stage-canvas-container').boundingBox();
  if (!box) throw new Error('Canvas bounds unavailable');
  // Measured from the stage centre, so the docked authoring strip's layout
  // share can never push the drag onto the timeline panel.
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(center.x + 40 + offsetX, center.y + 40);
  await page.mouse.down();
  await page.mouse.move(center.x - 40 + offsetX, center.y - 40);
  await page.mouse.up();
}

async function openTransform(page: Page): Promise<void> {
  const disclosure = page.getByRole('button', { name: /(?:Expand|Collapse) TRANSFORM/ });
  if (await disclosure.getAttribute('aria-expanded') === 'false') await disclosure.click();
}

/**
 * The rendered layers, bottom to top: the part groups of the stage in document
 * order, which is the `zIndex` order the stage paints in.
 */
function paintOrder(page: Page): Promise<(string | null)[]> {
  return page.evaluate(() => [...document.querySelectorAll('.stage-canvas-container [data-part-id]')]
    .filter((node) => node.tagName === 'g')
    .map((node) => node.getAttribute('data-part-id')));
}

test('authored layer index survives new layers, template switching, autosave, and reload', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole('button', { name: 'Vector Shapes & Graphic Elements' }).click();
  for (const [index, shape] of ['Rectangle', 'Circle', 'Triangle'].entries()) {
    await createShapeByDrag(page, shape, (index - 1) * 80);
  }

  // A newly added layer is prepended with `max + 1`, so the FIRST shape created
  // is the one that paints at the bottom: the paint order names them for us.
  const born = await paintOrder(page);
  expect(born).toHaveLength(3);
  const [rectangle, circle, triangle] = born as string[];
  expect(new Set(born).size).toBe(3);
  expect(await paintOrder(page)).toEqual([rectangle, circle, triangle]);

  // Arrange the selected layer one step forward: it swaps with its neighbour and
  // keeps its own authored index — no renumbering of the others.
  await page.locator('.actor-node', { hasText: 'Rectangle' }).click();
  await openTransform(page);
  await page.getByRole('button', { name: 'Bring forward', exact: true }).click();
  expect(await paintOrder(page)).toEqual([circle, rectangle, triangle]);

  await page.getByTitle('Undo').click();
  expect(await paintOrder(page)).toEqual([rectangle, circle, triangle]);
  await expect(page.getByTitle('Redo')).toBeEnabled();
  await page.getByTitle('Redo').click();
  expect(await paintOrder(page)).toEqual([circle, rectangle, triangle]);

  // Adding a new shape used to silently reindex every existing part.
  await createShapeByDrag(page, 'Square', 120);
  const withSquare = await paintOrder(page);
  expect(withSquare).toHaveLength(4);
  expect(withSquare.slice(0, 3)).toEqual([circle, rectangle, triangle]);
  const square = withSquare[3] as string;

  // Selection changes and an unrelated style-tab visit must not reconstruct the
  // selected part from an older/default layer index.
  await page.locator('.actor-node', { hasText: 'Triangle' }).click();
  await page.locator('.actor-node', { hasText: 'Rectangle' }).click();
  await openTransform(page);
  expect(await paintOrder(page)).toEqual([circle, rectangle, triangle, square]);

  // Project template switching is part of the active-state contract.
  await page.getByTitle('Create New Template').click();
  await page.getByPlaceholder('Template name (e.g. LowerThird_v2)...').fill('Other Template');
  await page.getByRole('button', { name: 'Create Template', exact: true }).click();
  await page.getByTitle('Template: Template').click();
  await page.locator('.actor-node', { hasText: 'Rectangle' }).click();
  await openTransform(page);
  expect(await paintOrder(page)).toEqual([circle, rectangle, triangle, square]);

  // Edit/Broadcast mode transitions do not own the authored zIndex state.
  await page.getByText('BROADCAST', { exact: true }).click();
  await page.getByText('EDIT MODE', { exact: true }).click();
  expect(await paintOrder(page)).toEqual([circle, rectangle, triangle, square]);

  // Wait for the observable autosave payload rather than sleeping for an
  // unexplained duration.
  await expect.poll(async () => page.evaluate(([key, rectId]) => {
    const data = JSON.parse(localStorage.getItem(key) || '{}') as { layers?: { id?: string; zIndex?: number }[] };
    return data.layers?.find((layer) => layer.id === rectId)?.zIndex;
  }, [STORAGE_KEY, rectangle] as const), { timeout: 15000 }).toBe(2);

  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  expect(await paintOrder(page)).toEqual([circle, rectangle, triangle, square]);

  const persisted = await page.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key) || '{}') as { layers?: { id?: string; zIndex?: number }[] };
    const layers = data.layers || [];
    return {
      values: layers.map((layer) => [layer.id, layer.zIndex]),
      renderOrder: [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map((layer) => layer.id),
    };
  }, STORAGE_KEY);

  expect(persisted.values.find(([id]) => id === rectangle)?.[1]).toBe(2);
  expect(persisted.renderOrder).toEqual([circle, rectangle, triangle, square]);
});
