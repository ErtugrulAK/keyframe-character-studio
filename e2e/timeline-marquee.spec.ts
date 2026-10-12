import { test, expect, type Page } from '@playwright/test';

/**
 * R2-10 / R2-12 — timeline marquee (box) keyframe selection.
 *
 * Dragging a rectangle on empty timeline space selects the keys whose CENTRES
 * fall inside it, across channels and across layers, through the one keyframe
 * selection authority. A plain marquee replaces the selection, Shift adds to it,
 * Escape cancels the gesture and restores the selection it started from, and a
 * press without a drag on empty space clears the selection. None of this may
 * hijack a keyframe drag, the playhead, a divider or a scrollbar.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function layer(id: string, name: string, x: number, y: number, zIndex: number): Record<string, unknown> {
  return {
    id, name, type: 'custom_rect',
    x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex,
    fillColor: '#22d3ee', strokeColor: '#101218',
    fillEnabled: true, strokeEnabled: false, width: 160, height: 120,
  };
}

/** Frames 5 / 20 / 40 on the x channel of both layers. */
const KEYFRAME_FRAMES = [5, 20, 40];

async function seed(page: Page): Promise<void> {
  const layers = [layer('a', 'Alpha', -120, -60, 2), layer('b', 'Beta', 140, 90, 1)];
  const tracks = layers.map((entry) => ({
    id: `t_${entry.id}`,
    partId: entry.id,
    name: entry.name,
    color: entry.id === 'a' ? '#ef4444' : '#22c55e',
    visible: true,
    locked: false,
    channels: {
      x: KEYFRAME_FRAMES.map((frame) => ({ id: `${entry.id}_x_${frame}`, frame, value: frame * 2, easing: 'linear' })),
    },
  }));
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1',
    width: 1920, height: 1080, fps: 30, totalFrames: 90,
    layers, tracks,
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: scene },
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  // Two collapsed layers: one frame-group diamond per key, and a lane stack
  // short enough to sit entirely inside the panel.
  await expect(page.locator('.ue-track-row')).toHaveCount(2);
  await expect(page.locator('.keyframe-diamond')).toHaveCount(KEYFRAME_FRAMES.length * 2);
}

/** The timeline's px-per-frame, read from two rendered keyframe positions. */
async function frameWidth(page: Page): Promise<number> {
  return page.evaluate(() => {
    // One left per frame: the two layers repeat the same frames.
    const leftByFrame = new Map<number, number>();
    for (const element of document.querySelectorAll<HTMLElement>('.keyframe-diamond')) {
      const frame = Number(element.getAttribute('title')?.match(/Frame:\s*(\d+)/u)?.[1]);
      if (Number.isFinite(frame) && !leftByFrame.has(frame)) leftByFrame.set(frame, parseFloat(element.style.left || '0'));
    }
    const [first, second] = [...leftByFrame.entries()].sort((a, b) => a[0] - b[0]);
    return (second[1] - first[1]) / (second[0] - first[0]);
  });
}

/** The grid's client x for a frame column, at the current scroll position. */
async function frameColumnX(page: Page, frame: number): Promise<number> {
  const grid = page.locator('.timeline-grid-container');
  const box = (await grid.boundingBox())!;
  const scrollLeft = await grid.evaluate((node) => node.scrollLeft);
  return box.x + frame * (await frameWidth(page)) - scrollLeft;
}

/**
 * The grid's visible selection band: below the sticky ruler, above the bottom
 * edge. The lane stack can be taller than the panel and the panel can be
 * scrolled, so a gesture has to be anchored to what is actually on screen.
 */
async function marqueeBand(page: Page): Promise<{ top: number; bottom: number }> {
  return page.locator('.timeline-grid-container').evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { top: box.top + 32, bottom: box.top + node.clientHeight - 6 };
  });
}

/** The ids behind the selected markers of the given class. */
const selectedIds = (page: Page, selector = '.keyframe-diamond.selected') => page.evaluate(
  (sel) => [...document.querySelectorAll<HTMLElement>(sel)].map((element) => element.dataset.keyframeId as string).sort(),
  selector,
);

const marquee = (page: Page) => page.locator('[data-testid="timeline-marquee"]');

/** Drag a rectangle from an empty frame column through `toFrame`, over every lane. */
async function dragMarquee(page: Page, fromFrame: number, toFrame: number, modifiers: Array<'Shift'> = []): Promise<void> {
  const band = await marqueeBand(page);
  const startX = (await frameColumnX(page, fromFrame)) + 3;
  const endX = (await frameColumnX(page, toFrame)) + 3;
  // The modifier must be held BEFORE the press: the gesture reads it at
  // pointerdown to decide whether it replaces or adds to the selection.
  for (const modifier of modifiers) await page.keyboard.down(modifier);
  await page.mouse.move(startX, band.top);
  await page.mouse.down();
  await page.mouse.move(endX, band.bottom, { steps: 8 });
  await expect(marquee(page)).toBeVisible();
  for (const modifier of modifiers) await page.keyboard.up(modifier);
}

test('a marquee selects the keys whose centres fall inside it, across layers', async ({ page }) => {
  await seed(page);

  // Frames 15→25 contain exactly the keys at frame 20, one per layer.
  await dragMarquee(page, 15, 25);
  expect(await selectedIds(page)).toEqual(['a_x_20', 'b_x_20']);
  // The keys outside the rectangle stay unselected.
  await expect(page.locator('.keyframe-diamond.selected[data-keyframe-id="a_x_5"]')).toHaveCount(0);
  await expect(page.locator('.keyframe-diamond.selected[data-keyframe-id="b_x_40"]')).toHaveCount(0);

  await page.mouse.up();
  await expect(marquee(page)).toHaveCount(0);
  // The commit survives the gesture.
  expect(await selectedIds(page)).toEqual(['a_x_20', 'b_x_20']);
});

test('a marquee reaches the channel lanes of an expanded layer', async ({ page }) => {
  await seed(page);
  await page.locator('.ue-expand-btn').first().click();
  await expect(page.locator('.ue-prop-diamond')).toHaveCount(KEYFRAME_FRAMES.length);
  await page.locator('.timeline-grid-container').evaluate((node) => { node.scrollTop = 0; });

  await dragMarquee(page, 15, 25);
  await page.mouse.up();

  // The frame-group diamond AND its per-channel key on the x lane are selected.
  expect(await selectedIds(page, '.ue-prop-diamond.selected')).toEqual(['a_x_20']);
  expect(await selectedIds(page)).toEqual(['a_x_20']);
  // The other layer's key is outside this marquee's lanes.
  await expect(page.locator('.keyframe-diamond.selected[data-keyframe-id="b_x_20"]')).toHaveCount(0);
});

test('a plain marquee replaces the previous selection and Shift adds to it', async ({ page }) => {
  await seed(page);

  await page.locator('.keyframe-diamond[data-keyframe-id="a_x_5"]').click();
  expect(await selectedIds(page)).toEqual(['a_x_5']);

  // Replace: the earlier key is gone, only the frame 20 keys remain.
  await dragMarquee(page, 15, 25);
  await page.mouse.up();
  expect(await selectedIds(page)).toEqual(['a_x_20', 'b_x_20']);

  // Shift-add: frames 35→45 add the frame 40 keys and keep the frame 20 ones.
  await dragMarquee(page, 35, 45, ['Shift']);
  await page.mouse.up();
  expect(await selectedIds(page)).toEqual(['a_x_20', 'a_x_40', 'b_x_20', 'b_x_40']);
});

test('Escape cancels an active marquee and restores the pre-gesture selection', async ({ page }) => {
  await seed(page);

  await page.locator('.keyframe-diamond[data-keyframe-id="b_x_40"]').click();
  expect(await selectedIds(page)).toEqual(['b_x_40']);

  await dragMarquee(page, 15, 25);
  // The live preview already shows what the rectangle covers...
  expect(await selectedIds(page)).toEqual(['a_x_20', 'b_x_20']);

  await page.keyboard.press('Escape');
  await expect(marquee(page)).toHaveCount(0);
  // ...and Escape puts back exactly what was selected before the gesture.
  expect(await selectedIds(page)).toEqual(['b_x_40']);

  // The finished gesture no longer reacts to the mouse.
  await page.mouse.up();
  expect(await selectedIds(page)).toEqual(['b_x_40']);
});

test('a press on empty space without a drag clears the keyframe selection', async ({ page }) => {
  await seed(page);

  await page.locator('.keyframe-diamond[data-keyframe-id="a_x_20"]').click();
  expect(await selectedIds(page)).toEqual(['a_x_20']);

  const band = await marqueeBand(page);
  await page.mouse.click((await frameColumnX(page, 15)) + 3, (band.top + band.bottom) / 2);
  expect(await selectedIds(page)).toEqual([]);
  await expect(marquee(page)).toHaveCount(0);
});

test('a drag that starts on a keyframe moves the key instead of opening a marquee', async ({ page }) => {
  await seed(page);

  const diamond = page.locator('.keyframe-diamond[data-keyframe-id="a_x_20"]');
  const width = await frameWidth(page);
  const before = await diamond.evaluate((node) => parseFloat(node.style.left || '0'));
  const box = (await diamond.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 2 * width, box.y + box.height / 2, { steps: 6 });

  await expect(marquee(page)).toHaveCount(0);

  await page.mouse.up();
  const after = await diamond.evaluate((node) => parseFloat(node.style.left || '0'));
  expect(after).toBeCloseTo(before + 2 * width, 0);
  await expect(diamond).toHaveAttribute('title', /Frame: 22/u);
});
