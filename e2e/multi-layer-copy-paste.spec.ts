import { test, expect, type Page } from '@playwright/test';

/**
 * Manual QA (rc.6 review): with several layers selected, Ctrl+C / Ctrl+V pasted
 * only one of them. The whole selection is copied, pasted as one edit, selected,
 * and one Ctrl+Z removes all the copies.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const shape = (id: string, name: string, x: number) => ({
  id, name, type: 'custom_rect', x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
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

test('copying several selected layers pastes all of them, undone in one step', async ({ page }) => {
  await seed(page, [shape('alpha', 'Alpha', -300), shape('beta', 'Beta', 0), shape('gamma', 'Gamma', 300)]);

  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await page.locator('.actor-node', { hasText: 'Gamma' }).first().click({ modifiers: ['Control'] });
  // The stage owns the shortcut: focus it without changing the selection.
  await page.locator('.stage-canvas-container').focus().catch(() => undefined);
  await page.keyboard.press('Control+C');
  await page.keyboard.press('Control+V');

  await expect(page.locator('.actor-node', { hasText: 'Alpha Copy' })).toHaveCount(1);
  await expect(page.locator('.actor-node', { hasText: 'Gamma Copy' })).toHaveCount(1);
  await expect(page.locator('.actor-node', { hasText: 'Beta Copy' })).toHaveCount(0);
  await expect(page.locator('.actor-node', { hasText: 'Alpha Copy' })).toHaveClass(/selected/);
  await expect(page.locator('.actor-node', { hasText: 'Gamma Copy' })).toHaveClass(/selected/);

  await page.keyboard.press('Control+Z');
  await expect(page.locator('.actor-node', { hasText: 'Copy' })).toHaveCount(0);
  await expect(page.locator('.actor-node')).toHaveCount(3);
});
