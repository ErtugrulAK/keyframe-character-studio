/**
 * C4 — mask path structure commands in the browser: the Closed switch, Reverse
 * direction, Make first point and the point-order moves. Each is one undo step,
 * keeps the owner layer where it is, keeps the selected point (by identity),
 * survives save/reload, and on an animated path rewrites every keyframe the
 * same way so the animation keeps interpolating. An open mask still masks, and
 * the canvas draws its implied closing edge.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});
const IMAGE = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#3b82f6"/></svg>',
).toString('base64')}`;
const shape = (dx = 0) => ({
  version: 1, coordinateSpace: 'normalized', closed: true,
  points: [
    { id: 'a', x: 0.2 + dx, y: 0.2, kind: 'corner' },
    { id: 'b', x: 0.8 + dx, y: 0.2, kind: 'smooth', handleIn: { x: 0.7 + dx, y: 0.1 }, handleOut: { x: 0.9 + dx, y: 0.3 } },
    { id: 'c', x: 0.8 + dx, y: 0.8, kind: 'corner' },
    { id: 'd', x: 0.2 + dx, y: 0.8, kind: 'corner' },
  ],
});

async function seed(page: Page, trackExtra: Record<string, unknown> = {}): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [{ id: 'img', name: 'Landscape', type: 'custom_image', x: 40, y: 10, rotation: 20, scaleX: 1.2, scaleY: 0.9, opacity: 1, visible: true, zIndex: 1, fillColor: '#fff', strokeColor: '#000', width: 600, height: 300, imageUrl: IMAGE, masks: [{ id: 'm1', name: 'Window', mode: 'add', enabled: true, path: shape() }] }],
    tracks: [{ id: 'track-img', partId: 'img', name: 'img', color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels(), ...trackExtra }],
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().click();
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
  await page.getByRole('button', { name: 'Edit on Canvas' }).click();
}

async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

const ids = (path: { points: { id: string }[] }) => path.points.map((point) => point.id);
const maskOf = (scene: Record<string, any>) => scene.layers[0].masks[0];
const layerBox = (page: Page) => page.locator('.stage-svg g[data-part-id="img"]').first().boundingBox();

test('Reverse direction, Make first point and the order moves: named, undoable, selection kept, layer unmoved', async ({ page }) => {
  await seed(page);
  const editor = page.getByTestId('bezier-path-editor');
  const box = await layerBox(page);
  await page.getByTestId('mask-vertex').nth(1).click(); // point "b"
  await expect(editor).toContainText('Point 2 of 4');

  await editor.getByRole('button', { name: 'Reverse direction' }).click();
  let mask = maskOf(await savedScene(page));
  expect(ids(mask.path)).toEqual(['a', 'd', 'c', 'b']);
  expect(mask.path.points[3]).toMatchObject({ id: 'b', kind: 'smooth', handleIn: { x: 0.9, y: 0.3 }, handleOut: { x: 0.7, y: 0.1 } });
  await expect(editor).toContainText('Point 4 of 4'); // "b" stays selected

  await editor.getByRole('button', { name: 'Make first point' }).click();
  mask = maskOf(await savedScene(page));
  expect(ids(mask.path)).toEqual(['b', 'a', 'd', 'c']);
  await expect(editor).toContainText('Point 1 of 4');

  await editor.getByRole('button', { name: 'Move point later in the path order' }).click();
  mask = maskOf(await savedScene(page));
  expect(ids(mask.path)).toEqual(['a', 'b', 'd', 'c']);
  await expect(editor).toContainText('Point 2 of 4');

  // The owner layer never moved; each command was one undo step.
  const after = await layerBox(page);
  expect(Math.abs(after!.x - box!.x)).toBeLessThan(0.5);
  for (const expected of [['b', 'a', 'd', 'c'], ['a', 'd', 'c', 'b'], ['a', 'b', 'c', 'd']]) {
    await page.keyboard.press('Escape'); // leave mask editing so Undo reaches the scene
    await page.keyboard.press('Control+z');
    expect(ids(maskOf(await savedScene(page)).path)).toEqual(expected);
  }
});

test('Closed path switch: an open mask keeps its points and still masks; the canvas draws the implied edge; reload keeps it', async ({ page }) => {
  await seed(page);
  const editor = page.getByTestId('bezier-path-editor');
  const closed = editor.getByRole('switch', { name: 'Closed path' });
  await expect(closed).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('mask-path-implied-edge')).toHaveCount(0);
  await closed.click();
  await expect(closed).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('mask-path-implied-edge')).toBeVisible();
  await expect(editor.getByTestId('open-path-note')).toContainText('still fills');
  await expect(editor.getByRole('button', { name: 'Make first point' })).toBeDisabled();

  const mask = maskOf(await savedScene(page));
  expect(mask.path.closed).toBe(false);
  expect(mask.path.points).toEqual(shape().points);
  // The rendered mask still has its fill geometry (no Z, filled by the SVG rule).
  const maskPath = page.locator('.stage-svg mask path[d]').first();
  await expect(maskPath).toHaveAttribute('d', /^M /);
  expect(await maskPath.getAttribute('d')).not.toMatch(/Z\s*$/);

  await page.reload();
  await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().click();
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
  await expect(page.getByTestId('bezier-path-editor').getByRole('switch', { name: 'Closed path' })).toHaveAttribute('aria-checked', 'false');
});

test('on an animated path every keyframe is rewritten the same way and keeps interpolating; one Undo restores all', async ({ page }) => {
  await seed(page, {
    maskPathChannels: { 'm1:path': [
      { id: 'k0', frame: 0, value: shape(), easing: 'easeIn', templateId: 'Sequence' },
      { id: 'k20', frame: 20, value: shape(0.05), easing: 'linear', templateId: 'Sequence' },
    ] },
  });
  const editor = page.getByTestId('bezier-path-editor');
  await expect(editor.getByRole('button', { name: 'Add vertex' })).toBeDisabled();
  await editor.getByRole('button', { name: 'Reverse direction' }).click();
  const scene = await savedScene(page);
  const keys = scene.tracks[0].maskPathChannels['m1:path'];
  expect(keys.map((key: any) => [key.id, key.frame, key.easing])).toEqual([['k0', 0, 'easeIn'], ['k20', 20, 'linear']]);
  for (const key of keys) expect(ids(key.value)).toEqual(['a', 'd', 'c', 'b']);
  expect(ids(maskOf(scene).path)).toEqual(['a', 'd', 'c', 'b']);
  expect(keys[1].value.points[1].x).toBeCloseTo(0.25, 9); // the frame-20 geometry, reordered, not replaced

  // Between the keys the mask is still drawn (interpolated, not snapped away).
  await page.keyboard.press('Escape');
  const ruler = page.getByRole('slider', { name: 'Playhead position' });
  await ruler.focus();
  for (let index = 0; index < 10; index += 1) await page.keyboard.press('ArrowRight');
  await expect(page.locator('.stage-svg mask path[d]').first()).toHaveAttribute('d', /^M /);

  await page.locator('.stage-canvas-container').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+z');
  const undone = await savedScene(page);
  for (const key of undone.tracks[0].maskPathChannels['m1:path']) expect(ids(key.value)).toEqual(['a', 'b', 'c', 'd']);
  expect(ids(maskOf(undone).path)).toEqual(['a', 'b', 'c', 'd']);
});
