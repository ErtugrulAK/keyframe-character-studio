/**
 * C2-D probe: does any show/hide control make the stage content jump?
 *
 * For every animation frame during a toggle, record the SCREEN position of a
 * fixed world point (the artboard's centre) and of a layer. The camera policy
 * is "the world keeps its screen position when a panel opens or closes" (the
 * visible crop changes only), so any per-frame deviation is a jump, even when
 * the final screenshot looks right. Writes JSON next to the evidence.
 */
import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDir, imageLayer, seedScene, track } from './fixtures';

const TAG = process.env.KCS_EVIDENCE_TAG ?? 'probe';
const OUT = evidenceDir(path.join('c2-toggle', TAG));

const startRecording = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const samples: { t: number; artX: number; artY: number; layerX: number; layerY: number; otherX: number; otherY: number; stageW: number; camera: string }[] = [];
  (window as unknown as { __samples: typeof samples }).__samples = samples;
  (window as unknown as { __recording: boolean }).__recording = true;
  const t0 = performance.now();
  const tick = () => {
    if (!(window as unknown as { __recording: boolean }).__recording) return;
    const art = document.querySelector('.stage-svg rect.canvas-bg')?.getBoundingClientRect();
    const layer = document.querySelector('.stage-svg g[data-part-id="landscape"]')?.getBoundingClientRect();
    const other = document.querySelector('.stage-svg g[data-part-id="badge"]')?.getBoundingClientRect();
    const stage = document.querySelector('.stage-canvas-container')?.getBoundingClientRect();
    if (art && stage) {
      samples.push({
        t: Math.round(performance.now() - t0),
        artX: art.left + art.width / 2, artY: art.top + art.height / 2,
        layerX: layer ? layer.left + layer.width / 2 : NaN, layerY: layer ? layer.top + layer.height / 2 : NaN,
        otherX: other ? other.left + other.width / 2 : NaN, otherY: other ? other.top + other.height / 2 : NaN,
        stageW: stage.width,
        camera: (document.querySelector('.stage-svg') as SVGSVGElement | null)?.style.transform ?? '',
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const stopRecording = (page: import('@playwright/test').Page) => page.evaluate(() => {
  (window as unknown as { __recording: boolean }).__recording = false;
  return (window as unknown as { __samples: { t: number; artX: number; artY: number; layerX: number; layerY: number; otherX: number; otherY: number; stageW: number; camera: string }[] }).__samples;
});

/** Largest per-frame drift of the artboard and of the (still visible) second layer. */
const maxDeviation = (samples: { artX: number; artY: number; otherX: number; otherY: number }[]) => {
  const first = samples[0];
  return samples.reduce((max, sample) => Math.max(
    max,
    Math.hypot(sample.artX - first.artX, sample.artY - first.artY),
    Number.isFinite(sample.otherX) && Number.isFinite(first.otherX) ? Math.hypot(sample.otherX - first.otherX, sample.otherY - first.otherY) : 0,
  ), 0);
};

for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 720 }]) test(`C2-D toggle jump probe ${viewport.width}`, async ({ page }) => {
  test.setTimeout(240000);
  await page.setViewportSize(viewport);
  await seedScene(page, {
    layers: [
      imageLayer({ x: 120, y: -40, trackMatte: undefined }),
      { id: 'badge', name: 'Badge', type: 'custom_rect', x: -150, y: 60, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 3, fillColor: '#f59e0b', strokeColor: '#000', width: 120, height: 60 },
      { id: 'caption', name: 'Caption', type: 'custom_rect', x: 0, y: 140, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, fillColor: '#22d3ee', strokeColor: '#000', width: 220, height: 40, trackMatte: { sourceLayerId: 'badge', mode: 'alpha', sourceVisible: true } },
    ],
    tracks: [track('landscape'), track('badge'), track('caption')],
  });
  // A user-applied pan/zoom first: the policy must hold for a moved camera too.
  for (let step = 0; step < 2; step += 1) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('canvas-viewport-command', { detail: { type: 'zoom-in' } })));
  }
  await page.waitForTimeout(0);
  const report: Record<string, { toggles: number; maxDeviationPx: number; frames: number; perToggle: number[] }> = {};
  const controls: [string, () => Promise<void>][] = [
    ['layer visibility', async () => { await page.locator('[role="treeitem"]', { hasText: 'Landscape' }).first().locator('.col-eye').click(); }],
    ['inspector', async () => { await page.getByRole('button', { name: /^(Hide|Show) Inspector$/ }).click(); }],
    ['left toolbar', async () => { await page.getByRole('button', { name: /^(Hide|Show) Left Toolbar$/ }).click(); }],
    ['timeline', async () => { await page.getByRole('button', { name: /^(Collapse|Expand) timeline$/ }).click(); }],
    ['timeline row edit eye', async () => { await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().locator('button[title^="Edit Canvas Eye"]').click(); }],
    ['grid', async () => { await page.getByRole('button', { name: 'Toggle grid' }).click(); }],
    ['matte show source', async () => {
      if (!(await page.locator('label', { hasText: 'Show source' }).count())) {
        await page.locator('.ue-track-row', { hasText: 'Caption' }).first().click();
        await page.getByRole('button', { name: 'Expand TRACK MATTE' }).click();
      }
      await page.locator('label', { hasText: 'Show source' }).locator('input').click();
    }],
  ];
  for (const [name, toggle] of controls) {
    const perToggle: number[] = [];
    let frames = 0;
    for (let index = 0; index < 10; index += 1) {
      await startRecording(page);
      await toggle();
      // Sample through the whole transition: wait for 30 rendered frames.
      await page.evaluate(() => new Promise<void>((resolve) => {
        let count = 0;
        const step = () => { count += 1; if (count >= 30) resolve(); else requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }));
      const samples = await stopRecording(page);
      frames += samples.length;
      perToggle.push(Math.round(maxDeviation(samples) * 100) / 100);
    }
    report[name] = { toggles: 10, maxDeviationPx: Math.max(...perToggle), frames, perToggle };
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `toggle-jump-${viewport.width}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
});
