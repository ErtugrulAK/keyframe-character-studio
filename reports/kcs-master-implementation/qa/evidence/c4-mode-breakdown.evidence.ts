/**
 * C4 — where the Edit ⇄ Broadcast switch spends its time, on a PRODUCTION
 * build (heavy synthetic 150-layer scene, 1440×900, same scene as the C2 probe).
 *
 * For each switch it records:
 *  - the frame-interval distribution and long tasks (as the C2 probe does);
 *  - a Chrome trace of the longest main-thread task, split into EXCLUSIVE time
 *    per trace event (script, style recalc, layout, pre-paint/paint, commit…);
 *  - a CPU profile, inclusive time per JS function (meaningful with
 *    KCS_PERF_MINIFY=0, which keeps React's and the app's function names).
 * DOM element counts tell how much chrome each switch mounts.
 */
import { test, type CDPSession, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDir, LANDSCAPE_URI, STORAGE_KEY, emptyChannels } from './fixtures';

const TAG = process.env.KCS_EVIDENCE_TAG ?? 'probe';
const OUT = evidenceDir(path.join('c4-mode', TAG));
const ROUNDS = Number(process.env.KCS_ROUNDS ?? 5);
// KCS_TRACE=0: frames and long tasks only (no tracing/profiling overhead) — the comparable numbers.
const TRACE = process.env.KCS_TRACE !== '0';

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
  const w = window as unknown as { __frames: number[]; __long: number[]; __rec: boolean; __obs?: PerformanceObserver };
  w.__frames = []; w.__long = []; w.__rec = true;
  let last = performance.now();
  const tick = (now: number) => { if (!w.__rec) return; w.__frames.push(now - last); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  w.__obs = new PerformanceObserver((list) => { for (const entry of list.getEntries()) w.__long.push(entry.duration); });
  try { w.__obs.observe({ type: 'longtask', buffered: false }); } catch { /* unsupported */ }
});
const stopFrames = (page: Page) => page.evaluate(() => {
  const w = window as unknown as { __frames: number[]; __long: number[]; __rec: boolean; __obs?: PerformanceObserver };
  w.__rec = false; w.__obs?.disconnect();
  const frames = w.__frames.slice(1).sort((a, b) => a - b);
  const pick = (q: number) => (frames.length ? +frames[Math.min(frames.length - 1, Math.floor(frames.length * q))].toFixed(1) : null);
  return { frames: frames.length, p50: pick(0.5), p95: pick(0.95), max: pick(1), longTasks: w.__long.map((d) => Math.round(d)) };
});

type TraceEvent = { name: string; ph: string; ts: number; dur?: number; pid: number; tid: number; cat: string; args?: { name?: string } };

async function trace(cdp: CDPSession, run: () => Promise<void>): Promise<TraceEvent[]> {
  if (!TRACE) { await run(); return []; }
  const events: TraceEvent[] = [];
  const onData = (payload: { value: TraceEvent[] }) => { events.push(...payload.value); };
  cdp.on('Tracing.dataCollected', onData);
  await cdp.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'v8.execute', 'toplevel', '__metadata'] },
  });
  await run();
  const done = new Promise<void>((resolve) => cdp.once('Tracing.tracingComplete', () => resolve()));
  await cdp.send('Tracing.end');
  await done;
  cdp.off('Tracing.dataCollected', onData);
  return events;
}

/** Exclusive time per event name inside the longest main-thread task. */
function longestTaskBreakdown(events: TraceEvent[]) {
  const mains = events.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
  let best: { task: TraceEvent; thread: TraceEvent[] } | null = null;
  for (const main of mains) {
    const thread = events.filter((e) => e.pid === main.pid && e.tid === main.tid && e.ph === 'X' && typeof e.dur === 'number');
    for (const task of thread) {
      if (task.name !== 'RunTask' && task.name !== 'ThreadControllerImpl::RunTask') continue;
      if (!best || (task.dur ?? 0) > (best.task.dur ?? 0)) best = { task, thread };
    }
  }
  if (!best) return null;
  const start = best.task.ts;
  const end = start + (best.task.dur ?? 0);
  const inside = best.thread
    .filter((e) => e !== best!.task && e.ts >= start && e.ts + (e.dur ?? 0) <= end && e.name !== 'RunTask' && e.name !== 'ThreadControllerImpl::RunTask')
    .sort((a, b) => a.ts - b.ts || (b.dur ?? 0) - (a.dur ?? 0));
  const exclusive = new Map<string, number>();
  const stack: { event: TraceEvent; child: number }[] = [];
  const close = (until: number) => {
    while (stack.length && stack[stack.length - 1].event.ts + (stack[stack.length - 1].event.dur ?? 0) <= until) {
      const top = stack.pop()!;
      exclusive.set(top.event.name, (exclusive.get(top.event.name) ?? 0) + (top.event.dur ?? 0) - top.child);
      if (stack.length) stack[stack.length - 1].child += top.event.dur ?? 0;
    }
  };
  for (const event of inside) {
    close(event.ts);
    stack.push({ event, child: 0 });
  }
  close(Number.POSITIVE_INFINITY);
  const attributed = [...exclusive.values()].reduce((a, b) => a + b, 0);
  const rows = [...exclusive.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([name, us]) => ({ name, ms: +(us / 1000).toFixed(1) }));
  return { taskMs: +((best.task.dur ?? 0) / 1000).toFixed(1), unattributedMs: +(((best.task.dur ?? 0) - attributed) / 1000).toFixed(1), rows };
}

type ProfileNode = { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; children?: number[] };

async function profile(cdp: CDPSession, run: () => Promise<void>) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  await cdp.send('Profiler.start');
  await run();
  const { profile: data } = await cdp.send('Profiler.stop') as { profile: { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] } };
  const self = new Map<number, number>();
  data.samples.forEach((id, index) => self.set(id, (self.get(id) ?? 0) + (data.timeDeltas[index] ?? 0)));
  const byId = new Map(data.nodes.map((node) => [node.id, node]));
  const total = new Map<number, number>();
  const sum = (id: number): number => {
    const node = byId.get(id)!;
    const value = (self.get(id) ?? 0) + (node.children ?? []).reduce((acc, child) => acc + sum(child), 0);
    total.set(id, value);
    return value;
  };
  sum(data.nodes[0].id);
  const inclusive = new Map<string, number>();
  const selfByName = new Map<string, number>();
  const walk = (id: number, seen: Set<string>) => {
    const node = byId.get(id)!;
    const key = node.callFrame.functionName || '(anon)';
    selfByName.set(key, (selfByName.get(key) ?? 0) + (self.get(id) ?? 0));
    let next = seen;
    if (!seen.has(key)) { inclusive.set(key, (inclusive.get(key) ?? 0) + (total.get(id) ?? 0)); next = new Set(seen); next.add(key); }
    for (const child of node.children ?? []) walk(child, next);
  };
  walk(data.nodes[0].id, new Set());
  const ms = (us: number | undefined) => Math.round((us ?? 0) / 100) / 10;
  const top = (map: Map<string, number>, count: number) => [...map.entries()]
    .filter(([name]) => !['(root)', '(idle)', '(program)'].includes(name))
    .sort((a, b) => b[1] - a[1]).slice(0, count).map(([name, us]) => ({ name, ms: ms(us) }));
  return { inclusiveTop: top(inclusive, 45), components: top(new Map([...inclusive].filter(([name]) => /^[A-Z]/.test(name))), 40), selfTop: top(selfByName, 25), gc: ms(selfByName.get('(garbage collector)')) };
}

async function seed(page: Page) {
  await page.goto('/');
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(heavy()) });
  await page.reload();
  await page.locator('.app-container').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

const elementCount = (page: Page) => page.evaluate(() => document.querySelectorAll('*').length);
const settle = (page: Page) => page.waitForTimeout(700);

test('C4 mode switch breakdown', async ({ page }) => {
  test.setTimeout(600000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page);
  const cdp = await page.context().newCDPSession(page);
  // Clicked by screen position, resolved once (see c4-panel-breakdown): no
  // locator work runs inside the measured frames.
  const at = async (name: string) => {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    if (!box) throw new Error(name);
    return { click: () => page.mouse.click(box.x + box.width / 2, box.y + box.height / 2) };
  };
  const broadcast = await at('BROADCAST');
  const edit = await at('EDIT MODE');
  const report: Record<string, unknown> = { editElements: await elementCount(page) };
  const rounds: Record<string, unknown>[] = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    const entry: Record<string, unknown> = {};
    await startFrames(page);
    const toBroadcast = await trace(cdp, async () => { await broadcast.click(); await settle(page); });
    entry.toBroadcastFrames = await stopFrames(page);
    entry.toBroadcastTask = longestTaskBreakdown(toBroadcast);
    if (round === 0) report.broadcastElements = await elementCount(page);
    await startFrames(page);
    const toEdit = await trace(cdp, async () => { await edit.click(); await settle(page); });
    entry.toEditFrames = await stopFrames(page);
    entry.toEditTask = longestTaskBreakdown(toEdit);
    rounds.push(entry);
  }
  report.rounds = rounds;
  // One CPU profile per direction (after the traced rounds, so tracing never overlaps profiling).
  if (TRACE) {
  await broadcast.click(); await settle(page);
  report.toEditProfile = await profile(cdp, async () => { await edit.click(); await settle(page); });
  report.toBroadcastProfile = await profile(cdp, async () => { await broadcast.click(); await settle(page); });
  await edit.click(); await settle(page);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'breakdown.json'), JSON.stringify(report, null, 2));
  const summary = rounds.map((r, i) => {
    const f = r.toEditFrames as { p95: number; max: number; longTasks: number[] };
    const t = r.toEditTask as { taskMs: number } | null;
    const b = r.toBroadcastFrames as { p95: number; max: number; longTasks: number[] };
    return `round ${i}: toEdit p95 ${f.p95} max ${f.max} long [${f.longTasks}] task ${t?.taskMs} | toBroadcast p95 ${b.p95} max ${b.max} long [${b.longTasks}]`;
  });
  console.log(summary.join('\n'));
});
