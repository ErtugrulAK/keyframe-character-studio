import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const channels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const keyframe = (id: string, frame: number, value: number) => ({ id, frame, value, easing: 'linear', templateId: 'Sequence' });

const scene = (animated = false, alignment: 'center' | 'inside' | 'outside' = 'center') => {
  const ch = channels();
  if (animated) ch.trimPathEnd = [keyframe('end0', 0, 0), keyframe('end60', 60, 1)];
  return {
    version: 1,
    layers: [{
      id: 'stroke-shape', name: 'Stroke Shape', type: 'custom_rect', x: 0, y: 0, rotation: 0,
      scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
      fillColor: '#ff2020', strokeColor: '#101218', width: 200, height: 100,
      fillEnabled: true, fillOpacity: 1, strokeEnabled: true, strokeWidth: 40, strokeOpacity: 1,
      strokeAlignment: alignment, trimPathEnabled: animated, trimPathStart: 0, trimPathEnd: animated ? 0 : 1, trimPathOffset: 0,
    }],
    tracks: [{ id: 'stroke-track', partId: 'stroke-shape', name: 'Stroke Shape', color: '#ff2020', channels: ch, keyframes: [], visible: true, locked: false, expanded: true }],
    fps: 30, totalFrames: 60, projectResolution: { width: 1920, height: 1080 },
  };
};

async function seed(page: Page, data: Record<string, unknown>) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([key, value]: [string, string]) => {
    if (sessionStorage.getItem('stroke-alignment-v2-seeded') !== '1') {
      localStorage.setItem(key, value);
      sessionStorage.setItem('stroke-alignment-v2-seeded', '1');
    }
  }, [STORAGE_KEY, JSON.stringify(data)]);
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

test.describe('Stroke Alignment V2', () => {
  test('inside, center and outside each draw the authored width on their side of the edge and persist', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    // A green stroke, so it cannot be mistaken for the dark stage behind it.
    const greenStroke = scene();
    greenStroke.layers[0].strokeColor = '#20ff20';
    // 20 units: an INSIDE band of 20 leaves the 60-unit-high rectangle a clear
    // middle (C10: the band scales with the layer, so 40 would fill it).
    greenStroke.layers[0].strokeWidth = 20;
    // Scaled up so a row clear of both stroke bands and the axis exists. C10:
    // the stroke scales with the layer and the view like the geometry does.
    Object.assign(greenStroke.layers[0], { scaleX: 2, scaleY: 4 });
    await seed(page, greenStroke);
    await page.locator('.actor-node', { hasText: 'Stroke Shape' }).click();
    await page.getByRole('button', { name: 'Expand APPEARANCE', exact: true }).click();

    // A legacy centred stroke shows as CENTER (it used to show as OUTSIDE).
    await expect(page.getByLabel('Stroke Alignment')).toHaveValue('center');
    const fillRect = page.locator('.stage-svg rect[fill="#ff2020"]').first();
    await expect(fillRect).toBeVisible();
    const authored = await fillRect.evaluate((node) => ['x', 'y', 'width', 'height'].map((name) => node.getAttribute(name)));

    // Measured, not assumed: along a row through the shape, how many stroke
    // pixels lie outside the fill's left edge and how many inside it, in
    // authored units: the screen run divided by the shape's own horizontal
    // screen scale (C10: the stroke scales with it).
    const profile = async () => {
      const stage = await page.locator('.stage-canvas-container').boundingBox();
      if (!stage) throw new Error('no stage');
      await page.mouse.click(stage.x + 12, stage.y + stage.height - 12);
      await expect(page.locator('[role="tree"] [aria-selected="true"]')).toHaveCount(0);
      await page.mouse.move(stage.x + 6, stage.y + 6);
      // The geometry's own left edge on screen (a bounding box would include
      // the stroke), sampled on a row clear of the coordinate overlay's axis.
      const edge = await fillRect.evaluate((node) => {
        const rect = node as SVGRectElement;
        const ctm = rect.getScreenCTM()!;
        const x = rect.x.baseVal.value;
        // 42 % down: below the top stroke band (it scales with the layer too)
        // and above the X axis at the centre.
        const y = rect.y.baseVal.value + rect.height.baseVal.value * 0.42;
        const point = new DOMPoint(x, y).matrixTransform(ctm);
        return { x: point.x, y: point.y, scale: ctm.a };
      });
      const half = Math.ceil(45 * edge.scale) + 10;
      const clip = { x: Math.round(edge.x) - half, y: Math.round(edge.y), width: 2 * half, height: 1 };
      const png = (await page.screenshot({ clip })).toString('base64');
      const columns = await page.evaluate(async (data) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0);
        const px = context.getImageData(0, 0, image.width, 1).data;
        const kinds: string[] = [];
        for (let i = 0; i < px.length; i += 4) {
          const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
          kinds.push(g > 180 && r < 90 && b < 90 ? 's' : r > 180 && g < 90 && b < 90 ? 'f' : '-');
        }
        return kinds;
      }, png);
      // The stroke run on each side of the edge column. Up to two anti-aliased
      // pixels at the edge itself are skipped (not counted).
      const run = (from: number, step: number) => {
        let column = from;
        for (let skipped = 0; skipped < 2 && columns[column] !== undefined && columns[column] !== 's'; skipped += 1) column += step;
        let count = 0;
        for (; columns[column] === 's'; column += step) count += 1;
        return count;
      };
      const edgeColumn = Math.round(edge.x) - clip.x;
      const outside = run(edgeColumn - 1, -1);
      const inside = run(edgeColumn, 1);
      return { outside: outside / edge.scale, inside: inside / edge.scale, scale: edge.scale };
    };
    // ± 2 screen pixels (the anti-aliased edge), in authored units.
    const near = (value: { outside: number; inside: number; scale: number }, side: 'outside' | 'inside', expected: number) =>
      expect(Math.abs(value[side] - expected), `${side}: ${value[side].toFixed(2)} units, expected ${expected} ± ${(2 / value.scale).toFixed(2)}`).toBeLessThanOrEqual(2 / value.scale);

    let measured = await profile();
    near(measured, 'outside', 10);
    near(measured, 'inside', 10);

    await page.locator('.actor-node', { hasText: 'Stroke Shape' }).click();
    await page.getByLabel('Stroke Alignment').selectOption('outside');
    await expect(page.locator('.stage-svg rect[mask*="outside-stroke"]')).toHaveAttribute('stroke-width', '40');
    measured = await profile();
    near(measured, 'outside', 20);
    near(measured, 'inside', 0);

    await page.locator('.actor-node', { hasText: 'Stroke Shape' }).click();
    await page.getByLabel('Stroke Alignment').selectOption('inside');
    await expect(page.locator('.stage-svg rect[mask*="inside-stroke"]')).toHaveAttribute('stroke-width', '40');
    measured = await profile();
    near(measured, 'outside', 0);
    near(measured, 'inside', 20);

    // The authored geometry never moves; only the stroke changes side.
    expect(await fillRect.evaluate((node) => ['x', 'y', 'width', 'height'].map((name) => node.getAttribute(name)))).toEqual(authored);

    await page.locator('.actor-node', { hasText: 'Stroke Shape' }).click();
    await page.getByLabel('Stroke Alignment').selectOption('outside');
    await page.getByLabel('Fill Enabled').uncheck();
    await expect(page.locator('.stage-svg rect[mask*="outside-stroke"]')).toBeVisible();

    const badge = page.locator('.autosave-status-badge');
    if (await badge.count()) await badge.click();
    const stored = () => page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw).layers?.[0]?.strokeAlignment : undefined;
    }, STORAGE_KEY);
    await expect.poll(stored).toBe('outside');
    await page.reload();
    await expect.poll(stored).toBe('outside');
    await page.locator('.actor-node', { hasText: 'Stroke Shape' }).click();
    await page.getByRole('button', { name: 'Expand APPEARANCE', exact: true }).click();
    await expect(page.getByLabel('Stroke Alignment')).toHaveValue('outside');
  });

  test('inside alignment clips the canonical Trim Path stroke to authored geometry and persists', async ({ page }) => {
    await seed(page, scene(true));
    await page.locator('.actor-node', { hasText: 'Stroke Shape' }).click();
    await page.getByRole('button', { name: 'Expand APPEARANCE', exact: true }).click();
    await page.getByLabel('Stroke Alignment').selectOption('inside');

    const stroke = page.locator('.stage-svg rect[mask*="inside-stroke"]').first();
    await expect(stroke).toHaveAttribute('stroke-width', '80');
    await expect(stroke).toBeVisible();
    await expect(stroke).toHaveAttribute('pathLength', '1');
    await expect(page.locator('.stage-svg mask[id*="inside-stroke"] > rect').first()).toHaveAttribute('fill', 'black');
    await expect(page.locator('.stage-svg mask[id*="inside-stroke"] > rect').nth(1)).toHaveAttribute('fill', 'white');

    const badge = page.locator('.autosave-status-badge');
    if (await badge.count()) await badge.click();
    await expect.poll(() => page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw).layers?.[0]?.strokeAlignment : undefined;
    }, STORAGE_KEY)).toBe('inside');
  });

  test('outside alignment consumes the canonical Trim Path result in Broadcast', async ({ page }) => {
    await seed(page, scene(true, 'outside'));
    await page.getByText('BROADCAST', { exact: true }).click();
    await page.getByText('Sequence', { exact: true }).first().click();

    const stroke = page.locator('.stage-svg rect[mask*="outside-stroke"]').first();
    await expect(stroke).toHaveAttribute('pathLength', '1');
    await expect.poll(() => stroke.getAttribute('stroke-dasharray')).not.toBe('0 1');
    const mid = await stroke.getAttribute('stroke-dasharray');
    await expect.poll(() => stroke.getAttribute('stroke-dasharray'), { timeout: 5000 }).toBeNull();
    expect(mid).not.toBeNull();
  });
});
