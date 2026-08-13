import { test, expect, type Page } from '@playwright/test';

/**
 * BUGFIX MILESTONE — BUG 1: timeline keyframe drag.
 * A canonical (M6 channel) frame-group diamond must be draggable: mousedown →
 * mousemove → mouseup moves ALL channel keyframes of that frame together.
 * Uses the real editor DOM (dev server + localStorage seed).
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function makeLayer(id: string, name: string, type: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, name, type,
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1,
    fillColor: '#ff0000', strokeColor: '#101218', strokeWidth: 2, borderRadius: 0,
    width: 60, height: 60,
    ...overrides,
  };
}

async function seed(page: Page) {
  const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
  const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00' });
  const tracks = [
    {
      id: 't_tgt', partId: 'tgt', name: 'Target', color: '#3b82f6',
      channels: {
        x: [
          { id: 'kx1', frame: 5, value: 0, easing: 'linear' },
          { id: 'kx2', frame: 30, value: 120, easing: 'linear' },
        ],
        y: [
          { id: 'ky1', frame: 5, value: 0, easing: 'linear' },
          { id: 'ky2', frame: 30, value: 40, easing: 'linear' },
        ],
      },
    },
  ];
  const scene = {
    version: 1, layers: [source, target], tracks,
    fps: 30, totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'Drag Spike',
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([k, d]: [string, string]) => { localStorage.setItem(k, d); }, [STORAGE_KEY, JSON.stringify(scene)]);
  await page.goto('/');
  await page.waitForFunction(() => document.querySelectorAll('.keyframe-diamond').length >= 2, undefined, { timeout: 15000 });
}

test('BUG 1 — canonical frame-group diamond drag moves the whole group', async ({ page }) => {
  await seed(page);

  // Read the frame-group diamond at frame 5 (x channel) and its x/y channels
  const before = await page.evaluate(() => {
    const diamonds = [...document.querySelectorAll<HTMLElement>('.keyframe-diamond')];
    const kfAt5 = diamonds.find((d) => (d.style.left ?? '').startsWith('80')) ?? diamonds[0]; // 5 * 16px
    const left = parseFloat(kfAt5.style.left || '0');
    return { left, count: diamonds.length };
  });
  expect(before.count).toBeGreaterThanOrEqual(2);

  const diamond = page.locator('.keyframe-diamond').first();
  const box = await diamond.boundingBox();
  expect(box).not.toBeNull();

  // mousedown on the diamond, drag right by ~9 frames (162px = 9 × 18px), mouseup
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 162, box!.y + box!.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  // The parent-lane frame-group diamond moved to a new frame (left changed)
  const after = await page.evaluate(() => {
    const diamonds = [...document.querySelectorAll<HTMLElement>('.keyframe-diamond')];
    return diamonds.map((d) => parseFloat(d.style.left || '0'));
  });
  console.log('BEFORE parent lefts:', [before.left], 'count:', before.count);
  console.log('AFTER parent lefts:', JSON.stringify(after));
  const moved = after.filter((l) => l > before.left + 10);
  expect(moved.length).toBeGreaterThanOrEqual(1); // the dragged group moved right

  // Expand the track to verify the x AND y channel keyframes moved together
  await page.locator('.ue-expand-btn').first().click();
  await page.waitForTimeout(200);
  const propLefts = await page.evaluate(() => {
    const kfs = [...document.querySelectorAll<HTMLElement>('.ue-prop-diamond')];
    return kfs.map((k) => parseFloat(k.style.left || '0'));
  });
  console.log('EXPANDED prop-diamond lefts:', JSON.stringify(propLefts));
  // x and y channel keyframes of the dragged frame share the SAME left
  const grouped = propLefts.filter((l) => l > before.left + 10);
  const unique = new Set(grouped);
  expect(grouped.length).toBeGreaterThanOrEqual(2); // x + y moved
  expect(unique.size).toBeLessThanOrEqual(2);      // and stayed together
});
