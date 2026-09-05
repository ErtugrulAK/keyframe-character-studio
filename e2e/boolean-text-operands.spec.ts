import { test, expect, type Page } from '@playwright/test';

/**
 * Boolean operands beyond closed vector shapes: a text layer contributes real
 * letterform geometry, traced from its own rendered mask (this is the only place
 * the rasteriser runs for real — jsdom has no canvas).
 *
 * The assertions are about what the feature promises: the group exists, its
 * geometry has more than one ring only when the letter has a counter, the
 * rendered path draws that counter as a separate subpath, and the trace is
 * stable across re-renders instead of re-deriving per frame.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const channel = () => ({ x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [], trimPathStart: [], trimPathEnd: [], trimPathOffset: [] });

const textLayer = (id: string, value: string, x: number, y: number, fontSize: number) => ({
  id, name: `${value} ${id}`, type: 'custom_text', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 2, fillColor: '#22d3ee', strokeColor: '#101218', width: 400, height: 260,
  textValue: value, fontSize, fontFamily: 'Outfit',
});

/** `custom_box` is a fixed 60x60 local rect, so the scale is what sizes it. */
const boxLayer = (id: string, name: string, x: number, y: number, scale: number) => ({
  id, name, type: 'custom_box', x, y, rotation: 0, scaleX: scale, scaleY: scale, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#ff2080', strokeColor: '#101218', width: 60, height: 60,
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
    tracks: layers.map((layer) => ({ partId: layer.id as string, channels: channel() })),
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

/** Selects two layers in the outliner and runs one Boolean operation. */
async function combine(page: Page, first: string, second: string, operation: 'Union' | 'Intersect' | 'Subtract'): Promise<void> {
  await page.locator('.actor-node', { hasText: first }).first().click();
  await page.locator('.actor-node', { hasText: second }).first().click({ modifiers: ['Control'] });
  await page.getByRole('button', { name: operation, exact: true }).click();
}

/** The autosave runs on a timer; the badge saves now, like the other specs. */
async function saveNow(page: Page): Promise<void> {
  const badge = page.locator('.autosave-status-badge');
  if (await badge.count()) await badge.click();
  await expect(badge).toContainText('Just saved', { timeout: 10000 });
}

const storedGroup = (page: Page) => page.evaluate((key) => {
  const scene = JSON.parse(localStorage.getItem(key) ?? '{}') as {
    layers?: { id: string; type: string; booleanOperation?: string; booleanContours?: { x: number; y: number }[][] }[];
  };
  return (scene.layers ?? []).find((layer) => layer.booleanOperation) ?? null;
}, STORAGE_KEY);

test('a text layer and a shape combine with the letters traced, counters included', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  // The box has to cover the letter's counter, which sits above the baseline.
  await seed(page, [
    textLayer('text', 'O', 0, 0, 220),
    boxLayer('box', 'Box', 0, -78, 8),
  ]);

  await combine(page, 'Box', 'O text', 'Intersect');
  await saveNow(page);

  const group = await storedGroup(page);
  expect(group?.type).toBe('custom_freeform');
  expect(group?.booleanOperation).toBe('intersect');

  // The box covers the whole letter, so the intersection is the letter itself and
  // its geometry carries the counter as a second ring: the trace produced a hole
  // (a text without one, e.g. 'L', would give a single ring here).
  const contours = group?.booleanContours ?? [];
  expect(contours.length).toBeGreaterThanOrEqual(2);
  const ringSizes = contours.map((contour) => contour.length);
  expect(Math.min(...ringSizes)).toBeGreaterThan(2);

  // The counter is drawn: one subpath per ring, closed, with even-odd filling.
  const pathMarkup = await page.evaluate(() => {
    const path = document.querySelector('.stage-svg path[fill-rule="evenodd"]');
    return path?.getAttribute('d') ?? '';
  });
  expect(pathMarkup.split('M').length - 1).toBeGreaterThanOrEqual(2);

  // Re-deriving (selecting another layer re-renders the stage) keeps the same
  // geometry: the trace is stable frame to frame.
  await page.locator('.actor-node', { hasText: 'Box' }).first().click();
  await saveNow(page);
  const again = await page.evaluate((key) => {
    const scene = JSON.parse(localStorage.getItem(key) ?? '{}') as { layers?: { booleanContours?: unknown }[] };
    return JSON.stringify((scene.layers ?? []).find((layer) => layer.booleanContours)?.booleanContours ?? null);
  }, STORAGE_KEY);
  expect(again).toBe(JSON.stringify(contours));

  expect(consoleErrors).toEqual([]);
});

test('a text layer and a shape can be subtracted, and the operands stay editable', async ({ page }) => {
  await seed(page, [
    textLayer('text', 'O', 0, 0, 220),
    boxLayer('box', 'Box', 0, -78, 3),
  ]);

  await combine(page, 'Box', 'O text', 'Subtract');
  await saveNow(page);

  const group = await storedGroup(page);
  expect(group?.booleanOperation).toBe('subtract');
  expect((group?.booleanContours ?? []).length).toBeGreaterThan(0);

  // Both operands remain authored parts, and the group lists them.
  const operands = await page.evaluate((key) => {
    const scene = JSON.parse(localStorage.getItem(key) ?? '{}') as {
      layers?: { id: string; booleanOperandIds?: string[] }[];
    };
    const group2 = (scene.layers ?? []).find((layer) => layer.booleanOperandIds?.length);
    return { ids: group2?.booleanOperandIds ?? [], layers: (scene.layers ?? []).map((layer) => layer.id) };
  }, STORAGE_KEY);
  expect(operands.ids).toEqual(['box', 'text']);
  expect(operands.layers).toContain('text');
  expect(operands.layers).toContain('box');
});
