import { test, expect, type Page } from '@playwright/test';

/**
 * AE-style layout, in a real browser: equal-spacing distribution and smart
 * snapping. jsdom has no layout, so the rendered boxes, the guide lifecycle and
 * the camera-invariant snap feel only exist here.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const layer = (id: string, name: string, x: number, y = 0) => ({
  id, name, type: 'custom_rect', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218',
  fillEnabled: true, strokeEnabled: false, width: 120, height: 60,
});

async function seed(page: Page, layers: Record<string, unknown>[]): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1',
    width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers, tracks: layers.map((entry) => ({ partId: entry.id as string, channels: channel() })),
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: scene },
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

async function selectLayers(page: Page, names: string[]): Promise<void> {
  await page.locator('.actor-node', { hasText: names[0] }).first().click();
  for (const name of names.slice(1)) {
    await page.locator('.actor-node', { hasText: name }).first().click({ modifiers: ['Control'] });
  }
}

const boxOf = async (page: Page, id: string) => {
  const box = await page.locator(`[data-part-id="${id}"]`).first().boundingBox();
  expect(box).not.toBeNull();
  return box!;
};

const runFromMenu = async (page: Page, band: string, item: string) => {
  await page.getByRole('button', { name: band, exact: true }).click();
  await page.getByRole('menuitem', { name: item }).click();
};

/** The horizontal gaps between three boxes, in rendered (screen) pixels. */
async function gapsBetween(page: Page, ids: string[]): Promise<number[]> {
  const boxes = await Promise.all(ids.map((id) => boxOf(page, id)));
  const sorted = boxes.slice().sort((a, b) => a.x - b.x);
  return [sorted[1].x - (sorted[0].x + sorted[0].width), sorted[2].x - (sorted[1].x + sorted[1].width)];
}

/**
 * Screen pixels per world unit, read from the stage's own CTM — the exact
 * conversion the app uses, independent of any selection chrome around a layer.
 */
const pxPerWorld = async (page: Page) => page.evaluate(() => {
  const svg = document.querySelector('svg.stage-svg');
  const matrix = svg?.getScreenCTM?.();
  return matrix ? Math.hypot(matrix.a, matrix.b) : 0;
});

/**
 * Drags `id`'s centre by a WORLD delta, converted through the stage CTM so the
 * test needs no knowledge of the camera scale.
 *
 * The drag state is waited on deterministically after the press: the stage only
 * carries `interaction-dragging` once React has committed the gesture, which is
 * the same commit whose passive effect attaches the window move listener.
 */
async function dragByWorld(page: Page, id: string, worldDx: number, worldDy = 0) {
  const box = await boxOf(page, id);
  const scale = await pxPerWorld(page);
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await expect(page.locator('.stage-canvas-container')).toHaveClass(/interaction-dragging/);
  await page.mouse.move(startX + worldDx * scale, startY + worldDy * scale, { steps: 6 });
}

test('equal-spacing distribution evens edge gaps, holds the span, and is one history entry', async ({ page }) => {
  await seed(page, [layer('a', 'Alpha', 0), layer('b', 'Bravo', 40), layer('c', 'Charlie', 400)]);
  await selectLayers(page, ['Alpha', 'Bravo', 'Charlie']);

  const beforeA = await boxOf(page, 'a');
  const beforeC = await boxOf(page, 'c');

  await runFromMenu(page, 'Distribute', 'Distribute horizontal spacing');

  const gaps = await gapsBetween(page, ['a', 'b', 'c']);
  expect(Math.abs(gaps[0] - gaps[1])).toBeLessThanOrEqual(1);

  // The outer two layers hold the span: their rendered boxes did not move.
  const afterA = await boxOf(page, 'a');
  const afterC = await boxOf(page, 'c');
  expect(Math.abs(afterA.x - beforeA.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterC.x - beforeC.x)).toBeLessThanOrEqual(1);

  // One command = one Undo entry; Redo is exact.
  const distributed = await boxOf(page, 'b');
  await page.keyboard.press('Control+z');
  const restored = await boxOf(page, 'b');
  expect(Math.abs(restored.x - distributed.x)).toBeGreaterThan(1);
  await page.keyboard.press('Control+Shift+z');
  const redone = await boxOf(page, 'b');
  expect(Math.abs(redone.x - distributed.x)).toBeLessThanOrEqual(1);
});

/**
 * Alpha sits far from Bravo on BOTH axes, so only the intended X candidate is
 * ever in range and the guide count is an exact statement.
 */
const SNAP_SEED = () => [layer('a', 'Alpha', -200, -200), layer('b', 'Bravo', 0)];

/**
 * The stage's own snap targets, and the space they live in.
 *
 * The candidate lines and the drawing of the guide must be expressed in ONE
 * space — the project-relative world the layers are authored in — or a stage
 * lock either never fires or draws its line somewhere the geometry is not. The
 * guide's own `x1` says which space it used: the editor camera draws the stage
 * centre at its viewBox centre (300, 240), so a guide on the stage's LEFT edge
 * (world −960) must be drawn at x = −660.
 */
test('locks a layer onto the stage edge, and draws the guide in the geometry’s own space', async ({ page }) => {
  await seed(page, [layer('a', 'Alpha', 0, 200)]);
  await selectLayers(page, ['Alpha']);

  // Aim 3 world units short of the stage's left edge (−960), i.e. the layer's own
  // left edge lands at −957: inside the radius, and no other candidate is near.
  await dragByWorld(page, 'a', -897);
  const guides = page.locator('.snap-guide');
  await expect(guides).toHaveCount(1);
  const line = Number(await guides.first().getAttribute('x1'));
  expect(Math.abs(line - (300 - 960))).toBeLessThanOrEqual(0.5);

  await page.mouse.up();

  // The layer is ON the stage edge: its box starts where the artboard starts.
  const artboard = await page.evaluate(() => {
    const rect = document.querySelector('svg.stage-svg clipPath#artboard-clip rect')!;
    const svg = document.querySelector('svg.stage-svg') as SVGSVGElement;
    const matrix = svg.getScreenCTM()!;
    const point = new DOMPoint(Number(rect.getAttribute('x')), Number(rect.getAttribute('y'))).matrixTransform(matrix);
    return { x: point.x, width: Number(rect.getAttribute('width')) * Math.hypot(matrix.a, matrix.b) };
  });
  const alpha = await boxOf(page, 'a');
  expect(Math.abs(alpha.x - artboard.x)).toBeLessThanOrEqual(1);
});

test('snapping locks the moving layer onto another layer’s edge, with a guide for the gesture', async ({ page }) => {
  await seed(page, SNAP_SEED());
  await selectLayers(page, ['Alpha']);

  // Aim 2 world units short of Bravo's left edge (−60): well inside the radius.
  await dragByWorld(page, 'a', 198);
  await expect(page.locator('.snap-guide')).toHaveCount(1);

  const alpha = await boxOf(page, 'a');
  const bravo = await boxOf(page, 'b');
  expect(Math.abs(alpha.x - bravo.x)).toBeLessThanOrEqual(1);

  // The guide is chrome of the live drag only.
  await page.mouse.up();
  await expect(page.locator('.snap-guide')).toHaveCount(0);

  // Snapping writes the transform, and the whole drag is ONE undo entry.
  const snapped = await boxOf(page, 'a');
  await page.keyboard.press('Control+z');
  const restored = await boxOf(page, 'a');
  expect(Math.abs(restored.x - snapped.x)).toBeGreaterThan(1);
});

test('the snap toggle turns the lock off, and no guide is drawn', async ({ page }) => {
  await seed(page, SNAP_SEED());
  await selectLayers(page, ['Alpha']);

  await page.getByRole('button', { name: 'Toggle snapping' }).click();

  // A 16px miss: with snapping on this would lock; off it stays a free move.
  await dragMissOfScreenPixels(page, 16);
  await expect(page.locator('.snap-guide')).toHaveCount(0);
  const alpha = await boxOf(page, 'a');
  const bravo = await boxOf(page, 'b');
  expect(Math.abs(alpha.x - bravo.x)).toBeGreaterThan(6);
  await page.mouse.up();
});

/**
 * The threshold is a SCREEN radius: a miss of N screen pixels behaves the same
 * at every zoom. Bravo's left edge is the target, so the drag moves Alpha until
 * its left edge is exactly N SCREEN pixels short of Bravo's.
 *
 * Both edges are read from the same rendered frame and the pointer then moves
 * by their own difference, so the miss is that many real screen pixels without
 * converting through the camera scale twice — a scale read before the drag and
 * again inside it can disagree (the stage box is measured asynchronously) and
 * would silently change how far the pointer actually travels.
 */
async function dragMissOfScreenPixels(page: Page, screenPx: number) {
  const alpha = await boxOf(page, 'a');
  const bravo = await boxOf(page, 'b');
  const startX = alpha.x + alpha.width / 2;
  const startY = alpha.y + alpha.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await expect(page.locator('.stage-canvas-container')).toHaveClass(/interaction-dragging/);
  await page.mouse.move(startX + (bravo.x - alpha.x) - screenPx, startY, { steps: 6 });
}

test('the snap threshold is a screen radius at any zoom: a 4px miss locks, a 16px miss does not', async ({ page }) => {
  // The tests of this file that drag a layer rely on the DEFAULT: snapping is
  // armed, and the View band's switch is what turns it off.
  await seed(page, SNAP_SEED());
  await expect(page.getByRole('button', { name: 'Toggle snapping' })).toHaveAttribute('aria-pressed', 'true');

  for (const zoom of ['100%', 'in', 'out']) {
    // A fresh document and a fresh camera per zoom, so the two misses below are
    // measured against exactly the state the zoom keys produced.
    await seed(page, SNAP_SEED());
    await selectLayers(page, ['Alpha']);
    if (zoom === 'in') await page.keyboard.press('=');
    if (zoom === 'out') for (let step = 0; step < 13; step += 1) await page.keyboard.press('-');

    await dragMissOfScreenPixels(page, 4);
    await expect(page.locator('.snap-guide')).toHaveCount(1);
    await page.mouse.up();
    await page.keyboard.press('Control+z');

    await dragMissOfScreenPixels(page, 16);
    await expect(page.locator('.snap-guide')).toHaveCount(0);
    await page.mouse.up();
    await page.keyboard.press('Control+z');
  }
});
