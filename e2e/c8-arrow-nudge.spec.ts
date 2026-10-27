import { test, expect, type Page } from '@playwright/test';

/**
 * C8 #26 — the arrow keys nudge the selected layers (1 unit, Shift 10) through
 * the arrange authority. A held key is one undo step, an animated position is
 * keyed at the playhead, and the layer list keeps its own arrows.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const channel = () => ({
  x: [] as unknown[], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const layer = (id: string, name: string, x: number, y: number, zIndex: number) => ({
  id, name, type: 'custom_rect', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex, fillColor: '#22d3ee', strokeColor: '#101218',
  fillEnabled: true, strokeEnabled: false, width: 160, height: 120,
});

async function seed(page: Page): Promise<void> {
  const animated = channel();
  animated.x = [
    { id: 'bx0', frame: 0, value: 200, easing: 'linear', templateId: 'Sequence' },
    { id: 'bx30', frame: 30, value: 400, easing: 'linear', templateId: 'Sequence' },
  ];
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1',
    width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [layer('alpha', 'Alpha', -300, -100, 2), layer('beta', 'Beta', 200, 150, 1)],
    tracks: [
      { partId: 'alpha', channels: channel() },
      { partId: 'beta', channels: animated },
    ],
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: scene },
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('[data-part-id="alpha"]')).toHaveCount(1);
}

/** Saves now and returns the stored scene. */
const saved = async (page: Page) => {
  const before = await page.locator('.autosave-status-badge').getAttribute('data-last-saved-at');
  await page.locator('.autosave-status-badge').click();
  await expect
    .poll(async () => Number((await page.locator('.autosave-status-badge').getAttribute('data-last-saved-at')) || '0'), { timeout: 10_000 })
    .toBeGreaterThan(Number(before || '0'));
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
};
const layerOf = (scene: any, id: string) => scene.layers.find((entry: any) => entry.id === id);
const trackOf = (scene: any, id: string) => scene.tracks.find((entry: any) => entry.partId === id);

/** Selects a layer by clicking it on the stage, so the canvas owns the keyboard. */
const selectOnStage = async (page: Page, id: string) => {
  const box = await page.locator(`.stage-svg [data-part-id="${id}"]`).boundingBox();
  if (!box) throw new Error(`no ${id} on stage`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator(`[role="tree"] [data-layer-id="${id}"][aria-selected="true"]`)).toHaveCount(1);
};

test('arrows nudge 1 unit, Shift 10; a held key is one undo step', async ({ page }) => {
  await seed(page);
  await selectOnStage(page, 'alpha');

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  let scene = await saved(page);
  expect(layerOf(scene, 'alpha')).toMatchObject({ x: -298, y: -90 });

  // Each press was its own step: one Ctrl+Z takes back only the Shift+Down.
  await page.keyboard.press('Control+z');
  scene = await saved(page);
  expect(layerOf(scene, 'alpha')).toMatchObject({ x: -298, y: -100 });

  // A HELD key (auto-repeat) is one session and one undo step.
  await selectOnStage(page, 'alpha');
  await page.keyboard.down('ArrowLeft');
  for (let repeat = 0; repeat < 4; repeat += 1) await page.keyboard.down('ArrowLeft');
  await page.keyboard.up('ArrowLeft');
  scene = await saved(page);
  expect(layerOf(scene, 'alpha')).toMatchObject({ x: -303, y: -100 });
  await page.keyboard.press('Control+z');
  scene = await saved(page);
  expect(layerOf(scene, 'alpha')).toMatchObject({ x: -298, y: -100 });
});

test('an animated position is keyed at the playhead, without a new keyframe', async ({ page }) => {
  await seed(page);
  await selectOnStage(page, 'beta');
  await page.keyboard.press('Shift+ArrowRight');
  const scene = await saved(page);
  const keys = trackOf(scene, 'beta').channels.x.map((key: any) => [key.frame, key.value]);
  expect(keys).toEqual([[0, 210], [30, 400]]);
});

test('the layer list keeps its arrows: they walk the rows, never nudge', async ({ page }) => {
  await seed(page);
  const before = layerOf(await saved(page), 'alpha');
  await page.locator('[role="tree"] [data-layer-id="alpha"]').click();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[role="tree"] [data-layer-id="beta"]')).toBeFocused();
  const after = layerOf(await saved(page), 'alpha');
  expect({ x: after.x, y: after.y }).toEqual({ x: before.x, y: before.y });
});
