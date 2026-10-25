import { test, expect, type Page } from '@playwright/test';

/**
 * C8 — the Motion Curve Editor fits a 1440 × 900 window without scrolling, and
 * no label lies on a point, a handle or outside its graph.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const channel = () => ({
  x: [] as unknown[], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

async function openCurves(page: Page): Promise<void> {
  const animated = channel();
  animated.x = [
    { id: 'x0', frame: 0, value: -300, easing: 'easeInOut', templateId: 'Sequence' },
    { id: 'x30', frame: 30, value: 300, easing: 'easeInOut', templateId: 'Sequence' },
  ];
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1',
    width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [{
      id: 'rect', name: 'Rect', type: 'custom_rect', x: -300, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
      visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218', fillEnabled: true,
    }],
    tracks: [{ partId: 'rect', channels: animated }],
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: scene },
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('.actor-node', { hasText: 'Rect' }).click();
  await page.locator('.keyframe-diamond').last().click();
  await page.getByRole('button', { name: /Motion Curves/ }).first().click();
  await expect(page.getByRole('dialog', { name: 'Motion Curve Editor' })).toBeVisible();
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const boxes = (page: Page, selector: string) => page.locator(selector).evaluateAll((nodes) => nodes.map((node) => {
  const rect = node.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, text: node.textContent ?? '' };
}));

test('at 1440 × 900 the whole editor is on screen with no scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCurves(page);
  const card = page.locator('.bezier-modal-card');
  const scroll = await card.evaluate((node) => ({ client: node.clientHeight, content: node.scrollHeight }));
  expect(scroll.content).toBeLessThanOrEqual(scroll.client);
  // The last rows (the per-keyframe handles and Apply) are inside the window.
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByLabel('Apply easing preset to segment starting at frame 30')).toBeInViewport({ ratio: 1 });
});

test('no value-graph label lies on a keyframe point, and the curve labels stay inside their graph', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCurves(page);

  const labels = await boxes(page, '.temporal-graph-svg text');
  const points = await boxes(page, '.temporal-graph-svg circle');
  expect(points.length).toBe(2);
  for (const label of labels) {
    for (const point of points) expect(overlaps(label, point), `"${label.text}" over a point`).toBe(false);
  }

  const graph = (await page.locator('.bezier-graph-surface').boundingBox())!;
  const curveLabels = await boxes(page, '.bezier-graph-surface svg text');
  const handles = await boxes(page, '.bezier-graph-surface svg g circle');
  for (const label of curveLabels) {
    expect(label.x >= graph.x && label.x + label.width <= graph.x + graph.width, `"${label.text}" inside the graph`).toBe(true);
    for (const handle of handles) expect(overlaps(label, handle), `"${label.text}" over a handle`).toBe(false);
  }
});
