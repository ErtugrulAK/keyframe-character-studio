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

test('B — a click inside the selected group still selects the layer under it', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -120, 0), shape('b', 'Beta', 120, 0)]);
  await groupPair(page);

  const before = await childTransforms(page);
  await page.locator('[data-part-id="b"]').first().click();
  await expect(page.locator('.actor-node.primary-selected')).toHaveText(/Beta/);
  // The click was not a gesture: nothing moved.
  expect(await childTransforms(page)).toEqual(before);
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
