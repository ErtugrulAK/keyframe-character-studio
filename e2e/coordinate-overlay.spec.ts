import { test, expect, type Page } from '@playwright/test';

/**
 * Sprint 1 coordinate overlay in a real browser.
 *
 * The stage axes and the selected marker are authored in the existing editor
 * camera space; the Inspector and the readout must agree, the marker must track
 * the evaluated world origin through hierarchy/rotation/scale, and the whole
 * surface must remain presentation-only across zoom, pan, resize, Broadcast and
 * a localStorage round-trip.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const layer = (id: string, name: string, props: Record<string, unknown> = {}) => ({
  id,
  name,
  type: 'custom_rect',
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  visible: true,
  zIndex: 1,
  fillColor: '#22d3ee',
  strokeColor: '#101218',
  fillEnabled: true,
  strokeEnabled: false,
  width: 100,
  height: 100,
  ...props,
});

const childScene = () => {
  const parent = layer('parent', 'Parent', {
    x: 100, y: 0, rotation: 30, scaleX: 2, scaleY: 2, zIndex: 1,
  });
  const child = layer('child', 'Child', {
    x: 50, y: 0, rotation: 45, scaleX: 0.5, scaleY: 0.5,
    parentId: 'parent', zIndex: 2, fillColor: '#f59e0b',
  });
  return {
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    width: 1920,
    height: 1080,
    fps: 30,
    totalFrames: 60,
    layers: [parent, child],
    tracks: [parent, child].map((entry) => ({ partId: entry.id, channels: channel() })),
  };
};

const legacyScene = () => {
  const box = layer('box', 'Legacy Box', { x: 30_000, y: -10_000 });
  return {
    version: 1,
    coordinateSystem: 'legacy-unknown',
    width: 1920,
    height: 1080,
    fps: 30,
    totalFrames: 60,
    layers: [box],
    tracks: [{ partId: box.id, channels: channel() }],
  };
};

async function seed(page: Page, data: Record<string, unknown>): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: JSON.stringify(data) },
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30_000 });
}

async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => new Promise<boolean>((resolve) => {
    const stage = document.querySelector('.stage-canvas-container');
    const svg = document.querySelector('.stage-svg');
    if (!stage || !svg) { resolve(false); return; }
    let previous = '';
    let stable = 0;
    const sample = () => {
      const rect = stage.getBoundingClientRect();
      const key = [
        Math.round(rect.left * 100) / 100,
        Math.round(rect.top * 100) / 100,
        Math.round(rect.width * 100) / 100,
        Math.round(rect.height * 100) / 100,
        getComputedStyle(svg).transform,
      ].join('|');
      stable = key === previous ? stable + 1 : 0;
      previous = key;
      if (stable >= 3) resolve(true);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }), undefined, { timeout: 15_000 });
}

async function selectPart(page: Page, name: string, id: string): Promise<void> {
  await page.locator('.actor-node', { hasText: name }).first().click();
  await expect(page.locator(`[data-part-id="${id}"]`)).toHaveCount(1);
  await expect(page.getByTestId('coordinate-readout')).toBeVisible();
}

async function selectedCentres(page: Page, partId: string) {
  return page.evaluate((id) => {
    const marker = document.querySelector('[data-testid="coordinate-selection-marker"]');
    const ring = marker?.querySelector('circle');
    const part = document.querySelector(`[data-part-id="${id}"]`);
    if (!ring || !part) throw new Error('coordinate marker or selected part unavailable');
    const markerBox = ring.getBoundingClientRect();
    const partBox = part.getBoundingClientRect();
    return {
      marker: { x: markerBox.left + markerBox.width / 2, y: markerBox.top + markerBox.height / 2 },
      part: { x: partBox.left + partBox.width / 2, y: partBox.top + partBox.height / 2 },
    };
  }, partId);
}

async function inspectorPosition(page: Page): Promise<{ x: string; y: string }> {
  const expand = page.getByRole('button', { name: 'Expand TRANSFORM', exact: true });
  if (await expand.count()) await expand.click();
  return {
    x: await page.locator('input[aria-label="Position X"]').inputValue(),
    y: await page.locator('input[aria-label="Position Y"]').inputValue(),
  };
}

test('axes, selected marker and Inspector agree; toggle is presentation-only', async ({ page }) => {
  await seed(page, childScene());
  await selectPart(page, 'Child', 'child');

  const overlay = page.getByTestId('coordinate-overlay');
  await expect(overlay).toHaveCount(1);
  const xAxis = overlay.locator('[data-axis="x"]');
  const yAxis = overlay.locator('[data-axis="y"]');
  await expect(xAxis).toHaveCount(1);
  await expect(yAxis).toHaveCount(1);
  expect(await xAxis.getAttribute('y1')).toBe('240');
  expect(await yAxis.getAttribute('x1')).toBe('300');

  const centres = await selectedCentres(page, 'child');
  expect(Math.abs(centres.marker.x - centres.part.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(centres.marker.y - centres.part.y)).toBeLessThanOrEqual(1);

  const inspector = await inspectorPosition(page);
  expect(Number(inspector.x)).toBeCloseTo(186.6025, 2);
  expect(Number(inspector.y)).toBeCloseTo(-50, 2);
  await expect(page.getByTestId('coordinate-readout-x')).toHaveText(inspector.x);
  await expect(page.getByTestId('coordinate-readout-y')).toHaveText(inspector.y);

  const toggle = page.getByRole('button', { name: 'Toggle coordinate overlay' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const beforeScene = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);

  await toggle.click();
  await expect(overlay).toHaveCount(0);
  await expect(page.getByTestId('coordinate-readout')).toHaveCount(0);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  await toggle.click();
  await expect(overlay).toHaveCount(1);
  await expect(page.getByTestId('coordinate-readout')).toHaveCount(1);
  const afterScene = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
  expect(afterScene.layers).toEqual(beforeScene.layers);
  expect(afterScene.tracks).toEqual(beforeScene.tracks);
  expect(afterScene).not.toHaveProperty('showCoordinateOverlay');

  expect(await overlay.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('none');
  const hitIsOverlay = await page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('.stage-svg');
    const origin = new DOMPoint(300, 240).matrixTransform(svg!.getScreenCTM()!);
    return Boolean(document.elementFromPoint(origin.x, origin.y)?.closest('[data-testid="coordinate-overlay"]'));
  });
  expect(hitIsOverlay).toBe(false);
});

test('legacy centi-unit scenes use the Inspector display scale in the readout', async ({ page }) => {
  await seed(page, legacyScene());
  await selectPart(page, 'Legacy Box', 'box');
  const inspector = await inspectorPosition(page);
  expect(inspector).toEqual({ x: '300', y: '100' });
  await expect(page.getByTestId('coordinate-readout-x')).toHaveText('300');
  await expect(page.getByTestId('coordinate-readout-y')).toHaveText('100');
});

test('marker and axes stay aligned through zoom, pan and resize', async ({ page }) => {
  await seed(page, childScene());
  await selectPart(page, 'Child', 'child');
  const fromInspector = await inspectorPosition(page);
  await expect(page.getByTestId('coordinate-readout-x')).toHaveText(fromInspector.x);
  await expect(page.getByTestId('coordinate-readout-y')).toHaveText(fromInspector.y);

  const assertAligned = async (label: string) => {
    const centres = await selectedCentres(page, 'child');
    expect(Math.abs(centres.marker.x - centres.part.x), `${label}: marker x drifted`).toBeLessThanOrEqual(1);
    expect(Math.abs(centres.marker.y - centres.part.y), `${label}: marker y drifted`).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('coordinate-readout-x')).toHaveText(fromInspector.x);
    await expect(page.getByTestId('coordinate-readout-y')).toHaveText(fromInspector.y);
    await expect(page.getByTestId('coordinate-overlay')).toHaveCount(1);
  };

  await assertAligned('baseline');

  const tools = page.getByRole('toolbar', { name: 'Authoring tools' });
  await tools.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await tools.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await settle(page);
  await assertAligned('zoom');

  await tools.getByRole('button', { name: 'Pan', exact: true }).click();
  const stage = page.locator('.stage-canvas-container');
  const box = await stage.boundingBox();
  if (!box) throw new Error('stage box unavailable');
  // Pan from empty chrome, not from a layer: this isolates camera movement
  // from the stage's existing click-to-select behaviour.
  await page.mouse.move(box.x + 60, box.y + box.height - 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + box.height - 10, { steps: 8 });
  await page.mouse.up();
  await settle(page);
  await assertAligned('pan');

  await page.setViewportSize({ width: 1100, height: 760 });
  await settle(page);
  await assertAligned('resize');
});

test('coordinate chrome is hidden in Broadcast and returns in Edit mode', async ({ page }) => {
  await seed(page, childScene());
  await selectPart(page, 'Child', 'child');
  await expect(page.getByTestId('coordinate-overlay')).toHaveCount(1);

  await page.getByText('BROADCAST', { exact: true }).click();
  await expect(page.getByTestId('coordinate-overlay')).toHaveCount(0);
  await expect(page.getByTestId('coordinate-readout')).toHaveCount(0);

  await page.getByText('EDIT MODE', { exact: true }).click();
  await expect(page.getByTestId('coordinate-overlay')).toHaveCount(1);
  await expect(page.getByTestId('coordinate-readout')).toHaveCount(1);
});
