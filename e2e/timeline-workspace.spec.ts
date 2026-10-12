import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * TIMELINE WORKSPACE — findings R2-01, R2-02 and R2-03 of Manual QA round 2.
 *
 * R2-02: the timeline height is chrome, so changing it can only crop the stage.
 * It must never move or rescale authored world content — not after the drag, and
 * not on any frame DURING it. The sampling contract is the same one
 * `camera-transition-stability.spec.ts` uses for the sidebar: read the client
 * position of authored world points on every painted frame while the layout
 * changes, instead of comparing a start position with an end position. The drag
 * is driven by REAL pointer input, because that is what exposes the frame where
 * the layout had changed but the stage had not measured it yet. A second
 * sampling window starts after the pointer is released, so a delayed correction
 * would show up as a moved world instead of being hidden by the first window.
 *
 * R2-01: the panel collapses and expands from a compact header control, the
 * collapsed strip keeps the restore affordance, and expanding restores the
 * height the user left.
 *
 * R2-03: the top edge resizes the height (row cursor, clamped) and a divider
 * resizes the outliner column (column cursor, clamped) while the timeline time
 * math keeps mapping the pointer to the same frame.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const CAMERA_CENTER = { x: 300, y: 240 };
const ALPHA = { x: -120, y: -60 };
const BETA = { x: 140, y: 90 };
/** Max transient drift of any world point on any painted frame. */
const DRIFT_TOLERANCE_PX = 1;
/** Max transient change of the rendered magnification (svg screen CTM a/d). */
const MAGNIFICATION_TOLERANCE = 0.002;
/** Timeline workspace bounds, mirrored from `timelineConstants.ts`. */
const MIN_HEIGHT = 150;
const MAX_HEIGHT = 700;
const MIN_WIDTH = 180;
const MAX_WIDTH = 520;
const DEFAULT_HEIGHT = 320;
const DEFAULT_WIDTH = 280;
/** The panned grid's px-per-frame at its default zoom, mirrored from `useTimeline`. */
const DEFAULT_FRAME_WIDTH = 18;

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

interface Frame {
  t: number;
  alpha: { x: number; y: number };
  beta: { x: number; y: number };
  a: number;
  d: number;
  stageHeight: number;
  timelineHeight: number;
}

/**
 * Samples the authored world once per painted frame — after the frame's
 * resize-observer step, so the sample reads what the user actually saw — for
 * `durationMs`.
 */
function startSampling(page: Page, durationMs: number): Promise<Frame[]> {
  return page.evaluate(({ duration, points }) => new Promise<Frame[]>((resolve) => {
    const svg = document.querySelector<SVGSVGElement>('.stage-svg');
    const stage = document.querySelector('.stage-canvas-container');
    const timeline = document.querySelector('.sequencer-timeline');
    if (!svg || !stage || !timeline) throw new Error('timeline workspace unavailable');

    const samples: Frame[] = [];
    const started = performance.now();

    const tick = () => {
      const matrix = svg.getScreenCTM();
      if (!matrix) throw new Error('screen CTM unavailable');
      const project = (point: { x: number; y: number }) => {
        const projected = new DOMPoint(point.x, point.y).matrixTransform(matrix);
        return { x: projected.x, y: projected.y };
      };
      const stageBox = stage.getBoundingClientRect();
      const timelineBox = timeline.getBoundingClientRect();
      samples.push({
        t: performance.now() - started,
        alpha: project(points.alpha),
        beta: project(points.beta),
        a: matrix.a,
        d: matrix.d,
        stageHeight: stageBox.height,
        timelineHeight: timelineBox.height,
      });
      if (performance.now() - started < duration) requestAnimationFrame(() => setTimeout(tick, 0));
      else resolve(samples);
    };
    requestAnimationFrame(() => setTimeout(tick, 0));
  }), {
    duration: durationMs,
    points: {
      alpha: { x: CAMERA_CENTER.x + ALPHA.x, y: CAMERA_CENTER.y + ALPHA.y },
      beta: { x: CAMERA_CENTER.x + BETA.x, y: CAMERA_CENTER.y + BETA.y },
    },
  });
}

/** Drags a workspace handle with real pointer input. */
async function dragBy(page: Page, target: Locator, delta: { x?: number; y?: number }, steps = 14): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('drag target has no box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(x + ((delta.x ?? 0) * step) / steps, y + ((delta.y ?? 0) * step) / steps);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

function report(label: string, frames: Frame[]): void {
  const baseline = frames[0];
  const drift = frames.map((frame) => Math.max(
    Math.abs(frame.alpha.x - baseline.alpha.x),
    Math.abs(frame.alpha.y - baseline.alpha.y),
    Math.abs(frame.beta.x - baseline.beta.x),
    Math.abs(frame.beta.y - baseline.beta.y),
  ));
  const spread = Math.max(...frames.map((frame) => Math.abs(frame.a - baseline.a)));
  const tallest = Math.max(...frames.map((frame) => frame.timelineHeight));
  console.log(
    `[timeline] ${label} | frames=${frames.length} `
    + `| timelineHeight ${baseline.timelineHeight.toFixed(1)}->${tallest.toFixed(1)} `
    + `| worstDrift=${Math.max(...drift).toFixed(3)}px | magnificationSpread=${spread.toFixed(5)}`,
  );
  console.log(`[timeline] ${label} | perFrameDrift=${drift.map((value) => value.toFixed(2)).join(',')}`);
}

function expectStable(label: string, frames: Frame[]): void {
  expect(frames.length, `${label}: too few frames sampled`).toBeGreaterThanOrEqual(10);
  const baseline = frames[0];
  frames.forEach((frame, index) => {
    for (const key of ['alpha', 'beta'] as const) {
      expect(
        Math.abs(frame[key].x - baseline[key].x),
        `${label}: frame ${index} t=${frame.t.toFixed(1)}ms ${key}.x moved (${frame[key].x.toFixed(3)} vs ${baseline[key].x.toFixed(3)})`,
      ).toBeLessThanOrEqual(DRIFT_TOLERANCE_PX);
      expect(
        Math.abs(frame[key].y - baseline[key].y),
        `${label}: frame ${index} t=${frame.t.toFixed(1)}ms ${key}.y moved (${frame[key].y.toFixed(3)} vs ${baseline[key].y.toFixed(3)})`,
      ).toBeLessThanOrEqual(DRIFT_TOLERANCE_PX);
    }
    expect(
      Math.abs(frame.a - baseline.a),
      `${label}: frame ${index} t=${frame.t.toFixed(1)}ms x-magnification changed`,
    ).toBeLessThanOrEqual(MAGNIFICATION_TOLERANCE);
    expect(
      Math.abs(frame.d - baseline.d),
      `${label}: frame ${index} t=${frame.t.toFixed(1)}ms y-magnification changed`,
    ).toBeLessThanOrEqual(MAGNIFICATION_TOLERANCE);
  });
}

const timelineHeight = (page: Page) => page.evaluate(() => document.querySelector('.sequencer-timeline')!.getBoundingClientRect().height);
const stageHeight = (page: Page) => page.evaluate(() => document.querySelector('.stage-canvas-container')!.getBoundingClientRect().height);
const outlinerWidth = (page: Page) => page.evaluate(() => document.querySelector('.track-outliner')!.getBoundingClientRect().width);
const selectionText = (page: Page) => page.evaluate(() => window.getSelection()?.toString() ?? '');
/** Where the playhead sits relative to the scrollable grid, in pixels. */
const playheadOffset = (page: Page) => page.evaluate(() => {
  const grid = document.querySelector('.timeline-grid-container')!.getBoundingClientRect();
  const playhead = document.querySelector('.playhead-line')!.getBoundingClientRect();
  return playhead.left - grid.left;
});

test('R2-02 — resizing the timeline height never moves the authored world on any painted frame', async ({ page }) => {
  await seed(page);
  const before = { stage: await stageHeight(page), timeline: await timelineHeight(page) };

  const sampling = startSampling(page, 2600);
  await dragBy(page, page.getByTestId('timeline-height-resizer'), { y: -140 });
  const frames = await sampling;
  report('height drag', frames);
  expectStable('height drag', frames);

  // The drag really resized the panel, so the samples above describe the defect.
  const after = { stage: await stageHeight(page), timeline: await timelineHeight(page) };
  expect(Math.abs(after.timeline - before.timeline), 'the drag never resized the timeline').toBeGreaterThan(40);
  expect(Math.abs(after.stage - before.stage), 'the stage box never changed size').toBeGreaterThan(40);

  // No delayed correction on mouseup: the frames sampled AFTER the pointer was
  // released must sit on the very same world position as the frames before it.
  const settleFrames = await startSampling(page, 500);
  report('after mouseup', settleFrames);
  const baseline = frames[0];
  expect(settleFrames.length, 'no frames were sampled after the drag').toBeGreaterThanOrEqual(10);
  settleFrames.forEach((frame, index) => {
    expect(
      Math.abs(frame.alpha.y - baseline.alpha.y),
      `the world was still moving after the drag (frame ${index})`,
    ).toBeLessThanOrEqual(DRIFT_TOLERANCE_PX);
    expect(
      Math.abs(frame.d - baseline.d),
      `the magnification was still moving after the drag (frame ${index})`,
    ).toBeLessThanOrEqual(MAGNIFICATION_TOLERANCE);
  });
});

test('R2-01 — the timeline collapses to a restore strip and expands to the previous height', async ({ page }) => {
  await seed(page);
  const toggle = page.getByTestId('timeline-collapse-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  // Author a non-default height first: expanding must bring THIS one back.
  await dragBy(page, page.getByTestId('timeline-height-resizer'), { y: -100 });
  const authored = await timelineHeight(page);
  expect(Math.abs(authored - DEFAULT_HEIGHT)).toBeGreaterThan(40);

  // Timeline state that a collapse must not destroy.
  await page.locator('.time-ruler').click({ position: { x: 180, y: 10 } });
  const frameBefore = await page.locator('.playhead-line').getAttribute('data-frame');
  const tracksBefore = await page.locator('.ue-track-row').count();
  expect(Number(frameBefore)).toBeGreaterThan(0);

  await toggle.click();
  await expect(page.getByTestId('sequencer-timeline')).toHaveAttribute('data-collapsed', 'true');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toHaveAccessibleName('Expand timeline');
  await expect(page.locator('.timeline-body')).toBeHidden();
  const collapsedHeight = await timelineHeight(page);
  expect(collapsedHeight, 'the collapsed strip is not a compact header').toBeLessThan(60);
  expect(collapsedHeight).toBeGreaterThan(20);
  // The restore affordance survives the collapse.
  await expect(toggle).toBeVisible();

  await toggle.click();
  await expect(page.getByTestId('sequencer-timeline')).toHaveAttribute('data-collapsed', 'false');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.timeline-body')).toBeVisible();
  expect(await timelineHeight(page), 'expanding did not restore the authored height').toBeCloseTo(authored, 0);
  expect(await page.locator('.playhead-line').getAttribute('data-frame'), 'collapse destroyed timeline state').toBe(frameBefore);
  expect(await page.locator('.ue-track-row').count(), 'collapse destroyed timeline state').toBe(tracksBefore);
});

test('R2-03 — the top edge resizes the height with a row cursor and clamped bounds', async ({ page }) => {
  await seed(page);
  const resizer = page.getByTestId('timeline-height-resizer');
  await expect(resizer).toBeVisible();
  expect(await resizer.evaluate((node) => getComputedStyle(node).cursor)).toBe('row-resize');
  expect(await resizer.getAttribute('aria-orientation')).toBe('horizontal');

  await dragBy(page, resizer, { y: 400 });
  expect(await timelineHeight(page)).toBeCloseTo(MIN_HEIGHT, 0);
  // The drag never paints a text selection.
  expect(await selectionText(page)).toBe('');

  // The pointer cannot leave the window, so the maximum is approached in steps
  // until the panel stops growing: the last step overshoots it. The ceiling is
  // the authored bound capped by the room the window really has, so the stage
  // always keeps its share.
  const ceiling = await page.evaluate((authoredMax) => {
    const stageTop = document.querySelector('.stage-canvas-container')!.getBoundingClientRect().top;
    return Math.min(authoredMax, window.innerHeight - stageTop - 160);
  }, MAX_HEIGHT);
  let tallest = await timelineHeight(page);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await dragBy(page, resizer, { y: -200 });
    const next = await timelineHeight(page);
    if (next === tallest) break;
    tallest = next;
  }
  expect(tallest, 'the height is not clamped to the room the window has').toBeCloseTo(ceiling, 0);
  expect(await stageHeight(page), 'the panel swallowed the stage').toBeGreaterThanOrEqual(160);
  // The window cursor class is released with the gesture.
  expect(await page.evaluate(() => document.body.classList.contains('kcs-resizing-rows'))).toBe(false);
});

test('R2-03 — the divider resizes the outliner column without disturbing the time math', async ({ page }) => {
  await seed(page);
  const divider = page.getByTestId('timeline-column-resizer');
  await expect(divider).toBeVisible();
  expect(await divider.evaluate((node) => getComputedStyle(node).cursor)).toBe('col-resize');
  expect(await divider.getAttribute('aria-orientation')).toBe('vertical');

  expect(await outlinerWidth(page)).toBeCloseTo(DEFAULT_WIDTH, 0);
  await page.locator('.time-ruler').click({ position: { x: 180, y: 10 } });
  const playheadBefore = await playheadOffset(page);
  expect(await page.locator('.playhead-line').getAttribute('data-frame')).toBe(String(Math.round(180 / DEFAULT_FRAME_WIDTH)));

  await dragBy(page, divider, { x: 120 }, 10);
  expect(await outlinerWidth(page)).toBeCloseTo(DEFAULT_WIDTH + 120, 0);
  // The time math is grid-relative and untouched: the same in-grid pointer x
  // still resolves to the same frame, and the playhead keeps its offset inside
  // the (now narrower) scrollable grid.
  await page.locator('.time-ruler').click({ position: { x: 180, y: 10 } });
  expect(await page.locator('.playhead-line').getAttribute('data-frame')).toBe(String(Math.round(180 / DEFAULT_FRAME_WIDTH)));
  expect(await playheadOffset(page)).toBeCloseTo(playheadBefore, 0);

  await dragBy(page, divider, { x: 2000 }, 10);
  expect(await outlinerWidth(page)).toBeCloseTo(MAX_WIDTH, 0);
  await dragBy(page, divider, { x: -2000 }, 10);
  expect(await outlinerWidth(page)).toBeCloseTo(MIN_WIDTH, 0);
  expect(await selectionText(page)).toBe('');
});

test('R2-09 — the property tree and the timeline lanes stay row-for-row aligned', async ({ page }) => {
  await seed(page);

  // Expand the first layer's property tree, so the whole stack is on screen.
  await page.locator('.ue-expand-btn').first().click();
  await expect(page.locator('.ue-channel-lanes').first()).toBeVisible();

  const rows = await page.evaluate(() => {
    const top = (selector: string) => [...document.querySelectorAll(selector)]
      .map((node) => node.getBoundingClientRect().top);
    // Document order on both sides: the owner row, then its property rows.
    return {
      tree: top('.ue-outliner-list .ue-track-row, .ue-outliner-list .ue-transform-header, .ue-outliner-list .ue-subgroup-header, .ue-outliner-list .ue-channel-row'),
      lanes: top('.ue-track-lanes .ue-track-lane, .ue-track-lanes .ue-channel-header-lane, .ue-track-lanes .ue-channel-lane'),
    };
  });

  // One lane per property row — the stack has no orphan row on either side, and
  // every pair shares the same row band.
  expect(rows.lanes.length).toBe(rows.tree.length);
  rows.tree.forEach((top, index) => {
    expect(Math.abs(rows.lanes[index] - top), `row ${index} is misaligned`).toBeLessThanOrEqual(1);
  });
});
