/**
 * C2 — the Inspector mask path editor as a support surface for canvas
 * editing: the point picked on the canvas is the Inspector's selected point,
 * its real Corner/Smooth type is shown and changed in place (neighbours, owner
 * and key metadata untouched), and topology edits on an animated path are
 * refused with the reason.
 */
import { expect, test, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const IMAGE = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#3b82f6"/></svg>',
).toString('base64')}`;

const rect = {
  version: 1, coordinateSpace: 'normalized', closed: true,
  points: [{ id: 'a', x: 0.2, y: 0.2, kind: 'corner' }, { id: 'b', x: 0.8, y: 0.2, kind: 'corner' }, { id: 'c', x: 0.8, y: 0.8, kind: 'corner' }, { id: 'd', x: 0.2, y: 0.8, kind: 'corner' }],
};

async function seed(page: Page, trackExtra: Record<string, unknown> = {}): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [{ id: 'img', name: 'Landscape', type: 'custom_image', x: 40, y: 10, rotation: 20, scaleX: 1.2, scaleY: 0.9, opacity: 1, visible: true, zIndex: 1, fillColor: '#fff', strokeColor: '#000', width: 600, height: 300, imageUrl: IMAGE, masks: [{ id: 'm1', name: 'Window', mode: 'add', enabled: true, path: rect }] }],
    tracks: [{ id: 'track-img', partId: 'img', name: 'img', color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels(), ...trackExtra }],
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => {
    localStorage.clear();
    localStorage.setItem(entry.key, entry.value);
  }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().click();
  await openDetailsTab(page, 'Masks');
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

test('canvas point selection drives the Inspector; Corner → Smooth changes only that point', async ({ page }) => {
  await seed(page);
  const before = await savedScene(page);
  await page.getByTestId('mask-vertex').nth(1).click();
  const editor = page.getByTestId('bezier-path-editor');
  await expect(editor).toContainText('Point 2 of 4');
  await expect(editor.getByRole('radio', { name: 'Corner' })).toHaveAttribute('aria-checked', 'true');
  await editor.getByRole('radio', { name: 'Smooth' }).click();
  await expect(editor.getByRole('radio', { name: 'Smooth' })).toHaveAttribute('aria-checked', 'true');
  // The canvas shows the new tangent handles of that point.
  await expect(page.getByTestId('mask-tangent-handle-out')).toHaveCount(1);

  const after = await savedScene(page);
  const points = after.layers[0].masks[0].path.points;
  expect(points[1].kind).toBe('smooth');
  expect(points[1].handleIn).toBeTruthy();
  expect([points[0], points[2], points[3]]).toEqual([rect.points[0], rect.points[2], rect.points[3]]);
  const pose = (layer: Record<string, any>) => [layer.x, layer.y, layer.rotation, layer.scaleX, layer.scaleY];
  expect(pose(after.layers[0])).toEqual(pose(before.layers[0]));

  // Expand gives a larger editing view.
  const compact = await editor.locator('svg').boundingBox();
  await editor.getByRole('button', { name: 'Expand' }).click();
  const large = await editor.locator('svg').boundingBox();
  expect(large!.height).toBeGreaterThanOrEqual(compact!.height);
  expect(large!.width).toBeGreaterThan(250);
});

test('an animated mask path refuses topology edits with the reason; a Smooth change becomes a key at the playhead keeping metadata', async ({ page }) => {
  await seed(page, {
    maskPathChannels: { 'm1:path': [
      { id: 'k0', frame: 0, value: rect, easing: 'easeIn', templateId: 'Sequence' },
      { id: 'k20', frame: 20, value: rect, easing: 'linear', templateId: 'Sequence' },
    ] },
  });
  const editor = page.getByTestId('bezier-path-editor');
  for (const name of ['Add vertex', 'Delete vertex']) await expect(editor.getByRole('button', { name })).toBeDisabled();
  // C4 — opening/closing and the point order are applied to every keyframe at
  // once (one point identity order), so they stay available on an animated path.
  await expect(editor.getByRole('switch', { name: 'Closed path' })).toBeEnabled();
  await expect(editor).toContainText('The mask path is animated');
  await page.getByTestId('mask-vertex').nth(2).click();
  await editor.getByRole('radio', { name: 'Smooth' }).click();
  const keys = (await savedScene(page)).tracks[0].maskPathChannels['m1:path'];
  expect(keys.map((key: any) => key.frame)).toEqual([0, 20]);
  expect(keys[0]).toMatchObject({ id: 'k0', easing: 'easeIn', templateId: 'Sequence' });
  expect(keys[0].value.points[2].kind).toBe('smooth');
  expect(keys[1]).toEqual({ id: 'k20', frame: 20, value: rect, easing: 'linear', templateId: 'Sequence' });
});
