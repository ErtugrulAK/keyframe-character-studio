import { test, expect, type Page } from '@playwright/test';

/**
 * Layer bonding: two selected layers move together (position only). The drag
 * path is the one the user asked about, so this drives a real stage drag and
 * checks the persisted document — for a shape bonded to a text, and for the
 * release that makes them independent again.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const layer = (id: string, name: string, type: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id, name, type, x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#ff2080', strokeColor: '#101218', width: 120, height: 120,
  ...extra,
});

async function seed(page: Page, layers: Record<string, unknown>[]): Promise<void> {
  const scene = JSON.stringify({
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    width: 1920,
    height: 1080,
    fps: 30,
    totalFrames: 60,
    layers,
    tracks: layers.map((entry) => ({ partId: entry.id as string, channels: {}, keyframes: [] })),
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: scene },
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

async function saveNow(page: Page): Promise<void> {
  const badge = page.locator('.autosave-status-badge');
  if (await badge.count()) await badge.click();
  await expect(badge).toContainText('Just saved', { timeout: 10000 });
}

const storedLayers = (page: Page) => page.evaluate((key) => {
  const scene = JSON.parse(localStorage.getItem(key) ?? '{}') as {
    layers?: { id: string; x: number; y: number; boundPartIds?: string[] }[];
  };
  return scene.layers ?? [];
}, STORAGE_KEY);

const positionOf = (layers: { id: string; x: number; y: number }[], id: string) => {
  const found = layers.find((entry) => entry.id === id);
  return { x: found?.x ?? null, y: found?.y ?? null };
};

/** Drags the layer's own geometry (its top-left quadrant avoids the gizmo arms). */
async function dragPart(page: Page, selector: string, dx: number, dy: number): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box).not.toBeNull();
  const startX = box!.x + box!.width / 2;
  const startY = box!.y + box!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await page.mouse.move(startX + dx, startY + dy, { steps: 5 });
  await page.mouse.up();
}

test('a shape and a text bonded together move as one, and unbinding separates them', async ({ page }) => {
  await seed(page, [
    layer('box', 'Box', 'custom_box', -300, 0),
    layer('label', 'Label', 'custom_text', 300, 0, { textValue: 'Hello', fontSize: 90, fontFamily: 'Outfit' }),
  ]);

  // Both selected: the BIND card offers the bond.
  await page.locator('.actor-node', { hasText: 'Box' }).first().click();
  await page.locator('.actor-node', { hasText: 'Label' }).first().click({ modifiers: ['Control'] });
  await page.getByRole('button', { name: 'Bind', exact: true }).click();
  await saveNow(page);

  const bound = await storedLayers(page);
  expect(bound.find((entry) => entry.id === 'box')?.boundPartIds).toEqual(['label']);
  expect(bound.find((entry) => entry.id === 'label')?.boundPartIds).toEqual(['box']);

  const boxBefore = positionOf(bound, 'box');
  const labelBefore = positionOf(bound, 'label');

  await page.locator('.actor-node', { hasText: 'Box' }).first().click();
  await dragPart(page, '.stage-svg [data-part-id="box"]', 120, 60);
  await saveNow(page);

  const afterDrag = await storedLayers(page);
  const boxAfter = positionOf(afterDrag, 'box');
  const labelAfter = positionOf(afterDrag, 'label');
  const deltaX = boxAfter.x! - boxBefore.x!;
  const deltaY = boxAfter.y! - boxBefore.y!;
  expect(Math.abs(deltaX)).toBeGreaterThan(10);
  expect(labelAfter.x).toBeCloseTo(labelBefore.x! + deltaX, 0);
  expect(labelAfter.y).toBeCloseTo(labelBefore.y! + deltaY, 0);

  // Release: the BIND card lists the group and offers Unbind.
  await page.locator('.actor-node', { hasText: 'Label' }).first().click();
  await expect(page.getByRole('region', { name: 'Bound layers' })).toBeVisible();
  await page.getByRole('button', { name: 'Unbind' }).click();
  await saveNow(page);

  const released = await storedLayers(page);
  expect(released.find((entry) => entry.id === 'label')?.boundPartIds).toBeUndefined();
  const releasedLabel = positionOf(released, 'label');

  await page.locator('.actor-node', { hasText: 'Box' }).first().click();
  await dragPart(page, '.stage-svg [data-part-id="box"]', -80, 40);
  await saveNow(page);

  const independent = await storedLayers(page);
  expect(positionOf(independent, 'label')).toEqual(releasedLabel);
});

test('two text layers can be bonded as well', async ({ page }) => {
  await seed(page, [
    layer('one', 'Title', 'custom_text', -250, 0, { textValue: 'A', fontSize: 80, fontFamily: 'Outfit' }),
    layer('two', 'Subtitle', 'custom_text', 250, 40, { textValue: 'B', fontSize: 60, fontFamily: 'Outfit' }),
  ]);

  await page.locator('.actor-node', { hasText: 'Title' }).first().click();
  await page.locator('.actor-node', { hasText: 'Subtitle' }).first().click({ modifiers: ['Control'] });
  await page.getByRole('button', { name: 'Bind', exact: true }).click();
  await saveNow(page);

  await page.locator('.actor-node', { hasText: 'Title' }).first().click();
  const before = await storedLayers(page);
  await dragPart(page, '.stage-svg [data-part-id="one"]', 60, -30);
  await saveNow(page);

  const after = await storedLayers(page);
  const deltaX = positionOf(after, 'one').x! - positionOf(before, 'one').x!;
  const deltaY = positionOf(after, 'one').y! - positionOf(before, 'one').y!;
  expect(Math.abs(deltaX) + Math.abs(deltaY)).toBeGreaterThan(10);
  expect(positionOf(after, 'two').x).toBeCloseTo(positionOf(before, 'two').x! + deltaX, 0);
  expect(positionOf(after, 'two').y).toBeCloseTo(positionOf(before, 'two').y! + deltaY, 0);
});
