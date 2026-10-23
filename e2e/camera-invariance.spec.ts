import { test, expect, type Page } from '@playwright/test';
import { resolveOpeningTimelineHeight } from '../src/components/Timeline/timelineConstants';

// C4 — the timeline OPENS at `resolveOpeningTimelineHeight(window height)`:
// 320 px on a tall window, about a third of a shorter one. These specs run in
// the default 1280×720 window, so the opening height comes from the same rule.
const OPENING_TIMELINE_HEIGHT = resolveOpeningTimelineHeight(720);

/**
 * CAMERA INVARIANCE — authoring chrome must never move the authored world.
 *
 * Opening/closing a sidebar or resizing the timeline changes the stage box, so
 * the stage centre and the stage size both move. The camera (zoom + world
 * position) must not follow those layout changes: a world point has to keep the
 * same screen position (<= 1 CSS px) while the visible crop changes.
 *
 * Everything here is measured through the real browser: the SVG screen CTM maps
 * authored camera points to client pixels, the rendered node box is a second,
 * independent reference, and the local project snapshot proves that none of the
 * transitions touched authored state or history.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const CAMERA_CENTER = { x: 300, y: 240 };
const ALPHA = { x: -120, y: -60 };
const BETA = { x: 140, y: 90 };
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
  const layers = [layer('alpha', 'Alpha', ALPHA.x, ALPHA.y), layer('beta', 'Beta', BETA.x, BETA.y)];
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
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await expect(page.locator('[data-part-id="alpha"]')).toHaveCount(1);
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
      const rect = stage.getBoundingClientRect();
      // C3: a dock slides over a FIXED stage box and only then re-enters the
      // row, so "the stage box stopped changing" is not "the layout is at rest"
      // while a dock still carries its travel style.
      const docksAtRest = [...document.querySelectorAll<HTMLElement>('.left-toolbar-container, .motion-design-right-sidebar')]
        .every((dock) => dock.style.position === '');
      const key = !docksAtRest ? `travelling|${performance.now()}` : [
        Math.round(rect.left * 100) / 100,
        Math.round(rect.top * 100) / 100,
        Math.round(rect.width * 100) / 100,
        Math.round(rect.height * 100) / 100,
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

interface Probe {
  /** Client position of the authored centre of the selected layer. */
  alpha: { x: number; y: number };
  /** Client position of a second authored world point (independent of selection). */
  beta: { x: number; y: number };
  /** Client centre of the rendered node box (DOM box, not CTM math). */
  node: { x: number; y: number };
  /** SVG screen CTM: a/d are the effective screen pixels per camera unit. */
  matrix: { a: number; d: number; e: number; f: number };
  cameraZoom: string;
  stage: { left: number; top: number; width: number; height: number };
  undoDisabled: boolean;
}

async function probe(page: Page): Promise<Probe> {
  return page.evaluate((points: { alpha: { x: number; y: number }; beta: { x: number; y: number } }) => {
    const svg = document.querySelector<SVGSVGElement>('.stage-svg');
    const stage = document.querySelector('.stage-canvas-container');
    const node = document.querySelector('[data-part-id="alpha"]');
    if (!svg || !stage || !node) throw new Error('camera surface unavailable');
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error('screen CTM unavailable');
    const toClient = (point: { x: number; y: number }) => {
      const projected = new DOMPoint(point.x, point.y).matrixTransform(matrix);
      return { x: projected.x, y: projected.y };
    };
    const nodeBox = node.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    return {
      alpha: toClient(points.alpha),
      beta: toClient(points.beta),
      node: { x: nodeBox.left + nodeBox.width / 2, y: nodeBox.top + nodeBox.height / 2 },
      matrix: { a: matrix.a, d: matrix.d, e: matrix.e, f: matrix.f },
      cameraZoom: document.querySelector('.stage-canvas-container')?.getAttribute('data-camera-zoom') ?? '',
      stage: { left: stageBox.left, top: stageBox.top, width: stageBox.width, height: stageBox.height },
      undoDisabled: document.querySelector<HTMLButtonElement>('button[title="Undo"]')?.disabled ?? false,
    };
  }, {
    alpha: { x: CAMERA_CENTER.x + ALPHA.x, y: CAMERA_CENTER.y + ALPHA.y },
    beta: { x: CAMERA_CENTER.x + BETA.x, y: CAMERA_CENTER.y + BETA.y },
  });
}

function report(label: string, baseline: Probe, current: Probe): void {
  const rows = (['alpha', 'beta', 'node'] as const).map((key) => {
    const dx = current[key].x - baseline[key].x;
    const dy = current[key].y - baseline[key].y;
    return `${key} dx=${dx.toFixed(2)} dy=${dy.toFixed(2)}`;
  });
  console.log(
    `[camera-drift] ${label} | ${rows.join(' | ')} | stage=${current.stage.left},${current.stage.top} `
    + `${current.stage.width}x${current.stage.height} | pxPerUnit=${current.matrix.a.toFixed(4)} `
    + `| undoDisabled=${current.undoDisabled}`,
  );
}

function expectInvariant(label: string, baseline: Probe, current: Probe): void {
  for (const key of ['alpha', 'beta', 'node'] as const) {
    expect(
      Math.abs(current[key].x - baseline[key].x),
      `${label}: ${key} x drifted ${(current[key].x - baseline[key].x).toFixed(3)}px`,
    ).toBeLessThanOrEqual(DRIFT_TOLERANCE_PX);
    expect(
      Math.abs(current[key].y - baseline[key].y),
      `${label}: ${key} y drifted ${(current[key].y - baseline[key].y).toFixed(3)}px`,
    ).toBeLessThanOrEqual(DRIFT_TOLERANCE_PX);
  }
  expect(current.matrix.a, `${label}: x magnification changed`).toBeCloseTo(baseline.matrix.a, 6);
  expect(current.matrix.d, `${label}: y magnification changed`).toBeCloseTo(baseline.matrix.d, 6);
  expect(current.cameraZoom, `${label}: zoom changed`).toBe(baseline.cameraZoom);
}

async function snapshot(page: Page): Promise<string> {
  const __savedBefore1 = await page.locator('.autosave-status-badge').getAttribute('data-last-saved-at');
  await page.locator('.autosave-status-badge').click();
  await expect
    .poll(async () => Number((await page.locator('.autosave-status-badge').getAttribute('data-last-saved-at')) || '0'), { timeout: 10_000 })
    .toBeGreaterThan(Number(__savedBefore1 || '0'));
  return page.evaluate((key) => localStorage.getItem(key) ?? '', STORAGE_KEY);
}

/**
 * How many undo steps the current document carries. Comparing this before and
 * after a layout transition proves the transition recorded no history entry,
 * which the serialized snapshot alone cannot see.
 */
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

async function hideInspector(page: Page) {
  await page.getByRole('button', { name: 'Hide Inspector' }).click();
  await settle(page);
}

async function showInspector(page: Page) {
  await page.getByRole('button', { name: 'Show Inspector' }).click();
  await settle(page);
}

async function hideLeftToolbar(page: Page) {
  await page.getByRole('button', { name: 'Hide Left Toolbar' }).click();
  await settle(page);
}

async function showLeftToolbar(page: Page) {
  await page.getByRole('button', { name: 'Show Left Toolbar' }).click();
  await settle(page);
}

async function dragTimelineTo(page: Page, targetPx: number) {
  const bar = page.locator('.timeline-resizer-bar');
  const box = await bar.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, targetPx, { steps: 10 });
  await page.mouse.up();
  await settle(page);
}

async function timelineHeight(page: Page): Promise<number> {
  return page.locator('.sequencer-timeline').evaluate((node) => node.getBoundingClientRect().height);
}

test('sidebar disclosure never moves the authored world', async ({ page }) => {
  // Control run: one manual save (as the measured run does) and the undo depth
  // of a freshly loaded document. The document is then reset so the drift
  // baseline is measured on the same state.
  await seed(page);
  await snapshot(page);
  const historyDepth = await undoDepth(page);
  console.log(`[camera-drift] sidebar test history depth (control) = ${historyDepth}`);

  await seed(page);
  const baseline = await probe(page);
  report('baseline', baseline, baseline);
  const sceneBefore = await snapshot(page);
  const undoBefore = baseline.undoDisabled;

  await hideInspector(page);
  const rightClosed = await probe(page);
  report('right sidebar open->closed', baseline, rightClosed);
  expectInvariant('right sidebar open->closed', baseline, rightClosed);

  await showInspector(page);
  const rightOpen = await probe(page);
  report('right sidebar closed->open', baseline, rightOpen);
  expectInvariant('right sidebar closed->open', baseline, rightOpen);

  await hideLeftToolbar(page);
  const leftClosed = await probe(page);
  report('left sidebar open->closed', baseline, leftClosed);
  expectInvariant('left sidebar open->closed', baseline, leftClosed);

  await showLeftToolbar(page);
  const leftOpen = await probe(page);
  report('left sidebar closed->open', baseline, leftOpen);
  expectInvariant('left sidebar closed->open', baseline, leftOpen);

  // The layout really did move: the stage box changed while the world did not.
  expect(rightClosed.stage.width).toBeGreaterThan(baseline.stage.width + 1);
  expect(leftClosed.stage.left).toBeLessThan(baseline.stage.left - 1);
  expect(leftClosed.stage.width).toBeGreaterThan(baseline.stage.width + 1);

  expect(leftOpen.stage.width).toBeCloseTo(baseline.stage.width, 0);
  expect(leftOpen.undoDisabled).toBe(undoBefore);
  expect(await snapshot(page)).toBe(sceneBefore);
  expect(await undoDepth(page)).toBe(historyDepth);
});

test('timeline collapse, expand and resize never move the authored world', async ({ page }) => {
  await seed(page);
  await snapshot(page);
  const historyDepth = await undoDepth(page);
  console.log(`[camera-drift] timeline test history depth (control) = ${historyDepth}`);

  await seed(page);
  const baseline = await probe(page);
  const sceneBefore = await snapshot(page);
  const undoBefore = baseline.undoDisabled;
  expect(await timelineHeight(page)).toBeCloseTo(OPENING_TIMELINE_HEIGHT, 0);

  // The timeline exposes a resizer bar (150..700 px); its minimum is the
  // collapsed state of the panel.
  await dragTimelineTo(page, baseline.stage.top + baseline.stage.height + 400);
  const collapsed = await probe(page);
  report('timeline collapse (min height)', baseline, collapsed);
  expectInvariant('timeline collapse (min height)', baseline, collapsed);
  expect(await timelineHeight(page)).toBeCloseTo(150, 0);

  await dragTimelineTo(page, collapsed.stage.top + collapsed.stage.height - 170);
  const expanded = await probe(page);
  report('timeline expand (back to default)', baseline, expanded);
  expectInvariant('timeline expand (back to default)', baseline, expanded);
  // (150 px + the 170 px drag: an authored 320, whatever the opening height was)
  expect(await timelineHeight(page)).toBeCloseTo(320, 0);

  // Dragging the resizer bar up makes the timeline taller and the stage shorter.
  await dragTimelineTo(page, expanded.stage.top + expanded.stage.height - 240);
  const resizedUp = await probe(page);
  report('timeline resize up', baseline, resizedUp);
  expectInvariant('timeline resize up', baseline, resizedUp);
  const tallerHeight = await timelineHeight(page);
  expect(tallerHeight).toBeGreaterThan(OPENING_TIMELINE_HEIGHT);
  expect(resizedUp.stage.height).toBeLessThan(baseline.stage.height - 1);

  await dragTimelineTo(page, resizedUp.stage.top + resizedUp.stage.height + 180);
  const resizedDown = await probe(page);
  report('timeline resize down', baseline, resizedDown);
  expectInvariant('timeline resize down', baseline, resizedDown);
  expect(await timelineHeight(page)).toBeLessThan(tallerHeight - 1);
  expect(resizedDown.stage.height).toBeGreaterThan(resizedUp.stage.height + 1);
  expect(resizedDown.undoDisabled).toBe(undoBefore);
  expect(await snapshot(page)).toBe(sceneBefore);
  expect(await undoDepth(page)).toBe(historyDepth);
});

test('repeated chrome toggles do not accumulate camera drift', async ({ page }) => {
  await seed(page);
  const baseline = await probe(page);

  for (let cycle = 0; cycle < 10; cycle += 1) {
    await hideInspector(page);
    await showInspector(page);
  }
  const afterTenInspectorCycles = await probe(page);
  report('inspector toggled 10x', baseline, afterTenInspectorCycles);
  expectInvariant('inspector toggled 10x', baseline, afterTenInspectorCycles);

  for (let cycle = 0; cycle < 10; cycle += 1) {
    await hideLeftToolbar(page);
    await showLeftToolbar(page);
  }
  const afterTenToolbarCycles = await probe(page);
  report('left toolbar toggled 10x', baseline, afterTenToolbarCycles);
  expectInvariant('left toolbar toggled 10x', baseline, afterTenToolbarCycles);

  for (let cycle = 0; cycle < 10; cycle += 1) {
    await dragTimelineTo(page, baseline.stage.top + baseline.stage.height + 120);
    await dragTimelineTo(page, baseline.stage.top + baseline.stage.height - 120);
  }
  const afterTenTimelineCycles = await probe(page);
  report('timeline resized 10x', baseline, afterTenTimelineCycles);
  expectInvariant('timeline resized 10x', baseline, afterTenTimelineCycles);
});

test('explicit pan, zoom and reset view still move the camera on purpose', async ({ page }) => {
  await seed(page);
  const baseline = await probe(page);
  const canvas = page.locator('.stage-canvas-container');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // Explicit pan: the hand tool drags the world with the pointer, 1:1.
  await page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name: 'Pan', exact: true }).click();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + box!.height / 2 + 40, { steps: 5 });
  await page.mouse.move(box!.x + box!.width / 2 + 120, box!.y + box!.height / 2 + 80, { steps: 5 });
  await page.mouse.up();
  await settle(page);
  const panned = await probe(page);
  expect(Math.abs(panned.alpha.x - baseline.alpha.x)).toBeGreaterThan(60);
  expect(Math.abs(panned.alpha.y - baseline.alpha.y)).toBeGreaterThan(40);
  expect(panned.matrix.a).toBeCloseTo(baseline.matrix.a, 6);
  expect(panned.cameraZoom).toBe(baseline.cameraZoom);

  // Explicit zoom: the toolbar keeps the zoom state authoritative.
  await page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name: 'Zoom in', exact: true }).click();
  await settle(page);
  const zoomed = await probe(page);
  expect(zoomed.matrix.a).toBeGreaterThan(panned.matrix.a + 0.01);
  expect(zoomed.cameraZoom).not.toBe(panned.cameraZoom);

  // Reset View Position restores the mount framing without touching zoom.
  await page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name: 'Reset view', exact: true }).click();
  await settle(page);
  const reset = await probe(page);
  expect(reset.cameraZoom).toBe(zoomed.cameraZoom);
  expect(Math.abs(reset.alpha.x - panned.alpha.x)).toBeGreaterThan(60);
});

test('pan survives chrome changes for the panned camera too', async ({ page }) => {
  await seed(page);
  const canvas = page.locator('.stage-canvas-container');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name: 'Pan', exact: true }).click();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 90, box!.y + box!.height / 2 + 50, { steps: 5 });
  await page.mouse.up();
  await settle(page);
  const panned = await probe(page);

  await hideInspector(page);
  const afterRight = await probe(page);
  report('panned camera: right sidebar open->closed', panned, afterRight);
  expectInvariant('panned camera: right sidebar open->closed', panned, afterRight);

  await hideLeftToolbar(page);
  const afterLeft = await probe(page);
  report('panned camera: left sidebar open->closed', panned, afterLeft);
  expectInvariant('panned camera: left sidebar open->closed', panned, afterLeft);

  await dragTimelineTo(page, afterLeft.stage.top + afterLeft.stage.height + 150);
  const afterTimeline = await probe(page);
  report('panned camera: timeline resize down', panned, afterTimeline);
  expectInvariant('panned camera: timeline resize down', panned, afterTimeline);
});
