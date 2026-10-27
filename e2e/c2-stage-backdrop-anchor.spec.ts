/**
 * C2-D — panel and visibility toggles never make the stage appear to slide.
 * The world keeps its screen position (camera policy), AND the dotted backdrop
 * stays locked to it on every rendered frame of the dock transition; before
 * the fix the backdrop was anchored to the container corner and slid under the
 * content while a panel opened or closed.
 */
import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

test('the backdrop and the artboard stay locked together through panel toggles', async ({ page }) => {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [{ id: 'box', name: 'Box', type: 'custom_rect', x: 80, y: -30, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#000', width: 160, height: 90 }],
    tracks: [{ id: 'track-box', partId: 'box', name: 'Box', color: '#22d3ee', visible: true, locked: false, expanded: false, channels: {} }],
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  // A user zoom first: the anchor must hold for a moved camera too.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('canvas-viewport-command', { detail: { type: 'zoom-in' } })));

  const result = await page.evaluate(async () => {
    const container = () => document.querySelector('.stage-canvas-container') as HTMLElement;
    /** Backdrop phase against the artboard centre (0 ≡ 24: locked), and the artboard's screen x. */
    const sample = () => {
      const c = container().getBoundingClientRect();
      const a = document.querySelector('.stage-svg rect.canvas-bg')!.getBoundingClientRect();
      const [px, py] = getComputedStyle(container()).backgroundPosition.split(',')[0].trim().split(' ').map(parseFloat);
      const ax = a.left + a.width / 2;
      const ay = a.top + a.height / 2;
      const phase = (value: number) => { const m = ((value % 24) + 24) % 24; return Math.min(m, 24 - m); };
      return { phaseX: phase(ax - c.left - px), phaseY: phase(ay - c.top - py), artX: ax, artY: ay };
    };
    const runs: { label: string; frames: number; maxPhase: number; maxArtDrift: number }[] = [];
    const labels = ['Hide Left Toolbar', 'Show Left Toolbar', 'Hide Inspector', 'Show Inspector', 'Collapse timeline', 'Expand timeline'];
    for (let round = 0; round < 3; round += 1) {
      for (const label of labels) {
        const button = document.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
        if (!button) continue;
        const start = sample();
        const frames: ReturnType<typeof sample>[] = [];
        let recording = true;
        const tick = () => { if (!recording) return; frames.push(sample()); requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
        button.click();
        await new Promise<void>((resolve) => { let n = 0; const step = () => { n += 1; if (n >= 24) resolve(); else requestAnimationFrame(step); }; requestAnimationFrame(step); });
        recording = false;
        runs.push({
          label,
          frames: frames.length,
          maxPhase: Math.max(...frames.map((frame) => Math.max(frame.phaseX, frame.phaseY))),
          maxArtDrift: Math.max(...frames.map((frame) => Math.hypot(frame.artX - start.artX, frame.artY - start.artY))),
        });
      }
    }
    return runs;
  });
  expect(result.length).toBe(18);
  for (const run of result) {
    expect(run.frames, run.label).toBeGreaterThan(10);
    expect(run.maxPhase, `${run.label}: backdrop slid against the content`).toBeLessThan(0.5);
    expect(run.maxArtDrift, `${run.label}: content moved`).toBeLessThan(0.5);
  }
});
