import { test, expect, type Page } from '@playwright/test';

/**
 * Manual QA Round 4 — R4-03: the timeline keyframe gesture is a POINTER gesture.
 *
 * Observed: a multi-keyframe drag did not stop on release — the keys kept
 * following the pointer until a second click. Expected: the release ends the
 * gesture immediately, so moving the pointer afterwards moves nothing, and the
 * whole selection travels together while the button is held.
 *
 * Runs the real editor DOM (dev server + localStorage seed).
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function makeLayer(id: string, name: string, type: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    name,
    type,
    zIndex: 1,
    pivot: { x: 0, y: 0 },
    anchor: 'none',
    fillColor: '#ff0000',
    strokeColor: '#101218',
    baseTransform: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    ...overrides,
  };
}

async function seed(page: Page) {
  const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00' });
  const scene = {
    version: 1,
    layers: [target],
    tracks: [
      {
        id: 't_tgt',
        partId: 'tgt',
        name: 'Target',
        color: '#3b82f6',
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
    ],
    fps: 30,
    totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'Gesture Spike',
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([key, data]: [string, string]) => { localStorage.setItem(key, data); }, [STORAGE_KEY, JSON.stringify(scene)]);
  await page.goto('/');
  await page.waitForFunction(() => document.querySelectorAll('.keyframe-diamond').length >= 2, undefined, { timeout: 15000 });
}

/** The frame position of every keyframe diamond the user can see. */
const diamondLefts = (page: Page): Promise<number[]> => page.evaluate(() => (
  [...document.querySelectorAll<HTMLElement>('.keyframe-diamond')].map((diamond) => parseFloat(diamond.style.left || '0'))
));

const selectedLefts = (page: Page): Promise<number[]> => page.evaluate(() => (
  [...document.querySelectorAll<HTMLElement>('.keyframe-diamond.selected')].map((diamond) => parseFloat(diamond.style.left || '0'))
));

test('R4-03 — the selected keyframes travel together and stop at the release', async ({ page }) => {
  await seed(page);

  const diamonds = page.locator('.keyframe-diamond');
  const first = diamonds.first();
  const last = diamonds.last();
  const firstBox = (await first.boundingBox())!;
  const lastBox = (await last.boundingBox())!;

  // Two keyframes selected: a plain click, then a Shift-click folds the second in.
  await page.mouse.click(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.click(lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height / 2);
  await page.keyboard.up('Shift');
  const before = await selectedLefts(page);
  expect(before).toHaveLength(2);

  // Drag the FIRST diamond: the whole selection moves by the same delta.
  const grabBox = (await first.boundingBox())!;
  const grabX = grabBox.x + grabBox.width / 2;
  const grabY = grabBox.y + grabBox.height / 2;
  await page.mouse.move(grabX, grabY);
  await page.mouse.down();
  await page.mouse.move(grabX + 54, grabY, { steps: 6 });
  await page.mouse.up();

  const afterDrag = await selectedLefts(page);
  expect(afterDrag).toHaveLength(2);
  // Both selected keyframes moved by the SAME pointer delta: one set, one gesture.
  const movedBy = afterDrag.map((left, index) => left - before[index]);
  expect(movedBy[0]).not.toBe(0);
  expect(movedBy[0]).toBe(movedBy[1]);

  // The gesture is over: moving the pointer with no button held must move NOTHING.
  await page.mouse.move(grabX + 400, grabY, { steps: 12 });
  await page.mouse.move(grabX - 200, grabY + 40, { steps: 12 });
  expect(await selectedLefts(page)).toEqual(afterDrag);
  expect(await diamondLefts(page)).toHaveLength(2);

  // And a click still selects exactly the keyframe under the pointer.
  const movedBox = (await first.boundingBox())!;
  await page.mouse.click(movedBox.x + movedBox.width / 2, movedBox.y + movedBox.height / 2);
  expect(await selectedLefts(page)).toHaveLength(1);
});
