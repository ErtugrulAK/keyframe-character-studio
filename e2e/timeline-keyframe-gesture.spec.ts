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

/**
 * Manual QA Round 5 — R5-05: a keyframe drag moves KEYFRAMES, never the playhead.
 *
 * Observed: the playhead jumped to the frame where a multi-key drag was
 * released. Expected: the authoring cursor is identical before, during and
 * after every drag, whether the key is released before or after the playhead,
 * and whether one key or a whole selection travels.
 */
const playheadFrame = (page: Page): Promise<string | null> => page.locator('.playhead-line').getAttribute('data-frame');

test('R5-05 — no keyframe drag moves the playhead', async ({ page }) => {
  await seed(page);

  // The timeline's own frame mapping, read from the two seeded keys (frames 5 and 30).
  const frameWidth = await page.evaluate(() => {
    const lefts = [...document.querySelectorAll<HTMLElement>('.keyframe-diamond')]
      .map((diamond) => parseFloat(diamond.style.left || '0'));
    return (Math.max(...lefts) - Math.min(...lefts)) / 25;
  });

  // Put the authoring cursor BETWEEN the two keys — frame 18, through the ruler's
  // own scrub contract (the one gesture that owns the frame cursor).
  await page.locator('.time-ruler').click({ position: { x: 18 * frameWidth + 2, y: 10 } });
  expect(await playheadFrame(page)).toBe('18');

  // SINGLE key: drag the key at frame 30 to frame 12 — released BEFORE the playhead.
  const singleBox = (await page.locator('.keyframe-diamond').last().boundingBox())!;
  const singleX = singleBox.x + singleBox.width / 2;
  const singleY = singleBox.y + singleBox.height / 2;
  const beforeSingle = await diamondLefts(page);
  await page.mouse.move(singleX, singleY);
  await page.mouse.down();
  await page.mouse.move(singleX - 18 * frameWidth, singleY, { steps: 8 });
  expect(await playheadFrame(page), 'the single-key drag itself moved the playhead').toBe('18');
  await page.mouse.up();
  expect(await playheadFrame(page), 'the single-key release moved the playhead').toBe('18');
  const afterSingle = await diamondLefts(page);
  expect(afterSingle[1]).toBeLessThan(beforeSingle[1]);
  expect(await selectedLefts(page)).toHaveLength(1);

  // The release ended the gesture: moving the pointer afterwards changes nothing.
  await page.mouse.move(singleX + 320, singleY + 30, { steps: 10 });
  await page.mouse.move(singleX - 260, singleY - 20, { steps: 10 });
  expect(await diamondLefts(page)).toEqual(afterSingle);
  expect(await playheadFrame(page)).toBe('18');

  // MULTI key: select both keys, then drag the selection ACROSS the playhead and
  // release AFTER it (frames 5/12 → 14/21 at nine frames' travel).
  const diamonds = page.locator('.keyframe-diamond');
  const firstBox = (await diamonds.nth(0).boundingBox())!;
  await page.mouse.click(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  const lastBox = (await diamonds.nth(1).boundingBox())!;
  await page.keyboard.down('Shift');
  await page.mouse.click(lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height / 2);
  await page.keyboard.up('Shift');
  const beforeMulti = await diamondLefts(page);
  expect(await selectedLefts(page)).toHaveLength(2);
  // Selecting the two keys by click leaves the cursor on the last clicked key —
  // put it back between them, so the drag below really crosses the playhead.
  await page.locator('.time-ruler').click({ position: { x: 18 * frameWidth + 2, y: 10 } });
  expect(await playheadFrame(page)).toBe('18');
  expect(await selectedLefts(page)).toHaveLength(2);

  const multiBox = (await diamonds.nth(0).boundingBox())!;
  const multiX = multiBox.x + multiBox.width / 2;
  const multiY = multiBox.y + multiBox.height / 2;
  await page.mouse.move(multiX, multiY);
  await page.mouse.down();
  await page.mouse.move(multiX + 9 * frameWidth, multiY, { steps: 10 });
  const duringMulti = await diamondLefts(page);
  expect(duringMulti[0]).toBeGreaterThan(beforeMulti[0]);
  expect(duringMulti[1]).toBeGreaterThan(beforeMulti[1]);
  expect(await playheadFrame(page), 'the multi-key drag moved the playhead').toBe('18');
  await page.mouse.up();
  const afterMulti = await diamondLefts(page);
  expect(await playheadFrame(page), 'the multi-key release moved the playhead').toBe('18');

  // One set, one gesture: both keys moved by the same pointer delta, and they
  // ended up on both sides of the playhead (the drag really crossed it).
  const movedBy = afterMulti.map((left, index) => left - beforeMulti[index]);
  expect(movedBy[0]).toBeGreaterThan(0);
  expect(movedBy[0]).toBe(movedBy[1]);
  expect(afterMulti[0]).toBeLessThan(18 * frameWidth);
  expect(afterMulti[1]).toBeGreaterThan(18 * frameWidth);

  // And moving the pointer with no button held still changes nothing.
  await page.mouse.move(multiX + 300, multiY + 30, { steps: 10 });
  expect(await diamondLefts(page)).toEqual(afterMulti);
  expect(await playheadFrame(page)).toBe('18');

  // ONE drag is ONE history entry — and Undo restores the keys, not the cursor.
  await page.keyboard.press('Control+z');
  expect(await diamondLefts(page)).toEqual(beforeMulti);
  expect(await playheadFrame(page)).toBe('18');
});
