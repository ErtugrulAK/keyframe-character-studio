/**
 * C4 — keyboard focus model of the canvas mask points.
 *
 * Entering mask editing with the keyboard puts focus on the point list (one
 * Tab stop, roving); focus follows the selection (]/[, Home/End); the arrows
 * move the focused point; C switches Corner/Smooth; Delete removes it and focus
 * goes to its neighbour; Escape leaves and returns focus to "Edit on Canvas".
 * Points have accessible names (order, type, first). Tab leaves the list (no
 * trap); typing in a text field never triggers the canvas keys.
 */
import { expect, test, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const emptyChannels = () => ({ x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [], trimPathStart: [], trimPathEnd: [], trimPathOffset: [] });
const IMAGE = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#3b82f6"/></svg>').toString('base64')}`;
const path = {
  version: 1, coordinateSpace: 'normalized', closed: true,
  points: [{ id: 'a', x: 0.2, y: 0.2, kind: 'corner' }, { id: 'b', x: 0.8, y: 0.2, kind: 'corner' }, { id: 'c', x: 0.8, y: 0.8, kind: 'corner' }, { id: 'd', x: 0.2, y: 0.8, kind: 'corner' }, { id: 'e', x: 0.1, y: 0.5, kind: 'corner' }],
};

async function seed(page: Page): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [{ id: 'img', name: 'Landscape', type: 'custom_image', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#fff', strokeColor: '#000', width: 600, height: 300, imageUrl: IMAGE, masks: [{ id: 'm1', name: 'Window', mode: 'add', enabled: true, path }] }],
    tracks: [{ id: 'track-img', partId: 'img', name: 'img', color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() }],
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().click();
  await openDetailsTab(page, 'Masks');
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
}

async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

const points = (page: Page) => page.getByRole('listbox', { name: 'Points of mask “Window” on “Landscape”' });
const focusedPoint = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName ?? null);

test('keyboard entry, navigation, move, point type, delete and exit — focus is always somewhere sensible', async ({ page }) => {
  await seed(page);
  const entry = page.getByRole('button', { name: 'Edit on Canvas' });
  await entry.focus();
  await page.keyboard.press('Enter');
  await expect(points(page)).toBeVisible();
  // Focus is on the first point, which says what it is.
  await expect.poll(() => focusedPoint(page)).toBe('Point 1 of 5, corner, first point');
  await expect(points(page).getByRole('option')).toHaveCount(5);
  // Exactly one point is in the tab order (roving).
  await expect(points(page).locator('[tabindex="0"]')).toHaveCount(1);

  // ] / [ and Home / End move focus WITH the selection.
  await page.keyboard.press(']');
  await expect.poll(() => focusedPoint(page)).toBe('Point 2 of 5, corner');
  await expect(points(page).getByRole('option', { name: 'Point 2 of 5, corner' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect.poll(() => focusedPoint(page)).toBe('Point 5 of 5, corner');
  await page.keyboard.press('Home');
  await expect.poll(() => focusedPoint(page)).toBe('Point 1 of 5, corner, first point');
  await page.keyboard.press('[');
  await expect.poll(() => focusedPoint(page)).toBe('Point 5 of 5, corner');

  // Arrows move the focused point (Shift ×10); C makes it smooth.
  const before = (await savedScene(page)).layers[0].masks[0].path.points[4];
  // (reading the save clicked the autosave badge: give focus back to the point)
  await points(page).getByRole('option', { name: /^Point 5 of 5/ }).focus();
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('c');
  await expect(points(page).getByRole('option', { name: 'Point 5 of 5, smooth' })).toBeFocused();
  const moved = (await savedScene(page)).layers[0].masks[0].path.points[4];
  expect(moved.x).toBeGreaterThan(before.x);
  expect(moved.kind).toBe('smooth');
  await points(page).getByRole('option', { name: /^Point 5 of 5/ }).focus();

  // Delete removes it; focus moves to its neighbour, not to the page.
  await page.keyboard.press('Delete');
  await expect(points(page).getByRole('option')).toHaveCount(4);
  await expect.poll(() => focusedPoint(page)).toBe('Point 4 of 4, corner');

  // Undo brings the point back (one step per action).
  await page.keyboard.press('Control+z');
  await expect(points(page).getByRole('option')).toHaveCount(5);

  // Escape leaves mask editing and focus returns to the entry control.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(points(page)).toHaveCount(0);
  await expect(entry).toBeFocused();
});

test('Tab leaves the point list (no trap); a pointer entry keeps focus; text fields keep their keys', async ({ page }) => {
  await seed(page);
  await page.getByRole('button', { name: 'Edit on Canvas' }).click(); // pointer
  await expect(points(page)).toBeVisible();
  await expect.poll(() => focusedPoint(page)).not.toMatch(/^Point /);

  await points(page).getByRole('option').first().focus();
  await page.keyboard.press('Tab');
  await expect.poll(() => focusedPoint(page)).not.toMatch(/^Point /);
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => focusedPoint(page)).toMatch(/^Point 1 of 5/);

  // Typing "c", "]" or arrows in a text field does not touch the mask.
  const before = JSON.stringify((await savedScene(page)).layers[0].masks[0].path);
  const feather = page.getByLabel('Mask feather');
  await feather.focus();
  await page.keyboard.press(']');
  await page.keyboard.press('c');
  await page.keyboard.press('ArrowUp');
  expect(JSON.stringify((await savedScene(page)).layers[0].masks[0].path)).toBe(before);
});

test('the focused point shows a visible focus ring', async ({ page }) => {
  await seed(page);
  const entry = page.getByRole('button', { name: 'Edit on Canvas' });
  await entry.focus();
  await page.keyboard.press('Enter');
  const point = points(page).getByRole('option').first();
  await expect(point).toBeFocused();
  const stroke = await point.evaluate((node) => getComputedStyle(node).stroke);
  expect(stroke).not.toBe('none');
});
