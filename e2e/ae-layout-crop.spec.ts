import { test, expect, type Page } from '@playwright/test';

/**
 * Stage crop / region of interest, in a real browser.
 *
 * jsdom has no layout and no camera, so the region the pointer draws, the
 * handles it resizes with, the placement the crop preserves and the artboard the
 * document ends up with only exist here. Everything is expressed in STAGE units
 * and converted through the stage's own CTM, so the test carries no assumption
 * about the camera scale.
 *
 * The regions below stay inside the visible part of the stage at the default zoom
 * (measured: stage x 461…1459, y 300…780 for a 1920×1080 document in the editor's
 * stage panel), so every pointer gesture the test makes lands on the stage.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const STAGE = { width: 1920, height: 1080 };
/** The editor camera draws the stage centred here (its own viewBox is 600×480). */
const CAMERA_CENTER = { x: 300, y: 240 };
/** The region drawn in the tests: {760,380,600,360} in stage units. */
const REGION = { from: { x: 760, y: 380 }, to: { x: 1360, y: 740 } };

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const layer = (id: string, name: string, x: number, y: number) => ({
  id, name, type: 'custom_rect', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218',
  fillEnabled: true, strokeEnabled: false, width: 120, height: 60,
});

async function seed(page: Page, layers: Record<string, unknown>[]): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1',
    ...STAGE, fps: 30, totalFrames: 60,
    layers, tracks: layers.map((entry) => ({ partId: entry.id as string, channels: channel(), editVisible: true })),
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

/**
 * C4 — the 1280×720 stage opens taller (compact header, shorter opening
 * timeline), so the camera frames its 600×480 view larger and layers placed
 * beyond it (±400–500 units in the tests that call this) would sit off the
 * stage. Two zoom-out steps keep them on it; the assertions read the live scale.
 */
async function keepWideLayoutOnStage(page: Page): Promise<void> {
  const zoomBefore = await page.locator('.stage-canvas-container').getAttribute('data-camera-zoom');
  for (let step = 0; step < 2; step += 1) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('canvas-viewport-command', { detail: { type: 'zoom-out' } })));
  }
  await expect(page.locator('.stage-canvas-container')).not.toHaveAttribute('data-camera-zoom', zoomBefore ?? '');
}

/** Stage units → screen pixels, through the stage's own CTM. */
async function stageToScreen(page: Page, x: number, y: number) {
  return page.evaluate(({ x, y, camera, stage }) => {
    const svg = document.querySelector('svg.stage-svg');
    const matrix = svg?.getScreenCTM?.();
    if (!svg || !matrix) throw new Error('stage svg is not measurable');
    const point = new DOMPoint(
      camera.x - stage.width / 2 + x,
      camera.y - stage.height / 2 + y,
    ).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  }, { x, y, camera: CAMERA_CENTER, stage: STAGE });
}

const pxPerWorld = async (page: Page) => page.evaluate(() => {
  const matrix = document.querySelector('svg.stage-svg')?.getScreenCTM?.();
  return matrix ? Math.hypot(matrix.a, matrix.b) : 0;
});

/** The artboard the document currently draws: its size and its screen origin. */
const artboard = async (page: Page) => page.evaluate(() => {
  const rect = document.querySelector('svg.stage-svg clipPath#artboard-clip rect');
  const svg = document.querySelector('svg.stage-svg');
  if (!rect || !svg) throw new Error('artboard is not measurable');
  const matrix = svg.getScreenCTM();
  if (!matrix) throw new Error('stage svg has no CTM');
  const origin = new DOMPoint(Number(rect.getAttribute('x')), Number(rect.getAttribute('y'))).matrixTransform(matrix);
  return {
    width: Number(rect.getAttribute('width')),
    height: Number(rect.getAttribute('height')),
    originX: origin.x,
    originY: origin.y,
  };
});

const boxOf = async (page: Page, id: string) => {
  const box = await page.locator(`[data-part-id="${id}"]`).first().boundingBox();
  expect(box).not.toBeNull();
  return box!;
};

/** Drags on the stage between two STAGE-space points. */
async function dragOnStage(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const start = await stageToScreen(page, from.x, from.y);
  const end = await stageToScreen(page, to.x, to.y);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await expect(page.locator('.stage-canvas-container')).toHaveClass(/interaction-dragging/);
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

const regionSize = async (page: Page) => ({
  width: Number(await page.locator('.stage-crop-region').getAttribute('width')),
  height: Number(await page.locator('.stage-crop-region').getAttribute('height')),
});

const armCropMode = async (page: Page) => {
  await page.getByRole('button', { name: 'Crop / region of interest' }).click();
  await expect(page.getByRole('button', { name: 'Crop / region of interest' })).toHaveAttribute('aria-pressed', 'true');
};

test('draws a region, resizes it with a handle, applies it and keeps the world where it was', async ({ page }) => {
  await seed(page, [layer('a', 'Alpha', 150, -100), layer('b', 'Bravo', -250, 150)]);
  await keepWideLayoutOnStage(page);
  await armCropMode(page);

  // Arming the mode writes nothing, and there is nothing to apply yet.
  expect((await artboard(page)).width).toBe(STAGE.width);
  await expect(page.locator('.stage-crop-region')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apply crop' })).toBeDisabled();

  await dragOnStage(page, REGION.from, REGION.to);
  await expect(page.locator('.stage-crop-region')).toHaveCount(1);
  // The pointer moves in whole SCREEN pixels, which are ~1.7 stage units at this
  // zoom, so a hand-drawn region is exact to a couple of units — and the applied
  // stage is whatever the region actually was, which the assertions below read.
  expect(Math.abs((await regionSize(page)).width - 600)).toBeLessThanOrEqual(2);
  expect(Math.abs((await regionSize(page)).height - 360)).toBeLessThanOrEqual(2);
  await expect(page.locator('.stage-crop-handle')).toHaveCount(8);

  // A handle resizes ONE edge; the opposite edge stays exactly where it was.
  const beforeResize = await stageToScreen(page, REGION.from.x, REGION.from.y);
  const eastHandle = await stageToScreen(page, REGION.to.x, 560);
  const widened = await stageToScreen(page, 1400, 560);
  await page.mouse.move(eastHandle.x, eastHandle.y);
  await page.mouse.down();
  await page.mouse.move(widened.x, widened.y, { steps: 5 });
  await page.mouse.up();
  expect(Math.abs((await regionSize(page)).width - 640)).toBeLessThanOrEqual(3);
  expect(Math.abs((await regionSize(page)).height - 360)).toBeLessThanOrEqual(2);
  const afterResize = await stageToScreen(page, REGION.from.x, REGION.from.y);
  expect(Math.abs(afterResize.x - beforeResize.x)).toBeLessThanOrEqual(1);

  // Still nothing written by drawing or resizing.
  expect((await artboard(page)).width).toBe(STAGE.width);

  // Apply: the stage becomes the region, and every layer keeps its pixel measured
  // from the new frame origin.
  const scale = await pxPerWorld(page);
  /** A layer's position in STAGE units, read from the artboard it is drawn against. */
  const stagePosition = (box: { x: number; y: number; width: number; height: number }, board: { originX: number; originY: number }) => ({
    x: (box.x + box.width / 2 - board.originX) / scale,
    y: (box.y + box.height / 2 - board.originY) / scale,
  });
  const before = await artboard(page);
  const alphaBefore = await boxOf(page, 'a');
  const bravoBefore = await boxOf(page, 'b');
  const alphaStageBefore = stagePosition(alphaBefore, before);
  const bravoStageBefore = stagePosition(bravoBefore, before);
  await page.getByRole('button', { name: 'Apply crop' }).click();

  const after = await artboard(page);
  expect(Math.abs(after.width - 640)).toBeLessThanOrEqual(3);
  expect(Math.abs(after.height - 360)).toBeLessThanOrEqual(2);
  const alphaAfter = await boxOf(page, 'a');
  const bravoAfter = await boxOf(page, 'b');
  const alphaStageAfter = stagePosition(alphaAfter, after);
  const bravoStageAfter = stagePosition(bravoAfter, after);

  // The world kept its place relative to the new origin: every layer moved by the
  // region's top-left and nothing else...
  expect(Math.abs(alphaStageAfter.x - (alphaStageBefore.x - REGION.from.x))).toBeLessThanOrEqual(3);
  expect(Math.abs(alphaStageAfter.y - (alphaStageBefore.y - REGION.from.y))).toBeLessThanOrEqual(3);
  // ...so the geometry BETWEEN the layers is preserved exactly, which a crop of
  // any region must never change.
  expect(Math.abs((alphaStageAfter.x - bravoStageAfter.x) - (alphaStageBefore.x - bravoStageBefore.x))).toBeLessThanOrEqual(1.5);
  expect(Math.abs((alphaStageAfter.y - bravoStageAfter.y) - (alphaStageBefore.y - bravoStageBefore.y))).toBeLessThanOrEqual(1.5);
  // No hidden clipping: the layer that sat inside the region is inside the frame.
  expect(alphaStageAfter.x).toBeGreaterThanOrEqual(-1);
  expect(alphaStageAfter.x).toBeLessThanOrEqual(after.width + 1);
  expect(alphaStageAfter.y).toBeGreaterThanOrEqual(-1);
  expect(alphaStageAfter.y).toBeLessThanOrEqual(after.height + 1);

  // The region is gone once it has been applied.
  await expect(page.locator('.stage-crop-region')).toHaveCount(0);

  // ONE undo restores the previous stage AND the previous placement.
  await page.keyboard.press('Control+z');
  const undone = await artboard(page);
  expect({ width: undone.width, height: undone.height }).toEqual({ width: STAGE.width, height: STAGE.height });
  const alphaUndone = await boxOf(page, 'a');
  expect(Math.abs(alphaUndone.x - alphaBefore.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(alphaUndone.y - alphaBefore.y)).toBeLessThanOrEqual(1);

  // Redo is exact.
  await page.keyboard.press('Control+Shift+z');
  const redone = await artboard(page);
  expect({ width: redone.width, height: redone.height }).toEqual({ width: after.width, height: after.height });
  const alphaRedone = await boxOf(page, 'a');
  expect(Math.abs(alphaRedone.x - alphaAfter.x)).toBeLessThanOrEqual(1);
});

test('moves the region, and Escape drops it without cropping the stage', async ({ page }) => {
  await seed(page, [layer('a', 'Alpha', 150, -100)]);
  await armCropMode(page);
  await dragOnStage(page, REGION.from, REGION.to);
  const drawn = await regionSize(page);
  expect(Math.abs(drawn.width - 600)).toBeLessThanOrEqual(2);
  expect(Math.abs(drawn.height - 360)).toBeLessThanOrEqual(2);

  // Dragging INSIDE the region moves it; its size is untouched and so is the stage.
  const inside = await stageToScreen(page, 1000, 550);
  const insideTarget = await stageToScreen(page, 940, 510);
  await page.mouse.move(inside.x, inside.y);
  await page.mouse.down();
  await page.mouse.move(insideTarget.x, insideTarget.y, { steps: 5 });
  await page.mouse.up();
  expect(await regionSize(page)).toEqual(drawn);
  const moved = await page.locator('.stage-crop-region').boundingBox();
  const expected = await stageToScreen(page, REGION.from.x - 60, REGION.from.y - 40);
  // The region snaps to whole stage units and is drawn with a 2px stroke, so a
  // moved region is exact to about a pixel plus the pointer's own granularity.
  expect(Math.abs(moved!.x - expected.x)).toBeLessThanOrEqual(1 + 2 * (await pxPerWorld(page)));
  expect((await artboard(page)).width).toBe(STAGE.width);

  // Escape drops the region first, then leaves the mode. Neither crops.
  await page.keyboard.press('Escape');
  await expect(page.locator('.stage-crop-region')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Crop / region of interest' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Crop / region of interest' })).toHaveAttribute('aria-pressed', 'false');
  expect((await artboard(page)).width).toBe(STAGE.width);
});

test('crops to the current selection at the current frame, from the toolbar menu', async ({ page }) => {
  await seed(page, [layer('a', 'Alpha', 200, 100), layer('b', 'Bravo', -400, -200)]);
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();

  await page.getByRole('button', { name: 'Crop to content' }).click();
  await page.getByRole('menuitem', { name: 'Crop to current selection at current frame' }).click();

  const scale = await pxPerWorld(page);
  const alpha = await boxOf(page, 'a');
  const after = await artboard(page);
  // The stage IS the layer's evaluated box: 120×60 stage units.
  expect({ width: after.width, height: after.height }).toEqual({ width: 120, height: 60 });
  expect(Math.abs(alpha.width - 120 * scale)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(alpha.height - 60 * scale)).toBeLessThanOrEqual(1.5);
  // The layer sits inside the frame it produced, unclipped.
  expect(alpha.x).toBeGreaterThanOrEqual(after.originX - 1);
  expect(alpha.x + alpha.width).toBeLessThanOrEqual(after.originX + after.width * scale + 1);

  // ONE undo, and the untouched layer returns with the stage.
  await page.keyboard.press('Control+z');
  const restored = await artboard(page);
  expect(restored.width).toBe(STAGE.width);
  const bravo = await boxOf(page, 'b');
  // Bravo's box runs -460…-340 relative to the stage centre, i.e. stage x 500.
  expect(Math.abs((bravo.x - restored.originX) / scale - 500)).toBeLessThanOrEqual(2);
});
