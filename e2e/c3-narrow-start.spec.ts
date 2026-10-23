/**
 * C3 — a narrow window opens with the left dock closed when the stage would
 * otherwise be narrower than 400 CSS px; wider windows open exactly as before.
 * The decision is taken once: the user can open the dock afterwards and it
 * stays open; opening it never moves the authored world.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

async function open(page: Page, width: number, height: number): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [{ id: 'box', name: 'Box', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#f97316', strokeColor: '#000', width: 200, height: 120 }],
    tracks: [{ id: 'track-box', partId: 'box', name: 'Box', color: '#22d3ee', visible: true, locked: false, expanded: false, channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [], trimPathStart: [], trimPathEnd: [], trimPathOffset: [] } }],
  });
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const stageWidth = (page: Page) => page.locator('.stage-canvas-container').evaluate((node) => node.getBoundingClientRect().width);
const boxCentre = async (page: Page) => {
  const box = await page.locator('.stage-svg g[data-part-id="box"]').first().boundingBox();
  if (!box) throw new Error('no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, w: box.width };
};
const leftToggle = (page: Page) => page.locator('.left-toolbar-toggle');
/** The dock edge has finished travelling: the stylesheet owns its width again. */
const dockSettled = (page: Page) => expect.poll(() => page.locator('#left-toolbar-panel').evaluate((node) => (node as HTMLElement).style.width)).toBe('');

for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 720 }]) {
  test(`${size.width}×${size.height} opens with both docks, as before`, async ({ page }) => {
    await open(page, size.width, size.height);
    await expect(leftToggle(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.inspector-dock-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(await stageWidth(page)).toBeGreaterThanOrEqual(400);
  });
}

test('720×450 opens with the left dock closed and a ≥ 400 px stage; the user can open it and it stays open', async ({ page }) => {
  await open(page, 720, 450);
  await expect(leftToggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(leftToggle(page)).toHaveAccessibleName('Show Left Toolbar');
  expect(await stageWidth(page)).toBeGreaterThanOrEqual(400);
  // The untouched opening camera was fitted to the wider stage: the box is centred.
  const stage = await page.locator('.stage-canvas-container').boundingBox();
  const centred = await boxCentre(page);
  expect(Math.abs(centred.x - (stage!.x + stage!.width / 2))).toBeLessThan(1);

  // The user opens the dock (mouse) — the world does not move, and nothing closes it again.
  const before = await boxCentre(page);
  await leftToggle(page).click();
  await expect(leftToggle(page)).toHaveAttribute('aria-expanded', 'true');
  await dockSettled(page);
  const after = await boxCentre(page);
  expect(Math.abs(after.x - before.x)).toBeLessThan(0.5);
  expect(Math.abs(after.y - before.y)).toBeLessThan(0.5);
  expect(Math.abs(after.w - before.w)).toBeLessThan(0.5);
  // Editing (selection, a timeline seek) never re-closes it.
  await page.locator('[role="tree"] [data-layer-id="box"]').click(); // (C4: the 720×450 timeline opens collapsed)
  // (C4: expanding the collapsed timeline is the user's own choice, then a seek)
  await page.getByTestId('timeline-collapse-toggle').click();
  const ruler = page.getByRole('slider', { name: 'Playhead position' });
  await ruler.focus();
  await page.keyboard.press('ArrowRight');
  await expect(leftToggle(page)).toHaveAttribute('aria-expanded', 'true');
  // Keyboard can close and reopen it.
  await leftToggle(page).focus();
  await page.keyboard.press('Enter');
  await expect(leftToggle(page)).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(leftToggle(page)).toHaveAttribute('aria-expanded', 'true');
});

test('a narrow start keeps a camera the user has already zoomed (no refit after the user acted)', async ({ page }) => {
  await open(page, 720, 450);
  // (C4: at 720 px the View band is a menu)
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Zoom in' }).click();
  const zoomed = await page.locator('.stage-canvas-container').getAttribute('data-camera-zoom');
  await leftToggle(page).click();
  await dockSettled(page);
  await leftToggle(page).click();
  await dockSettled(page);
  await expect(page.locator('.stage-canvas-container')).toHaveAttribute('data-camera-zoom', zoomed!);
});
