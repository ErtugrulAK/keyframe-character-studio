import { test, expect } from '@playwright/test';

/**
 * Manual QA (rc.6 review): with more tracks than the timeline shows, the
 * playhead line stopped at the visible height and the lower lanes scrolled into
 * view without it. The line must reach the last lane, and the frame badge must
 * stay on the ruler, which stays put while the lanes scroll.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const LAYER_COUNT = 30;

const emptyChannels = {
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
};

const scene = JSON.stringify({
  version: 1, coordinateSystem: 'project-unit-center-v1',
  width: 1920, height: 1080, fps: 30, totalFrames: 60,
  layers: Array.from({ length: LAYER_COUNT }, (_, index) => ({
    id: `layer-${index}`, name: `Layer ${index}`, type: 'custom_rect', x: 0, y: 0, rotation: 0,
    scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: index + 1,
    fillColor: '#22d3ee', strokeColor: '#101218', width: 60, height: 40,
  })),
  tracks: Array.from({ length: LAYER_COUNT }, (_, index) => ({
    id: `track-${index}`, partId: `layer-${index}`, name: `Layer ${index}`, color: '#22d3ee',
    visible: true, locked: false, expanded: false, channels: emptyChannels,
  })),
});

test('the playhead line reaches the last lane of a scrolled timeline', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript((payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value), { key: STORAGE_KEY, value: scene });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

  const grid = page.locator('.timeline-grid-container');
  // The scene must overflow the pane, or there is nothing to scroll.
  await expect.poll(() => grid.evaluate((element) => element.scrollHeight > element.clientHeight + 100)).toBe(true);
  await grid.evaluate((element) => { element.scrollTop = element.scrollHeight; });

  const measured = await page.evaluate(() => {
    const line = document.querySelector('.playhead-line')!.getBoundingClientRect();
    const head = document.querySelector('.playhead-head')!.getBoundingClientRect();
    const ruler = document.querySelector('.time-ruler')!.getBoundingClientRect();
    const lanes = document.querySelector('.ue-track-lanes')!.getBoundingClientRect();
    return { lineBottom: line.bottom, lanesBottom: lanes.bottom, headTop: head.top, rulerTop: ruler.top };
  });

  expect(measured.lineBottom, 'the line stops above the last lane').toBeGreaterThanOrEqual(measured.lanesBottom - 1);
  expect(Math.abs(measured.headTop - measured.rulerTop), 'the frame badge left the ruler').toBeLessThanOrEqual(1);
});
