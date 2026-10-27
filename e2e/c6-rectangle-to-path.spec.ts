/**
 * C6 — Rectangle → editable path, in a real browser:
 * - converting keeps the drawing pixel-for-pixel (fill, thick mitred stroke,
 *   rotation, non-uniform scale) and keeps identity, layer order, parent, the
 *   layer's mask and the Track Matte that uses it as its source;
 * - a double-click on an edge adds a point without changing the outline; the
 *   point can be made Smooth in the Inspector and dragged on the canvas, which
 *   turns the rectangle into a custom shape;
 * - Undo/Redo walk back to the rectangle and forward again; save/reload keeps
 *   the path; a shape that cannot be converted says why.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});
const base = { rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, strokeColor: '#101218' };

const scene = (rectExtra: Record<string, unknown> = {}) => {
  const layers = [
    { ...base, id: 'group', name: 'Group', type: 'custom_rect', isGroup: true, x: -60, y: 0, zIndex: 1, fillColor: '#000000', width: 10, height: 10, visible: false },
    {
      ...base, id: 'panel', name: 'Panel', type: 'custom_rect', parentId: 'group', x: 0, y: 0, rotation: 12, scaleX: 1.6, scaleY: 1.3, zIndex: 3,
      fillColor: '#22d3ee', fillEnabled: true, strokeEnabled: true, strokeColor: '#f43f5e', strokeWidth: 10, width: 120, height: 60,
      masks: [{ id: 'm1', name: 'Window', mode: 'add', enabled: true, opacity: 1, feather: 0, expansion: 0, path: { version: 1, coordinateSpace: 'normalized', closed: true, points: [{ id: 'a', x: -0.3, y: -0.4 }, { id: 'b', x: 0.85, y: -0.4 }, { id: 'c', x: 0.85, y: 1.4 }, { id: 'd', x: -0.3, y: 1.4 }] } }],
      ...rectExtra,
    },
    { ...base, id: 'target', name: 'Target', type: 'custom_circle', x: 300, y: 0, scaleX: 2.5, scaleY: 2.5, zIndex: 2, fillColor: '#a3e635', width: 60, height: 60, trackMatte: { sourceLayerId: 'panel', mode: 'alpha', enabled: true, sourceVisible: true } },
  ];
  return {
    version: 2, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers,
    tracks: layers.map((layer) => ({ id: `track-${layer.id}`, partId: layer.id, name: layer.name, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() })),
  };
};

async function seed(page: Page, rectExtra: Record<string, unknown> = {}): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene(rectExtra)) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  const overlay = page.getByRole('button', { name: 'Toggle coordinate overlay' });
  if (await overlay.getAttribute('aria-pressed') === 'true') await overlay.click();
}

const savedScene = async (page: Page) => {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
};
const layerOf = (doc: any, id: string) => doc.layers.find((layer: any) => layer.id === id);

/** The stage pixels with nothing selected (no gizmo), as an RGBA array via the page's own decoder. */
const stagePixels = async (page: Page) => {
  const box = await page.locator('.stage-canvas-container').boundingBox();
  if (!box) throw new Error('no stage');
  // A click on empty stage clears the selection (no gizmo, no path markers).
  await page.mouse.click(box.x + 12, box.y + box.height - 12);
  await expect(page.locator('[role="tree"] [aria-selected="true"]')).toHaveCount(0);
  await page.mouse.move(box.x + 6, box.y + 6);
  const clip = { x: box.x + 40, y: box.y + 60, width: box.width - 80, height: box.height - 120 };
  const png = (await page.screenshot({ clip })).toString('base64');
  return { png, clip };
};
const diffPixels = (page: Page, a: string, b: string) => page.evaluate(async ([left, right]) => {
  const load = async (data: string) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, image.width, image.height).data;
  };
  const [p, q] = await Promise.all([load(left), load(right)]);
  let differing = 0;
  for (let i = 0; i < p.length; i += 4) {
    if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > 24) differing += 1;
  }
  return differing;
}, [a, b] as const);

const selectPanel = async (page: Page) => {
  await page.locator('[role="tree"] [data-layer-id="panel"]').click();
  await expect(page.locator('.details-actor-header')).toContainText('Panel');
};

test('Rectangle → path keeps the picture and every relation; add a point, make it Smooth, drag it; undo/redo; reload', async ({ page }) => {
  test.setTimeout(90000);
  await seed(page);
  const before = await savedScene(page);
  const pixelsBefore = await stagePixels(page);

  await selectPanel(page);
  await expect(page.getByTestId('path-geometry-kind')).toContainText('Rectangle: a parametric shape');
  await page.getByRole('button', { name: 'Convert to editable path' }).click();
  await expect(page.getByText('PATH POINTS (4)')).toBeVisible();

  const converted = await savedScene(page);
  const panel = layerOf(converted, 'panel');
  expect(panel.type).toBe('custom_freeform');
  expect(panel.strokeLinejoin).toBe('miter');
  expect(panel.path.points.map((point: any) => [point.x, point.y])).toEqual([[-60, -30], [60, -30], [60, 30], [-60, 30]]);
  const kept = ['parentId', 'zIndex', 'x', 'y', 'rotation', 'scaleX', 'scaleY', 'fillColor', 'strokeColor', 'strokeWidth', 'masks', 'width', 'height', 'name'];
  for (const key of kept) expect(panel[key], key).toEqual(layerOf(before, 'panel')[key]);
  expect(layerOf(converted, 'target').trackMatte.sourceLayerId).toBe('panel');
  expect(converted.layers.map((layer: any) => layer.id)).toEqual(before.layers.map((layer: any) => layer.id));

  // Same picture: fill, 10 px mitred stroke, mask, rotation, scale, and the matte it drives.
  const pixelsAfter = await stagePixels(page);
  const differing = await diffPixels(page, pixelsBefore.png, pixelsAfter.png);
  expect(differing, 'pixels that differ after the conversion').toBe(0);

  // A double-click on the middle of the top edge adds a point there; the outline does not change.
  await selectPanel(page);
  const topMiddle = await page.evaluate(() => {
    const svg = document.querySelector('svg.stage-svg') as SVGSVGElement;
    const markers = [...document.querySelectorAll('[data-testid="freeform-vertex-marker"]')].map((marker) => marker.getBoundingClientRect());
    void svg;
    const a = markers[0];
    const b = markers[1];
    return { x: (a.x + a.width / 2 + b.x + b.width / 2) / 2, y: (a.y + a.height / 2 + b.y + b.height / 2) / 2 };
  });
  await page.mouse.dblclick(topMiddle.x, topMiddle.y);
  await expect(page.getByText('PATH POINTS (5)')).toBeVisible();
  const withPoint = layerOf(await savedScene(page), 'panel');
  expect(withPoint.path.points).toHaveLength(5);
  expect(withPoint.path.points[1].x).toBeCloseTo(0, 0);
  expect(withPoint.path.points[1].y).toBeCloseTo(-30, 1);

  // The new point is the selected one: C makes it Smooth (C10: on the canvas).
  await expect(page.locator('[data-testid="freeform-vertex-marker"][data-vertex-index="1"]')).toHaveAttribute('data-point-kind', 'corner');
  await page.keyboard.press('c');
  await expect(page.locator('[data-testid="freeform-vertex-marker"][data-vertex-index="1"]')).toHaveAttribute('data-point-kind', 'smooth');

  // Drag that point up on the canvas: the rectangle becomes a custom shape.
  const marker = await page.locator('[data-testid="freeform-vertex-marker"][data-vertex-index="1"]').boundingBox();
  if (!marker) throw new Error('no marker');
  await page.mouse.move(marker.x + marker.width / 2, marker.y + marker.height / 2);
  await page.mouse.down();
  await page.mouse.move(marker.x + marker.width / 2, marker.y + marker.height / 2 - 60, { steps: 8 });
  await page.mouse.up();
  const shaped = layerOf(await savedScene(page), 'panel');
  expect(shaped.path.points[1].kind).toBe('smooth');
  expect(shaped.path.points[1].y).toBeLessThan(-40);
  expect(shaped.path.points[1].handleIn).toBeTruthy();

  // Undo: the drag, the Smooth, the added point, the conversion — one step each.
  const undo = () => page.keyboard.press('Control+z');
  await page.locator('[role="tree"] [data-layer-id="panel"]').click();
  await undo();
  await expect.poll(async () => layerOf(await savedScene(page), 'panel').path.points[1].y).toBeCloseTo(-30, 1);
  await undo();
  await expect.poll(async () => layerOf(await savedScene(page), 'panel').path.points[1].kind).toBe('corner');
  await undo();
  await expect.poll(async () => layerOf(await savedScene(page), 'panel').path.points.length).toBe(4);
  await undo();
  await expect.poll(async () => layerOf(await savedScene(page), 'panel').type).toBe('custom_rect');
  // Redo all the way forward again.
  for (let step = 0; step < 4; step += 1) await page.keyboard.press('Control+Shift+z');
  await expect.poll(async () => layerOf(await savedScene(page), 'panel').path?.points[1].y ?? 0).toBeLessThan(-40);

  // Save and reload: the same path comes back.
  const final = layerOf(await savedScene(page), 'panel');
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  const reloaded = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
  expect(layerOf(reloaded, 'panel').path).toEqual(final.path);
  expect(layerOf(reloaded, 'panel').strokeLinejoin).toBe('miter');
});

test('a shape that cannot be converted says why, and nothing changes', async ({ page }) => {
  await seed(page, { trimPathEnabled: true, trimPathStart: 0, trimPathEnd: 0.6, trimPathOffset: 0 });
  await selectPanel(page);
  const convert = page.getByRole('button', { name: 'Convert to editable path' });
  await expect(convert).toBeDisabled();
  await expect(page.locator('.path-geometry-reason')).toContainText('Trim Path');
  expect(layerOf(await savedScene(page), 'panel').type).toBe('custom_rect');
});
