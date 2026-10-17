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

async function seed(page: Page, layers = [layer('alpha', 'Alpha', -120, -60), layer('beta', 'Beta', 140, 90)]): Promise<void> {
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
  const __savedBefore1 = await page.locator('.autosave-status-badge').getAttribute('data-last-saved-at');
  await page.locator('.autosave-status-badge').click();
  await expect
    .poll(async () => Number((await page.locator('.autosave-status-badge').getAttribute('data-last-saved-at')) || '0'), { timeout: 10_000 })
    .toBeGreaterThan(Number(__savedBefore1 || '0'));
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

  // The strip is the ONLY toolbar: the redundant floating coordinate-plane
  // toolbar is gone, so there is exactly one place a tool or view control lives.
  await expect(page.locator('.viewport-tools-overlay')).toHaveCount(0);

  // R4-10 / R5-12 — the command bands are announced in one order, and
  // Bind/Unbind is no longer one of the strip's controls (the bond model itself
  // is untouched). The stage-crop feature added the two crop bands between the
  // arrange band and the view band, and the micro-polish round split the centre
  // family out of the align band into its own announced group.
  await expect(bar.getByRole('group')).toHaveCount(12);
  for (const name of [
    'Canvas tools', 'Create', 'Boolean operations', 'Layer group',
    'Align', 'Center', 'Distribute', 'Rotate and flip', 'Arrange', 'Crop', 'Crop to content', 'View controls',
  ]) {
    // `exact` because the `Crop` band's label is a prefix of `Crop to content`.
    await expect(bar.getByRole('group', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Bind selected layers' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Unbind selected layer' })).toHaveCount(0);

  // Every command shares one hitbox and one optical glyph size.
  const hitboxes = await bar.getByRole('button').evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    const glyph = button.querySelector('svg');
    const glyphRect = glyph?.getBoundingClientRect();
    return { w: Math.round(rect.width), h: Math.round(rect.height), gw: Math.round(glyphRect?.width ?? 0), gh: Math.round(glyphRect?.height ?? 0) };
  }));
  expect(new Set(hitboxes.map((box) => `${box.w}x${box.h}`)).size).toBe(1);
  expect(new Set(hitboxes.map((box) => `${box.gw}x${box.gh}`)).size).toBe(1);

  await toolbarButton(page, 'Pan').click();
  await expect(toolbarButton(page, 'Pan')).toHaveAttribute('aria-pressed', 'true');

  await toolbarButton(page, 'Select').click();
  await expect(toolbarButton(page, 'Select')).toHaveAttribute('aria-pressed', 'true');

  // Grid is the context flag the stage renders from: the grid rects appear and
  // disappear with it.
  const gridRects = page.locator('.stage-svg rect[fill="url(#svg-grid-minor)"]');
  const gridWasVisible = (await gridRects.count()) > 0;
  await toolbarButton(page, 'Toggle grid').click();
  await expect(toolbarButton(page, 'Toggle grid')).toHaveAttribute('aria-pressed', gridWasVisible ? 'false' : 'true');
  await expect(gridRects).toHaveCount(gridWasVisible ? 0 : 1);
  await toolbarButton(page, 'Toggle grid').click();
  await expect(gridRects).toHaveCount(gridWasVisible ? 1 : 0);
});

const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

test('the vector bands align, distribute, rotate and flip the selection as one authority', async ({ page }) => {
  await seed(page, [layer('alpha', 'Alpha', -260, 0), layer('beta', 'Beta', -60, 0), layer('gamma', 'Gamma', 260, 0)]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await settle(page);

  /** The rendered layers, in paint order, with their world-space boxes. */
  const boxes = () => page.locator('.stage-svg [data-part-id]').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return {
      id: node.getAttribute('data-part-id'),
      left: Math.round(rect.left * 100) / 100,
      width: Math.round(rect.width * 100) / 100,
      center: Math.round((rect.left + rect.width / 2) * 100) / 100,
    };
  }));

  const row = (name: string) => page.locator('.actor-node', { hasText: name }).first();
  await row('Alpha').click();
  await row('Beta').click({ modifiers: ['Control'] });
  await row('Gamma').click({ modifiers: ['Control'] });
  const before = await boxes();
  expect(new Set(before.map((box) => box.left)).size).toBe(3);

  // Align: the three left edges meet on the collective left edge.
  await toolbarButton(page, 'Align Left').click();
  await settle(page);
  const aligned = await boxes();
  for (const box of aligned) expect(Math.abs(box.left - aligned[0].left)).toBeLessThanOrEqual(1);

  // ONE command, ONE undo entry: the strip's Undo walks it back in one step.
  await page.locator('button[title="Undo"]').click();
  await settle(page);
  expect(await boxes()).toEqual(before);
  await page.locator('button[title="Redo"]').click();
  await settle(page);
  expect(await boxes()).toEqual(aligned);

  // Center Horizontally: every centre lands on the collective vertical centre
  // line (this is centre ALIGNMENT; the gap-spacing command is the separate
  // `Distribute Horizontally` button). The redo above already stacked the left
  // edges; the centres are what this command owns.
  await toolbarButton(page, 'Center Horizontally').click();
  await settle(page);
  const centered = (await boxes()).map((box) => box.center);
  for (const center of centered) {
    expect(Math.abs(center - centered[0]), 'a centre missed the collective centre line').toBeLessThanOrEqual(1);
  }

  // Rotate and flip from the keyboard, on the one selected layer.
  await row('Alpha').click();
  const disclosure = page.getByRole('button', { name: /(?:Expand|Collapse) TRANSFORM/ });
  await expect(disclosure).toBeVisible();
  if (await disclosure.getAttribute('aria-expanded') === 'false') await disclosure.click();
  await expect(page.locator('input[aria-label="Rotation"]')).toHaveValue('0');

  await page.keyboard.press(`${modifier}+Shift+ArrowRight`);
  await expect(page.locator('input[aria-label="Rotation"]')).toHaveValue('90');
  await page.keyboard.press(`${modifier}+Shift+ArrowLeft`);
  await expect(page.locator('input[aria-label="Rotation"]')).toHaveValue('0');

  // The flip is a real document change: the authored scale is mirrored.
  await page.keyboard.press('Shift+H');
  expect(await snapshot(page)).toContain('"scaleX":-1');
  await page.keyboard.press('Shift+V');
  expect(await snapshot(page)).toContain('"scaleY":-1');
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
  const cameraZoom = () => page.locator('.stage-canvas-container').getAttribute('data-camera-zoom');
  await expect.poll(cameraZoom).toBe('1');
  const home = await partBox(page);

  // Zoom changes only the camera scale.
  await toolbarButton(page, 'Zoom in').click();
  await expect.poll(cameraZoom).toBe('1.1');
  await settle(page);
  const zoomed = await partBox(page);
  expect(zoomed.width).toBeGreaterThan(home.width + 1);

  // Pan moves the world with the hand tool.
  const canvas = page.locator('.stage-canvas-container');
  const box = (await canvas.boundingBox())!;
  await toolbarButton(page, 'Pan').click();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 60);
  await page.mouse.up();
  await settle(page);
  const panned = await partBox(page);
  expect(Math.abs(panned.x - zoomed.x)).toBeGreaterThan(1);

  // Reset re-centres the camera while keeping the zoom the toolbar set: the
  // world moves back, and its rendered scale does not change.
  await toolbarButton(page, 'Reset view').click();
  await expect.poll(cameraZoom).toBe('1.1');
  await settle(page);
  const reset = await partBox(page);
  expect(Math.abs(reset.x - panned.x)).toBeGreaterThan(1);
  expect(Math.abs(reset.width - panned.width)).toBeLessThanOrEqual(1);
});

test('fill and stroke are authored in the Inspector, not in the toolbar', async ({ page }) => {
  await seed(page);
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();

  // The strip carries no paint control at all: the Inspector's Appearance
  // section is the one place fill and stroke are authored.
  await expect(toolbar(page).getByRole('button', { name: 'Fill Color Preview' })).toHaveCount(0);
  await expect(toolbar(page).getByRole('button', { name: 'Stroke Color Preview' })).toHaveCount(0);

  // The Inspector's paint controls live in the collapsed Appearance card.
  await page.getByRole('button', { name: 'Expand APPEARANCE' }).click();

  const fillSwatch = page.getByRole('button', { name: 'FILL COLOR Color Preview' });
  await expect(fillSwatch).toBeVisible();
  await fillSwatch.click();
  const dialog = page.getByRole('dialog', { name: 'FILL COLOR Color Picker' });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('spinbutton', { name: 'FILL COLOR R' }).fill('255');
  await dialog.getByRole('spinbutton', { name: 'FILL COLOR G' }).fill('0');
  await dialog.getByRole('spinbutton', { name: 'FILL COLOR B' }).fill('0');

  // The swatch reads the same authored value the document now carries.
  await expect(fillSwatch.locator('.color-swatch-color')).toHaveCSS('background-color', 'rgb(255, 0, 0)');
  expect(await snapshot(page)).toContain('"fillColor":"#ff0000"');
});

test('the Boolean group stays visible and is enabled only for a compatible selection', async ({ page }) => {
  await seed(page);

  // Always on screen, so the action is discoverable before the selection can
  // use it; disabled while one layer cannot form a Boolean.
  await expect(toolbarButton(page, 'Boolean Union')).toBeVisible();
  await expect(toolbarButton(page, 'Boolean Union')).toBeDisabled();
  await expect(toolbarButton(page, 'Dissolve Boolean')).toBeDisabled();

  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await expect(toolbarButton(page, 'Boolean Union')).toBeDisabled();

  // Two compatible operands enable the whole group through the shared authority.
  await page.locator('.actor-node', { hasText: 'Beta' }).first().click({ modifiers: ['Control'] });
  await expect(toolbarButton(page, 'Boolean Union')).toBeEnabled();
  await toolbarButton(page, 'Boolean Union').click();

  await expect(page.locator('.boolean-operation-badge')).toHaveCount(1);
  await expect(page.locator('.nested-node.actor-node')).toHaveCount(2);
  // The created group is selected, so the toolbar now switches operations.
  await expect(toolbarButton(page, 'Boolean Union')).toHaveAttribute('aria-pressed', 'true');
  await expect(toolbarButton(page, 'Dissolve Boolean')).toBeEnabled();
  await toolbarButton(page, 'Boolean Subtract').click();
  await expect(toolbarButton(page, 'Boolean Subtract')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.boolean-operation-badge')).toHaveText('Subtract');
});

test('group and arrange actions stay visible and follow the selection', async ({ page }) => {
  await seed(page);

  // Nothing selected: every state-dependent action is present but unavailable.
  for (const name of ['Group layers', 'Ungroup layers', 'Bring forward', 'Send backward']) {
    await expect(toolbarButton(page, name)).toBeVisible();
    await expect(toolbarButton(page, name)).toBeDisabled();
  }

  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await expect(toolbarButton(page, 'Group layers')).toBeDisabled();
  await expect(toolbarButton(page, 'Bring forward')).toBeEnabled();

  // Arrange writes the existing z-index path, so the painted stacking order
  // follows it: lower z-index paints first.
  const paintOrder = () => page.locator('.stage-svg [data-part-id]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-part-id')));
  const before = await paintOrder();
  expect(before).toEqual(['alpha', 'beta']);

  await toolbarButton(page, 'Bring forward').click();
  await expect.poll(paintOrder).toEqual(['beta', 'alpha']);
  await toolbarButton(page, 'Send backward').click();
  await expect.poll(paintOrder).toEqual(before);

  await page.locator('.actor-node', { hasText: 'Beta' }).first().click({ modifiers: ['Control'] });
  await expect(toolbarButton(page, 'Group layers')).toBeEnabled();
  await toolbarButton(page, 'Group layers').click();
  await expect(toolbarButton(page, 'Ungroup layers')).toBeEnabled();
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

  // Selecting layers enables state-dependent actions, and the strip still keeps
  // its height, so the stage box is unchanged.
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await expect(toolbarButton(page, 'Bring forward')).toBeEnabled();
  await page.locator('.actor-node', { hasText: 'Beta' }).first().click({ modifiers: ['Control'] });
  await expect(toolbarButton(page, 'Boolean Union')).toBeEnabled();
  await expect(toolbarButton(page, 'Group layers')).toBeEnabled();
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
