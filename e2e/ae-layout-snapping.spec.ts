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

  await page.getByRole('button', { name: 'Distribute Horizontal', exact: true }).click();

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
  await dragLayerMissOfScreenPixels(page, 16);
  await expect(page.locator('.snap-guide')).toHaveCount(0);
  const alpha = await boxOf(page, 'a');
  const bravo = await boxOf(page, 'b');
  expect(Math.abs(alpha.x - bravo.x)).toBeGreaterThan(6);
  await page.mouse.up();
});

/**
 * ONE layer, well away from every stage line except the one it approaches. The
 * threshold test has to isolate a SINGLE candidate: a moving box carries its own
 * centre and its far edge, and a candidate near one of THOSE is a legitimate lock
 * of its own. `SNAP_SEED` cannot serve here — Alpha's right edge reaches the
 * stage's centre line exactly when its left edge is a 16px miss from Bravo's.
 */
const THRESHOLD_SEED = [layer('a', 'Alpha', 0, -200)];

/** The stage artboard's LEFT edge in client pixels, as the app projects it. */
async function stageLeftEdgeScreenX(page: Page): Promise<number> {
  return page.evaluate(() => {
    const rect = document.querySelector('svg.stage-svg clipPath#artboard-clip rect');
    const svg = document.querySelector('svg.stage-svg') as SVGSVGElement | null;
    if (!rect || !svg) throw new Error('artboard unavailable');
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error('stage CTM unavailable');
    const point = new DOMPoint(Number(rect.getAttribute('x')), Number(rect.getAttribute('y')));
    return point.matrixTransform(matrix).x;
  });
}

/**
 * The camera zoom, read from the DOM the app publishes it in. It is the only
 * observable proof that a zoom step has COMMITTED — and the camera has to be
 * settled before a drag measures anything against it.
 */
const cameraZoom = async (page: Page): Promise<number> => Number(
  await page.locator('.stage-canvas-container').getAttribute('data-camera-zoom'),
);

/**
 * Drags Alpha until its left edge is exactly `screenPx` SCREEN pixels short of
 * the stage's left edge. Both the layer box and the artboard are read from the
 * SAME rendered frame and the pointer moves by their own difference, so the miss
 * is that many real screen pixels at whatever zoom the camera ended up at.
 */
async function dragStageMissOfScreenPixels(page: Page, screenPx: number) {
  const alpha = await boxOf(page, 'a');
  const edge = await stageLeftEdgeScreenX(page);
  const startX = alpha.x + alpha.width / 2;
  const startY = alpha.y + alpha.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await expect(page.locator('.stage-canvas-container')).toHaveClass(/interaction-dragging/);
  await page.mouse.move(startX - ((alpha.x - edge) - screenPx), startY, { steps: 6 });
}

/**
 * A 16px miss of another LAYER's edge, used where snapping is switched off and
 * the exact distance therefore cannot decide anything.
 */
async function dragLayerMissOfScreenPixels(page: Page, screenPx: number) {
  const alpha = await boxOf(page, 'a');
  const bravo = await boxOf(page, 'b');
  const startX = alpha.x + alpha.width / 2;
  const startY = alpha.y + alpha.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await expect(page.locator('.stage-canvas-container')).toHaveClass(/interaction-dragging/);
  await page.mouse.move(startX + (bravo.x - alpha.x) - screenPx, startY, { steps: 6 });
}

/**
 * The live snap state, as a failure message that names what actually happened:
 * the guide's own line, the layer box, the artboard edge, the measured miss, the
 * camera zoom and the rendered px-per-unit. A count assertion alone cannot say
 * WHICH line locked.
 */
async function snapReport(page: Page): Promise<string> {
  const guides = await page.locator('.snap-guide').evaluateAll((elements) => elements.map((element) => (
    element.hasAttribute('x1')
      ? `x=${element.getAttribute('x1')}`
      : `y=${element.getAttribute('y1')}`
  )));
  const alpha = await boxOf(page, 'a');
  const edge = await stageLeftEdgeScreenX(page);
  const zoom = await page.locator('.stage-canvas-container').getAttribute('data-camera-zoom');
  return `zoom=${zoom} pxPerWorld=${(await pxPerWorld(page)).toFixed(5)}`
    + ` alpha.x=${alpha.x.toFixed(2)} stageLeft=${edge.toFixed(2)} miss=${(alpha.x - edge).toFixed(2)}px`
    + ` guides=[${guides.join(', ')}]`;
}

test('the snap threshold is a screen radius at any zoom: a 4px miss locks, a 16px miss does not', async ({ page }) => {
  // The View band arms snapping by DEFAULT, and these measurements rely on it.
  await seed(page, THRESHOLD_SEED);
  await expect(page.getByRole('button', { name: 'Toggle snapping' })).toHaveAttribute('aria-pressed', 'true');

  for (const zoom of ['100%', 'in', 'out']) {
    // A fresh document and camera per zoom. The miss is measured from the rendered
    // frame at every iteration, so the statement is the same at whatever zoom the
    // camera settles on: 4 screen pixels lock, 16 screen pixels do not.
    await seed(page, THRESHOLD_SEED);
    await selectLayers(page, ['Alpha']);
    // The camera is DOM state (`data-camera-zoom`) and EVERY zoom step is confirmed
    // there before the next one. Presses sent in a single tick all read the same
    // stale zoom and commit one step between them, which leaves the camera moving
    // under the drag that follows — the miss the test measures then belongs to the
    // camera, not to the snap radius.
    if (zoom === 'in') {
      await page.keyboard.press('=');
      await expect.poll(() => cameraZoom(page), { message: 'the zoom-in never committed' }).toBeGreaterThan(1);
    }
    if (zoom === 'out') {
      for (let step = 0; step < 13; step += 1) {
        const before = await cameraZoom(page);
        await page.keyboard.press('-');
        await expect.poll(() => cameraZoom(page), { message: `zoom-out step ${step + 1} never committed` })
          .toBeLessThanOrEqual(Math.max(0.3, before * 0.9) + 1e-9);
      }
    }

    await dragStageMissOfScreenPixels(page, 4);
    await expect(page.locator('.snap-guide'), `4px miss did not lock: ${await snapReport(page)}`).toHaveCount(1);
    await page.mouse.up();
    await page.keyboard.press('Control+z');

    await dragStageMissOfScreenPixels(page, 16);
    await expect(page.locator('.snap-guide'), `16px miss locked: ${await snapReport(page)}`).toHaveCount(0);
    await page.mouse.up();
    await page.keyboard.press('Control+z');
  }
});

/**
 * ── The chrome of a live snap ────────────────────────────────────────────────
 *
 * Everything above measures WHERE a lock lands. These measure the guide itself,
 * read back from the DOM the browser painted and compared against the geometry
 * the lock claims to relate: the moving layer's own rendered box and the matched
 * target's. A guide is only worth drawing if it says which two things line up, so
 * its extent is asserted to be exactly that relation — never the whole canvas.
 *
 * The seed is deliberately unambiguous: Alpha is 120 wide (box −60…60) and Bravo
 * is 200 wide (box 400…600, centre 500), so when Alpha's left edge reaches
 * Bravo's left edge every other moving point (centre 458, right 518) is 40+ world
 * units clear of every other line — the candidate that wins is the only one in
 * range, and it is far from the stage centre line and from Bravo's own centre.
 */
const GUIDES_SEED = [
  layer('a', 'Alpha', -400, -200),
  { ...layer('b', 'Bravo', 500, 100), scaleX: 5 / 3 },
];

/**
 * Presses the layer once and returns a mover for the SAME gesture: successive
 * calls continue the live drag, which is the only way a candidate switch and an
 * out-of-radius move can be measured inside one gesture.
 */
async function pressAndMove(page: Page, id: string) {
  const box = await boxOf(page, id);
  const scale = await pxPerWorld(page);
  const origin = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(origin.x, origin.y);
  await page.mouse.down();
  // The gesture is ready when the app says so in the DOM: `interaction-dragging` is
  // committed with the same state the window move listener is attached from, and the
  // drag delta is absolute from where the press landed, so no probe move is needed
  // (and none is made — the authored transform is only ever touched by the moves
  // this helper is asked for).
  await expect(page.locator('.stage-canvas-container')).toHaveClass(/interaction-dragging/);
  return (worldDx: number, worldDy = 0) => page.mouse.move(
    origin.x + worldDx * scale,
    origin.y + worldDy * scale,
    { steps: 6 },
  );
}

/**
 * Every painted guide as the browser really drew it: the locked coordinate and
 * the extent, both in SCREEN pixels, converted through the stage's own CTM, plus
 * the pointer transparency the chrome is supposed to have.
 */
const paintedGuides = (page: Page) => page.evaluate(() => {
  const svg = document.querySelector('svg.stage-svg') as SVGSVGElement | null;
  const matrix = svg?.getScreenCTM?.();
  if (!svg || !matrix) throw new Error('stage camera unavailable');
  const project = (x: number, y: number) => {
    const point = new DOMPoint(x, y).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  };
  const group = document.querySelector('.snap-guides');
  return {
    group: group ? getComputedStyle(group).pointerEvents : 'absent',
    guides: [...document.querySelectorAll('.snap-guide')].map((element) => {
      const a = project(Number(element.getAttribute('x1')), Number(element.getAttribute('y1')));
      const b = project(Number(element.getAttribute('x2')), Number(element.getAttribute('y2')));
      const vertical = a.x === b.x;
      return {
        axis: vertical ? 'x' : 'y',
        line: vertical ? a.x : a.y,
        extentMin: vertical ? Math.min(a.y, b.y) : Math.min(a.x, b.x),
        extentMax: vertical ? Math.max(a.y, b.y) : Math.max(a.x, b.x),
        pointerEvents: getComputedStyle(element).pointerEvents,
      };
    }),
  };
});

test('a guide covers the relation between the aligned boxes, never the canvas', async ({ page }) => {
  await seed(page, GUIDES_SEED);
  await selectLayers(page, ['Alpha']);

  const move = await pressAndMove(page, 'a');
  await move(858); // alpha's left edge lands 2 world units short of Bravo's (400)

  const alpha = await boxOf(page, 'a');
  const bravo = await boxOf(page, 'b');
  const painted = await paintedGuides(page);
  const report = JSON.stringify({ painted, alpha, bravo });

  expect(painted.guides, report).toHaveLength(1);
  const guide = painted.guides[0];
  expect(guide.axis, report).toBe('x');
  // The line is exactly on the geometry the snap resolved: both left edges.
  expect(Math.abs(guide.line - alpha.x), `line vs the moving edge: ${report}`).toBeLessThanOrEqual(1);
  expect(Math.abs(guide.line - bravo.x), `line vs the target edge: ${report}`).toBeLessThanOrEqual(1);
  // ...and drawn over exactly the relation: the two boxes' bands, nothing more.
  expect(Math.abs(guide.extentMin - Math.min(alpha.y, bravo.y)), `extent start: ${report}`).toBeLessThanOrEqual(1);
  expect(
    Math.abs(guide.extentMax - Math.max(alpha.y + alpha.height, bravo.y + bravo.height)),
    `extent end: ${report}`,
  ).toBeLessThanOrEqual(1);
  expect(guide.pointerEvents, `pointer transparency: ${report}`).toBe('none');
  expect(painted.group, `pointer transparency: ${report}`).toBe('none');
});

test('each snapped axis paints its own guide, and a stage line spans the moving layer', async ({ page }) => {
  await seed(page, GUIDES_SEED);
  await selectLayers(page, ['Alpha']);

  const move = await pressAndMove(page, 'a');
  await move(858, 202); // X onto Bravo's left edge, Y onto the stage centre line

  const alpha = await boxOf(page, 'a');
  const painted = await paintedGuides(page);
  const report = JSON.stringify({ painted, alpha });

  // One guide per snapped axis: the axis list IS the uniqueness statement.
  expect(painted.guides.map((guide) => guide.axis).sort(), report).toEqual(['x', 'y']);

  const horizontal = painted.guides.find((guide) => guide.axis === 'x')!;
  const vertical = painted.guides.find((guide) => guide.axis === 'y')!;
  // The X guide is on the other layer's left edge, i.e. on the moving left edge.
  expect(Math.abs(horizontal.line - alpha.x), `x guide: ${report}`).toBeLessThanOrEqual(1);
  // The Y guide is on the stage's centre line, i.e. on the moving layer's centre.
  expect(Math.abs(vertical.line - (alpha.y + alpha.height / 2)), `y guide: ${report}`).toBeLessThanOrEqual(1);
  // A stage line is a reference, not a box the item is compared against: it spans
  // the moving layer's own band instead of the whole artboard.
  expect(Math.abs(vertical.extentMin - alpha.x), `y guide start: ${report}`).toBeLessThanOrEqual(1);
  expect(Math.abs(vertical.extentMax - (alpha.x + alpha.width)), `y guide end: ${report}`).toBeLessThanOrEqual(1);
});

test('the guide follows the nearest candidate, clears the moment the snap lets go, and ignores the pointer', async ({ page }) => {
  await seed(page, GUIDES_SEED);
  await selectLayers(page, ['Alpha']);
  const bravo = await boxOf(page, 'b');

  const move = await pressAndMove(page, 'a');
  await move(858); // onto Bravo's left edge
  const onEdge = await paintedGuides(page);
  await move(958); // the nearest candidate is now Bravo's CENTRE line
  const onCentre = await paintedGuides(page);
  await move(1100); // past every candidate, still mid-drag
  const released = await paintedGuides(page);
  await page.mouse.up();

  const report = JSON.stringify({ onEdge: onEdge.guides, onCentre: onCentre.guides, released: released.guides });
  expect(onEdge.guides, report).toHaveLength(1);
  expect(Math.abs(onEdge.guides[0].line - bravo.x), `locked on the edge: ${report}`).toBeLessThanOrEqual(1);
  expect(onCentre.guides, `switched candidate: ${report}`).toHaveLength(1);
  expect(
    Math.abs(onCentre.guides[0].line - (bravo.x + bravo.width / 2)),
    `switched to the centre line: ${report}`,
  ).toBeLessThanOrEqual(1);
  // Leaving the radius clears the chrome in the same move — the drag is still on.
  expect(released.guides, `cleared on unsnap: ${report}`).toHaveLength(0);
  // ...and the mouse-up takes the overlay with it.
  await expect(page.locator('.snap-guides'), `chrome after mouseup: ${report}`).toHaveCount(0);
});
