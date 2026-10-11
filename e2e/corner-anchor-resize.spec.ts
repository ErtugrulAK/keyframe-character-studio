import { test, expect, type Page } from '@playwright/test';

/**
 * CORNER RESIZE — the dragged corner follows the pointer and the diagonally
 * OPPOSITE corner stays fixed in world space.
 *
 * Every measurement is taken through the real browser:
 *  - the four corner handles of `[data-testid="transform-gizmo"]` are located by
 *    matching the authored world corners (projected through the SVG screen CTM)
 *    to the rendered hit targets, so the expected corner identity comes from the
 *    authored numbers, not from the implementation under test;
 *  - the opposite corner is re-measured after the drag and compared with the
 *    pre-drag pixel position (<= 1 CSS px);
 *  - the dragged corner is compared with the pointer position (<= 1 CSS px);
 *  - the authored document snapshot proves that only the intended frame and
 *    template channels were written.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const CAMERA_CENTER = { x: 300, y: 240 };
/** Default timeline zoom: pixels per frame. */
const FRAME_WIDTH = 18;
const TOLERANCE_PX = 1;
/** Canonical local bounds of `custom_rect` (getShapeGeometry). */
const RECT_BOUNDS = { minX: -60, minY: -30, maxX: 60, maxY: 30 };

type Corner = 'tl' | 'tr' | 'bl' | 'br';
type Point = { x: number; y: number };
interface World { x: number; y: number; rotation: number; scaleX: number; scaleY: number; }

const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br'];
const OPPOSITE: Record<Corner, Corner> = { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl' };
/**
 * Drag distance as a fraction of the corner's distance from the fixed corner.
 * The aspect-ratio lock is ON by default, so a pure diagonal drag is the
 * gesture that must both hold the opposite corner and reach the pointer.
 */
const FRACTIONS: Record<Corner, number> = { tl: 0.55, tr: 0.6, bl: 1.5, br: 1.4 };

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

interface LayerSeed {
  id: string;
  name: string;
  type?: string;
  x: number;
  y: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  parentId?: string;
  zIndex?: number;
}

const rect = (id: string, name: string, x: number, y: number, overrides: Partial<LayerSeed> = {}) => ({
  type: 'custom_rect',
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  zIndex: 1,
  ...overrides,
  id,
  name,
  x,
  y,
  opacity: 1,
  visible: true,
  fillColor: '#22d3ee',
  strokeColor: '#101218',
  fillEnabled: true,
  strokeEnabled: false,
});

/**
 * The evaluator's world composition (`evaluateTransform`): parent scale, then
 * parent rotation, then parent translation; scale and rotation compose per axis.
 */
const composeWorld = (child: World, parent?: World): World => {
  if (!parent) return child;
  const rad = (parent.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = child.x * parent.scaleX;
  const sy = child.y * parent.scaleY;
  return {
    x: parent.x + sx * cos - sy * sin,
    y: parent.y + sx * sin + sy * cos,
    rotation: parent.rotation + child.rotation,
    scaleX: parent.scaleX * child.scaleX,
    scaleY: parent.scaleY * child.scaleY,
  };
};

const worldOf = (seed: LayerSeed): World => ({
  x: seed.x,
  y: seed.y,
  rotation: seed.rotation ?? 0,
  scaleX: seed.scaleX ?? 1,
  scaleY: seed.scaleY ?? 1,
});

async function seed(
  page: Page,
  layers: LayerSeed[],
  tracks?: { partId: string; channels: Record<string, unknown[]> }[],
): Promise<void> {
  const scene = JSON.stringify({
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    width: 1920,
    height: 1080,
    fps: 30,
    totalFrames: 60,
    layers,
    tracks: tracks ?? layers.map((layer) => ({ partId: layer.id, channels: emptyChannels() })),
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

/** Waits until the stage box and the rendered camera transform stop moving. */
async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => new Promise<boolean>((resolve) => {
    const stage = document.querySelector('.stage-canvas-container');
    const svg = document.querySelector('.stage-svg');
    if (!stage || !svg) { resolve(false); return; }
    let previous = '';
    let stable = 0;
    const sample = () => {
      const box = stage.getBoundingClientRect();
      const key = [
        Math.round(box.left * 100) / 100,
        Math.round(box.top * 100) / 100,
        Math.round(box.width * 100) / 100,
        Math.round(box.height * 100) / 100,
        getComputedStyle(svg).transform,
      ].join('|');
      stable = key === previous ? stable + 1 : 0;
      previous = key;
      if (stable >= 3) resolve(true);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }), undefined, { timeout: 15000 });
}

async function selectLayer(page: Page, name: string): Promise<void> {
  await page.locator('.ue-track-row', { hasText: name }).first().click();
  await expect(page.getByTestId('transform-gizmo')).toHaveCount(1);
  await settle(page);
}

/** Moves the playhead to `frame` through the ruler's own click contract. */
async function setFrame(page: Page, frame: number): Promise<void> {
  const grid = page.locator('.timeline-grid-container');
  const gridBox = await grid.boundingBox();
  const rulerBox = await page.locator('.time-ruler').boundingBox();
  expect(gridBox).not.toBeNull();
  expect(rulerBox).not.toBeNull();
  const scrollLeft = await grid.evaluate((node) => node.scrollLeft);
  await page.mouse.click(
    gridBox!.x - scrollLeft + frame * FRAME_WIDTH + 4,
    rulerBox!.y + rulerBox!.height / 2,
  );
  await expect(page.locator('.playhead-frame-label')).toHaveText(String(frame));
}

interface Measurement {
  /** Client (CSS px) centres of the four corner handles. */
  corner: Record<Corner, Point>;
  /** The same centres mapped back into editor-camera world units. */
  world: Record<Corner, Point>;
  index: Record<Corner, number>;
  matrix: { a: number; d: number };
}

/** Maps client points back into editor-camera world units through the CTM. */
async function toWorld(page: Page, points: Record<string, Point>): Promise<Record<string, Point>> {
  return page.evaluate((input) => {
    const svg = document.querySelector<SVGSVGElement>('.stage-svg');
    if (!svg) throw new Error('stage svg unavailable');
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error('screen CTM unavailable');
    const inverse = matrix.inverse();
    const result: Record<string, { x: number; y: number }> = {};
    Object.entries(input).forEach(([key, point]) => {
      const mapped = new DOMPoint(point.x, point.y).matrixTransform(inverse);
      result[key] = { x: mapped.x, y: mapped.y };
    });
    return result;
  }, points);
}

/** Maps world points to client pixels through the SVG screen CTM. */
async function toClient(page: Page, points: Record<string, Point>): Promise<Record<string, Point>> {
  return page.evaluate((input) => {
    const svg = document.querySelector<SVGSVGElement>('.stage-svg');
    if (!svg) throw new Error('stage svg unavailable');
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error('screen CTM unavailable');
    const result: Record<string, { x: number; y: number }> = {};
    Object.entries(input).forEach(([key, point]) => {
      const mapped = new DOMPoint(point.x, point.y).matrixTransform(matrix);
      result[key] = { x: mapped.x, y: mapped.y };
    });
    return result;
  }, points);
}

/**
 * The authored world position of one corner: origin + R(rotation)·(local ⊙ scale)
 * in the editor-camera space the viewBox is expressed in.
 */
function analyticCorner(world: World, corner: Corner): Point {
  const localX = corner === 'tl' || corner === 'bl' ? RECT_BOUNDS.minX : RECT_BOUNDS.maxX;
  const localY = corner === 'tl' || corner === 'tr' ? RECT_BOUNDS.minY : RECT_BOUNDS.maxY;
  const radians = (world.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: CAMERA_CENTER.x + world.x + localX * world.scaleX * cos - localY * world.scaleY * sin,
    y: CAMERA_CENTER.y + world.y + localX * world.scaleX * sin + localY * world.scaleY * cos,
  };
}

/**
 * Locates the four corner handles by matching the authored world corners to the
 * rendered hit targets, then reports the measured handle centres.
 */
async function measure(page: Page, world: World): Promise<Measurement> {
  const expected = await page.evaluate(
    ({ authored, bounds, center }) => {
      const svg = document.querySelector<SVGSVGElement>('.stage-svg');
      if (!svg) throw new Error('stage svg unavailable');
      const matrix = svg.getScreenCTM();
      if (!matrix) throw new Error('screen CTM unavailable');
      const rad = (authored.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const project = (localX: number, localY: number) => {
        const x = center.x + authored.x + localX * authored.scaleX * cos - localY * authored.scaleY * sin;
        const y = center.y + authored.y + localX * authored.scaleX * sin + localY * authored.scaleY * cos;
        const point = new DOMPoint(x, y).matrixTransform(matrix);
        return { x: point.x, y: point.y };
      };
      return {
        tl: project(bounds.minX, bounds.minY),
        tr: project(bounds.maxX, bounds.minY),
        bl: project(bounds.minX, bounds.maxY),
        br: project(bounds.maxX, bounds.maxY),
        matrix: { a: matrix.a, d: matrix.d },
      };
    },
    { authored: world, bounds: RECT_BOUNDS, center: CAMERA_CENTER },
  );

  const targets = page.getByTestId('transform-gizmo').first().getByTestId('gizmo-hit-target');
  const count = await targets.count();
  const rendered: { index: number; x: number; y: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    const box = await targets.nth(index).boundingBox();
    if (box) rendered.push({ index, x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }

  const corner = {} as Record<Corner, Point>;
  const indexOf = {} as Record<Corner, number>;
  CORNERS.forEach((cornerId) => {
    const target = expected[cornerId];
    let best: { index: number; x: number; y: number } | undefined;
    let bestDistance = Infinity;
    rendered.forEach((candidate) => {
      const distance = Math.hypot(candidate.x - target.x, candidate.y - target.y);
      if (distance < bestDistance) { bestDistance = distance; best = candidate; }
    });
    expect(bestDistance, `no gizmo corner handle within 2px of the authored ${cornerId} corner (${bestDistance.toFixed(2)}px)`).toBeLessThanOrEqual(2);
    corner[cornerId] = { x: best!.x, y: best!.y };
    indexOf[cornerId] = best!.index;
  });
  expect(new Set(Object.values(indexOf)).size, 'corner handles are not distinct').toBe(4);

  const worldCorner = await toWorld(page, corner) as Record<Corner, Point>;
  return { corner, world: worldCorner, index: indexOf, matrix: expected.matrix };
}

/** Re-reads the handles already identified by {@link measure}. */
async function measureHandles(page: Page, index: Record<Corner, number>, matrix: { a: number; d: number }): Promise<Measurement> {
  const targets = page.getByTestId('transform-gizmo').first().getByTestId('gizmo-hit-target');
  const corner = {} as Record<Corner, Point>;
  for (const cornerId of CORNERS) {
    const box = await targets.nth(index[cornerId]).boundingBox();
    expect(box, `corner handle ${cornerId} disappeared`).not.toBeNull();
    corner[cornerId] = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  }
  const worldCorner = await toWorld(page, corner) as Record<Corner, Point>;
  return { corner, world: worldCorner, index, matrix };
}

/** The authored layer transform as persisted. */
interface Authored { x: number; y: number; rotation: number; scaleX: number; scaleY: number; }

interface DragOptions {
  /** World-space offset added to the diagonal target (free-scale cases only). */
  offset?: Point;
  /** Runs while the pointer is mid-gesture (Escape handling). */
  midDrag?: () => Promise<void>;
}

interface DragResult {
  before: { dragged: Point; opposite: Point; worldDragged: Point; worldOpposite: Point; matrix: { a: number; d: number }; authored: Authored };
  after: { dragged: Point; opposite: Point; worldDragged: Point; worldOpposite: Point; matrix: { a: number; d: number }; authored: Authored };
  target: Point;
  targetWorld: Point;
}

async function dragCorner(
  page: Page,
  layerId: string,
  world: World,
  corner: Corner,
  fraction: number,
  options: DragOptions = {},
): Promise<DragResult> {
  const { offset = { x: 0, y: 0 }, midDrag } = options;
  const draggedStart = analyticCorner(world, corner);
  const fixedStart = analyticCorner(world, OPPOSITE[corner]);
  const targetWorld = {
    x: fixedStart.x + (draggedStart.x - fixedStart.x) * fraction + offset.x,
    y: fixedStart.y + (draggedStart.y - fixedStart.y) * fraction + offset.y,
  };

  const start = await measure(page, world);
  const authoredBefore = await readLayer(page, layerId);
  const dragged = start.corner[corner];
  const opposite = start.corner[OPPOSITE[corner]];
  const target = (await toClient(page, { target: targetWorld })).target;

  await page.mouse.move(dragged.x, dragged.y);
  await page.mouse.down();
  await page.mouse.move(dragged.x + (target.x - dragged.x) / 2, dragged.y + (target.y - dragged.y) / 2, { steps: 4 });
  if (midDrag) await midDrag();
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await page.mouse.up();
  await settle(page);

  const end = await measureHandles(page, start.index, start.matrix);
  const authoredAfter = await readLayer(page, layerId);
  return {
    before: {
      dragged,
      opposite,
      worldDragged: start.world[corner],
      worldOpposite: start.world[OPPOSITE[corner]],
      matrix: start.matrix,
      authored: authoredBefore,
    },
    after: {
      dragged: end.corner[corner],
      opposite: end.corner[OPPOSITE[corner]],
      worldDragged: end.world[corner],
      worldOpposite: end.world[OPPOSITE[corner]],
      matrix: end.matrix,
      authored: authoredAfter,
    },
    target,
    targetWorld,
  };
}

function reportDrag(label: string, corner: Corner, result: DragResult): void {
  const opposite = OPPOSITE[corner];
  const point = (value: Point) => `(${value.x.toFixed(1)}, ${value.y.toFixed(1)})`;
  const authored = (value: Authored) => `centre=(${value.x.toFixed(1)}, ${value.y.toFixed(1)}) scale=(${value.scaleX.toFixed(3)}, ${value.scaleY.toFixed(3)}) rot=${value.rotation.toFixed(1)}`;
  const driftX = result.after.worldOpposite.x - result.before.worldOpposite.x;
  const driftY = result.after.worldOpposite.y - result.before.worldOpposite.y;
  const driftPxX = result.after.opposite.x - result.before.opposite.x;
  const driftPxY = result.after.opposite.y - result.before.opposite.y;
  const missedX = result.after.worldDragged.x - result.targetWorld.x;
  const missedY = result.after.worldDragged.y - result.targetWorld.y;
  console.log(
    `[corner-anchor] ${label} drag=${corner}\n`
    + `    before: dragged=${point(result.before.worldDragged)} opposite(${opposite})=${point(result.before.worldOpposite)} ${authored(result.before.authored)}\n`
    + `    after : dragged=${point(result.after.worldDragged)} opposite(${opposite})=${point(result.after.worldOpposite)} ${authored(result.after.authored)}\n`
    + `    pointer target=${point(result.targetWorld)} | opposite drift world dx=${driftX.toFixed(3)} dy=${driftY.toFixed(3)} `
    + `(px dx=${driftPxX.toFixed(2)} dy=${driftPxY.toFixed(2)}) | dragged missed pointer world dx=${missedX.toFixed(3)} dy=${missedY.toFixed(3)}`,
  );
}

function expectDrag(label: string, corner: Corner, result: DragResult): void {
  const opposite = OPPOSITE[corner];
  reportDrag(label, corner, result);
  expect(
    Math.abs(result.after.opposite.x - result.before.opposite.x),
    `${label}: the fixed ${opposite} corner drifted ${(result.after.opposite.x - result.before.opposite.x).toFixed(2)}px in x`,
  ).toBeLessThanOrEqual(TOLERANCE_PX);
  expect(
    Math.abs(result.after.opposite.y - result.before.opposite.y),
    `${label}: the fixed ${opposite} corner drifted ${(result.after.opposite.y - result.before.opposite.y).toFixed(2)}px in y`,
  ).toBeLessThanOrEqual(TOLERANCE_PX);
  expect(
    Math.abs(result.after.dragged.x - result.target.x),
    `${label}: the dragged ${corner} corner missed the pointer by ${(result.after.dragged.x - result.target.x).toFixed(2)}px in x`,
  ).toBeLessThanOrEqual(TOLERANCE_PX);
  expect(
    Math.abs(result.after.dragged.y - result.target.y),
    `${label}: the dragged ${corner} corner missed the pointer by ${(result.after.dragged.y - result.target.y).toFixed(2)}px in y`,
  ).toBeLessThanOrEqual(TOLERANCE_PX);
  // Resizing must never move the camera.
  expect(result.after.matrix.a, `${label}: camera magnification changed`).toBeCloseTo(result.before.matrix.a, 6);
  expect(result.after.matrix.d, `${label}: camera magnification changed`).toBeCloseTo(result.before.matrix.d, 6);
}

/** The authored document, as persisted (proves the write path, not the pixels). */
async function snapshot(page: Page): Promise<string> {
  await page.locator('.autosave-status-badge').click();
  return page.evaluate((key) => localStorage.getItem(key) ?? '', STORAGE_KEY);
}

/** The authored transform of one layer in the persisted document. */
async function readLayer(page: Page, id: string): Promise<Authored> {
  const document = JSON.parse(await snapshot(page));
  const layer = document.layers.find((entry: { id: string }) => entry.id === id);
  return { x: layer.x, y: layer.y, rotation: layer.rotation, scaleX: layer.scaleX, scaleY: layer.scaleY };
}

async function undoDepth(page: Page): Promise<number> {
  const undo = page.locator('button[title="Undo"]');
  let depth = 0;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await undo.isDisabled()) break;
    await undo.click();
    depth += 1;
    await settle(page);
  }
  return depth;
}

test.describe('corner resize anchors the opposite corner', () => {
  for (const corner of CORNERS) {
    test(`unrotated rectangle: dragging ${corner.toUpperCase()} keeps ${OPPOSITE[corner].toUpperCase()} fixed`, async ({ page }) => {
      const alpha = rect('alpha', 'Alpha', 0, 0);
      await seed(page, [alpha]);
      await selectLayer(page, 'Alpha');
      const result = await dragCorner(page, 'alpha', worldOf(alpha), corner, FRACTIONS[corner]);
      expectDrag(`unrotated ${corner}`, corner, result);
    });
  }

  test('rotated rectangle: TL keeps BR and BR keeps TL', async ({ page }) => {
    const alpha = rect('alpha', 'Alpha', -40, 20, { rotation: 30 });
    await seed(page, [alpha]);
    await selectLayer(page, 'Alpha');
    const first = await dragCorner(page, 'alpha', worldOf(alpha), 'tl', 0.6);
    expectDrag('rotated 30 TL', 'tl', first);
  });

  test('rotated rectangle: BR keeps TL', async ({ page }) => {
    const alpha = rect('alpha', 'Alpha', 40, -20, { rotation: 30 });
    await seed(page, [alpha]);
    await selectLayer(page, 'Alpha');
    const result = await dragCorner(page, 'alpha', worldOf(alpha), 'br', 1.45);
    expectDrag('rotated 30 BR', 'br', result);
  });

  test('rotated rectangle: TR keeps BL and BL keeps TR', async ({ page }) => {
    const alpha = rect('alpha', 'Alpha', -30, 30, { rotation: -45 });
    await seed(page, [alpha]);
    await selectLayer(page, 'Alpha');
    const result = await dragCorner(page, 'alpha', worldOf(alpha), 'tr', 0.6);
    expectDrag('rotated -45 TR', 'tr', result);
  });

  test('rotated rectangle: BL keeps TR', async ({ page }) => {
    const alpha = rect('alpha', 'Alpha', 30, -30, { rotation: 120 });
    await seed(page, [alpha]);
    await selectLayer(page, 'Alpha');
    const result = await dragCorner(page, 'alpha', worldOf(alpha), 'bl', 1.5);
    expectDrag('rotated 120 BL', 'bl', result);
  });

  test('non-uniformly scaled rectangle preserves the opposite corner', async ({ page }) => {
    const alpha = rect('alpha', 'Alpha', 0, 0, { scaleX: 2.4, scaleY: 0.6, rotation: 20 });
    await seed(page, [alpha]);
    await selectLayer(page, 'Alpha');
    const result = await dragCorner(page, 'alpha', worldOf(alpha), 'br', 1.45);
    expectDrag('non-uniform scale', 'br', result);
  });

  test('translated parent: the child keeps its opposite corner', async ({ page }) => {
    const parent = rect('parent', 'Parent', 90, -40, { scaleX: 1.3, scaleY: 1.3, zIndex: 1 });
    const child = rect('child', 'Child', 30, -20, { parentId: 'parent', zIndex: 2 });
    await seed(page, [parent, child]);
    await selectLayer(page, 'Child');
    const world = composeWorld(worldOf(child), worldOf(parent));
    const result = await dragCorner(page, 'child', world, 'tl', 0.6);
    expectDrag('translated parent', 'tl', result);
  });

  test('rotated parent: the child keeps its opposite corner', async ({ page }) => {
    const parent = rect('parent', 'Parent', 60, 30, { rotation: 35, zIndex: 1 });
    const child = rect('child', 'Child', 40, -25, { parentId: 'parent', zIndex: 2 });
    await seed(page, [parent, child]);
    await selectLayer(page, 'Child');
    const world = composeWorld(worldOf(child), worldOf(parent));
    const result = await dragCorner(page, 'child', world, 'br', 1.4);
    expectDrag('rotated parent', 'br', result);
  });

  test('non-uniformly scaled parent: the child keeps its opposite corner', async ({ page }) => {
    const parent = rect('parent', 'Parent', -70, 20, { rotation: 25, scaleX: 1.6, scaleY: 0.7, zIndex: 1 });
    const child = rect('child', 'Child', 45, -18, { parentId: 'parent', rotation: 15, scaleX: 1.2, scaleY: 0.8, zIndex: 2 });
    await seed(page, [parent, child]);
    await selectLayer(page, 'Child');
    const world = composeWorld(worldOf(child), worldOf(parent));
    const result = await dragCorner(page, 'child', world, 'tr', 0.65);
    expectDrag('non-uniform parent', 'tr', result);
  });

  test('free (unlocked) corner drag tracks the pointer on both axes', async ({ page }) => {
    const alpha = rect('alpha', 'Alpha', 0, 0, { rotation: 20 });
    await seed(page, [alpha]);
    await selectLayer(page, 'Alpha');
    await page.getByRole('button', { name: 'Expand TRANSFORM' }).first().click();
    await page.locator('.transform-scale-lock').first().click();
    await expect(page.locator('.transform-scale-lock').first()).toHaveText(/Free/);
    await selectLayer(page, 'Alpha');
    // Off-diagonal target: only free scaling can put the corner on the pointer.
    const result = await dragCorner(page, 'alpha', worldOf(alpha), 'br', 1.35, { offset: { x: -22, y: 30 } });
    expectDrag('free scale BR', 'br', result);
  });
});

test.describe('corner resize authoring contract', () => {
  const keyed = (id: string, frame: number, value: number, templateId = 'Sequence') => ({ id, frame, value, easing: 'linear', templateId });

  test('a keyframed resize writes only the current frame of the active template', async ({ page }) => {
    const alpha = rect('alpha', 'Alpha', 40, 0);
    const channels = emptyChannels();
    channels.x = [keyed('x0', 0, 40), keyed('x30', 30, 40)];
    channels.y = [keyed('y0', 0, 0), keyed('y30', 30, 0)];
    channels.rotation = [keyed('r0', 0, 0), keyed('r30', 30, 0)];
    channels.scaleX = [keyed('sx0', 0, 1), keyed('sx30', 30, 1), keyed('sx30s', 30, 5, 'Stunt')];
    channels.scaleY = [keyed('sy0', 0, 1), keyed('sy30', 30, 1)];
    channels.opacity = [keyed('o0', 0, 1), keyed('o30', 30, 1)];
    await seed(page, [alpha], [{ partId: 'alpha', channels }]);
    await setFrame(page, 30);
    await selectLayer(page, 'Alpha');

    const before = await snapshot(page);
    const result = await dragCorner(page, 'alpha', worldOf(alpha), 'br', 0.6);
    expectDrag('keyframed frame 30', 'br', result);

    const after = JSON.parse(await snapshot(page));
    const track = after.tracks.find((entry: { partId: string }) => entry.partId === 'alpha');
    const sequence = (channel: string) => (track.channels[channel] as { frame: number; value: number; templateId?: string }[])
      .filter((kf) => kf.templateId === 'Sequence');
    const stunt = (channel: string) => (track.channels[channel] as { frame: number; value: number; templateId?: string }[])
      .filter((kf) => kf.templateId === 'Stunt');

    // Frame 30 of the active template is rewritten; no keyframe is added elsewhere.
    expect(sequence('x')).toHaveLength(2);
    expect(sequence('x').find((kf) => kf.frame === 0)!.value).toBe(40);
    expect(sequence('x').find((kf) => kf.frame === 30)!.value).not.toBe(40);
    expect(sequence('scaleX')).toHaveLength(2);
    expect(sequence('scaleX').find((kf) => kf.frame === 0)!.value).toBe(1);
    expect(sequence('scaleX').find((kf) => kf.frame === 30)!.value).not.toBe(1);
    expect(sequence('scaleY')).toHaveLength(2);
    expect(sequence('scaleY').find((kf) => kf.frame === 0)!.value).toBe(1);
    expect(sequence('scaleY').find((kf) => kf.frame === 30)!.value).not.toBe(1);
    // The other sequence at the same frame is untouched.
    expect(stunt('scaleX')).toHaveLength(1);
    expect(stunt('scaleX')[0].frame).toBe(30);
    expect(stunt('scaleX')[0].value).toBe(5);
    // The layer's static transform is unchanged while the layer is keyed.
    expect(before).toContain('"x":40');
    expect(after.layers.find((entry: { id: string }) => entry.id === 'alpha').scaleX).toBe(1);
  });

  test('one drag is one undo step and undo/redo are exact', async ({ page }) => {
    const alpha = rect('alpha', 'Alpha', 0, 0);
    // Control run: how deep the history of a freshly loaded, selected document is.
    await seed(page, [alpha]);
    await selectLayer(page, 'Alpha');
    const controlDepth = await undoDepth(page);
    console.log(`[corner-anchor] history depth control = ${controlDepth}`);

    await seed(page, [alpha]);
    await selectLayer(page, 'Alpha');
    const sceneBefore = await snapshot(page);
    const before = await measure(page, worldOf(alpha));

    const result = await dragCorner(page, 'alpha', worldOf(alpha), 'tl', 1.45);
    expectDrag('history drag', 'tl', result);
    const sceneAfter = await snapshot(page);
    expect(sceneAfter).not.toBe(sceneBefore);

    // Exactly one undo returns the document to the pre-drag state.
    await page.locator('button[title="Undo"]').click();
    await settle(page);
    expect(await snapshot(page)).toBe(sceneBefore);
    const undone = await measureHandles(page, before.index, before.matrix);
    expect(Math.abs(undone.corner.tl.x - before.corner.tl.x)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(undone.corner.br.x - before.corner.br.x)).toBeLessThanOrEqual(0.01);

    // Redo returns exactly the post-drag state.
    await page.locator('button[title="Redo"]').click();
    await settle(page);
    expect(await snapshot(page)).toBe(sceneAfter);
    const redone = await measureHandles(page, before.index, before.matrix);
    expect(Math.abs(redone.corner.tl.x - result.target.x)).toBeLessThanOrEqual(TOLERANCE_PX);
    expect(Math.abs(redone.corner.br.x - before.corner.br.x)).toBeLessThanOrEqual(TOLERANCE_PX);

    expect(await undoDepth(page)).toBe(controlDepth + 1);
  });

  test('Escape during a drag neither cancels nor corrupts the resize', async ({ page }) => {
    const alpha = rect('alpha', 'Alpha', 0, 0);
    await seed(page, [alpha]);
    await selectLayer(page, 'Alpha');
    const sceneBefore = await snapshot(page);

    const result = await dragCorner(page, 'alpha', worldOf(alpha), 'br', 1.4, {
      midDrag: async () => {
        await page.keyboard.press('Escape');
      },
    });
    expectDrag('escape mid-drag', 'br', result);

    // The gesture still committed as a single history entry, and the pre-drag
    // document is restored by exactly one undo.
    expect(await snapshot(page)).not.toBe(sceneBefore);
    await page.locator('button[title="Undo"]').click();
    await settle(page);
    expect(await snapshot(page)).toBe(sceneBefore);
  });

  test('the corner cursors and their hit targets are unchanged', async ({ page }) => {
    const alpha = rect('alpha', 'Alpha', 0, 0);
    await seed(page, [alpha]);
    await selectLayer(page, 'Alpha');
    const cursors = await page.getByTestId('transform-gizmo').first()
      .getByTestId('gizmo-hit-target')
      .evaluateAll((nodes) => nodes.slice(0, 4).map((node) => getComputedStyle(node).cursor));
    // TL and BR sit on the NW-SE diagonal, TR and BL on the NE-SW one.
    expect(cursors).toEqual(['nwse-resize', 'nesw-resize', 'nesw-resize', 'nwse-resize']);
    const edgeCursors = await page.getByTestId('transform-gizmo').first()
      .locator('circle[data-testid="gizmo-hit-target"]')
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).cursor));
    expect(edgeCursors).toContain('grab');
    expect(edgeCursors).toContain('ew-resize');
    expect(edgeCursors).toContain('ns-resize');
  });
});

test.describe('corner resize with a moved camera and a changed layout', () => {
  test('resize after an explicit pan and after a zoom', async ({ page }) => {
    const alpha = rect('alpha', 'Alpha', 0, 0);
    await seed(page, [alpha]);
    const canvas = page.locator('.stage-canvas-container');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Explicit pan with the hand tool.
    await page.getByRole('button', { name: 'Hand / Pan Tool', exact: true }).click();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 70, box!.y + box!.height / 2 + 45, { steps: 5 });
    await page.mouse.up();
    await settle(page);
    await page.getByRole('button', { name: 'Select Tool', exact: true }).click();
    await selectLayer(page, 'Alpha');

    const panned = await dragCorner(page, 'alpha', worldOf(alpha), 'tl', 0.6);
    expectDrag('after pan', 'tl', panned);

    // Explicit zoom through the toolbar.
    await page.getByRole('button', { name: 'Zoom In (+)', exact: true }).click();
    await settle(page);
    await selectLayer(page, 'Alpha');
    const afterPan = await readLayer(page, 'alpha');
    const zoomed = await dragCorner(page, 'alpha', afterPan, 'br', 1.45);
    expectDrag('after zoom', 'br', zoomed);
  });

  test('resize after the sidebar and timeline layout changed', async ({ page }) => {
    const alpha = rect('alpha', 'Alpha', 0, 0);
    await seed(page, [alpha]);
    await selectLayer(page, 'Alpha');

    await page.getByRole('button', { name: 'Hide Inspector' }).click();
    await settle(page);
    await page.getByRole('button', { name: 'Hide Left Toolbar' }).click();
    await settle(page);

    const bar = page.locator('.timeline-resizer-bar');
    const barBox = await bar.boundingBox();
    const stageBox = await page.locator('.stage-canvas-container').boundingBox();
    expect(barBox).not.toBeNull();
    expect(stageBox).not.toBeNull();
    await page.mouse.move(barBox!.x + barBox!.width / 2, barBox!.y + barBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(barBox!.x + barBox!.width / 2, stageBox!.y + stageBox!.height + 120, { steps: 8 });
    await page.mouse.up();
    await settle(page);

    await selectLayer(page, 'Alpha');
    const result = await dragCorner(page, 'alpha', worldOf(alpha), 'bl', 1.4);
    expectDrag('after layout change', 'bl', result);
  });
});
