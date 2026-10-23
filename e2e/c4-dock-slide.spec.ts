/**
 * C4 — the dock slide under stress: a window resize WHILE the dock travels and a
 * burst of rapid clicks must both end exactly where the same steps end when
 * taken one at a time, at rest — same world position, same magnification, the
 * user's zoom kept, no travel style left on the panel.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const EMPTY = { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [], trimPathStart: [], trimPathEnd: [], trimPathOffset: [] };

async function open(page: Page): Promise<void> {
  const layers = [
    { id: 'alpha', name: 'Alpha', type: 'custom_rect', x: -120, y: -60, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218', width: 160, height: 120 },
    { id: 'beta', name: 'Beta', type: 'custom_rect', x: 140, y: 90, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, fillColor: '#f97316', strokeColor: '#101218', width: 160, height: 120 },
  ];
  const scene = { version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers, tracks: layers.map((layer) => ({ partId: layer.id, channels: EMPTY })) };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  // A user camera: zoomed in twice (the viewport command the shortcuts use).
  for (let index = 0; index < 2; index += 1) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('canvas-viewport-command', { detail: { type: 'zoom-in' } })));
  }
}

/** Both docks are at rest: no travel style on either panel. */
const settled = (page: Page) => expect.poll(() => page.evaluate(() => ['#left-toolbar-panel', '#right-inspector-panel'].every((selector) => {
  const node = document.querySelector<HTMLElement>(selector);
  return !node || (node.style.position === '' && node.style.transform === '' && node.style.width === '');
}))).toBe(true);

const pose = (page: Page) => page.evaluate(() => {
  const centre = (id: string) => {
    const box = document.querySelector(`.stage-svg g[data-part-id="${id}"]`)!.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  };
  const svg = document.querySelector('.stage-svg') as SVGSVGElement;
  return { alpha: centre('alpha'), beta: centre('beta'), scale: svg.getScreenCTM()?.a ?? 0 };
});

const expectSamePose = (actual: Awaited<ReturnType<typeof pose>>, expected: Awaited<ReturnType<typeof pose>>, label: string) => {
  for (const key of ['alpha', 'beta'] as const) {
    expect(Math.abs(actual[key].x - expected[key].x), `${label}: ${key} x`).toBeLessThan(1);
    expect(Math.abs(actual[key].y - expected[key].y), `${label}: ${key} y`).toBeLessThan(1);
  }
  expect(Math.abs(actual.scale - expected.scale), `${label}: magnification`).toBeLessThan(0.002);
};

const inspectorToggle = (page: Page) => page.locator('.inspector-dock-toggle');

type Step = 'toggle' | 'toggle-mid' | 'resize';

/**
 * Fresh scene (optionally with the Inspector hidden first), then the steps:
 * 'toggle' waits until the dock is at rest, 'toggle-mid' only 60 ms (the
 * dock is still travelling when the next step runs).
 */
async function run(page: Page, startHidden: boolean, steps: Step[]) {
  await open(page);
  if (startHidden) {
    await inspectorToggle(page).click();
    await settled(page);
  }
  for (const step of steps) {
    if (step === 'resize') {
      await page.setViewportSize({ width: 1180, height: 820 });
      await settled(page);
      await page.waitForTimeout(200);
    } else {
      await inspectorToggle(page).click();
      if (step === 'toggle-mid') await page.waitForTimeout(60);
      else await settled(page);
    }
  }
  await settled(page);
  await page.waitForTimeout(200);
  await expect(inspectorToggle(page)).toHaveAttribute('aria-expanded', startHidden ? 'true' : 'false');
  return pose(page);
}

/*
 * The contract: a window resize applies to the stage box the editor has AT
 * THAT MOMENT. A hiding dock leaves the row when it starts sliding (the stage
 * already has its new box), so a resize mid-slide equals hide-then-resize. A
 * showing dock enters the row only when it lands (the stage keeps its old box
 * until then), so a resize mid-slide equals resize-then-show. Either way the
 * world never jumps and nothing is left half-travelled.
 */
test('a window resize while the Inspector slides ends like the same steps taken at rest', async ({ page }) => {
  const hideThenResize = await run(page, false, ['toggle', 'resize']);
  expectSamePose(await run(page, false, ['toggle-mid', 'resize']), hideThenResize, 'resize mid-slide (hide)');
  const resizeThenShow = await run(page, true, ['resize', 'toggle']);
  expectSamePose(await run(page, true, ['toggle-mid', 'resize']), resizeThenShow, 'resize mid-slide (show)');
});

test('a burst of rapid clicks on both docks ends in the state of the last click, with the world unmoved', async ({ page }) => {
  await open(page);
  const start = await pose(page);
  const left = page.locator('.left-toolbar-toggle');
  // Five clicks each, faster than the slide: odd → both end hidden.
  for (let index = 0; index < 5; index += 1) {
    await inspectorToggle(page).click({ delay: 0 });
    await left.click({ delay: 0 });
  }
  await settled(page);
  await expect(inspectorToggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(left).toHaveAttribute('aria-expanded', 'false');
  expectSamePose(await pose(page), start, 'rapid clicks');
  // One more each brings both back, still without moving the world.
  await inspectorToggle(page).click();
  await left.click();
  await settled(page);
  expectSamePose(await pose(page), start, 'rapid clicks, back');
  await expect(page.locator('#right-inspector-panel')).toBeVisible();
});
