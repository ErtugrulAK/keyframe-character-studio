import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function channels() {
  return { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [], trimPathStart: [], trimPathEnd: [], trimPathOffset: [] };
}

function keyframe(id: string, frame: number, value: number) {
  return { id, frame, value, easing: 'linear', templateId: 'Sequence' };
}

function scene(overrides: Record<string, unknown> = {}) {
  const ch = channels();
  return {
    version: 1,
    layers: [{
      id: 'shape', name: 'Trim Shape', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
      visible: true, zIndex: 1, fillColor: '#ff2020', strokeColor: '#101218', width: 120, height: 80,
      fillEnabled: true, fillOpacity: 1, strokeEnabled: true, strokeWidth: 8, strokeOpacity: 1,
      trimPathEnabled: true, trimPathStart: 0, trimPathEnd: 0.5, trimPathOffset: 0,
    }],
    tracks: [{ id: 'track', partId: 'shape', name: 'Trim Shape', color: '#ff2020', channels: ch, keyframes: [], visible: true, locked: false, expanded: true }],
    fps: 30, totalFrames: 60, projectResolution: { width: 1920, height: 1080 }, ...overrides,
  };
}

async function seed(page: Page, data: Record<string, unknown>) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([key, value]: [string, string]) => localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(data)]);
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

async function save(page: Page) {
  const badge = page.locator('.autosave-status-badge');
  if (await badge.count()) await badge.click();
}

test.describe('Trim Path V2', () => {
  test('static authoring trims stroke only and remains usable at narrow width', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await seed(page, scene());
    await page.locator('.actor-node', { hasText: 'Trim Shape' }).click();

    const card = page.locator('.panel-card', { hasText: 'TRIM PATH' }).first();
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Expand TRIM PATH', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Collapse TRIM PATH', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(card.getByLabel('Trim Path Enabled')).toBeChecked();
    await expect.poll(() => card.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);

    const shape = page.locator('.stage-svg rect[pathLength="1"]').first();
    await expect(shape).toBeVisible();
    expect(await shape.getAttribute('stroke-dasharray')).toBe('0.5 0.5');
    expect(await shape.getAttribute('fill')).toBe('#ff2020');

    const end = card.locator('input[aria-label="Trim Path End"]');
    await end.fill('75');
    await end.press('Tab');
    await save(page);
    await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').layers?.[0]?.trimPathEnd, STORAGE_KEY)).toBe(0.75);
  });

  test('named sequence animates End through Broadcast and holds the final stroke', async ({ page }) => {
    const animated = scene();
    (animated.tracks as Array<{ channels: ReturnType<typeof channels> }>)[0].channels.trimPathEnd = [keyframe('end0', 0, 0), keyframe('end60', 60, 1)];
    await seed(page, animated);
    await page.getByText('BROADCAST', { exact: true }).click();
    await expect(page.locator('g[transform^="translate"]')).toHaveCount(0);
    await page.getByText('Sequence', { exact: true }).first().click();

    const stroke = page.locator('.stage-svg rect[pathLength="1"]').first();
    await expect.poll(() => stroke.getAttribute('stroke-dasharray')).not.toBe('0 1');
    const mid = await stroke.getAttribute('stroke-dasharray');
    await expect.poll(() => stroke.getAttribute('stroke-dasharray'), { timeout: 5000 }).toBeNull();
    expect(mid).not.toBeNull();
    expect(await stroke.getAttribute('fill')).toBe('#ff2020');
  });
});
