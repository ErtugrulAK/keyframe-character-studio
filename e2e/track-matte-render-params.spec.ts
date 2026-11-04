import { test, expect, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

/**
 * Manual QA (rc.6 round 2, item 7): the Track Matte took over the legacy
 * matte's soft edge, strength and gradient. The stage draws them through the
 * same mask pipeline the legacy matte uses.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const shape = (id: string, name: string, type: string, extra: Record<string, unknown> = {}) => ({
  id, name, type, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218',
  fillEnabled: true, strokeEnabled: false, width: 300, height: 200, ...extra,
});

async function seed(page: Page, trackMatte: Record<string, unknown>) {
  const layers = [
    shape('src', 'Circle', 'custom_circle', { zIndex: 2, width: 160, height: 160 }),
    shape('tgt', 'Box', 'custom_rect', { zIndex: 1, trackMatte: { sourceLayerId: 'src', mode: 'alpha', ...trackMatte } }),
  ];
  const scene = {
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers, tracks: layers.map((layer) => ({ partId: layer.id, channels: {} })),
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([key, value]: [string, string]) => localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(scene)]);
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

/** The mask the target layer is painted through, with what it is made of. */
const targetMask = (page: Page) => page.evaluate(() => {
  const masked = document.querySelector('.stage-canvas-container [data-part-id="tgt"] [mask], .stage-canvas-container [data-part-id="tgt"][mask]');
  const ref = masked?.getAttribute('mask') ?? '';
  const id = /url\(#(.+)\)/.exec(ref)?.[1];
  const mask = id ? document.getElementById(id) : null;
  const filterRef = mask?.querySelector('[filter]')?.getAttribute('filter') ?? '';
  const filterId = /url\(#(.+)\)/.exec(filterRef)?.[1];
  return {
    id: id ?? null,
    blur: filterId ? document.getElementById(filterId)?.querySelector('feGaussianBlur')?.getAttribute('stdDeviation') ?? null : null,
    gradientFill: mask ? [...mask.querySelectorAll('[fill^="url("]')].length > 0 : false,
  };
});

test('a Track Matte draws its feather and gradient', async ({ page }) => {
  await seed(page, { feather: 10, gradient: { angle: 90 } });
  const mask = await targetMask(page);
  expect(mask.id).toContain('-f10');
  expect(mask.blur).toBe('5');
  expect(mask.gradientFill).toBe(true);
});

test('a plain Track Matte stays a plain mask', async ({ page }) => {
  await seed(page, {});
  const mask = await targetMask(page);
  expect(mask.id).not.toBeNull();
  expect(mask.id).not.toContain('-f');
  expect(mask.blur).toBeNull();
  expect(mask.gradientFill).toBe(false);
});

test('Ctrl+Z undoes a matte slider change while the slider still has focus (QA rc6 round 3, item 2)', async ({ page }) => {
  await seed(page, {});
  await page.locator('[role="tree"] [data-layer-id="tgt"]').click();
  await openDetailsTab(page, 'Masks');
  const expand = page.getByRole('button', { name: 'Expand TRACK MATTE', exact: true });
  if (await expand.count()) await expand.click();
  const feather = page.getByRole('slider', { name: 'Feather' });
  await feather.focus();
  await feather.press('ArrowRight');
  await feather.press('ArrowRight');
  await expect(feather).toHaveValue('2');
  await expect(feather).toBeFocused();
  await page.keyboard.press('Control+z');
  await expect(feather).not.toHaveValue('2');
  await page.keyboard.press('Control+z');
  await expect(feather).toHaveValue('0');
  await page.keyboard.press('Control+y');
  await expect(feather).not.toHaveValue('0');
});
