/**
 * F — mask/matte authoring WORKFLOW in the real browser (sprint QA pass).
 *
 * Not another unit of the render contract (track-matte.spec.ts owns that):
 * this is the human journey the K-series built — a layer with a mask gets its
 * Mask group in the outliner, a scalar is armed and keyed across two frames,
 * a track-matte relationship with the source switched off reports itself
 * honestly, and every step leaves a screenshot artifact under
 * `test-results/f-*.png` as visual evidence.
 */
import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const shape = (id: string, name: string, x: number): Record<string, unknown> => ({
  id, name, type: 'custom_rect', x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218', fillEnabled: true, strokeEnabled: false, width: 160, height: 120,
});

test.describe('F — mask/matte workflow', () => {
  test('mask group → armed scalar → matte switch, with screenshot artifacts', async ({ page }) => {
    const masked = {
      ...shape('alpha', 'Alpha', -200),
      masks: [{
        id: 'm1', name: 'M1', mode: 'add',
        path: { version: 1, coordinateSpace: 'normalized', closed: true, points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }] },
      }],
    };
    const matteTarget = {
      ...shape('beta', 'Beta', 200),
      trackMatte: { sourceLayerId: 'alpha', mode: 'alpha', sourceVisible: false },
    };
    const track = {
      id: 'track-alpha', partId: 'alpha', name: 'Alpha', color: '#22d3ee', visible: true, locked: false, expanded: true,
      channels: emptyChannels(),
      maskChannels: { 'm1:opacity': [{ id: 'kmo0', frame: 0, value: 1, easing: 'linear' }] },
    };
    const scene = JSON.stringify({
      version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
      layers: [masked, matteTarget], tracks: [track],
    });

    await page.goto('/');
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
    await page.evaluate((payload: { key: string; value: string }) => {
      localStorage.clear();
      localStorage.setItem(payload.key, payload.value);
    }, { key: STORAGE_KEY, value: scene });
    await page.reload();
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

    // 1. The outliner lists the layer and its (collapsed) Mask group.
    await page.locator('.ue-track-row', { hasText: 'Alpha' }).first().click();
    await page.locator('.ue-expand-btn').first().click();
    const maskHeader = page.locator('.ue-subgroup-header', { hasText: 'Mask' });
    await expect(maskHeader).toBeVisible();
    await page.screenshot({ path: 'test-results/f-01-mask-group-collapsed.png' });

    // 2. Expanded: the mask property rows, and a keyed scalar already lit
    //    because the seeded track carries one key at frame 0.
    await maskHeader.click();
    await expect(maskHeader).toHaveAttribute('aria-expanded', 'true');
    const opacityStopwatch = page.locator('button.ue-channel-stopwatch[data-property-channel="m1:opacity"]');
    await expect(opacityStopwatch).toHaveAttribute('data-animation-state', 'keyed');
    await page.screenshot({ path: 'test-results/f-02-mask-rows-keyed.png' });

    // 3. Arm feather at frame 0: a second channel starts animating.
    await page.locator('button.ue-channel-stopwatch[data-property-channel="m1:feather"]').click();
    await expect(page.locator('button.ue-channel-stopwatch[data-property-channel="m1:feather"]')).toHaveAttribute('data-animation-state', 'keyed');
    await page.screenshot({ path: 'test-results/f-03-two-mask-channels.png' });

    // 4. The matte target reports the switched-off source honestly.
    const badge = page.locator('[title*="still clipping"]');
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveAttribute('title', /Track matte source: Alpha \(source hidden — still clipping\)/);
    await page.screenshot({ path: 'test-results/f-04-matte-badge.png' });
  });
});
