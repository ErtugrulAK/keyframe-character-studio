/**
 * C3 — an armed drawing tool owns every stage press, including a press that
 * starts ON the current selection's transform handle; Select resizes as
 * before; a right-drag pan in the middle of a Pen draft only moves the camera.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const IMAGE = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#3b82f6"/><rect y="350" width="960" height="190" fill="#15803d"/></svg>',
).toString('base64')}`;

async function seed(page: Page): Promise<void> {
  const layers = [
    // Sized so its corner handles sit inside the visible stage at 1440×900.
    { id: 'bg', name: 'Background', type: 'custom_image', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#fff', strokeColor: '#000', width: 480, height: 270, imageUrl: IMAGE },
    { id: 'box', name: 'Box', type: 'custom_rect', x: 120, y: -60, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, fillColor: '#f97316', strokeColor: '#000', width: 120, height: 80 },
  ];
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers,
    tracks: layers.map((layer) => ({ id: `track-${layer.id}`, partId: layer.id, name: layer.id, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() })),
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

const pose = (layer: Record<string, any>) => [layer.x, layer.y, layer.rotation, layer.scaleX, layer.scaleY, layer.width, layer.height];
const byId = (scene: Record<string, any>, id: string) => scene.layers.find((layer: any) => layer.id === id);

/** The centre of the selected layer's lower-right corner handle, in client px. */
async function cornerHandle(page: Page) {
  const handle = page.locator('[data-testid="transform-gizmo"] rect').last();
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  if (!box) throw new Error('no handle');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function selectLayer(page: Page, name: string) {
  await page.locator('.ue-track-row', { hasText: name }).first().click();
}

test('armed Rectangle: a drag that starts ON the selected image\'s corner handle draws a new shape; the image is untouched', async ({ page }) => {
  await seed(page);
  const before = await savedScene(page);
  await selectLayer(page, 'Background');
  const corner = await cornerHandle(page);
  await page.getByRole('button', { name: 'Add rectangle' }).click();
  // The gizmo stays visible but passive while the tool owns the stage.
  await expect(page.locator('.stage-canvas-container')).toHaveClass(/tool-owns-pointer/);
  expect(await page.locator('[data-testid="transform-gizmo"]').first().evaluate((node) => getComputedStyle(node).opacity)).toBe('0.4');
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x - 90, corner.y - 60, { steps: 6 });
  await page.mouse.up();
  const after = await savedScene(page);
  expect(after.layers).toHaveLength(3);
  expect(pose(byId(after, 'bg'))).toEqual(pose(byId(before, 'bg')));
  expect(pose(byId(after, 'box'))).toEqual(pose(byId(before, 'box')));
  // The same press on another shape's body draws too.
  const boxBody = await page.locator('.stage-svg g[data-part-id="box"]').first().boundingBox();
  if (!boxBody) throw new Error('no box');
  await page.mouse.move(boxBody.x + 10, boxBody.y + 10);
  await page.mouse.down();
  await page.mouse.move(boxBody.x + 70, boxBody.y + 50, { steps: 5 });
  await page.mouse.up();
  const twice = await savedScene(page);
  expect(twice.layers).toHaveLength(4);
  expect(pose(byId(twice, 'box'))).toEqual(pose(byId(before, 'box')));
});

test('Select: the same handle drag resizes the image (the normal transform path), and Escape from a tool returns there', async ({ page }) => {
  await seed(page);
  const before = await savedScene(page);
  await page.getByRole('button', { name: 'Add rectangle' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.stage-canvas-container')).not.toHaveClass(/tool-owns-pointer/);
  await selectLayer(page, 'Background');
  const corner = await cornerHandle(page);
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x + 40, corner.y + 30, { steps: 6 });
  await page.mouse.up();
  const after = await savedScene(page);
  expect(after.layers).toHaveLength(2);
  expect(pose(byId(after, 'bg'))).not.toEqual(pose(byId(before, 'bg')));
});

for (const zoom of ['Zoom out', 'Zoom in'] as const) {
  test(`Pen closes on its first point with the mouse after "${zoom}" ×2 (screen-space close target)`, async ({ page }) => {
    await seed(page);
    for (let index = 0; index < 2; index += 1) await page.getByRole('button', { name: zoom, exact: true }).click();
    const stage = await page.locator('.stage-canvas-container').boundingBox();
    if (!stage) throw new Error('no stage');
    const c = { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 };
    await page.getByRole('button', { name: 'Pen' }).click();
    for (const [dx, dy] of [[-90, -60], [90, -60], [60, 70], [-80, 60]]) await page.mouse.click(c.x + dx, c.y + dy);
    const points = page.getByTestId('freeform-draft-point');
    await expect(points).toHaveCount(4);
    // 6 CSS px off the first point still closes, at any zoom.
    await page.mouse.move(c.x - 90 + 5, c.y - 60 + 3);
    await expect(points.first()).toHaveAttribute('data-close-target', 'true');
    await page.mouse.click(c.x - 90 + 5, c.y - 60 + 3);
    await expect(page.getByTestId('freeform-draft-banner')).toHaveCount(0);
    const scene = await savedScene(page);
    expect(scene.layers.filter((layer: any) => layer.type === 'custom_freeform')).toHaveLength(1);
    await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
}

test('Pen: a click on the selected image\'s handle adds a point; a right-drag pan keeps the draft; the mouse finishes it', async ({ page }) => {
  await seed(page);
  const before = await savedScene(page);
  await selectLayer(page, 'Background');
  const corner = await cornerHandle(page);
  await page.getByRole('button', { name: 'Pen' }).click();
  const points = page.getByTestId('freeform-draft-point');
  await page.mouse.click(corner.x - 120, corner.y - 120);
  await page.mouse.click(corner.x, corner.y);
  await expect(points).toHaveCount(2);
  expect(pose(byId(await savedScene(page), 'bg'))).toEqual(pose(byId(before, 'bg')));
  // That save was a click on a header button: it is not a vertex.
  await expect(points).toHaveCount(2);

  // Temporary pan with the right button: the camera moves, the draft stays.
  const stage = page.locator('.stage-svg');
  const transformBefore = await stage.evaluate((node) => (node as SVGElement).style.transform);
  await page.mouse.move(corner.x - 300, corner.y - 200);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(corner.x - 240, corner.y - 160, { steps: 6 });
  await page.mouse.up({ button: 'right' });
  await expect(page.locator('.editor-context-menu, [role="menu"]')).toHaveCount(0);
  expect(await stage.evaluate((node) => (node as SVGElement).style.transform)).not.toBe(transformBefore);
  await expect(points).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Pen' })).toHaveAttribute('aria-pressed', 'true');

  // Continue after the pan and finish with the mouse (no Enter / Escape).
  const second = await points.nth(1).boundingBox();
  if (!second) throw new Error('no point');
  await page.mouse.click(second.x + second.width / 2 - 140, second.y + second.height / 2 + 40);
  await page.getByRole('button', { name: 'Finish drawing' }).click();
  const after = await savedScene(page);
  expect(after.layers.filter((layer: any) => layer.type === 'custom_freeform')).toHaveLength(1);
  expect(pose(byId(after, 'bg'))).toEqual(pose(byId(before, 'bg')));
});
