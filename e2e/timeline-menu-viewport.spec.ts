import { test, expect, type Page } from '@playwright/test';

/**
 * The timeline keyframe menu opens at the pointer but stays inside the
 * viewport: a key near the right or bottom edge must not push its menu
 * off-screen, where its actions cannot be reached.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function emptyChannels(): Record<string, unknown[]> {
  return { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] };
}

async function seed(page: Page): Promise<void> {
  const ch = emptyChannels();
  ch.x = [
    { id: 'x_0', frame: 0, value: 0, easing: 'easeInOut', templateId: 'Sequence' },
    { id: 'x_end', frame: 90, value: 200, easing: 'easeInOut', templateId: 'Sequence' },
  ];
  const scene = {
    version: 1,
    layers: [{
      id: 'a', name: 'Part A', type: 'custom_box', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
      visible: true, zIndex: 1, fillColor: '#ff2020', strokeColor: '#101218', strokeWidth: 2, borderRadius: 0, width: 120, height: 120,
    }],
    tracks: [{ id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: ch, keyframes: [], visible: true, locked: false, expanded: true }],
    fps: 30, totalFrames: 90, projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'Timeline menu viewport E2E',
  };
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); });
  await page.addInitScript(
    ([key, data]: [string, string]) => {
      if (!localStorage.getItem('__KCS_E2E_SEEDED__')) {
        localStorage.setItem(key, data);
        localStorage.setItem('__KCS_E2E_SEEDED__', '1');
      }
    },
    [STORAGE_KEY, JSON.stringify(scene)],
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

test('a keyframe menu opened at the right edge stays inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page);
  const viewport = page.viewportSize()!;

  // Zoom in so the last key lies past the right edge, then scroll the lane
  // until that key sits just inside it.
  const zoomIn = page.getByRole('button', { name: 'Zoom in', exact: true });
  for (let i = 0; i < 4; i++) await zoomIn.click();
  const diamond = page.locator('.keyframe-diamond').last();
  await diamond.evaluate((node, targetX) => {
    const grid = node.closest<HTMLElement>('.timeline-grid-container');
    if (!grid) throw new Error('the key is not inside the timeline grid');
    const rect = node.getBoundingClientRect();
    grid.scrollLeft += rect.left + rect.width / 2 - targetX;
  }, viewport.width - 40);
  await expect.poll(async () => {
    const b = await diamond.boundingBox();
    return b ? Math.round(b.x + b.width / 2) : -1;
  }).toBeGreaterThan(viewport.width - 80);
  const key = (await diamond.boundingBox())!;
  expect(key.x + key.width).toBeLessThanOrEqual(viewport.width);
  const menu = page.getByRole('menu', { name: 'Keyframe actions' });

  const clickX = key.x + key.width / 2;
  await page.mouse.click(clickX, key.y + key.height / 2, { button: 'right' });
  await expect(menu).toBeVisible();

  const box = (await menu.boundingBox())!;
  // The pointer is close enough to the edge that an unclamped menu overflows.
  expect(clickX + box.width).toBeGreaterThan(viewport.width);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  // Every action is reachable.
  await expect(menu.getByRole('menuitem', { name: 'Delete Keyframe' })).toBeInViewport({ ratio: 1 });
});
