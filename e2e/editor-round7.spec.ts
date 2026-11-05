/**
 * QA round 7: the text options bar, double-click edit modes, a Boolean result
 * as a shape of its own, the Circle tool and Paste in Place.
 */
import { expect, test, type Page } from '@playwright/test';
import { armTool, openPathEditing, runObjectCommand } from './fixtures/toolbarTools';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

async function seed(page: Page, layers: Array<Record<string, unknown>>) {
  await page.goto('/');
  await page.evaluate(([key, value]) => { localStorage.clear(); localStorage.setItem(key, value); }, [STORAGE_KEY, JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: layers.map((layer) => ({ rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, fillColor: '#f97316', strokeColor: '#000000', ...layer })),
    tracks: layers.map((layer) => ({ id: `track-${layer.id}`, partId: layer.id, name: layer.name, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: {} })),
  })] as const);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const savedLayers = async (page: Page) => {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10_000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').layers as Array<Record<string, any>>, STORAGE_KEY);
};

const select = (page: Page, id: string) => page.locator(`[role="tree"] [data-layer-id="${id}"]`).click();
const centreOf = async (page: Page, id: string) => {
  const box = (await page.locator(`.stage-svg g[data-part-id="${id}"]`).first().boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test('a text layer is edited from the options bar; the Inspector keeps only its effects', async ({ page }) => {
  await seed(page, [{ id: 't', name: 'Title', type: 'custom_text', x: 0, y: 0, zIndex: 1, textValue: 'HELLO', fontSize: 40, fontFamily: 'Inter' }]);
  await expect(page.getByRole('toolbar', { name: 'Text options' })).toHaveCount(0);
  await select(page, 't');
  const bar = page.getByRole('toolbar', { name: 'Text options' });
  await expect(bar).toBeVisible();
  await bar.getByLabel('Text content').fill('WORLD');
  await bar.getByLabel('Text style').selectOption('Heading');
  await bar.getByRole('button', { name: 'Align text left' }).click();
  const [text] = await savedLayers(page);
  expect(text.textValue).toBe('WORLD');
  expect(text.fontFamily).toBe('Outfit');
  expect(text.fontSize).toBe(48);
  expect(text.textFit.align).toBe('left');
  await expect(page.getByRole('button', { name: 'Expand TEXT', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Expand TEXT EFFECTS' })).toBeVisible();
});

test('a path opens its points with a double-click and closes them with another', async ({ page }) => {
  await seed(page, [{ id: 'p', name: 'Path', type: 'custom_freeform', x: 0, y: 0, zIndex: 1,
    path: { version: 1, coordinateSpace: 'local', closed: true, points: [{ id: 'a', x: -100, y: -60 }, { id: 'b', x: 100, y: -60 }, { id: 'c', x: 0, y: 80 }] } }]);
  await select(page, 'p');
  // A click shows the frame, not the points.
  await expect(page.getByTestId('freeform-vertex-marker')).toHaveCount(0);
  await expect(page.getByTestId('transform-gizmo')).toHaveCount(1);
  await openPathEditing(page, 'p');
  await expect(page.getByTestId('freeform-vertex-marker')).toHaveCount(3);
  // A double-click on empty stage closes them.
  const stage = (await page.locator('.stage-canvas-container').boundingBox())!;
  await page.mouse.dblclick(stage.x + 30, stage.y + stage.height - 30);
  await expect(page.getByTestId('freeform-vertex-marker')).toHaveCount(0);
});

test('a layer with a mask opens the mask with a double-click', async ({ page }) => {
  const square = { version: 1, coordinateSpace: 'normalized', closed: true, points: [{ id: 'a', x: 0.2, y: 0.2 }, { id: 'b', x: 0.8, y: 0.2 }, { id: 'c', x: 0.8, y: 0.8 }, { id: 'd', x: 0.2, y: 0.8 }] };
  await seed(page, [{ id: 'r', name: 'Box', type: 'custom_rect', x: 0, y: 0, zIndex: 1, width: 240, height: 160, masks: [{ id: 'm1', name: 'Mask 1', mode: 'add', enabled: true, path: square }] }]);
  await select(page, 'r');
  const centre = await centreOf(page, 'r');
  await page.mouse.dblclick(centre.x, centre.y);
  await expect(page.locator('.stage-canvas-container')).toHaveAttribute('data-edit-mode', 'mask');
  await expect(page.getByTestId('mask-path-overlay')).toHaveCount(1);
  // No centre handle in the middle of the mask.
  await expect(page.getByTestId('mask-path-move-handle')).toHaveCount(0);
  const stage = (await page.locator('.stage-canvas-container').boundingBox())!;
  await page.mouse.dblclick(stage.x + 30, stage.y + stage.height - 30);
  await expect(page.getByTestId('mask-path-overlay')).toHaveCount(0);
});

test('a Boolean result is a shape of its own: Shape to Path, and a Boolean with another shape', async ({ page }) => {
  await seed(page, [
    { id: 'a', name: 'A', type: 'custom_rect', x: -40, y: 0, zIndex: 1 },
    { id: 'b', name: 'B', type: 'custom_rect', x: 40, y: 0, zIndex: 2 },
    { id: 'c', name: 'C', type: 'custom_circle', x: 0, y: 20, zIndex: 3 },
  ]);
  await select(page, 'a');
  await page.locator('[role="tree"] [data-layer-id="b"]').click({ modifiers: ['Control'] });
  await page.getByRole('button', { name: 'Boolean Union' }).click();
  // Its operands are not listed.
  await expect(page.locator('.nested-node.actor-node')).toHaveCount(0);
  // Union + C: the first result joins a new Boolean as one shape.
  await page.locator('[role="tree"] [data-layer-id="c"]').click({ modifiers: ['Control'] });
  await page.getByRole('button', { name: 'Boolean Subtract' }).click();
  let layers = await savedLayers(page);
  const outer = layers.find((layer) => layer.booleanOperation === 'subtract')!;
  expect(outer.booleanOperandIds).toHaveLength(2);
  // The inner result became a plain shape: no operands of its own; A and B are gone.
  expect(layers.some((layer) => layer.id === 'a' || layer.id === 'b')).toBe(false);
  // Shape to Path on the outer result: one shape, no operands.
  await runObjectCommand(page, 'Shape to Path');
  layers = await savedLayers(page);
  expect(layers).toHaveLength(1);
  expect(layers[0].booleanOperandIds ?? []).toEqual([]);
  expect(layers[0].type).toBe('custom_freeform');
  // Ctrl+Z brings the Boolean back.
  await page.keyboard.press('Control+z');
  layers = await savedLayers(page);
  expect(layers.some((layer) => layer.booleanOperation === 'subtract')).toBe(true);
});

test('the Circle tool draws equal sides; the Ellipse tool does not', async ({ page }) => {
  await seed(page, []);
  const stage = (await page.locator('.stage-canvas-container').boundingBox())!;
  const draw = async (dx: number, dy: number) => {
    await page.mouse.move(stage.x + 200, stage.y + 150);
    await page.mouse.down();
    await page.mouse.move(stage.x + 200 + dx, stage.y + 150 + dy, { steps: 5 });
    await page.mouse.up();
  };
  await armTool(page, 'Circle');
  await draw(160, 60);
  await armTool(page, 'Ellipse');
  await page.mouse.move(stage.x + 500, stage.y + 150);
  await page.mouse.down();
  await page.mouse.move(stage.x + 660, stage.y + 210, { steps: 5 });
  await page.mouse.up();
  const layers = await savedLayers(page);
  const circle = layers.find((layer) => layer.name === 'Circle')!;
  const ellipse = layers.find((layer) => layer.name === 'Ellipse')!;
  expect(circle.scaleX).toBeCloseTo(circle.scaleY, 5);
  expect(Math.abs(ellipse.scaleX - ellipse.scaleY)).toBeGreaterThan(0.5);
});

test('Paste in Place puts the copy exactly over the original', async ({ page }) => {
  await seed(page, [{ id: 'a', name: 'Alpha', type: 'custom_rect', x: -120, y: 60, zIndex: 1 }]);
  await select(page, 'a');
  await page.keyboard.press('Control+c');
  await page.getByRole('menubar', { name: 'Editor menu' }).getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Paste in Place' }).click();
  const layers = await savedLayers(page);
  const copy = layers.find((layer) => layer.name === 'Alpha Copy')!;
  expect([copy.x, copy.y]).toEqual([-120, 60]);
});
