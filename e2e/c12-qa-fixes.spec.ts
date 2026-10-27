/**
 * C12 — fixes from the C10 manual QA round, measured in Chromium:
 * - a mask stack: the "Cut a hole" of a SECOND mask really cuts, and editing
 *   the FIRST mask on the canvas repaints the layer at once (it used to keep
 *   its old shape until mask editing was left and entered again);
 * - double-clicking a mask point twice: handles out, then retracted;
 * - the artboard border and the selection frame stay thin when zoomed out;
 * - a shape's border ignores the layer's own scale and zooms with the view;
 * - the X/Y axis badges stay on screen at every zoom;
 * - the redesigned Motion Curve Editor fits laptop heights without scrolling and a phone; its graph drags true;
 * - a Track Matte source shows no "No track matte on this layer" line;
 * - changing the frame rate keeps the frame numbers (C10's retime reverted).
 */
import { expect, test, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const IMAGE = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#3b82f6"/></svg>',
).toString('base64')}`;

const square = (from: number, to: number) => ({
  version: 1,
  coordinateSpace: 'normalized',
  closed: true,
  points: [
    { id: 'v0', x: from, y: from, kind: 'corner' },
    { id: 'v1', x: to, y: from, kind: 'corner' },
    { id: 'v2', x: to, y: to, kind: 'corner' },
    { id: 'v3', x: from, y: to, kind: 'corner' },
  ],
});

/** An unrotated image at the artboard centre with an outer window and a hole inside it. */
async function seedTwoMasks(page: Page): Promise<void> {
  const scene = {
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [{
      id: 'img', name: 'Img', type: 'custom_image', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
      visible: true, zIndex: 1, fillColor: '#ffffff', strokeColor: '#000000', width: 480, height: 270, imageUrl: IMAGE,
      masks: [
        { id: 'm1', name: 'Outer', mode: 'add', enabled: true, opacity: 1, feather: 0, expansion: 0, path: square(0.3, 0.7) },
        { id: 'm2', name: 'Inner', mode: 'subtract', enabled: true, opacity: 1, feather: 0, expansion: 0, path: square(0.45, 0.55) },
      ],
    }],
    tracks: [{ id: 'track-img', partId: 'img', name: 'Img', color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() }],
  };
  await seed(page, scene);
}

async function seed(page: Page, scene: Record<string, unknown>): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => {
    localStorage.clear();
    localStorage.setItem(entry.key, entry.value);
  }, { key: STORAGE_KEY, value: JSON.stringify(scene) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

/** What the screen paints at each point (a real screenshot, decoded in the page). */
async function colorsAt(page: Page, points: { x: number; y: number }[]): Promise<number[][]> {
  const png = (await page.screenshot()).toString('base64');
  return page.evaluate(async ({ data, at }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    return at.map(({ x, y }) => [...context.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3));
  }, { data: png, at: points });
}

const isImageBlue = ([r, g, b]: number[]) => b > 200 && r < 90 && g > 100 && g < 160;

async function stageCentre(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('.stage-canvas-container').boundingBox();
  if (!box) throw new Error('stage has no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function vertexCentres(page: Page): Promise<{ x: number; y: number }[]> {
  return page.evaluate(() => [...document.querySelectorAll('[data-testid="mask-vertex"]')].map((node) => {
    const box = node.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }));
}

async function openMasks(page: Page): Promise<void> {
  await page.locator('.ue-track-row', { hasText: 'Img' }).first().click();
  await openDetailsTab(page, 'Masks');
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
}

test.describe('C12 — QA fixes', () => {
  test('a second mask cuts its hole, and editing the FIRST mask repaints the layer at once', async ({ page }) => {
    await seedTwoMasks(page);
    const centre = await stageCentre(page);
    const hole = { x: centre.x + 10, y: centre.y + 5 };
    const window = { x: centre.x + 60, y: centre.y + 30 };
    let [inHole, inWindow] = await colorsAt(page, [hole, window]);
    expect(isImageBlue(inWindow)).toBe(true);
    expect(isImageBlue(inHole)).toBe(false);

    await openMasks(page);
    await page.getByRole('button', { name: /Edit .*on canvas/i }).first().click();
    await expect(page.getByTestId('mask-edit-banner')).toContainText('Outer');
    const [first] = await vertexCentres(page);
    const grown = { x: first.x - 30, y: first.y - 20 };
    expect(isImageBlue((await colorsAt(page, [grown]))[0])).toBe(false);

    // Drag the outer window's first corner out: the newly enclosed area shows
    // the image while mask editing is still on.
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    await page.mouse.move(first.x - 60, first.y - 40, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => isImageBlue((await colorsAt(page, [grown]))[0])).toBe(true);
    [inHole, inWindow] = await colorsAt(page, [hole, window]);
    expect(isImageBlue(inWindow)).toBe(true);
    expect(isImageBlue(inHole)).toBe(false);
  });

  test('double-clicking a mask point twice pulls handles out, then retracts them', async ({ page }) => {
    await seedTwoMasks(page);
    await openMasks(page);
    await page.getByRole('button', { name: /Edit .*on canvas/i }).first().click();
    const vertex = page.getByTestId('mask-vertex').first();
    await vertex.click();
    await expect(page.getByTestId('mask-tangent-handle-out')).toHaveCount(0);

    await vertex.dblclick();
    await expect(page.getByTestId('mask-tangent-handle-out')).toHaveCount(1);
    await expect(page.getByTestId('mask-tangent-handle-in')).toHaveCount(1);
    await expect(vertex).toHaveAttribute('aria-label', /smooth/);

    await vertex.dblclick();
    await expect(page.getByTestId('mask-tangent-handle-out')).toHaveCount(0);
    await expect(page.getByTestId('mask-tangent-handle-in')).toHaveCount(0);
    await expect(vertex).toHaveAttribute('aria-label', /corner/);
    await page.keyboard.press('Escape');
    const point = (await savedScene(page)).layers[0].masks[0].path.points[0];
    expect(point).toEqual({ id: 'v0', x: 0.3, y: 0.3, kind: 'corner' });
  });

  test('zoomed far out, the artboard border and the dashed selection frame stay thin', async ({ page }) => {
    await seed(page, {
      version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
      layers: [{ id: 'box', name: 'Box', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 2, opacity: 1, visible: true, zIndex: 1, fillColor: '#f43f5e' }],
      tracks: [{ id: 'track-box', partId: 'box', name: 'Box', color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() }],
    });
    await page.locator('.ue-track-row', { hasText: 'Box' }).first().click();
    const centre = await stageCentre(page);
    await page.mouse.move(centre.x, centre.y);
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, 200);
      await page.keyboard.up('Control');
    }
    // Far enough out that the old zoom compensation tripled the widths.
    await expect.poll(() => page.locator('.stage-canvas-container svg').first().evaluate((svg) => {
      const viewBox = (svg as SVGSVGElement).viewBox.baseVal;
      return svg.getBoundingClientRect().width / viewBox.width;
    })).toBeLessThan(0.35);

    // The artboard's top edge: count the painted cyan rows across it.
    const border = await page.locator('.stage-canvas-container svg line[stroke="#00d2ff"]').first().boundingBox();
    if (!border) throw new Error('artboard border has no box');
    const column = Array.from({ length: 21 }, (_, row) => ({ x: border.x + border.width / 3, y: border.y - 10 + row }));
    // Antialiased, so a row counts once it is clearly cyan-tinted.
    const cyanRows = (await colorsAt(page, column)).filter(([r, g, b]) => r < 80 && g > 100 && b > 100).length;
    expect(cyanRows).toBeGreaterThan(0);
    expect(cyanRows).toBeLessThanOrEqual(3);

    const frame = page.getByTestId('transform-gizmo').first().locator('rect[stroke="#00d2ff"]').first();
    await expect(frame).toHaveAttribute('vector-effect', 'non-scaling-stroke');
    await expect(frame).toHaveAttribute('stroke-width', '1.5');
    await expect(frame).toHaveAttribute('stroke-dasharray', '5 4');
  });

  test('a big drawn shape gets the same thin border as a small one; the border still zooms with the view', async ({ page }) => {
    await seed(page, { version: 1, layers: [], tracks: [], fps: 30, totalFrames: 60, projectResolution: { width: 1920, height: 1080 } });
    const stage = await page.locator('.stage-canvas-container').boundingBox();
    if (!stage) throw new Error('stage has no box');
    // A small and a large (and not square) rectangle, drawn by dragging.
    for (const [x, y, width, height] of [[60, 160, 60, 40], [240, 70, 380, 300]]) {
      // The tool stays armed after a shape; a second click would disarm it.
      const tool = page.getByRole('button', { name: 'Add rectangle' });
      if (await tool.getAttribute('aria-pressed') !== 'true') await tool.click();
      await page.mouse.move(stage.x + x, stage.y + y);
      await page.mouse.down();
      await page.mouse.move(stage.x + x + width, stage.y + y + height, { steps: 8 });
      await page.mouse.up();
    }
    await expect(page.locator('.stage-svg g[data-part-id]')).toHaveCount(2);
    const borders = () => page.evaluate(() => {
      const view = Number(getComputedStyle(document.querySelector('.stage-svg')!).getPropertyValue('--kcs-stroke-scale'));
      return {
        view,
        layers: [...document.querySelectorAll('.stage-svg g[data-part-id] rect')].map((rect) => ({
          scale: Math.abs((rect as SVGRectElement).getScreenCTM()!.a),
          screen: Number.parseFloat(getComputedStyle(rect).strokeWidth),
          nonScaling: getComputedStyle(rect).vectorEffect === 'non-scaling-stroke',
        })),
      };
    });
    const fitted = await borders();
    // The large rectangle is a scaled canonical one: its own scale is several
    // times the small one's, its border is not.
    expect(fitted.layers[1].scale / fitted.layers[0].scale).toBeGreaterThan(3);
    for (const layer of fitted.layers) {
      expect(layer.nonScaling).toBe(true);
      expect(layer.screen).toBeCloseTo(1.5 * fitted.view, 3);
    }

    const centre = await stageCentre(page);
    await page.mouse.move(centre.x, centre.y);
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, 200);
      await page.keyboard.up('Control');
    }
    await expect.poll(async () => (await borders()).view).toBeLessThan(fitted.view * 0.7);
    const zoomed = await borders();
    for (const layer of zoomed.layers) expect(layer.screen).toBeCloseTo(1.5 * zoomed.view, 3);
  });

  test('the X and Y axis badges are on screen at the opening zoom and at the artboard edges zoomed out', async ({ page }) => {
    await seed(page, { version: 1, layers: [], tracks: [], fps: 30, totalFrames: 60, projectResolution: { width: 1920, height: 1080 } });
    const stage = await page.locator('.stage-canvas-container').boundingBox();
    if (!stage) throw new Error('stage has no box');
    const box = async (axis: 'x' | 'y') => {
      const found = await page.getByTestId(`coordinate-axis-badge-${axis}`).boundingBox();
      if (!found) throw new Error(`no ${axis} badge`);
      return found;
    };
    // The opening camera shows less than the artboard: the badges sit at the
    // stage's own right and top edges, on their axes.
    for (const axis of ['x', 'y'] as const) {
      const badge = await box(axis);
      expect(badge.x).toBeGreaterThanOrEqual(stage.x);
      expect(badge.y).toBeGreaterThanOrEqual(stage.y);
      expect(badge.x + badge.width).toBeLessThanOrEqual(stage.x + stage.width);
      expect(badge.y + badge.height).toBeLessThanOrEqual(stage.y + stage.height);
    }
    expect(stage.x + stage.width - ((await box('x')).x + (await box('x')).width)).toBeLessThan(12);
    expect((await box('y')).y - stage.y).toBeLessThan(12);
    await expect(page.getByTestId('coordinate-axis-badge-x')).toContainText('X');
    await expect(page.getByTestId('coordinate-axis-badge-y')).toContainText('Y');

    const centre = await stageCentre(page);
    await page.mouse.move(centre.x, centre.y);
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, 200);
      await page.keyboard.up('Control');
    }
    // Zoomed out, the whole artboard is on screen: the badges sit just inside
    // its edges (a 6 px inset, plus the outlines).
    const border = page.locator('.stage-canvas-container svg line[stroke="#00d2ff"]');
    const top = await border.nth(0).boundingBox();
    const right = await border.nth(3).boundingBox();
    if (!top || !right) throw new Error('artboard border has no box');
    await expect.poll(async () => right.x - ((await box('x')).x + (await box('x')).width)).toBeLessThan(8);
    const x = await box('x');
    expect(x.x + x.width).toBeLessThanOrEqual(right.x + 1);
    const y = await box('y');
    expect(y.y).toBeGreaterThanOrEqual(top.y - 1);
    expect(y.y - top.y).toBeLessThan(8);
  });

  for (const size of [{ width: 1440, height: 900 }, { width: 1536, height: 730 }, { width: 1366, height: 650 }, { width: 390, height: 844 }]) {
    test(`the Motion Curve Editor fits ${size.width} px; a handle dragged on its graph lands under the pointer`, async ({ page }) => {
      await seed(page, {
        version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
        layers: [{ id: 'box', name: 'Box', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#f43f5e' }],
        tracks: [{ id: 'track-box', partId: 'box', name: 'Box', color: '#22d3ee', visible: true, locked: false, expanded: false,
          channels: { ...emptyChannels(), x: [{ id: 'k0', frame: 0, value: 0, easing: 'easeInOut' }, { id: 'k1', frame: 30, value: 200, easing: 'easeInOut' }] } }],
      });
      await page.setViewportSize(size);
      await page.locator('.ue-track-row', { hasText: 'Box' }).first().click();
      await page.locator('.keyframe-diamond').last().click();
      await page.getByRole('button', { name: /Motion Curves/ }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Motion Curve Editor' });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('Segment F0 → F30');

      // Nothing sticks out of the window sideways, the graph included.
      const graph = page.locator('.ce-curve-svg');
      const graphBox = await graph.boundingBox();
      if (!graphBox) throw new Error('no graph');
      expect(graphBox.x).toBeGreaterThanOrEqual(0);
      expect(graphBox.x + graphBox.width).toBeLessThanOrEqual(size.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
      // On a laptop-height browser the whole editor is on screen: no scrolling
      // inside the dialog (a phone stacks the columns and may scroll).
      if (size.width > 860) {
        const card = await page.locator('.ce-dialog').evaluate((node) => ({ client: node.clientHeight, content: node.scrollHeight }));
        expect(card.content).toBeLessThanOrEqual(card.client);
        await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeInViewport({ ratio: 1 });
      }

      // The unit box's middle (0.5, 0.5), from the drawn unit box itself.
      const unit = await page.locator('.ce-curve-unit').boundingBox();
      if (!unit) throw new Error('no unit box');
      const handle = page.locator('.ce-curve-handle.is-out .ce-curve-handle-dot');
      const from = await handle.boundingBox();
      if (!from) throw new Error('no handle');
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(unit.x + unit.width / 2, unit.y + unit.height / 2, { steps: 6 });
      await page.mouse.up();
      expect(Number(await page.locator('#bezier-p1-x').inputValue())).toBeCloseTo(0.5, 1);
      expect(Number(await page.locator('#bezier-p1-y').inputValue())).toBeCloseTo(0.5, 1);
    });
  }

  test('a Track Matte source shows which layer it is the matte of, and no "No track matte" line', async ({ page }) => {
    await seed(page, {
      version: 1,
      layers: [
        { id: 'photo', name: 'Photo', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 3, scaleY: 3, opacity: 1, visible: true, zIndex: 1, fillColor: '#3b82f6',
          trackMatte: { sourceLayerId: 'star', mode: 'alpha', enabled: true, inverted: false, sourceVisible: false } },
        { id: 'star', name: 'Star', type: 'custom_star', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, fillColor: '#facc15' },
      ],
      tracks: [], fps: 30, totalFrames: 60,
      projectResolution: { width: 1920, height: 1080 },
    });
    await page.locator('.actor-node', { hasText: 'Photo' }).click();
    await openDetailsTab(page, 'Masks');
    await page.getByRole('button', { name: 'Select Source' }).click();
    const summary = page.getByTestId('track-matte-summary');
    await expect(page.getByTestId('track-matte-targets')).toContainText('Photo');
    await expect(summary).not.toContainText('No track matte');
  });

  test('changing the frame rate keeps every key on its frame and the sequence length', async ({ page }) => {
    await seed(page, {
      version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
      layers: [{ id: 'box', name: 'Box', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#f43f5e' }],
      tracks: [{ id: 'track-box', partId: 'box', name: 'Box', color: '#22d3ee', visible: true, locked: false, expanded: false,
        channels: { ...emptyChannels(), x: [{ id: 'k0', frame: 0, value: 0, easing: 'linear' }, { id: 'k1', frame: 30, value: 200, easing: 'linear' }] } }],
    });
    const before = await savedScene(page);
    await page.locator('select[title="Animation Frame Rate (FPS)"]').selectOption('60');
    const after = await savedScene(page);
    expect(after.fps).toBe(60);
    expect(after.totalFrames).toBe(before.totalFrames);
    expect(after.tracks[0].channels.x.map((key: { frame: number }) => key.frame)).toEqual([0, 30]);
  });
});
