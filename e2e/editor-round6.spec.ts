/**
 * QA round 6: the menu bar, the tool flyout, drawing text, paste at the mouse,
 * undo keeping the selection, the live marquee preview and Shift/Alt applying
 * the moment they are pressed.
 */
import { expect, test, type Page } from '@playwright/test';
import { armTool } from './fixtures/toolbarTools';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const rect = (id: string, name: string, x: number, y: number) => ({
  id, name, type: 'custom_rect', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#f97316', strokeColor: '#000000', width: 120, height: 60,
});

async function seed(page: Page, layers: unknown[] = []) {
  await page.goto('/');
  await page.evaluate(([key, value]) => { localStorage.clear(); localStorage.setItem(key, value); }, [STORAGE_KEY, JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers,
    tracks: (layers as Array<{ id: string; name: string }>).map((layer) => ({ id: `track-${layer.id}`, partId: layer.id, name: layer.name, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: {} })),
  })] as const);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const stageBox = async (page: Page) => {
  const box = await page.locator('.stage-canvas-container').boundingBox();
  if (!box) throw new Error('no stage');
  return box;
};

const savedLayers = async (page: Page) => {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  // A fresh save, not the state an earlier save left.
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10_000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').layers as Array<Record<string, number | string>>, STORAGE_KEY);
};

/** The screen point of a world (layer x/y) point. */
const screenOf = (page: Page, x: number, y: number) => page.evaluate(([wx, wy]) => {
  const svg = document.querySelector<SVGSVGElement>('.stage-svg')!;
  const point = new DOMPoint(300 + wx, 240 + wy).matrixTransform(svg.getScreenCTM()!);
  return { x: point.x, y: point.y };
}, [x, y] as [number, number]);

test('the menu bar runs the editor commands; the left panel is gone', async ({ page }) => {
  await seed(page, [rect('a', 'Alpha', 0, 0)]);
  const bar = page.getByRole('menubar', { name: 'Editor menu' });
  await expect(page.locator('.left-toolbar-container')).toHaveCount(0);
  await bar.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await page.getByRole('menuitem', { name: /^Select All/ }).click();
  await expect(page.locator('[role="tree"] [data-layer-id="a"]')).toHaveAttribute('aria-selected', 'true');
  // Hovering another title while a menu is open switches to it; Escape closes.
  await bar.getByRole('menuitem', { name: 'View', exact: true }).click();
  await bar.getByRole('menuitem', { name: 'Object', exact: true }).hover();
  await expect(page.getByRole('menuitem', { name: 'Reset Transform' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'Reset Transform' })).toHaveCount(0);
  await bar.getByRole('menuitem', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Project Settings…' }).click();
  await expect(page.getByRole('dialog', { name: 'Project Settings' })).toBeVisible();
});

test('holding the shape button opens its list; releasing over Star picks it and the button keeps it', async ({ page }) => {
  await seed(page);
  const button = page.getByRole('button', { name: 'Add rectangle' });
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.getByRole('menu', { name: /tools$/ })).toBeVisible();
  const star = (await page.getByRole('menuitemradio', { name: /^Star/ }).boundingBox())!;
  await page.mouse.move(star.x + 20, star.y + star.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Add star' })).toHaveAttribute('aria-pressed', 'true');
  const stage = await stageBox(page);
  await page.mouse.move(stage.x + 200, stage.y + 150);
  await page.mouse.down();
  await page.mouse.move(stage.x + 300, stage.y + 250, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('.actor-node', { hasText: 'Star' })).toHaveCount(1);
  // A second press keeps the tool.
  await page.getByRole('button', { name: 'Add star' }).click();
  await expect(page.getByRole('button', { name: 'Add star' })).toHaveAttribute('aria-pressed', 'true');
});

test('the Text tool draws a text box: its size from the drag, its centre in the box', async ({ page }) => {
  await seed(page);
  await page.getByRole('button', { name: 'Add text' }).click();
  const from = await screenOf(page, -200, -50);
  const to = await screenOf(page, 200, 50);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  const [text] = await savedLayers(page);
  expect(text.type).toBe('custom_text');
  expect(Math.abs(Number(text.x))).toBeLessThan(3);
  expect(Math.abs(Number(text.y))).toBeLessThan(3);
  // 100 units tall → a font about 100 / 1.2; the box width limits the text.
  expect(Number(text.fontSize)).toBeGreaterThan(75);
  expect(Number(text.fontSize)).toBeLessThan(90);
  expect((text.textFit as unknown as { maxWidth: number }).maxWidth).toBeGreaterThan(390);
});

test('Ctrl+V pastes where the mouse is', async ({ page }) => {
  await seed(page, [rect('a', 'Alpha', -300, -200)]);
  await page.locator('[role="tree"] [data-layer-id="a"]').click();
  await page.keyboard.press('Control+c');
  const target = await screenOf(page, 250, 120);
  await page.mouse.move(target.x, target.y);
  await page.keyboard.press('Control+v');
  const layers = await savedLayers(page);
  const copy = layers.find((layer) => layer.name === 'Alpha Copy')!;
  expect(Math.abs(Number(copy.x) - 250)).toBeLessThan(3);
  expect(Math.abs(Number(copy.y) - 120)).toBeLessThan(3);
});

test('the marquee previews what it will select, and undo keeps the selection an edit started from', async ({ page }) => {
  await seed(page, [rect('a', 'Alpha', -150, 0), rect('b', 'Beta', 150, 0), rect('c', 'Gamma', 0, 300)]);
  const from = await screenOf(page, -260, -80);
  const to = await screenOf(page, 260, 80);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await expect(page.getByTestId('marquee-preview').locator('rect')).toHaveCount(2);
  await page.mouse.up();
  await expect(page.getByTestId('marquee-preview')).toHaveCount(0);
  const selected = page.locator('[role="tree"] [aria-selected="true"]');
  await expect(selected).toHaveCount(2);
  // Group them, then undo: the two layers are selected again.
  await page.keyboard.press('Control+g');
  await expect(page.locator('[role="tree"] [aria-selected="true"]')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(selected).toHaveCount(2);
  await expect(page.locator('[role="tree"] [data-layer-id="a"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[role="tree"] [data-layer-id="b"]')).toHaveAttribute('aria-selected', 'true');
});

test('Shift makes a square the moment it is pressed, without moving the mouse', async ({ page }) => {
  await seed(page);
  await armTool(page, 'Rectangle');
  const from = await screenOf(page, -100, -40);
  const to = await screenOf(page, 100, 40);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  const preview = page.getByTestId('shape-creation-preview');
  const before = (await preview.boundingBox())!;
  expect(before.width / before.height).toBeGreaterThan(2);
  await page.keyboard.down('Shift');
  await expect.poll(async () => {
    const now = (await preview.boundingBox())!;
    return Math.round((now.width / now.height) * 100) / 100;
  }).toBe(1);
  await page.keyboard.up('Shift');
  await expect.poll(async () => ((await preview.boundingBox())!.width / (await preview.boundingBox())!.height) > 2).toBe(true);
  await page.mouse.up();
});

test('Alt on a corner handle scales about the centre', async ({ page }) => {
  await seed(page, [rect('a', 'Alpha', 0, 0)]);
  await page.locator('[role="tree"] [data-layer-id="a"]').click();
  // The rectangle's corners are at (±60, ±30); its origin is its centre.
  const corner = await screenOf(page, 60, 30);
  const target = await screenOf(page, 90, 50);
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.keyboard.down('Alt');
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  const [layer] = await savedLayers(page);
  // The centre stayed; both sides grew (corner 60 → 90 is a 1.5× scale).
  expect(Math.abs(Number(layer.x))).toBeLessThan(1);
  expect(Math.abs(Number(layer.y))).toBeLessThan(1);
  expect(Number(layer.scaleX)).toBeCloseTo(1.5, 1);
  expect(Number(layer.scaleY)).toBeCloseTo(50 / 30, 1);
});
