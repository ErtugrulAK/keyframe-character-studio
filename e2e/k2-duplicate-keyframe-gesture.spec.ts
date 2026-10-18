/**
 * K2 (contract D1) — alt-drag keyframe duplication on the live timeline.
 *
 * The gesture must work with a real pointer: Alt + press a layer-row diamond,
 * travel (the grid previews valid/blocked), release. A valid drop copies the
 * frame group as one undoable action and says nothing; a colliding drop
 * refuses with exactly one warning and zero mutation; Escape cancels clean.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const FRAME_WIDTH = 18;

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

async function seed(page: Page): Promise<void> {
  const layer = {
    id: 'alpha', name: 'Alpha', type: 'custom_rect', x: 100, y: 40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218', fillEnabled: true, strokeEnabled: false, width: 160, height: 120,
  };
  const track = {
    id: 'track-alpha', partId: 'alpha', name: 'Alpha', color: '#22d3ee', visible: true, locked: false, expanded: true,
    channels: {
      ...emptyChannels(),
      x: [
        { id: 'kx0', frame: 0, value: 100, easing: 'linear' },
        { id: 'kx30', frame: 30, value: 700, easing: 'linear' },
      ],
    },
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
  // Adopt the seeded bytes as the editor's own saved baseline (m23 adoption gate).
  const before = await page.locator('.autosave-status-badge').getAttribute('data-last-saved-at');
  await page.locator('.autosave-status-badge').click();
  await expect
    .poll(async () => Number((await page.locator('.autosave-status-badge').getAttribute('data-last-saved-at')) || '0'), { timeout: 10_000 })
    .toBeGreaterThan(Number(before || '0'));
  await page.locator('.ue-track-row', { hasText: 'Alpha' }).first().click();
  await page.locator('.ue-expand-btn').first().click();
}

/** Press the aggregate diamond at `fromFrame` and drag (Alt-aware) to `toFrame`. */
async function altDragDiamond(page: Page, fromFrame: number, toFrames: number[], opts: { escapeAt?: number } = {}): Promise<void> {
  const grid = page.locator('.timeline-grid-container');
  const gridBox = (await grid.boundingBox())!;
  const scrollLeft = await grid.evaluate((node) => node.scrollLeft);
  const diamond = page.locator('.keyframe-diamond').nth(fromFrame === 0 ? 0 : 1);
  const box = (await diamond.boundingBox())!;
  const x = (frame: number) => gridBox.x - scrollLeft + frame * FRAME_WIDTH + 4;
  await page.keyboard.down('Alt');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (const frame of toFrames) {
    await page.mouse.move(x(frame), box.y + box.height / 2, { steps: 3 });
    if (opts.escapeAt === frame) await page.keyboard.press('Escape');
  }
  await page.mouse.up();
  await page.keyboard.up('Alt');
}

test.describe('K2 — alt-drag duplicate (D1)', () => {
  test('a valid drop copies the frame group silently and previews during travel', async ({ page }) => {
    await seed(page);

    await altDragDiamond(page, 0, [15]);
    await expect(page.locator('.keyframe-diamond')).toHaveCount(3);
    await expect(page.getByText(/Duplicate blocked/)).toHaveCount(0);
  });

  test('a colliding drop refuses with exactly one warning and zero mutation', async ({ page }) => {
    await seed(page);

    await altDragDiamond(page, 0, [15, 30]);
    await expect(page.getByText('Duplicate blocked: that frame already has keyframes')).toBeVisible();
    await expect(page.locator('.keyframe-diamond')).toHaveCount(2);
  });

  test('Escape mid-drag cancels before the commit', async ({ page }) => {
    await seed(page);

    await altDragDiamond(page, 0, [15], { escapeAt: 15 });
    await expect(page.locator('.keyframe-diamond')).toHaveCount(2);
    await expect(page.getByText(/Duplicate/)).toHaveCount(0);
  });
});
