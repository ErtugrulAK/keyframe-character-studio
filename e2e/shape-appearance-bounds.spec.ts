import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function channels() {
  return { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] };
}

function layer(id: string, name: string, type: string, extra: Record<string, unknown> = {}) {
  return {
    id, name, type, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: id === 'source' ? 1 : 2, fillColor: '#ff0000', strokeColor: '#ffffff',
    ...extra,
  };
}

async function seed(page: import('@playwright/test').Page, layers: Record<string, unknown>[]) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([key, scene]) => localStorage.setItem(key, scene), [STORAGE_KEY, JSON.stringify({
    version: 1, layers, tracks: layers.map((part) => ({ partId: part.id, channels: channels() })),
    fps: 30, totalFrames: 90, width: 600, height: 480,
  })]);
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

test.describe('modern stroke-aware editor bounds', () => {
  test('thick outline remains visible, draggable, and marquee-selectable', async ({ page }) => {
    await seed(page, [layer('rect', 'Outline Rectangle', 'custom_rect', {
      fillEnabled: false, fillOpacity: 1, strokeEnabled: true, strokeWidth: 20, strokeOpacity: 1,
    })]);
    await page.locator('.actor-node', { hasText: 'Outline Rectangle' }).click();

    const shape = page.locator('.stage-svg rect[stroke-width="20"]').first();
    await expect(shape).toBeVisible();
    const shapeBox = await shape.boundingBox();
    expect(shapeBox).not.toBeNull();

    const outline = page.locator('.stage-svg rect[stroke="#00d2ff"][stroke-dasharray]').first();
    await expect(outline).toBeVisible();
    const outlineBox = await outline.boundingBox();
    expect(outlineBox).not.toBeNull();
    expect(Number(await outline.getAttribute('width'))).toBe(140);
    expect(Number(await outline.getAttribute('height'))).toBe(80);

    await page.mouse.move(shapeBox!.x + 2, shapeBox!.y + shapeBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(shapeBox!.x + 42, shapeBox!.y + shapeBox!.height / 2, { steps: 3 });
    await page.mouse.up();
    await page.locator('.autosave-status-badge').click();
    await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').layers?.[0]?.x, STORAGE_KEY)).toBeGreaterThan(0);

    await page.mouse.move(20, 20);
    await page.mouse.down();
    await page.mouse.move(shapeBox!.x + shapeBox!.width + 20, shapeBox!.y + shapeBox!.height + 20, { steps: 3 });
    await page.mouse.up();
    await expect(page.locator('.actor-node.primary-selected', { hasText: 'Outline Rectangle' })).toBeVisible();
  });

  test('fully clipped modern stroked matte target remains draggable only in edit mode', async ({ page }) => {
    await seed(page, [
      layer('source', 'Matte Source', 'custom_box', { width: 200, height: 140, fillColor: '#ffffff', strokeColor: '#101218' }),
      layer('target', 'Matte Target', 'custom_rect', {
        x: 220, width: 120, height: 60, fillEnabled: false, strokeEnabled: true, strokeWidth: 20, strokeOpacity: 1,
        matte: { sourcePartId: 'source', mode: 'clip', enabled: true },
      }),
    ]);
    await page.locator('.actor-node', { hasText: 'Matte Target' }).click();
    const hitArea = page.locator('[data-testid="matte-editor-hit-area"][data-part-id="target"]');
    await expect(hitArea).toBeVisible();
    const hitBox = await hitArea.boundingBox();
    const targetShapeBox = await page.locator('.stage-svg rect[stroke-width="20"]').first().boundingBox();
    expect(hitBox).not.toBeNull();
    expect(targetShapeBox).not.toBeNull();
    expect(Number(await hitArea.getAttribute('width'))).toBe(140);
    expect(Number(await hitArea.getAttribute('height'))).toBe(80);

    await page.mouse.move(hitBox!.x + hitBox!.width / 2, hitBox!.y + hitBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(hitBox!.x + hitBox!.width / 2 + 30, hitBox!.y + hitBox!.height / 2, { steps: 3 });
    await page.mouse.up();
    await page.locator('.autosave-status-badge').click();
    await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').layers?.find((layer: { id?: string }) => layer.id === 'target')?.x, STORAGE_KEY)).toBeGreaterThan(220);

    await page.getByText('BROADCAST', { exact: true }).click();
    await expect(page.locator('[data-testid="matte-editor-hit-area"]')).toHaveCount(0);
  });

  test('Appearance card stays aligned at normal and narrow desktop widths', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await seed(page, [layer('rect', 'Appearance Rectangle', 'custom_rect', {
      fillEnabled: true, fillOpacity: 0.5, strokeEnabled: true, strokeWidth: 20, strokeOpacity: 1,
    })]);
    await page.locator('.actor-node', { hasText: 'Appearance Rectangle' }).click();
    await page.getByText('Style', { exact: true }).click();

    const card = page.locator('.panel-card').filter({ hasText: 'APPEARANCE' }).first();
    await expect(card).toBeVisible();
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(await card.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);

    const fields = card.locator('.appearance-color-field, .appearance-field');
    const boxes = await fields.evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    }));
    expect(boxes.length).toBe(6);
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(cardBox!.x);
      expect(box.right).toBeLessThanOrEqual(cardBox!.x + cardBox!.width);
      expect(box.top).toBeGreaterThanOrEqual(cardBox!.y);
      expect(box.bottom).toBeLessThanOrEqual(cardBox!.y + cardBox!.height);
    }
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const horizontal = boxes[i].left < boxes[j].right && boxes[i].right > boxes[j].left;
        const vertical = boxes[i].top < boxes[j].bottom && boxes[i].bottom > boxes[j].top;
        expect(horizontal && vertical, `appearance fields ${i} and ${j} overlap`).toBe(false);
      }
    }
  });

  test('Appearance authoring persists RGBA alpha and undo restores the previous width', async ({ page }) => {
    await seed(page, [layer('rect', 'Authoring Rectangle', 'custom_rect', {
      fillEnabled: true, fillOpacity: 1, strokeEnabled: true, strokeColor: '#101218', strokeWidth: 1.5, strokeOpacity: 1,
    })]);
    await page.locator('.actor-node', { hasText: 'Authoring Rectangle' }).click();
    await page.getByText('Style', { exact: true }).click();
    const details = page.locator('.details-container');
    await expect(details.getByText('OPACITY', { exact: true })).toHaveCount(0);
    await page.getByLabel('Fill Enabled').uncheck();
    await page.locator('.appearance-color-field .color-hex-input').nth(1).fill('#ffffff');
    await page.getByLabel('Fill Alpha').fill('50');
    await page.getByLabel('Fill Alpha').press('Tab');
    await page.getByLabel('Stroke Alpha').fill('60');
    await page.getByLabel('Stroke Alpha').press('Tab');
    await page.getByLabel('Stroke Width').fill('8');
    await page.getByLabel('Stroke Width').press('Tab');
    await page.locator('.autosave-status-badge').click();

    await expect.poll(async () => page.evaluate((key) => {
      const layerData = JSON.parse(localStorage.getItem(key) || '{}').layers?.[0];
      return [layerData?.fillEnabled, layerData?.fillOpacity, layerData?.strokeOpacity, layerData?.strokeColor, layerData?.strokeWidth];
    }, STORAGE_KEY)).toEqual([false, 0.5, 0.6, '#ffffff', 8]);

    await page.keyboard.press('Control+Z');
    await page.locator('.autosave-status-badge').click();
    await expect.poll(async () => page.evaluate((key) => {
      const layerData = JSON.parse(localStorage.getItem(key) || '{}').layers?.[0];
      return [layerData?.strokeOpacity, layerData?.strokeWidth];
    }, STORAGE_KEY)).toEqual([0.6, 1.5]);

    await page.keyboard.press('Control+Z');
    await page.locator('.autosave-status-badge').click();
    await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').layers?.[0]?.strokeOpacity, STORAGE_KEY)).toBe(1);
  });
});
