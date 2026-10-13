import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * AUTHORING UX — CROSS-FEATURE INTERACTION COLLISIONS.
 *
 * The authoring surfaces added by this slice (the paint popover, the top
 * toolbar, the editor context menu, layer groups and the aggregate group frame)
 * meet each other and the pre-existing editor in a real browser here:
 *
 *  - the menu's keyboard contract against the global authoring shortcuts;
 *  - the paint popover against an Inspector that collapses and reopens;
 *  - the menu against a moved camera;
 *  - a group container against the Boolean authority;
 *  - the aggregate frame against the corner resize and the history;
 *  - the toolbar's tool switch against the selection-frame handles;
 *  - groups against parenting, bonding, mirrored layers and keyframes in
 *    several sequences, plus save/reload.
 *
 * Every measurement is taken from the rendered DOM or the persisted document,
 * never from a mock.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const TOLERANCE_PX = 1;

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const keyed = (id: string, frame: number, value: number, templateId = 'Sequence') => ({ id, frame, value, easing: 'linear', templateId });

interface LayerSeed {
  id: string;
  name: string;
  x: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  parentId?: string;
  boundPartIds?: string[];
  zIndex?: number;
}

const shape = (seed: LayerSeed) => ({
  type: 'custom_rect',
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  zIndex: 1,
  opacity: 1,
  visible: true,
  fillColor: '#22d3ee',
  strokeColor: '#101218',
  fillEnabled: true,
  strokeEnabled: false,
  width: 160,
  height: 120,
  ...seed,
});

async function seed(
  page: Page,
  layers: LayerSeed[],
  tracks?: { partId: string; channels: Record<string, unknown[]> }[],
  extra: Record<string, unknown> = {},
  /** `false` keeps the app's own later saves authoritative across reloads. */
  reseedOnEveryLoad = true,
): Promise<void> {
  const scene = JSON.stringify({
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    width: 1920,
    height: 1080,
    fps: 30,
    totalFrames: 60,
    layers: layers.map(shape),
    tracks: tracks ?? layers.map((layer) => ({ partId: layer.id, channels: channel() })),
    ...extra,
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  if (reseedOnEveryLoad) {
    await page.addInitScript(
      (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
      { key: STORAGE_KEY, value: scene },
    );
  } else {
    await page.evaluate(
      (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
      { key: STORAGE_KEY, value: scene },
    );
  }
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

/** The world transform string the renderer gives a layer. */
const renderedTransform = (page: Page, id: string) =>
  page.locator(`[data-part-id="${id}"] > g`).first().getAttribute('transform');

const layerBox = (page: Page, id: string) => page.locator(`[data-part-id="${id}"]`).first().boundingBox();

async function snapshot(page: Page): Promise<string> {
  await page.locator('.autosave-status-badge').click();
  return page.evaluate((key) => localStorage.getItem(key) ?? '', STORAGE_KEY);
}

const persisted = async (page: Page): Promise<{
  layers: { id: string; name: string; x: number; y: number; scaleX: number; scaleY: number; parentId?: string; isGroup?: boolean; boundPartIds?: string[]; fillColor?: string }[];
  tracks: { partId: string; channels: Record<string, { frame: number; value: number; templateId?: string }[]> }[];
}> => JSON.parse(await snapshot(page));

const toolbarButton = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('button', { name, exact: true });

const menu = (page: Page) => page.getByRole('menu', { name: 'Editor actions' });
const groupRows = (page: Page) => page.locator('.actor-node[data-group-container="true"]');

async function selectLayers(page: Page, names: string[]): Promise<void> {
  await page.locator('.actor-node', { hasText: names[0] }).first().click();
  for (const name of names.slice(1)) {
    await page.locator('.actor-node', { hasText: name }).first().click({ modifiers: ['Control'] });
  }
}

async function groupSelection(page: Page): Promise<void> {
  await toolbarButton(page, 'Group layers').click();
  await expect(groupRows(page)).toHaveCount(1);
}

async function ungroupSelection(page: Page): Promise<void> {
  await toolbarButton(page, 'Ungroup layers').click();
  await expect(groupRows(page)).toHaveCount(0);
}

const groupBox = (page: Page) => page.getByTestId('group-aggregate-box');

/** The four corner handles of the selection frame, addressed by their geometry. */
async function cornerHandles(page: Page, scope: Locator): Promise<{ tl: { x: number; y: number }; br: { x: number; y: number }; count: number }> {
  const targets = scope.getByTestId('gizmo-hit-target');
  const total = await targets.count();
  const corners: { x: number; y: number }[] = [];
  for (let index = 0; index < total; index += 1) {
    const handle = targets.nth(index);
    const cursor = await handle.evaluate((node) => getComputedStyle(node).cursor);
    if (!cursor.includes('resize') || cursor.includes('ew') || cursor.includes('ns')) continue;
    const box = await handle.boundingBox();
    if (box) corners.push({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }
  expect(corners.length, 'the selection frame must expose exactly four corner handles').toBe(4);
  const sorted = [...corners].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  return { tl: sorted[0], br: sorted[sorted.length - 1], count: corners.length };
}

async function dragWithin(page: Page, target: Locator, from: { fx: number; fy: number }, to: { fx: number; fy: number }): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('drag target has no box');
  await page.mouse.move(box.x + box.width * from.fx, box.y + box.height * from.fy);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to.fx, box.y + box.height * to.fy, { steps: 8 });
  await page.mouse.up();
}

/** Waits until a layer's rendered box stops moving. */
async function settle(page: Page, id: string): Promise<void> {
  const target = page.locator(`[data-part-id="${id}"]`).first();
  await expect.poll(async () => {
    const first = await target.boundingBox();
    await page.waitForTimeout(60);
    const second = await target.boundingBox();
    return first && second
      ? Math.abs(first.x - second.x) + Math.abs(first.y - second.y) + Math.abs(first.width - second.width)
      : 999;
  }, { timeout: 10000 }).toBeLessThanOrEqual(TOLERANCE_PX);
}

const stageCentre = async (page: Page): Promise<{ x: number; y: number }> => {
  const box = await page.locator('.stage-canvas-container').boundingBox();
  if (!box) throw new Error('Stage bounds unavailable');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const panOnEmptyStage = async (page: Page, dx: number, dy: number): Promise<void> => {
  // Empty canvas only: a mousedown that lands on a layer belongs to that layer
  // (the renderer consumes it), so a pan started over artwork never reaches the
  // camera. The offset clears both the seeded layer and its selection frame.
  const box = await page.locator('.stage-canvas-container').boundingBox();
  if (!box) throw new Error('Stage bounds unavailable');
  const centre = { x: box.x + box.width * 0.2, y: box.y + box.height * 0.2 };
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x + dx, centre.y + dy, { steps: 5 });
  await page.mouse.up();
};

test('the menu owns Escape: the shape tool keeps its authoring session', async ({ page }) => {
  await seed(page, [{ id: 'a', name: 'Alpha', x: 0 }]);

  // Arm the rectangle tool, then open the editor menu from the keyboard.
  await page.getByRole('button', { name: 'Vector Shapes & Graphic Elements' }).click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.keyboard.press('Shift+F10');
  await expect(menu(page)).toBeVisible();

  // Escape closes the menu and must not reach the editor's Escape authority,
  // which would cancel the shape tool.
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);

  // The tool survives: the very next drag still creates the rectangle.
  const centre = await stageCentre(page);
  await page.mouse.move(centre.x + 120, centre.y + 100);
  await page.mouse.down();
  await page.mouse.move(centre.x + 40, centre.y + 20);
  await page.mouse.up();
  await expect(page.locator('.actor-node')).toHaveCount(2);
  await expect(page.locator('.actor-node', { hasText: 'Alpha' })).toHaveCount(1);
});

/** Opens the Inspector's paint card, whatever state it is in. */
async function openAppearance(page: Page): Promise<void> {
  const disclosure = page.getByRole('button', { name: /(?:Expand|Collapse) APPEARANCE/u });
  if (await disclosure.getAttribute('aria-expanded') === 'false') await disclosure.click();
}

test('the paint popover keeps authoring through an inspector collapse and reopen', async ({ page }) => {
  await seed(page, [{ id: 'a', name: 'Alpha', x: 0 }]);
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await openAppearance(page);

  const authoredFill = async (): Promise<string> => page.getByRole('button', { name: 'FILL COLOR Color Preview' })
    .locator('.color-swatch-color')
    .evaluate((node) => (node as HTMLElement).style.backgroundColor);

  // Paint is authored in the Inspector's Appearance card — the one surface that
  // owns fill and stroke since the toolbar stopped carrying them (R2-08).
  const fillSwatch = page.getByRole('button', { name: 'FILL COLOR Color Preview' });
  await expect(fillSwatch).toBeVisible();
  await fillSwatch.click();
  const dialog = page.getByRole('dialog', { name: 'FILL COLOR Color Picker' });
  await expect(dialog).toBeVisible();
  await dragWithin(page, dialog.getByRole('slider', { name: 'FILL COLOR Saturation and Brightness' }), { fx: 0.2, fy: 0.2 }, { fx: 0.8, fy: 0.7 });
  const authored = await authoredFill();
  expect(authored).not.toBe('rgb(34, 211, 238)');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  // Collapsing and reopening the Inspector shows the same authored paint.
  await page.getByRole('button', { name: 'Hide Inspector' }).click();
  await expect(page.getByRole('button', { name: 'Hide Inspector' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show Inspector' }).click();
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await openAppearance(page);
  const inspectorSwatch = page.getByRole('button', { name: 'FILL COLOR Color Preview' });
  await expect(inspectorSwatch.locator('.color-swatch-color')).toHaveCSS('background-color', authored);
  const record = (await persisted(page)).layers.find((layer) => layer.id === 'a');
  expect(record?.fillColor).toBeTruthy();
});

test('the menu opens on the pointer after a zoom and a pan without moving the world', async ({ page }) => {
  await seed(page, [{ id: 'a', name: 'Alpha', x: 0 }]);

  await toolbarButton(page, 'Zoom in').click();
  await toolbarButton(page, 'Pan').click();
  await panOnEmptyStage(page, 40, 30);
  await toolbarButton(page, 'Select').click();
  await settle(page, 'a');

  const before = await layerBox(page, 'a');
  expect(before).not.toBeNull();
  await page.mouse.click(before!.x + before!.width / 2, before!.y + before!.height / 2, { button: 'right' });
  await expect(menu(page)).toBeVisible();
  await expect(page.locator('.actor-node.primary-selected', { hasText: 'Alpha' })).toHaveCount(1);

  const menuBox = await menu(page).boundingBox();
  const viewport = page.viewportSize();
  expect(menuBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThanOrEqual(0);
  expect(menuBox!.y).toBeGreaterThanOrEqual(0);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(viewport!.width);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(viewport!.height);

  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  const after = await layerBox(page, 'a');
  expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(TOLERANCE_PX);
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(TOLERANCE_PX);
});

test('a group container is never offered as a Boolean operand', async ({ page }) => {
  await seed(page, [
    { id: 'a', name: 'Alpha', x: -120, zIndex: 1 },
    { id: 'b', name: 'Beta', x: 120, zIndex: 2 },
    { id: 'c', name: 'Gamma', x: 0, y: 200, zIndex: 3 },
  ]);

  // Positive control: two plain shapes do offer the Boolean authority.
  await selectLayers(page, ['Alpha', 'Beta']);
  await expect(toolbarButton(page, 'Boolean Union')).toBeEnabled();

  await groupSelection(page);
  // The action stays on screen and is unavailable for the container alone.
  await expect(toolbarButton(page, 'Boolean Union')).toBeDisabled();

  // The container plus one shape is still not a Boolean: the container owns no
  // geometry of its own.
  await page.locator('.actor-node', { hasText: 'Gamma' }).first().click({ modifiers: ['Control'] });
  await expect(groupRows(page)).toHaveCount(1);
  await expect(toolbarButton(page, 'Boolean Union')).toBeDisabled();
  await expect(toolbarButton(page, 'Boolean Subtract')).toBeDisabled();

  // Two plain shapes still do, so the rule is about the container.
  await page.keyboard.press('Escape');
  await selectLayers(page, ['Gamma', 'Alpha']);
  await page.locator('.actor-node', { hasText: 'Beta' }).first().click({ modifiers: ['Control'] });
  await expect(toolbarButton(page, 'Boolean Union')).toBeEnabled();
});

test('an empty document offers no grouping, paint or menu surface', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

  await expect(page.getByRole('toolbar', { name: 'Authoring tools' })).toBeVisible();
  // The state-dependent actions are on screen and unavailable with nothing to
  // act on; the paint group is the only one that is not offered at all.
  await expect(toolbarButton(page, 'Group layers')).toBeDisabled();
  await expect(toolbarButton(page, 'Boolean Union')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Fill Color Preview' })).toHaveCount(0);
  expect(await page.locator('.actor-node').count()).toBe(0);

  const centre = await stageCentre(page);
  await page.mouse.click(centre.x, centre.y, { button: 'right' });
  await expect(menu(page)).toHaveCount(0);
});

test('the aggregate frame resizes the whole group around the fixed corner, undoably', async ({ page }) => {
  await seed(page, [
    { id: 'a', name: 'Alpha', x: -120, zIndex: 1 },
    { id: 'b', name: 'Beta', x: 120, zIndex: 2 },
  ]);
  await selectLayers(page, ['Alpha', 'Beta']);
  await groupSelection(page);
  await settle(page, 'a');

  const handlesBefore = await cornerHandles(page, groupBox(page));
  const before = await persisted(page);
  const frameBefore = await groupBox(page).boundingBox();
  const childTransformsBefore = [await renderedTransform(page, 'a'), await renderedTransform(page, 'b')];
  const localsBefore = before.layers
    .filter((layer) => !layer.isGroup)
    .map((layer) => `${layer.id}:${layer.x}:${layer.y}:${layer.scaleX}:${layer.scaleY}`)
    .join('|');

  // Shrink the group by dragging the top-left corner towards the fixed bottom-right.
  const target = {
    x: handlesBefore.br.x + (handlesBefore.tl.x - handlesBefore.br.x) * 0.6,
    y: handlesBefore.br.y + (handlesBefore.tl.y - handlesBefore.br.y) * 0.6,
  };
  await page.mouse.move(handlesBefore.tl.x, handlesBefore.tl.y);
  await page.mouse.down();
  await page.mouse.move(
    handlesBefore.tl.x + (target.x - handlesBefore.tl.x) / 2,
    handlesBefore.tl.y + (target.y - handlesBefore.tl.y) / 2,
    { steps: 4 },
  );
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await page.mouse.up();
  await settle(page, 'a');

  const handlesAfter = await cornerHandles(page, groupBox(page));
  const frameAfter = await groupBox(page).boundingBox();
  // The diagonally opposite corner is the anchor and may not drift.
  expect(Math.abs(handlesAfter.br.x - handlesBefore.br.x)).toBeLessThanOrEqual(TOLERANCE_PX);
  expect(Math.abs(handlesAfter.br.y - handlesBefore.br.y)).toBeLessThanOrEqual(TOLERANCE_PX);
  // The dragged corner follows the pointer.
  expect(Math.abs(handlesAfter.tl.x - target.x)).toBeLessThanOrEqual(TOLERANCE_PX);
  expect(Math.abs(handlesAfter.tl.y - target.y)).toBeLessThanOrEqual(TOLERANCE_PX);
  // The frame really shrank, and the layers moved with it...
  expect(frameAfter!.width).toBeLessThan(frameBefore!.width);
  expect([await renderedTransform(page, 'a'), await renderedTransform(page, 'b')]).not.toEqual(childTransformsBefore);
  // ...while carrying the scale on the container, not on the layers' own poses.
  const after = await persisted(page);
  const localsAfter = after.layers
    .filter((layer) => !layer.isGroup)
    .map((layer) => `${layer.id}:${layer.x}:${layer.y}:${layer.scaleX}:${layer.scaleY}`)
    .join('|');
  expect(localsAfter).toBe(localsBefore);
  const container = after.layers.find((layer) => layer.isGroup);
  expect(container).toBeTruthy();
  // Shrinking the frame must not flip the container's scale sign.
  expect(container!.scaleX).toBeGreaterThan(0);
  expect(container!.scaleX).toBeLessThan(1);

  // One drag is one history entry, and undo restores the exact document.
  const resized = await snapshot(page);
  await page.locator('button[title="Undo"]').click();
  await settle(page, 'a');
  expect(await snapshot(page)).not.toBe(resized);
  const frameUndone = await groupBox(page).boundingBox();
  expect(Math.abs(frameUndone!.width - frameBefore!.width)).toBeLessThanOrEqual(TOLERANCE_PX);
  await page.locator('button[title="Redo"]').click();
  await settle(page, 'a');
  expect(await snapshot(page)).toBe(resized);
});

test('the toolbar pan tool pans without writing, and Select restores handle resizing', async ({ page }) => {
  await seed(page, [{ id: 'a', name: 'Alpha', x: 0 }]);
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await settle(page, 'a');

  const before = await snapshot(page);
  const undoWasDisabled = await page.locator('button[title="Undo"]').isDisabled();
  const boxBefore = await layerBox(page, 'a');

  await toolbarButton(page, 'Pan').click();
  await expect(toolbarButton(page, 'Pan')).toHaveAttribute('aria-pressed', 'true');
  await panOnEmptyStage(page, 60, 40);
  await settle(page, 'a');

  // A pan is a camera gesture: the document and the history are untouched.
  expect(await snapshot(page)).toBe(before);
  expect(await page.locator('button[title="Undo"]').isDisabled()).toBe(undoWasDisabled);
  const panned = await layerBox(page, 'a');
  expect(Math.abs(panned!.x - boxBefore!.x)).toBeGreaterThan(TOLERANCE_PX);

  // Back on Select, the same frame corner resizes the layer again.
  await toolbarButton(page, 'Select').click();
  await settle(page, 'a');
  const handles = await cornerHandles(page, page.getByTestId('transform-gizmo').first());
  const target = {
    x: handles.br.x + (handles.tl.x - handles.br.x) * 0.7,
    y: handles.br.y + (handles.tl.y - handles.br.y) * 0.7,
  };
  await page.mouse.move(handles.tl.x, handles.tl.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 6 });
  await page.mouse.up();
  await settle(page, 'a');
  expect(await snapshot(page)).not.toBe(before);
  const scaled = (await persisted(page)).layers.find((layer) => layer.id === 'a');
  expect(Math.abs(scaled!.scaleX - 1) + Math.abs(scaled!.scaleY - 1)).toBeGreaterThan(0.05);
});

test('grouping inside a parent keeps every parent-space pose and ungroups exactly', async ({ page }) => {
  await seed(page, [
    { id: 'p', name: 'Parent', x: 200, zIndex: 1 },
    { id: 'a', name: 'Alpha', x: -60, parentId: 'p', zIndex: 2 },
    { id: 'b', name: 'Beta', x: 60, parentId: 'p', zIndex: 3 },
  ]);
  const before = await snapshot(page);
  const transformsBefore = [await renderedTransform(page, 'a'), await renderedTransform(page, 'b')];

  await selectLayers(page, ['Alpha', 'Beta']);
  await groupSelection(page);

  // The container joins the same parent, and no child changed its pose.
  const grouped = await persisted(page);
  const container = grouped.layers.find((layer) => layer.isGroup);
  expect(container?.parentId).toBe('p');
  expect(grouped.layers.find((layer) => layer.id === 'a')?.parentId).toBe(container!.id);
  expect(await renderedTransform(page, 'a')).toBe(transformsBefore[0]);
  expect(await renderedTransform(page, 'b')).toBe(transformsBefore[1]);

  // Moving the container moves the whole nested group.
  await page.getByRole('button', { name: 'Expand TRANSFORM' }).first().click();
  await page.getByLabel('Position X').first().fill('260');
  await page.getByLabel('Position X').first().blur();
  await settle(page, 'a');
  expect(await renderedTransform(page, 'a')).not.toBe(transformsBefore[0]);

  await page.getByLabel('Position X').first().fill('200');
  await page.getByLabel('Position X').first().blur();
  await settle(page, 'a');
  expect(await renderedTransform(page, 'a')).toBe(transformsBefore[0]);

  await ungroupSelection(page);
  expect(await snapshot(page)).toBe(before);
});

test('bonded layers keep their bond and move together through grouping', async ({ page }) => {
  await seed(page, [
    { id: 'a', name: 'Alpha', x: -120, zIndex: 1, boundPartIds: ['b'] },
    { id: 'b', name: 'Beta', x: 120, zIndex: 2, boundPartIds: ['a'] },
  ]);
  const transformsBefore = [await renderedTransform(page, 'a'), await renderedTransform(page, 'b')];

  await selectLayers(page, ['Alpha', 'Beta']);
  await groupSelection(page);
  expect(await renderedTransform(page, 'a')).toBe(transformsBefore[0]);
  expect(await renderedTransform(page, 'b')).toBe(transformsBefore[1]);

  const grouped = await persisted(page);
  expect(grouped.layers.find((layer) => layer.id === 'a')?.boundPartIds).toEqual(['b']);
  expect(grouped.layers.find((layer) => layer.id === 'b')?.boundPartIds).toEqual(['a']);

  // Moving the container carries both bonded layers by the same world delta.
  await page.getByRole('button', { name: 'Expand TRANSFORM' }).first().click();
  await page.getByLabel('Position X').first().fill('50');
  await page.getByLabel('Position X').first().blur();
  await settle(page, 'a');
  const moved = [await renderedTransform(page, 'a'), await renderedTransform(page, 'b')];
  const shiftX = (source: string | null) => Number(/translate\((-?[\d.]+)/.exec(source ?? '')?.[1] ?? 'NaN');
  expect(shiftX(moved[0]) - shiftX(transformsBefore[0])).toBeCloseTo(50, 3);
  expect(shiftX(moved[1]) - shiftX(transformsBefore[1])).toBeCloseTo(50, 3);

  await ungroupSelection(page);
  const ungrouped = await persisted(page);
  expect(ungrouped.layers.find((layer) => layer.id === 'a')?.boundPartIds).toEqual(['b']);
  expect(ungrouped.layers.find((layer) => layer.id === 'b')?.boundPartIds).toEqual(['a']);
});

test('mirrored layers group and ungroup without changing their rendered pose', async ({ page }) => {
  await seed(page, [
    { id: 'a', name: 'Alpha', x: -90, zIndex: 1, scaleX: -1 },
    { id: 'b', name: 'Beta', x: 90, zIndex: 2 },
  ]);
  const before = await snapshot(page);
  const transformsBefore = [await renderedTransform(page, 'a'), await renderedTransform(page, 'b')];

  await selectLayers(page, ['Alpha', 'Beta']);
  await groupSelection(page);
  expect(await renderedTransform(page, 'a')).toBe(transformsBefore[0]);
  expect(await renderedTransform(page, 'b')).toBe(transformsBefore[1]);
  const frame = await groupBox(page).boundingBox();
  expect(frame!.width).toBeGreaterThan(0);
  expect(frame!.height).toBeGreaterThan(0);

  await ungroupSelection(page);
  expect(await snapshot(page)).toBe(before);
});

test('grouping folds the keyframes of every sequence and ungroups exactly', async ({ page }) => {
  const channels = channel();
  channels.x = [keyed('sx0', 0, 40), keyed('sx30', 30, 40), keyed('tx30', 30, 5, 'Stunt')];
  await seed(
    page,
    [
      { id: 'a', name: 'Alpha', x: -120, zIndex: 1 },
      { id: 'b', name: 'Beta', x: 160, zIndex: 2 },
    ],
    [{ partId: 'a', channels }, { partId: 'b', channels: channel() }],
    {
      motionTemplates: [
        { id: 'Sequence', name: 'Sequence', type: 'in', durationFrames: 60 },
        { id: 'Stunt', name: 'Stunt', type: 'stunt', durationFrames: 30 },
      ],
    },
  );
  const before = await snapshot(page);
  // A different active sequence at the same frame has its own pose to preserve:
  // the Stunt template's clamp at frame 0 is 5 while the Sequence template's is 40.
  await page.locator('.timeline-seq-tab-name').filter({ hasText: 'Stunt' }).click();
  const stuntBefore = await renderedTransform(page, 'a');
  await page.locator('.timeline-seq-tab-name').filter({ hasText: 'Sequence' }).click();
  const renderedBefore = await renderedTransform(page, 'a');
  expect(stuntBefore).not.toBe(renderedBefore);

  await selectLayers(page, ['Alpha', 'Beta']);
  await groupSelection(page);

  // The fold is exact: the world pose is untouched, every keyframe keeps its
  // time, and every template moves by the same container delta.
  expect(await renderedTransform(page, 'a')).toBe(renderedBefore);
  const grouped = await persisted(page);
  const folded = grouped.tracks.find((track) => track.partId === 'a')!.channels.x;
  expect(folded.map((keyframe) => [keyframe.frame, keyframe.templateId])).toEqual([
    [0, 'Sequence'], [30, 'Sequence'], [30, 'Stunt'],
  ]);
  // The container's constant local x is the aggregate centre at this frame, so
  // it is exactly the delta every template is re-expressed by.
  const delta = grouped.layers.find((layer) => layer.isGroup)!.x;
  const valueAt = (frame: number, templateId: string) =>
    folded.find((keyframe) => keyframe.frame === frame && keyframe.templateId === templateId)!.value;
  expect(valueAt(0, 'Sequence')).toBe(40 - delta);
  expect(valueAt(30, 'Sequence')).toBe(40 - delta);
  expect(valueAt(30, 'Stunt')).toBe(5 - delta);

  // The same frame of another active sequence still renders identically.
  await page.locator('.timeline-seq-tab-name').filter({ hasText: 'Stunt' }).click();
  expect(await renderedTransform(page, 'a')).toBe(stuntBefore);
  await page.locator('.timeline-seq-tab-name').filter({ hasText: 'Sequence' }).click();

  await ungroupSelection(page);
  expect(await snapshot(page)).toBe(before);
});

test('ungroup dissolves an animated container and keeps every child in its world pose', async ({ page }) => {
  await seed(page, [
    { id: 'a', name: 'Alpha', x: -120, zIndex: 1 },
    { id: 'b', name: 'Beta', x: 120, zIndex: 2 },
  ]);
  await selectLayers(page, ['Alpha', 'Beta']);
  await groupSelection(page);

  // Keyframe the container itself through the timeline's own keyframe button.
  const containerId = (await persisted(page)).layers.find((layer) => layer.isGroup)!.id;
  await page.locator('.ue-track-row', { hasText: 'Group' }).first().getByTitle('Add Composite Keyframe').click();
  await snapshot(page);
  const containerTrack = (await persisted(page)).tracks.find((track) => track.partId === containerId)!;
  expect(Object.values(containerTrack.channels).some((channel) => channel.length > 0)).toBe(true);
  const keyedSnapshot = await snapshot(page);
  const worldBefore = [await renderedTransform(page, 'a'), await renderedTransform(page, 'b')];

  // R3-13: the blanket refusal is gone. An animated container dissolves, the
  // motion it owned ends up inside every child (so the children keep the world
  // pose they had while they hung off it), and the container track goes with it.
  await toolbarButton(page, 'Ungroup layers').click();
  await expect(groupRows(page)).toHaveCount(0);
  const ungrouped = await persisted(page);
  expect(ungrouped.layers.some((layer) => layer.isGroup)).toBe(false);
  expect(ungrouped.tracks.some((track) => track.partId === containerId)).toBe(false);
  expect([await renderedTransform(page, 'a'), await renderedTransform(page, 'b')]).toEqual(worldBefore);

  // One history entry: a single undo restores the container, its keys and the
  // children's parenting, with the document byte-identical to the keyed state.
  await page.locator('button[title="Undo"]').click();
  await expect(groupRows(page)).toHaveCount(1);
  expect(await snapshot(page)).toBe(keyedSnapshot);
});

test('colour, group and duplicate are one history entry each', async ({ page }) => {
  await seed(page, [
    { id: 'a', name: 'Alpha', x: -120, zIndex: 1 },
    { id: 'b', name: 'Beta', x: 120, zIndex: 2 },
  ]);
  const states: string[] = [await snapshot(page)];

  // 1. One paint gesture through the Inspector's shared popover authority.
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await openAppearance(page);
  await page.getByRole('button', { name: 'FILL COLOR Color Preview' }).click();
  const dialog = page.getByRole('dialog', { name: 'FILL COLOR Color Picker' });
  await dragWithin(page, dialog.getByRole('slider', { name: 'FILL COLOR Saturation and Brightness' }), { fx: 0.2, fy: 0.2 }, { fx: 0.85, fy: 0.75 });
  await page.keyboard.press('Escape');
  states.push(await snapshot(page));
  expect(states[1]).not.toBe(states[0]);

  // 2. One group.
  await selectLayers(page, ['Alpha', 'Beta']);
  await groupSelection(page);
  states.push(await snapshot(page));
  expect(states[2]).not.toBe(states[1]);

  // 3. One duplicate of the group, through the editor's duplicate authority.
  await page.locator('.actor-node[data-group-container="true"]').first().click();
  await page.keyboard.press('Control+d');
  await expect(groupRows(page)).toHaveCount(2);
  states.push(await snapshot(page));
  expect(states[3]).not.toBe(states[2]);

  // Undo walks back through exactly those three states, redo walks forward again.
  for (let index = states.length - 2; index >= 0; index -= 1) {
    await page.locator('button[title="Undo"]').click();
    await page.waitForTimeout(80);
    expect(await snapshot(page)).toBe(states[index]);
  }
  for (let index = 1; index < states.length; index += 1) {
    await page.locator('button[title="Redo"]').click();
    await page.waitForTimeout(80);
    expect(await snapshot(page)).toBe(states[index]);
  }
});

test('a group and an authored colour survive a reload, and ungroup still works', async ({ page }) => {
  await seed(page, [
    { id: 'a', name: 'Alpha', x: -120, zIndex: 1 },
    { id: 'b', name: 'Beta', x: 120, zIndex: 2 },
  ], undefined, {}, false);

  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await openAppearance(page);
  await page.getByRole('button', { name: 'FILL COLOR Color Preview' }).click();
  const dialog = page.getByRole('dialog', { name: 'FILL COLOR Color Picker' });
  await dragWithin(page, dialog.getByRole('slider', { name: 'FILL COLOR Saturation and Brightness' }), { fx: 0.2, fy: 0.2 }, { fx: 0.85, fy: 0.75 });
  await page.keyboard.press('Escape');

  await selectLayers(page, ['Alpha', 'Beta']);
  await groupSelection(page);
  const transformsBefore = [await renderedTransform(page, 'a'), await renderedTransform(page, 'b')];
  const authored = (await persisted(page)).layers.find((layer) => layer.id === 'a')?.fillColor;

  await snapshot(page);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

  // The container is a persisted document layer, not an editor-only view.
  await expect(groupRows(page)).toHaveCount(1);
  await expect(page.locator('.actor-node[data-tree-depth="1"]')).toHaveCount(2);
  const reloaded = await persisted(page);
  expect(reloaded.layers.find((layer) => layer.id === 'a')?.fillColor).toBe(authored);
  expect(reloaded.layers.find((layer) => layer.id === 'a')?.parentId).toBe(
    reloaded.layers.find((layer) => layer.isGroup)?.id,
  );
  // The children evaluate to the same world pose across the round trip.
  expect(await renderedTransform(page, 'a')).toBe(transformsBefore[0]);
  expect(await renderedTransform(page, 'b')).toBe(transformsBefore[1]);

  // And the group is still a live authoring surface after the reload.
  await page.locator('.actor-node[data-group-container="true"]').first().click();
  await ungroupSelection(page);
  const ungrouped = await persisted(page);
  expect(ungrouped.layers.some((layer) => layer.isGroup)).toBe(false);
  expect(await renderedTransform(page, 'a')).toBe(transformsBefore[0]);
});
