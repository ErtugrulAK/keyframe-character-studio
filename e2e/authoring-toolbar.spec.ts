import { test, expect, type Page } from '@playwright/test';

/**
 * AUTHORING TOOLBAR — the docked top strip.
 *
 * Everything here is measured in the real browser: the toolbar must drive the
 * SAME authorities the rest of the editor uses (tool/grid context state, the
 * camera command channel, the shared paint write path, the Boolean authoring
 * authority), must never write the document for view-only tools, and its fixed
 * height must keep the authored world exactly where it was.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const DRIFT_TOLERANCE_PX = 1;

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const layer = (id: string, name: string, x: number, y: number) => ({
  id, name, type: 'custom_rect', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218',
  fillEnabled: true, strokeEnabled: false, width: 160, height: 120,
});

async function seed(page: Page): Promise<void> {
  const layers = [layer('alpha', 'Alpha', -120, -60), layer('beta', 'Beta', 140, 90)];
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
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('[data-part-id="alpha"]')).toHaveCount(1);
}

const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Authoring tools' });
const toolbarButton = (page: Page, name: string) => toolbar(page).getByRole('button', { name, exact: true });
const snapshot = async (page: Page): Promise<string> => {
  await page.locator('.autosave-status-badge').click();
  return page.evaluate((key) => localStorage.getItem(key) ?? '', STORAGE_KEY);
};
const partBox = async (page: Page) => {
  const box = await page.locator('[data-part-id="alpha"]').boundingBox();
  expect(box).not.toBeNull();
  return box!;
};
/** Waits until the rendered layer box stops moving. */
async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => new Promise<boolean>((resolve) => {
    const node = document.querySelector('[data-part-id="alpha"]');
    if (!node) { resolve(false); return; }
    let previous = '';
    let stable = 0;
    const sample = () => {
      const rect = node.getBoundingClientRect();
      const key = `${Math.round(rect.left * 100) / 100}|${Math.round(rect.top * 100) / 100}`;
      stable = key === previous ? stable + 1 : 0;
      previous = key;
      if (stable >= 3) resolve(true);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }), undefined, { timeout: 15000 });
}

test('the toolbar is a compact strip that drives the shared tool and grid state', async ({ page }) => {
  await seed(page);

  const bar = toolbar(page);
  await expect(bar).toBeVisible();
  const box = await bar.boundingBox();
  expect(box!.height).toBeLessThanOrEqual(48);

  // One source of truth: the toolbar and the floating viewport toolbar both
  // report the tool the animator context holds.
  await toolbarButton(page, 'Pan').click();
  await expect(toolbarButton(page, 'Pan')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.viewport-tools-overlay').getByRole('button', { name: 'Hand / Pan Tool' }))
    .toHaveAttribute('aria-pressed', 'true');

  await toolbarButton(page, 'Select').click();
  await expect(page.locator('.viewport-tools-overlay').getByRole('button', { name: 'Select Tool' }))
    .toHaveAttribute('aria-pressed', 'true');

  // Grid is the context flag the stage renders from: the grid rects appear and
  // disappear with it, in the toolbar and in the floating viewport toolbar alike.
  const gridRects = page.locator('.stage-svg rect[fill="url(#svg-grid-minor)"]');
  const gridWasVisible = (await gridRects.count()) > 0;
  await toolbarButton(page, 'Toggle grid').click();
  await expect(toolbarButton(page, 'Toggle grid')).toHaveAttribute('aria-pressed', gridWasVisible ? 'false' : 'true');
  await expect(page.locator('.viewport-tools-overlay').getByRole('button', { name: gridWasVisible ? 'Show Grid' : 'Hide Grid' }))
    .toHaveAttribute('aria-pressed', gridWasVisible ? 'false' : 'true');
  await expect(gridRects).toHaveCount(gridWasVisible ? 0 : 1);
  await toolbarButton(page, 'Toggle grid').click();
  await expect(gridRects).toHaveCount(gridWasVisible ? 1 : 0);
});

test('view-only tools never write the document', async ({ page }) => {
  await seed(page);
  const before = await snapshot(page);
  const undoWasDisabled = await page.locator('button[title="Undo"]').isDisabled();

  await toolbarButton(page, 'Pan').click();
  await toolbarButton(page, 'Select').click();
  await toolbarButton(page, 'Toggle grid').click();
  await toolbarButton(page, 'Toggle grid').click();
  await toolbarButton(page, 'Zoom in').click();
  await toolbarButton(page, 'Zoom out').click();
  await toolbarButton(page, 'Reset view').click();

  // Nothing was recorded: the history stays exactly as deep as it was.
  expect(await page.locator('button[title="Undo"]').isDisabled()).toBe(undoWasDisabled);
  expect(await snapshot(page)).toBe(before);
});

test('zoom and reset view move only the camera', async ({ page }) => {
  await seed(page);
  const zoomLabel = page.locator('.zoom-level-text');
  await expect(zoomLabel).toHaveText('100%');

  await toolbarButton(page, 'Zoom in').click();
  await expect(zoomLabel).toHaveText('110%');

  const zoomed = await partBox(page);
  await toolbarButton(page, 'Reset view').click();
  await settle(page);
  await expect(zoomLabel).toHaveText('110%');

  const reset = await partBox(page);
  // Reset re-centres the camera on the stage centre: the world returns to the
  // mount framing, and the zoom the toolbar left behind is preserved.
  expect(Math.abs(reset.x + reset.width / 2 - (zoomed.x + zoomed.width / 2))).toBeGreaterThan(1);
});

test('Fill in the toolbar edits the selected layer through the shared paint path', async ({ page }) => {
  await seed(page);
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  // The Inspector's paint controls live in the collapsed Appearance card.
  await page.getByRole('button', { name: 'Expand APPEARANCE' }).click();

  const fillSwatch = page.getByRole('button', { name: 'Fill Color Preview' });
  await expect(fillSwatch).toBeVisible();
  await fillSwatch.click();
  const dialog = page.getByRole('dialog', { name: 'Fill Color Picker' });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('spinbutton', { name: 'Fill R' }).fill('255');
  await dialog.getByRole('spinbutton', { name: 'Fill G' }).fill('0');
  await dialog.getByRole('spinbutton', { name: 'Fill B' }).fill('0');

  // The Inspector's own swatch reads the same authored value.
  const inspectorSwatch = page.getByRole('button', { name: 'FILL COLOR Color Preview' });
  await expect(inspectorSwatch.locator('.color-swatch-color')).toHaveCSS('background-color', 'rgb(255, 0, 0)');
  expect(await snapshot(page)).toContain('"fillColor":"#ff0000"');
});

test('the Boolean group appears only when it can act and creates through the shared authority', async ({ page }) => {
  await seed(page);

  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await expect(toolbarButton(page, 'Boolean Union')).toHaveCount(0);

  await page.locator('.actor-node', { hasText: 'Beta' }).first().click({ modifiers: ['Control'] });
  await toolbarButton(page, 'Boolean Union').click();

  await expect(page.locator('.boolean-operation-badge')).toHaveCount(1);
  await expect(page.locator('.nested-node.actor-node')).toHaveCount(2);
  // The created group is selected, so the toolbar now switches operations.
  await expect(toolbarButton(page, 'Boolean Union')).toHaveAttribute('aria-pressed', 'true');
  await toolbarButton(page, 'Boolean Subtract').click();
  await expect(toolbarButton(page, 'Boolean Subtract')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.boolean-operation-badge')).toHaveText('Subtract');
});

test('every control is reachable and operable from the keyboard', async ({ page }) => {
  await seed(page);

  await expect(toolbar(page)).toHaveAttribute('aria-label', 'Authoring tools');
  const pan = toolbarButton(page, 'Pan');
  await expect(pan).toHaveAttribute('title', 'Pan tool (H)');
  await pan.focus();
  await expect(pan).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(pan).toHaveAttribute('aria-pressed', 'true');

  const grid = toolbarButton(page, 'Toggle grid');
  const gridWasVisible = (await page.locator('.stage-svg rect[fill="url(#svg-grid-minor)"]').count()) > 0;
  await grid.focus();
  // Enter activates a toolbar button; Space stays the editor's play/pause key.
  await page.keyboard.press('Enter');
  await expect(grid).toHaveAttribute('aria-pressed', gridWasVisible ? 'false' : 'true');

  // Tab keeps moving through the strip instead of trapping focus on one control.
  await page.keyboard.press('Tab');
  await expect(grid).not.toBeFocused();
});

test('toolbar content changes never move the authored world', async ({ page }) => {
  await seed(page);
  await settle(page);
  const baseline = await partBox(page);
  const barHeight = (await toolbar(page).boundingBox())!.height;

  // Selecting two Boolean-eligible layers adds the Boolean group to the strip.
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await page.locator('.actor-node', { hasText: 'Beta' }).first().click({ modifiers: ['Control'] });
  await expect(toolbarButton(page, 'Boolean Union')).toHaveCount(1);
  await settle(page);

  // The strip keeps its height, so the stage box is unchanged.
  expect((await toolbar(page).boundingBox())!.height).toBe(barHeight);
  const withSelection = await partBox(page);
  expect(Math.abs(withSelection.x - baseline.x)).toBeLessThanOrEqual(DRIFT_TOLERANCE_PX);
  expect(Math.abs(withSelection.y - baseline.y)).toBeLessThanOrEqual(DRIFT_TOLERANCE_PX);

  // Mounting/unmounting the strip (edit -> broadcast -> edit) restores the
  // authored world exactly where it was.
  await page.getByText('BROADCAST', { exact: true }).click();
  await expect(toolbar(page)).toHaveCount(0);
  await page.getByText('EDIT MODE', { exact: true }).click();
  await expect(toolbar(page)).toBeVisible();
  await settle(page);

  const restored = await partBox(page);
  expect(Math.abs(restored.x - baseline.x)).toBeLessThanOrEqual(DRIFT_TOLERANCE_PX);
  expect(Math.abs(restored.y - baseline.y)).toBeLessThanOrEqual(DRIFT_TOLERANCE_PX);
});
