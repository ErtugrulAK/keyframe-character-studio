import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function channels() {
  return { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] };
}

async function seedParallelogram(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([key, scene]) => localStorage.setItem(key, scene), [STORAGE_KEY, JSON.stringify({
    version: 1,
    layers: [{
      id: 'para', name: 'Parallelogram', type: 'custom_parallelogram', x: 0, y: 0,
      rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
      width: 120, height: 60, fillColor: '#38bdf8', strokeColor: '#101218',
    }],
    tracks: [{ partId: 'para', channels: channels() }],
    fps: 30, totalFrames: 90, width: 600, height: 480,
  })]);
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

test('mirror duplicate keeps the selection gizmo aligned with a parallelogram', async ({ page }) => {
  await seedParallelogram(page);
  await page.locator('.actor-node', { hasText: 'Parallelogram' }).click();
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await page.getByRole('button', { name: /Mirror Y/i }).click();

  await expect(page.locator('.ue-outliner').getByText('Parallelogram Mirror Y').first()).toBeVisible();
  const gizmo = page.locator('[data-testid="transform-gizmo"]');
  await expect(gizmo).toBeVisible();
  await expect(gizmo.locator(':scope > g')).toHaveAttribute('transform', 'scale(-1, 1)');
  await expect(gizmo.locator('polygon[stroke="#00d2ff"][stroke-dasharray]')).toBeVisible();
});
