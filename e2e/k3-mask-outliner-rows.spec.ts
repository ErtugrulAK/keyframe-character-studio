/**
 * K3 — the mask groups on the live timeline: a layer that owns masks lists its
 * animatable mask properties in the outliner (C7: one collapsible group per
 * mask, named by the mask, after the layer properties),
 * and the stopwatch arms/disarms them exactly like the transform channels.
 */
import { expect, test, type Page } from '@playwright/test';
import { armProperty, propertyRow, requestRemoveAllKeyframes } from './fixtures/propertyAnimation';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

async function seed(page: Page): Promise<void> {
  const layer = {
    id: 'alpha', name: 'Alpha', type: 'custom_rect', x: 100, y: 40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218', fillEnabled: true, strokeEnabled: false, width: 160, height: 120,
    masks: [{
      id: 'm1', name: 'M1', mode: 'add',
      path: { version: 1, coordinateSpace: 'normalized', closed: true, points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }] },
    }],
  };
  const track = {
    id: 'track-alpha', partId: 'alpha', name: 'Alpha', color: '#22d3ee', visible: true, locked: false, expanded: true,
    channels: emptyChannels(),
    maskChannels: {},
  };
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [layer], tracks: [track],
  });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((payload: { key: string; value: string }) => {
    localStorage.clear();
    localStorage.setItem(payload.key, payload.value);
  }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('.ue-track-row', { hasText: 'Alpha' }).first().click();
  await page.locator('.ue-expand-btn').first().click();
}

// C7 — the group header of mask m1, which reads the mask's name.
const maskGroupHeader = (page: Page) => page.locator('.ue-subgroup-header[data-property-group$="_mask:m1"]');

const maskRow = (page: Page, channel: string) => propertyRow(page, channel);

test.describe('K3 — mask authoring rows (outliner)', () => {
  test('the Mask group expands to the mask property rows and arms through the "+"', async ({ page }) => {
    await seed(page);

    const maskHeader = maskGroupHeader(page);
    await expect(maskHeader).toBeVisible();
    await expect(maskHeader).toHaveText('M1');
    // After the layer properties, collapsed by default.
    await expect(maskHeader).toHaveAttribute('aria-expanded', 'false');
    await expect(maskRow(page, 'm1:opacity')).toHaveCount(0);

    await maskHeader.click();
    await expect(maskHeader).toHaveAttribute('aria-expanded', 'true');
    await expect(maskRow(page, 'm1:path')).toBeVisible();
    await expect(maskRow(page, 'm1:opacity')).toBeVisible();
    await expect(maskRow(page, 'm1:feather')).toBeVisible();
    await expect(maskRow(page, 'm1:expansion')).toBeVisible();

    // Arm opacity at frame 0: a key lands, the row flips to keyed.
    await armProperty(page, 'm1:opacity');
    await expect(maskRow(page, 'm1:opacity')).toHaveAttribute('data-animation-state', 'keyed');
  });

  test('disarming a mask channel confirms before deleting the keys (D2 parity)', async ({ page }) => {
    await seed(page);
    await maskGroupHeader(page).click();
    await armProperty(page, 'm1:feather');
    await expect(maskRow(page, 'm1:feather')).toHaveAttribute('data-animation-state', 'keyed');

    await requestRemoveAllKeyframes(page, 'm1:feather');
    const dialog = page.locator('.confirmation-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('M1');
    await dialog.locator('.confirmation-dialog-cancel').click();
    await expect(maskRow(page, 'm1:feather')).toHaveAttribute('data-animation-state', 'keyed');

    await requestRemoveAllKeyframes(page, 'm1:feather');
    await page.locator('.confirmation-dialog-confirm').click();
    await expect(maskRow(page, 'm1:feather')).toHaveAttribute('data-animation-state', 'off');
  });
});
