import { test, expect, type Page } from '@playwright/test';

/**
 * GROUP SELECTION GEOMETRY & GESTURES — findings B, C, D and E of Manual QA
 * round 1, in a real browser.
 *
 * B: dragging inside the selected aggregate box moves the whole group as one
 *    unit (one history entry); a click that never moved still selects the layer
 *    under the pointer.
 * C: the geometryless container emits no stray selection body — no pivot/centre
 *    marker, no fallback bounds square, no faux geometry.
 * D: the aggregate frame follows the evaluated bounds exactly throughout a
 *    rotation (the drawn box never switches between local and world frames).
 * E: every edge handle anchors the OPPOSITE edge in world space (unrotated and
 *    rotated), instead of resizing around the centre.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const shape = (id: string, name: string, x: number, y: number) => ({
  id, name, type: 'custom_rect', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
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

async function groupPair(page: Page): Promise<void> {
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await page.locator('.actor-node', { hasText: 'Beta' }).first().click({ modifiers: ['Control'] });
  await page.getByRole('button', { name: 'Group layers', exact: true }).click();
  await expect(page.locator('.actor-node[data-group-container="true"]')).toHaveCount(1);
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(1);
}

/** Centre of a gizmo handle, found by its fill (the only colour it carries). */
const handleCentre = (page: Page, fill: string, index = 0) => page.evaluate(([colour, position]) => {
  const nodes = Array.from(document.querySelectorAll(`[data-testid="transform-gizmo"] circle[fill="${colour}"]`));
  const node = nodes[position as number];
  if (!node) throw new Error(`no handle ${colour}[${position}]`);
  const rect = node.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}, [fill, index] as const);

/** The group frame's local rect attributes and its client box. */
const frame = (page: Page) => page.evaluate(() => {
  const box = document.querySelector('[data-testid="group-aggregate-box"]');
  if (!box) throw new Error('no aggregate box');
  const rects = Array.from(box.querySelectorAll('rect'));
  // The accent dash is the frame geometry itself; the paired light/dark outline
  // shares its geometry but carries the wider light stroke.
  const drawn = rects.find((rect) => rect.getAttribute('stroke') === '#00d2ff');
  if (!drawn) throw new Error('no drawn frame');
  const client = drawn.getBoundingClientRect();
  const gizmo = box.querySelector('[data-testid="transform-gizmo"]');
  return {
    local: [drawn.getAttribute('x'), drawn.getAttribute('y'), drawn.getAttribute('width'), drawn.getAttribute('height')]
      .map((value) => Number(value)),
    client: { left: client.left, top: client.top, width: client.width, height: client.height },
    transform: gizmo?.getAttribute('transform') ?? '',
  };
});

const childTransforms = (page: Page) => page.evaluate(() => {
  const read = (id: string) => document.querySelector(`[data-part-id="${id}"] > g`)?.getAttribute('transform') ?? null;
  return { a: read('a'), b: read('b') };
});

/** Parses `translate(x, y) rotate(r) scale(sx, sy)`. */
const parseTransform = (value: string) => {
  const translate = /translate\(([-\d.e]+), ([-\d.e]+)\)/.exec(value);
  const rotate = /rotate\(([-\d.e]+)\)/.exec(value);
  const scale = /scale\(([-\d.e]+), ([-\d.e]+)\)/.exec(value);
  return {
    x: Number(translate?.[1] ?? 'NaN'),
    y: Number(translate?.[2] ?? 'NaN'),
    rotation: Number(rotate?.[1] ?? 'NaN'),
    scaleX: Number(scale?.[1] ?? 'NaN'),
  };
};

const dragHandle = async (page: Page, from: { x: number; y: number }, delta: { x: number; y: number }, steps = 8) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + delta.x, from.y + delta.y, { steps });
  await page.mouse.up();
};

test('B — a drag inside the selected group moves the whole group as one unit', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120, 0), shape('b', 'Beta', 120, 0)]);
  await groupPair(page);

  const before = await childTransforms(page);
  const beforeFrame = await frame(page);
  const point = await page.evaluate(() => {
    const rect = document.querySelector('[data-part-id="b"]')!.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });

  await dragHandle(page, point, { x: 80, y: 40 });

  const after = await childTransforms(page);
  const deltaA = parseTransform(after.a!);
  const deltaB = parseTransform(after.b!);
  const startA = parseTransform(before.a!);
  const startB = parseTransform(before.b!);

  // Both children moved by the same world delta, and the group stayed selected.
  expect(deltaA.x - startA.x).toBeCloseTo(deltaB.x - startB.x, 6);
  expect(deltaA.y - startA.y).toBeCloseTo(deltaB.y - startB.y, 6);
  expect(Math.hypot(deltaA.x - startA.x, deltaA.y - startA.y)).toBeGreaterThan(50);
  await expect(page.locator('.actor-node.primary-selected')).toHaveText(/Group/);

  // The frame followed the same delta (it is derived from the evaluated bounds).
  const afterFrame = await frame(page);
  expect(afterFrame.local).toEqual(beforeFrame.local);
  expect(afterFrame.client.left - beforeFrame.client.left).toBeCloseTo(80, 0);
  expect(afterFrame.client.top - beforeFrame.client.top).toBeCloseTo(40, 0);

  // ONE drag = ONE history entry: undo puts both layers back in one step.
  await page.locator('.actor-node[data-group-container="true"]').first().click();
  await page.keyboard.press('Control+z');
  const undone = await childTransforms(page);
  expect(parseTransform(undone.a!).x).toBeCloseTo(startA.x, 6);
  expect(parseTransform(undone.b!).x).toBeCloseTo(startB.x, 6);
  expect(parseTransform(undone.a!).y).toBeCloseTo(startA.y, 6);
  expect(parseTransform(undone.b!).y).toBeCloseTo(startB.y, 6);
});

/**
 * R4-09 — the empty canvas BETWEEN two grouped children. Clicking it clears the
 * selection (it is on no layer's geometry), so it is also the neutral way these
 * tests drop the group selection before a click.
 */
async function clickBetweenChildren(page: Page): Promise<void> {
  const point = await page.evaluate(() => {
    const first = document.querySelector('[data-part-id="a"]')!.getBoundingClientRect();
    const second = document.querySelector('[data-part-id="b"]')!.getBoundingClientRect();
    return { x: (first.right + second.left) / 2, y: first.top + first.height / 2 };
  });
  await page.mouse.click(point.x, point.y);
}

test('B — a click on a child of an UNSELECTED group selects the group', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120, 0), shape('b', 'Beta', 120, 0)]);
  await groupPair(page);

  await clickBetweenChildren(page);
  await expect(page.locator('.actor-node.primary-selected')).toHaveCount(0);

  const before = await childTransforms(page);
  await page.locator('[data-part-id="b"]').first().click();
  // R4-09: the click targets the GROUP the geometry belongs to, not the child.
  await expect(page.locator('.actor-node.primary-selected')).toHaveText(/Group/);
  // The framed selection is still the container, so the first click never drew a
  // child-level selection.
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(1);
  // The click was not a gesture: nothing moved.
  expect(await childTransforms(page)).toEqual(before);
});

test('B — a drag on a child of an UNSELECTED group moves the whole group and selects it', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120, 0), shape('b', 'Beta', 120, 0)]);
  await groupPair(page);

  await clickBetweenChildren(page);
  await expect(page.locator('.actor-node.primary-selected')).toHaveCount(0);

  const before = await childTransforms(page);
  const point = await page.evaluate(() => {
    const rect = document.querySelector('[data-part-id="b"]')!.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });

  await dragHandle(page, point, { x: 60, y: -30 });

  const after = await childTransforms(page);
  const deltaA = parseTransform(after.a!);
  const deltaB = parseTransform(after.b!);
  const startA = parseTransform(before.a!);
  const startB = parseTransform(before.b!);
  // Both children travelled the same world delta: the CONTAINER moved.
  expect(deltaA.x - startA.x).toBeCloseTo(deltaB.x - startB.x, 6);
  expect(deltaA.y - startA.y).toBeCloseTo(deltaB.y - startB.y, 6);
  expect(Math.hypot(deltaA.x - startA.x, deltaA.y - startA.y)).toBeGreaterThan(30);
  // ...and the gesture left the group selected.
  await expect(page.locator('.actor-node.primary-selected')).toHaveText(/Group/);
});

test('R4-09 — a plain click on a child never selects the child, but a double-click drills in', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120, 0), shape('b', 'Beta', 120, 0)]);
  await groupPair(page);

  const before = await childTransforms(page);
  const child = page.locator('[data-part-id="b"]').first();

  // Plain click: the group, whether or not it was already selected.
  await child.click();
  await expect(page.locator('.actor-node.primary-selected')).toHaveText(/Group/);
  await clickBetweenChildren(page);
  await child.click();
  await expect(page.locator('.actor-node.primary-selected')).toHaveText(/Group/);
  expect(await childTransforms(page)).toEqual(before);

  // The EXPLICIT drill-in path: a double-click enters the group and selects the
  // very layer the pointer is on, so it can be edited without ungrouping.
  await child.dblclick();
  await expect(page.locator('.actor-node.primary-selected')).toHaveText(/Beta/);

  // ...and the drilled-in child is then the drag target, not the container.
  const startChild = await childTransforms(page);
  const point = await page.evaluate(() => {
    const rect = document.querySelector('[data-part-id="b"]')!.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await dragHandle(page, point, { x: 50, y: 0 });
  const after = await childTransforms(page);
  const deltaA = parseTransform(after.a!);
  const deltaB = parseTransform(after.b!);
  const baseA = parseTransform(startChild.a!);
  const baseB = parseTransform(startChild.b!);
  expect(deltaB.x - baseB.x).toBeGreaterThan(30);
  // Only the drilled-in child moved: its sibling stayed exactly where it was.
  expect(deltaA.x - baseA.x).toBeCloseTo(0, 6);
  expect(deltaA.y - baseA.y).toBeCloseTo(0, 6);
  await expect(page.locator('.actor-node.primary-selected')).toHaveText(/Beta/);
});

test('R4-09 — clicking the empty gap between grouped children selects nothing', async ({ page }) => {
  // Two small children far apart: the point between them is inside the group's
  // aggregate box, but on no child's geometry.
  await seed(page, [shape('a', 'Alpha', -220, 0), shape('b', 'Beta', 220, 0)]);
  await groupPair(page);

  const gap = await page.evaluate(() => {
    const first = document.querySelector('[data-part-id="a"]')!.getBoundingClientRect();
    const second = document.querySelector('[data-part-id="b"]')!.getBoundingClientRect();
    return { x: (first.right + second.left) / 2, y: first.top + first.height / 2 };
  });
  const aggregate = await page.locator('[data-testid="group-aggregate-box"]').boundingBox();
  expect(aggregate).not.toBeNull();
  // The point really is inside the aggregate box — it is only outside the children.
  expect(gap.x).toBeGreaterThan(aggregate!.x);
  expect(gap.x).toBeLessThan(aggregate!.x + aggregate!.width);

  await page.mouse.click(gap.x, gap.y);
  // Nothing to hit: the selection is cleared instead of selecting the group.
  await expect(page.locator('.actor-node.primary-selected')).toHaveCount(0);
});


test('C — the geometryless group container emits no stray selection geometry', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120, 0), shape('b', 'Beta', 120, 0)]);
  await groupPair(page);

  const geometry = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="group-aggregate-box"]')!;
    const frameRect = box.querySelectorAll('rect')[1].getBoundingClientRect();
    const centre = { x: frameRect.left + frameRect.width / 2, y: frameRect.top + frameRect.height / 2 };
    const nodes = Array.from(box.querySelectorAll('*'));
    // Anything whose own centre sits on the box centre and is not a handle.
    const stray = nodes
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.width > 12 || rect.height > 12) return false;
        const own = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        return Math.hypot(own.x - centre.x, own.y - centre.y) < 4;
      })
      .map((node) => ({ tag: node.tagName, fill: node.getAttribute('fill'), testid: node.getAttribute('data-testid') }));
    return {
      centreMarkers: box.querySelectorAll('circle[fill="#00d2ff"]').length,
      stray,
      containerNode: document.querySelectorAll('[data-group-id] [data-part-id]').length,
      gizmoCount: document.querySelectorAll('[data-testid="transform-gizmo"]').length,
    };
  });

  // No pivot marker, no faux bounds square, no fallback geometry at the centre.
  expect(geometry.centreMarkers).toBe(0);
  expect(geometry.stray).toEqual([]);
  // The container draws no layer body of its own; only the one aggregate frame.
  expect(geometry.containerNode).toBe(0);
  expect(geometry.gizmoCount).toBe(1);
});

test('D — the aggregate frame stays exact through a rotation drag', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120, 0), shape('b', 'Beta', 120, 0)]);
  await groupPair(page);

  const start = await frame(page);
  const centre = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="group-aggregate-box"]')!;
    const rect = box.querySelectorAll('rect')[1].getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  const handle = await handleCentre(page, '#ffb700');
  const radius = Math.hypot(handle.x - centre.x, handle.y - centre.y);

  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  const samples: Array<{ local: number[]; width: number }> = [];
  const steps = 24;
  for (let step = 1; step <= steps; step += 1) {
    const angle = (step / steps) * Math.PI * 0.7;
    await page.mouse.move(
      centre.x + Math.cos(-Math.PI / 2 + angle) * radius,
      centre.y + Math.sin(-Math.PI / 2 + angle) * radius,
    );
    const shot = await frame(page);
    samples.push({ local: shot.local, width: shot.client.width });
  }
  await page.mouse.up();

  // The children never move inside the container, so the DRAWN box is the same
  // rect every frame; only the container's rotation changes.
  samples.forEach((sample, index) => {
    sample.local.forEach((value, axis) => {
      expect(
        Math.abs(value - start.local[axis]),
        `frame ${index} axis ${axis} switched boxes: ${JSON.stringify(sample.local)} vs ${JSON.stringify(start.local)}`,
      ).toBeLessThanOrEqual(1e-6);
    });
  });
  // And it really was a rotation: the frame's screen extent changed continuously.
  expect(new Set(samples.map((sample) => Math.round(sample.width))).size).toBeGreaterThan(3);
});

test('E — every edge handle anchors the opposite edge (unrotated)', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120, 0), shape('b', 'Beta', 120, 0)]);
  await groupPair(page);

  const cases = [
    { edge: 'left', fill: '#38bdf8', index: 0, oppositeFill: '#38bdf8', oppositeIndex: 1, delta: { x: 60, y: 0 } },
    { edge: 'right', fill: '#38bdf8', index: 1, oppositeFill: '#38bdf8', oppositeIndex: 0, delta: { x: -60, y: 0 } },
    { edge: 'top', fill: '#c084fc', index: 0, oppositeFill: '#c084fc', oppositeIndex: 1, delta: { x: 0, y: 40 } },
    { edge: 'bottom', fill: '#c084fc', index: 1, oppositeFill: '#c084fc', oppositeIndex: 0, delta: { x: 0, y: -40 } },
  ] as const;

  for (const item of cases) {
    const handle = await handleCentre(page, item.fill, item.index);
    const oppositeBefore = await handleCentre(page, item.oppositeFill, item.oppositeIndex);
    await dragHandle(page, handle, item.delta);

    const oppositeAfter = await handleCentre(page, item.oppositeFill, item.oppositeIndex);
    const draggedAfter = await handleCentre(page, item.fill, item.index);
    expect(
      Math.hypot(oppositeAfter.x - oppositeBefore.x, oppositeAfter.y - oppositeBefore.y),
      `${item.edge}: opposite edge moved`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.hypot(draggedAfter.x - (handle.x + item.delta.x), draggedAfter.y - (handle.y + item.delta.y)),
      `${item.edge}: dragged edge did not follow the pointer`,
    ).toBeLessThanOrEqual(2);
    // One undo step returns the box to where it was.
    await page.locator('.actor-node[data-group-container="true"]').first().click();
    await page.keyboard.press('Control+z');
    const restored = await handleCentre(page, item.fill, item.index);
    expect(Math.hypot(restored.x - handle.x, restored.y - handle.y), `${item.edge}: undo did not restore`).toBeLessThanOrEqual(1);
    await page.keyboard.press('Control+Shift+z');
    await page.mouse.click(4, 4);
    const redone = await handleCentre(page, item.fill, item.index);
    expect(Math.hypot(redone.x - draggedAfter.x, redone.y - draggedAfter.y), `${item.edge}: redo did not restore`).toBeLessThanOrEqual(1);
    await page.keyboard.press('Control+z');
  }
});

test('E — a rotated group still anchors the opposite edge', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120, 0), shape('b', 'Beta', 120, 0)]);
  await groupPair(page);

  // Rotate the container through the Inspector (the transform authority); the
  // TRANSFORM card starts collapsed, so its fields need disclosing first.
  await page.getByRole('button', { name: 'Expand TRANSFORM' }).first().click();
  const rotation = page.getByLabel('Rotation', { exact: true }).first();
  await rotation.fill('30');
  await rotation.blur();
  await expect(page.getByTestId('transform-gizmo')).toHaveAttribute('transform', /rotate\(30\)/);

  const cases = [
    { edge: 'left', fill: '#38bdf8', index: 0, delta: { x: 50, y: 29 } },
    { edge: 'right', fill: '#38bdf8', index: 1, delta: { x: -50, y: -29 } },
    { edge: 'top', fill: '#c084fc', index: 0, delta: { x: -35, y: 20 } },
    { edge: 'bottom', fill: '#c084fc', index: 1, delta: { x: 35, y: -20 } },
  ] as const;

  for (const item of cases) {
    const handle = await handleCentre(page, item.fill, item.index);
    const before = await Promise.all([
      handleCentre(page, '#38bdf8', 0),
      handleCentre(page, '#38bdf8', 1),
      handleCentre(page, '#c084fc', 0),
      handleCentre(page, '#c084fc', 1),
    ]);
    const oppositeIndex = item.index === 0 ? 1 : 0;
    const oppositeKey = item.fill === '#38bdf8' ? (oppositeIndex === 0 ? 0 : 1) : (oppositeIndex === 0 ? 2 : 3);
    await dragHandle(page, handle, item.delta);
    const after = await Promise.all([
      handleCentre(page, '#38bdf8', 0),
      handleCentre(page, '#38bdf8', 1),
      handleCentre(page, '#c084fc', 0),
      handleCentre(page, '#c084fc', 1),
    ]);
    expect(
      Math.hypot(after[oppositeKey].x - before[oppositeKey].x, after[oppositeKey].y - before[oppositeKey].y),
      `${item.edge}: opposite edge moved on a rotated group`,
    ).toBeLessThanOrEqual(1.5);
    const draggedKey = item.fill === '#38bdf8' ? (item.index === 0 ? 0 : 1) : (item.index === 0 ? 2 : 3);
    expect(
      Math.hypot(after[draggedKey].x - handle.x, after[draggedKey].y - handle.y),
      `${item.edge}: dragged edge did not travel`,
    ).toBeGreaterThan(8);
    await page.locator('.actor-node[data-group-container="true"]').first().click();
    await page.keyboard.press('Control+z');
    await page.mouse.click(4, 4);
  }
});

/** An image layer, so the pivot cases cover mixed media and shape children. */
const image = (id: string, name: string, x: number, y: number) => ({
  id, name, type: 'custom_image', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, imageUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  width: 180, height: 140, fillColor: '#22d3ee', strokeColor: '#101218',
});

/** The client centre of the drawn aggregate frame — the point the user sees turn. */
const frameCentre = (page: Page) => page.evaluate(() => {
  const box = document.querySelector('[data-testid="group-aggregate-box"]');
  if (!box) throw new Error('no aggregate box');
  const drawn = Array.from(box.querySelectorAll('rect')).find((rect) => rect.getAttribute('stroke') === '#00d2ff');
  if (!drawn) throw new Error('no drawn frame');
  const rect = drawn.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
});

/** The rotation the gizmo currently renders. */
const renderedRotation = async (page: Page): Promise<number> => {
  const value = await page.getByTestId('transform-gizmo').getAttribute('transform');
  return Number(/rotate\(([-\d.]+)\)/.exec(value ?? '')?.[1] ?? 'NaN');
};

/** Waits for one painted frame, so the sample reads committed state. */
const nextFrame = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => {
  requestAnimationFrame(() => resolve());
}));

/**
 * True distance between the two children's rendered centres: a rotation is a
 * rigid motion, so it can never change.
 */
const childSeparation = (page: Page) => page.evaluate(() => {
  const read = (id: string) => {
    const node = document.querySelector(`[data-part-id="${id}"]`);
    if (!node) throw new Error(`no layer ${id}`);
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  const a = read('a');
  const b = read('b');
  return Math.hypot(a.x - b.x, a.y - b.y);
});

/**
 * Drags the rotation handle around the frame centre, sampling the drawn frame's
 * centre on every step. Returns the worst distance the pivot travelled.
 */
async function dragRotation(page: Page, sweepRadians: number, steps = 14): Promise<{ worstPivotDrift: number; rotation: number }> {
  const centre = await frameCentre(page);
  const handle = await handleCentre(page, '#ffb700');
  const radius = Math.hypot(handle.x - centre.x, handle.y - centre.y);
  const startAngle = Math.atan2(handle.y - centre.y, handle.x - centre.x);

  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  let worst = 0;
  for (let step = 1; step <= steps; step += 1) {
    const angle = startAngle + (sweepRadians * step) / steps;
    await page.mouse.move(centre.x + Math.cos(angle) * radius, centre.y + Math.sin(angle) * radius);
    await nextFrame(page);
    const sample = await frameCentre(page);
    worst = Math.max(worst, Math.hypot(sample.x - centre.x, sample.y - centre.y));
  }
  await page.mouse.up();
  return { worstPivotDrift: worst, rotation: await renderedRotation(page) };
}

test('F — the rotation gesture turns the group about one fixed world pivot', async ({ page }) => {
  // An asymmetric group: an image and a shape, neither centred on the container.
  await seed(page, [image('a', 'Alpha', -150, -60), shape('b', 'Beta', 130, 90)]);
  await groupPair(page);

  // Move ONE child after grouping, so the group's visible centre no longer sits
  // where its transform origin is: this is the case a pivot re-derived from the
  // rotating box gets wrong.
  await page.locator('.actor-node', { hasText: 'Beta' }).first().click();
  await page.getByRole('button', { name: 'Expand TRANSFORM' }).first().click();
  const childX = page.getByLabel('Position X').first();
  await childX.fill('210');
  await childX.blur();
  await page.locator('.actor-node[data-group-container="true"]').first().click();
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(1);

  const rotationBefore = await renderedRotation(page);
  const separationBefore = await childSeparation(page);

  const { worstPivotDrift, rotation } = await dragRotation(page, Math.PI * 0.8);

  // The visible centre never leaves the point the drag started from — on ANY
  // sampled frame, not just at the end.
  expect(worstPivotDrift, 'the rotation pivot wandered during the gesture').toBeLessThanOrEqual(1);
  // It really was a rotation...
  expect(Math.abs(rotation - rotationBefore), 'the group did not rotate').toBeGreaterThan(20);
  // ...and a rigid one: the layers keep their mutual distance.
  expect(Math.abs(await childSeparation(page) - separationBefore), 'relative geometry changed').toBeLessThanOrEqual(1);

  // ONE history entry: a single undo puts both the rotation and the position back.
  await page.locator('.actor-node[data-group-container="true"]').first().click();
  await page.keyboard.press('Control+z');
  await nextFrame(page);
  expect(await renderedRotation(page), 'undo did not restore the rotation').toBeCloseTo(rotationBefore, 3);
  await page.keyboard.press('Control+Shift+z');
  await nextFrame(page);
  expect(await renderedRotation(page), 'redo did not restore the rotation').toBeCloseTo(rotation, 3);
});

test('G — a translated, already-rotated and nested group keeps the same pivot', async ({ page }) => {
  await seed(page, [image('a', 'Alpha', -150, -60), shape('b', 'Beta', 130, 90), shape('c', 'Gamma', 260)]);
  await groupPair(page);

  // Translated group: the container origin is moved off the aggregate centre.
  await page.getByRole('button', { name: 'Expand TRANSFORM' }).first().click();
  const positionX = page.getByLabel('Position X').first();
  await positionX.fill('90');
  await positionX.blur();
  // Already-rotated group: the pivot has to survive a non-zero start rotation.
  const rotationField = page.getByLabel('Rotation', { exact: true }).first();
  await rotationField.fill('30');
  await rotationField.blur();
  await expect(page.getByTestId('transform-gizmo')).toHaveAttribute('transform', /rotate\(30\)/);

  const first = await dragRotation(page, -Math.PI * 0.55);
  expect(first.worstPivotDrift, 'the pivot wandered on a translated, rotated group').toBeLessThanOrEqual(1);

  // Repeated rotation: the second gesture starts from the first one's result.
  const second = await dragRotation(page, Math.PI * 0.35);
  expect(second.worstPivotDrift, 'the pivot wandered on a repeated rotation').toBeLessThanOrEqual(1);
  expect(Math.abs(second.rotation - first.rotation), 'the second gesture did not rotate further').toBeGreaterThan(5);

  // Nested group: group the container together with a third layer and turn the
  // OUTER box. Its pivot is still its own aggregate centre.
  await page.locator('.actor-node', { hasText: 'Gamma' }).first().click();
  await page.locator('.actor-node[data-group-container="true"]').first().click({ modifiers: ['Control'] });
  await page.getByRole('button', { name: 'Group layers', exact: true }).click();
  await expect(page.locator('.actor-node[data-group-container="true"]')).toHaveCount(2);
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(1);

  const nested = await dragRotation(page, Math.PI * 0.4);
  expect(nested.worstPivotDrift, 'the pivot wandered on a nested group').toBeLessThanOrEqual(1);
  expect(Math.abs(nested.rotation - second.rotation), 'the nested group did not rotate').toBeGreaterThan(5);
});

/** The drawn frame rect of every rendered gizmo, in the layer's local units. */
const drawnFrames = (page: Page) => page.evaluate(() => Array.from(
  document.querySelectorAll('[data-testid="transform-gizmo"]'),
).map((gizmo) => {
  const drawn = Array.from(gizmo.querySelectorAll('rect')).find((rect) => rect.getAttribute('stroke') === '#00d2ff');
  if (!drawn) throw new Error('gizmo without a drawn frame');
  return {
    width: Number(drawn.getAttribute('width')),
    height: Number(drawn.getAttribute('height')),
    x: Number(drawn.getAttribute('x')),
    y: Number(drawn.getAttribute('y')),
  };
}));

const selectRow = (page: Page, name: string, additive = false) => page
  .locator('.actor-node', { hasText: name })
  .first()
  .click(additive ? { modifiers: ['Control'] } : {});

test('H — no grouped selection ever draws the container placeholder square', async ({ page }) => {
  // Image background plus multiple image/shape children, the reported setup.
  await seed(page, [
    image('a', 'Alpha', -150, -60),
    shape('b', 'Beta', 130, 90),
    image('c', 'Gamma', -40),
  ]);
  await groupPair(page);

  // Group selected: one children-derived aggregate frame, never a 64px square.
  const groupFrames = await drawnFrames(page);
  expect(groupFrames).toHaveLength(1);
  expect(groupFrames[0].width, 'the container drew its placeholder square').toBeGreaterThan(64);
  expect(groupFrames[0].height).toBeGreaterThan(64);

  // A descendant selected: the child's TRUE bounds only.
  await selectRow(page, 'Alpha');
  const childFrames = await drawnFrames(page);
  expect(childFrames).toHaveLength(1);
  expect(childFrames[0].width).toBe(180);

  // Group + one descendant: the container contributes its aggregate box, the
  // child its own bounds — and nothing is a placeholder.
  await page.locator('.actor-node[data-group-container="true"]').first().click();
  await selectRow(page, 'Alpha', true);
  const partialFrames = await drawnFrames(page);
  expect(partialFrames).toHaveLength(2);
  expect(partialFrames.some((frame) => frame.width > 300), 'the container box is not the children aggregate').toBe(true);
  expect(partialFrames.every((frame) => frame.width !== 64 && frame.height !== 64)).toBe(true);

  // Group + EVERY descendant: the children draw that exact envelope already, so
  // no duplicate container rectangle is added on top of them.
  await selectRow(page, 'Beta', true);
  const coveredFrames = await drawnFrames(page);
  expect(coveredFrames).toHaveLength(2);
  expect(coveredFrames.every((frame) => frame.width !== 64 && frame.height !== 64)).toBe(true);
  expect(coveredFrames.every((frame) => frame.width < 300), 'a duplicate container envelope was drawn').toBe(true);
  // And no pivot marker anywhere in the multi-selection.
  expect(await page.locator('[data-testid="transform-gizmo"] circle[fill="#00d2ff"]').count()).toBe(0);

  // Selecting a nested container's own row still frames it by its children.
  await page.locator('.actor-node[data-group-container="true"]').first().click();
  const regrouped = await drawnFrames(page);
  expect(regrouped).toHaveLength(1);
  expect(regrouped[0].width).toBeGreaterThan(300);
});

/**
 * A selection box drawn over the client rects of `partIds` (plus a margin), as
 * the user would drag it on the empty canvas. The margin keeps the press off the
 * layers themselves — the box starts on the background, which is what arms the
 * marquee at all.
 */
const marqueeAroundChildren = async (page: Page, partIds: string[], margin = 30): Promise<void> => {
  const union = await page.evaluate((ids) => {
    const rects = ids.map((id) => document.querySelector(`[data-part-id="${id}"]`)!.getBoundingClientRect());
    return {
      left: Math.min(...rects.map((rect) => rect.left)),
      top: Math.min(...rects.map((rect) => rect.top)),
      right: Math.max(...rects.map((rect) => rect.right)),
      bottom: Math.max(...rects.map((rect) => rect.bottom)),
    };
  }, partIds);
  const canvas = (await page.locator('.stage-canvas-container').boundingBox())!;
  await page.mouse.move(Math.max(canvas.x + 2, union.left - margin), Math.max(canvas.y + 2, union.top - margin));
  await page.mouse.down();
  await page.mouse.move(union.right + margin, union.bottom + margin, { steps: 10 });
  await page.mouse.up();
};

/**
 * R5-08 — the canvas marquee and the canvas click must draw the SAME selection:
 * a box over grouped children normalizes to the group container (the state AND
 * the overlays agree), a gap between the children selects nothing at all, and
 * the two explicit drill-in paths keep selecting the layer itself.
 */
test('R5-08 — a marquee over grouped children normalizes to the group container', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120, 0), shape('b', 'Beta', 120, 0)]);
  await groupPair(page);

  // Baseline 1: a plain click on a child selects the container (R4-09).
  await page.locator('[data-part-id="b"]').first().click();
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(1);
  const byClick = await drawnFrames(page);
  expect(byClick).toHaveLength(1);

  // Baseline 2: the child's OWN frame, through the explicit Outliner path —
  // which stays allowed and is what "no child border" is measured against.
  await selectRow(page, 'Alpha');
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(0);
  const byOutliner = await drawnFrames(page);
  expect(byOutliner).toHaveLength(1);
  expect(byClick[0].width).toBeGreaterThan(byOutliner[0].width);

  // Drop the selection, then enclose BOTH children with a selection box.
  await clickBetweenChildren(page);
  await expect(page.locator('.actor-node.primary-selected')).toHaveCount(0);
  await marqueeAroundChildren(page, ['a', 'b']);

  // The STATE is the container and nothing else...
  await expect(page.locator('.actor-node.primary-selected')).toHaveText(/Group/);
  await expect(page.locator('.actor-node.selected')).toHaveCount(1);
  // ...and the OVERLAYS agree exactly: the click-selected container frame, with
  // no child-level frame anywhere.
  expect(await drawnFrames(page)).toEqual(byClick);
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(1);
});

test('R5-08 — a marquee over the empty gap between grouped children selects nothing', async ({ page }) => {
  // Small children far apart: the gap between them is inside the container's
  // aggregate box (and holds the container's own origin), but on no geometry.
  await seed(page, [shape('a', 'Alpha', -220, 0), shape('b', 'Beta', 220, 0)]);
  await groupPair(page);
  // Precondition: the container IS selected, so the box has something to lose.
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(1);

  const gap = await page.evaluate(() => {
    const first = document.querySelector('[data-part-id="a"]')!.getBoundingClientRect();
    const second = document.querySelector('[data-part-id="b"]')!.getBoundingClientRect();
    return {
      left: first.right,
      right: second.left,
      top: Math.min(first.top, second.top),
      bottom: Math.max(first.bottom, second.bottom),
    };
  });
  expect(gap.right - gap.left, 'the seeded gap is not a real gap').toBeGreaterThan(60);

  const inset = 8;
  await page.mouse.move(gap.left + inset, gap.top + inset);
  await page.mouse.down();
  await page.mouse.move(gap.right - inset, gap.bottom - inset, { steps: 8 });
  await page.mouse.up();

  // The box enclosed no layer — and it did NOT reach the container through its
  // geometryless placeholder square.
  await expect(page.locator('.actor-node.primary-selected')).toHaveCount(0);
  await expect(page.locator('.actor-node.selected')).toHaveCount(0);
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(0);
});

test('R5-08 — a marquee normalizes a nested child to the OUTERMOST container', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120, 0), shape('b', 'Beta', 120, 0), shape('c', 'Gamma', 260, 0)]);
  await groupPair(page); // inner > { Alpha, Beta }
  // outer > { inner, Gamma }
  await page.locator('.actor-node', { hasText: 'Gamma' }).first().click();
  await page.locator('.actor-node[data-group-container="true"]').first().click({ modifiers: ['Control'] });
  await page.getByRole('button', { name: 'Group layers', exact: true }).click();
  await expect(page.locator('.actor-node[data-group-container="true"]')).toHaveCount(2);

  // Baseline: the INNER container's own frame.
  await page.locator('.actor-node[data-group-container="true"].nested-node').first().click();
  const innerFrame = await drawnFrames(page);
  expect(innerFrame).toHaveLength(1);

  // Drop the selection, then enclose only the DEEP child.
  await clickBetweenChildren(page);
  await expect(page.locator('.actor-node.primary-selected')).toHaveCount(0);
  await marqueeAroundChildren(page, ['a'], 12);

  // The outermost container is the target...
  await expect(page.locator('.actor-node[data-group-container="true"]:not(.nested-node)').first())
    .toHaveClass(/primary-selected/);
  // ...and its frame is strictly wider than the inner container's, because it
  // framed Gamma as well: it really is the OUTER box.
  const outerFrame = await drawnFrames(page);
  expect(outerFrame).toHaveLength(1);
  expect(outerFrame[0].width).toBeGreaterThan(innerFrame[0].width + 50);
});

test('R5-08 — a drilled-in child keeps child-level selection for a marquee', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120, 0), shape('b', 'Beta', 120, 0)]);
  await groupPair(page);

  // The explicit drill-in path: a canvas double-click enters the group.
  await page.locator('[data-part-id="b"]').first().dblclick();
  await expect(page.locator('.actor-node.primary-selected')).toHaveText(/Beta/);
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(0);

  // A box over the group's children now targets the LAYERS: the user is already
  // working inside the container, so the children keep their own frames.
  await marqueeAroundChildren(page, ['a', 'b']);
  await expect(page.locator('.actor-node.selected')).toHaveCount(2);
  await expect(page.locator('.actor-node.selected', { hasText: 'Alpha' })).toHaveCount(1);
  await expect(page.locator('.actor-node.selected', { hasText: 'Beta' })).toHaveCount(1);
  expect(await drawnFrames(page)).toHaveLength(2);
  await expect(page.getByTestId('group-aggregate-box')).toHaveCount(0);
});

for (const rotation of [90, 30]) {
  test(`group right-edge resize maps a ${rotation} degree child horizontally, with exact history`, async ({ page }) => {
    await seed(page, [
      { ...shape('a', 'Alpha', -120, 0), rotation },
      shape('b', 'Beta', 120, 0),
    ]);
    await groupPair(page);
    const child = page.locator('[data-part-id="a"]').first();
    const before = (await child.boundingBox())!;
    const left = await handleCentre(page, '#38bdf8', 0);
    const right = await handleCentre(page, '#38bdf8', 1);
    const delta = 60;
    const ratio = (right.x - left.x + delta) / (right.x - left.x);
    await page.mouse.move(right.x, right.y);
    await page.mouse.down();
    await expect(page.locator('.stage-canvas-container')).toHaveClass(/interaction-dragging/);
    await page.mouse.move(right.x + delta, right.y, { steps: 8 });
    await page.mouse.up();
    const after = (await child.boundingBox())!;
    const anchored = await handleCentre(page, '#38bdf8', 0);
    expect(Math.abs(anchored.x - left.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(anchored.y - left.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.x - (left.x + (before.x - left.x) * ratio))).toBeLessThanOrEqual(1);
    expect(Math.abs(after.width - before.width * ratio)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
    await page.locator('.autosave-status-badge').click();
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).layers.find((layer: { id: string }) => layer.id === 'a'), STORAGE_KEY);
    expect(saved.rotation).toBe(rotation);
    expect(saved).not.toHaveProperty('affine');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    const undone = (await child.boundingBox())!;
    for (const field of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(undone[field] - before[field])).toBeLessThanOrEqual(0.01);
    }
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    const redone = (await child.boundingBox())!;
    for (const field of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(redone[field] - after[field])).toBeLessThanOrEqual(0.01);
    }
  });
}
