/**
 * C4 — what a dock show/hide spends inside its slowest frames, on a PRODUCTION
 * build (heavy synthetic 150-layer scene, 1440×900, the C2 probe's scene).
 *
 * The page's rAF loop marks every frame longer than 50 ms as a user-timing
 * measure; the Chrome trace then attributes the work that ran inside each such
 * window, per thread (main, compositor, raster/GPU) and per event, exclusive.
 * With KCS_TRACE=0 only the frame distribution is recorded (comparable runs).
 */
import { test, type CDPSession, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDir, LANDSCAPE_URI, STORAGE_KEY, emptyChannels } from './fixtures';

const TAG = process.env.KCS_EVIDENCE_TAG ?? 'probe';
const OUT = evidenceDir(path.join('c4-panel', TAG));
const ROUNDS = Number(process.env.KCS_ROUNDS ?? 5);
const TRACE = process.env.KCS_TRACE !== '0';
const PROFILE = process.env.KCS_PROFILE === '1';
const PANEL = process.env.KCS_PANEL === 'left' ? '.left-toolbar-toggle' : '.inspector-dock-toggle';

const heavy = () => {
  const layers: Record<string, unknown>[] = [];
  const tracks: Record<string, unknown>[] = [];
  for (let index = 0; index < 150; index += 1) {
    const id = `l${index}`;
    const kind = index % 3;
    layers.push({
      id, name: `Layer ${index}`, type: kind === 0 ? 'custom_image' : kind === 1 ? 'custom_rect' : 'custom_circle',
      x: ((index * 97) % 1400) - 700, y: ((index * 53) % 800) - 400, rotation: (index * 7) % 360, scaleX: 1, scaleY: 1, opacity: 1,
      visible: true, zIndex: 150 - index, fillColor: `hsl(${(index * 37) % 360} 70% 55%)`, strokeColor: '#000', width: 160, height: 100,
      ...(kind === 0 ? { imageUrl: LANDSCAPE_URI } : {}),
      ...(index % 5 === 0 ? { masks: [{ id: 'm1', name: 'M', mode: 'add', enabled: true, feather: 4, path: { version: 1, coordinateSpace: 'normalized', closed: true, points: [{ id: 'a', x: 0.2, y: 0.2 }, { id: 'b', x: 0.8, y: 0.2 }, { id: 'c', x: 0.8, y: 0.8 }, { id: 'd', x: 0.2, y: 0.8 }] } }] } : {}),
      ...(index % 7 === 1 && index > 1 ? { trackMatte: { sourceLayerId: `l${index - 1}`, mode: 'alpha', sourceVisible: true } } : {}),
    });
    tracks.push({ id: `track-${id}`, partId: id, name: id, color: '#22d3ee', visible: true, locked: false, expanded: false,
      channels: { ...emptyChannels(), x: [{ id: `${id}k0`, frame: 0, value: -50, easing: 'easeInOut' }, { id: `${id}k1`, frame: 59, value: 50, easing: 'easeInOut' }] } });
  }
  return { version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers, tracks };
};

const startFrames = (page: Page) => page.evaluate(() => {
  const w = window as unknown as { __frames: number[]; __long: number[]; __rec: boolean; __obs?: PerformanceObserver; __n: number };
  w.__frames = []; w.__long = []; w.__rec = true; w.__n = 0;
  let last = performance.now();
  const tick = (now: number) => {
    if (!w.__rec) return;
    const interval = now - last;
    w.__frames.push(interval);
    if (interval > 50) { w.__n += 1; performance.measure(`kcs-long-frame-${w.__n}`, { start: last, end: now }); }
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  w.__obs = new PerformanceObserver((list) => { for (const entry of list.getEntries()) w.__long.push(entry.duration); });
  try { w.__obs.observe({ type: 'longtask', buffered: false }); } catch { /* unsupported */ }
});
const stopFrames = (page: Page) => page.evaluate(() => {
  const w = window as unknown as { __frames: number[]; __long: number[]; __rec: boolean; __obs?: PerformanceObserver };
  w.__rec = false; w.__obs?.disconnect();
  const frames = w.__frames.slice(1).sort((a, b) => a - b);
  const pick = (q: number) => (frames.length ? +frames[Math.min(frames.length - 1, Math.floor(frames.length * q))].toFixed(1) : null);
  return { frames: frames.length, p50: pick(0.5), p95: pick(0.95), max: pick(1), over50: frames.filter((f) => f > 50).map((f) => Math.round(f)), longTasks: w.__long.map((d) => Math.round(d)) };
});

type TraceEvent = { name: string; ph: string; ts: number; dur?: number; pid: number; tid: number; cat: string; args?: { name?: string } };

async function trace(cdp: CDPSession, run: () => Promise<void>): Promise<TraceEvent[]> {
  if (!TRACE) { await run(); return []; }
  const events: TraceEvent[] = [];
  const onData = (payload: { value: TraceEvent[] }) => { events.push(...payload.value); };
  cdp.on('Tracing.dataCollected', onData);
  await cdp.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'blink', 'v8', 'v8.execute', 'renderer.scheduler', 'toplevel', 'cc', 'gpu', 'viz', '__metadata'] },
  });
  await run();
  const done = new Promise<void>((resolve) => cdp.once('Tracing.tracingComplete', () => resolve()));
  await cdp.send('Tracing.end');
  await done;
  cdp.off('Tracing.dataCollected', onData);
  return events;
}

/** Exclusive time per (thread, event) inside every long-frame window. */
function longFrameBreakdown(events: TraceEvent[]) {
  const threadNames = new Map<string, string>();
  events.filter((e) => e.ph === 'M' && e.name === 'thread_name').forEach((e) => threadNames.set(`${e.pid}:${e.tid}`, e.args?.name ?? '?'));
  // User-timing measures arrive as async begin/end pairs ('b'/'e').
  const begins = new Map<string, number>();
  const windows: { name: string; start: number; end: number }[] = [];
  for (const e of events) {
    if (!e.name.startsWith('kcs-long-frame-')) continue;
    if (e.ph === 'b') begins.set(e.name, e.ts);
    if (e.ph === 'e' && begins.has(e.name)) windows.push({ name: e.name, start: begins.get(e.name)!, end: e.ts });
  }
  return windows.map((window) => {
    const perThread = new Map<string, TraceEvent[]>();
    for (const e of events) {
      if (e.ph !== 'X' || typeof e.dur !== 'number' || e.dur <= 0) continue;
      if (e.ts + e.dur <= window.start || e.ts >= window.end) continue;
      const key = `${e.pid}:${e.tid}`;
      const list = perThread.get(key) ?? [];
      list.push(e);
      perThread.set(key, list);
    }
    const threads: Record<string, { busyMs: number; top: { name: string; ms: number }[] }> = {};
    for (const [key, list] of perThread) {
      // Clip to the window, then exclusive time by nesting.
      const clipped = list.map((e) => ({ name: e.name, ts: Math.max(e.ts, window.start), end: Math.min(e.ts + (e.dur ?? 0), window.end) }))
        .sort((a, b) => a.ts - b.ts || (b.end - a.end));
      const exclusive = new Map<string, number>();
      const stack: { name: string; ts: number; end: number; child: number }[] = [];
      let busy = 0;
      const close = (until: number) => {
        while (stack.length && stack[stack.length - 1].end <= until) {
          const top = stack.pop()!;
          exclusive.set(top.name, (exclusive.get(top.name) ?? 0) + (top.end - top.ts) - top.child);
          if (stack.length) stack[stack.length - 1].child += top.end - top.ts;
          else busy += top.end - top.ts;
        }
      };
      for (const e of clipped) { close(e.ts); stack.push({ ...e, child: 0 }); }
      close(Number.POSITIVE_INFINITY);
      const name = threadNames.get(key) ?? key;
      if (busy < 2000) continue;
      threads[`${name} (${key})`] = {
        busyMs: +(busy / 1000).toFixed(1),
        top: [...exclusive.entries()].filter(([n]) => !['ThreadControllerImpl::RunTask', 'RunTask'].includes(n)).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, us]) => ({ name: n, ms: +(us / 1000).toFixed(1) })),
      };
    }
    return { frameMs: +((window.end - window.start) / 1000).toFixed(1), threads };
  });
}

async function seed(page: Page) {
  await page.goto('/');
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(heavy()) });
  await page.reload();
  await page.locator('.app-container').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

test('C4 panel toggle breakdown', async ({ page }) => {
  test.setTimeout(600000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page);
  await page.waitForTimeout(500);
  const cdp = await page.context().newCDPSession(page);
  // The toggle is clicked by its screen position, resolved ONCE before measuring:
  // a role/name locator makes Playwright compute accessible names over the whole
  // DOM inside the page on every click — work that lands in the measured frames.
  const handle = await page.locator(PANEL).boundingBox();
  if (!handle) throw new Error('toggle');
  const toggle = { click: () => page.mouse.click(handle.x + handle.width / 2, handle.y + handle.height / 2) };
  const rounds: Record<string, unknown>[] = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    await startFrames(page);
    const events = await trace(cdp, async () => {
      for (let index = 0; index < 4; index += 1) {
        await toggle.click();
        await page.waitForTimeout(300);
      }
    });
    const frames = await stopFrames(page);
    rounds.push({ frames, longFrames: TRACE ? longFrameBreakdown(events) : [] });
  }
  if (PROFILE) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
    for (let index = 0; index < 8; index += 1) { await toggle.click(); await page.waitForTimeout(300); }
    const { profile } = await cdp.send('Profiler.stop') as { profile: { nodes: { id: number; callFrame: { functionName: string } }[]; samples: number[]; timeDeltas: number[] } };
    const self = new Map<string, number>();
    const byId = new Map(profile.nodes.map((node) => [node.id, node.callFrame.functionName || '(anon)']));
    profile.samples.forEach((id, index) => { const name = byId.get(id) ?? '?'; self.set(name, (self.get(name) ?? 0) + (profile.timeDeltas[index] ?? 0)); });
    rounds.push({ profileSelfTop: [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, us]) => ({ name, ms: Math.round(us / 1000) })) });
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'breakdown.json'), JSON.stringify(rounds, null, 2));
  console.log(rounds.filter((r) => r.frames).map((r, i) => {
    const f = r.frames as { p95: number; max: number; over50: number[]; longTasks: number[] };
    return `round ${i}: p95 ${f.p95} max ${f.max} >50ms [${f.over50}] long [${f.longTasks}]`;
  }).join('\n'));
});
