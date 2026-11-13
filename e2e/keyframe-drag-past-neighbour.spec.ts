import { test, expect, type Page } from '@playwright/test';

/**
 * Manual QA (rc.6 round 2, item 14): two selected keys dragged right stalled
 * the moment the leading one passed the next key, and had to be grabbed again.
 * One drag must carry the selection past an unselected key.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

async function seed(page: Page) {
  const layer = {
    id: 'tgt', name: 'Target', type: 'custom_circle',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1, fillColor: '#00ff00', strokeColor: '#101218', strokeWidth: 2,
    width: 60, height: 60,
  };
  const scene = {
    version: 1,
    layers: [layer],
    tracks: [{
      id: 't_tgt', partId: 'tgt', name: 'Target', color: '#3b82f6',
      channels: {
        x: [10, 20, 30, 40, 50].map((frame, index) => ({ id: `k${index + 1}`, frame, value: index * 50, easing: 'linear' })),
      },
    }],
    fps: 30,
    totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'Drag past',
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([key, data]: [string, string]) => { localStorage.setItem(key, data); }, [STORAGE_KEY, JSON.stringify(scene)]);
  await page.goto('/');
  await page.waitForFunction(() => document.querySelectorAll('.keyframe-diamond').length >= 5, undefined, { timeout: 15000 });
}

const lefts = (page: Page): Promise<number[]> => page.evaluate(() => (
  [...document.querySelectorAll<HTMLElement>('.keyframe-diamond')].map((diamond) => parseFloat(diamond.style.left || '0')).sort((a, b) => a - b)
));

const selectedLefts = (page: Page): Promise<number[]> => page.evaluate(() => (
  [...document.querySelectorAll<HTMLElement>('.keyframe-diamond.selected')].map((diamond) => parseFloat(diamond.style.left || '0')).sort((a, b) => a - b)
));

test('one drag carries two selected keys past the next key', async ({ page }) => {
  await seed(page);
  const start = await lefts(page);
  const frameWidth = (start[4] - start[0]) / 40;

  const centreOf = (left: number) => page.evaluate((target) => {
    const hit = [...document.querySelectorAll<HTMLElement>('.keyframe-diamond')]
      .find((diamond) => Math.abs(parseFloat(diamond.style.left || '0') - target) < 0.5)!;
    const rect = hit.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, left);

  // Keys 2 and 3 selected (frames 20 and 30).
  const second = await centreOf(start[1]);
  const third = await centreOf(start[2]);
  await page.mouse.click(second.x, second.y);
  await page.keyboard.down('Shift');
  await page.mouse.click(third.x, third.y);
  await page.keyboard.up('Shift');
  expect(await selectedLefts(page)).toEqual([start[1], start[2]]);

  // Drag key 3 right by 15 frames in small steps: it crosses key 4 (frame 40).
  await page.mouse.move(third.x, third.y);
  await page.mouse.down();
  await page.mouse.move(third.x + 15 * frameWidth, third.y, { steps: 30 });
  await page.mouse.up();

  // The selection followed the pointer all the way: frames 35 and 45.
  const moved = await selectedLefts(page);
  expect(moved.map((left) => Math.round((left - start[0]) / frameWidth) + 10)).toEqual([35, 45]);
  // The unselected keys did not move.
  const all = await lefts(page);
  for (const frame of [10, 40, 50]) {
    expect(all.some((left) => Math.abs(left - (start[0] + (frame - 10) * frameWidth)) < 0.5)).toBe(true);
  }
});
