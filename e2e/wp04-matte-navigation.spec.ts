/**
 * WP-04 — Track Matte target/source navigation in Chromium: select a HIDDEN
 * source from its target, move it on the canvas (only the source moves; the
 * target and the relationship's visibility setting are untouched), go back to
 * the target; shared-source visibility conflict; delete → missing → Undo.
 */
import { expect, test, type Page } from '@playwright/test';
import { openDetailsTab, deleteSelectedLayer } from './fixtures/inspectorTabs';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const IMAGE = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#3b82f6"/><rect y="180" width="480" height="90" fill="#15803d"/></svg>',
).toString('base64')}`;

const layer = (id: string, name: string, type: string, overrides: Record<string, unknown> = {}) => ({
  id, name, type, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#ffffff', strokeColor: '#000000', width: 120, height: 120, ...overrides,
});
const track = (partId: string) => ({ id: `track-${partId}`, partId, name: partId, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() });

async function seed(page: Page): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [
      layer('landscape', 'Landscape', 'custom_image', { zIndex: 1, width: 480, height: 270, imageUrl: IMAGE, trackMatte: { sourceLayerId: 'circle', mode: 'alpha', sourceVisible: false } }),
      layer('circle', 'Circle', 'custom_circle', { zIndex: 2, x: -60, fillColor: '#ffffff' }),
      layer('caption', 'Caption', 'custom_rect', { zIndex: 3, y: 160, width: 200, height: 40, trackMatte: { sourceLayerId: 'circle', mode: 'alpha', sourceVisible: true } }),
    ],
    tracks: [track('landscape'), track('circle'), track('caption')],
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
}

async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

const byId = (scene: Record<string, any>, id: string) => scene.layers.find((candidate: any) => candidate.id === id);
const matteGeometry = (page: Page) => page.evaluate(() => document.querySelector('mask[id^="kcs-mask-circle-alpha"] path')?.getAttribute('d') ?? null);

test('WP-04 — select a hidden matte source, move it, return to the target; conflict; delete and undo', async ({ page }) => {
  await seed(page);
  await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().click();
  // C7 — the Track Matte card lives on the Inspector's Masks tab.
  await openDetailsTab(page, 'Masks');
  const summary = page.getByTestId('track-matte-summary');
  await expect(summary).toContainText('Matte source: Circle');
  // The source is hidden by Landscape: it is not painted in the composition.
  await expect(page.locator('.stage-svg g[data-part-id="circle"]')).toHaveCount(0);
  const before = await savedScene(page);
  const geometryBefore = await matteGeometry(page);
  expect(geometryBefore).not.toBeNull();

  await page.getByRole('button', { name: 'Select Source' }).click();
  await expect(page.getByTestId('track-matte-targets')).toContainText('Landscape');
  const hitArea = page.locator('[data-testid="matte-editor-hit-area"][data-hidden-matte-source="true"]');
  await expect(hitArea).toHaveCount(1);
  // Still hidden: selecting a source never writes its visibility.
  await expect(page.locator('.stage-svg g[data-part-id="circle"]')).toHaveCount(0);

  const box = await hitArea.boundingBox();
  if (!box) throw new Error('no hit area');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  const moved = await savedScene(page);
  expect(byId(moved, 'circle').x).toBeGreaterThan(byId(before, 'circle').x);
  expect([byId(moved, 'landscape').x, byId(moved, 'landscape').y]).toEqual([byId(before, 'landscape').x, byId(before, 'landscape').y]);
  expect(byId(moved, 'landscape').trackMatte).toEqual(byId(before, 'landscape').trackMatte);
  expect(moved.tracks.find((candidate: any) => candidate.partId === 'landscape')).toEqual(before.tracks.find((candidate: any) => candidate.partId === 'landscape'));
  // The visible window moved with the source.
  expect(await matteGeometry(page)).not.toBe(geometryBefore);

  // C5 — the canvas strip offers the same Back; this flow uses the Inspector's.
  await page.getByTestId('track-matte-targets').getByRole('button', { name: 'Back to Landscape' }).click();
  await expect(summary).toContainText('Matte source: Circle');

  // Caption shows its source, but Landscape hides it: the conflict is explained.
  await page.locator('.ue-track-row', { hasText: 'Caption' }).first().click();
  await expect(page.getByTestId('track-matte-visibility-conflict')).toContainText('Landscape');

  // Delete the source → missing (reference kept) → Undo restores the same id.
  await page.locator('.ue-track-row', { hasText: 'Circle' }).first().click();
  await deleteSelectedLayer(page);
  // C2: the source has dependents, so the delete names them before it runs.
  const confirm = page.getByTestId('delete-dependents-dialog');
  await expect(confirm.locator('[data-dependent-id="landscape"]')).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete' }).click();
  await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().click();
  await expect(summary).toContainText('is missing');
  const deleted = await savedScene(page);
  expect(byId(deleted, 'landscape').trackMatte.sourceLayerId).toBe('circle');
  await page.getByTitle('Undo').click();
  await expect(summary).toContainText('Matte source: Circle');
  expect(byId(await savedScene(page), 'circle')).toBeDefined();
});
