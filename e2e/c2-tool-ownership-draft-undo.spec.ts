/**
 * C2-A/B — the active tool owns the stage pointer, and an unfinished drawing
 * owns Undo/Redo.
 *
 * - With Rectangle / Circle / Pen armed, a press on a full-canvas image draws;
 *   it never selects, moves or rewrites the image, and adds one history entry.
 * - Releasing outside the stage and a pointercancel leave no half gesture.
 * - While a Pen draft is open, Ctrl+Z / Ctrl+Shift+Z undo and redo the DRAFT's
 *   own points; the scene history (two earlier shapes) is untouched until the
 *   draft is finished, after which one scene Undo removes only the new shape.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const IMAGE = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="#3b82f6"/><rect y="700" width="1920" height="380" fill="#15803d"/></svg>',
).toString('base64')}`;

async function seed(page: Page, extraLayers: Record<string, unknown>[] = []): Promise<void> {
  const layers = [
    { id: 'bg', name: 'Background', type: 'custom_image', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#fff', strokeColor: '#000', width: 1920, height: 1080, imageUrl: IMAGE },
    ...extraLayers,
  ];
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers,
    tracks: layers.map((layer) => ({ id: `track-${layer.id}`, partId: layer.id, name: layer.id, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() })),
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => {
    localStorage.clear();
    localStorage.setItem(entry.key, entry.value);
  }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

async function stageCenter(page: Page) {
  const box = await page.locator('.stage-canvas-container').boundingBox();
  if (!box) throw new Error('no stage');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const pose = (layer: Record<string, any>) => [layer.x, layer.y, layer.rotation, layer.scaleX, layer.scaleY, layer.width, layer.height];

test.describe('C2 — tool ownership on top of a full-canvas image', () => {
  for (const tool of ['Add rectangle', 'Add circle'] as const) {
    test(`${tool}: a drag over the image creates the shape and leaves the image alone`, async ({ page }) => {
      await seed(page);
      const before = await savedScene(page);
      const c = await stageCenter(page);
      // The image is selected first: drawing must not keep it selected or move it.
      await page.locator('.ue-track-row', { hasText: 'Background' }).first().click();
      await page.getByRole('button', { name: tool }).click();
      await page.mouse.move(c.x - 60, c.y - 40);
      await page.mouse.down();
      await page.mouse.move(c.x + 60, c.y + 40, { steps: 6 });
      await page.mouse.up();
      const after = await savedScene(page);
      expect(after.layers).toHaveLength(2);
      const bg = after.layers.find((layer: any) => layer.id === 'bg');
      expect(pose(bg)).toEqual(pose(before.layers[0]));
      // The new shape is THE selection (Outliner and Timeline agree), not the image.
      await expect(page.locator('.ue-track-row.selected')).toHaveCount(1);
      await expect(page.locator('.ue-track-row.selected')).not.toContainText('Background');
      await expect(page.locator('[role="treeitem"].primary-selected')).not.toContainText('Background');
      // One Undo removes exactly the new shape.
      await page.getByTitle('Undo').click();
      expect((await savedScene(page)).layers.map((layer: any) => layer.id)).toEqual(['bg']);
    });
  }

  test('Pen: clicks over the image add points; the image is never selected or moved', async ({ page }) => {
    await seed(page);
    const before = await savedScene(page);
    const c = await stageCenter(page);
    await page.getByRole('button', { name: 'Pen' }).click();
    for (const [dx, dy] of [[-80, -50], [80, -50], [90, 60]]) await page.mouse.click(c.x + dx, c.y + dy);
    await page.mouse.dblclick(c.x - 70, c.y + 60);
    const after = await savedScene(page);
    expect(after.layers).toHaveLength(2);
    expect(after.layers.find((layer: any) => layer.type === 'custom_freeform')).toBeDefined();
    expect(pose(after.layers.find((layer: any) => layer.id === 'bg'))).toEqual(pose(before.layers[0]));
  });

  test('a drag released outside the stage and a pointercancel leave no half gesture', async ({ page }) => {
    await seed(page);
    const c = await stageCenter(page);
    await page.getByRole('button', { name: 'Add rectangle' }).click();
    await page.mouse.move(c.x - 50, c.y - 50);
    await page.mouse.down();
    await page.mouse.move(c.x + 40, c.y + 40, { steps: 4 });
    await page.mouse.move(5, 5, { steps: 4 }); // over the header, outside the stage
    await page.mouse.up();
    let scene = await savedScene(page);
    // Released outside: the drag still ends as exactly one shape (the gesture belongs to the stage).
    expect(scene.layers).toHaveLength(2);
    const count = scene.layers.length;
    // The tool stays armed after a shape (shown on the toolbar); a cancelled
    // pointer adds nothing and the image stays put.
    await expect(page.getByRole('button', { name: 'Add rectangle' })).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.move(c.x - 30, c.y - 30);
    await page.mouse.down();
    await page.mouse.move(c.x + 30, c.y + 30, { steps: 3 });
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true })));
    await page.mouse.up();
    scene = await savedScene(page);
    expect(scene.layers.length).toBe(count);
    expect(pose(scene.layers.find((layer: any) => layer.id === 'bg'))).toEqual([0, 0, 0, 1, 1, 1920, 1080]);
  });
});

test('C2 — Undo/Redo inside an unfinished Pen draft never touches finished shapes', async ({ page }) => {
  await seed(page, [
    { id: 's1', name: 'Shape One', type: 'custom_rect', x: -300, y: -200, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, fillColor: '#f00', strokeColor: '#000', width: 80, height: 80 },
    { id: 's2', name: 'Shape Two', type: 'custom_rect', x: 300, y: -200, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 3, fillColor: '#0f0', strokeColor: '#000', width: 80, height: 80 },
  ]);
  const before = await savedScene(page);
  const c = await stageCenter(page);
  await page.getByRole('button', { name: 'Pen' }).click();
  // 17 points on a circle of radius 120 CSS px.
  for (let index = 0; index < 17; index += 1) {
    const angle = (index / 17) * Math.PI * 2;
    await page.mouse.click(c.x + Math.cos(angle) * 120, c.y + Math.sin(angle) * 120);
  }
  const points = page.getByTestId('freeform-draft-point');
  await expect(points).toHaveCount(17);
  await page.keyboard.press('Control+z');
  await expect(points).toHaveCount(16);
  await page.keyboard.press('Control+Shift+z');
  await expect(points).toHaveCount(17);
  await page.keyboard.press('Control+z');
  await expect(points).toHaveCount(16);
  // A new point after Undo replaces the redo branch.
  await page.mouse.click(c.x + 30, c.y + 150);
  await expect(points).toHaveCount(17);
  await page.keyboard.press('Control+Shift+z');
  await expect(points).toHaveCount(17);
  // Nothing in the scene changed while drafting.
  expect((await savedScene(page)).layers).toEqual(before.layers);

  await page.getByRole('button', { name: 'Finish drawing' }).click();
  const finished = await savedScene(page);
  expect(finished.layers).toHaveLength(4);
  await page.getByTitle('Undo').click();
  expect((await savedScene(page)).layers).toEqual(before.layers);
});

test.describe('C2 — finishing and leaving a freeform drawing with the mouse', () => {
  test('a freehand stroke is ONE draft step; clicking the first point closes; then Select works again', async ({ page }) => {
    await seed(page);
    const c = await stageCenter(page);
    await page.getByRole('button', { name: 'Pen' }).click();
    await page.mouse.click(c.x - 100, c.y - 60);
    // A dragged stroke adds many samples …
    await page.mouse.move(c.x + 100, c.y - 60);
    await page.mouse.down();
    await page.mouse.move(c.x + 120, c.y + 20, { steps: 12 });
    await page.mouse.move(c.x + 60, c.y + 70, { steps: 12 });
    await page.mouse.up();
    const points = page.getByTestId('freeform-draft-point');
    const afterStroke = await points.count();
    expect(afterStroke).toBeGreaterThan(4);
    // … and one Undo removes the whole stroke.
    await page.keyboard.press('Control+z');
    await expect(points).toHaveCount(1);
    await page.keyboard.press('Control+Shift+z');
    await expect(points).toHaveCount(afterStroke);
    // The first point shows a close affordance on hover and closes on click.
    const first = await points.first().boundingBox();
    if (!first) throw new Error('no first point');
    await page.mouse.move(first.x + first.width / 2 + 4, first.y + first.height / 2 + 3);
    await expect(points.first()).toHaveAttribute('data-close-target', 'true');
    await page.mouse.click(first.x + first.width / 2 + 4, first.y + first.height / 2 + 3);
    await expect(page.getByTestId('freeform-draft-banner')).toHaveCount(0);
    let scene = await savedScene(page);
    expect(scene.layers.filter((layer: any) => layer.type === 'custom_freeform')).toHaveLength(1);
    // Finishing hands the stage back to Select: a click selects the background.
    await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true');
    // And drawing again works the same way.
    await page.getByRole('button', { name: 'Pen' }).click();
    for (const [dx, dy] of [[-40, 100], [40, 100], [0, 160]]) await page.mouse.click(c.x + dx, c.y + dy);
    await page.getByRole('button', { name: 'Finish drawing' }).click();
    scene = await savedScene(page);
    expect(scene.layers.filter((layer: any) => layer.type === 'custom_freeform')).toHaveLength(2);
  });

  test('switching tools finishes a valid draft and reports a too-short one; Escape discards the draft, then leaves the tool', async ({ page }) => {
    await seed(page);
    const c = await stageCenter(page);
    await page.getByRole('button', { name: 'Pen' }).click();
    for (const [dx, dy] of [[-60, -40], [60, -40], [0, 60]]) await page.mouse.click(c.x + dx, c.y + dy);
    await page.getByRole('button', { name: 'Add rectangle' }).click();
    await expect(page.getByText('Freeform shape finished when you switched tools')).toBeVisible();
    let scene = await savedScene(page);
    expect(scene.layers.filter((layer: any) => layer.type === 'custom_freeform')).toHaveLength(1);
    // The tool the user chose stays active.
    await expect(page.getByRole('button', { name: 'Add rectangle' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Pen' }).click();
    await page.mouse.click(c.x - 30, c.y + 120);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await expect(page.getByText('Drawing discarded: a shape needs at least three points')).toBeVisible();
    scene = await savedScene(page);
    expect(scene.layers.filter((layer: any) => layer.type === 'custom_freeform')).toHaveLength(1);

    await page.getByRole('button', { name: 'Pen' }).click();
    await page.mouse.click(c.x - 30, c.y + 120);
    await page.mouse.click(c.x + 30, c.y + 120);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('freeform-draft-banner')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pen' })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
});
