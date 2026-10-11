import { test, expect, type Page } from '@playwright/test';

/**
 * EDITOR CONTEXT MENU — stage and outliner right-click.
 *
 * The menu must operate on the live selection through the editor's existing
 * actions, offer nothing that is not supported (no Inspect, no Group/Ungroup),
 * stay inside the viewport, and keep the browser's native menu away from the
 * owned editor surface.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

declare global {
  interface Window {
    /** Records whether the editor suppressed the native context menu per right-click. */
    __nativeMenuSuppressed?: boolean[];
  }
}

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const layer = (id: string, name: string, x: number, y: number, zIndex: number) => ({
  id, name, type: 'custom_rect', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex, fillColor: '#22d3ee', strokeColor: '#101218',
  fillEnabled: true, strokeEnabled: false, width: 160, height: 120,
});

async function seed(page: Page): Promise<void> {
  const layers = [layer('alpha', 'Alpha', -120, -60, 3), layer('beta', 'Beta', 140, 90, 2), layer('gamma', 'Gamma', 0, 190, 1)];
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1',
    width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers, tracks: layers.map((entry) => ({ partId: entry.id, channels: channel() })),
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: scene },
  );
  // Records whether the owned editor surface suppressed the native menu.
  await page.addInitScript(() => {
    window.__nativeMenuSuppressed = [];
    window.addEventListener('contextmenu', (event) => {
      const target = event.target as Element | null;
      if (target?.closest?.('.stage-canvas-container') || target?.closest?.('.outliner-container')) {
        window.__nativeMenuSuppressed?.push(event.defaultPrevented);
      }
    });
  });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('[data-part-id="alpha"]')).toHaveCount(1);
}

const menu = (page: Page) => page.getByRole('menu', { name: 'Editor actions' });
const menuItem = (page: Page, name: string) => menu(page).getByRole('menuitem', { name, exact: false });
const rightClickLayer = (page: Page, id: string) => page.locator(`[data-part-id="${id}"]`).click({ button: 'right' });
const rightClickEmptyStage = (page: Page) => page.locator('.stage-canvas-container').click({ button: 'right', position: { x: 24, y: 24 } });
const layerCount = (page: Page) => page.locator('.outliner-container .actor-node').count();

test('object right-click selects the layer and shows only supported actions', async ({ page }) => {
  await seed(page);
  await rightClickLayer(page, 'beta');

  await expect(menu(page)).toBeVisible();
  await expect(page.locator('.actor-node.primary-selected', { hasText: 'Beta' })).toBeVisible();

  for (const label of ['Cut', 'Copy', 'Paste', 'Duplicate', 'Delete', 'Select All', 'Bring Forward', 'Send Backward', 'Bring to Front', 'Send to Back']) {
    await expect(menuItem(page, label)).toHaveCount(1);
  }
  await expect(page.getByRole('menuitem', { name: 'Inspect' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Group', exact: true })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Ungroup', exact: true })).toHaveCount(0);

  const suppressed = await page.evaluate(() => window.__nativeMenuSuppressed ?? []);
  expect(suppressed.length).toBeGreaterThan(0);
  expect(suppressed.every(Boolean)).toBe(true);
});

test('Delete and Duplicate run the editor actions on the current selection', async ({ page }) => {
  await seed(page);
  const before = await layerCount(page);

  await rightClickLayer(page, 'gamma');
  await menuItem(page, 'Duplicate').click();
  await expect(page.locator('.actor-node', { hasText: 'Gamma Copy' })).toHaveCount(1);
  expect(await layerCount(page)).toBe(before + 1);

  await rightClickLayer(page, 'alpha');
  await menuItem(page, 'Delete').click();
  await expect(page.locator('[data-part-id="alpha"]')).toHaveCount(0);
  await expect(page.locator('.actor-node', { hasText: 'Alpha' })).toHaveCount(0);
});

test('Copy and Paste travel through the editor clipboard', async ({ page }) => {
  await seed(page);
  const before = await layerCount(page);

  await rightClickLayer(page, 'alpha');
  await menuItem(page, 'Copy').click();
  await expect(menu(page)).toHaveCount(0);

  await rightClickEmptyStage(page);
  await expect(menuItem(page, 'Paste')).toBeEnabled();
  await menuItem(page, 'Paste').click();

  await expect(page.locator('.actor-node', { hasText: 'Alpha Copy' })).toHaveCount(1);
  expect(await layerCount(page)).toBe(before + 1);
});

test('the empty-stage menu offers only what can run there', async ({ page }) => {
  await seed(page);
  await rightClickEmptyStage(page);

  await expect(menuItem(page, 'Select All')).toHaveCount(1);
  await expect(page.getByRole('menuitem', { name: 'Paste' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toHaveCount(0);

  await menuItem(page, 'Select All').click();
  await expect(page.locator('.actor-node.selected')).toHaveCount(3);
});

test('a right-click keeps a multi-selection and acts on all of it', async ({ page }) => {
  await seed(page);
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await page.locator('.actor-node', { hasText: 'Beta' }).first().click({ modifiers: ['Control'] });
  const before = await layerCount(page);

  await rightClickLayer(page, 'alpha');
  await expect(page.getByRole('menuitem', { name: 'Cut' })).toHaveCount(0);
  await expect(menuItem(page, 'Bring Forward')).toBeDisabled();

  await menuItem(page, 'Delete').click();
  expect(await layerCount(page)).toBe(before - 2);
});

test('the menu stays inside the viewport at the stage edge', async ({ page }) => {
  await seed(page);
  const stage = await page.locator('.stage-canvas-container').boundingBox();
  const viewport = page.viewportSize()!;

  await page.mouse.click(stage!.x + stage!.width - 4, stage!.y + stage!.height - 4, { button: 'right' });
  await expect(menu(page)).toBeVisible();

  const box = (await menu(page).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
});

test('Escape closes the menu and the keyboard opens it for the selection', async ({ page }) => {
  await seed(page);
  await rightClickLayer(page, 'alpha');
  await expect(menu(page)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);

  await page.locator('.actor-node', { hasText: 'Beta' }).first().click();
  await page.keyboard.press('Shift+F10');
  await expect(menu(page)).toBeVisible();
  await expect(menuItem(page, 'Delete')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
});

test('a layer right-click in the outliner opens the same menu', async ({ page }) => {
  await seed(page);
  await page.locator('.actor-node', { hasText: 'Beta' }).first().click({ button: 'right' });

  await expect(menu(page)).toBeVisible();
  await expect(page.locator('.actor-node.primary-selected', { hasText: 'Beta' })).toBeVisible();
  await expect(menuItem(page, 'Delete')).toHaveCount(1);
});
