/**
 * WP-05 — the derived layer ordinal in Chromium: five independent image
 * layers A..E read 1..5 in BOTH the Outliner and the Timeline; deleting C
 * renumbers to 1..4 without touching IDs or zIndex; a reorder keeps every
 * relationship (E's matte still reads B); Undo restores C with its own ID; the
 * ordinal is never written to the scene.
 */
import { expect, test, type Page } from '@playwright/test';
import { deleteSelectedLayer } from './fixtures/inspectorTabs';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const IMAGE = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="#3b82f6"/></svg>',
).toString('base64')}`;

const ids = ['a', 'b', 'c', 'd', 'e'];

async function seed(page: Page): Promise<void> {
  const layers = ids.map((id, index) => ({
    id, name: `Photo ${id.toUpperCase()}`, type: 'custom_image', x: -200 + index * 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1,
    opacity: 1, visible: true, zIndex: 5 - index, fillColor: '#ffffff', strokeColor: '#000000', width: 80, height: 60, imageUrl: IMAGE,
    ...(id === 'e' ? { trackMatte: { sourceLayerId: 'b', mode: 'alpha', sourceVisible: true } } : {}),
  }));
  const tracks = ids.map((id) => ({ id: `track-${id}`, partId: id, name: id, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() }));
  const scene = JSON.stringify({ version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers, tracks });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => {
    localStorage.clear();
    localStorage.setItem(entry.key, entry.value);
  }, { key: STORAGE_KEY, value: scene });
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

/** "ordinal name" per row, top to bottom, from the Outliner and the Timeline. */
const rows = (page: Page) => page.evaluate(() => ({
  outliner: [...document.querySelectorAll('[role="treeitem"][data-layer-ordinal]')]
    .map((row) => `${row.getAttribute('data-layer-ordinal')} ${row.querySelector('.actor-name')?.textContent ?? ''}`),
  timeline: [...document.querySelectorAll('.ue-track-row')]
    .map((row) => `${row.querySelector('.layer-ordinal')?.textContent ?? ''} ${row.querySelector('.ue-track-name')?.textContent ?? ''}`),
}));

test('WP-05 — A..E, delete C, reorder, undo: gapless ordinals and stable identities', async ({ page }) => {
  await seed(page);
  const all = ['1 Photo A', '2 Photo B', '3 Photo C', '4 Photo D', '5 Photo E'];
  expect(await rows(page)).toEqual({ outliner: all, timeline: all });
  // The ordinal is visual only: each layer row is still announced by its name.
  for (const name of ['Photo A', 'Photo B', 'Photo C', 'Photo D', 'Photo E']) {
    await expect(page.getByRole('treeitem', { name: new RegExp(`^${name}\\b`) })).toHaveCount(1);
  }

  // Delete C: four rows numbered 1..4, IDs and zIndex untouched.
  await page.locator('.ue-track-row', { hasText: 'Photo C' }).first().click();
  await deleteSelectedLayer(page);
  const four = ['1 Photo A', '2 Photo B', '3 Photo D', '4 Photo E'];
  expect(await rows(page)).toEqual({ outliner: four, timeline: four });
  let scene = await savedScene(page);
  expect(scene.layers.map((layer: any) => [layer.id, layer.zIndex])).toEqual([['a', 5], ['b', 4], ['d', 2], ['e', 1]]);
  expect(JSON.stringify(scene)).not.toContain('ordinal');

  // Reorder in the Outliner: B goes below D. The ordinal follows the list;
  // E's Track Matte still names B by its stable id.
  const outlinerRow = (name: string) => page.locator('[role="treeitem"]', { hasText: name }).first();
  // C2-E: the middle of a row nests; its lower edge places the layer after it.
  const target = await outlinerRow('Photo D').boundingBox();
  await outlinerRow('Photo B').dragTo(outlinerRow('Photo D'), { targetPosition: { x: target!.width / 2, y: target!.height - 2 } });
  const reordered = await rows(page);
  expect(reordered.outliner.map((row) => row.split(' ')[0])).toEqual(['1', '2', '3', '4']);
  expect(reordered.outliner.indexOf('3 Photo B')).toBe(2);
  expect(reordered.timeline).toEqual(reordered.outliner);
  scene = await savedScene(page);
  expect(scene.layers.find((layer: any) => layer.id === 'e').trackMatte.sourceLayerId).toBe('b');
  expect(scene.layers.map((layer: any) => layer.id).sort()).toEqual(['a', 'b', 'd', 'e']);

  // Undo the reorder, then the delete: C returns with its own id and number.
  await page.getByTitle('Undo').click();
  await page.getByTitle('Undo').click();
  expect(await rows(page)).toEqual({ outliner: all, timeline: all });
  scene = await savedScene(page);
  expect(scene.layers.map((layer: any) => layer.id)).toEqual(['a', 'b', 'c', 'd', 'e']);

  // Save → reload: the same numbers come back from the same authored order.
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  expect(await rows(page)).toEqual({ outliner: all, timeline: all });
});
