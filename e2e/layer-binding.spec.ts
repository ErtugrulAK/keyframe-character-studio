import { test, expect, type Page } from '@playwright/test';

/**
 * Layer bonding: two bonded layers move together (position only). The drag
 * path is the one the user asked about, so this drives a real stage drag and
 * checks the persisted document — for a shape bonded to a text, and for a
 * bonded pair of texts.
 *
 * R4-10 removed the toolbar's Bind/Unbind controls, so the bond is authored
 * into the seeded document rather than through the strip. The MODEL is
 * unchanged and still has to hold: a document that carries `boundPartIds`
 * loads, moves as one, keeps the bond through the move, and still round-trips
 * through the autosave/export path.
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

test('a bonded shape and text authored in the document move as one', async ({ page }) => {
  await seed(page, [
    layer('box', 'Box', 'custom_box', -300, 0, { boundPartIds: ['label'] }),
    layer('label', 'Label', 'custom_text', 300, 0, { textValue: 'Hello', fontSize: 90, fontFamily: 'Outfit', boundPartIds: ['box'] }),
  ]);

  // R4-10 — the toolbar no longer offers Bind/Unbind, so the strip carries no
  // bond control at all. The data path is unchanged: a document that carries
  // `boundPartIds` loads and keeps its bond.
  await expect(page.getByRole('button', { name: 'Bind selected layers' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Unbind selected layer' })).toHaveCount(0);

  await page.locator('.actor-node', { hasText: 'Box' }).first().click();
  await saveNow(page);
  const bound = await storedLayers(page);
  expect(bound.find((entry) => entry.id === 'box')?.boundPartIds).toEqual(['label']);
  expect(bound.find((entry) => entry.id === 'label')?.boundPartIds).toEqual(['box']);

  const boxBefore = positionOf(bound, 'box');
  const labelBefore = positionOf(bound, 'label');

  await dragPart(page, '.stage-svg [data-part-id="box"]', 120, 60);
  await saveNow(page);

  const afterDrag = await storedLayers(page);
  const boxAfter = positionOf(afterDrag, 'box');
  const labelAfter = positionOf(afterDrag, 'label');
  const deltaX = boxAfter.x! - boxBefore.x!;
  const deltaY = boxAfter.y! - boxBefore.y!;
  expect(Math.abs(deltaX)).toBeGreaterThan(10);
  // Position follows, and the bond itself is untouched by the move.
  expect(labelAfter.x).toBeCloseTo(labelBefore.x! + deltaX, 0);
  expect(labelAfter.y).toBeCloseTo(labelBefore.y! + deltaY, 0);
  expect(afterDrag.find((entry) => entry.id === 'label')?.boundPartIds).toEqual(['box']);
});

test('two text layers bonded in the document move together as well', async ({ page }) => {
  await seed(page, [
    layer('one', 'Title', 'custom_text', -250, 0, { textValue: 'A', fontSize: 80, fontFamily: 'Outfit', boundPartIds: ['two'] }),
    layer('two', 'Subtitle', 'custom_text', 250, 40, { textValue: 'B', fontSize: 60, fontFamily: 'Outfit', boundPartIds: ['one'] }),
  ]);

  await page.locator('.actor-node', { hasText: 'Title' }).first().click();
  await saveNow(page);
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

/**
 * B-01: the stage drag passes WORLD coordinates. A child that sits in a parent
 * container must land where the pointer moved it, and its bonded partner must
 * receive the same world delta — never a delta measured against the child's
 * local value.
 */
test('a parented bonded layer drags by the same world delta as a free layer', async ({ page }) => {
  await seed(page, [
    // Calibration group: two parentless layers bonded to each other.
    layer('ref1', 'Ref1', 'custom_box', -400, 0, { boundPartIds: ['ref2'] }),
    layer('ref2', 'Ref2', 'custom_box', -150, 0, { boundPartIds: ['ref1'] }),
    // Parented group: the child lives at local (100, 0) inside a parent at (200, 0).
    layer('p', 'Parent', 'custom_box', 200, 0),
    layer('child', 'Child', 'custom_box', 100, 0, { parentId: 'p', boundPartIds: ['buddy'] }),
    layer('buddy', 'Buddy', 'custom_box', 500, 0, { boundPartIds: ['child'] }),
  ]);

  // 1. Calibrate the world delta with a parentless drag.
  await page.locator('.actor-node', { hasText: 'Ref1' }).first().click();
  await dragPart(page, '.stage-svg [data-part-id="ref1"]', 120, 60);
  await saveNow(page);
  const ref = await storedLayers(page);
  const deltaX = positionOf(ref, 'ref1').x! - (-400);
  const deltaY = positionOf(ref, 'ref1').y! - 0;
  expect(Math.abs(deltaX)).toBeGreaterThan(10);

  // 2. Drag the parented child by the same pointer delta.
  await page.locator('.actor-node', { hasText: 'Child' }).first().click();
  await dragPart(page, '.stage-svg [data-part-id="child"]', 120, 60);
  await saveNow(page);

  const after = await storedLayers(page);
  const parentX = positionOf(after, 'p').x!;
  const childWorldX = parentX + positionOf(after, 'child').x!;
  const childWorldY = positionOf(after, 'p').y! + positionOf(after, 'child').y!;
  expect(childWorldX).toBeCloseTo(300 + deltaX, 0); // world start = 200 parent + 100 local
  expect(childWorldY).toBeCloseTo(0 + deltaY, 0);
  expect(positionOf(after, 'buddy').x).toBeCloseTo(500 + deltaX, 0);
  expect(positionOf(after, 'buddy').y).toBeCloseTo(0 + deltaY, 0);
});
