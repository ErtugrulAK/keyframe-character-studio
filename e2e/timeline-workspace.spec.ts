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

  /*
   * R3-01 — the control is an EDGE HANDLE, not a labelled button: it carries no
   * text, and it straddles the panel's own top edge (the boundary the height
   * drag owns) instead of floating somewhere inside the header.
   */
  expect((await toggle.textContent())?.trim()).toBe('');
  const edgeGeometry = await page.evaluate(() => {
    const handle = document.querySelector('[data-testid="timeline-collapse-toggle"]')!.getBoundingClientRect();
    const panel = document.querySelector('[data-testid="sequencer-timeline"]')!.getBoundingClientRect();
    return { handleCenter: handle.top + handle.height / 2, handleHeight: handle.height, panelTop: panel.top };
  });
  expect(Math.abs(edgeGeometry.handleCenter - edgeGeometry.panelTop)).toBeLessThanOrEqual(2);
  expect(edgeGeometry.handleHeight).toBeLessThanOrEqual(24);

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
      tree: top('.ue-outliner-list .ue-track-row, .ue-outliner-list .ue-subgroup-header, .ue-outliner-list .ue-channel-row'),
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

/**
 * R3-02 — the side-panel show/hide handles are anchored to the editor SHELL, not
 * to the workspace row. Their `top: 50%` resolves against a box the timeline
 * resize never changes, so dragging the timeline from its minimum to its maximum
 * and back must leave them exactly where they were.
 */
test('R3-02 — the side-panel handles do not move when the timeline height changes', async ({ page }) => {
  await seed(page);

  const handleBoxes = () => page.evaluate(() => {
    const box = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) throw new Error(`${selector} is missing`);
      const rect = node.getBoundingClientRect();
      return { top: Math.round(rect.top), height: Math.round(rect.height) };
    };
    return { left: box('.left-toolbar-toggle'), right: box('.inspector-dock-toggle') };
  });

  const before = await handleBoxes();
  const startHeight = await timelineHeight(page);
  expect(Math.abs(startHeight - DEFAULT_HEIGHT)).toBeLessThanOrEqual(1);

  // Minimum: the panel gives the stage nearly everything back.
  await dragBy(page, page.getByTestId('timeline-height-resizer'), { y: 400 });
  const atMinimum = await timelineHeight(page);
  expect(Math.abs(atMinimum - MIN_HEIGHT)).toBeLessThanOrEqual(1);
  const minimumHandles = await handleBoxes();
  expect(minimumHandles.left.top).toBe(before.left.top);
  expect(minimumHandles.right.top).toBe(before.right.top);

  // Maximum: the panel takes as much as the window can spare.
  let atMaximum = atMinimum;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await dragBy(page, page.getByTestId('timeline-height-resizer'), { y: -200 });
    const next = await timelineHeight(page);
    if (next === atMaximum) break;
    atMaximum = next;
  }
  expect(atMaximum, 'the drag never resized the panel').toBeGreaterThan(MIN_HEIGHT + 40);
  const maximumHandles = await handleBoxes();
  expect(maximumHandles.left.top).toBe(before.left.top);
  expect(maximumHandles.right.top).toBe(before.right.top);

  // ...and back to the minimum: the handles never moved at any height.
  await dragBy(page, page.getByTestId('timeline-height-resizer'), { y: 2000 });
  expect(Math.abs((await timelineHeight(page)) - MIN_HEIGHT)).toBeLessThanOrEqual(1);
  expect(await handleBoxes()).toEqual(before);
});

/**
 * R3-07 — the layer row now carries keyframe navigation next to its own actions.
 * That strip is compact and right-aligned on purpose: the MIDDLE of a layer row
 * must stay a selection target, because clicking a row's middle is how a layer is
 * selected from the timeline (and what every canvas measurement spec relies on).
 */
test('R3-07 — the layer row keeps its middle clickable for selection', async ({ page }) => {
  await seed(page);
  const row = page.locator('.ue-track-row').first();
  const box = await row.boundingBox();
  expect(box).not.toBeNull();
  const centre = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };

  // The controls (edit eye, broadcast eye, lock, ◀, +, ▶) sit against the right
  // edge and never reach the middle of the row.
  const underCentre = await page.evaluate((point) => {
    const node = document.elementFromPoint(point.x, point.y);
    return node ? node.className : '';
  }, centre);
  expect(String(underCentre)).toContain('ue-track-name');

  // The middle click selects the layer, like it always has.
  await page.mouse.click(centre.x, centre.y);
  await expect(page.getByTestId('transform-gizmo')).toHaveCount(1);
});

/**
 * R4-01 — the side-panel show/hide handles are the timeline's OWN compact
 * edge-handle family: a thin pill with a bare chevron, symmetric left and right,
 * anchored to the UPPER EDITOR WORKSPACE (a fixed inset below the workspace
 * row's top edge). The workspace row is the box the timeline resize shortens
 * from BELOW, so its top edge never moves and a handle pinned to it can neither
 * be dragged onto the timeline nor wander when the window is short — at the
 * minimum, the default and the maximum height, and after a window resize.
 */
test('R4-01 — the dock handles stay clear of the timeline at min, default and max heights', async ({ page }) => {
  await seed(page);

  const geometry = () => page.evaluate(() => {
    const read = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) throw new Error(`${selector} is missing`);
      const rect = node.getBoundingClientRect();
      return {
        label: (node.textContent ?? '').trim(),
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const row = document.querySelector('.main-layout')!.getBoundingClientRect();
    const panel = document.querySelector('[data-testid="sequencer-timeline"]')!.getBoundingClientRect();
    return {
      left: read('.left-toolbar-toggle'),
      right: read('.inspector-dock-toggle'),
      rowTop: row.top,
      rowBottom: row.bottom,
      timelineTop: panel.top,
      timelineHeight: panel.height,
    };
  });

  const expectClear = (label: string, boxes: Awaited<ReturnType<typeof geometry>>) => {
    for (const [side, handle] of [['left', boxes.left], ['right', boxes.right]] as const) {
      // The handle never paints a single pixel over the timeline...
      expect(handle.bottom, `${label}: the ${side} handle paints over the timeline`).toBeLessThanOrEqual(boxes.timelineTop);
      // ...because it lives inside the workspace row, above the timeline.
      expect(handle.top, `${label}: the ${side} handle left the workspace row`).toBeGreaterThanOrEqual(boxes.rowTop);
      expect(handle.bottom, `${label}: the ${side} handle left the workspace row`).toBeLessThanOrEqual(boxes.rowBottom);
    }
  };

  const atDefault = await geometry();
  // A compact edge handle: no label, no bulky tab.
  for (const handle of [atDefault.left, atDefault.right]) {
    expect(handle.label).toBe('');
    expect(handle.width).toBeLessThanOrEqual(22);
    expect(handle.height).toBeLessThanOrEqual(48);
    expect(handle.height).toBeGreaterThan(handle.width);
  }
  // Symmetric: both handles ride the same inset below the workspace top edge.
  expect(Math.abs(atDefault.left.top - atDefault.right.top)).toBeLessThanOrEqual(1);
  expect(atDefault.left.top - atDefault.rowTop).toBeGreaterThan(0);
  expect(atDefault.left.top - atDefault.rowTop).toBeLessThan(60);
  expectClear('default', atDefault);

  // Minimum height: the panel gives the stage nearly everything back.
  await dragBy(page, page.getByTestId('timeline-height-resizer'), { y: 400 });
  expect(Math.abs((await timelineHeight(page)) - MIN_HEIGHT)).toBeLessThanOrEqual(1);
  const atMinimum = await geometry();
  expectClear('minimum', atMinimum);

  // Maximum height: as tall as this window can afford while the stage keeps its share.
  let atMaximum = await timelineHeight(page);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await dragBy(page, page.getByTestId('timeline-height-resizer'), { y: -200 });
    const next = await timelineHeight(page);
    if (next === atMaximum) break;
    atMaximum = next;
  }
  expect(atMaximum, 'the drag never resized the panel').toBeGreaterThan(MIN_HEIGHT + 40);
  const maxBoxes = await geometry();
  expectClear('maximum', maxBoxes);
  // The height really changed across the checkpoints, so they are not the same layout.
  expect(maxBoxes.timelineHeight).toBeGreaterThan(atMinimum.timelineHeight + 40);

  // The anchor is the workspace row's TOP edge: a resize never moved the handles.
  expect(Math.abs(maxBoxes.left.top - atDefault.left.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(maxBoxes.right.top - atDefault.right.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(atMinimum.left.top - atDefault.left.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(atMinimum.right.top - atDefault.right.top)).toBeLessThanOrEqual(1);

  // Window-resize safe: a short window re-clamps the panel, and the handles still
  // cannot reach the timeline (a viewport-50% anchor could).
  await page.setViewportSize({ width: 1120, height: 620 });
  await expect.poll(() => timelineHeight(page)).toBeLessThan(atMaximum);
  expectClear('short window', await geometry());
  await page.setViewportSize({ width: 1280, height: 720 });
  expectClear('restored window', await geometry());
});

/**
 * R4-02 — the outliner divider speaks the same language as the panel-height
 * divider: a compact pill, NEUTRAL at rest, strengthened to the KCS accent only
 * while hovered or dragged, inside a generous invisible hit strip. No filled
 * bar, no glow, and no colour outside the editor's own teal accent.
 */
test('R4-02 — the outliner divider matches the timeline resize-handle language', async ({ page }) => {
  await seed(page);
  const divider = page.getByTestId('timeline-column-resizer');
  await expect(divider).toBeVisible();

  const painted = () => page.evaluate(() => {
    const node = document.querySelector('[data-testid="timeline-column-resizer"]')!;
    const strip = getComputedStyle(node);
    const pill = getComputedStyle(node, '::after');
    const box = node.getBoundingClientRect();
    // Resolve the accent through the cascade, so the test reads the theme value
    // the divider itself would paint.
    const probe = document.createElement('div');
    probe.style.color = 'var(--kcs-accent)';
    node.parentElement!.appendChild(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    return {
      stripWidth: box.width,
      stripBackground: strip.backgroundColor,
      pillBackground: pill.backgroundColor,
      pillWidth: parseFloat(pill.width),
      pillHeight: parseFloat(pill.height),
      pillShadow: pill.boxShadow,
      accent,
      heightPillBackground: getComputedStyle(document.querySelector('.resizer-handle-pill')!).backgroundColor,
    };
  });

  const rest = await painted();
  // Generous INVISIBLE hit strip: 6px of pointer target, nothing painted.
  expect(rest.stripWidth).toBeGreaterThanOrEqual(6);
  expect(rest.stripBackground).toBe('rgba(0, 0, 0, 0)');
  // Minimal painted geometry: a thin, short, glow-free pill.
  expect(rest.pillWidth).toBeLessThanOrEqual(4);
  expect(rest.pillHeight).toBeGreaterThan(20);
  expect(rest.pillHeight).toBeLessThan(80);
  expect(rest.pillShadow).toBe('none');
  // Neutral by default — the same tone the height divider rests in.
  expect(rest.pillBackground).not.toBe(rest.accent);
  expect(rest.pillBackground).toBe(rest.heightPillBackground);

  await divider.hover();
  // The pill carries a 150ms transition, so the painted colour settles.
  await expect.poll(async () => (await painted()).pillBackground).toBe(rest.accent);
  await expect.poll(async () => (await painted()).pillHeight).toBeGreaterThan(rest.pillHeight);
  const hovered = await painted();
  expect(hovered.pillShadow).toBe('none');

  // The accent is the editor's TEAL, never a purple/indigo glow.
  const channels = (hovered.accent.match(/\d+/g) ?? []).map(Number);
  expect(channels).toHaveLength(3);
  expect(channels[1]).toBeGreaterThan(channels[0]);
  expect(channels[1]).toBeGreaterThan(channels[2]);
});
