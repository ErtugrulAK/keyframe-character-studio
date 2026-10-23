/**
 * C4 — the layer lock and the mask lock, end to end (behaviour table in
 * reports/.../c4-continuation/08_C4_RESULTS.md).
 *
 * Layer lock: the canvas does not pick a locked layer (clicks reach the layer
 * beneath), the box and Select All leave it out; it can still be selected in the
 * layer list and inspected (disclosure works, edit controls are disabled, an
 * Unlock is offered); every edit path refuses it — Delete, rename, reorder,
 * keyframes, a group with a mixed selection, deleting its parent — with the
 * same explicit message and without changing anything. It keeps animating and
 * rendering. The lock is one undo step and is saved.
 * Mask lock: only that mask's path and path transform are protected.
 */
import { expect, test, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const EMPTY = () => ({ x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [], trimPathStart: [], trimPathEnd: [], trimPathOffset: [] });
const rect = (id: string, name: string, x: number, y: number, width: number, height: number, zIndex: number, extra: Record<string, unknown> = {}) => ({
  id, name, type: 'custom_rect', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex,
  fillColor: '#22d3ee', strokeColor: '#101218', width, height, ...extra,
});

async function open(page: Page, layers: Record<string, unknown>[], tracks?: Record<string, unknown>[]): Promise<void> {
  const scene = {
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers,
    tracks: tracks ?? layers.map((layer) => ({ id: `track-${layer.id}`, partId: layer.id, name: layer.name, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: EMPTY() })),
  };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const tree = (page: Page) => page.locator('[role="tree"][aria-label="Layers"]');
const row = (page: Page, name: string) => tree(page).locator('[role="treeitem"]', { hasText: name }).first();
/** The layer list's lock switch (the timeline row carries the same switch). */
const lockButton = (page: Page, name: string) => tree(page).getByRole('button', { name: new RegExp(`^(Lock|Unlock) ${name}$`) });
const timelineLock = (page: Page, partId: string) => page.locator(`[data-track-row-id][data-track-part-id="${partId}"]`).getByRole('button', { name: /^(Lock|Unlock) / });
/** The refusal toast; with `text`, the one that names that layer (earlier toasts may still be on screen). */
const refusal = (page: Page, text?: string) => page.getByRole('alert').filter({ hasText: text ?? /is locked|are locked/ }).first();
const centreOf = async (page: Page, id: string) => {
  const box = await page.locator(`.stage-svg g[data-part-id="${id}"]`).first().boundingBox();
  if (!box) throw new Error(`no ${id}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const layerCount = (page: Page) => tree(page).locator('[role="treeitem"][data-layer-id]').count();
const layerOrder = (page: Page) => tree(page).locator('[data-layer-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-layer-id')));

async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

const threeLayers = [rect('back', 'Back', 0, 0, 600, 400, 1), rect('top', 'Top', 0, 0, 200, 140, 2), rect('side', 'Side', 420, 0, 120, 120, 3)];

test('a locked layer is not picked on the canvas: clicks reach the layer beneath; box and Select All leave it out', async ({ page }) => {
  await open(page, threeLayers);
  await lockButton(page, 'Top').click();
  await expect(lockButton(page, 'Top')).toHaveAttribute('aria-pressed', 'true');
  await expect(timelineLock(page, 'top')).toHaveAttribute('aria-pressed', 'true'); // the timeline switch shows the same state

  const top = await centreOf(page, 'top');
  await page.mouse.click(top.x, top.y);
  await expect(row(page, 'Back')).toHaveAttribute('aria-selected', 'true');
  await expect(row(page, 'Top')).toHaveAttribute('aria-selected', 'false');

  await page.keyboard.press('Control+a');
  await expect(row(page, 'Back')).toHaveAttribute('aria-selected', 'true');
  await expect(row(page, 'Side')).toHaveAttribute('aria-selected', 'true');
  await expect(row(page, 'Top')).toHaveAttribute('aria-selected', 'false');
});

test('a locked layer is inspected, not edited — from the Inspector, the keyboard, the tree and the timeline', async ({ page }) => {
  await open(page, threeLayers);
  await lockButton(page, 'Top').click();
  await row(page, 'Top').click();
  await expect(row(page, 'Top')).toHaveAttribute('aria-selected', 'true');

  // Inspector: banner, values shown, edit controls disabled, disclosure still works.
  await expect(page.getByTestId('details-lock-banner')).toContainText('This layer is locked');
  await expect(page.locator('button[title="A locked layer cannot be deleted"]')).toBeDisabled();
  // Opening a card is inspection: it works on a locked layer.
  await page.locator('.details-body').getByRole('button', { name: 'Expand TRANSFORM' }).click();
  await expect(page.locator('.details-body').getByRole('button', { name: 'Collapse TRANSFORM' })).toBeEnabled();
  const positionX = page.getByLabel('Position X').first();
  await expect(positionX).toBeDisabled();
  await expect(positionX).toHaveValue('0');

  // Keyboard Delete on the selection: refused, nothing removed.
  await row(page, 'Top').focus();
  const before = await layerCount(page);
  await page.keyboard.press('Delete');
  await expect(refusal(page, '“Top” is locked')).toBeVisible();
  expect(await layerCount(page)).toBe(before);

  // Rename (F2) and reorder (Alt+↑) from the tree: refused, unchanged.
  // (by id: while the name field is open the row shows no name text)
  const topRow = tree(page).locator('[data-layer-id="top"]');
  await topRow.focus();
  await page.keyboard.press('F2');
  const rename = topRow.locator('input');
  await expect(rename).toBeFocused();
  await rename.fill('Changed');
  await page.keyboard.press('Enter');
  await expect(rename).toHaveCount(0);
  await expect(row(page, 'Top')).toContainText('Top');
  await expect(tree(page).locator('[role="treeitem"]', { hasText: 'Changed' })).toHaveCount(0);
  const order = await layerOrder(page);
  await row(page, 'Top').focus();
  await page.keyboard.press('Alt+ArrowUp');
  expect(await layerOrder(page)).toEqual(order);

  // Timeline: the layer's keyframe button writes nothing.
  const lane = page.locator('.ue-lane-group[data-owner-part-id="top"]');
  const keysBefore = await lane.locator('[data-keyframe-id]').count();
  await page.locator('[data-track-row-id][data-track-part-id="top"] .track-add-kf-btn').click();
  await expect(refusal(page)).toBeVisible();
  expect(await lane.locator('[data-keyframe-id]').count()).toBe(keysBefore);

  // Unlock from the banner: editing works again.
  await page.getByTestId('details-lock-banner').getByRole('button', { name: 'Unlock' }).click();
  await expect(positionX).toBeEnabled();
  await positionX.fill('50');
  await positionX.press('Enter');
  await expect(positionX).toHaveValue(/^50/);
});

test('a mixed selection is refused as a whole; deleting the parent of a locked child is refused', async ({ page }) => {
  await open(page, [rect('parent', 'Parent', 0, 0, 300, 200, 1), rect('child', 'Child', 40, 20, 80, 60, 2, { parentId: 'parent' }), rect('free', 'Free', 400, 0, 100, 100, 3), rect('held', 'Held', -400, 0, 100, 100, 4)]);
  await lockButton(page, 'Child').click();
  await lockButton(page, 'Held').click();

  // Group of a locked + an unlocked top-level layer: nothing is grouped.
  await row(page, 'Held').click();
  await row(page, 'Free').click({ modifiers: ['Control'] });
  const before = await layerCount(page);
  await page.keyboard.press('Control+g');
  await expect(refusal(page, '“Held” is locked')).toBeVisible();
  expect(await layerCount(page)).toBe(before);

  // Deleting the unlocked parent would rewrite the locked child: refused.
  await row(page, 'Parent').click();
  await page.locator('button[title="Delete Actor Instance"]').click();
  await expect(refusal(page, '“Child” is locked')).toBeVisible();
  await expect(row(page, 'Parent')).toBeVisible();
  await expect(row(page, 'Child')).toBeVisible();
});

test('a locked layer keeps animating and rendering: scrub and playback move it', async ({ page }) => {
  const layers = [rect('mover', 'Mover', -300, 0, 120, 120, 1)];
  await open(page, layers, [{ id: 'track-mover', partId: 'mover', name: 'Mover', color: '#22d3ee', visible: true, locked: true, expanded: false,
    channels: { ...EMPTY(), x: [{ id: 'k0', frame: 0, value: -300, easing: 'linear' }, { id: 'k1', frame: 30, value: 300, easing: 'linear' }] } }]);
  await expect(lockButton(page, 'Mover')).toHaveAttribute('aria-pressed', 'true');
  const start = await centreOf(page, 'mover');
  const ruler = page.getByRole('slider', { name: 'Playhead position' });
  await ruler.focus();
  for (let index = 0; index < 30; index += 1) await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await centreOf(page, 'mover')).x).toBeGreaterThan(start.x + 50);
  // Its keyframes stay on the timeline, and playback moves it the same way.
  await expect(page.locator('.ue-lane-group[data-owner-part-id="mover"] [data-keyframe-id]').first()).toBeVisible();
  await ruler.focus();
  await page.keyboard.press('Home');
  await expect.poll(async () => Math.abs((await centreOf(page, 'mover')).x - start.x)).toBeLessThan(1);
  await page.getByTitle('Play', { exact: true }).click();
  await expect.poll(async () => (await centreOf(page, 'mover')).x, { timeout: 5000 }).toBeGreaterThan(start.x + 50);
});

test('the lock is one undo step, has keyboard commands, and is saved', async ({ page }) => {
  await open(page, threeLayers);
  await row(page, 'Top').click();
  await page.keyboard.press('Control+l');
  await expect(lockButton(page, 'Top')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Control+z');
  await expect(lockButton(page, 'Top')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Control+y');
  await expect(lockButton(page, 'Top')).toHaveAttribute('aria-pressed', 'true');

  const saved = await savedScene(page);
  expect(saved.tracks.find((track: { partId: string }) => track.partId === 'top').locked).toBe(true);
  await page.reload();
  await expect(lockButton(page, 'Top')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('.stage-canvas-container').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+Shift+l');
  await expect(lockButton(page, 'Top')).toHaveAttribute('aria-pressed', 'false');
});

test('a mask lock protects only that mask path and its transform', async ({ page }) => {
  const IMAGE = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#3b82f6"/></svg>').toString('base64')}`;
  const path = { version: 1, coordinateSpace: 'normalized', closed: true, points: [{ id: 'a', x: 0.1, y: 0.1 }, { id: 'b', x: 0.9, y: 0.1 }, { id: 'c', x: 0.9, y: 0.9 }, { id: 'd', x: 0.1, y: 0.9 }] };
  await open(page, [{ id: 'img', name: 'Photo', type: 'custom_image', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#fff', strokeColor: '#000', width: 600, height: 400, imageUrl: IMAGE,
    masks: [{ id: 'm1', name: 'Window', mode: 'add', enabled: true, path }] }]);
  await row(page, 'Photo').click();
  await openDetailsTab(page, 'Masks');
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
  const lock = page.getByRole('checkbox', { name: /Lock path/ });
  await lock.check();
  const editOnCanvas = page.getByRole('button', { name: 'Edit on Canvas' });
  await expect(editOnCanvas).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Rotate mask path 15 degrees clockwise' })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'Closed path' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reverse direction' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '1. Window (locked)' })).toBeVisible();
  // The rest of the mask is not locked.
  const mode = page.locator('.matte-compact-field select').first();
  await mode.selectOption('subtract');
  await expect(mode).toHaveValue('subtract');
  // And the layer itself is not locked.
  await openDetailsTab(page, 'Properties');
  await page.locator('.details-body').getByRole('button', { name: 'Expand TRANSFORM' }).click();
  await expect(page.getByLabel('Position X').first()).toBeEnabled();
  const saved = await savedScene(page);
  expect(saved.layers.find((layer: { id: string }) => layer.id === 'img').masks[0]).toMatchObject({ locked: true, mode: 'subtract', path: { closed: true } });
  await openDetailsTab(page, 'Masks');
  await lock.uncheck();
  await expect(editOnCanvas).toBeEnabled();
});
