/**
 * C2 performance probe. Same machine, browser (Playwright Chromium, headless),
 * viewport 1440×900, synthetic scenes only. For each interaction it records
 * the rendered-frame interval distribution (p50/p95/max), long tasks (> 50 ms)
 * and, for the heavy scene's layer drag, a CPU profile summarised to the top
 * self-time functions. Monitor Hz, scene FPS and UI render cadence are
 * different things: this measures UI frames only.
 */
import { test, type CDPSession, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDir, LANDSCAPE_URI, STORAGE_KEY, emptyChannels } from './fixtures';

const TAG = process.env.KCS_EVIDENCE_TAG ?? 'probe';
const OUT = evidenceDir(path.join('c2-perf', TAG));

type Size = 'simple' | 'medium' | 'heavy';
const COUNTS: Record<Size, number> = { simple: 3, medium: 40, heavy: 150 };

const buildScene = (size: Size) => {
  const layers: Record<string, unknown>[] = [];
  const tracks: Record<string, unknown>[] = [];
  const count = COUNTS[size];
  for (let index = 0; index < count; index += 1) {
    const id = `l${index}`;
    const kind = index % 3;
    const masked = size !== 'simple' && index % 5 === 0;
    layers.push({
      id, name: `Layer ${index}`, type: kind === 0 ? 'custom_image' : kind === 1 ? 'custom_rect' : 'custom_circle',
      x: ((index * 97) % 1400) - 700, y: ((index * 53) % 800) - 400, rotation: (index * 7) % 360, scaleX: 1, scaleY: 1, opacity: 1,
      visible: true, zIndex: count - index, fillColor: `hsl(${(index * 37) % 360} 70% 55%)`, strokeColor: '#000', width: 160, height: 100,
      ...(kind === 0 ? { imageUrl: LANDSCAPE_URI } : {}),
      ...(masked ? { masks: [{ id: 'm1', name: 'M', mode: 'add', enabled: true, feather: 4, path: { version: 1, coordinateSpace: 'normalized', closed: true, points: [{ id: 'a', x: 0.2, y: 0.2 }, { id: 'b', x: 0.8, y: 0.2 }, { id: 'c', x: 0.8, y: 0.8 }, { id: 'd', x: 0.2, y: 0.8 }] } }] } : {}),
      ...(size === 'heavy' && index % 7 === 1 && index > 1 ? { trackMatte: { sourceLayerId: `l${index - 1}`, mode: 'alpha', sourceVisible: true } } : {}),
    });
    tracks.push({
      id: `track-${id}`, partId: id, name: id, color: '#22d3ee', visible: true, locked: false, expanded: false,
      channels: { ...emptyChannels(), x: [{ id: `${id}k0`, frame: 0, value: -50, easing: 'easeInOut' }, { id: `${id}k1`, frame: 59, value: 50, easing: 'easeInOut' }] },
    });
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
  return { frames: frames.length, p50: pick(0.5), p95: pick(0.95), max: pick(1), longTasks: w.__long.length, longTaskMs: Math.round(w.__long.reduce((a, b) => a + b, 0)) };
});

async function seed(page: Page, size: Size) {
  await page.goto('/');
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(buildScene(size)) });
  await page.reload();
  await page.locator('.app-container').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

const stage = async (page: Page) => {
  const box = await page.locator('.stage-canvas-container').boundingBox();
  if (!box) throw new Error('stage');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

async function profileTop(cdp: CDPSession, run: () => Promise<void>) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await run();
  const { profile } = await cdp.send('Profiler.stop') as { profile: { nodes: { id: number; callFrame: { functionName: string; url: string; lineNumber: number } }[]; samples: number[]; timeDeltas: number[] } };
  const self = new Map<number, number>();
  profile.samples.forEach((id, index) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[index] ?? 0)));
  const byName = new Map<string, number>();
  for (const node of profile.nodes) {
    const time = self.get(node.id) ?? 0;
    if (!time) continue;
    const file = node.callFrame.url.split('/').slice(-1)[0].split('?')[0];
    const key = `${node.callFrame.functionName || '(anonymous)'} @ ${file}:${node.callFrame.lineNumber + 1}`;
    byName.set(key, (byName.get(key) ?? 0) + time);
  }
  const total = [...byName.values()].reduce((a, b) => a + b, 0);
  return [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([name, us]) => ({ name, ms: Math.round(us / 1000), pct: +((us / total) * 100).toFixed(1) }));
}

test('C2 perf probe', async ({ page }) => {
  test.setTimeout(600000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const report: Record<string, Record<string, unknown>> = {};
  for (const size of ['simple', 'medium', 'heavy'] as Size[]) {
    await seed(page, size);
    const results: Record<string, unknown> = {};
    const c = await stage(page);

    // Layer drag: select the top layer from the outliner, drag it on the canvas.
    await page.locator('[role="treeitem"]').first().click();
    const target = await page.locator('.stage-svg g[data-part-id="l0"]').boundingBox();
    const from = target ? { x: target.x + target.width / 2, y: target.y + target.height / 2 } : c;
    await startFrames(page);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let step = 0; step < 60; step += 1) await page.mouse.move(from.x + step * 3, from.y + Math.sin(step / 6) * 30);
    await page.mouse.up();
    results.layerDrag = await stopFrames(page);
    await page.keyboard.press('Control+z');

    // Hover sweep over the stage.
    await startFrames(page);
    for (let step = 0; step < 60; step += 1) await page.mouse.move(c.x - 300 + step * 10, c.y + Math.cos(step / 5) * 120);
    results.hover = await stopFrames(page);

    // Freeform drawing stroke.
    await page.getByRole('button', { name: 'Pen' }).click();
    await startFrames(page);
    await page.mouse.move(c.x - 200, c.y);
    await page.mouse.down();
    for (let step = 0; step < 60; step += 1) await page.mouse.move(c.x - 200 + step * 6, c.y + Math.sin(step / 4) * 80);
    await page.mouse.up();
    results.drawStroke = await stopFrames(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // Panel toggles.
    await startFrames(page);
    for (let index = 0; index < 4; index += 1) {
      await page.getByRole('button', { name: /^(Hide|Show) Inspector$/ }).click();
      await page.waitForTimeout(300);
    }
    results.panelToggle = await stopFrames(page);

    // Outliner scroll.
    const list = page.locator('[role="tree"], .outliner-tree, .outliner-dock').first();
    await list.hover();
    await startFrames(page);
    for (let index = 0; index < 20; index += 1) await page.mouse.wheel(0, 120);
    await page.waitForTimeout(300);
    results.outlinerScroll = await stopFrames(page);

    // Timeline scrub with the ruler (keyboard seek through every frame).
    const ruler = page.getByRole('slider', { name: 'Playhead position' });
    await ruler.focus();
    await page.keyboard.press('Home');
    await startFrames(page);
    for (let index = 0; index < 59; index += 1) await page.keyboard.press('ArrowRight');
    results.scrub = await stopFrames(page);

    // Playback (2 s).
    await page.keyboard.press('Home');
    await page.locator('.stage-canvas-container').click({ position: { x: 5, y: 5 } });
    await startFrames(page);
    await page.getByTitle('Play', { exact: true }).click();
    await page.waitForTimeout(2000);
    results.playback = await stopFrames(page);
    // The 60-frame sequence at 30 fps may end on its own right as the click lands.
    const pause = page.getByTitle('Pause', { exact: true });
    if (await pause.count()) await pause.click({ timeout: 2000 }).catch(() => undefined);

    // Edit → Broadcast → Edit.
    await startFrames(page);
    await page.getByRole('button', { name: 'BROADCAST', exact: true }).click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'EDIT MODE', exact: true }).click();
    await page.waitForTimeout(600);
    results.modeSwitch = await stopFrames(page);

    if (size === 'heavy') {
      const cdp = await page.context().newCDPSession(page);
      await page.locator('[role="treeitem"]').first().click();
      const box = await page.locator('.stage-svg g[data-part-id="l0"]').boundingBox();
      const start = box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : c;
      results.dragCpuTop = await profileTop(cdp, async () => {
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        for (let step = 0; step < 60; step += 1) await page.mouse.move(start.x + step * 3, start.y + step);
        await page.mouse.up();
      });
      await page.keyboard.press('Control+z');
      results.scrubCpuTop = await profileTop(cdp, async () => {
        await ruler.focus();
        await page.keyboard.press('Home');
        for (let index = 0; index < 40; index += 1) await page.keyboard.press('ArrowRight');
      });
    }
    report[size] = results;
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
});
