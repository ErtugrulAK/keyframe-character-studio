/**
 * C4 — re-parenting an animated layer in the browser. Nesting a moving layer
 * into a ROTATING parent re-bases its animation: the user is told first (layer,
 * key counts, per-frame bake) and Cancel writes nothing; Confirm keeps the
 * layer exactly where it was on screen at every inspected frame, is one undo
 * step (redo too), and survives save/reload. Unparenting it back keeps the
 * place as well.
 */
import { expect, test, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const EMPTY = () => ({ x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [], trimPathStart: [], trimPathEnd: [], trimPathOffset: [] });
const rect = (id: string, name: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id, name, type: 'custom_rect', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#22d3ee', strokeColor: '#101218', width: 80, height: 50, ...extra,
});

async function open(page: Page): Promise<void> {
  const layers = [rect('wheel', 'Wheel', -100, 0, { width: 200, height: 200 }), rect('ball', 'Ball', 200, 80)];
  const scene = {
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers,
    tracks: [
      { id: 'track-wheel', partId: 'wheel', name: 'Wheel', color: '#22d3ee', visible: true, locked: false, expanded: false,
        channels: { ...EMPTY(), rotation: [{ id: 'w0', frame: 0, value: 0, easing: 'linear' }, { id: 'w1', frame: 30, value: 90, easing: 'linear' }] } },
      { id: 'track-ball', partId: 'ball', name: 'Ball', color: '#22d3ee', visible: true, locked: false, expanded: false,
        channels: { ...EMPTY(), x: [{ id: 'b0', frame: 0, value: 200, easing: 'easeInOut' }, { id: 'b1', frame: 30, value: 350, easing: 'easeInOut' }] } },
    ],
  };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

const centreOf = async (page: Page, id: string) => {
  const box = await page.locator(`.stage-svg g[data-part-id="${id}"]`).first().boundingBox();
  if (!box) throw new Error(id);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const seek = async (page: Page, frame: number) => {
  const ruler = page.getByRole('slider', { name: 'Playhead position' });
  await ruler.focus();
  await page.keyboard.press('Home');
  for (let index = 0; index < frame; index += 1) await page.keyboard.press('ArrowRight');
  await expect(ruler).toHaveAttribute('aria-valuenow', String(frame));
};
const FRAMES = [0, 9, 15, 23, 30, 40];
const ballPath = async (page: Page) => {
  const points: { x: number; y: number }[] = [];
  for (const frame of FRAMES) {
    await seek(page, frame);
    points.push(await centreOf(page, 'ball'));
  }
  return points;
};
const expectSamePath = (actual: { x: number; y: number }[], expected: { x: number; y: number }[], label: string) => {
  actual.forEach((point, index) => {
    expect(Math.abs(point.x - expected[index].x), `${label} x @${FRAMES[index]}`).toBeLessThan(0.75);
    expect(Math.abs(point.y - expected[index].y), `${label} y @${FRAMES[index]}`).toBeLessThan(0.75);
  });
};

test('nesting a moving layer into a rotating parent: asked first, Cancel writes nothing, Confirm keeps the screen path; Undo/Redo; reload', async ({ page }) => {
  await open(page);
  const original = await ballPath(page);
  const before = await savedScene(page);

  await page.locator('[role="tree"] [data-layer-id="ball"]').click();
  await openDetailsTab(page, 'Layer');
  const parent = page.getByRole('combobox', { name: 'Parent' });
  await parent.selectOption('wheel');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Re-base the animation of “Ball”');
  await expect(dialog).toContainText(/\d+ → \d+ keyframes/);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(parent).toHaveValue('');
  expect((await savedScene(page)).tracks).toEqual(before.tracks);

  await parent.selectOption('wheel');
  await page.getByRole('dialog').getByRole('button', { name: 'Re-parent' }).click();
  await expect(parent).toHaveValue('wheel');
  expectSamePath(await ballPath(page), original, 'nested');
  const saved = await savedScene(page);
  expect(saved.layers.find((layer: { id: string }) => layer.id === 'ball').parentId).toBe('wheel');

  // One undo step back, one redo forward.
  await page.locator('.stage-canvas-container').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+z');
  expect((await savedScene(page)).layers.find((layer: { id: string }) => layer.id === 'ball').parentId).toBeUndefined();
  expectSamePath(await ballPath(page), original, 'undone');
  await page.locator('.stage-canvas-container').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+y');
  expect((await savedScene(page)).layers.find((layer: { id: string }) => layer.id === 'ball').parentId).toBe('wheel');

  // Saved and reloaded: the same path.
  await savedScene(page);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  expectSamePath(await ballPath(page), original, 'reloaded');

  // Unparent again (keyboard, tree): still the same path.
  await page.locator('[role="tree"] [data-layer-id="ball"]').focus();
  await page.keyboard.press('Alt+ArrowLeft');
  const confirm = page.getByRole('dialog').getByRole('button', { name: 'Re-parent' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect.poll(async () => (await savedScene(page)).layers.find((layer: { id: string }) => layer.id === 'ball').parentId).toBeUndefined();
  expectSamePath(await ballPath(page), original, 'unparented');
});
