/**
 * C4 — long layer lists (≥ 60 rows) mount only the rows near their viewport.
 * Nothing the user sees or reaches may change because of it: the scroll height,
 * every row inside the viewport, keyboard navigation to the far end of the tree,
 * the alignment of the timeline's layer rows with their lanes (also after a track
 * expands), and an Edit ⇄ Broadcast round trip that keeps selection, playhead,
 * camera and both lists' scroll positions. Short lists stay fully mounted.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const EMPTY = { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [], trimPathStart: [], trimPathEnd: [], trimPathOffset: [] };

const scene = (count: number) => ({
  version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
  layers: Array.from({ length: count }, (_, index) => ({
    id: `l${index}`, name: `Layer ${index}`, type: index % 2 ? 'custom_rect' : 'custom_circle',
    x: ((index * 97) % 1400) - 700, y: ((index * 53) % 800) - 400, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: count - index, fillColor: `hsl(${(index * 37) % 360} 70% 55%)`, strokeColor: '#000', width: 80, height: 60,
  })),
  tracks: Array.from({ length: count }, (_, index) => ({
    id: `track-l${index}`, partId: `l${index}`, name: `Layer ${index}`, color: '#22d3ee', visible: true, locked: false, expanded: false,
    channels: { ...EMPTY, x: [{ id: `k${index}a`, frame: 0, value: 0, easing: 'linear' }, { id: `k${index}b`, frame: 30, value: 40, easing: 'linear' }] },
  })),
});

async function open(page: Page, count: number): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene(count)) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const treeRows = (page: Page) => page.locator('[role="tree"][aria-label="Layers"] [role="treeitem"][data-layer-id]');
const treeScroller = (page: Page) => page.locator('.outliner-table-body');
const timelineRows = (page: Page) => page.locator('.ue-outliner-list [data-track-row-id]');

/** Every 6 px of the visible list area hits a real row — never an empty spacer. */
const visibleListIsFilled = (page: Page, scroller: string, row: string) => page.evaluate(({ scrollerSelector, rowSelector }) => {
  const element = document.querySelector(scrollerSelector) as HTMLElement;
  const box = element.getBoundingClientRect();
  const misses: number[] = [];
  const contentBottom = Math.min(box.bottom, box.top + element.scrollHeight - element.scrollTop);
  for (let y = box.top + 2; y < contentBottom - 2; y += 6) {
    const hit = document.elementFromPoint(box.left + 40, y);
    if (!hit?.closest(rowSelector)) misses.push(Math.round(y - box.top));
  }
  return misses;
}, { scrollerSelector: scroller, rowSelector: row });

/** Each mounted layer row and its lane start at the same height on screen. */
const misalignedTracks = (page: Page) => page.evaluate(() => {
  const out: string[] = [];
  document.querySelectorAll<HTMLElement>('.ue-outliner-list [data-track-row-id]').forEach((row) => {
    const lane = document.querySelector<HTMLElement>(`.ue-lane-group[data-owner-part-id="${row.dataset.trackPartId}"]`);
    if (!lane) { out.push(`${row.dataset.trackPartId}: no lane`); return; }
    const a = row.getBoundingClientRect();
    const b = lane.getBoundingClientRect();
    if (Math.abs(a.top - b.top) > 0.5 || Math.abs(a.height - b.height) > 0.5) out.push(`${row.dataset.trackPartId}: row ${a.top}/${a.height} lane ${b.top}/${b.height}`);
  });
  return out;
});

test('a 120-layer tree mounts only the rows near its viewport and keeps the full scroll height', async ({ page }) => {
  await open(page, 120);
  const mounted = await treeRows(page).count();
  expect(mounted).toBeGreaterThan(5);
  expect(mounted).toBeLessThan(60);
  await expect(treeRows(page).first()).toHaveAttribute('aria-setsize', '120');
  // The tree is as tall as 120 rows: the scrollbar is the real one.
  const pitch = await treeRows(page).first().evaluate((node) => node.getBoundingClientRect().height);
  const treeHeight = await page.locator('[role="tree"][aria-label="Layers"]').evaluate((node) => node.getBoundingClientRect().height);
  expect(treeHeight).toBeCloseTo(120 * pitch, 0);
  expect(await visibleListIsFilled(page, '.outliner-table-body', '[role="treeitem"]')).toEqual([]);

  // Scroll to the middle and to the end: the visible area is always rows.
  await treeScroller(page).evaluate((node) => { node.scrollTop = 1400; });
  await expect.poll(() => visibleListIsFilled(page, '.outliner-table-body', '[role="treeitem"]')).toEqual([]);
  await treeScroller(page).evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await expect.poll(() => visibleListIsFilled(page, '.outliner-table-body', '[role="treeitem"]')).toEqual([]);
  await expect(page.getByRole('treeitem', { name: /Layer 119/ })).toBeInViewport();
});

test('keyboard reaches both ends of a long tree; rename works on a far row', async ({ page }) => {
  await open(page, 120);
  await treeRows(page).first().click();
  await page.keyboard.press('End');
  const last = page.locator('[role="treeitem"][aria-posinset="120"]');
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport();
  await page.keyboard.press('F2');
  const input = last.locator('input');
  await expect(input).toBeFocused();
  await input.fill('Renamed far layer');
  await page.keyboard.press('Enter');
  await expect(page.locator('[role="treeitem"][aria-posinset="120"]')).toContainText('Renamed far layer');
  await expect(page.locator('[role="treeitem"][aria-posinset="120"]')).toBeFocused();
  await page.keyboard.press('Home');
  const first = page.locator('[role="treeitem"][aria-posinset="1"]');
  await expect(first).toBeFocused();
  await expect(first).toBeInViewport();
  // Arrow keys walk row by row through rows that were not mounted a moment ago.
  for (let index = 0; index < 30; index += 1) await page.keyboard.press('ArrowDown');
  await expect(page.locator('[role="treeitem"][aria-posinset="31"]')).toBeFocused();
  await expect(page.locator('[role="treeitem"][aria-posinset="31"]')).toBeInViewport();
});

test('the timeline layer rows and their lanes stay aligned while windowed, also after a track expands', async ({ page }) => {
  await open(page, 120);
  const mounted = await timelineRows(page).count();
  expect(mounted).toBeLessThan(60);
  expect(await misalignedTracks(page)).toEqual([]);
  expect(await visibleListIsFilled(page, '.ue-outliner-list', '[data-track-row-id]')).toEqual([]);

  // Scroll the LANES (the grid): the layer rows follow and stay aligned.
  await page.locator('.timeline-grid-container').evaluate((node) => { node.scrollTop = 1800; });
  await expect.poll(() => page.locator('.ue-outliner-list').evaluate((node) => node.scrollTop)).toBeGreaterThan(1700);
  await expect.poll(() => misalignedTracks(page)).toEqual([]);
  await expect.poll(() => visibleListIsFilled(page, '.ue-outliner-list', '[data-track-row-id]')).toEqual([]);

  // Expand a visible track: it grows, every row below moves down with its lane.
  const row = timelineRows(page).filter({ has: page.locator('button[aria-label^="Expand properties of"]') }).nth(8);
  const id = await row.getAttribute('data-track-part-id');
  const before = await row.evaluate((node) => node.getBoundingClientRect().height);
  await row.locator('button[aria-label^="Expand properties of"]').click();
  await expect.poll(() => page.locator(`[data-track-row-id][data-track-part-id="${id}"]`).evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThan(before + 20);
  await expect.poll(() => misalignedTracks(page)).toEqual([]);
  // The end of the list is still reachable and aligned.
  await page.locator('.timeline-grid-container').evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await expect(page.locator('[data-track-row-id][data-track-part-id="l119"]')).toBeVisible();
  await expect.poll(() => misalignedTracks(page)).toEqual([]);
});

test('Edit ⇄ Broadcast keeps selection, playhead, camera and both lists where the user left them', async ({ page }) => {
  await open(page, 120);
  // Select a far layer from the tree, move the playhead, zoom the camera.
  await treeRows(page).first().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.locator('[role="treeitem"][aria-posinset="120"]')).toHaveAttribute('aria-selected', 'true');
  const ruler = page.getByRole('slider', { name: 'Playhead position' });
  await ruler.focus();
  for (let index = 0; index < 12; index += 1) await page.keyboard.press('ArrowRight');
  await page.locator('.timeline-grid-container').evaluate((node) => { node.scrollTop = 1500; });
  await expect.poll(() => page.locator('.ue-outliner-list').evaluate((node) => node.scrollTop)).toBeGreaterThan(1400);
  const treeTop = await treeScroller(page).evaluate((node) => node.scrollTop);
  const rowsTop = await page.locator('.ue-outliner-list').evaluate((node) => node.scrollTop);
  const frame = await ruler.getAttribute('aria-valuenow');
  const layer = page.locator('.stage-svg g[data-part-id="l60"]').first();
  const layerBefore = await layer.boundingBox();

  await page.getByRole('button', { name: 'BROADCAST', exact: true }).click();
  await expect(page.locator('.live-director-panel')).toBeVisible();
  await page.getByRole('button', { name: 'EDIT MODE', exact: true }).click();
  await expect(page.locator('.sequencer-timeline')).toBeVisible();

  await expect(page.locator('[role="treeitem"][aria-posinset="120"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('slider', { name: 'Playhead position' })).toHaveAttribute('aria-valuenow', frame ?? '');
  expect(await treeScroller(page).evaluate((node) => node.scrollTop)).toBeCloseTo(treeTop, 0);
  expect(await page.locator('.ue-outliner-list').evaluate((node) => node.scrollTop)).toBeCloseTo(rowsTop, 0);
  expect(await visibleListIsFilled(page, '.outliner-table-body', '[role="treeitem"]')).toEqual([]);
  expect(await visibleListIsFilled(page, '.ue-outliner-list', '[data-track-row-id]')).toEqual([]);
  expect(await misalignedTracks(page)).toEqual([]);
  const layerAfter = await layer.boundingBox();
  expect(Math.abs((layerAfter?.x ?? 0) - (layerBefore?.x ?? 0))).toBeLessThan(0.5);
  expect(Math.abs((layerAfter?.y ?? 0) - (layerBefore?.y ?? 0))).toBeLessThan(0.5);
});

test('a short list (10 layers) is never windowed', async ({ page }) => {
  await open(page, 10);
  await expect(treeRows(page)).toHaveCount(10);
  await expect(timelineRows(page)).toHaveCount(10);
  await expect(page.locator('.row-window-spacer')).toHaveCount(0);
});

test('rapid Edit ⇄ Broadcast switching on a long scene settles in Edit with the lists intact; Broadcast takes no editor keys', async ({ page }) => {
  await open(page, 120);
  await treeRows(page).nth(3).click();
  const selectedId = await treeRows(page).nth(3).getAttribute('data-layer-id');
  const broadcast = page.getByRole('button', { name: 'BROADCAST', exact: true });
  const edit = page.getByRole('button', { name: 'EDIT MODE', exact: true });
  await broadcast.click();
  // In Broadcast the edit chrome is gone: editor keys (Delete, tree keys) do nothing.
  await page.keyboard.press('Delete');
  await page.keyboard.press('End');
  for (let index = 0; index < 3; index += 1) {
    await edit.click();
    await broadcast.click();
  }
  await edit.click();
  await expect(page.locator('.sequencer-timeline')).toBeVisible();
  await expect(page.locator('.app-container')).not.toHaveClass(/kcs-mode-swap/);
  await expect(page.locator(`[role="treeitem"][data-layer-id="${selectedId}"]`)).toHaveAttribute('aria-selected', 'true');
  await expect(treeRows(page).first()).toHaveAttribute('aria-setsize', '120');
  expect(await visibleListIsFilled(page, '.outliner-table-body', '[role="treeitem"]')).toEqual([]);
  expect(await misalignedTracks(page)).toEqual([]);
});
