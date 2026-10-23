/**
 * C2-E — the layer tree as a professional editing surface: group rename (one
 * undo step, identity untouched, survives reload), parenting by drag and drop
 * and by keyboard with the world pose kept (Square → Triangle → Star, Circle
 * independent), refusals that say why, and a Track Matte source delete that
 * names its dependent layers first.
 */
import { expect, test, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

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
const centreOf = async (page: Page, id: string) => {
  const box = await page.locator(`.stage-svg g[data-part-id="${id}"]`).first().boundingBox();
  if (!box) throw new Error(`no stage box for ${id}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
/** Drop onto the middle (nest) or the outer quarter (before/after) of a row. */
const dragRow = async (page: Page, from: string, to: string, zone: 'before' | 'after' | 'nest') => {
  const box = await row(page, to).boundingBox();
  if (!box) throw new Error('no row');
  const y = zone === 'before' ? 2 : zone === 'after' ? box.height - 2 : box.height / 2;
  await row(page, from).dragTo(row(page, to), { targetPosition: { x: box.width / 2, y } });
};

test('a group is renamed in place: double-click, Enter saves as one undo step; F2 + Esc cancels; identity kept across reload', async ({ page }) => {
  await seed(page, [
    layer('rig', 'Rig', 'custom_rect', 40, -20, { isGroup: true, width: 10, height: 10 }),
    layer('arm', 'Arm', 'custom_rect', 30, 10, { parentId: 'rig' }),
    layer('logo', 'Logo', 'custom_circle', -200, 0),
  ]);
  const before = await savedScene(page);

  await row(page, 'rig').locator('.actor-name').dblclick();
  const input = page.getByRole('textbox', { name: 'Rename group Rig' });
  await expect(input).toBeFocused();
  await input.fill('Character Rig');
  await input.press('Enter');
  await expect(row(page, 'rig')).toContainText('Character Rig');
  await expect(row(page, 'rig')).toBeFocused();
  await expect(page.locator('.ue-track-row', { hasText: 'Character Rig' })).toHaveCount(1);
  let scene = await savedScene(page);
  const rig = scene.layers.find((entry: any) => entry.id === 'rig');
  expect(rig.name).toBe('Character Rig');
  expect(rig.isGroup).toBe(true);
  expect(scene.layers.find((entry: any) => entry.id === 'arm').parentId).toBe('rig');
  expect(scene.tracks.filter((entry: any) => entry.partId === 'rig')).toHaveLength(1);

  // F2 opens the editor; Escape leaves the name as it was and adds no history.
  await row(page, 'rig').focus();
  await page.keyboard.press('F2');
  await page.keyboard.type('Wrong');
  await page.keyboard.press('Escape');
  await expect(row(page, 'rig')).toContainText('Character Rig');

  // One Undo restores the old name, nothing else.
  await page.getByTitle('Undo').click();
  await expect(row(page, 'rig')).toContainText('Rig');
  await expect(row(page, 'rig')).not.toContainText('Character');
  scene = await savedScene(page);
  expect(scene.layers).toEqual(before.layers);

  await page.getByTitle('Redo').click();
  await savedScene(page);
  await page.reload();
  await expect(row(page, 'rig')).toContainText('Character Rig');
  expect((await savedScene(page)).layers.find((entry: any) => entry.id === 'rig').name).toBe('Character Rig');
});

test('Square → Triangle → Star by drag and keyboard keeps every pose; moving Square carries the chain, Circle stays', async ({ page }) => {
  await seed(page, [
    layer('square', 'Square', 'custom_rect', -150, -60, { rotation: 25, scaleX: 1.4, scaleY: 1.4 }),
    layer('triangle', 'Triangle', 'custom_triangle', 120, 40, { rotation: -10 }),
    layer('star', 'Star', 'custom_star', 260, -120, { scaleX: 0.8, scaleY: 0.8 }),
    layer('circle', 'Circle', 'custom_circle', -300, 150),
  ]);
  const ids = ['square', 'triangle', 'star', 'circle'];
  const at = async () => Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await centreOf(page, id)])));
  const start = await at();

  // Star → Triangle by dropping on the middle of the Triangle row.
  await dragRow(page, 'star', 'triangle', 'nest');
  await expect(row(page, 'star')).toHaveAttribute('data-parent-id', 'triangle');
  await expect(row(page, 'star')).toHaveAttribute('data-tree-depth', '1');

  // Triangle → Square from the keyboard: move it right under Square, then nest.
  await row(page, 'triangle').focus();
  await page.keyboard.press('Alt+ArrowRight');
  await expect(row(page, 'triangle')).toHaveAttribute('data-parent-id', 'square');
  await expect(row(page, 'star')).toHaveAttribute('data-tree-depth', '2');
  const nested = await at();
  for (const id of ids) {
    expect(Math.hypot(nested[id].x - start[id].x, nested[id].y - start[id].y), `${id} jumped`).toBeLessThan(0.5);
  }

  // Each nest was one undo step.
  await page.getByTitle('Undo').click();
  await expect(row(page, 'triangle')).toHaveAttribute('data-parent-id', '');
  await page.getByTitle('Redo').click();
  await expect(row(page, 'triangle')).toHaveAttribute('data-parent-id', 'square');

  // Move Square: the chain follows, Circle does not.
  await row(page, 'square').click();
  await page.getByRole('button', { name: 'Expand TRANSFORM' }).click();
  const x = page.getByLabel('Position X').first();
  const value = Number(await x.inputValue());
  await x.fill(String(value + 100));
  await x.blur();
  const moved = await at();
  for (const id of ['square', 'triangle', 'star']) expect(moved[id].x - nested[id].x, id).toBeGreaterThan(10);
  expect(moved.triangle.x - nested.triangle.x).toBeCloseTo(moved.square.x - nested.square.x, 0);
  expect(moved.star.x - nested.star.x).toBeCloseTo(moved.square.x - nested.square.x, 0);
  expect(Math.hypot(moved.circle.x - nested.circle.x, moved.circle.y - nested.circle.y)).toBeLessThan(0.5);

  // Unparent from the keyboard keeps the pose as well.
  await row(page, 'star').focus();
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(row(page, 'star')).toHaveAttribute('data-parent-id', 'square');
  const afterUnparent = await centreOf(page, 'star');
  expect(Math.hypot(afterUnparent.x - moved.star.x, afterUnparent.y - moved.star.y)).toBeLessThan(0.5);

  const scene = await savedScene(page);
  expect(scene.layers.find((entry: any) => entry.id === 'triangle').parentId).toBe('square');
  expect(scene.layers.find((entry: any) => entry.id === 'circle').parentId).toBeUndefined();
});

// C4 changed the animated-layer part of this contract (approved): an animated
// layer is no longer refused — its animation is re-based into the new parent
// (e2e/c4-reparent-animated.spec.ts). A loop is still refused with the reason.
test('the drop indicator says before / after / nest; a cycle is refused with the reason; an animated layer is re-based', async ({ page }) => {
  await seed(page, [
    layer('square', 'Square', 'custom_rect', -150, -60),
    layer('triangle', 'Triangle', 'custom_triangle', 120, 40, { parentId: 'square' }),
    layer('star', 'Star', 'custom_star', 260, -120),
  ], { star: { x: [{ id: 'k0', frame: 0, value: 260, easing: 'linear' }, { id: 'k1', frame: 30, value: 300, easing: 'linear' }] } });
  const hint = page.getByTestId('outliner-drop-hint');

  // Hover zones, checked mid-drag with real pointer events.
  const source = await row(page, 'star').boundingBox();
  const target = await row(page, 'triangle').boundingBox();
  if (!source || !target) throw new Error('rows');
  await page.mouse.move(source.x + 40, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 40, target.y + target.height / 2, { steps: 5 });
  await expect(row(page, 'triangle')).toHaveAttribute('data-drop-position', 'nest');
  await expect(row(page, 'triangle')).not.toHaveClass(/drop-blocked/);
  // C5 — nesting onto a plain layer is a transform relationship: "Parent to",
  // shown in the footer AND inside the target row before the release.
  await expect(hint).toContainText('Parent to “Triangle”');
  await expect(row(page, 'triangle').getByTestId('outliner-drop-label')).toHaveText('Parent to “Triangle”');
  await page.mouse.move(target.x + 40, target.y + target.height - 2, { steps: 3 });
  await expect(row(page, 'triangle')).toHaveAttribute('data-drop-position', 'after');
  await page.mouse.up();

  // Square onto its own child Triangle: a loop — refused, nothing written.
  const before = await savedScene(page);
  await dragRow(page, 'square', 'triangle', 'nest');
  await expect(row(page, 'square')).toHaveAttribute('data-parent-id', '');
  await expect(page.getByRole('alert').filter({ hasText: 'loop' }).first()).toBeVisible();
  expect((await savedScene(page)).layers).toEqual(before.layers);

  // The Inspector's Parent field is the keyboard alternative, and explains a refusal.
  await row(page, 'star').click();
  await openDetailsTab(page, 'Layer');
  const parent = page.getByRole('combobox', { name: 'Parent' });
  await expect(parent.locator('option')).toHaveText(['None', 'Square', 'Triangle']);
  // The animated Star is re-based into Square (asked first when keys are added).
  const starBefore = await centreOf(page, 'star');
  await parent.selectOption('square');
  const confirm = page.getByRole('button', { name: 'Re-parent' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect(parent).toHaveValue('square');
  const starAfter = await centreOf(page, 'star');
  expect(Math.abs(starAfter.x - starBefore.x)).toBeLessThan(0.5);
  expect(Math.abs(starAfter.y - starBefore.y)).toBeLessThan(0.5);
});

test('deleting a Track Matte source names its dependent layers first; Cancel keeps everything; Undo restores the relationship', async ({ page }) => {
  await seed(page, [
    layer('logo', 'Logo', 'custom_circle', 0, 0),
    layer('caption', 'Caption', 'custom_rect', 0, 0, { trackMatte: { sourceLayerId: 'logo', mode: 'alpha', sourceVisible: false } }),
    layer('plain', 'Plain', 'custom_rect', 300, 0),
  ]);
  const dialog = page.getByTestId('delete-dependents-dialog');

  // A layer nobody depends on is deleted at once — no dialog.
  await row(page, 'plain').click();
  await page.keyboard.press('Delete');
  await expect(row(page, 'plain')).toHaveCount(0);
  await expect(dialog).toHaveCount(0);

  // The source: the dialog names Caption and its relationship; Cancel changes nothing.
  await row(page, 'logo').click();
  await page.keyboard.press('Delete');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Delete “Logo”?');
  await expect(dialog.locator('[data-dependent-id="caption"]')).toContainText('Caption — Track Matte');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(row(page, 'logo')).toHaveCount(1);

  // Confirm (from the Inspector's trash, the same guard): Caption keeps the
  // relationship and reports the missing source.
  await page.getByRole('button', { name: 'Delete Actor Instance' }).click();
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(row(page, 'logo')).toHaveCount(0);
  await expect(row(page, 'caption').getByLabel('Missing track matte source')).toBeVisible();
  let scene = await savedScene(page);
  expect(scene.layers.find((entry: any) => entry.id === 'caption').trackMatte.sourceLayerId).toBe('logo');

  // One Undo: Logo is back and Caption is clipped by it again.
  await page.getByTitle('Undo').click();
  await expect(row(page, 'logo')).toHaveCount(1);
  await expect(row(page, 'caption').getByLabel('Track matte source: Logo (source hidden)')).toBeVisible();
  scene = await savedScene(page);
  expect(scene.layers.map((entry: any) => entry.id)).toEqual(['logo', 'caption']);
});
