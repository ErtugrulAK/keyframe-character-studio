/**
 * WP-02 — editing an existing layer mask directly on the canvas, with real
 * pointer input in Chromium. The owner image never moves; the overlay outline
 * is the renderer's own clip contour; a drag is one undo entry; Escape cancels
 * a drag (no history, redo kept) before it leaves the mode.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const IMAGE = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#3b82f6"/><rect y="180" width="480" height="90" fill="#15803d"/></svg>',
).toString('base64')}`;

const rectPath = {
  version: 1,
  coordinateSpace: 'normalized',
  closed: true,
  points: [
    { id: 'v0', x: 0.25, y: 0.25, kind: 'corner' },
    { id: 'v1', x: 0.75, y: 0.25, kind: 'corner' },
    { id: 'v2', x: 0.75, y: 0.75, kind: 'smooth', handleIn: { x: 0.8, y: 0.65 }, handleOut: { x: 0.7, y: 0.85 } },
    { id: 'v3', x: 0.25, y: 0.75, kind: 'corner' },
  ],
};

const imageLayer = (overrides: Record<string, unknown> = {}) => ({
  id: 'landscape', name: 'Landscape', type: 'custom_image',
  x: 0, y: 0, rotation: 30, scaleX: 1.2, scaleY: 0.8, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#ffffff', strokeColor: '#000000', width: 480, height: 270, imageUrl: IMAGE,
  masks: [{ id: 'm1', name: 'Window', mode: 'add', enabled: true, opacity: 1, feather: 0, expansion: 0, path: rectPath }],
  ...overrides,
});

const track = (partId: string, overrides: Record<string, unknown> = {}) => ({
  id: `track-${partId}`, partId, name: partId, color: '#22d3ee', visible: true, locked: false, expanded: false,
  channels: emptyChannels(), ...overrides,
});

async function seed(page: Page, layers: Record<string, unknown>[], tracks: Record<string, unknown>[]): Promise<void> {
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

async function enterMaskEditing(page: Page, layerName: string): Promise<void> {
  await page.locator('.ue-track-row', { hasText: layerName }).first().click();
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
  await page.getByRole('button', { name: 'Edit on Canvas' }).click();
  await expect(page.getByTestId('mask-path-overlay')).toBeVisible();
  await expect(page.getByTestId('mask-edit-banner')).toContainText('Window');
}

async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

const markerCenters = (page: Page) => page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="mask-vertex"]')].map((node) => {
    const box = node.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }));

/** The overlay outline and the renderer's clip contour for mask m1 of `partId`. */
const contours = (page: Page, partId: string) => page.evaluate((id) => ({
  overlay: document.querySelector('[data-testid="mask-path-outline"]')?.getAttribute('d') ?? null,
  clip: document.querySelector(`mask[id="kcs-layer-mask-${id}-m1-add"] path`)?.getAttribute('d') ?? null,
}), partId);

async function centerOf(page: Page, testId: string): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} has no box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(page: Page, from: { x: number; y: number }, delta: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + delta.x, from.y + delta.y, { steps: 8 });
  await page.mouse.up();
}

const expectMovedBy = (after: { x: number; y: number }[], before: { x: number; y: number }[], delta: { x: number; y: number }, indices: number[]) => {
  before.forEach((point, index) => {
    const moved = indices.includes(index);
    expect(after[index].x).toBeCloseTo(point.x + (moved ? delta.x : 0), 0);
    expect(after[index].y).toBeCloseTo(point.y + (moved ? delta.y : 0), 0);
  });
};

test.describe('WP-02 — canvas mask editing', () => {
  test('moves the whole mask and one vertex on a rotated, scaled image; the image never moves', async ({ page }) => {
    await seed(page, [imageLayer()], [track('landscape')]);
    await enterMaskEditing(page, 'Landscape');
    const before = await savedScene(page);
    expect(await page.getByTestId('transform-gizmo').count()).toBe(0);
    let lines = await contours(page, 'landscape');
    expect(lines.overlay).not.toBeNull();
    expect(lines.overlay).toBe(lines.clip);

    // Whole-path move: every marker follows the pointer exactly.
    const markers0 = await markerCenters(page);
    await drag(page, await centerOf(page, 'mask-path-move-handle'), { x: 60, y: 30 });
    expectMovedBy(await markerCenters(page), markers0, { x: 60, y: 30 }, [0, 1, 2, 3]);
    lines = await contours(page, 'landscape');
    expect(lines.overlay).toBe(lines.clip);

    let scene = await savedScene(page);
    const layerPose = (layer: Record<string, any>) => [layer.x, layer.y, layer.rotation, layer.scaleX, layer.scaleY, layer.width, layer.height, layer.imageUrl];
    expect(layerPose(scene.layers[0])).toEqual(layerPose(before.layers[0]));
    expect(scene.tracks).toEqual(before.tracks);
    expect(scene.layers[0].masks[0].path.points.map((point: any) => point.id)).toEqual(['v0', 'v1', 'v2', 'v3']);
    expect(scene.layers[0].masks[0].path).not.toEqual(before.layers[0].masks[0].path);

    // One drag is one undo entry.
    await page.getByTitle('Undo').click();
    scene = await savedScene(page);
    expect(scene.layers[0].masks[0]).toEqual(before.layers[0].masks[0]);
    await expect(page.getByTitle('Redo')).toBeEnabled();

    // Escape during a drag rolls it back without a history entry; redo survives.
    const markers1 = await markerCenters(page);
    const handle = await centerOf(page, 'mask-path-move-handle');
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(handle.x + 50, handle.y + 10, { steps: 5 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expectMovedBy(await markerCenters(page), markers1, { x: 0, y: 0 }, []);
    await expect(page.getByTestId('mask-path-overlay')).toBeVisible();
    await expect(page.getByTitle('Redo')).toBeEnabled();
    scene = await savedScene(page);
    expect(scene.layers[0].masks[0]).toEqual(before.layers[0].masks[0]);

    // Vertex move: only that vertex (and its handles) moves.
    const markers2 = await markerCenters(page);
    await drag(page, markers2[1], { x: 25, y: -15 });
    expectMovedBy(await markerCenters(page), markers2, { x: 25, y: -15 }, [1]);

    // Tangent move on the smooth vertex: the dragged handle follows the pointer.
    await page.mouse.click(markers2[2].x, markers2[2].y);
    const out = await centerOf(page, 'mask-tangent-handle-out');
    await drag(page, out, { x: 12, y: 18 });
    const outAfter = await centerOf(page, 'mask-tangent-handle-out');
    expect(outAfter.x).toBeCloseTo(out.x + 12, 0);
    expect(outAfter.y).toBeCloseTo(out.y + 18, 0);
    lines = await contours(page, 'landscape');
    expect(lines.overlay).toBe(lines.clip);
    scene = await savedScene(page);
    expect(layerPose(scene.layers[0])).toEqual(layerPose(before.layers[0]));

    // Escape (idle) leaves mask editing; the image is draggable again.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('mask-path-overlay')).toHaveCount(0);
    await expect(page.getByTestId('transform-gizmo').first()).toBeVisible();
  });

  test('authors a key at the playhead between path keys, and refuses editing during a moving IN preset', async ({ page }) => {
    const moved = { ...rectPath, points: rectPath.points.map((point) => ({ ...point, x: point.x + 0.1 })) };
    await seed(page, [imageLayer({ rotation: 0, scaleX: 1, scaleY: 1, inAnimPreset: 'slide-left', inAnimDuration: 8 })], [track('landscape', {
      channels: { ...emptyChannels(), x: [{ id: 'kx0', frame: 0, value: 0, easing: 'linear' }, { id: 'kx20', frame: 20, value: 80, easing: 'linear' }] },
      maskPathChannels: { 'm1:path': [
        { id: 'p0', frame: 0, value: rectPath, easing: 'linear', templateId: 'Sequence' },
        { id: 'p20', frame: 20, value: moved, easing: 'linear', templateId: 'Sequence' },
      ] },
    })]);
    await enterMaskEditing(page, 'Landscape');

    // Frame 0 is inside the slide-left IN preset: outline only, with the reason.
    await expect(page.getByTestId('mask-path-overlay')).toHaveAttribute('data-interactive', 'false');
    await expect(page.getByTestId('mask-edit-hint')).toContainText('IN/OUT preset');

    const ruler = page.getByRole('slider', { name: 'Playhead position' });
    await ruler.focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(ruler).toHaveAttribute('aria-valuenow', '10');
    await expect(page.getByTestId('mask-path-overlay')).toHaveAttribute('data-interactive', 'true');

    const before = await savedScene(page);
    const markers = await markerCenters(page);
    await drag(page, await centerOf(page, 'mask-path-move-handle'), { x: -40, y: 20 });
    expectMovedBy(await markerCenters(page), markers, { x: -40, y: 20 }, [0, 1, 2, 3]);
    const lines = await contours(page, 'landscape');
    expect(lines.overlay).toBe(lines.clip);

    const scene = await savedScene(page);
    const keys = scene.tracks[0].maskPathChannels['m1:path'];
    expect(keys.map((key: any) => key.frame)).toEqual([0, 10, 20]);
    expect(keys[0]).toEqual(before.tracks[0].maskPathChannels['m1:path'][0]);
    expect(keys[2]).toEqual(before.tracks[0].maskPathChannels['m1:path'][1]);
    // The image's own animation and base pose are untouched.
    expect(scene.tracks[0].channels.x).toEqual(before.tracks[0].channels.x);
    expect([scene.layers[0].x, scene.layers[0].y]).toEqual([before.layers[0].x, before.layers[0].y]);
    expect(scene.layers[0].masks[0].path).toEqual(before.layers[0].masks[0].path);
  });

  test('keeps the outline on the clip under a sheared parent and at a zoomed camera', async ({ page }) => {
    await seed(page, [
      { id: 'rig', name: 'Rig', type: 'custom_rect', isGroup: true, x: 40, y: -20, rotation: 20, scaleX: 1.4, scaleY: 0.7, opacity: 1, visible: true, zIndex: 2, width: 10, height: 10, fillColor: '#000', strokeColor: '#000' },
      imageLayer({ parentId: 'rig', rotation: 30, scaleX: 1, scaleY: 1 }),
    ], [track('rig'), track('landscape')]);
    await page.locator('.ue-track-row', { hasText: 'Rig' }).first().click();
    await page.locator('.ue-expand-btn').first().click();
    await enterMaskEditing(page, 'Landscape');

    const stage = page.locator('.stage-canvas-container');
    for (const zoomSteps of [0, 2]) {
      const zoomBefore = Number(await stage.getAttribute('data-camera-zoom'));
      for (let step = 0; step < zoomSteps; step += 1) {
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('canvas-viewport-command', { detail: { type: 'zoom-in' } })));
      }
      if (zoomSteps > 0) await expect.poll(async () => Number(await stage.getAttribute('data-camera-zoom'))).toBeGreaterThan(zoomBefore);
      const lines = await contours(page, 'landscape');
      expect(lines.overlay).toBe(lines.clip);
      const markers = await markerCenters(page);
      await drag(page, await centerOf(page, 'mask-path-move-handle'), { x: 30, y: -20 });
      expectMovedBy(await markerCenters(page), markers, { x: 30, y: -20 }, [0, 1, 2, 3]);
      const after = await contours(page, 'landscape');
      expect(after.overlay).toBe(after.clip);
    }
    const scene = await savedScene(page);
    const image = scene.layers.find((layer: any) => layer.id === 'landscape');
    expect([image.x, image.y, image.rotation, image.scaleX, image.scaleY, image.parentId]).toEqual([0, 0, 30, 1, 1, 'rig']);
  });
});
