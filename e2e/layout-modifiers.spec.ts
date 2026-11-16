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

async function seed(page: Page, tagX = 400, extraLayers: Array<Record<string, unknown>> = []) {
  const scene = {
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 30,
    layers: [
      layer('bar', 'Bar', { type: 'custom_rect', fillColor: '#2563eb', scaleX: 6, scaleY: 1.6, y: 200, zIndex: 1 }),
      layer('tag', 'Tag', { type: 'custom_box', fillColor: '#f97316', x: tagX, zIndex: 2 }),
      layer('title', 'Title', { type: 'custom_text', textValue: 'Hi', fontSize: 72, fillColor: '#ffffff', textOrigin: 'center', y: 200, zIndex: 3 }),
      ...extraLayers,
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

const MODIFIER_LABELS: Record<string, string> = { textBox: 'Text Box', hideWhenEmpty: 'Hide When Empty', autoSize: 'Auto Size', follow: 'Auto Follow', lookAt: 'Look At', justify: 'Justify', repeater: 'Repeater' };

const addModifier = async (page: Page, kind: string) => {
  await openDetailsTab(page, 'Properties');
  const expand = page.getByRole('button', { name: 'Expand MODIFIERS', exact: true });
  if (await expand.count()) await expand.click();
  await page.getByLabel(`${MODIFIER_LABELS[kind]} modifier`, { exact: true }).check();
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
  // The text grew: the box keeps its gap to the text's right edge (to a screen
  // pixel: rounding both sides of a fractional gap could differ by one).
  await expect.poll(async () => Math.abs((await boxOf(page, 'tag'))!.left - (await boxOf(page, 'title'))!.right - gap)).toBeLessThanOrEqual(1);
  expect((await boxOf(page, 'tag'))!.centre).toBeGreaterThan(before.centre + 20);

  await expect(page.locator('.autosave-status-badge')).toHaveAttribute('data-save-state', 'saved', { timeout: 15000 });
  await page.reload();
  await expect(page.locator('[data-part-id="title"]').first()).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => Math.abs((await boxOf(page, 'tag'))!.left - (await boxOf(page, 'title'))!.right - gap)).toBeLessThanOrEqual(1);
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

test('Auto Size binds every text on the bar and takes the widest; the modifier is a checkbox', async ({ page }) => {
  // A subtitle under the title, both on the bar.
  await seed(page, 400, [layer('sub', 'Subtitle', { type: 'custom_text', textValue: 'A much longer subtitle line', fontSize: 36, fillColor: '#ffffff', textOrigin: 'center', y: 230, zIndex: 4 })]);
  await select(page, 'Bar');
  await addModifier(page, 'autoSize');
  await expect(page.getByRole('checkbox', { name: 'Size to Title' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Size to Subtitle' })).toBeChecked();
  // The subtitle is the wider text: the bar hugs it (24 px padding each side, at the stage's zoom).
  const fitted = async () => {
    const bar = (await boxOf(page, 'bar'))!;
    const subtitle = (await boxOf(page, 'sub'))!;
    return bar.width - subtitle.width;
  };
  await expect.poll(async () => (await fitted()) > 0).toBe(true);
  const padding = await fitted();
  // Unchecking the subtitle leaves the short title: the bar narrows.
  const wide = (await boxOf(page, 'bar'))!.width;
  await page.getByRole('checkbox', { name: 'Size to Subtitle' }).uncheck();
  await expect.poll(async () => (await boxOf(page, 'bar'))!.width).toBeLessThan(wide - 50);
  // The last text cannot be unchecked; the modifier itself turns off from its own checkbox.
  await expect(page.getByRole('checkbox', { name: 'Size to Title' })).toBeDisabled();
  await page.getByLabel('Auto Size modifier', { exact: true }).uncheck();
  await expect(page.getByRole('checkbox', { name: 'Size to Title' })).toHaveCount(0);
  expect(padding).toBeGreaterThan(0);
});

const verticalOf = (page: Page, id: string) => page.evaluate((partId) => {
  const rect = document.querySelector(`.stage-canvas-container [data-part-id="${partId}"]`)!.getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom, centre: rect.top + rect.height / 2 };
}, id);

test('Auto Size can fit the height too: the bar wraps the title and a subtitle under it', async ({ page }) => {
  await seed(page, 400, [layer('sub', 'Subtitle', { type: 'custom_text', textValue: 'Second line', fontSize: 30, fillColor: '#ffffff', textOrigin: 'center', y: 240, zIndex: 4 })]);
  await select(page, 'Bar');
  await addModifier(page, 'autoSize');
  await page.getByLabel('Fit height', { exact: true }).check();
  await expect(page.getByLabel('Fit padding Y', { exact: true })).toBeVisible();
  const bar = await verticalOf(page, 'bar');
  const title = await verticalOf(page, 'title');
  const sub = await verticalOf(page, 'sub');
  // The bar starts above the title and ends below the subtitle, centred on them.
  expect(bar.top).toBeLessThan(title.top);
  expect(bar.bottom).toBeGreaterThan(sub.bottom);
  expect(Math.abs(bar.centre - (title.top + sub.bottom) / 2)).toBeLessThan(12);
});

test('Look At turns a layer to face its target', async ({ page }) => {
  await seed(page);
  await select(page, 'Tag');
  await addModifier(page, 'lookAt');
  await page.getByLabel('Look at target', { exact: true }).selectOption({ label: 'Bar' });
  // The tag (400, 0) faces the bar (0, 200): its rotation is atan2(200, -400).
  const expected = (Math.atan2(200, -400) * 180) / Math.PI;
  await expect.poll(async () => page.evaluate(() => {
    const node = document.querySelector('.stage-canvas-container [data-part-id="tag"] [transform]');
    const match = /rotate\(([-\d.]+)/u.exec(node?.getAttribute('transform') ?? '');
    return match ? Number(match[1]) : null;
  })).toBeCloseTo(expected, 0);
});

test('a Text Box keeps its top or bottom edge in place as its text shrinks (V ALIGN), kept after a reload', async ({ page }) => {
  // Round 6 (OGraf Studio review): vertical alignment of a shrinking text.
  await seed(page, 400, [
    layer('boxed', 'Boxed', { type: 'custom_text', textValue: 'Short', fontSize: 72, fillColor: '#ffffff', textOrigin: 'center', y: -200, x: 300, zIndex: 5, textFit: { maxWidth: 400 } }),
  ]);
  // What the layout keeps is the editor's text box model (half height 0.561
  // em about the centre; `getTextMetrics`, also read by Auto Size). The font
  // draws its own box (ascent / descent), linear in the size about the same
  // origin, so the drawn edge it should land on is computed from the
  // full-size drawing rather than allowed for with a tolerance.
  const HALF_EM = 0.561;
  const edges = () => page.evaluate(() => {
    const element = document.querySelector('.stage-canvas-container [data-part-id="boxed"] text')!;
    const rect = element.getBoundingClientRect();
    const ctm = (element as SVGGraphicsElement).getScreenCTM()!;
    // The text's origin on screen: its own (0, 0), after the layout shift.
    return { top: rect.top, bottom: rect.bottom, size: Number(element.getAttribute('font-size')), originY: ctm.f, zoom: Math.hypot(ctm.c, ctm.d) };
  });
  type Edges = Awaited<ReturnType<typeof edges>>;
  /** Where the drawn `edge` belongs once the model kept the edge of `from` and the size became `now.size`. */
  const expected = (from: Edges, now: Edges, edge: 'top' | 'bottom') => {
    const sign = edge === 'top' ? -1 : 1;
    const originAfter = from.originY + sign * HALF_EM * (from.size - now.size) * from.zoom;
    const drawnOffset = ((edge === 'top' ? from.top : from.bottom) - from.originY) * (now.size / from.size);
    return originAfter + drawnOffset;
  };
  const openCard = async (card: string) => {
    await select(page, 'Boxed');
    await openDetailsTab(page, 'Properties');
    const expand = page.getByRole('button', { name: `Expand ${card}`, exact: true });
    if (await expand.count()) await expand.click();
  };
  const setText = async (value: string) => {
    await openCard('TEXT');
    await page.locator('.text-content-control').fill(value);
  };
  const setVertical = async (value: string) => {
    await openCard('MODIFIERS');
    await page.getByLabel('Text vertical align').selectOption(value);
  };
  await select(page, 'Boxed');
  const full = await edges();
  expect(full.size).toBe(72);

  // Top: a longer text shrinks, and its top stays where the short one's was.
  await setVertical('top');
  await setText('A much longer headline than fits');
  await expect.poll(async () => (await edges()).size).toBeLessThan(72);
  await expect.poll(async () => { const now = await edges(); return Math.abs(now.top - expected(full, now, 'top')); }).toBeLessThanOrEqual(0.5);
  expect((await edges()).bottom).toBeLessThan(full.bottom - 10);

  // Bottom: back to the short text, then the long one keeps the bottom.
  await setText('Short');
  await setVertical('bottom');
  await expect.poll(async () => (await edges()).size).toBe(72);
  const shortAgain = await edges();
  await setText('A much longer headline than fits');
  await expect.poll(async () => { const now = await edges(); return Math.abs(now.bottom - expected(shortAgain, now, 'bottom')); }).toBeLessThanOrEqual(0.5);
  expect((await edges()).top).toBeGreaterThan(shortAgain.top + 10);

  await expect(page.locator('.autosave-status-badge')).toHaveAttribute('data-save-state', 'saved', { timeout: 15000 });
  const kept = await edges();
  await page.reload();
  await expect(page.locator('[data-part-id="boxed"]').first()).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await select(page, 'Boxed');
  await expect.poll(async () => Math.abs((await edges()).bottom - kept.bottom)).toBeLessThanOrEqual(0.5);
});
