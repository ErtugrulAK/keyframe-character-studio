import { test, expect, type Page } from '@playwright/test';

/**
 * C10 — proportional keyframe time-stretch, as in After Effects: with several
 * keys selected, Alt-dragging the LAST selected key stretches the selection
 * about the first one (every gap grows by the same factor); one undo restores
 * it. Alt on a single key still duplicates (K2).
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

async function seed(page: Page): Promise<void> {
  const key = (id: string, frame: number) => ({ id, frame, value: frame * 10, easing: 'linear', templateId: 'Sequence' });
  const scene = {
    version: 1,
    layers: [{ id: 'box', name: 'Box', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#3b82f6' }],
    tracks: [{ id: 't_box', partId: 'box', name: 'Box', color: '#3b82f6', channels: { x: [key('k10', 10), key('k20', 20), key('k30', 30)] } }],
    fps: 30, totalFrames: 90, projectResolution: { width: 1920, height: 1080 },
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([k, d]: [string, string]) => {
    if (sessionStorage.getItem('c10-stretch-seeded') === '1') return;
    localStorage.setItem(k, d);
    sessionStorage.setItem('c10-stretch-seeded', '1');
  }, [STORAGE_KEY, JSON.stringify(scene)]);
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('.ue-expand-btn').first().click();
  await expect(page.locator('.ue-prop-diamond')).toHaveCount(3);
}

const keyFrames = async (page: Page) => {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10_000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').tracks[0].channels.x.map((k: { id: string; frame: number }) => [k.id, k.frame]), STORAGE_KEY);
};

test('Alt-dragging the last selected key stretches the selection about the first; one undo restores it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page);
  const diamonds = page.locator('.ue-prop-diamond');
  const centre = async (index: number) => {
    const box = (await diamonds.nth(index).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const first = await centre(0);
  const last = await centre(2);
  const perFrame = (last.x - first.x) / 20;

  await diamonds.nth(0).click();
  await diamonds.nth(1).click({ modifiers: ['Shift'] });
  await diamonds.nth(2).click({ modifiers: ['Shift'] });

  // Drag the frame-30 key to frame 50: every gap from frame 10 doubles.
  await page.keyboard.down('Alt');
  await page.mouse.move(last.x, last.y);
  await page.mouse.down();
  await page.mouse.move(last.x + 20 * perFrame, last.y, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up('Alt');

  expect(await keyFrames(page)).toEqual([['k10', 10], ['k20', 30], ['k30', 50]]);

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Control+z');
  expect(await keyFrames(page)).toEqual([['k10', 10], ['k20', 20], ['k30', 30]]);
});
