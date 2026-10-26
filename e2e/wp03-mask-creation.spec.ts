/**
 * WP-03 — drawing new masks on a layer (Ellipse, Rectangle, Pen) and editing
 * a mask path as a whole, with real pointer input in Chromium. A drawn mask is
 * one undo step on the owner (never a new layer); Escape and degenerate drags
 * create nothing; vertex add/remove keeps the shape and is refused on an
 * animated path; a path key lands at the playhead.
 */
import { expect, test, type Page } from '@playwright/test';
import { armProperty, propertyRow } from './fixtures/propertyAnimation';
import { openDetailsTab } from './fixtures/inspectorTabs';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const IMAGE = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#3b82f6"/><rect y="180" width="480" height="90" fill="#15803d"/></svg>',
).toString('base64')}`;

async function seed(page: Page, masks: unknown[] = []): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [{
      id: 'landscape', name: 'Landscape', type: 'custom_image', x: 0, y: 0, rotation: 15, scaleX: 1, scaleY: 1, opacity: 1,
      visible: true, zIndex: 1, fillColor: '#ffffff', strokeColor: '#000000', width: 480, height: 270, imageUrl: IMAGE, masks,
    }],
    tracks: [{ id: 'track-landscape', partId: 'landscape', name: 'Landscape', color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() }],
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
}

async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

async function stageCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('.stage-canvas-container').boundingBox();
  if (!box) throw new Error('stage has no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 + 30 };
}

const contours = (page: Page, maskId: string) => page.evaluate((id) => ({
  overlay: document.querySelector('[data-testid="mask-path-outline"]')?.getAttribute('d') ?? null,
  clip: [...document.querySelectorAll('mask[id^="kcs-layer-mask-landscape-"]')]
    .find((node) => node.id.startsWith(`kcs-layer-mask-landscape-${id}`))?.querySelector('path')?.getAttribute('d') ?? null,
}), maskId);

const layerPose = (scene: Record<string, any>) => {
  const layer = scene.layers[0];
  return [layer.x, layer.y, layer.rotation, layer.scaleX, layer.scaleY, layer.width, layer.height];
};

test.describe('WP-03 — mask creation and path edits', () => {
  test('draws an ellipse mask on the image as one undo step; degenerate drags and Escape create nothing', async ({ page }) => {
    await seed(page);
    const before = await savedScene(page);
    const center = await stageCenter(page);

    // A degenerate (tiny) drag creates nothing and keeps the drawing armed.
    await page.getByRole('button', { name: 'Draw rectangle mask' }).click();
    await expect(page.getByTestId('mask-draw-banner')).toContainText('Rectangle');
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 2, center.y + 1);
    await page.mouse.up();
    await expect(page.getByTestId('mask-draw-overlay')).toBeVisible();
    // Escape cancels the session with no write.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('mask-draw-overlay')).toHaveCount(0);
    expect((await savedScene(page)).layers[0].masks ?? []).toEqual([]);

    await page.getByRole('button', { name: 'Draw ellipse mask' }).click();
    await page.mouse.move(center.x - 80, center.y - 50);
    await page.mouse.down();
    await page.mouse.move(center.x + 60, center.y + 40, { steps: 8 });
    await expect(page.getByTestId('mask-draw-preview')).toBeVisible();
    await page.mouse.up();

    // Committed: one mask on the OWNER, editing it straight away.
    await expect(page.getByTestId('mask-path-overlay')).toBeVisible();
    const scene = await savedScene(page);
    expect(scene.layers).toHaveLength(1);
    expect(layerPose(scene)).toEqual(layerPose(before));
    const masks = scene.layers[0].masks;
    expect(masks).toHaveLength(1);
    expect(masks[0].id).toBe('mask-1');
    expect(masks[0].path.points).toHaveLength(4);
    expect(masks[0].path.points.every((point: any) => point.kind === 'smooth')).toBe(true);
    const lines = await contours(page, 'mask-1');
    expect(lines.overlay).toBe(lines.clip);

    await page.getByTitle('Undo').click();
    await expect(page.getByTestId('mask-path-overlay')).toHaveCount(0);
    expect((await savedScene(page)).layers[0].masks ?? []).toEqual([]);
  });

  test('draws a pen mask and adds and removes points on the static path', async ({ page }) => {
    await seed(page);
    const before = await savedScene(page);
    const c = await stageCenter(page);
    await page.getByRole('button', { name: 'Draw pen mask' }).click();
    for (const [dx, dy] of [[-70, -40], [70, -40], [90, 40], [-60, 50]]) {
      await page.mouse.click(c.x + dx, c.y + dy);
    }
    await expect(page.getByTestId('mask-draw-point')).toHaveCount(4);
    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('mask-draw-point')).toHaveCount(3);
    await page.mouse.click(c.x - 60, c.y + 50);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('mask-path-overlay')).toBeVisible();
    let scene = await savedScene(page);
    expect(scene.layers).toHaveLength(1);
    expect(scene.layers[0].masks[0].path.points).toHaveLength(4);

    // Double-click on the outline adds a point exactly on the edge.
    const top = { x: c.x, y: c.y - 40 };
    const outlineBefore = (await contours(page, 'mask-1')).overlay;
    const hit = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return element?.getAttribute('data-testid');
    }, top);
    expect(hit).toBe('mask-path-hit-area');
    await page.mouse.dblclick(top.x, top.y);
    await expect(page.getByTestId('mask-vertex')).toHaveCount(5);
    expect((await contours(page, 'mask-1')).overlay).not.toBe(outlineBefore);

    // Select the new point and delete it: back to four, layer untouched.
    const markers = page.getByTestId('mask-vertex');
    await markers.nth(1).click();
    await page.keyboard.press('Delete');
    await expect(page.getByTestId('mask-vertex')).toHaveCount(4);
    scene = await savedScene(page);
    expect(scene.layers).toHaveLength(1);
    expect(layerPose(scene)).toEqual(layerPose(before));
    // C10: the Inspector's path rotate/scale buttons are gone; the canvas
    // outline still matches the clip after the point edits.
    const lines = await contours(page, 'mask-1');
    expect(lines.overlay).toBe(lines.clip);
  });

  test('circle → move → path key at frame 20 (armed by the path row\'s "+"), and topology is locked once animated', async ({ page }) => {
    await seed(page);
    const c = await stageCenter(page);
    await page.getByRole('button', { name: 'Draw ellipse mask' }).click();
    await page.mouse.move(c.x - 50, c.y - 50);
    await page.mouse.down();
    await page.mouse.move(c.x + 50, c.y + 50, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId('mask-path-overlay')).toBeVisible();

    // Arm the mask path at frame 0 from the outliner's group for this mask (C7;
    // C10: the path row's "+").
    await page.locator('.ue-expand-btn').first().click();
    await page.locator('.ue-subgroup-header[data-property-group$="_mask:mask-1"]').click();
    await armProperty(page, 'mask-1:path');
    await expect(propertyRow(page, 'mask-1:path')).toHaveAttribute('data-animation-state', 'keyed');

    const ruler = page.getByRole('slider', { name: 'Playhead position' });
    await ruler.focus();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(ruler).toHaveAttribute('aria-valuenow', '20');
    await expect(page.getByTestId('mask-path-overlay')).toBeVisible();

    const handle = await page.getByTestId('mask-path-move-handle').boundingBox();
    if (!handle) throw new Error('no move handle');
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 70, handle.y + handle.height / 2, { steps: 8 });
    await page.mouse.up();

    const scene = await savedScene(page);
    const keys = scene.tracks[0].maskPathChannels['mask-1:path'];
    expect(keys.map((key: any) => key.frame)).toEqual([0, 20]);
    expect(keys[1].value).not.toEqual(keys[0].value);

    // Animated now: double-click on the outline is refused, the point count holds.
    const pointCount = await page.getByTestId('mask-vertex').count();
    const outline = await page.getByTestId('mask-path-outline').boundingBox();
    if (!outline) throw new Error('no outline');
    await page.mouse.dblclick(outline.x + outline.width / 2, outline.y + 1);
    await expect(page.getByText('The mask path is animated', { exact: false }).first()).toBeVisible();
    await expect(page.getByTestId('mask-vertex')).toHaveCount(pointCount);
  });
});
