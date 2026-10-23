/**
 * C5 — the X/Y coordinate overlay is ON in these tests (the pixel specs switch
 * it off to measure clean renders; this spec covers the editor WITH it):
 *
 * - it takes no pointer event: every overlay node is pointer-transparent and a
 *   press on the axes reaches the layer underneath;
 * - selecting, drawing a shape and dragging a mask point work across the axes
 *   and the origin marker;
 * - Broadcast shows no editor guide (overlay, readout, edit-target strip);
 * - the exported OGraf package carries no editor chrome.
 * Toggle and coordinate accuracy through zoom/pan/hierarchy are covered by
 * `coordinate-overlay.spec.ts`.
 */
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import { openDetailsTab } from './fixtures/inspectorTabs';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});
const layer = (id: string, name: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id, name, type: 'custom_rect', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#22d3ee', strokeColor: '#101218', width: 200, height: 120, ...extra,
});
// A mask whose second point sits exactly on the layer centre = the world origin.
const maskPath = {
  version: 1, coordinateSpace: 'normalized', closed: true,
  points: [{ id: 'v0', x: 0.1, y: 0.1, kind: 'corner' }, { id: 'v1', x: 0.5, y: 0.5, kind: 'corner' }, { id: 'v2', x: 0.9, y: 0.9, kind: 'corner' }, { id: 'v3', x: 0.1, y: 0.9, kind: 'corner' }],
};

async function seed(page: Page): Promise<void> {
  const layers = [
    layer('base', 'Base', 0, 0, { masks: [{ id: 'm1', name: 'Window', mode: 'add', enabled: true, opacity: 1, feather: 0, expansion: 0, path: maskPath }] }),
    layer('side', 'Side', 300, 0, { zIndex: 2, fillColor: '#f59e0b' }),
  ];
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers,
    tracks: layers.map((entry) => ({ id: `track-${entry.id}`, partId: entry.id, name: entry.name, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() })),
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  // The overlay is on (its default) for every test here.
  await expect(page.getByRole('button', { name: 'Toggle coordinate overlay' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.canvas-coordinate-overlay')).toHaveCount(1);
}

async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

/** Screen position of a world point, read from where the layer centres are drawn. */
const centreOf = async (page: Page, id: string) => {
  const box = await page.locator(`.stage-svg g[data-part-id="${id}"]`).first().boundingBox();
  if (!box) throw new Error(`no stage box for ${id}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test('the overlay takes no pointer event: a press on the axes and the origin reaches the layer', async ({ page }) => {
  await seed(page);
  const transparent = await page.evaluate(() => [...document.querySelectorAll('.canvas-coordinate-overlay, .canvas-coordinate-overlay *, .canvas-coordinate-readout')]
    .filter((node) => getComputedStyle(node).pointerEvents !== 'none').length);
  expect(transparent).toBe(0);

  // The origin (Base's centre) and a point of the X axis inside Side.
  const origin = await centreOf(page, 'base');
  const onAxis = await centreOf(page, 'side');
  const hits = await page.evaluate((points) => points.map(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return { overlay: Boolean(element?.closest('.canvas-coordinate-overlay')), part: element?.closest('[data-part-id]')?.getAttribute('data-part-id') ?? null };
  }), [origin, onAxis]);
  expect(hits).toEqual([{ overlay: false, part: 'base' }, { overlay: false, part: 'side' }]);

  await page.mouse.click(onAxis.x, onAxis.y);
  await expect(page.locator('.tree-node[data-layer-id="side"]')).toHaveAttribute('aria-selected', 'true');
  await page.mouse.click(origin.x, origin.y);
  await expect(page.locator('.tree-node[data-layer-id="base"]')).toHaveAttribute('aria-selected', 'true');
});

test('drawing a shape across the origin and dragging a mask point on it work with the overlay on', async ({ page }) => {
  await seed(page);
  const origin = await centreOf(page, 'base');

  // A rectangle drawn from one side of the origin to the other.
  await page.getByRole('button', { name: 'Vector Shapes & Graphic Elements' }).click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.mouse.move(origin.x - 50, origin.y - 70);
  await page.mouse.down();
  await page.mouse.move(origin.x + 50, origin.y + 70, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('.tree-node.actor-node')).toHaveCount(3);
  await page.keyboard.press('Escape');

  // The mask point that sits exactly on the origin marker: dragged 40 px right.
  await page.locator('.tree-node[data-layer-id="base"]').click();
  await openDetailsTab(page, 'Masks');
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
  await page.getByRole('button', { name: 'Edit on Canvas' }).click();
  await expect(page.getByTestId('mask-path-overlay')).toBeVisible();
  const before = (await savedScene(page)).layers.find((entry: any) => entry.id === 'base').masks[0].path.points[1];
  await page.mouse.move(origin.x, origin.y);
  await page.mouse.down();
  await page.mouse.move(origin.x + 40, origin.y, { steps: 5 });
  await page.mouse.up();
  const after = (await savedScene(page)).layers.find((entry: any) => entry.id === 'base').masks[0].path.points[1];
  expect(after.x).toBeGreaterThan(before.x + 0.05);
  expect(after.y).toBeCloseTo(before.y, 3);
});

test('Broadcast shows no editor guide, and the OGraf package carries no editor chrome', async ({ page }) => {
  await seed(page);
  await page.locator('.tree-node[data-layer-id="base"]').click();
  await expect(page.locator('.edit-target-strip')).toHaveCount(1);
  await expect(page.locator('.canvas-coordinate-readout')).toHaveCount(1);

  await page.getByRole('button', { name: 'BROADCAST', exact: true }).click();
  await expect(page.locator('.canvas-coordinate-overlay')).toHaveCount(0);
  await expect(page.locator('.canvas-coordinate-readout')).toHaveCount(0);
  await expect(page.locator('.edit-target-strip')).toHaveCount(0);
  await expect(page.locator('[data-stage-chrome]')).toHaveCount(0);
  await page.getByRole('button', { name: 'EDIT MODE', exact: true }).click();
  await expect(page.locator('.canvas-coordinate-overlay')).toHaveCount(1);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: 'OGraf Package', exact: true }).click();
  const download = await downloadPromise;
  const file = await download.path();
  expect(file).toBeTruthy();
  const entries = unzipSync(new Uint8Array(await readFile(file!)));
  const text = Object.entries(entries)
    .filter(([name]) => /\.(html|js|mjs|json|svg|css)$/u.test(name))
    .map(([, bytes]) => strFromU8(bytes))
    .join('\n');
  expect(text.length).toBeGreaterThan(0);
  for (const chrome of ['canvas-coordinate', 'edit-target-strip', 'mask-edit-banner', 'data-stage-chrome', 'selection-gizmo']) {
    expect(text, chrome).not.toContain(chrome);
  }
});
