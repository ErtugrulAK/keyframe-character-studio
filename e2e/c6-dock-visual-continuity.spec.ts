/**
 * C6 — what a dock slide LOOKS like, frame by frame (a controlled clock drives
 * the editor's frame ease, so every frame is inspected, not sampled):
 * - the panel slides once: its edge moves monotonically, fully opaque, at its
 *   own width (content is never squeezed), and nothing moves after it settles
 *   (no second CSS fade / 12 px nudge, no rail flashing back at the edge);
 * - the edge handle rides the moving edge on every frame;
 * - the selected object keeps its screen position throughout;
 * - a reversal mid-slide continues from where the panel is, without a jump;
 * - a hidden panel takes neither focus nor pointer;
 * - reduced motion still snaps.
 * World stability under resize/rapid clicks is covered by c4-dock-slide and
 * camera-transition-stability.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const EMPTY = { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [] };
const FRAME_MS = 16;

/** A real mouse click on the handle where it is NOW (it may be moving with the edge). */
const clickHandleNow = async (page: Page, side: Side) => {
  const box = await page.locator(HANDLE[side]).boundingBox();
  if (!box) throw new Error('no handle');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

type Side = 'left' | 'right';
const PANEL: Record<Side, string> = { left: '.left-toolbar-container', right: '.motion-design-right-sidebar' };
const HANDLE: Record<Side, string> = { left: '.left-toolbar-toggle', right: '.inspector-dock-toggle' };
const LABEL: Record<Side, string> = { left: 'Left Toolbar', right: 'Inspector' };

async function open(page: Page, reducedMotion = false): Promise<void> {
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.clock.install();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  const layers = [{ id: 'box', name: 'Box', type: 'custom_rect', x: 300, y: 0, rotation: 0, scaleX: 2, scaleY: 2, opacity: 1, visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218', width: 120, height: 60 }];
  const scene = { version: 2, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers, tracks: [{ id: 'track-box', partId: 'box', name: 'Box', color: '#fff', visible: true, locked: false, channels: EMPTY }] };
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  // Freeze the page clock: from here on, frames advance ONLY through runFor.
  await page.clock.pauseAt(new Date(Date.now() + 2000));
  await page.clock.runFor(1000);
  await page.locator('[role="tree"] [data-layer-id="box"]').click();
  await page.clock.runFor(200);
}

const frame = (page: Page, side: Side) => page.evaluate(([panelSelector, handleSelector]) => {
  const panel = document.querySelector<HTMLElement>(panelSelector)!;
  const rect = panel.getBoundingClientRect();
  const handle = document.querySelector(handleSelector)!.getBoundingClientRect();
  const part = document.querySelector('.stage-svg g[data-part-id="box"]')!.getBoundingClientRect();
  const style = getComputedStyle(panel);
  return {
    left: rect.left,
    right: rect.right,
    width: rect.width,
    opacity: Number(style.opacity),
    visible: style.visibility !== 'hidden' && rect.width > 0 && rect.right > 0 && rect.left < window.innerWidth,
    handleCentre: handle.left + handle.width / 2,
    partX: part.left,
    partY: part.top,
    inlineTransform: panel.style.transform,
  };
}, [PANEL[side], HANDLE[side]] as const);

type Frame = Awaited<ReturnType<typeof frame>>;

/** Clicks the side's handle and records `count` frames of the slide. */
const slide = async (page: Page, side: Side, action: 'Hide' | 'Show', count = 24): Promise<Frame[]> => {
  await page.getByRole('button', { name: `${action} ${LABEL[side]}` }).click();
  const frames: Frame[] = [];
  for (let index = 0; index < count; index += 1) {
    frames.push(await frame(page, side));
    await page.clock.runFor(FRAME_MS);
  }
  return frames;
};

/** The panel's moving edge: the right edge of the left dock, the left edge of the right dock. */
const edgeOf = (side: Side, f: Frame) => (side === 'left' ? f.right : f.left);

const expectOneCleanSlide = (side: Side, action: 'Hide' | 'Show', frames: Frame[], before: Frame) => {
  const sliding = frames.filter((f) => f.visible);
  // Fully opaque, full width while it is on screen (never faded, never squeezed).
  for (const f of sliding) {
    expect(f.opacity, 'opacity while sliding').toBe(1);
    expect(Math.round(f.width), 'width while sliding').toBeGreaterThan(200);
  }
  // The edge moves one way only.
  const edges = sliding.map((f) => edgeOf(side, f));
  const outward = (side === 'left') === (action === 'Hide') ? -1 : 1;
  for (let index = 1; index < edges.length; index += 1) {
    expect((edges[index] - edges[index - 1]) * outward, `edge step ${index}`).toBeGreaterThanOrEqual(-0.5);
  }
  // The handle rides the edge on every frame: centred on an open edge and
  // flush with the window side when closed, so between those two rests it is
  // never more than half its own width (10 px) off the moving edge, and it
  // moves the same way as the edge.
  for (const f of sliding) expect(Math.abs(f.handleCentre - edgeOf(side, f)), 'handle off the edge').toBeLessThanOrEqual(10.5);
  const handles = frames.map((f) => f.handleCentre);
  for (let index = 1; index < handles.length; index += 1) {
    expect((handles[index] - handles[index - 1]) * outward, `handle step ${index}`).toBeGreaterThanOrEqual(-0.5);
  }
  // The selected object never moves on screen.
  for (const f of frames) {
    expect(Math.abs(f.partX - before.partX), 'object x').toBeLessThanOrEqual(0.5);
    expect(Math.abs(f.partY - before.partY), 'object y').toBeLessThanOrEqual(0.5);
  }
  // Settled: the last frames are identical and carry no travel transform.
  const tail = frames.slice(-6);
  for (const f of tail) {
    expect(f.inlineTransform).toBe('');
    expect(f).toEqual(tail[0]);
  }
  if (action === 'Hide') expect(tail[0].visible, 'nothing of the panel shows after it left').toBe(false);
};

for (const side of ['right', 'left'] as const) {
  test(`${side} dock: hide and show are each one clean slide with the handle on the edge`, async ({ page }) => {
    await open(page);
    const before = await frame(page, side);
    expectOneCleanSlide(side, 'Hide', await slide(page, side, 'Hide'), before);
    expectOneCleanSlide(side, 'Show', await slide(page, side, 'Show'), before);
    const after = await frame(page, side);
    expect([after.left, after.width]).toEqual([before.left, before.width]);
  });
}

test('a reversal mid-slide continues from where the panel is (no jump) and settles open', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Hide Inspector' }).click();
  await page.clock.runFor(FRAME_MS * 2);
  const previous = await frame(page, 'right');
  await page.clock.runFor(FRAME_MS);
  const midway = await frame(page, 'right');
  // One frame of the slide in flight: the most a reversal may still travel.
  const frameStep = Math.abs(midway.left - previous.left);
  expect(midway.left).toBeGreaterThan(1080);
  expect(midway.left).toBeLessThan(1430);
  // A user clicks the handle WHILE it moves: no wait for it to stop.
  await expect(page.getByRole('button', { name: 'Show Inspector' })).toBeVisible();
  await clickHandleNow(page, 'right');
  const next = await frame(page, 'right');
  expect(Math.abs(next.left - midway.left), 'no jump on reversal').toBeLessThanOrEqual(frameStep + 1);
  const frames: Frame[] = [];
  for (let index = 0; index < 24; index += 1) {
    await page.clock.runFor(FRAME_MS);
    frames.push(await frame(page, 'right'));
  }
  for (let index = 1; index < frames.length; index += 1) expect(frames[index].left).toBeLessThanOrEqual(frames[index - 1].left + 0.5);
  expect(frames.at(-1)!.inlineTransform).toBe('');
  await expect(page.getByRole('button', { name: 'Hide Inspector' })).toBeVisible();
  // Rapid toggles end in the last click's state, at rest.
  for (let index = 0; index < 5; index += 1) {
    await clickHandleNow(page, 'right');
    await page.clock.runFor(FRAME_MS * 2);
  }
  await page.clock.runFor(1000);
  await expect(page.getByRole('button', { name: 'Show Inspector' })).toBeVisible();
  const rest = await frame(page, 'right');
  expect(rest.visible).toBe(false);
  expect(rest.inlineTransform).toBe('');
});

test('a hidden dock takes neither focus nor pointer', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Hide Inspector' }).click();
  await page.clock.runFor(1000);
  const panel = page.locator('#right-inspector-panel');
  await expect(panel).toHaveAttribute('inert', '');
  await expect(panel).toHaveAttribute('aria-hidden', 'true');
  // Tabbing through the whole page never lands inside it.
  for (let index = 0; index < 60; index += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('#right-inspector-panel')))).toBe(false);
  }
  // A press where it used to be reaches the stage, not the panel.
  const hit = await page.evaluate(() => document.elementFromPoint(window.innerWidth - 60, 300)?.closest('#right-inspector-panel') !== null);
  expect(hit).toBe(false);
});

test('reduced motion: the dock snaps, with no slide frames', async ({ page }) => {
  await open(page, true);
  await page.getByRole('button', { name: 'Hide Inspector' }).click();
  const first = await frame(page, 'right');
  expect(first.visible).toBe(false);
  expect(first.inlineTransform).toBe('');
  await page.getByRole('button', { name: 'Show Inspector' }).click();
  const shown = await frame(page, 'right');
  expect(shown.visible).toBe(true);
  expect(shown.inlineTransform).toBe('');
});
