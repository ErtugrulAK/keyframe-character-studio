/**
 * C4 — narrow and short windows share their room: the toolbar never scrolls
 * (≤ 860 px folds Boolean / Crop / View into keyboard-operable menus that show
 * on/off state), a short window gets a compact header and a shorter opening
 * timeline, a very short one (200 % zoom) opens the timeline collapsed. These
 * are OPENING decisions: after the user resizes or expands the timeline, that
 * choice is kept (also across Edit ⇄ Broadcast). Tall windows are unchanged.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const EMPTY = () => ({ x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [], trimPathStart: [], trimPathEnd: [], trimPathOffset: [] });

async function open(page: Page, width: number, height: number): Promise<void> {
  const layers = [{ id: 'box', name: 'Box', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#f97316', strokeColor: '#000', width: 200, height: 120 }];
  const scene = { version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers,
    tracks: [{ id: 'track-box', partId: 'box', name: 'Box', color: '#22d3ee', visible: true, locked: false, expanded: false, channels: EMPTY() }] };
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const height = (page: Page, selector: string) => page.locator(selector).evaluate((node) => Math.round(node.getBoundingClientRect().height));
const toolbarHidden = (page: Page) => page.locator('.authoring-toolbar').evaluate((node) => node.scrollWidth - node.clientWidth);
const roundTrip = async (page: Page) => {
  await page.getByRole('button', { name: 'BROADCAST', exact: true }).click();
  await expect(page.locator('.live-director-panel')).toBeVisible();
  await page.getByRole('button', { name: 'EDIT MODE', exact: true }).click();
  await expect(page.locator('.sequencer-timeline')).toBeVisible();
};

test('1440×900 is unchanged: 79 px header, 320 px timeline, every band on the strip', async ({ page }) => {
  await open(page, 1440, 900);
  expect(await height(page, '.header-bar')).toBe(79);
  expect(await height(page, '.sequencer-timeline')).toBe(320);
  await expect(page.getByRole('button', { name: 'Toggle grid' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Boolean operations' })).toBeHidden();
  expect(await toolbarHidden(page)).toBe(0);
});

test('768 px: no toolbar scroll; Boolean, Crop and View are menus that keep every command and show on/off state', async ({ page }) => {
  await open(page, 768, 900);
  expect(await toolbarHidden(page)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  // View — keyboard: Enter opens, the state is announced, the toggle works.
  const view = page.getByRole('button', { name: 'View', exact: true });
  await view.focus();
  await page.keyboard.press('Enter');
  const grid = page.getByRole('menuitemcheckbox', { name: 'Toggle grid' });
  await expect(grid).toBeFocused();
  const gridBefore = await grid.getAttribute('aria-checked');
  await page.keyboard.press('Enter');
  await expect(view).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitemcheckbox', { name: 'Toggle grid' })).toHaveAttribute('aria-checked', gridBefore === 'true' ? 'false' : 'true');
  for (const name of ['Toggle snapping', 'Zoom out', 'Reset view', 'Zoom in']) await expect(page.getByRole('menu', { name: 'View' }).getByRole(name === 'Toggle snapping' ? 'menuitemcheckbox' : 'menuitem', { name })).toBeVisible();
  await page.keyboard.press('Escape');

  // Crop — the trigger shows that crop mode is on.
  const crop = page.locator('.authoring-toolbar-compact-860').getByRole('button', { name: 'Crop', exact: true });
  await crop.click();
  await page.getByRole('menuitemcheckbox', { name: 'Crop / region of interest' }).click();
  await expect(crop).toHaveClass(/active/);
  await crop.click();
  await expect(page.getByRole('menuitemcheckbox', { name: 'Crop / region of interest' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('menuitem', { name: 'Apply crop' })).toBeDisabled();
  await page.keyboard.press('Escape');

  // Boolean — listed, disabled with its reason without two layers.
  await expect(page.getByRole('button', { name: 'Boolean operations' })).toBeDisabled();
});

test('a short window (1024×768) opens with a compact header and a shorter timeline; the user resize is kept across Broadcast', async ({ page }) => {
  await open(page, 1024, 768);
  expect(await height(page, '.header-bar')).toBeLessThanOrEqual(48);
  const opening = await height(page, '.sequencer-timeline');
  expect(opening).toBeLessThan(320);
  expect(opening).toBeGreaterThanOrEqual(150);

  // The user makes it taller with the resizer; the opening policy never overrides that.
  const bar = await page.locator('.timeline-resizer-bar').boundingBox();
  // C8: grabbed a quarter of the way in; the collapse handle owns the centre.
  await page.mouse.move(bar!.x + bar!.width / 4, bar!.y + bar!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar!.x + bar!.width / 4, bar!.y - 40, { steps: 5 });
  await page.mouse.up();
  const resized = await height(page, '.sequencer-timeline');
  expect(resized).toBeGreaterThan(opening + 20);
  await roundTrip(page);
  expect(await height(page, '.sequencer-timeline')).toBe(resized);
});

test('a very short window opens the timeline collapsed; once the user expands it, it stays expanded', async ({ page }) => {
  await open(page, 720, 450);
  expect(await height(page, '.sequencer-timeline')).toBeLessThanOrEqual(40);
  const toggle = page.locator('.sequencer-timeline [aria-expanded]').first();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => height(page, '.sequencer-timeline')).toBeGreaterThan(100);
  await page.locator('[role="tree"] [data-layer-id="box"]').click();
  await roundTrip(page);
  await expect(page.locator('.sequencer-timeline [aria-expanded]').first()).toHaveAttribute('aria-expanded', 'true');
  expect(await toolbarHidden(page)).toBe(0);
});

test('the toolbar never scrolls at any width from 1440 down to 720 px (both fold points included)', async ({ page }) => {
  await open(page, 1440, 900);
  const scrolled: string[] = [];
  for (const width of [1440, 1366, 1281, 1280, 1279, 1201, 1200, 1100, 1024, 900, 861, 860, 800, 768, 720]) {
    await page.setViewportSize({ width, height: 900 });
    const hidden = await toolbarHidden(page);
    if (hidden > 0) scrolled.push(`${width}: ${hidden}px`);
  }
  expect(scrolled).toEqual([]);
});
