/**
 * C6 — autosave timing, honest header status and a header that does not move.
 *
 * - While the user keeps editing, autosave still writes ~10 s after the FIRST
 *   unsaved change (it used to restart its countdown on every edit).
 * - The badge says "Unsaved changes" until a write has succeeded, then counts
 *   from that successful save; a reload brings that saved document back.
 * - The status text changes (every second and between states) without moving
 *   any other header control, at desktop and narrow widths.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

async function seed(page: Page, width = 1440, height = 900): Promise<void> {
  const layer = {
    id: 'box', name: 'Box', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 2, opacity: 1, visible: true, zIndex: 1,
    fillColor: '#22d3ee', strokeColor: '#101218', width: 120, height: 60,
  };
  const scene = {
    version: 2, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers: [layer],
    tracks: [{ id: 'track-box', partId: 'box', name: 'Box', color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() }],
  };
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const boxCentre = async (page: Page) => {
  const box = await page.locator('.stage-svg g[data-part-id="box"]').first().boundingBox();
  if (!box) throw new Error('no stage box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** One small drag of the layer on the stage: one real scene edit. */
const nudgeBox = async (page: Page, dx: number) => {
  const centre = await boxCentre(page);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x + dx, centre.y, { steps: 3 });
  await page.mouse.up();
};

const storedX = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').layers?.[0]?.x as number, STORAGE_KEY);

/** Every header control's box, keyed by its accessible name. */
const headerControlBoxes = (page: Page) => page.evaluate(() => {
  const out: Record<string, string> = {};
  const header = document.querySelector('.header-bar')!.getBoundingClientRect();
  out.header = `${Math.round(header.width)}x${Math.round(header.height)}`;
  document.querySelectorAll<HTMLElement>('.header-bar button, .header-bar select, .header-bar .autosave-status-badge').forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0) return;
    const name = element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 20) || element.className;
    out[`${index}:${element.classList.contains('autosave-status-badge') ? 'badge' : name}`] = `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.width)},${Math.round(rect.height)}`;
  });
  return out;
});

test('continuous editing still autosaves about 10 s after the first change, and a reload restores it', async ({ page }) => {
  test.setTimeout(90000);
  await seed(page);
  const badge = page.locator('.autosave-status-badge');
  await page.locator('[role="tree"] [data-layer-id="box"]').click();
  const savedBefore = Number((await badge.getAttribute('data-last-saved-at')) || '0');

  await nudgeBox(page, 30);
  const firstEditAt = Date.now();
  await expect(badge).toHaveAttribute('data-save-state', 'unsaved');
  await expect(badge).toContainText('Unsaved changes');
  // Keep editing every ~1.5 s: the save must not be postponed by these edits.
  let savedAt = 0;
  while (Date.now() - firstEditAt < 16000) {
    savedAt = Number((await badge.getAttribute('data-last-saved-at')) || '0');
    if (savedAt > savedBefore) break;
    await nudgeBox(page, 10);
    await page.waitForTimeout(1500);
  }
  expect(savedAt, 'an autosave happened while editing continued').toBeGreaterThan(savedBefore);
  // Due 10 s after the first change, checked every second (+ input latency).
  expect(savedAt - firstEditAt).toBeLessThan(12500);
  expect(savedAt - firstEditAt).toBeGreaterThan(9000);

  // Stop editing: the remaining edits are saved too, and only then does it say so.
  await expect(badge).toHaveAttribute('data-save-state', 'saved', { timeout: 15000 });
  await expect(badge).toContainText(/Just saved|Saved \d+s ago/);
  const lastX = await storedX(page);
  const shownBeforeReload = await boxCentre(page);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  expect(await storedX(page)).toBe(lastX);
  const shownAfterReload = await boxCentre(page);
  expect(Math.abs(shownAfterReload.x - shownBeforeReload.x)).toBeLessThan(1.5);
});

for (const [width, height] of [[1440, 900], [1024, 768], [768, 900]] as const) {
  test(`the header does not move while the save status changes (${width}×${height})`, async ({ page }) => {
    test.setTimeout(60000);
    await seed(page, width, height);
    const badge = page.locator('.autosave-status-badge');
    const states: Record<string, Record<string, string>> = {};
    states.restored = await headerControlBoxes(page);
    await page.locator('[role="tree"] [data-layer-id="box"]').click();
    await nudgeBox(page, 20);
    await expect(badge).toHaveAttribute('data-save-state', 'unsaved');
    states.unsaved = await headerControlBoxes(page);
    await expect(badge).toHaveAttribute('data-save-state', 'saved', { timeout: 15000 });
    states.justSaved = await headerControlBoxes(page);
    await expect(badge).toContainText(/Saved \d+s ago/, { timeout: 10000 });
    states.counting = await headerControlBoxes(page);
    expect(states.unsaved).toEqual(states.restored);
    expect(states.justSaved).toEqual(states.restored);
    expect(states.counting).toEqual(states.restored);
    // No horizontal overflow and no wrapped (second-row) header.
    const layout = await page.evaluate(() => {
      const header = document.querySelector('.header-bar') as HTMLElement;
      const rows = [...header.children].map((child) => child.getBoundingClientRect()).filter((rect) => rect.width > 0);
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        headerOverflow: header.scrollWidth - header.clientWidth,
        // Every header group sits on ONE row: their vertical extents overlap.
        oneRow: rows.every((rect) => rect.top < rows[0].bottom && rect.bottom > rows[0].top),
      };
    });
    expect(layout.overflow).toBeLessThanOrEqual(0);
    expect(layout.headerOverflow).toBeLessThanOrEqual(0);
    expect(layout.oneRow).toBe(true);
  });
}
