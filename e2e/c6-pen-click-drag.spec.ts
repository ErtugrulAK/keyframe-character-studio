/**
 * C6 — the Pen in a real browser: a click is a corner point, a press-and-drag
 * is ONE smooth point whose tangent follows the mouse (no rain of points), the
 * release ends that point, the first point closes, Undo/Redo step through
 * whole points (a placed point and its dragged tangent are one step), and the
 * saved shape keeps the tangents after a reload. The mask Pen follows the
 * same rules.
 */
import { expect, test, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

async function seed(page: Page): Promise<void> {
  const layer = {
    id: 'base', name: 'Base', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 3, scaleY: 3, opacity: 1, visible: true, zIndex: 1,
    fillColor: '#334155', strokeColor: '#101218', width: 120, height: 60,
  };
  const scene = {
    version: 2, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers: [layer],
    tracks: [{ id: 'track-base', partId: 'base', name: 'Base', color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() }],
  };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const stageCentre = async (page: Page) => {
  const box = await page.locator('.stage-canvas-container').boundingBox();
  if (!box) throw new Error('no stage');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const savedScene = async (page: Page) => {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
};

const draftPoints = (page: Page) => page.getByTestId('freeform-draft-point');

/** Press at (x, y), move through many events to (tx, ty), release. */
const dragFrom = async (page: Page, x: number, y: number, tx: number, ty: number) => {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(tx, ty, { steps: 25 });
  await page.mouse.up();
};

test('shape Pen: click = corner, drag = one smooth point, undo/redo per point, closes on the first point and survives reload', async ({ page }) => {
  await seed(page);
  const c = await stageCentre(page);
  await page.getByRole('button', { name: 'Pen', exact: true }).click();

  await page.mouse.click(c.x - 150, c.y - 100); // corner
  await expect(draftPoints(page)).toHaveCount(1);
  // A long drag with 25 move events places ONE point.
  await dragFrom(page, c.x + 150, c.y - 100, c.x + 230, c.y - 40);
  await expect(draftPoints(page)).toHaveCount(2);
  await expect(draftPoints(page).nth(1)).toHaveAttribute('data-point-kind', 'smooth');
  await expect(page.getByTestId('pen-draft-handle')).toHaveCount(2); // in + out of the shaped point
  // Hovering after the release adds nothing.
  await page.mouse.move(c.x + 60, c.y + 120, { steps: 10 });
  await expect(draftPoints(page)).toHaveCount(2);
  await page.mouse.click(c.x + 150, c.y + 100); // corner
  await expect(draftPoints(page)).toHaveCount(3);
  await expect(draftPoints(page).nth(2)).toHaveAttribute('data-point-kind', 'corner');

  // Undo removes the last point; undo again removes the smooth point WITH its tangent; redo brings both back.
  await page.keyboard.press('Control+z');
  await expect(draftPoints(page)).toHaveCount(2);
  await page.keyboard.press('Control+z');
  await expect(draftPoints(page)).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z');
  await expect(draftPoints(page)).toHaveCount(2);
  await expect(draftPoints(page).nth(1)).toHaveAttribute('data-point-kind', 'smooth');
  await page.keyboard.press('Control+Shift+z');
  await expect(draftPoints(page)).toHaveCount(3);

  // Close on the first point with the mouse.
  await page.mouse.move(c.x - 150, c.y - 100, { steps: 4 });
  await expect(draftPoints(page).first()).toHaveAttribute('data-close-target', 'true');
  await page.mouse.click(c.x - 150, c.y - 100);
  await expect(draftPoints(page)).toHaveCount(0);
  await expect(page.locator('.tree-node.actor-node')).toHaveCount(2);

  const scene = await savedScene(page);
  const shape = scene.layers.find((layer: any) => layer.type === 'custom_freeform');
  expect(shape.path.closed).toBe(true);
  expect(shape.path.points.map((point: any) => point.kind)).toEqual(['corner', 'smooth', 'corner']);
  expect(shape.path.points[1].handleOut).toBeTruthy();
  expect(shape.path.points[1].handleIn).toBeTruthy();

  // One Undo removes the whole finished shape (one scene step), Redo restores it.
  await page.keyboard.press('Control+z');
  await expect(page.locator('.tree-node.actor-node')).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.tree-node.actor-node')).toHaveCount(2);

  await savedScene(page);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  const reloaded = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
  const again = reloaded.layers.find((layer: any) => layer.type === 'custom_freeform');
  expect(again.path).toEqual(shape.path);
  // The drawn outline is a curve: its SVG path has cubic segments.
  await expect(page.locator(`.stage-svg g[data-part-id="${again.id}"] path[d*="C"]`).first()).toBeAttached();
});

test('shape Pen: the visible Finish control and a double-click finish; Esc discards', async ({ page }) => {
  await seed(page);
  const c = await stageCentre(page);
  await page.getByRole('button', { name: 'Pen', exact: true }).click();
  await page.mouse.click(c.x - 100, c.y - 80);
  await dragFrom(page, c.x + 100, c.y - 80, c.x + 140, c.y);
  await page.mouse.click(c.x, c.y + 100);
  await page.getByTestId('freeform-draft-banner').getByRole('button', { name: /Finish/ }).click();
  await expect(page.locator('.tree-node.actor-node')).toHaveCount(2);

  await page.getByRole('button', { name: 'Pen', exact: true }).click();
  await page.mouse.click(c.x - 200, c.y - 150);
  await page.mouse.click(c.x - 120, c.y - 150);
  await page.mouse.dblclick(c.x - 160, c.y - 60);
  await expect(page.locator('.tree-node.actor-node')).toHaveCount(3);

  await page.getByRole('button', { name: 'Pen', exact: true }).click();
  await page.mouse.click(c.x + 200, c.y + 150);
  await page.keyboard.press('Escape');
  await expect(draftPoints(page)).toHaveCount(0);
  await expect(page.locator('.tree-node.actor-node')).toHaveCount(3);
});

test('mask Pen: click = corner, drag = one smooth point; the committed mask keeps the tangent', async ({ page }) => {
  await seed(page);
  await page.locator('.tree-node[data-layer-id="base"]').click();
  await openDetailsTab(page, 'Masks');
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
  await page.getByRole('button', { name: 'Draw pen mask' }).click();
  const c = await stageCentre(page);
  const points = page.getByTestId('mask-draw-point');
  await page.mouse.click(c.x - 100, c.y - 60);
  await dragFrom(page, c.x + 100, c.y - 60, c.x + 160, c.y - 10);
  await expect(points).toHaveCount(2);
  await expect(points.nth(1)).toHaveAttribute('data-point-kind', 'smooth');
  await expect(page.getByTestId('mask-draw-handle')).toHaveCount(2);
  await page.mouse.click(c.x, c.y + 80);
  await expect(points).toHaveCount(3);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(points).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z');
  await page.keyboard.press('Control+Shift+z');
  await expect(points).toHaveCount(3);
  await page.mouse.click(c.x - 100, c.y - 60); // the first point closes
  await expect(page.getByTestId('mask-draw-overlay')).toHaveCount(0);
  const scene = await savedScene(page);
  const mask = scene.layers.find((layer: any) => layer.id === 'base').masks.at(-1);
  expect(mask.path.points.map((point: any) => point.kind)).toEqual(['corner', 'smooth', 'corner']);
  expect(mask.path.points[1].handleOut).toBeTruthy();
});
