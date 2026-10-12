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
  zoomLabel: string;
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
 * Sample the world points on every PAINTED frame, starting a few frames BEFORE
 * the toggle and ending once the layout has settled past `durationMs`.
 *
 * The sample is taken from a task scheduled after the frame's resize-observer
 * step (rAF → setTimeout 0), which is the only place that reads exactly the
 * values the user saw: a plain rAF callback runs *before* the stage measures its
 * new box, so it would report the previous frame's transform and invent drift.
 * The page drives the click itself so the transition cannot start between a
 * Playwright round trip and the first sample.
 */
async function sampleTransition(page: Page, toggleLabel: string, durationMs = 600): Promise<Frame[]> {
  return page.evaluate(({ toggleLabel: label, durationMs: duration, points }) => new Promise<Frame[]>((resolve) => {
    const svg = document.querySelector<SVGSVGElement>('.stage-svg');
    const stage = document.querySelector('.stage-canvas-container');
    if (!svg || !stage) throw new Error('camera surface unavailable');
    const frames: Frame[] = [];
    const started = performance.now();
    let clicked = false;
    const step = () => {
      const matrix = svg.getScreenCTM();
      if (!matrix) throw new Error('screen CTM unavailable');
      const project = (point: { x: number; y: number }) => {
        const projected = new DOMPoint(point.x, point.y).matrixTransform(matrix);
        return { x: projected.x, y: projected.y };
      };
      const stageBox = stage.getBoundingClientRect();
      frames.push({
        t: performance.now() - started,
        alpha: project(points.alpha),
        beta: project(points.beta),
        a: matrix.a,
        d: matrix.d,
        stageLeft: stageBox.left,
        stageWidth: stageBox.width,
        stageHeight: stageBox.height,
        zoomLabel: document.querySelector('.zoom-level-text')?.textContent?.trim() ?? '',
      });
      const elapsed = performance.now() - started;
      if (!clicked && elapsed >= 80) {
        const toggle = document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
        if (!toggle) throw new Error(`no toggle for ${label}`);
        toggle.click();
        clicked = true;
      }
      if (elapsed < duration) requestAnimationFrame(() => setTimeout(step, 0));
      else resolve(frames);
    };
    requestAnimationFrame(() => setTimeout(step, 0));
  }), {
    toggleLabel,
    durationMs,
    points: {
      alpha: { x: CAMERA_CENTER.x + ALPHA.x, y: CAMERA_CENTER.y + ALPHA.y },
      beta: { x: CAMERA_CENTER.x + BETA.x, y: CAMERA_CENTER.y + BETA.y },
    },
  });
}

/** Frames whose stage box is more than 4px away from the first sample. */
const movingFrames = (frames: Frame[]): Frame[] => frames.filter(
  (frame) => Math.abs(frame.stageWidth - frames[0].stageWidth) > 4,
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
  console.log(
    `[transition] ${label} | frames=${frames.length} | animating=${movingFrames(frames).length} `
    + `| stage ${baseline.stageWidth.toFixed(1)}->${frames[frames.length - 1].stageWidth.toFixed(1)} `
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
    expect(frame.zoomLabel, `${label}: frame ${index} zoom label changed`).toBe(baseline.zoomLabel);
  });
}

test('the right inspector never counter-moves the world while it animates', async ({ page }) => {
  await seed(page);

  const hide = await sampleTransition(page, 'Hide Inspector');
  reportFrames('inspector hide', hide);
  expectStable('inspector hide', hide);
  await settle(page);

  const show = await sampleTransition(page, 'Show Inspector');
  reportFrames('inspector show', show);
  expectStable('inspector show', show);
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
