/**
 * K5 — the outliner tells the truth about a suppressed matte source: the V2
 * matte switch (`sourceVisible:false`) keeps clipping while the source layer
 * is not painted; the badge now says so.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

async function seed(page: Page): Promise<void> {
  const shape = (id: string, name: string, x: number): Record<string, unknown> => ({
    id, name, type: 'custom_rect', x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218', fillEnabled: true, strokeEnabled: false, width: 160, height: 120,
  });
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [
      shape('alpha', 'Alpha', -200),
      { ...shape('beta', 'Beta', 200), trackMatte: { sourceLayerId: 'alpha', mode: 'alpha', sourceVisible: false } },
    ],
    tracks: [],
  });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((payload: { key: string; value: string }) => {
    localStorage.clear();
    localStorage.setItem(payload.key, payload.value);
  }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

test.describe('K5 — matte visibility indicator', () => {
  test('the outliner badge names the hidden source and states it still clips', async ({ page }) => {
    await seed(page);
    const badge = page.locator('[title*="still clipping"]');
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveAttribute('title', /Track matte source: Alpha \(source hidden — still clipping\)/);
    // The visible-source layer carries no such claim.
    await expect(page.locator('[title*="still clipping"]')).not.toHaveAttribute('title', /Beta/);
  });
});
