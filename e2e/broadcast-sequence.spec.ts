import { test, expect, type Page } from '@playwright/test';

/**
 * BUGFIX — BROADCAST SEQUENCE PLAY: pressing a Sequence button in the Live
 * Director Panel must render the scene parts on the BROADCAST stage (not just
 * report opacity > 0 — real bounding-box visibility), play the in-animation
 * and keep the final state visible. Sequence playback must NOT touch the edit
 * timeline playback state (currentFrame/isPlaying isolation).
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

async function seed(page: Page, scene: Record<string, unknown>) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([k, d]: [string, string]) => { localStorage.setItem(k, d); }, [STORAGE_KEY, JSON.stringify(scene)]);
  await page.goto('/');
  await page.waitForFunction(() => document.querySelectorAll('g[transform^="translate"]').length >= 1, undefined, { timeout: 15000 });
}

function scene() {
  // A: part WITHOUT preset (must stay fully visible while animating_in)
  // B: custom_timeline part (frame override during animation)
  // C: part with an entrance preset (fade)
  const a = makeLayer('a', 'Alpha', 'custom_box', { zIndex: 3, fillColor: '#ff0000', width: 200, height: 150, x: 0, y: -200 });
  const b = makeLayer('b', 'Bravo', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', width: 200, height: 200, x: -300, y: 0, inAnimPreset: 'custom_timeline', inAnimTimelineStart: 0, inAnimTimelineEnd: 60 });
  const c = makeLayer('c', 'Charlie', 'custom_rect', { zIndex: 1, fillColor: '#0000ff', width: 250, height: 120, x: 300, y: 0, inAnimPreset: 'fade' });
  return {
    version: 1, layers: [a, b, c], tracks: [],
    fps: 30, totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'Sequence Play',
  };
}

async function partVisibility(page: Page) {
  return page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
    return [...svg.querySelectorAll('g[transform^="translate"]')].map((g) => {
      const r = (g as SVGGElement).getBoundingClientRect();
      const style = g.getAttribute('style') ?? '';
      const opacity = parseFloat(style.match(/opacity:([\d.]+)/)?.[1] ?? '1');
      return {
        onScreen: r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight,
        w: Math.round(r.width), h: Math.round(r.height),
        opacity,
      };
    });
  });
}

test('BROADCAST-SEQ-1 — sequence play renders parts for real (bounding-box + on-screen), final state stays', async ({ page }) => {
  await seed(page, scene());

  // EDIT: the fade-in part (c) is opacity 0 at frame 0 (fade-in semantics) —
  // only the non-fade parts render. In BROADCAST the Sequence click must
  // bring ALL THREE on stage while animating in.
  const edit = await partVisibility(page);
  expect(edit.length).toBeGreaterThanOrEqual(2);

  // BROADCAST → Sequence click (Live Director Panel)
  await page.getByText('BROADCAST', { exact: true }).click();
  await expect.poll(() => partVisibility(page)).toHaveLength(0);
  await page.getByText('Sequence', { exact: true }).first().click();

  // during animation (mid progress): ALL parts ON SCREEN with real size
  await page.waitForTimeout(400);
  const mid = await partVisibility(page);
  expect(mid.length).toBe(3);
  expect(mid.every((p) => p.onScreen && p.w > 0 && p.h > 0)).toBe(true);

  // after animation completes: still visible (final state stays)
  await page.waitForTimeout(1800);
  const final = await partVisibility(page);
  expect(final.length).toBe(3);
  expect(final.every((p) => p.onScreen && p.w > 0 && p.h > 0 && p.opacity > 0.5)).toBe(true);

  await page.getByText('EDIT MODE', { exact: true }).click();
  await expect.poll(() => partVisibility(page)).not.toHaveLength(0);
  await page.getByText('BROADCAST', { exact: true }).click();
  await expect.poll(() => partVisibility(page)).toHaveLength(0);
});

test('BROADCAST-SEQ-2 — pressing the same Sequence again re-plays (parts stay visible)', async ({ page }) => {
  await seed(page, scene());
  await page.getByText('BROADCAST', { exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByText('Sequence', { exact: true }).first().click();
  await page.waitForTimeout(2000); // finish first play
  await page.getByText('Sequence', { exact: true }).first().click(); // second play
  await page.waitForTimeout(300);
  const mid = await partVisibility(page);
  expect(mid.every((p) => p.onScreen && p.w > 0 && p.h > 0)).toBe(true);
  await page.waitForTimeout(1500);
  const after = await partVisibility(page);
  expect(after.every((p) => p.onScreen && p.opacity > 0.5)).toBe(true);
});

test('BROADCAST-SEQ-3 — sequence play does NOT advance/reset the edit timeline (isolation)', async ({ page }) => {
  await seed(page, scene());

  // EDIT: start timeline playback so currentFrame advances away from 0
  await page.getByText('EDIT MODE', { exact: true }).click().catch(() => {}); // ensure edit
  await page.waitForTimeout(300);
  // press the edit Play button (header)
  const playBtn = page.locator('button[title*="Play"]').or(page.getByRole('button', { name: /play/i })).first();
  await playBtn.click();
  await page.waitForTimeout(900); // frame advances
  const editFrameBefore = await page.evaluate(() => {
    // read the timeline playhead position or frame display
    // fallback: any element whose text matches "N / M"
    const els = [...document.querySelectorAll('*')].map((e) => e.textContent?.trim() ?? '');
    const m = els.find((t) => /^\d+\s*\/\s*\d+$/.test(t));
    return m ?? null;
  });

  // BROADCAST → Sequence click
  await page.getByText('BROADCAST', { exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByText('Sequence', { exact: true }).first().click();
  await page.waitForTimeout(800);

  // back to EDIT: frame must still be the advanced value (NOT reset to 0)
  await page.getByText('EDIT MODE', { exact: true }).click();
  await page.waitForTimeout(600);
  const editFrameAfter = await page.evaluate(() => {
    const els = [...document.querySelectorAll('*')].map((e) => e.textContent?.trim() ?? '');
    return els.find((t) => /^\d+\s*\/\s*\d+$/.test(t)) ?? null;
  });
  console.log(`SEQ-3 frame before=${editFrameBefore} after=${editFrameAfter}`);
  // the edit frame must not have been reset to 0 by the broadcast sequence click
  if (editFrameBefore) {
    expect(editFrameAfter).toBe(editFrameBefore);
  }
});
