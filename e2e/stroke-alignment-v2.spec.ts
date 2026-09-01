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
  test('outside control preserves centered legacy stroke geometry and works without fill', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await seed(page, scene());
    await page.locator('.actor-node', { hasText: 'Stroke Shape' }).click();
    await page.getByRole('button', { name: 'Expand APPEARANCE', exact: true }).click();

    const fillRect = page.locator('.stage-svg rect[fill="#ff2020"]').first();
    await expect(fillRect).toBeVisible();
    const authoredGeometry = {
      x: await fillRect.getAttribute('x'),
      y: await fillRect.getAttribute('y'),
      width: await fillRect.getAttribute('width'),
      height: await fillRect.getAttribute('height'),
    };
    const centerStroke = page.locator('.stage-svg rect[stroke="#101218"]').first();
    const centerBounds = await centerStroke.boundingBox();
    expect(centerBounds).not.toBeNull();
    await expect(centerStroke).toHaveAttribute('stroke-width', '40');

    await page.getByLabel('Stroke Alignment').selectOption('outside');
    await expect(page.getByLabel('Stroke Alignment')).toHaveValue('outside');
    await expect(page.locator('.stage-svg rect[mask*="outside-stroke"]')).toHaveCount(0);
    await expect(centerStroke).toBeVisible();
    await expect(centerStroke).toHaveAttribute('stroke-width', '40');
    expect(await fillRect.getAttribute('x')).toBe(authoredGeometry.x);
    expect(await fillRect.getAttribute('width')).toBe(authoredGeometry.width);
    expect(await fillRect.getAttribute('height')).toBe(authoredGeometry.height);

    await page.getByLabel('Fill Enabled').uncheck();
    await expect(centerStroke).toBeVisible();
    await expect(centerStroke).toHaveAttribute('fill', 'none');

    const badge = page.locator('.autosave-status-badge');
    if (await badge.count()) await badge.click();
    await expect.poll(() => page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw).layers?.[0]?.strokeAlignment : undefined;
    }, STORAGE_KEY)).toBe('center');
    await page.reload();
    await expect.poll(() => page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw).layers?.[0]?.strokeAlignment : undefined;
    }, STORAGE_KEY)).toBe('center');
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
