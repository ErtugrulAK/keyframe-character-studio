import { test, expect } from '@playwright/test';

/**
 * U1 — the timeline ruler is a keyboard playhead slider. The pointer scrub and
 * the keyboard seek must land the playhead in the same places; this spec walks
 * the keyboard contract against the rendered playhead, not component internals.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const seed = async (page: import('@playwright/test').Page): Promise<void> => {
  const scene = JSON.stringify({
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    width: 320, height: 180, fps: 24, totalFrames: 12,
    layers: [{ id: 'mover', name: 'Mover', type: 'custom_rect', x: -100, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#ff0000', strokeColor: '#000', strokeEnabled: false, fillEnabled: true, width: 40, height: 40 }],
    tracks: [{ id: 'track-mover', partId: 'mover', name: 'Mover', color: '#fff', visible: true, locked: false, channels: { x: [{ id: 'kx1', frame: 0, value: -100, easing: 'linear' }, { id: 'kx2', frame: 11, value: 100, easing: 'linear' }] } }],
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript((p: { key: string; value: string }) => localStorage.setItem(p.key, p.value), { key: STORAGE_KEY, value: scene });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible();
};

const playheadFrame = (page: import('@playwright/test').Page) =>
  page.locator('.playhead-line').getAttribute('data-frame');

test('the ruler takes keyboard focus and exposes the playhead value', async ({ page }) => {
  await seed(page);
  const ruler = page.getByRole('slider', { name: 'Playhead position' });
  await expect(ruler).toHaveAttribute('aria-valuemin', '0');
  await expect(ruler).toHaveAttribute('aria-valuemax', '12');
  await ruler.focus();
  await expect(ruler).toHaveAttribute('aria-valuenow', '0');
});

test('arrows step frames, shift steps tens, Home and End jump to the ends', async ({ page }) => {
  await seed(page);
  const ruler = page.getByRole('slider', { name: 'Playhead position' });
  await ruler.focus();

  await page.keyboard.press('ArrowRight');
  await expect(ruler).toHaveAttribute('aria-valuenow', '1');
  expect(await playheadFrame(page)).toBe('1');

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  expect(await playheadFrame(page)).toBe('1');

  await page.keyboard.press('Shift+ArrowRight');
  expect(await playheadFrame(page)).toBe('11');

  await page.keyboard.press('End');
  expect(await playheadFrame(page)).toBe('12');

  await page.keyboard.press('Home');
  expect(await playheadFrame(page)).toBe('0');

  // The value never leaves the legal range at the edges.
  await page.keyboard.press('ArrowLeft');
  expect(await playheadFrame(page)).toBe('0');
});

test('a keyboard seek re-evaluates the stage exactly like the playhead', async ({ page }) => {
  await seed(page);
  const ruler = page.getByRole('slider', { name: 'Playhead position' });
  const moverLeft = () => page.evaluate(() => {
    const node = document.querySelector('.stage-svg [data-part-id="mover"]');
    if (!node) throw new Error('mover part node not rendered');
    return Math.round(node.getBoundingClientRect().left);
  });
  const atZero = await moverLeft();
  await ruler.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect(await page.locator('.playhead-line').getAttribute('data-frame')).toBe('2');
  // The Mover animates x across the sequence, so frame 2 must paint elsewhere
  // than frame 0 — the seek reaches the real evaluation pipeline.
  expect(await moverLeft()).toBeGreaterThan(atZero + 10);
});
