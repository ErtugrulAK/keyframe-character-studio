/**
 * C5 — the row windowing of long lists (C4) must not cost behaviour.
 *
 * - A timeline marquee hit-tests the lane LAYOUT, so a box dragged (with edge
 *   auto-scroll) over rows that were never mounted selects their keys, and the
 *   selection survives scrolling them out and back in.
 * - The data-derived hit test agrees with the rendered diamonds exactly, also
 *   below an expanded track.
 * - Keyboard navigation brings the focused row into view; focus and accessible
 *   names survive scrolling.
 * - The layer search finds layers anywhere in the scene (not just mounted rows).
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const EMPTY = { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [], trimPathStart: [], trimPathEnd: [], trimPathOffset: [] };

const scene = (count: number, expanded: number[] = []) => ({
  version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
  layers: Array.from({ length: count }, (_, index) => ({
    id: `l${index}`, name: `Layer ${index}`, type: index % 2 ? 'custom_rect' : 'custom_circle',
    x: ((index * 97) % 1400) - 700, y: ((index * 53) % 800) - 400, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: count - index, fillColor: `hsl(${(index * 37) % 360} 70% 55%)`, strokeColor: '#000', width: 80, height: 60,
  })),
  tracks: Array.from({ length: count }, (_, index) => ({
    id: `track-l${index}`, partId: `l${index}`, name: `Layer ${index}`, color: '#22d3ee', visible: true, locked: false, expanded: expanded.includes(index),
    channels: { ...EMPTY, x: [{ id: `k${index}a`, frame: 0, value: 0, easing: 'linear' }, { id: `k${index}b`, frame: 30, value: 40, easing: 'linear' }] },
  })),
});

async function open(page: Page, count: number, expanded: number[] = []): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene(count, expanded)) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const grid = (page: Page) => page.locator('.timeline-grid-container');
const treeRows = (page: Page) => page.locator('[role="tree"][aria-label="Layers"] [role="treeitem"][data-layer-id]');
/** Client X of a frame on the lanes (a frame-30 diamond's offset gives the frame width). */
const frameX = async (page: Page, frame: number) => page.evaluate((target) => {
  const lanes = document.querySelector('.ue-track-lanes') as HTMLElement;
  const diamond = document.querySelector<HTMLElement>('.keyframe-diamond[data-keyframe-id$="b"]') as HTMLElement;
  return lanes.getBoundingClientRect().left + target * (parseFloat(diamond.style.left) / 30);
}, frame);

test('a marquee with edge auto-scroll selects keys on rows that were never mounted, and they stay selected', async ({ page }) => {
  await open(page, 150);
  const box = await grid(page).boundingBox();
  if (!box) throw new Error('grid');
  // Never mounted at the start: the last tracks of the list.
  await expect(page.locator('.keyframe-diamond[data-keyframe-id="k149b"]')).toHaveCount(0);

  // A box around frame 30 only (frame 0 keys stay out), from the first row …
  const left = await frameX(page, 26);
  const right = await frameX(page, 34);
  const startY = box.y + 40;
  await page.mouse.move(left, startY);
  await page.mouse.down();
  await page.mouse.move(right, box.y + box.height / 2, { steps: 4 });
  // … held at the bottom edge (the window's bottom here): the grid scrolls on
  // its own, mounting rows as it goes, to the end of the list.
  await page.mouse.move(right, box.y + box.height - 2, { steps: 2 });
  await expect.poll(() => grid(page).evaluate((node) => node.scrollTop + node.clientHeight >= node.scrollHeight - 2), { timeout: 20000 }).toBe(true);
  await page.mouse.up();

  // The far rows are mounted now and their frame-30 key is selected, frame 0 is not.
  await expect(page.locator('.keyframe-diamond[data-keyframe-id="k149b"]')).toHaveClass(/selected/);
  await expect(page.locator('.keyframe-diamond[data-keyframe-id="k149a"]')).not.toHaveClass(/selected/);

  // Back at the top (those rows were unmounted meanwhile): still selected.
  await grid(page).evaluate((node) => { node.scrollTop = 0; });
  await expect(page.locator('.keyframe-diamond[data-keyframe-id="k1b"]')).toHaveClass(/selected/);
  await expect(page.locator('.keyframe-diamond[data-keyframe-id="k1a"]')).not.toHaveClass(/selected/);
  // A middle row that was only ever passed by the auto-scroll.
  await grid(page).evaluate((node) => { node.scrollTop = node.scrollHeight / 2; });
  await expect(page.locator('.keyframe-diamond[data-keyframe-id="k75b"]')).toHaveClass(/selected/);
});

test('the data-derived hit test agrees with the rendered diamonds, below an expanded track and after scrolling', async ({ page }) => {
  await open(page, 120, [3, 40]);
  // Scroll to the middle so the rows above are spacers (one of them an expanded track).
  await grid(page).evaluate((node) => { node.scrollTop = 1500; });
  await expect.poll(() => page.locator('.keyframe-diamond[data-keyframe-id="k60b"]').count()).toBe(1);
  const box = await grid(page).boundingBox();
  if (!box) throw new Error('grid');
  const x0 = await frameX(page, 28);
  const x1 = await frameX(page, 32);
  const y0 = box.y + box.height * 0.3;
  const y1 = box.y + box.height * 0.7;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 5 });
  await page.mouse.up();
  const result = await page.evaluate(({ rect }) => {
    const inside: string[] = [];
    const selected: string[] = [];
    document.querySelectorAll<HTMLElement>('.keyframe-diamond[data-keyframe-id], .ue-prop-diamond[data-keyframe-id]').forEach((diamond) => {
      const r = diamond.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx >= rect.x0 && cx <= rect.x1 && cy >= rect.y0 && cy <= rect.y1) inside.push(diamond.dataset.keyframeId as string);
      if (diamond.classList.contains('selected')) selected.push(diamond.dataset.keyframeId as string);
    });
    return { inside: [...new Set(inside)].sort(), selected: [...new Set(selected)].sort() };
  }, { rect: { x0, x1, y0, y1 } });
  expect(result.inside.length).toBeGreaterThan(3);
  expect(result.selected).toEqual(result.inside);
});

test('keyboard navigation brings the focused row into view; focus and names survive scrolling', async ({ page }) => {
  await open(page, 150);
  const scroller = page.locator('.outliner-table-body');
  await treeRows(page).first().focus();
  await page.keyboard.press('End');
  const last = page.locator('[role="treeitem"][data-layer-id="l149"]');
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport();
  await expect(last).toHaveAccessibleName(/Layer 149/);
  for (let step = 0; step < 3; step += 1) await page.keyboard.press('ArrowUp');
  const focused = page.locator('[role="treeitem"][data-layer-id="l146"]');
  await expect(focused).toBeFocused();
  await expect(focused).toBeInViewport();

  // Scrolled away by the wheel: the focused row stays mounted, focused and named.
  await scroller.evaluate((node) => { node.scrollTop = 0; });
  await expect(focused).toBeFocused();
  await expect(focused).toHaveAccessibleName(/Layer 146/);
  // The next arrow brings it (and its neighbour) back into view.
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('[role="treeitem"][data-layer-id="l145"]')).toBeFocused();
  await expect(page.locator('[role="treeitem"][data-layer-id="l145"]')).toBeInViewport();

  // Enter selects; the selection is kept when the row scrolls away and back.
  await page.keyboard.press('Enter');
  await expect(page.locator('[role="treeitem"][data-layer-id="l145"]')).toHaveAttribute('aria-selected', 'true');
  await scroller.evaluate((node) => { node.scrollTop = 0; });
  await scroller.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await expect(page.locator('[role="treeitem"][data-layer-id="l145"]')).toHaveAttribute('aria-selected', 'true');
});

test('the layer search finds layers anywhere in the scene, Enter selects the first match, Esc clears', async ({ page }) => {
  await open(page, 150);
  const search = page.getByRole('textbox', { name: 'Find layer' });
  await expect(page.locator('[role="treeitem"][data-layer-id="l147"]')).toHaveCount(0);
  await search.fill('layer 14');
  // Layer 14 and Layer 140–149: eleven matches, all shown (none was mounted before).
  await expect(page.getByTestId('outliner-search-count')).toHaveText('11 of 150');
  await expect(treeRows(page)).toHaveCount(11);
  await expect(page.locator('[role="treeitem"][data-layer-id="l147"]')).toBeVisible();
  await search.press('Enter');
  await expect(page.locator('[role="treeitem"][data-layer-id="l14"]')).toBeFocused();
  await expect(page.locator('[role="treeitem"][data-layer-id="l14"]')).toHaveAttribute('aria-selected', 'true');
  await search.fill('no such layer');
  await expect(page.getByTestId('outliner-search-count')).toHaveText('No match');
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(treeRows(page).first()).toHaveAttribute('aria-setsize', '150');
  // The selection made from the search is kept.
  await expect(page.locator('.details-actor-header .actor-main-name')).toHaveText('Layer 14');
});
