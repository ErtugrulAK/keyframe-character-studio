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
  test('uses individual selection bounds and exposes no alignment block', async ({ page }) => {
    await seed(page, [layer('triangle', 'Triangle', 'custom_triangle', -160), layer('para', 'Parallelogram', 'custom_parallelogram', 160)]);
    await page.locator('.actor-node', { hasText: 'Triangle' }).click();
    await expect(page.locator('[data-testid="transform-gizmo"]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Align Left' })).toHaveCount(0);
    await page.locator('.actor-node', { hasText: 'Parallelogram' }).click({ modifiers: ['Control'] });
    await expect(page.locator('[data-testid="transform-gizmo"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="aggregate-selection-box"]')).toHaveCount(0);
  });

  test('supports Boolean creation, hierarchy, operand inspection, and dissolve preservation', async ({ page }) => {
    await seed(page, [layer('a', 'Operand A', 'custom_rect', -40), layer('b', 'Operand B', 'custom_circle', 40)]);
    await page.locator('.actor-node', { hasText: 'Operand A' }).click();
    await page.locator('.actor-node', { hasText: 'Operand B' }).click({ modifiers: ['Control'] });
    await page.getByRole('button', { name: 'Union', exact: true }).click();
    await expect(page.getByText('BOOLEAN', { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="freeform-vertex-marker"]')).toHaveCount(0);
    await expect(page.locator('.nested-node.actor-node', { hasText: 'Operand A' })).toBeVisible();
    await expect(page.locator('.nested-node.actor-node', { hasText: 'Operand B' })).toBeVisible();
    await page.locator('.boolean-dissolve-button').click();
    await expect(page.locator('.actor-node', { hasText: 'Operand A' })).toHaveCount(1);
    await expect(page.locator('.actor-node', { hasText: 'Operand B' })).toHaveCount(1);
    await expect(page.getByText('Boolean dissolved; operands preserved.', { exact: true })).toBeVisible();
  });

  test('keeps Reset View zoom while resetting pan', async ({ page }) => {
    await seed(page, [layer('a', 'Shape', 'custom_rect', 0)]);
    await page.getByRole('button', { name: 'Zoom Out (-)' }).click();
    await expect(page.locator('.zoom-level-text')).toHaveText('90%');
    await page.getByRole('button', { name: 'Reset View Position' }).click();
    await expect(page.locator('.zoom-level-text')).toHaveText('90%');
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
    await page.locator('.autosave-status-badge').click();
    await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').layers?.find((item: { id: string }) => item.id === 'a')?.x, STORAGE_KEY)).not.toBe(0);
  });
});
