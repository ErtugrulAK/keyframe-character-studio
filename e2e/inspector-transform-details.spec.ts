import { test, expect, type Page } from '@playwright/test';

/**
 * R5-14 / R5-15 — the Details panel's TRANSFORM section, in a real browser.
 *
 * R5-14: TRANSFORM is a Position row (X | Y) followed by ONE compact row of
 * Rotation | Scale | Opacity. The reset, the labelled aspect-lock button and the
 * opacity keyframe action are gone from Details — keyframing is the timeline
 * property row's authority — while the scale lock itself stays reachable as a
 * compact glyph because a free (non-uniform) canvas drag depends on it.
 *
 * R5-15: the layer's paint order is not repeated in Details: no raw "Index 1"
 * readout and no second Arrange strip. The authoring toolbar's Arrange group
 * owns that write, and the stage's paint order is where the result is checked.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

async function seed(page: Page, layers: Record<string, unknown>[]): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers,
    tracks: layers.map((layer) => ({ partId: layer.id, name: layer.name, channels: {} })),
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript((payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value), { key: STORAGE_KEY, value: scene });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const rect = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
  id, name, type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218',
  fillEnabled: true, strokeEnabled: false, width: 160, height: 120,
  ...overrides,
});

async function selectLayer(page: Page, name: string): Promise<void> {
  await page.locator('.actor-node', { hasText: name }).first().click();
}

async function openTransform(page: Page): Promise<void> {
  const disclosure = page.getByRole('button', { name: /(?:Expand|Collapse) TRANSFORM/ });
  await expect(disclosure).toBeVisible();
  if (await disclosure.getAttribute('aria-expanded') === 'false') await disclosure.click();
}

/** The three compact cells with their inputs, in document order. */
function compactTrio(page: Page) {
  return page.evaluate(() => {
    const grid = document.querySelector('.transform-compact-grid') as HTMLElement;
    const gridRect = grid.getBoundingClientRect();
    return {
      grid: { x: gridRect.x, right: gridRect.right, width: gridRect.width, scrollWidth: grid.scrollWidth, clientWidth: grid.clientWidth },
      cells: [...grid.querySelectorAll('.transform-compact-cell')].map((cell) => {
        const node = cell as HTMLElement;
        const input = cell.querySelector('input') as HTMLInputElement;
        const cellRect = node.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        return {
          title: cell.querySelector('.transform-property-title')?.textContent ?? null,
          label: input.getAttribute('aria-label'),
          cell: { x: cellRect.x, top: cellRect.top, right: cellRect.right, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth },
          input: { x: inputRect.x, top: inputRect.top, right: inputRect.right, width: inputRect.width },
        };
      }),
    };
  });
}

test('R5-14 — TRANSFORM is a Position row plus one compact Rotation/Scale/Opacity row', async ({ page }) => {
  await seed(page, [rect('alpha', 'Alpha', { rotation: 15, scaleX: 1, scaleY: 1, opacity: 0.5 })]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await selectLayer(page, 'Alpha');
  await openTransform(page);

  // Position keeps its own two-column row.
  const position = await page.evaluate(() => {
    const row = document.querySelector('.transform-position-row') as HTMLElement;
    const inputs = [...row.querySelectorAll('input')].map((input) => input.getBoundingClientRect());
    return inputs.map((r) => ({ x: r.x, top: r.top, right: r.right }));
  });
  expect(position).toHaveLength(2);
  expect(Math.abs(position[0].top - position[1].top)).toBeLessThanOrEqual(1);
  expect(position[1].x).toBeGreaterThan(position[0].right);

  // The trio: one row, three labelled cells, in order.
  const trio = await compactTrio(page);
  expect(trio.cells.map((cell) => cell.title)).toEqual(['Rotation', 'Scale', 'Opacity']);
  expect(trio.cells.map((cell) => cell.label)).toEqual(['Rotation', 'Scale', 'Opacity']);
  const tops = trio.cells.map((cell) => cell.input.top);
  for (const top of tops) expect(Math.abs(top - tops[0])).toBeLessThanOrEqual(1);
  expect(trio.cells[0].input.right).toBeLessThanOrEqual(trio.cells[1].input.x);
  expect(trio.cells[1].input.right).toBeLessThanOrEqual(trio.cells[2].input.x);

  // The removed controls are gone from Details; keyframing is not duplicated.
  const details = page.locator('.details-container');
  await expect(details.getByRole('button', { name: 'Reset 0°' })).toHaveCount(0);
  await expect(details.getByRole('button', { name: /^(Locked|Free)$/ })).toHaveCount(0);
  await expect(details.getByRole('button', { name: /Keyframe/ })).toHaveCount(0);

  // ...and the aspect lock itself is still reachable, as one compact glyph.
  // V3.6: FREE is the resting state — the corner drag scales both axes
  // independently until the user opts into the persistent uniform lock.
  const lock = page.getByRole('button', { name: 'Lock aspect ratio' });
  await expect(lock).toHaveAttribute('aria-pressed', 'false');
  await expect(lock).toHaveAttribute('title', /Aspect ratio free/);
  await lock.click();
  await expect(lock).toHaveAttribute('aria-pressed', 'true');
  await expect(lock).toHaveAttribute('title', /Aspect ratio locked/);
  await lock.click();
  await expect(lock).toHaveAttribute('aria-pressed', 'false');
});

test('R5-14 — the compact trio stays on one row at the narrowest inspector width', async ({ page }) => {
  await seed(page, [rect('alpha', 'Alpha')]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await selectLayer(page, 'Alpha');
  await openTransform(page);

  const atDefault = await compactTrio(page);
  expect(atDefault.cells).toHaveLength(3);

  // The dock width floor: `min(--right-inspector-width, max(250px, 34vw))` resolves to 250px.
  await page.setViewportSize({ width: 640, height: 900 });
  const inspectorWidth = () => page.evaluate(() => Math.round(document.querySelector('.motion-design-right-sidebar')!.getBoundingClientRect().width));
  // The dock eases its width (240ms), so read the settled value.
  await expect.poll(inspectorWidth).toBe(250);

  const narrow = await compactTrio(page);
  expect(narrow.cells.map((cell) => cell.title)).toEqual(['Rotation', 'Scale', 'Opacity']);
  const narrowTops = narrow.cells.map((cell) => cell.input.top);
  for (const top of narrowTops) expect(Math.abs(top - narrowTops[0])).toBeLessThanOrEqual(1);
  // No cell overflows its own column, and no input overflows its cell.
  for (const cell of narrow.cells) {
    expect(cell.cell.scrollWidth, `${cell.title} overflows its column`).toBeLessThanOrEqual(cell.cell.clientWidth + 1);
    expect(cell.input.right).toBeLessThanOrEqual(cell.cell.right + 1);
    expect(cell.input.width).toBeGreaterThan(20);
  }
  expect(narrow.grid.scrollWidth).toBeLessThanOrEqual(narrow.grid.clientWidth + 1);

  // Back at the default width the row is the same row, just roomier: the dock
  // eases its width (240ms), so read the settled geometry.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(async () => Math.round((await compactTrio(page)).grid.width))
    .toBeGreaterThan(narrow.grid.width + 20);
  const restored = await compactTrio(page);
  expect(restored.cells.map((cell) => cell.title)).toEqual(['Rotation', 'Scale', 'Opacity']);
  expect(restored.cells[0].input.width).toBeGreaterThan(narrow.cells[0].input.width);
});

test('R5-14 — Scale keeps its two channels independent while the field writes them together', async ({ page }) => {
  await seed(page, [rect('alpha', 'Alpha', { scaleX: 2, scaleY: 0.5 })]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await selectLayer(page, 'Alpha');
  await openTransform(page);

  const renderedScale = () => page.evaluate(() => {
    const node = document.querySelector('[data-part-id="alpha"] [transform]') as SVGElement | null;
    const match = node?.getAttribute('transform')?.match(/scale\(\s*(-?[\d.]+)[,\s]+(-?[\d.]+)\s*\)/u);
    return match ? [Number(match[1]), Number(match[2])] : null;
  });

  // The authored transform really is non-uniform: X and Y are separate channels.
  expect(await renderedScale()).toEqual([2, 0.5]);

  // The compact field is the uniform percentage control it has always been: it
  // writes both channels together.
  const scale = page.getByLabel('Scale');
  await expect(scale).toHaveValue('125'); // (|2| + |0.5|) / 2 → 125%
  await scale.fill('150');
  await scale.blur();
  await expect.poll(renderedScale).toEqual([1.5, 1.5]);
});

test('R5-15 — Details carries no layer index and no Arrange duplicate; the toolbar owns z-order', async ({ page }) => {
  await seed(page, [rect('alpha', 'Alpha', { zIndex: 2 }), rect('beta', 'Beta', { zIndex: 1, x: 90 })]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await selectLayer(page, 'Alpha');
  await openTransform(page);

  // No raw index readout, no second arrange strip inside the inspector.
  await expect(page.locator('.details-container')).not.toContainText(/Index \d+/u);
  await expect(page.locator('.transform-layer-value')).toHaveCount(0);
  await expect(page.locator('.details-container').getByRole('button', { name: /Bring forward|Send backward/u })).toHaveCount(0);

  // The authoring toolbar owns that write, as its own labelled group.
  const arrange = page.getByRole('group', { name: 'Arrange' });
  await expect(arrange).toBeVisible();
  // Alpha is the top layer, so only Send backward has somewhere to go.
  await expect(arrange.getByRole('button', { name: 'Bring forward', exact: true })).toBeDisabled();
  await expect(arrange.getByRole('button', { name: 'Send backward', exact: true })).toBeEnabled();

  // The stage renders ascending zIndex: Beta (1) paints under Alpha (2).
  const paintOrder = () => page.evaluate(() => [...document.querySelectorAll('.stage-canvas-container [data-part-id]')]
    .filter((node) => node.tagName === 'g')
    .map((node) => node.getAttribute('data-part-id')));
  expect(await paintOrder()).toEqual(['beta', 'alpha']);

  // Arranging through the toolbar really moves the layer in the painted stack.
  await arrange.getByRole('button', { name: 'Send backward', exact: true }).click();
  expect(await paintOrder()).toEqual(['alpha', 'beta']);
});
