import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function channels(): Record<string, unknown[]> {
  return { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] };
}

function layer(id: string, name: string, type: string, x: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, name, type, x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: id === 'a' ? 1 : 2, width: 120, height: 80, borderRadius: 0,
    fillColor: id === 'a' ? '#38bdf8' : '#f43f5e', strokeColor: '#101218', strokeWidth: 2,
    ...extra,
  };
}

async function seed(page: Page, layers: Record<string, unknown>[]): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    ([key, scene]) => localStorage.setItem(key, scene),
    [
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        layers,
        tracks: layers.map((item) => ({ partId: item.id, channels: channels() })),
        fps: 30,
        totalFrames: 90,
        projectResolution: { width: 1920, height: 1080 },
      }),
    ],
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

test.describe('KCS V5.1 manual QA gates', () => {
  test('uses individual selection bounds', async ({ page }) => {
    await seed(page, [layer('triangle', 'Triangle', 'custom_triangle', -160), layer('para', 'Parallelogram', 'custom_parallelogram', 160)]);
    await page.locator('.actor-node', { hasText: 'Triangle' }).click();
    await expect(page.locator('[data-testid="transform-gizmo"]')).toHaveCount(1);
    await page.locator('.actor-node', { hasText: 'Parallelogram' }).click({ modifiers: ['Control'] });
    await expect(page.locator('[data-testid="transform-gizmo"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="aggregate-selection-box"]')).toHaveCount(0);
  });

  test('supports Boolean creation, hierarchy, operand inspection, and dissolve preservation', async ({ page }) => {
    await seed(page, [layer('a', 'Operand A', 'custom_rect', -40), layer('b', 'Operand B', 'custom_circle', 40)]);
    await page.locator('.actor-node', { hasText: 'Operand A' }).click();
    await page.locator('.actor-node', { hasText: 'Operand B' }).click({ modifiers: ['Control'] });
    // Boolean authoring lives on the top toolbar: creating a union from the
    // selection activates the union operation there.
    const booleanUnion = page.getByRole('button', { name: 'Boolean Union' });
    await booleanUnion.click();
    await expect(booleanUnion).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="freeform-vertex-marker"]')).toHaveCount(0);
    await expect(page.locator('.nested-node.actor-node', { hasText: 'Operand A' })).toBeVisible();
    await expect(page.locator('.nested-node.actor-node', { hasText: 'Operand B' })).toBeVisible();
    await page.getByRole('button', { name: 'Dissolve Boolean' }).click();
    await expect(page.locator('.actor-node', { hasText: 'Operand A' })).toHaveCount(1);
    await expect(page.locator('.actor-node', { hasText: 'Operand B' })).toHaveCount(1);
    // C8: the operands back at the top level are the confirmation (no toast).
    await expect(page.locator('.nested-node.actor-node', { hasText: 'Operand A' })).toHaveCount(0);
    await expect(page.getByText('Boolean dissolved', { exact: false })).toHaveCount(0);
  });

  test('resets pan while preserving zoom, grid, and active tool', async ({ page }) => {
    await seed(page, [layer('a', 'Shape', 'custom_rect', 0)]);
    await page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name: 'Zoom out' }).click();
    await expect(page.locator('.stage-canvas-container')).toHaveAttribute('data-camera-zoom', '0.9');
    // C7: the camera lives in the viewBox; pan/zoom are read from where the
    // world origin is drawn and how large one world unit is on screen.
    const camera = () => page.locator('.stage-svg').evaluate((svg) => {
      const m = (svg as SVGSVGElement).getScreenCTM()!;
      const origin = new DOMPoint(300, 240).matrixTransform(m);
      return { x: origin.x, y: origin.y, scale: m.a };
    });
    const zoomedOut = await camera();
    await page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name: 'Pan' }).click();
    await page.getByRole('button', { name: 'Toggle grid' }).click();
    const canvas = page.locator('.stage-canvas-container');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 80, box!.y + box!.height / 2 + 40);
    await page.mouse.up();
    const panned = await camera();
    expect(Math.hypot(panned.x - zoomedOut.x, panned.y - zoomedOut.y)).toBeGreaterThan(40);
    expect(panned.scale).toBeCloseTo(zoomedOut.scale, 6);
    await page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name: 'Reset view' }).click();
    await expect(page.locator('.stage-canvas-container')).toHaveAttribute('data-camera-zoom', '0.9');
    await expect(page.getByRole('button', { name: 'Toggle grid' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name: 'Pan' })).toHaveAttribute('aria-pressed', 'true');
    // Pan reset, zoom kept: the origin is back where the 0.9 view put it, at the same scale.
    await expect.poll(async () => { const now = await camera(); return Math.round(Math.hypot(now.x - zoomedOut.x, now.y - zoomedOut.y)) + (Math.abs(now.scale - zoomedOut.scale) < 1e-6 ? 0 : 1000); }).toBe(0);
    await page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name: 'Reset view' }).click();
    await expect(page.locator('.stage-canvas-container')).toHaveAttribute('data-camera-zoom', '0.9');
    await expect(page.getByRole('button', { name: 'Toggle grid' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name: 'Pan' })).toHaveAttribute('aria-pressed', 'true');
    // Pan reset, zoom kept: the origin is back where the 0.9 view put it, at the same scale.
    await expect.poll(async () => { const now = await camera(); return Math.round(Math.hypot(now.x - zoomedOut.x, now.y - zoomedOut.y)) + (Math.abs(now.scale - zoomedOut.scale) < 1e-6 ? 0 : 1000); }).toBe(0);
  });

  test('supports arbitrary pointer drag without alignment snapping', async ({ page }) => {
    await seed(page, [
      layer('source', 'Drag Source', 'custom_box', -240, { width: 160, height: 120 }),
      layer('a', 'Draggable Shape', 'custom_rect', 0, { matte: { sourcePartId: 'source', mode: 'clip', enabled: true } }),
    ]);
    await page.locator('.actor-node', { hasText: 'Draggable Shape' }).click();
    const hitArea = page.locator('[data-testid="matte-editor-hit-area"][data-part-id="a"]');
    const box = await hitArea.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 73, box!.y + box!.height / 2 + 31, { steps: 4 });
    await page.mouse.up();
    const __savedBefore1 = await page.locator('.autosave-status-badge').getAttribute('data-last-saved-at');
    await page.locator('.autosave-status-badge').click();
    await expect
      .poll(async () => Number((await page.locator('.autosave-status-badge').getAttribute('data-last-saved-at')) || '0'), { timeout: 10_000 })
      .toBeGreaterThan(Number(__savedBefore1 || '0'));
    await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').layers?.find((item: { id: string }) => item.id === 'a')?.x, STORAGE_KEY)).not.toBe(0);
  });
});
