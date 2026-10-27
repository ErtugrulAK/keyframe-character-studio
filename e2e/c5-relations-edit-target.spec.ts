/**
 * C5 — group / parent / Track Matte read as three different relationships, and
 * the editor always says what is being edited.
 *
 * - Group = container: Delete names the layers it takes (one dialog), the menu
 *   says so before. Parent = transform: its children are kept, the menu says so.
 * - Layer drag: a line between rows reorders; the middle of a row shows "Parent
 *   to …" / "Move into group …" INSIDE the target row; a refused target shows
 *   its reason — all before the release.
 * - The canvas strip and the Inspector name the same target (layer, mask path,
 *   matte source, new shape), and the strip never takes a stage press.
 */
import { expect, test, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});
const layer = (id: string, name: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id, name, type: 'custom_rect', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#22d3ee', strokeColor: '#101218', width: 120, height: 90, ...extra,
});
const rectPath = {
  version: 1, coordinateSpace: 'normalized', closed: true,
  points: [{ id: 'v0', x: 0.2, y: 0.2, kind: 'corner' }, { id: 'v1', x: 0.8, y: 0.2, kind: 'corner' }, { id: 'v2', x: 0.8, y: 0.8, kind: 'corner' }, { id: 'v3', x: 0.2, y: 0.8, kind: 'corner' }],
};

async function seed(page: Page, layers: Record<string, unknown>[], height = 900): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers,
    tracks: layers.map((entry) => ({ id: `track-${entry.id}`, partId: entry.id, name: entry.name, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() })),
  });
  await page.setViewportSize({ width: 1440, height });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const row = (page: Page, id: string) => page.locator(`.tree-node[data-layer-id="${id}"]`);
const scene = () => [
  layer('rig', 'Rig', 0, 0, { isGroup: true, width: 10, height: 10 }),
  layer('arm', 'Arm', -200, -60, { parentId: 'rig' }),
  layer('leg', 'Leg', -200, 60, { parentId: 'rig' }),
  layer('sun', 'Sun', 200, -60),
  layer('ray', 'Ray', 260, -60, { parentId: 'sun' }),
  layer('pin', 'Pin', -300, 200, { boundPartIds: ['sun'], zIndex: 0 }),
  layer('logo', 'Logo', 200, 120, { masks: [{ id: 'm1', name: 'Window', mode: 'add', enabled: true, opacity: 1, feather: 0, expansion: 0, path: rectPath }] }),
];

/**
 * Moves an open native drag over `to` at a zone. Chromium throttles dragover
 * (about one per 50 ms), so a fast synthetic move can end before the last
 * position is delivered; the pointer keeps nudging (1 px, inside the same zone)
 * until the row reports the zone — real pointer events, no fixed wait.
 */
async function moveDragTo(page: Page, to: string, zone: 'before' | 'after' | 'nest'): Promise<void> {
  const target = await row(page, to).boundingBox();
  if (!target) throw new Error('row');
  const y = zone === 'before' ? target.y + 2 : zone === 'after' ? target.y + target.height - 3 : target.y + target.height / 2;
  await page.mouse.move(target.x + 40, y, { steps: 4 });
  let nudge = 0;
  await expect.poll(async () => {
    nudge = 1 - nudge;
    await page.mouse.move(target.x + 40 + nudge, y);
    return row(page, to).getAttribute('data-drop-position');
  }).toBe(zone);
}

/** Starts a native drag on `from` and holds it over `to` at a zone. */
async function dragOver(page: Page, from: string, to: string, zone: 'before' | 'after' | 'nest'): Promise<void> {
  const source = await row(page, from).boundingBox();
  if (!source) throw new Error('row');
  await page.mouse.move(source.x + 40, source.y + source.height / 2);
  await page.mouse.down();
  // The drag begins with the first move; the target zone is reached after it.
  await page.mouse.move(source.x + 40, source.y + source.height / 2 - 6, { steps: 2 });
  await moveDragTo(page, to, zone);
}

test('drag: a line reorders, the row middle says "Parent to …" or "Move into group …", a refused target says why', async ({ page }) => {
  await seed(page, scene());
  // Every row on screen (a native drag does not auto-scroll the list): the
  // user gives the layer list the room with the splitter's End key.
  await page.getByRole('separator', { name: 'Resize layer list and Details' }).focus();
  await page.keyboard.press('End');
  await expect(row(page, 'logo')).toBeInViewport({ ratio: 1 });
  const hint = page.getByTestId('outliner-drop-hint');

  await dragOver(page, 'logo', 'sun', 'nest');
  await expect(row(page, 'sun')).toHaveClass(/drop-nest/);
  await expect(row(page, 'sun').getByTestId('outliner-drop-label')).toHaveText('Parent to “Sun”');
  await expect(hint).toHaveText('Parent to “Sun”');
  // Into a group: a container, not a transform parent.
  await moveDragTo(page, 'rig', 'nest');
  await expect(row(page, 'rig')).toHaveAttribute('data-drop-position', 'nest');
  await expect(row(page, 'rig').getByTestId('outliner-drop-label')).toHaveText('Move into group “Rig”');
  // The edge of a row inside the group: a reorder line, and the hint names the new parent.
  await moveDragTo(page, 'arm', 'before');
  await expect(row(page, 'arm')).toHaveAttribute('data-drop-position', 'before');
  await expect(row(page, 'arm').getByTestId('outliner-drop-label')).toHaveCount(0);
  await expect(hint).toHaveText('Place above “Arm” · into group “Rig”');
  // Released outside the tree: no drop, nothing changes.
  const stage = (await page.locator('.stage-canvas-container').boundingBox())!;
  await page.mouse.move(stage.x + 30, stage.y + stage.height / 2, { steps: 4 });
  await page.mouse.move(stage.x + 31, stage.y + stage.height / 2);
  await page.mouse.up();
  await expect(hint).toHaveText('');
  await expect(row(page, 'logo')).toHaveAttribute('data-tree-depth', '0');

  // A layer bonded to Sun cannot be parented to it (it would move twice):
  // refused, the reason is in the target row before the release, and nothing changes.
  await dragOver(page, 'pin', 'sun', 'nest');
  await expect(row(page, 'sun')).toHaveClass(/drop-blocked/);
  await expect(row(page, 'sun').getByTestId('outliner-drop-label')).toContainText('bonded');
  await expect(hint).toContainText('Cannot drop here');
  await page.mouse.up();
  await expect(row(page, 'pin')).toHaveAttribute('data-tree-depth', '0');
});

test('delete: a group names the layers it takes; a parent keeps its children — said before the delete', async ({ page }) => {
  await seed(page, scene());
  const menuItem = (name: string | RegExp) => page.getByRole('menuitem', { name });

  // The menu names the scope before anything happens.
  await row(page, 'rig').click({ button: 'right' });
  await expect(menuItem('Delete Group and 2 Layers')).toBeVisible();
  await page.keyboard.press('Escape');
  await row(page, 'sun').click({ button: 'right' });
  await expect(menuItem('Delete (Keeps 1 Child)')).toBeVisible();
  // A parent with kept children and nothing else to say: no dialog, the child stays.
  await menuItem('Delete (Keeps 1 Child)').click();
  await expect(page.getByTestId('delete-dependents-dialog')).toHaveCount(0);
  await expect(row(page, 'sun')).toHaveCount(0);
  await expect(row(page, 'ray')).toHaveAttribute('data-tree-depth', '0');

  // The group: ONE dialog listing its layers; Cancel keeps everything.
  await row(page, 'rig').click();
  await page.keyboard.press('Delete');
  const dialog = page.getByTestId('delete-dependents-dialog');
  await expect(dialog.getByTestId('delete-owned-list')).toHaveText(/Arm[\s\S]*Leg/);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(row(page, 'arm')).toHaveCount(1);
  await row(page, 'rig').click();
  await page.keyboard.press('Delete');
  await dialog.getByRole('button', { name: 'Delete 3 layers' }).click();
  await expect(row(page, 'rig')).toHaveCount(0);
  await expect(row(page, 'arm')).toHaveCount(0);
  await expect(row(page, 'leg')).toHaveCount(0);
  // One undo brings the group and its layers back.
  await page.locator('.stage-canvas-container').click({ position: { x: 20, y: 300 } });
  await page.keyboard.press('Control+z');
  await expect(row(page, 'arm')).toHaveCount(1);
  await expect(row(page, 'leg')).toHaveCount(1);
});

test('the strip and the Inspector name the same target; the strip never takes a stage press', async ({ page }) => {
  await seed(page, scene());
  const strip = page.locator('.edit-target-strip');
  await row(page, 'logo').click();
  await expect(strip).toHaveAttribute('data-edit-target', 'layer');
  await expect(strip).toContainText('Layer');
  await expect(strip).toContainText('Logo');
  await expect(page.getByTestId('inspector-edit-target')).toHaveCount(0);

  // The strip is chrome: a press on its text reaches what is under it.
  const hit = await strip.evaluate((node) => {
    const box = node.querySelector('.mask-edit-banner-path')!.getBoundingClientRect();
    const under = document.elementFromPoint(box.left + 4, box.top + box.height / 2);
    return { pointerEvents: getComputedStyle(node).pointerEvents, insideStrip: Boolean(under?.closest('.edit-target-strip')) };
  });
  expect(hit).toEqual({ pointerEvents: 'none', insideStrip: false });

  // Mask path editing: the strip, the Inspector and the canvas outline agree.
  await openDetailsTab(page, 'Masks');
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
  await page.getByRole('button', { name: 'Edit on Canvas' }).click();
  await expect(page.getByTestId('mask-path-overlay')).toBeVisible();
  await expect(strip).toHaveAttribute('data-edit-target', 'mask');
  await expect(strip.locator('.mask-edit-banner-path')).toHaveText('Logo / Window');
  await expect(page.getByTestId('inspector-edit-target')).toContainText('Mask editing');
  await expect(page.getByTestId('inspector-edit-target')).toContainText('Logo / Window');
  await strip.getByRole('button', { name: /^Finish mask editing/ }).click();
  await expect(page.getByTestId('mask-path-overlay')).toHaveCount(0);
  await expect(strip).toHaveAttribute('data-edit-target', 'layer');
  await expect(page.locator('.tree-node[data-layer-id="logo"]')).toHaveAttribute('aria-selected', 'true');

  // Esc does the same as Finish: one level, back to the layer.
  await page.getByRole('button', { name: 'Edit on Canvas' }).click();
  await expect(strip).toHaveAttribute('data-edit-target', 'mask');
  await page.keyboard.press('Escape');
  await expect(strip).toHaveAttribute('data-edit-target', 'layer');

  // A new-shape tool armed: the strip says so; Esc leaves the tool.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Vector Shapes & Graphic Elements' }).click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await expect(strip).toHaveAttribute('data-edit-target', 'new-shape');
  await expect(strip).toContainText('Rectangle');
});

// C10: the strip shows only the way back — no "Matte source · matte of …" caption.
test('matte source: the strip offers the way back to the target layer and nothing else', async ({ page }) => {
  await seed(page, [
    layer('photo', 'Photo', 0, 0, { width: 300, height: 200, trackMatte: { sourceLayerId: 'circle', mode: 'alpha', sourceVisible: false } }),
    layer('circle', 'Circle', 0, 0, { type: 'custom_circle', zIndex: 2 }),
  ]);
  await row(page, 'photo').click();
  await openDetailsTab(page, 'Masks');
  await page.getByRole('button', { name: 'Select Source' }).click();
  const strip = page.locator('.edit-target-strip');
  await expect(strip).toHaveAttribute('data-edit-target', 'matte-source');
  await expect(strip).toHaveText('Back to Photo');
  await expect(page.getByTestId('inspector-edit-target')).toHaveCount(0);
  await strip.getByRole('button', { name: 'Back to Photo' }).click();
  await expect(row(page, 'photo')).toHaveAttribute('aria-selected', 'true');
  await expect(strip).toHaveAttribute('data-edit-target', 'layer');
});



