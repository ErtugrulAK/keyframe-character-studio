/**
 * C4 — Track Matte pick-whip: drag from the target's Track Matte card to a
 * layer (layer list, timeline row or canvas). The candidate is marked valid or
 * refused with the reason while dragging; a valid drop writes
 * `target.trackMatte` once (one undo step) without touching the source's
 * visibility or stack position; Escape, an empty area, the layer itself or a
 * loop write nothing. Enter on the handle goes to the source list.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const EMPTY = () => ({ x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [], trimPathStart: [], trimPathEnd: [], trimPathOffset: [] });
const rect = (id: string, name: string, x: number, zIndex: number, extra: Record<string, unknown> = {}) => ({
  id, name, type: 'custom_rect', x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex,
  fillColor: '#22d3ee', strokeColor: '#101218', width: 160, height: 120, ...extra,
});

async function open(page: Page): Promise<void> {
  const layers = [
    rect('target', 'Target', -300, 1),
    rect('circle', 'Circle', 0, 2),
    rect('other', 'Other', 300, 3, { trackMatte: { sourceLayerId: 'target', mode: 'alpha', enabled: true, sourceVisible: true } }),
  ];
  const scene = { version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers,
    tracks: layers.map((layer) => ({ id: `track-${layer.id}`, partId: layer.id, name: layer.name, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: EMPTY() })) };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('[role="tree"] [data-layer-id="target"]').click();
  await page.getByRole('button', { name: 'Expand TRACK MATTE' }).click();
}

async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

const handle = (page: Page) => page.getByRole('button', { name: /^Pick the track matte source/ });
const source = (page: Page) => page.getByRole('combobox', { name: 'Track matte source', exact: true });
const centre = async (page: Page, selector: string) => {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(selector);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

async function dragFromHandle(page: Page, to: { x: number; y: number }) {
  // C5 — the Track Matte summary now sits right above this card, so after a
  // pick the handle can be pushed to the edge of the Details scroll area.
  await page.locator('.track-matte-pick-whip').scrollIntoViewIfNeeded();
  const from = await centre(page, '.track-matte-pick-whip');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
}

test('drag to a layer row: marked valid while dragging, one write on release, one Undo, source untouched', async ({ page }) => {
  await open(page);
  await expect(source(page)).toHaveValue('');
  const order = await page.locator('[role="tree"] [data-layer-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-layer-id')));

  await dragFromHandle(page, await centre(page, '[role="tree"] [data-layer-id="circle"]'));
  await expect(page.getByTestId('track-matte-pick-label')).toHaveText('Use “Circle” as the matte');
  await expect(page.locator('[role="tree"] [data-layer-id="circle"]')).toHaveAttribute('data-pick-whip', 'valid');
  await page.mouse.up();
  await expect(page.getByTestId('track-matte-pick-label')).toHaveCount(0);
  await expect(page.locator('[data-pick-whip]')).toHaveCount(0);
  await expect(source(page)).toHaveValue('circle');

  const saved = await savedScene(page);
  const target = saved.layers.find((layer: { id: string }) => layer.id === 'target');
  expect(target.trackMatte).toMatchObject({ sourceLayerId: 'circle', mode: 'alpha', enabled: true, sourceVisible: true });
  expect(saved.layers.find((layer: { id: string }) => layer.id === 'circle').visible).toBe(true);
  expect(await page.locator('[role="tree"] [data-layer-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-layer-id')))).toEqual(order);
  // The existing navigation works with the picked relationship.
  await expect(page.getByRole('button', { name: 'Select Source' })).toBeVisible();

  await page.locator('.stage-canvas-container').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+z');
  await page.locator('[role="tree"] [data-layer-id="target"]').click();
  await expect(source(page)).toHaveValue('');
});

test('refused candidates (itself, a loop) show the reason and write nothing; Escape and an empty area write nothing', async ({ page }) => {
  await open(page);
  const before = JSON.stringify((await savedScene(page)).layers);

  await dragFromHandle(page, await centre(page, '[role="tree"] [data-layer-id="other"]'));
  await expect(page.getByTestId('track-matte-pick-label')).toContainText('loop');
  await expect(page.locator('[role="tree"] [data-layer-id="other"]')).toHaveAttribute('data-pick-whip', 'invalid');
  await page.mouse.up();
  await expect(page.getByText(/that would be a loop/).first()).toBeVisible();

  await dragFromHandle(page, await centre(page, '[role="tree"] [data-layer-id="target"]'));
  await expect(page.getByTestId('track-matte-pick-label')).toHaveText('A layer cannot be its own matte.');
  await page.mouse.up();

  await dragFromHandle(page, await centre(page, '[role="tree"] [data-layer-id="circle"]'));
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('track-matte-pick-label')).toHaveCount(0);
  await page.mouse.up();

  await dragFromHandle(page, await centre(page, '.header-bar, header'));
  await page.mouse.up();

  await expect(source(page)).toHaveValue('');
  expect(JSON.stringify((await savedScene(page)).layers)).toBe(before);
});

test('the timeline row and the canvas layer are pick targets too; Enter on the handle goes to the source list', async ({ page }) => {
  await open(page);
  await dragFromHandle(page, await centre(page, '[data-track-row-id][data-track-part-id="circle"] .ue-track-row'));
  await expect(page.getByTestId('track-matte-pick-label')).toHaveText('Use “Circle” as the matte');
  await page.mouse.up();
  await expect(source(page)).toHaveValue('circle');

  await dragFromHandle(page, await centre(page, '.stage-svg g[data-part-id="circle"]'));
  await expect(page.getByTestId('track-matte-pick-label')).toHaveText('“Circle” is already the matte of this layer.');
  await page.mouse.up();

  await handle(page).focus();
  await page.keyboard.press('Enter');
  await expect(source(page)).toBeFocused();
});
