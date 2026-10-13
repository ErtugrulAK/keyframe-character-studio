import { test, expect, type Page } from '@playwright/test';

/**
 * Manual QA Round 4 — R4-08: a keyframe marker is a TRUE hollow diamond.
 *
 * Observed: the interpolation connector ran through the middle of an unselected
 * key, so a hollow keyframe read as a filled one. Expected: the connector is
 * drawn as one segment per gap and stops short of every glyph, the glyph stays
 * the same compact 8px inside its 18px hit target (the outline is never enlarged
 * to hide the line), unselected stays hollow, selected is filled, and a lane with
 * several keys reads cleanly.
 *
 * The geometry is read from the painted DOM, exactly as the user sees it.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
/** The panned grid's px-per-frame at its default zoom, mirrored from `useTimeline`. */
const FRAME_WIDTH = 18;
/** The frame the hollow/selected state test uses for its empty-space click. */
const EMPTY_FRAME = 35;

async function seed(page: Page, frames: number[]): Promise<void> {
  const keyframes = frames.map((frame, index) => ({ id: `kx${index}`, frame, value: index * 20, easing: 'linear' }));
  const scene = {
    version: 1,
    layers: [{
      id: 'tgt',
      name: 'Target',
      type: 'custom_rect',
      zIndex: 1,
      pivot: { x: 0, y: 0 },
      anchor: 'none',
      fillColor: '#22d3ee',
      strokeColor: '#101218',
      fillEnabled: true,
      strokeEnabled: false,
      width: 160,
      height: 120,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    }],
    tracks: [{
      id: 't_tgt',
      partId: 'tgt',
      name: 'Target',
      color: '#3b82f6',
      visible: true,
      locked: false,
      channels: { x: keyframes },
    }],
    fps: 30,
    totalFrames: 60,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'Glyph Spike',
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    ([key, data]: [string, string]) => { localStorage.setItem(key, data); },
    [STORAGE_KEY, JSON.stringify(scene)],
  );
  await page.goto('/');
  await page.waitForFunction(() => document.querySelectorAll('.keyframe-diamond').length >= 1, undefined, { timeout: 15000 });
  await page.locator('.actor-node', { hasText: 'Target' }).first().click();
}

interface GlyphBox { left: number; right: number; top: number; bottom: number; cx: number; cy: number }
interface SegmentBox { left: number; right: number; centreY: number }

/** The painted connector segments and glyph boxes of one lane. */
function laneGeometry(page: Page, laneSelector: string): Promise<{ segments: SegmentBox[]; glyphs: GlyphBox[] }> {
  return page.evaluate((selector) => {
    const lane = document.querySelector(selector);
    if (!lane) throw new Error(`${selector} is missing`);
    const segments = [...lane.querySelectorAll<HTMLElement>('.ue-trajectory-line')].map((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, centreY: rect.top + rect.height / 2 };
    });
    const glyphs = [...lane.querySelectorAll<HTMLElement>('.diamond-glyph')].map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
      };
    });
    return { segments, glyphs };
  }, laneSelector);
}

/** Every glyph whose interior a connector segment paints through. */
function crossings(segments: SegmentBox[], glyphs: GlyphBox[]): number {
  return glyphs.filter((glyph) => segments.some((segment) => (
    glyph.cx > segment.left
    && glyph.cx < segment.right
    && Math.abs(segment.centreY - glyph.cy) < glyph.bottom - glyph.cy
  ))).length;
}

/** The glyph's own painted box, untransformed: the compact size the user sees. */
const glyphStyle = (page: Page) => page.evaluate(() => {
  const glyph = document.querySelector<HTMLElement>('.keyframe-diamond .diamond-glyph');
  const diamond = document.querySelector<HTMLElement>('.keyframe-diamond');
  if (!glyph || !diamond) throw new Error('no glyph painted');
  const style = getComputedStyle(glyph);
  return {
    width: style.width,
    height: style.height,
    background: style.backgroundColor,
    hitWidth: getComputedStyle(diamond).width,
    hitHeight: getComputedStyle(diamond).height,
  };
});

test('R4-08 — the connector never crosses a hollow keyframe, and the glyph never grows', async ({ page }) => {
  // Two keys close together (2 frames) and two far apart, so both the wide and
  // the narrow gap are on screen.
  await seed(page, [5, 7, 40]);

  for (const lane of ['.ue-track-lane', '.ue-channel-lane']) {
    if (lane === '.ue-channel-lane') {
      await page.locator('.ue-track-row').first().locator('.ue-expand-btn').click();
      await expect(page.locator('.ue-channel-lane').first()).toBeVisible();
    }
    const geometry = await laneGeometry(page, lane);
    expect(geometry.glyphs.length, `${lane}: no keyframes painted`).toBe(3);
    expect(geometry.segments.length, `${lane}: the two gaps own one segment each`).toBe(2);
    expect(crossings(geometry.segments, geometry.glyphs), `${lane}: a connector crosses a keyframe interior`).toBe(0);
    // Each segment sits strictly between its two neighbours: it starts after the
    // left glyph's centre and ends before the right one's.
    const ordered = [...geometry.glyphs].sort((a, b) => a.cx - b.cx);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const gapSegments = geometry.segments.filter((segment) => segment.left > ordered[index].cx && segment.right < ordered[index + 1].cx);
      expect(gapSegments, `${lane}: gap ${index} has no cleared connector`).toHaveLength(1);
    }
  }

  // The marker itself is untouched: an 8px glyph inside an 18px hit target.
  const painted = await glyphStyle(page);
  expect(painted.width).toBe('8px');
  expect(painted.height).toBe('8px');
  expect(painted.hitWidth).toBe('18px');
  expect(painted.hitHeight).toBe('18px');
});

test('R4-08 — unselected is hollow, selected is filled, deselected is hollow again', async ({ page }) => {
  await seed(page, [5, 20, 45]);

  const hollow = await glyphStyle(page);
  expect(hollow.background, 'an unselected keyframe must be hollow').toBe('rgba(0, 0, 0, 0)');

  const first = page.locator('.keyframe-diamond').first();
  const trackColour = await first.evaluate((node) => getComputedStyle(node).color);
  await first.click();
  await expect(page.locator('.keyframe-diamond.selected')).toHaveCount(1);

  // The glyph carries a 120ms background transition, so the fill settles.
  await expect.poll(async () => (await glyphStyle(page)).background).toBe(trackColour);
  const filled = await glyphStyle(page);
  expect(filled.width).toBe('8px');
  expect(filled.height).toBe('8px');

  // A press on empty lane space clears the keyframe selection.
  const lane = await page.locator('.ue-track-lane').first().boundingBox();
  expect(lane).not.toBeNull();
  await page.mouse.click(lane!.x + EMPTY_FRAME * FRAME_WIDTH, lane!.y + lane!.height / 2);
  await expect(page.locator('.keyframe-diamond.selected')).toHaveCount(0);

  await expect.poll(
    async () => (await glyphStyle(page)).background,
    { message: 'a deselected keyframe returns to the hollow state' },
  ).toBe('rgba(0, 0, 0, 0)');
  expect((await glyphStyle(page)).width).toBe('8px');
});

test('R4-08 — several keys on one lane read cleanly', async ({ page }) => {
  // 0 and 2 frames apart are too close to own a visible connector between them
  // (the glyphs are 9px cleared at each end); the wide gaps keep theirs.
  await seed(page, [0, 2, 5, 20, 21, 45]);

  const geometry = await laneGeometry(page, '.ue-track-lane');
  expect(geometry.glyphs.length).toBe(6);
  // Five gaps; the 20→21 gap is one frame wide (18px) and owns no segment.
  expect(geometry.segments.length).toBe(4);
  expect(crossings(geometry.segments, geometry.glyphs)).toBe(0);

  // Every gap that IS wide enough carries exactly one segment.
  const ordered = [...geometry.glyphs].sort((a, b) => a.cx - b.cx);
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const width = ordered[index + 1].cx - ordered[index].cx;
    const gapSegments = geometry.segments.filter((segment) => segment.left > ordered[index].cx && segment.right < ordered[index + 1].cx);
    expect(gapSegments.length, `gap ${index} (${width.toFixed(1)}px wide) miscounted`).toBe(width > 2 * 9 ? 1 : 0);
  }
});
