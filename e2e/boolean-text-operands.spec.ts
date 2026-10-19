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

/**
 * Boolean creation is an authoring command, so the top authoring toolbar owns
 * it: each operation button names itself `Boolean <Operation>` and the icon is
 * the same shared `BooleanOperationIcon`.
 */
type BooleanOperation = 'union' | 'subtract' | 'intersect' | 'exclude';

async function clickBoolean(page: Page, operation: BooleanOperation): Promise<void> {
  const label = `${operation[0].toUpperCase()}${operation.slice(1)}`;
  await page.getByRole('button', { name: `Boolean ${label}` }).click();
}

/** Selects two layers in the outliner and runs one Boolean operation. */
async function combine(page: Page, first: string, second: string, operation: BooleanOperation): Promise<void> {
  await page.locator('.actor-node', { hasText: first }).first().click();
  await page.locator('.actor-node', { hasText: second }).first().click({ modifiers: ['Control'] });
  await clickBoolean(page, operation);
  await waitBooleanCommitted(page, operation);
}

/**
 * Applying a Boolean awaits the text trace asynchronously (font raster +
 * contour extraction), so the button click alone is not a commit point.
 * The outliner's group node is: wait for it before touching autosave, or
 * the `Just saved` badge check passes against the PREVIOUS autosave and the
 * test reads a pre-group document (deterministic first-attempt failure on a
 * cold font cache; retry passes because the font is warm).
 */
const waitBooleanCommitted = async (page: Page, operation: BooleanOperation): Promise<void> => {
  const label = `${operation[0].toUpperCase()}${operation.slice(1)}`;
  // The outliner row carries the derived group name ('… · Subtract') plus a
  // badge with the same word, so match the row element, not the a11y name.
  await expect(page.locator('.actor-node', { hasText: `· ${label}` }).first())
    .toBeVisible({ timeout: 15000 });
};

/** The refusal counterpart: the command reports "no geometry" before storage is read. */
const waitBooleanRefused = async (page: Page): Promise<void> => {
  await expect(page.getByText(/Could not build the Boolean/).first())
    .toBeVisible({ timeout: 15000 });
};

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

/**
 * The badge click can be coalesced away while an (auto)save is already in
 * flight (`useSerialization` SAFE-02 pending guard), so the document right
 * after `saveNow` is not guaranteed to carry the new group. The durable
 * contract is that the next autosave tick persists it: assert content, not
 * the badge label, then read the settled document once.
 */
async function savedGroup(page: Page): Promise<NonNullable<Awaited<ReturnType<typeof storedGroup>>>> {
  await expect.poll(() => storedGroup(page), { timeout: 15000 }).not.toBeNull();
  return (await storedGroup(page))!;
}

test('a text layer and a shape combine with the letters traced, counters included', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  // The box has to cover the letter's counter, which sits above the baseline.
  await seed(page, [
    textLayer('text', 'O', 0, 0, 220),
    boxLayer('box', 'Box', 0, -78, 8),
  ]);

  await combine(page, 'Box', 'O text', 'intersect');
  await saveNow(page);

  const group = await savedGroup(page);
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

  await combine(page, 'Box', 'O text', 'subtract');
  await saveNow(page);

  const group = await savedGroup(page);
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

/**
 * A-01: the trace must accept every family form the editor offers — a bare
 * name, a quoted name, and a quoted name inside a CSS fallback list — because
 * the canvas re-serialises the family it accepted.
 */
const familyTextLayer = (id: string, value: string, x: number, y: number, fontSize: number, fontFamily: string) => ({
  ...textLayer(id, value, x, y, fontSize),
  fontFamily,
});

for (const [label, fontFamily] of [
  ['Outfit', 'Outfit'],
  ['quoted Playfair Display', "'Playfair Display'"],
  ['fallback-list Playfair Display', "'Playfair Display', serif"],
  ['quoted JetBrains Mono', "'JetBrains Mono'"],
] as const) {
  test(`a ${label} text traces into a Boolean group`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

    await seed(page, [
      familyTextLayer('text', 'O', 0, 0, 220, fontFamily),
      boxLayer('box', 'Box', 0, -78, 8),
    ]);

    await combine(page, 'Box', 'O text', 'intersect');
    await saveNow(page);

    const group = await savedGroup(page);
    expect(group?.type).toBe('custom_freeform');
    expect(group?.booleanOperation).toBe('intersect');
    // 'O' has a counter, so a successful trace carries at least two rings.
    expect((group?.booleanContours ?? []).length).toBeGreaterThanOrEqual(2);
    expect(consoleErrors).toEqual([]);
  });
}

/**
 * A-03: a failed operand refuses the operation instead of being dropped. A
 * text too large to rasterise cannot be traced, so a three-operand Subtract
 * must NOT silently become the two-box Subtract.
 */
test('an untraceable text operand refuses the Boolean instead of changing it', async ({ page }) => {
  await seed(page, [
    // 60000px of text cannot fit the 4096px raster, so the trace refuses it.
    textLayer('text', 'O', 0, 0, 60000),
    boxLayer('box1', 'Box One', -60, 0, 6),
    boxLayer('box2', 'Box Two', 60, 0, 6),
  ]);

  await page.locator('.actor-node', { hasText: 'Box One' }).first().click();
  await page.locator('.actor-node', { hasText: 'Box Two' }).first().click({ modifiers: ['Control'] });
  await page.locator('.actor-node', { hasText: 'O text' }).first().click({ modifiers: ['Control'] });
  await clickBoolean(page, 'subtract');
  // The refusal must be observed, not assumed: without this the created==0
  // read can pass simply because the async trace has not been refused yet.
  await waitBooleanRefused(page);
  await saveNow(page);

  const created = await page.evaluate((key) => {
    const scene = JSON.parse(localStorage.getItem(key) ?? '{}') as {
      layers?: { booleanOperation?: string; booleanOperandIds?: string[] }[];
    };
    return (scene.layers ?? []).filter((layer) => layer.booleanOperation || layer.booleanOperandIds?.length).length;
  }, STORAGE_KEY);
  expect(created).toBe(0);
});

/**
 * The operand matrix beyond text+shape: text+freeform, text+text, three
 * operands, and the Exclude operation.
 */
test('text combines with a freeform and with another text', async ({ page }) => {
  const freeform = {
    id: 'shape', name: 'Free Shape', type: 'custom_freeform', x: 0, y: 0, rotation: 0,
    scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
    fillColor: '#ff2080', strokeColor: '#101218',
    points: [{ x: -120, y: -120 }, { x: 120, y: -120 }, { x: 120, y: 120 }, { x: -120, y: 120 }],
  };
  await seed(page, [
    familyTextLayer('text', 'A', 0, 0, 220, "'Playfair Display', serif"),
    freeform,
  ]);

  await combine(page, 'Free Shape', 'A text', 'union');
  await saveNow(page);
  const group = await savedGroup(page);
  expect(group?.booleanOperation).toBe('union');
  expect((group?.booleanContours ?? []).length).toBeGreaterThan(0);

  await seed(page, [
    familyTextLayer('text', 'A', -60, 0, 220, 'Outfit'),
    familyTextLayer('text2', 'B', 60, 0, 220, "'JetBrains Mono'"),
  ]);
  await combine(page, 'A text', 'B text2', 'exclude');
  await saveNow(page);
  const textGroup = await savedGroup(page);
  expect(textGroup?.booleanOperation).toBe('exclude');
  expect((textGroup?.booleanContours ?? []).length).toBeGreaterThan(0);
});

test('a three-operand Subtract keeps every operand', async ({ page }) => {
  await seed(page, [
    familyTextLayer('text', 'O', 0, 0, 220, "'Playfair Display', serif"),
    boxLayer('box1', 'Box One', 0, -78, 8),
    boxLayer('box2', 'Box Two', 0, -40, 4),
  ]);

  await page.locator('.actor-node', { hasText: 'Box One' }).first().click();
  await page.locator('.actor-node', { hasText: 'O text' }).first().click({ modifiers: ['Control'] });
  await page.locator('.actor-node', { hasText: 'Box Two' }).first().click({ modifiers: ['Control'] });
  await clickBoolean(page, 'subtract');
  await waitBooleanCommitted(page, 'subtract');
  await saveNow(page);

  const storedOperandIds = () => page.evaluate((key) => {
    const scene = JSON.parse(localStorage.getItem(key) ?? '{}') as {
      layers?: { booleanOperandIds?: string[] }[];
    };
    return (scene.layers ?? []).find((layer) => layer.booleanOperandIds?.length)?.booleanOperandIds ?? [];
  }, STORAGE_KEY);
  await expect.poll(storedOperandIds, { timeout: 15000 }).toEqual(['box1', 'text', 'box2']);
});
