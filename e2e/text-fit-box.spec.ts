import { test, expect, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

/**
 * A shape that follows its text (user request, 2026-11-03): the bar hugs short
 * text, grows with it up to its max width, then the text shrinks instead of
 * leaving the bar. Bound through the Inspector; kept across a reload.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const layer = (id: string, name: string, extra: Record<string, unknown>) => ({
  id, name, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  strokeColor: '#101218', ...extra,
});

async function seed(page: Page) {
  const scene = {
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 30,
    layers: [
      layer('bar', 'Bar', { type: 'custom_rect', fillColor: '#2563eb', scaleX: 8, scaleY: 1.6, zIndex: 1 }),
      layer('title', 'Title', { type: 'custom_text', textValue: 'Hi', fontSize: 72, fillColor: '#ffffff', textOrigin: 'center', zIndex: 2 }),
    ],
    tracks: [],
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([key, value]: [string, string]) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem(key, value);
      sessionStorage.setItem('seeded', '1');
    }
  }, [STORAGE_KEY, JSON.stringify(scene)]);
  await page.goto('/');
  await expect(page.locator('[data-part-id="title"]').first()).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
}

/** Stage widths in screen pixels, and the stage zoom (bar's authored 960 px scene width). */
const widths = (page: Page) => page.evaluate(() => {
  const box = (id: string) => document.querySelector(`.stage-canvas-container [data-part-id="${id}"]`)!.getBoundingClientRect();
  return { bar: box('bar').width, text: box('title').width };
});

const select = (page: Page, name: string) => page.locator('.actor-node', { has: page.locator('.actor-name', { hasText: name }) }).first().click();

const expandCard = async (page: Page, title: string) => {
  const expand = page.getByRole('button', { name: `Expand ${title}`, exact: true });
  if (await expand.count()) await expand.click();
};

test('a bar bound to a text hugs it, stops at its max width, and the text shrinks', async ({ page }) => {
  await seed(page);
  const before = await widths(page);
  const zoom = before.bar / 960; // the bar is 8 x 120 = 960 scene px wide before binding

  // Bind the bar to the title: its max width is today's 960 px.
  await select(page, 'Bar');
  await openDetailsTab(page, 'Properties');
  await expandCard(page, 'FIT TO TEXT');
  await page.getByLabel('Fit to text layer').selectOption('title');
  await expect.poll(async () => (await widths(page)).bar).toBeLessThan(before.bar / 2);
  // Short text: the bar is the text plus 24 px on each side.
  const short = await widths(page);
  expect(Math.abs(short.bar - (short.text + 48 * zoom))).toBeLessThan(12 * zoom);

  // A long text: the bar stops at 960 px and the text stays inside it.
  await select(page, 'Title');
  await expandCard(page, 'TEXT');
  await page.locator('.text-content-control').fill('A very long headline that keeps going and going far beyond the bar');
  await expect.poll(async () => Math.round((await widths(page)).bar / zoom)).toBe(960);
  const long = await widths(page);
  expect(long.text).toBeLessThanOrEqual(long.bar - 40 * zoom);
  const fontSize = await page.locator('.stage-canvas-container [data-part-id="title"] text').first().getAttribute('font-size');
  expect(Number(fontSize)).toBeLessThan(72);
  expect(Number(fontSize)).toBeGreaterThanOrEqual(36);

  // The binding and the text are saved: a reload draws the same.
  await expect(page.locator('.autosave-status-badge')).toHaveAttribute('data-save-state', 'saved', { timeout: 15000 });
  await page.reload();
  await expect(page.locator('[data-part-id="title"]').first()).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => Math.round((await widths(page)).bar / zoom)).toBe(960);
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').layers.find((item: { id: string }) => item.id === 'bar').fitToText, STORAGE_KEY);
  expect(stored).toEqual({ textLayerId: 'title', padding: 24, maxWidth: 960 });
});

test('the text box character limit cuts what the stage shows', async ({ page }) => {
  await seed(page);
  await select(page, 'Title');
  await openDetailsTab(page, 'Properties');
  await expandCard(page, 'TEXT BOX');
  const limit = page.getByLabel('Text max characters');
  await limit.fill('5');
  await limit.press('Enter');
  await expandCard(page, 'TEXT');
  // The input itself accepts no more than the limit.
  await page.locator('.text-content-control').fill('Breaking');
  await expect(page.locator('.text-content-control')).toHaveValue('Break');
  await expect(page.locator('.stage-canvas-container [data-part-id="title"] text').first()).toHaveText('Break');
});
