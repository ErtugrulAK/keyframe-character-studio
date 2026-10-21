import { test, expect, type Page } from '@playwright/test';

/**
 * V1 — visual-diff foundation (@visual, opt-in).
 *
 * Scope rule for this harness: ONE deterministic seed document, TWO stable
 * regions, strict thresholds, and NO dynamic surfaces (no timestamps, no
 * autosave text, no hover states, no transitions in frame). Adding a region
 * here requires it to pass the determinism checklist in
 * docs/KCS_VISUAL_QA.md first.
 *
 * Baselines live per-platform (see snapshotPathTemplate in
 * playwright.config.ts): a Windows baseline is never asserted on Linux.
 * Regenerate intentionally:
 *   npm run qa:visual -- --update-snapshots
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

/** The single deterministic document: three static layers, two X keys, no procedural motion. */
async function seedVisualScene(page: Page): Promise<void> {
  const layer = (id: string, name: string, x: number, fill: string) => ({
    id, name, type: 'custom_rect', x, y: 0, rotation: 0, scaleX: 1, scaleY: 1,
    opacity: 1, visible: true, zIndex: 1, fillColor: fill, strokeColor: '#101218',
    fillEnabled: true, strokeEnabled: false, width: 120, height: 90,
  });
  const track = {
    id: 'track-a', partId: 'a', name: 'A', color: '#22d3ee', visible: true, locked: false, expanded: true,
    channels: {
      x: [
        { id: 'k1', frame: 0, value: -300, easing: 'linear' },
        { id: 'k2', frame: 60, value: 300, easing: 'linear' },
      ],
      y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
      trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
    },
  };
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1',
    width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [layer('a', 'Alpha', -300, '#22d3ee'), layer('b', 'Beta', 0, '#f59e0b'), layer('c', 'Gamma', 300, '#a78bfa')],
    tracks: [track],
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript((payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value), { key: STORAGE_KEY, value: scene });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

/** Determinism gate applied before every pixel comparison. */
async function settleForCapture(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Web fonts materially change glyph pixels; wait for the real face set.
  await page.evaluate(() => document.fonts.ready);
  // The seeded document is fully applied: all three layers render.
  await expect(page.locator('.actor-node')).toHaveCount(3);
  // Freeze the authored start frame — no playback clock in any capture.
  await page.keyboard.press('Home');
  // V6: layout-settled replaces the fixed 120 ms margin — both capture
  // regions must measure identical across two consecutive animation frames
  // (a real stability predicate, not a hidden delay).
  await page.waitForFunction(() => {
    const measure = () => {
      const ruler = document.querySelector('.time-ruler')?.getBoundingClientRect();
      const rail = document.querySelector('.left-sidebar-nav')?.getBoundingClientRect();
      return ruler && rail ? [ruler.width, ruler.height, rail.width, rail.height].join('|') : null;
    };
    const first = measure();
    if (!first) return false;
    return new Promise<boolean>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve(measure() === first));
      });
    });
  }, undefined, { timeout: 15000 });
}

test.describe('@visual — stable region baselines', () => {
  test.beforeEach(async ({ page }) => {
    await seedVisualScene(page);
    await settleForCapture(page);
  });

  test('@visual ruler strip renders the seeded 60-frame timeline', async ({ page }) => {
    await expect(page.locator('.time-ruler')).toHaveScreenshot('time-ruler.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.001,
    });
  });

  test('@visual left rail renders the icon column', async ({ page }) => {
    await expect(page.locator('.left-sidebar-nav')).toHaveScreenshot('left-rail.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.001,
    });
  });
});
