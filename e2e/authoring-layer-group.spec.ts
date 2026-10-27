import { test, expect, type Page } from '@playwright/test';

/**
 * Layer groups in a real browser: one aggregate selection frame per group, the
 * frame never intercepts the pointer, the layers keep their exact poses, and
 * group/ungroup/delete go through the ordinary history and deletion paths.
 *
 * jsdom has no layout and no stylesheet, so the aggregate box, its contrast
 * halo and the pointer behaviour only exist here.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const shape = (id: string, name: string, x: number) => ({
  id, name, type: 'custom_rect', x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218',
  fillEnabled: true, strokeEnabled: false, width: 160, height: 120,
});

async function seed(page: Page, layers: Record<string, unknown>[]): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1',
    width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers, tracks: layers.map((layer) => ({ partId: layer.id as string, channels: channel() })),
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

/** The world transform string the renderer gives a layer. */
const renderedTransform = (page: Page, id: string) => page.locator(`[data-part-id="${id}"] > g`).first().getAttribute('transform');

async function selectLayers(page: Page, names: string[]): Promise<void> {
  await page.locator('.actor-node', { hasText: names[0] }).first().click();
  for (const name of names.slice(1)) {
    await page.locator('.actor-node', { hasText: name }).first().click({ modifiers: ['Control'] });
  }
}

/** The TRANSFORM card starts collapsed, so its fields need disclosing first. */
async function expandTransform(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Expand TRANSFORM' }).first();
  if (await toggle.count() > 0) await toggle.click();
}

async function groupSelection(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Group layers', exact: true }).click();
  await expect(page.locator('.actor-node[data-group-container="true"]')).toHaveCount(1);
}

test('a group draws ONE aggregate frame and leaves every layer exactly where it was', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120), shape('b', 'Beta', 120)]);
  const before = [await renderedTransform(page, 'a'), await renderedTransform(page, 'b')];

  await selectLayers(page, ['Alpha', 'Beta']);
  await groupSelection(page);

  // One frame for the whole group, and the layers nest under one container row.
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(1);
  await expect(page.getByTestId('transform-gizmo')).toHaveCount(1);
  await expect(page.locator('.actor-node[data-tree-depth="1"]')).toHaveCount(2);

  // The children keep their exact rendered pose.
  expect(await renderedTransform(page, 'a')).toBe(before[0]);
  expect(await renderedTransform(page, 'b')).toBe(before[1]);

  // The frame keeps the established dark halo under the accent dash, and both
  // strokes are decorative.
  const halo = page.getByTestId('selection-frame-halo').first();
  await expect(halo).toBeVisible();
  const haloPointerEvents = await halo.evaluate((node) => getComputedStyle(node).pointerEvents);
  expect(haloPointerEvents).toBe('none');
});

test('the aggregate frame moves, rotates and scales the layers together', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120), shape('b', 'Beta', 120)]);
  const before = [await renderedTransform(page, 'a'), await renderedTransform(page, 'b')];

  await selectLayers(page, ['Alpha', 'Beta']);
  await groupSelection(page);

  // The container is selected, so the Inspector drives the whole group.
  // Its Position X starts at the aggregate centre (0) and both layers must
  // follow the same world delta.
  await expandTransform(page);
  await page.getByLabel('Position X').first().fill('50');
  await page.getByLabel('Position X').first().blur();
  const shifted = (source: string | null) => source!.replace(
    /translate\((-?[\d.]+)/,
    (_match, x: string) => `translate(${Number(x) + 50}`,
  );
  expect(await renderedTransform(page, 'a')).toBe(shifted(before[0]));
  expect(await renderedTransform(page, 'b')).toBe(shifted(before[1]));

  // Rotating the container rotates the single aggregate frame with it.
  await page.getByLabel('Rotation', { exact: true }).first().fill('90');
  await page.getByLabel('Rotation', { exact: true }).first().blur();
  await expect(page.getByTestId('transform-gizmo')).toHaveAttribute('transform', /rotate\(90\)/);
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(1);
});

test('the frame never intercepts the pointer: a click targets the group and a double-click drills in', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120), shape('b', 'Beta', 120)]);
  await selectLayers(page, ['Alpha', 'Beta']);
  await groupSelection(page);

  const child = page.locator('[data-part-id="b"]').first();

  // The decorative aggregate frame stays INERT: the point at the child's centre
  // resolves to the child's own geometry, so the pointer reaches the canvas
  // selection path instead of being swallowed by the overlay.
  const hitsChild = await child.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit !== null && hit.closest('[data-part-id="b"]') !== null;
  });
  expect(hitsChild).toBe(true);

  // R4-09: a first canvas click on a child TARGETS the group container, so the
  // framed selection stays the container and no child-level selection is drawn.
  // The click landing here at all is what proves the frame does not intercept.
  await child.click();
  await expect(page.locator('.actor-node.primary-selected')).toHaveText(/Group/);
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(1);
  await expect(page.getByTestId('transform-gizmo')).toHaveCount(1);

  // ...and the EXPLICIT drill-in of the same pointer: a canvas double-click
  // enters the group and makes the child itself primary, without ungrouping.
  await child.dblclick();
  await expect(page.locator('.actor-node.primary-selected')).toHaveText(/Beta/);
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(0);
  await expect(page.getByTestId('transform-gizmo')).toHaveCount(1);
});

test('ungroup restores the layers in place, with no stale frame', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120), shape('b', 'Beta', 120)]);
  await selectLayers(page, ['Alpha', 'Beta']);
  await groupSelection(page);
  const groupedA = await renderedTransform(page, 'a');
  const groupedB = await renderedTransform(page, 'b');

  await page.getByRole('button', { name: 'Ungroup layers', exact: true }).click();

  await expect(page.locator('.actor-node[data-group-container="true"]')).toHaveCount(0);
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(0);
  // The two layers are selected, so each shows its own frame again.
  await expect(page.getByTestId('transform-gizmo')).toHaveCount(2);
  expect(await renderedTransform(page, 'a')).toBe(groupedA);
  expect(await renderedTransform(page, 'b')).toBe(groupedB);
});

test('group and ungroup are one exact undo step each', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120), shape('b', 'Beta', 120)]);
  await selectLayers(page, ['Alpha', 'Beta']);
  const before = [await renderedTransform(page, 'a'), await renderedTransform(page, 'b')];

  await groupSelection(page);
  // Selecting the container row also leaves any focused input behind, so the
  // undo shortcut reaches the editor.
  await page.locator('.actor-node[data-group-container="true"]').first().click();
  await page.keyboard.press('Control+z');

  await expect(page.locator('.actor-node[data-group-container="true"]')).toHaveCount(0);
  expect(await renderedTransform(page, 'a')).toBe(before[0]);
  expect(await renderedTransform(page, 'b')).toBe(before[1]);

  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.actor-node[data-group-container="true"]')).toHaveCount(1);
  await expect(page.locator('.actor-node[data-tree-depth="1"]')).toHaveCount(2);
});

test('deleting a group deletes the layers it owns', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120), shape('b', 'Beta', 120), shape('c', 'Gamma', 400)]);
  await selectLayers(page, ['Alpha', 'Beta']);
  await groupSelection(page);

  await page.locator('.actor-node[data-group-container="true"]').first().click();
  await page.keyboard.press('Delete');

  // C5 — a group is a container: the delete names the layers it takes BEFORE
  // anything changes (Cancel keeps all of them).
  const dialog = page.getByTestId('delete-dependents-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('delete-owned-list')).toContainText('Alpha');
  await expect(dialog.getByTestId('delete-owned-list')).toContainText('Beta');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.actor-node')).toHaveCount(4);
  await page.locator('.actor-node[data-group-container="true"]').first().click();
  await page.keyboard.press('Delete');
  await dialog.getByRole('button', { name: 'Delete 3 layers' }).click();

  await expect(page.locator('.actor-node')).toHaveCount(1);
  await expect(page.locator('.actor-node', { hasText: 'Gamma' })).toHaveCount(1);
  await expect(page.locator('[data-part-id="a"]')).toHaveCount(0);
  await expect(page.locator('[data-part-id="b"]')).toHaveCount(0);
});
