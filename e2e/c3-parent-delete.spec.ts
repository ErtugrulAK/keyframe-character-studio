/**
 * C3 — deleting a plain (non-group) parent: its children move up to the
 * deleted layer's parent and stay exactly where they were on screen, at every
 * frame; one Undo brings the parent and the relationship back; Redo and
 * save/reload keep the result; a case that cannot keep the pose is refused
 * with the reason and deletes nothing.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const layer = (id: string, name: string, type: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id, name, type, x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#22d3ee', strokeColor: '#101218', width: 140, height: 100, ...extra,
});

async function seed(page: Page, layers: Record<string, unknown>[], trackChannels: Record<string, Record<string, unknown[]>> = {}): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers,
    tracks: layers.map((entry) => ({
      id: `track-${entry.id}`, partId: entry.id, name: entry.name, color: '#22d3ee', visible: true, locked: false, expanded: false,
      channels: { ...emptyChannels(), ...(trackChannels[entry.id as string] ?? {}) },
    })),
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: scene });
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

const row = (page: Page, id: string) => page.locator(`.tree-node[data-layer-id="${id}"]`);
/**
 * The layer's drawn pose on screen: the screen matrix of its transformed body
 * group. (Its outer group's bounding box is not used: an animated layer also
 * draws timing overlays there, which would change the box without moving the
 * layer.)
 */
type Pose = { a: number; b: number; c: number; d: number; e: number; f: number };
const boxOf = async (page: Page, id: string): Promise<Pose> => page.evaluate((partId) => {
  const body = document.querySelector(`.stage-svg g[data-part-id="${partId}"] > g[transform]`) as SVGGraphicsElement | null;
  if (!body) throw new Error(`no stage body for ${partId}`);
  const m = body.getScreenCTM()!;
  return { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f };
}, id);
const expectSameBox = (actual: Pose, expected: Pose, label: string) => {
  for (const key of ['e', 'f'] as const) expect(Math.abs(actual[key] - expected[key]), `${label}.${key}`).toBeLessThan(0.5);
  for (const key of ['a', 'b', 'c', 'd'] as const) expect(Math.abs(actual[key] - expected[key]), `${label}.${key}`).toBeLessThan(1e-3);
};
const nest = async (page: Page, from: string, to: string) => {
  const box = await row(page, to).boundingBox();
  if (!box) throw new Error('no row');
  await row(page, from).dragTo(row(page, to), { targetPosition: { x: box.width / 2, y: box.height / 2 } });
};
const seek = async (page: Page, frame: number) => {
  const ruler = page.getByRole('slider', { name: 'Playhead position' });
  await ruler.focus();
  await page.keyboard.press('Home');
  for (let step = 0; step < Math.floor(frame / 10); step += 1) await page.keyboard.press('Shift+ArrowRight');
  for (let step = 0; step < frame % 10; step += 1) await page.keyboard.press('ArrowRight');
  await expect(ruler).toHaveAttribute('aria-valuenow', String(frame));
};
const noDanglingParent = (scene: Record<string, any>) => {
  const ids = new Set(scene.layers.map((entry: any) => entry.id));
  return scene.layers.filter((entry: any) => entry.parentId && !ids.has(entry.parentId)).map((entry: any) => entry.id);
};

test('deleting Triangle (a plain parent) keeps Star in place under Square; Undo, Redo and reload agree', async ({ page }) => {
  await seed(page, [
    layer('square', 'Square', 'custom_rect', -150, -60, { rotation: 25, scaleX: 1.4, scaleY: 1.4 }),
    layer('triangle', 'Triangle', 'custom_triangle', 120, 40, { rotation: -10 }),
    layer('star', 'Star', 'custom_star', 260, -120, { scaleX: 0.8, scaleY: 0.8 }),
    layer('circle', 'Circle', 'custom_circle', -320, 160),
  ]);
  // Build the chain through the real tree (the C2 reparent path).
  await nest(page, 'triangle', 'square');
  await expect(row(page, 'triangle')).toHaveAttribute('data-parent-id', 'square');
  await nest(page, 'star', 'triangle');
  await expect(row(page, 'star')).toHaveAttribute('data-parent-id', 'triangle');
  const star = await boxOf(page, 'star');
  const circle = await boxOf(page, 'circle');
  const chained = await savedScene(page);

  await row(page, 'triangle').click();
  await page.keyboard.press('Delete');
  await expect(row(page, 'triangle')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: '1 child layer kept its place' }).first()).toBeVisible();
  await expect(row(page, 'star')).toHaveAttribute('data-parent-id', 'square');
  expectSameBox(await boxOf(page, 'star'), star, 'star after delete');
  expectSameBox(await boxOf(page, 'circle'), circle, 'circle after delete');
  let scene = await savedScene(page);
  expect(noDanglingParent(scene)).toEqual([]);
  expect(scene.layers.find((entry: any) => entry.id === 'star').parentId).toBe('square');

  // One Undo restores Triangle and the original chain exactly.
  await page.getByTitle('Undo').click();
  await expect(row(page, 'triangle')).toHaveCount(1);
  await expect(row(page, 'star')).toHaveAttribute('data-parent-id', 'triangle');
  scene = await savedScene(page);
  expect(scene.layers).toEqual(chained.layers);
  expect(scene.tracks).toEqual(chained.tracks);
  expectSameBox(await boxOf(page, 'star'), star, 'star after undo');

  // Redo deletes it again; reload keeps the result.
  await page.getByTitle('Redo').click();
  await expect(row(page, 'triangle')).toHaveCount(0);
  await savedScene(page);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await expect(row(page, 'star')).toHaveAttribute('data-parent-id', 'square');
  expectSameBox(await boxOf(page, 'star'), star, 'star after reload');
  expect(noDanglingParent(await savedScene(page))).toEqual([]);
});

test('an animated parent is baked into its child: same screen position at several frames after the delete', async ({ page }) => {
  await seed(page, [
    layer('rig', 'Rig', 'custom_rect', -100, 0),
    layer('hand', 'Hand', 'custom_circle', 60, 30, { parentId: 'rig' }),
  ], {
    rig: {
      x: [{ id: 'rx0', frame: 0, value: -100, easing: 'easeInOut' }, { id: 'rx1', frame: 40, value: 200, easing: 'easeInOut' }],
      rotation: [{ id: 'rr0', frame: 0, value: 0, easing: 'linear' }, { id: 'rr1', frame: 40, value: 90, easing: 'linear' }],
    },
  });
  const frames = [0, 13, 27, 40, 55];
  const before: Record<number, Pose> = {};
  for (const frame of frames) {
    await seek(page, frame);
    before[frame] = await boxOf(page, 'hand');
  }
  const beforeDelete = await savedScene(page);
  await row(page, 'rig').click();
  await page.keyboard.press('Delete');
  // The keyframes the delete will add are announced first; Cancel changes nothing.
  const dialog = page.getByTestId('delete-dependents-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-baked-child-id="hand"]')).toContainText(/Hand — 0 → \d+ keyframes \(one per frame/);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row(page, 'rig')).toHaveCount(1);
  expect((await savedScene(page)).tracks).toEqual(beforeDelete.tracks);
  // Confirmed: the delete runs.
  await row(page, 'rig').click();
  await page.keyboard.press('Delete');
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(row(page, 'rig')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'baked' }).first()).toBeVisible();
  for (const frame of frames) {
    await seek(page, frame);
    expectSameBox(await boxOf(page, 'hand'), before[frame], `hand@${frame}`);
  }
  const baked = await savedScene(page);
  expect(noDanglingParent(baked)).toEqual([]);
  // The motion now lives in the child's canonical channels (one sequence scope).
  const handTrack = baked.tracks.find((entry: any) => entry.partId === 'hand');
  expect(handTrack.channels.x.length).toBeGreaterThan(1);
  expect(handTrack.channels.rotation.length).toBeGreaterThan(1);

  // One Undo: Rig and its keys are back, Hand is its child with an empty track again.
  await page.getByTitle('Undo').click();
  await expect(row(page, 'rig')).toHaveCount(1);
  await expect(row(page, 'hand')).toHaveAttribute('data-parent-id', 'rig');
  const undone = await savedScene(page);
  expect(undone.tracks.find((entry: any) => entry.partId === 'hand').channels.x).toEqual([]);
  // Redo and a reload give back the baked result, still exact on screen.
  await page.getByTitle('Redo').click();
  await expect(row(page, 'rig')).toHaveCount(0);
  await savedScene(page);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  for (const frame of frames) {
    await seek(page, frame);
    expectSameBox(await boxOf(page, 'hand'), before[frame], `hand@${frame} after redo + reload`);
  }
});

test('a delete that cannot keep the child in place is refused with the reason and deletes nothing', async ({ page }) => {
  // A rotated parent with a non-uniform scale gives a rotated child a skewed
  // world pose, which a layer's own transform cannot store.
  await seed(page, [
    layer('frame', 'Frame', 'custom_rect', 100, 50, { rotation: 30, scaleX: 3, scaleY: 1 }),
    layer('badge', 'Badge', 'custom_rect', 20, 0, { parentId: 'frame', rotation: 45 }),
  ]);
  const before = await savedScene(page);
  const pose = await boxOf(page, 'badge');
  await row(page, 'frame').click();
  await page.keyboard.press('Delete');
  await expect(page.getByRole('alert').filter({ hasText: 'skew' }).first()).toBeVisible();
  expectSameBox(await boxOf(page, 'badge'), pose, 'badge');
  await expect(row(page, 'frame')).toHaveCount(1);
  const after = await savedScene(page);
  expect(after.layers).toEqual(before.layers);
});

test('deleting a group keeps the existing contract: its layers go with it', async ({ page }) => {
  await seed(page, [
    layer('rig', 'Rig', 'custom_rect', 40, -20, { isGroup: true, width: 10, height: 10 }),
    layer('arm', 'Arm', 'custom_rect', 30, 10, { parentId: 'rig' }),
    layer('logo', 'Logo', 'custom_circle', -200, 0),
  ]);
  await row(page, 'rig').click();
  await page.keyboard.press('Delete');
  // C5 — the layers that go with the group are named first (one dialog).
  const dialog = page.getByTestId('delete-dependents-dialog');
  await expect(dialog.getByTestId('delete-owned-list')).toHaveText(/Arm/);
  await dialog.getByRole('button', { name: 'Delete 2 layers' }).click();
  await expect(row(page, 'rig')).toHaveCount(0);
  await expect(row(page, 'arm')).toHaveCount(0);
  await expect(row(page, 'logo')).toHaveCount(1);
});
