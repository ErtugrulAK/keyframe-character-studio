import { test, expect, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

/**
 * Layout modifiers (user request, 2026-11-03), added from the Inspector's
 * MODIFIERS card: a layer that follows a text's edge, an emptied text that
 * hides with its bar, and a repeater whose copies pick the layer they repeat.
 * Adding a modifier never moves anything on the stage.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const layer = (id: string, name: string, extra: Record<string, unknown>) => ({
  id, name, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  strokeColor: '#101218', ...extra,
});

async function seed(page: Page, tagX = 400) {
  const scene = {
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 30,
    layers: [
      layer('bar', 'Bar', { type: 'custom_rect', fillColor: '#2563eb', scaleX: 6, scaleY: 1.6, y: 200, zIndex: 1 }),
      layer('tag', 'Tag', { type: 'custom_box', fillColor: '#f97316', x: tagX, zIndex: 2 }),
      layer('title', 'Title', { type: 'custom_text', textValue: 'Hi', fontSize: 72, fillColor: '#ffffff', textOrigin: 'center', y: 200, zIndex: 3 }),
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

const boxOf = (page: Page, id: string) => page.evaluate((partId) => {
  const element = document.querySelector(`.stage-canvas-container [data-part-id="${partId}"]`);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { left: rect.left, right: rect.right, centre: rect.left + rect.width / 2, width: rect.width };
}, id);

const select = (page: Page, name: string) => page.locator('.actor-node', { has: page.locator('.actor-name', { hasText: name }) }).first().click();

const addModifier = async (page: Page, kind: string) => {
  await openDetailsTab(page, 'Properties');
  const expand = page.getByRole('button', { name: 'Expand MODIFIERS', exact: true });
  if (await expand.count()) await expand.click();
  await page.getByLabel('Add modifier').selectOption(kind);
};

const setTitle = async (page: Page, value: string) => {
  await select(page, 'Title');
  await openDetailsTab(page, 'Properties');
  const expand = page.getByRole('button', { name: 'Expand TEXT', exact: true });
  if (await expand.count()) await expand.click();
  await page.locator('.text-content-control').fill(value);
};

test('a follower stays put when bound, then moves with the text it follows, across a reload', async ({ page }) => {
  await seed(page);
  const before = (await boxOf(page, 'tag'))!;
  await select(page, 'Tag');
  await addModifier(page, 'follow');
  await expect(page.getByLabel('Follow target')).toHaveValue('title');
  // Binding keeps the picture still.
  await expect.poll(async () => Math.round((await boxOf(page, 'tag'))!.centre)).toBe(Math.round(before.centre));
  const gap = before.left - (await boxOf(page, 'title'))!.right;

  await setTitle(page, 'A longer headline');
  // The text grew: the box keeps its gap to the text's right edge.
  await expect.poll(async () => Math.round((await boxOf(page, 'tag'))!.left - (await boxOf(page, 'title'))!.right)).toBe(Math.round(gap));
  expect((await boxOf(page, 'tag'))!.centre).toBeGreaterThan(before.centre + 20);

  await expect(page.locator('.autosave-status-badge')).toHaveAttribute('data-save-state', 'saved', { timeout: 15000 });
  await page.reload();
  await expect(page.locator('[data-part-id="title"]').first()).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => Math.round((await boxOf(page, 'tag'))!.left - (await boxOf(page, 'title'))!.right)).toBe(Math.round(gap));
});

test('an emptied text with Hide When Empty hides itself and the bar sized to it', async ({ page }) => {
  await seed(page);
  await select(page, 'Bar');
  await addModifier(page, 'autoSize');
  await select(page, 'Title');
  await addModifier(page, 'hideWhenEmpty');
  /** The product of every opacity from the layer up to the stage. */
  const shownOpacity = (id: string) => page.evaluate((partId) => {
    let element: Element | null = document.querySelector(`.stage-canvas-container [data-part-id="${partId}"]`);
    if (!element) return 0;
    let opacity = 1;
    for (; element && element.tagName.toLowerCase() !== 'svg'; element = element.parentElement) {
      opacity *= Number(getComputedStyle(element).opacity);
      const attribute = element.getAttribute('opacity');
      if (attribute !== null) opacity *= Number(attribute);
    }
    // The painted content of the layer.
    const inner = document.querySelector(`.stage-canvas-container [data-part-id="${partId}"] [opacity]`);
    return opacity * Number(inner?.getAttribute('opacity') ?? 1);
  }, id);
  expect(await shownOpacity('bar')).toBeGreaterThan(0.5);
  await setTitle(page, '');
  await expect.poll(() => shownOpacity('title')).toBeLessThan(0.01);
  await expect.poll(() => shownOpacity('bar')).toBeLessThan(0.01);
  await setTitle(page, 'Back');
  await expect.poll(() => shownOpacity('bar')).toBeGreaterThan(0.5);
});

test('a repeater paints its copies, and a copy picks the layer it repeats', async ({ page }) => {
  // Left of centre, so the copies (100 px apart, to the right) stay on the stage.
  await seed(page, -400);
  const before = (await boxOf(page, 'tag'))!;
  await select(page, 'Tag');
  await addModifier(page, 'repeater');
  await expect(page.locator('.stage-canvas-container [data-part-id="tag__copy2"]')).toHaveCount(1);
  const copy = (await boxOf(page, 'tag__copy1'))!;
  // 100 px per copy, at the stage's zoom (the box is 60 px wide).
  expect(copy.centre - before.centre).toBeCloseTo((100 / 60) * before.width, 0);
  expect(Math.round((await boxOf(page, 'tag'))!.centre)).toBe(Math.round(before.centre));

  // Picking a copy on the stage selects the layer it repeats.
  await select(page, 'Title');
  await page.mouse.click(copy.centre, (await page.locator('.stage-canvas-container [data-part-id="tag__copy1"]').boundingBox())!.y + 5);
  await expect(page.locator('.actor-node.selected .actor-name')).toHaveText('Tag');
  // The copies are not layers of the scene.
  await expect(page.locator('.actor-node .actor-name', { hasText: /^Tag \d/ })).toHaveCount(0);
});
