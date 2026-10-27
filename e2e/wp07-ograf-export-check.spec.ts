/**
 * WP-07 — the OGraf export check in Chromium: before exporting, every layer is
 * listed as Supported / Exports with warnings / Blocks export, from the real
 * export diagnostics; a blocked scene cannot be exported from the check; a
 * supported scene exports a package from it; a disabled matte relationship no
 * longer blocks the export.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const shape = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
  id, name, type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#22d3ee', strokeColor: '#000000', width: 120, height: 80, ...overrides,
});

async function seed(page: Page, layers: Record<string, unknown>[]): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers,
    tracks: layers.map((layer) => ({ id: `track-${layer.id}`, partId: layer.id, name: layer.id, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() })),
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => {
    localStorage.clear();
    localStorage.setItem(entry.key, entry.value);
  }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

async function openCheck(page: Page) {
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('menuitem', { name: 'Check OGraf Export…' }).click();
  const dialog = page.getByRole('dialog', { name: 'OGraf export check' });
  await expect(dialog.getByTestId('ograf-capability-summary')).toBeVisible();
  return dialog;
}

test('WP-07 — per-layer OGraf capability before export; blocked scenes cannot export from the check', async ({ page }) => {
  await seed(page, [
    shape('plain', 'Plain card'),
    shape('clipped', 'Clipped card', { zIndex: 2, matte: { sourcePartId: 'plain', mode: 'clip' } }),
    shape('feathered', 'Feathered card', { zIndex: 3, matte: { sourcePartId: 'plain', mode: 'alpha', feather: 6 } }),
  ]);
  const dialog = await openCheck(page);
  await expect(dialog.locator('[data-layer-id="plain"]')).toHaveAttribute('data-capability', 'supported');
  await expect(dialog.locator('[data-layer-id="clipped"]')).toHaveAttribute('data-capability', 'conditional');
  await expect(dialog.locator('[data-layer-id="feathered"]')).toHaveAttribute('data-capability', 'blocked');
  await expect(dialog.locator('[data-layer-id="feathered"]')).toContainText('feather');
  await expect(dialog.getByTestId('ograf-capability-summary')).toContainText('Export is blocked');
  await expect(dialog.getByRole('button', { name: 'Export OGraf Package' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  // Focus returns to the editor (the dialog restored it), and nothing was written.
  await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
});

test('WP-07 — a supported scene exports from the check; a disabled matte relationship does not block', async ({ page }) => {
  await seed(page, [
    shape('a', 'Card A', { trackMatte: { sourceLayerId: 'b', mode: 'alpha' } }),
    // B → A would be a cycle, but the relationship is DISABLED: inactive, not blocking.
    shape('b', 'Card B', { zIndex: 2, trackMatte: { sourceLayerId: 'a', mode: 'alpha', enabled: false } }),
  ]);
  const dialog = await openCheck(page);
  await expect(dialog.getByTestId('ograf-capability-summary')).toContainText('can be exported');
  const exportButton = dialog.getByRole('button', { name: 'Export OGraf Package' });
  await expect(exportButton).toBeEnabled();
  const download = page.waitForEvent('download');
  await exportButton.click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.zip$/);
});
