import { test, expect, type Page } from '@playwright/test';

/**
 * CAMERA TRANSITION STABILITY — finding A.
 *
 * `camera-invariance.spec.ts` proves the world is in the same place BEFORE and
 * AFTER a chrome toggle, which is not enough: the observed defect was that the
 * stage visibly counter-moved while the sidebar animated and then settled.
 *
 * This spec samples the client position of authored world points on EVERY
 * animation frame across the transition (sampling starts before the toggle and
 * runs until the layout has settled). The stage box provably animates during the
 * sampling window, so any frame whose world point moved is a real transient
 * drift rather than a start/end comparison.
 *
 * Coverage: the right inspector (hide, show, and double mid-edge reversals in
 * both directions), the left toolbar (hide and show), repeated chrome toggles,
 * the R5-03 timeline ease, and the inspector at a short, a clamped-narrow and a
 * wide viewport. The panel's own edge is checked in the same pass: on a
 * single-direction toggle it must visit intermediate widths in ONE monotone
 * direction and leave no inline width behind.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const CAMERA_CENTER = { x: 300, y: 240 };
const ALPHA = { x: -120, y: -60 };
const BETA = { x: 140, y: 90 };
/** Max transient drift of any world point on any sampled frame. */
const DRIFT_TOLERANCE_PX = 1;
/** Max transient change of the rendered magnification (svg screen CTM a/d). */
const MAGNIFICATION_TOLERANCE = 0.002;

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

interface Frame {
  t: number;
  alpha: { x: number; y: number };
  beta: { x: number; y: number };
  a: number;
  d: number;
  stageLeft: number;
  stageWidth: number;
  stageHeight: number;
  cameraZoom: string;
  /** The right inspector's own docked edge while it travels. */
  inspectorWidth: number;
  /** The timeline panel's own animated edge, and the handle pinned to it. */
  timelineHeight: number;
  panelTop: number;
  handleCentreY: number;
}

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
      const key = [
        Math.round(rect.left * 100) / 100,
        Math.round(rect.width * 100) / 100,
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

/**
 * A toggle the sampling window drives itself: either at an elapsed time (`at`)
 * or that many milliseconds after the previous toggle actually landed
 * (`afterMs`). The relative form is what makes a reversal land mid-edge even
 * when a loaded page takes a long time to reach the first frame.
 */
interface ScheduledToggle { at?: number; afterMs?: number; label: string }

/** Normalizes a single toggle label into the schedule form. */
const schedule = (toggle: string | ScheduledToggle[]): ScheduledToggle[] => (
  typeof toggle === 'string' ? [{ at: 80, label: toggle }] : toggle
);

/**
 * Sample the world points on every PAINTED frame, starting a few frames BEFORE
 * the first toggle and ending once the layout has settled past `durationMs`.
 *
 * Every toggle in the schedule is clicked by the page itself, at its own elapsed
 * time, so a second toggle can land while the first edge is still travelling and
 * no Playwright round trip can slip between a click and the sample that follows
 * it.
 *
 * The sample is taken from a task scheduled after the frame's resize-observer
 * step (rAF → setTimeout 0), which is the only place that reads exactly the
 * values the user saw: a plain rAF callback runs *before* the stage measures its
 * new box, so it would report the previous frame's transform and invent drift.
 */
async function sampleTransition(page: Page, toggle: string | ScheduledToggle[], durationMs = 600): Promise<Frame[]> {
  const toggles = schedule(toggle);
  return page.evaluate(({ toggles, durationMs: duration, points }) => new Promise<Frame[]>((resolve) => {
    const svg = document.querySelector<SVGSVGElement>('.stage-svg');
    const stage = document.querySelector('.stage-canvas-container');
    if (!svg || !stage) throw new Error('camera surface unavailable');
    const frames: Frame[] = [];
    const started = performance.now();
    let nextToggle = 0;
    let nextAt = toggles.length > 0 ? (toggles[0].at ?? 80) : Number.POSITIVE_INFINITY;
    const step = () => {
      const matrix = svg.getScreenCTM();
      if (!matrix) throw new Error('screen CTM unavailable');
      const project = (point: { x: number; y: number }) => {
        const projected = new DOMPoint(point.x, point.y).matrixTransform(matrix);
        return { x: projected.x, y: projected.y };
      };
      const stageBox = stage.getBoundingClientRect();
      const panelBox = document.querySelector('.sequencer-timeline')!.getBoundingClientRect();
      const handleBox = document.querySelector('[data-testid="timeline-collapse-toggle"]')!.getBoundingClientRect();
      frames.push({
        t: performance.now() - started,
        alpha: project(points.alpha),
        beta: project(points.beta),
        a: matrix.a,
        d: matrix.d,
        stageLeft: stageBox.left,
        stageWidth: stageBox.width,
        stageHeight: stageBox.height,
        cameraZoom: document.querySelector('.stage-canvas-container')?.getAttribute('data-camera-zoom') ?? '',
        inspectorWidth: document.querySelector('.motion-design-right-sidebar')!.getBoundingClientRect().width,
        timelineHeight: panelBox.height,
        panelTop: panelBox.top,
        handleCentreY: handleBox.top + handleBox.height / 2,
      });
      const elapsed = performance.now() - started;
      if (nextToggle < toggles.length && elapsed >= nextAt) {
        const { label } = toggles[nextToggle];
        const toggle = document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
        if (!toggle) throw new Error(`no toggle for ${label}`);
        toggle.click();
        nextToggle += 1;
        nextAt = elapsed + (toggles[nextToggle]?.afterMs ?? 0);
      }
      if (elapsed < duration) requestAnimationFrame(() => setTimeout(step, 0));
      else resolve(frames);
    };
    requestAnimationFrame(() => setTimeout(step, 0));
  }), {
    toggles,
    durationMs,
    points: {
      alpha: { x: CAMERA_CENTER.x + ALPHA.x, y: CAMERA_CENTER.y + ALPHA.y },
      beta: { x: CAMERA_CENTER.x + BETA.x, y: CAMERA_CENTER.y + BETA.y },
    },
  });
}

/**
 * Frames whose stage box is more than 4px away from the first sample, on either
 * axis: a panel edge changes the stage's width, the timeline's changes its
 * height, and both are real layout animations this spec has to observe.
 */
const movingFrames = (frames: Frame[]): Frame[] => frames.filter(
  (frame) => Math.abs(frame.stageWidth - frames[0].stageWidth) > 4
    || Math.abs(frame.stageHeight - frames[0].stageHeight) > 4,
);

function reportFrames(label: string, frames: Frame[]): void {
  const baseline = frames[0];
  const drift = frames.map((frame) => Math.max(
    Math.abs(frame.alpha.x - baseline.alpha.x),
    Math.abs(frame.alpha.y - baseline.alpha.y),
    Math.abs(frame.beta.x - baseline.beta.x),
    Math.abs(frame.beta.y - baseline.beta.y),
  ));
  const worst = Math.max(...drift);
  const zoomSpread = Math.max(...frames.map((frame) => Math.abs(frame.a - baseline.a)));
  if (label.startsWith('timeline')) {
    console.log(
      `[transition] ${label} | trace t:stageH:a:alphaX:betaY = `
      + frames.map((frame) => `${frame.t.toFixed(0)}:${frame.stageHeight.toFixed(0)}:${frame.a.toFixed(4)}:${frame.alpha.x.toFixed(2)}:${frame.beta.y.toFixed(2)}`).join(' '),
    );
  }
  console.log(
    `[transition] ${label} | frames=${frames.length} | animating=${movingFrames(frames).length} `
    + `| stage ${baseline.stageWidth.toFixed(1)}x${baseline.stageHeight.toFixed(1)}`
    + `->${frames[frames.length - 1].stageWidth.toFixed(1)}x${frames[frames.length - 1].stageHeight.toFixed(1)} `
    + `| worstDelta=${worst.toFixed(3)}px | magnificationSpread=${zoomSpread.toFixed(5)}`,
  );
}

/**
 * The invariant that matters: while the stage box animates, every sampled frame
 * must keep the authored world at the same client position and magnification.
 */
function expectStable(label: string, frames: Frame[]): void {
  expect(frames.length, `${label}: too few animation frames sampled`).toBeGreaterThanOrEqual(10);
  const animating = movingFrames(frames);
  expect(
    animating.length,
    `${label}: the stage box never animated during sampling — the transition was not observed`,
  ).toBeGreaterThanOrEqual(4);
  const baseline = frames[0];
  frames.forEach((frame, index) => {
    for (const key of ['alpha', 'beta'] as const) {
      expect(
        Math.abs(frame[key].x - baseline[key].x),
        `${label}: frame ${index} t=${frame.t.toFixed(1)}ms ${key} x drifted `
        + `${(frame[key].x - baseline[key].x).toFixed(3)}px (stage ${frame.stageWidth.toFixed(1)}px)`,
      ).toBeLessThanOrEqual(DRIFT_TOLERANCE_PX);
      expect(
        Math.abs(frame[key].y - baseline[key].y),
        `${label}: frame ${index} t=${frame.t.toFixed(1)}ms ${key} y drifted `
        + `${(frame[key].y - baseline[key].y).toFixed(3)}px (stage ${frame.stageWidth.toFixed(1)}px)`,
      ).toBeLessThanOrEqual(DRIFT_TOLERANCE_PX);
    }
    expect(
      Math.abs(frame.a - baseline.a),
      `${label}: frame ${index} t=${frame.t.toFixed(1)}ms magnification changed`,
    ).toBeLessThanOrEqual(MAGNIFICATION_TOLERANCE);
    expect(
      Math.abs(frame.d - baseline.d),
      `${label}: frame ${index} t=${frame.t.toFixed(1)}ms y-magnification changed`,
    ).toBeLessThanOrEqual(MAGNIFICATION_TOLERANCE);
    expect(frame.cameraZoom, `${label}: frame ${index} zoom changed`).toBe(baseline.cameraZoom);
  });
}

/**
 * The inspector's own edge EASES in one direction and never counter-moves: the
 * panel visited intermediate widths (it did not teleport to the target) and the
 * whole travel is monotone. The reversal case is deliberately excluded — a
 * mid-edge toggle is meant to reverse.
 */
function expectMonotonePanelEdge(label: string, frames: Frame[], direction: 'grow' | 'shrink'): void {
  const widths = frames.map((frame) => frame.inspectorWidth);
  const distinct = new Set(widths.map((width) => Math.round(width))).size;
  expect(distinct, `${label}: the panel edge teleported instead of easing`).toBeGreaterThanOrEqual(3);
  const travelled = Math.abs(widths[widths.length - 1] - widths[0]);
  expect(travelled, `${label}: the panel edge never moved`).toBeGreaterThan(80);
  for (let index = 1; index < widths.length; index += 1) {
    const step = widths[index] - widths[index - 1];
    const counter = direction === 'shrink' ? step > 0.5 : step < -0.5;
    expect(
      counter,
      `${label}: the panel edge counter-moved on frame ${index} by ${step.toFixed(2)}px`,
    ).toBe(false);
  }
}

test('the right inspector never counter-moves the world while it animates', async ({ page }) => {
  await seed(page);

  const hide = await sampleTransition(page, 'Hide Inspector');
  reportFrames('inspector hide', hide);
  expectStable('inspector hide', hide);
  expectMonotonePanelEdge('inspector hide', hide, 'shrink');
  await settle(page);

  const show = await sampleTransition(page, 'Show Inspector');
  reportFrames('inspector show', show);
  expectStable('inspector show', show);
  expectMonotonePanelEdge('inspector show', show, 'grow');
  await settle(page);
});

test('the left toolbar never counter-moves the world while it animates', async ({ page }) => {
  await seed(page);

  const hide = await sampleTransition(page, 'Hide Left Toolbar');
  reportFrames('left toolbar hide', hide);
  expectStable('left toolbar hide', hide);
  await settle(page);

  const show = await sampleTransition(page, 'Show Left Toolbar');
  reportFrames('left toolbar show', show);
  expectStable('left toolbar show', show);
  await settle(page);
});

test('repeated chrome toggles never drift the world on any frame', async ({ page }) => {
  await seed(page);

  const toggles = [
    'Hide Inspector', 'Hide Left Toolbar',
    'Show Inspector', 'Show Left Toolbar',
    'Hide Left Toolbar', 'Hide Inspector',
  ];
  for (const label of toggles) {
    const frames = await sampleTransition(page, label);
    reportFrames(`repeat ${label}`, frames);
    expectStable(`repeat ${label}`, frames);
    await settle(page);
  }
});

/**
 * R5-03 — the panel edge really eased: it visited intermediate heights and moved
 * in ONE direction the whole way (no bounce, no counter-motion, no delayed
 * correction), and the edge handle stayed pinned to that moving edge.
 */
function expectEasedEdge(label: string, frames: Frame[], direction: 'grow' | 'shrink'): void {
  const heights = frames.map((frame) => frame.timelineHeight);
  const distinct = new Set(heights.map((height) => Math.round(height))).size;
  expect(distinct, `${label}: the panel edge teleported instead of easing`).toBeGreaterThanOrEqual(3);
  const travelled = Math.abs(heights[heights.length - 1] - heights[0]);
  expect(travelled, `${label}: the panel edge never moved`).toBeGreaterThan(80);
  console.log(`[transition] ${label} | edge(px)=${heights.map((height) => height.toFixed(1)).join(',')}`);

  for (let index = 1; index < heights.length; index += 1) {
    const step = heights[index] - heights[index - 1];
    const counter = direction === 'shrink' ? step > 0.5 : step < -0.5;
    expect(
      counter,
      `${label}: the edge counter-moved on frame ${index} by ${step.toFixed(2)}px`,
    ).toBe(false);
  }

  frames.forEach((frame, index) => {
    expect(
      Math.abs(frame.handleCentreY - frame.panelTop),
      `${label}: the edge handle left the panel edge on frame ${index}`,
    ).toBeLessThanOrEqual(2);
  });
}

test('R5-03 — the timeline eases between collapsed and expanded without moving the world', async ({ page }) => {
  await seed(page);

  const collapse = await sampleTransition(page, 'Collapse timeline', 900);
  reportFrames('timeline collapse', collapse);
  expectStable('timeline collapse', collapse);
  expectEasedEdge('timeline collapse', collapse, 'shrink');
  await settle(page);
  const collapsedHeight = await page.evaluate(() => document.querySelector('.sequencer-timeline')!.getBoundingClientRect().height);
  expect(collapsedHeight.toFixed(1), 'the collapsed strip is not the header band').toBe('39.0');

  const expand = await sampleTransition(page, 'Expand timeline', 900);
  reportFrames('timeline expand', expand);
  expectStable('timeline expand', expand);
  expectEasedEdge('timeline expand', expand, 'grow');
  await settle(page);
  const expandedHeight = await page.evaluate(() => document.querySelector('.sequencer-timeline')!.getBoundingClientRect().height);
  expect(expandedHeight.toFixed(1), 'expanding did not restore the authored height').toBe('320.0');
});

/** The inspector's resting geometry: its border-box width and inline override. */
async function inspectorBox(page: Page): Promise<{ width: number; inlineWidth: string; inlineBasis: string }> {
  return page.evaluate(() => {
    const node = document.querySelector<HTMLElement>('.motion-design-right-sidebar')!;
    return {
      width: node.getBoundingClientRect().width,
      inlineWidth: node.style.width,
      inlineBasis: node.style.flexBasis,
    };
  });
}

/**
 * Toggles that land while the previous edge is still travelling. A reversal
 * returns the panel to the width it started from, so the sample has to carry the
 * excursion itself: each schedule below reverses twice (at 120ms and 320ms into
 * consecutive 240ms edges), which keeps several frames inside an excursion even
 * when a loaded page only paints a handful of frames across the window.
 */
test('mid-edge reversals of the inspector never drift the world', async ({ page }) => {
  await seed(page);

  const hideThenShowThenHide = await sampleTransition(page, [
    { at: 80, label: 'Hide Inspector' },
    { afterMs: 120, label: 'Show Inspector' },
    { afterMs: 200, label: 'Hide Inspector' },
  ], 1200);
  reportFrames('inspector reversals hide->show->hide', hideThenShowThenHide);
  expectStable('inspector reversals hide->show->hide', hideThenShowThenHide);
  await settle(page);
  expect((await inspectorBox(page)).width, 'the reversals did not land on the collapsed width').toBe(0);

  const showThenHideThenShow = await sampleTransition(page, [
    { at: 80, label: 'Show Inspector' },
    { afterMs: 120, label: 'Hide Inspector' },
    { afterMs: 200, label: 'Show Inspector' },
  ], 1200);
  reportFrames('inspector reversals show->hide->show', showThenHideThenShow);
  expectStable('inspector reversals show->hide->show', showThenHideThenShow);
  await settle(page);
  expect((await inspectorBox(page)).width, 'the reversals did not land on the docked width').toBeCloseTo(360, 1);
});

/**
 * The same contract at the viewport shapes that change the panel's docked width
 * (the `min(360px, max(250px, 34vw))` clamp) and the stage's room to crop: a
 * short window, a window narrow enough for the clamp to bite, and a wide one.
 * The panel's resting width must come back to exactly the stylesheet's value —
 * the ease leaves no inline override behind, and never a rounded copy of it.
 */
test('chrome transitions never drift the world on short, narrow or wide viewports', async ({ page }) => {
  const viewports = [
    { width: 1280, height: 620 },
    { width: 760, height: 700 },
    { width: 1920, height: 1080 },
  ];
  for (const viewport of viewports) {
    const label = `${viewport.width}x${viewport.height}`;
    await page.setViewportSize(viewport);
    await seed(page);
    await settle(page);
    const before = await inspectorBox(page);
    expect(before.inlineWidth, `${label}: the stylesheet must own the resting width`).toBe('');
    expect(before.inlineBasis, `${label}: the stylesheet must own the resting flex basis`).toBe('');
    if (viewport.width === 1280) expect(before.width, `${label}: docked width`).toBeCloseTo(360, 1);

    const hide = await sampleTransition(page, 'Hide Inspector');
    reportFrames(`inspector hide @${label}`, hide);
    expectStable(`inspector hide @${label}`, hide);
    expectMonotonePanelEdge(`inspector hide @${label}`, hide, 'shrink');
    await settle(page);
    expect((await inspectorBox(page)).width, `${label}: collapsed width`).toBe(0);

    const show = await sampleTransition(page, 'Show Inspector');
    reportFrames(`inspector show @${label}`, show);
    expectStable(`inspector show @${label}`, show);
    expectMonotonePanelEdge(`inspector show @${label}`, show, 'grow');
    await settle(page);

    const after = await inspectorBox(page);
    expect(after.inlineWidth, `${label}: the ease left an inline width behind`).toBe('');
    expect(after.width, `${label}: the docked width did not come back exactly`).toBeCloseTo(before.width, 2);
  }
});
