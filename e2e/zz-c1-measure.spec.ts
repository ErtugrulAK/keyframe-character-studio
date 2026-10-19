// C1 throwaway measurement — 40 layers x 60 keys stress playback.
// Deleted after the numbers are captured (measurement, not a permanent spec).
import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const seedStress = async (page: Page) => {
  const layers: unknown[] = [];
  const tracks: unknown[] = [];
  for (let l = 0; l < 40; l += 1) {
    layers.push({
      id: `p${l}`, name: `P${l}`, type: 'custom_box', x: (l % 8) * 220 - 770, y: Math.floor(l / 8) * 220 - 440,
      rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: l,
      fillColor: `hsl(${l * 9} 70% 55%)`, strokeColor: '#101218', width: 60, height: 60,
    });
    const keys = (prop: string, amp: number) => Array.from({ length: 60 }, (_, k) => ({
      id: `${prop}-${l}-${k}`, frame: k * 4, value: Math.sin((k / 60) * Math.PI * 2) * amp, easing: 'linear',
    }));
    tracks.push({
      partId: `p${l}`,
      channels: {
        x: keys('x', 90), y: keys('y', 60), rotation: keys('r', 180),
        scaleX: keys('sx', 0.4).map((key) => ({ ...key, value: 1 + Math.abs(key.value) })),
        scaleY: keys('sy', 0.4).map((key) => ({ ...key, value: 1 + Math.abs(key.value) })),
        opacity: keys('o', 0.5).map((key) => ({ ...key, value: 0.5 + Math.abs(key.value) })),
        rotationExtra: [],
      },
    });
  }
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', name: 'stress', width: 1920, height: 1080,
    fps: 60, totalFrames: 236, layers, tracks,
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript((payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: scene });
  await page.goto('/?perf');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
};

const sampler = () => {
  const w = window as unknown as {
    __c1: { ticks: number; heap: number[]; longTasks: number[]; frames: number };
    requestAnimationFrame: (cb: (t: number) => void) => number;
  };
  w.__c1 = { ticks: 0, heap: [], longTasks: [], frames: 0 };
  const bump = () => { w.__c1.ticks += 1; };
  const raf = w.requestAnimationFrame.bind(w);
  const wrapped: (cb: (t: number) => void) => number = (cb) => raf((t) => { bump(); cb(t); });
  w.requestAnimationFrame = wrapped;
  try {
    const observer = new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__c1.longTasks.push(Math.round(e.duration))));
    observer.observe({ type: 'longtask', buffered: true });
  } catch { /* unsupported */ }
  const id = window.setInterval(() => {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    w.__c1.heap.push(mem ? mem.usedJSHeapSize : 0);
    w.__c1.frames += 1;
  }, 50);
  return () => window.clearInterval(id);
};

test('C1 stress playback measurement', async ({ page }) => {
  test.info().setTimeout(180_000);
  const stop = page.addInitScript(sampler);
  void stop;
  await seedStress(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  await page.getByRole('button', { name: 'Play', exact: false }).first().click();
  const heapStart = await page.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0);
  await page.waitForTimeout(3200);
  const heapPeak = await page.evaluate(() => {
    const w = window as unknown as { __c1: { heap: number[] } };
    return Math.max(...w.__c1.heap, 0);
  });
  const counters = await page.evaluate(() => {
    const overlay = document.querySelector('.kcs-perf-overlay')?.textContent ?? '';
    const w = window as unknown as { __c1: { ticks: number; longTasks: number[] } };
    return { overlay, ticks: w.__c1.ticks, longTasks: w.__c1.longTasks, samples: (window as unknown as { __c1: { heap: number[] } }).__c1.heap.length };
  });
  const prof = await cdp.send('Profiler.stop') as unknown as { profile: { nodes: { id: number; callFrame: { functionName?: string; url?: string }; hitCount?: number }[]; samples: number[]; timeDeltas: number[] } };
  await page.getByRole('button', { name: 'Pause', exact: false }).first().click().catch(() => undefined);
  const bySelf = new Map<string, number>();

  prof.profile.nodes.forEach((node) => {
    if (!node.hitCount) return;
    const name = node.callFrame.functionName || '(anonymous)';
    const url = (node.callFrame.url ?? '').split('/').pop() ?? '';
    bySelf.set(`${name} @${url}`, ((bySelf.get(`${name} @${url}`) ?? 0) + node.hitCount));
  });
  const total = [...bySelf.values()].reduce((a, b) => a + b, 0);
  const top = [...bySelf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
    .map(([name, hits]) => `${(hits / total * 100).toFixed(1)}% ${name}`);
  const heapEnd = await page.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0);
  const { appendFileSync } = await import('node:fs');
  appendFileSync('c1-results.jsonl', JSON.stringify({
    at: new Date().toISOString(),
    heapStartMB: heapStart / 1048576,
    heapPeakSampleMB: heapPeak / 1048576,
    heapEndMB: heapEnd / 1048576,
    rafTicks: counters.ticks,
    heapSamples: counters.samples,
    longTaskCount: counters.longTasks.length,
    longTaskTop: counters.longTasks.sort((a: number, b: number) => b - a).slice(0, 8),
    overlay: counters.overlay,
    top,
  }) + '\n');
  expect(true).toBe(true);
});
