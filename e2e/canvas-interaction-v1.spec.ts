import { test, expect } from '@playwright/test';

test('canvas tools and cursor-anchored zoom remain in one interaction surface', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.stage-canvas-container')).toBeVisible({ timeout: 30000 });

  await page.getByTitle('Vector Shapes & Graphic Elements').click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  const canvas = page.locator('.stage-canvas-container');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await page.keyboard.press('h');
  await expect(canvas).toHaveClass(/hand-tool/);
  await page.mouse.move(box!.x + 40, box!.y + 40);
  await page.mouse.down();
  await page.mouse.move(box!.x + 100, box!.y + 80);
  await page.mouse.up();
  await expect(canvas).toHaveClass(/hand-tool/);

  const before = await page.locator('.stage-svg').getAttribute('style');
  await page.mouse.move(box!.x + box!.width * 0.75, box!.y + box!.height * 0.5);
  await page.mouse.wheel(0, -240);
  await expect.poll(async () => page.locator('.stage-svg').getAttribute('style')).not.toBe(before);

  await page.keyboard.press('v');
  await expect(canvas).toHaveClass(/select-tool/);
});

test('corner resize preserves the existing transform pipeline', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  const canvas = page.locator('.stage-canvas-container');
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  await page.getByTitle('Vector Shapes & Graphic Elements').click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.68, canvasBox!.y + canvasBox!.height * 0.68);
  await page.mouse.down();
  await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.42, canvasBox!.y + canvasBox!.height * 0.42);
  await page.mouse.up();
  await page.locator('.actor-node', { hasText: 'Rectangle' }).click();
  const handle = page.locator('[data-testid="transform-gizmo"] rect').last();
  await expect(handle).toBeVisible();
  const before = await page.locator('g[transform^="translate"]').first().getAttribute('transform');
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2 + 24, handleBox!.y + handleBox!.height / 2 + 16);
  await page.mouse.up();
  await expect.poll(async () => page.locator('g[transform^="translate"]').first().getAttribute('transform')).not.toBe(before);
});

test('select mode marquee selects intersecting visible objects only', async ({ page }) => {
  const storageKey = 'SEQUENCER_STUDIO_PRO_V5';
  const scene = {
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    width: 600,
    height: 480,
    fps: 60,
    totalFrames: 60,
    layers: [
      { id: 'a', name: 'Marquee A', type: 'custom_box', x: -80, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#38bdf8', strokeColor: '#101218' },
      { id: 'b', name: 'Marquee B', type: 'custom_box', x: 80, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, fillColor: '#f472b6', strokeColor: '#101218' },
      { id: 'outside', name: 'Outside', type: 'custom_box', x: 0, y: 150, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 3, fillColor: '#facc15', strokeColor: '#101218' },
      { id: 'hidden', name: 'Hidden', type: 'custom_box', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 4, fillColor: '#94a3b8', strokeColor: '#101218' },
    ],
    tracks: [
      { partId: 'a', channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] } },
      { partId: 'b', channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] } },
      { partId: 'outside', channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] } },
      { partId: 'hidden', channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] } },
    ],
  };
  await page.addInitScript(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [storageKey, scene]);
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  const canvas = page.locator('.stage-canvas-container');
  await page.keyboard.press('=');
  await page.keyboard.press('h');
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  await page.mouse.move(canvasBox!.x + 30, canvasBox!.y + 30);
  await page.mouse.down();
  await page.mouse.move(canvasBox!.x + 50, canvasBox!.y + 45);
  await page.mouse.up();
  await page.keyboard.press('v');
  await page.locator('.actor-node', { hasText: 'Hidden' }).locator('.col-eye').click();
  await expect(page.locator('.actor-node', { hasText: 'Hidden' }).locator('.col-eye')).toHaveAttribute('title', 'Hidden from stage');

  const authoredBefore = await page.evaluate((key) => {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}');
    return parsed.layers.map((layer: { id: string; x: number; y: number }) => ({ id: layer.id, x: layer.x, y: layer.y }));
  }, storageKey);
  const screenPoint = async (x: number, y: number) => page.evaluate(([worldX, worldY]) => {
    const svg = document.querySelector('.stage-svg') as SVGSVGElement;
    const point = svg.createSVGPoint();
    point.x = 300 + worldX;
    point.y = 240 + worldY;
    const screen = point.matrixTransform(svg.getScreenCTM()!);
    return { x: screen.x, y: screen.y };
  }, [x, y] as [number, number]);
  const start = await screenPoint(-140, -60);
  const end = await screenPoint(140, 60);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  await expect(page.locator('rect[stroke="var(--accent-cyan)"]')).toBeVisible();
  await page.mouse.up();

  await expect(page.locator('.actor-node', { hasText: 'Marquee A' })).toHaveClass(/selected/);
  await expect(page.locator('.actor-node', { hasText: 'Marquee B' })).toHaveClass(/selected/);
  await expect(page.locator('.actor-node', { hasText: 'Outside' })).not.toHaveClass(/selected/);
  await expect(page.locator('.actor-node', { hasText: 'Hidden' })).not.toHaveClass(/selected/);
  await expect(page.locator('rect[stroke="var(--accent-cyan)"]')).toHaveCount(0);

  const authoredAfter = await page.evaluate((key) => {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}');
    return parsed.layers.map((layer: { id: string; x: number; y: number }) => ({ id: layer.id, x: layer.x, y: layer.y }));
  }, storageKey);
  expect(authoredAfter).toEqual(authoredBefore);
});
