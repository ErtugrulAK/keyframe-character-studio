/**
 * C3 — every window size opens with a usable stage (≥ 400 CSS px). The left
 * dock that once had to close for it is gone; moving the Inspector never
 * re-frames a camera the user has zoomed.
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
const inspectorToggle = (page: Page) => page.locator('.inspector-dock-toggle');

// The left dock is gone (the menu bar and the toolbar replaced it), so even a
// narrow window opens with the whole width left of the Inspector for the stage.
for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 720 }, { width: 720, height: 450 }]) {
  test(`${size.width}×${size.height} opens with no left dock and a ≥ 400 px stage, the box centred`, async ({ page }) => {
    await open(page, size.width, size.height);
    await expect(page.locator('.left-toolbar-toggle, .left-toolbar-container')).toHaveCount(0);
    await expect(inspectorToggle(page)).toHaveAttribute('aria-expanded', 'true');
    expect(await stageWidth(page)).toBeGreaterThanOrEqual(400);
    const stage = await page.locator('.stage-canvas-container').boundingBox();
    const centred = await boxCentre(page);
    expect(Math.abs(centred.x - (stage!.x + stage!.width / 2))).toBeLessThan(1);
  });
}

test('a narrow window keeps a camera the user has already zoomed when the Inspector moves', async ({ page }) => {
  await open(page, 720, 450);
  // (C4: at 720 px the View band is a menu)
  await page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Zoom in' }).click();
  const zoomed = await page.locator('.stage-canvas-container').getAttribute('data-camera-zoom');
  await inspectorToggle(page).click();
  await inspectorToggle(page).click();
  await expect(page.locator('.stage-canvas-container')).toHaveAttribute('data-camera-zoom', zoomed!);
});
