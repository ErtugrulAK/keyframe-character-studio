/**
 * C7c — showing or hiding a dock or the timeline changes only the usable view
 * area. On EVERY animation frame (a paused page clock steps the editor's frame
 * ease), fixed world points keep their screen position within 1 CSS px, the
 * axes, artboard and shapes stay aligned with them, a pointer at a shape still
 * hits that shape, and scene data, selection and undo history do not change.
 * Comparing only the before and after positions is not enough: a jump in the
 * middle that returns by the end fails here.
 *
 * Run at a normal and a narrow window, at a 200 % device scale (what a 200 %
 * browser zoom gives a 1440×900 window: a 720×450 CSS viewport at 2 device px
 * per CSS px) and with reduced motion, which once kept the camera's previous
 * translation for 2–3 frames (a global 0.01 ms transition) — a 360 px jump.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const EMPTY = { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [] };
const FRAME_MS = 16;
const TOLERANCE_PX = 1;

type Panel = 'right' | 'left' | 'timeline';
const LABELS: Record<Panel, [string, string]> = {
  right: ['Hide Inspector', 'Show Inspector'],
  left: ['Hide Left Toolbar', 'Show Left Toolbar'],
  timeline: ['Collapse timeline', 'Expand timeline'],
};

interface Sample {
  origin: [number, number];
  far: [number, number];
  centre: number[] | null;
  off: number[] | null;
  artboard: number[] | null;
  axisY: number | null;
  axisX: number | null;
  hit: string;
}

async function open(page: Page, viewport: { width: number; height: number }, reducedMotion: boolean): Promise<void> {
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.clock.install();
  await page.setViewportSize(viewport);
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  const layers = [
    { id: 'centre', name: 'Centre', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218', width: 120, height: 80 },
    { id: 'off', name: 'Off', type: 'custom_circle', x: -260, y: 150, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, fillColor: '#f43f5e', strokeColor: '#101218', width: 100, height: 100 },
  ];
  const scene = { version: 2, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers, tracks: layers.map((layer) => ({ id: `track-${layer.id}`, partId: layer.id, name: layer.name, color: '#fff', visible: true, locked: false, channels: EMPTY })) };
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.clock.pauseAt(new Date(Date.now() + 2000));
  await page.clock.runFor(1500);
  await page.locator('[role="tree"] [data-layer-id="centre"]').click();
  // Snapping off: the drag checks measure the pointer → world mapping, not the
  // smart guides (a drag that ends near an axis or an edge would snap to it).
  const snapping = page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name: 'Toggle snapping' });
  if (await snapping.isVisible()) {
    if (await snapping.getAttribute('aria-pressed') === 'true') await snapping.click();
  } else {
    // A narrow toolbar keeps it in the View menu (snapping starts on).
    await page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name: /^View/ }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Toggle snapping' }).or(page.getByRole('menuitem', { name: 'Toggle snapping' })).click();
  }
  await page.clock.runFor(200);
}

const sample = (page: Page): Promise<Sample> => page.evaluate(() => {
  const svg = document.querySelector('.stage-svg') as SVGSVGElement;
  const matrix = svg.getScreenCTM()!;
  const project = (x: number, y: number): [number, number] => {
    const point = new DOMPoint(x, y).matrixTransform(matrix);
    return [point.x, point.y];
  };
  const box = (selector: string) => {
    const node = document.querySelector(selector);
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return [rect.left, rect.top, rect.width, rect.height];
  };
  const off = document.querySelector('.stage-svg g[data-part-id="off"]')!.getBoundingClientRect();
  const hx = off.left + off.width / 2;
  const hy = off.top + off.height / 2;
  const covered = [...document.querySelectorAll('.motion-design-right-sidebar, .left-toolbar-container, [data-testid="sequencer-timeline"]')]
    .some((node) => { const rect = node.getBoundingClientRect(); return rect.width > 0 && hx >= rect.left && hx <= rect.right && hy >= rect.top && hy <= rect.bottom; });
  const hitNode = covered ? null : document.elementFromPoint(hx, hy);
  return {
    // The world origin (camera centre) and a point far from it.
    origin: project(300, 240),
    far: project(1000, -140),
    centre: box('.stage-svg g[data-part-id="centre"]'),
    off: box('.stage-svg g[data-part-id="off"]'),
    artboard: box('.stage-svg rect.canvas-bg'),
    axisY: document.querySelector('.canvas-coordinate-axis-x')?.getBoundingClientRect().top ?? null,
    axisX: document.querySelector('.canvas-coordinate-axis-y')?.getBoundingClientRect().left ?? null,
    hit: covered ? 'covered' : hitNode?.closest('[data-part-id]')?.getAttribute('data-part-id') ?? hitNode?.tagName ?? 'none',
  };
});

const drift = (now: Sample, start: Sample): number => {
  const pairs: [number[] | number | null, number[] | number | null][] = [
    [now.origin, start.origin], [now.far, start.far], [now.centre, start.centre], [now.off, start.off],
    [now.artboard, start.artboard], [now.axisY, start.axisY], [now.axisX, start.axisX],
  ];
  let worst = 0;
  for (const [a, b] of pairs) {
    const left = Array.isArray(a) ? a : [a ?? Number.NaN];
    const right = Array.isArray(b) ? b : [b ?? Number.NaN];
    left.forEach((value, index) => { worst = Math.max(worst, Math.abs(value - right[index])); });
  }
  return worst;
};

const toggle = async (page: Page, panel: Panel) => {
  for (const label of LABELS[panel]) {
    const button = page.getByRole('button', { name: label, exact: true });
    if (await button.count()) { await button.click(); return; }
  }
  throw new Error(`no ${panel} toggle`);
};

const sceneSnapshot = (page: Page) => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

const centreBox = (page: Page) => page.locator('.stage-svg g[data-part-id="centre"]').evaluate((node) => {
  const rect = node.getBoundingClientRect();
  return [rect.left, rect.top, rect.width, rect.height];
});

/** Drags the centre shape by (dx, dy) screen px with the real pointer. */
async function dragCentre(page: Page, dx: number, dy: number) {
  const [left, top, width, height] = await centreBox(page);
  const x = left + width / 2;
  const y = top + height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 5; step += 1) {
    await page.mouse.move(x + (dx * step) / 5, y + (dy * step) / 5);
    await page.clock.runFor(FRAME_MS);
  }
  await page.mouse.up();
  await page.clock.runFor(100);
}

/** Runs the steps, sampling right after each click and on every frame after it. */
async function expectStable(page: Page, steps: [Panel, number][]) {
  // One real edit first (a drag of the selected shape), so the history has a
  // known top entry; after the toggles a single Undo must take back exactly it.
  const beforeEdit = await centreBox(page);
  await dragCentre(page, 30, 12);
  const afterEdit = await centreBox(page);
  // The shape follows the pointer within the acceptance tolerance.
  const tolerance = TOLERANCE_PX;
  expect(Math.abs(afterEdit[0] - beforeEdit[0] - 30)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(afterEdit[1] - beforeEdit[1] - 12)).toBeLessThanOrEqual(tolerance);
  const start = await sample(page);
  const sceneBefore = await sceneSnapshot(page);
  const failures: string[] = [];
  let frame = 0;
  for (const [panel, frames] of steps) {
    await toggle(page, panel);
    for (let index = 0; index <= frames; index += 1) {
      const now = await sample(page);
      const worst = drift(now, start);
      if (!(worst <= TOLERANCE_PX)) failures.push(`frame ${frame} (${panel}): world moved ${worst.toFixed(2)} px`);
      if (now.hit !== 'off' && now.hit !== 'covered') failures.push(`frame ${frame} (${panel}): pointer at the shape hit ${now.hit}`);
      frame += 1;
      await page.clock.runFor(FRAME_MS);
    }
  }
  expect(failures, failures.slice(0, 8).join('\n')).toEqual([]);
  // Viewing changes nothing: scene, selection, history.
  expect(await sceneSnapshot(page)).toBe(sceneBefore);
  await expect(page.locator('[role="tree"] [data-layer-id="centre"]')).toHaveAttribute('aria-selected', 'true');
  // Drag coordinates are still right after the panels moved: the shape
  // follows the pointer by exactly the dragged distance.
  await dragCentre(page, -20, 16);
  const afterSecond = await centreBox(page);
  expect(Math.abs(afterSecond[0] - afterEdit[0] + 20)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(afterSecond[1] - afterEdit[1] - 16)).toBeLessThanOrEqual(tolerance);
  // No history entry was added by the toggles: two Undos take back exactly the two drags.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Control+z');
  await page.clock.runFor(100);
  const undoneOnce = await centreBox(page);
  expect(Math.abs(undoneOnce[0] - afterEdit[0])).toBeLessThan(0.01);
  expect(Math.abs(undoneOnce[1] - afterEdit[1])).toBeLessThan(0.01);
  await page.keyboard.press('Control+z');
  await page.clock.runFor(100);
  const undoneTwice = await centreBox(page);
  expect(Math.abs(undoneTwice[0] - beforeEdit[0])).toBeLessThan(0.01);
  expect(Math.abs(undoneTwice[1] - beforeEdit[1])).toBeLessThan(0.01);
}

const CONDITIONS = [
  { name: 'normal window', viewport: { width: 1440, height: 900 }, reducedMotion: false },
  { name: 'narrow window', viewport: { width: 1024, height: 720 }, reducedMotion: false },
  { name: 'reduced motion', viewport: { width: 1440, height: 900 }, reducedMotion: true },
  { name: 'reduced motion, narrow window', viewport: { width: 1024, height: 720 }, reducedMotion: true },
];

for (const condition of CONDITIONS) {
  test.describe(`C7c — world stays put while panels move (${condition.name})`, () => {
    for (const panel of ['right', 'left', 'timeline'] as const) {
      test(`${panel}: hide and show`, async ({ page }) => {
        await open(page, condition.viewport, condition.reducedMotion);
        await expectStable(page, [[panel, 30], [panel, 30]]);
      });
    }
    test('rapid repeats and reversals mid-slide', async ({ page }) => {
      await open(page, condition.viewport, condition.reducedMotion);
      await expectStable(page, [['right', 5], ['right', 3], ['right', 2], ['left', 4], ['timeline', 6], ['left', 3], ['timeline', 3], ['right', 30]]);
    });
  });
}

test.describe('C7c — 200 % device scale (a 200 % browser zoom of a 1440×900 window)', () => {
  test.use({ deviceScaleFactor: 2 });
  for (const reducedMotion of [false, true]) {
    test(`all panels${reducedMotion ? ', reduced motion' : ''}`, async ({ page }) => {
      await open(page, { width: 720, height: 450 }, reducedMotion);
      await expectStable(page, [['right', 30], ['right', 30], ['left', 30], ['left', 30], ['timeline', 30], ['timeline', 30]]);
    });
  }
});

test('C7c — after a zoom and a pan, toggles are not a pan or zoom', async ({ page }) => {
  await open(page, { width: 1440, height: 900 }, false);
  const tool = (name: string) => page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name });
  await tool('Zoom out').click();
  await tool('Zoom out').click();
  await tool('Pan').click();
  const stage = (await page.locator('.stage-canvas-container').boundingBox())!;
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 6; step += 1) {
    await page.mouse.move(stage.x + stage.width / 2 + step * 9.7, stage.y + stage.height / 2 - step * 5.3);
    await page.clock.runFor(FRAME_MS);
  }
  await page.mouse.up();
  await tool('Select').click();
  await page.locator('[role="tree"] [data-layer-id="centre"]').click();
  await page.clock.runFor(200);
  const zoom = await page.locator('.stage-canvas-container').getAttribute('data-camera-zoom');
  await expectStable(page, [['right', 30], ['right', 30], ['left', 30], ['left', 30], ['timeline', 30], ['timeline', 30]]);
  // No automatic fit or recentre: the camera's zoom is the user's.
  expect(await page.locator('.stage-canvas-container').getAttribute('data-camera-zoom')).toBe(zoom);
});
