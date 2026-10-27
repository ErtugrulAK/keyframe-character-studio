/**
 * C2 perf attribution: heavy synthetic scene, 2 s of playback and a 40-frame
 * scrub, CPU-profiled on the DEV server (component names are kept there), with
 * INCLUSIVE time per src/ function so a regression can be traced to a
 * component. Absolute dev numbers are inflated by React's dev checks; only
 * the base-vs-worktree comparison is meaningful.
 */
import { test, type CDPSession, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDir, LANDSCAPE_URI, STORAGE_KEY, emptyChannels } from './fixtures';

const TAG = process.env.KCS_EVIDENCE_TAG ?? 'probe';
const OUT = evidenceDir(path.join('c2-perf', TAG));

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

type Node = { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; children?: number[] };

async function inclusive(cdp: CDPSession, run: () => Promise<void>) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await run();
  const { profile } = await cdp.send('Profiler.stop') as { profile: { nodes: Node[]; samples: number[]; timeDeltas: number[] } };
  const self = new Map<number, number>();
  profile.samples.forEach((id, index) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[index] ?? 0)));
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const total = new Map<number, number>();
  const sum = (id: number): number => {
    const node = byId.get(id)!;
    const value = (self.get(id) ?? 0) + (node.children ?? []).reduce((acc, child) => acc + sum(child), 0);
    total.set(id, value);
    return value;
  };
  const root = profile.nodes[0].id;
  const all = sum(root);
  // Inclusive per src function; recursion counted once per stack (outermost frame only).
  const result = new Map<string, number>();
  const walk = (id: number, seen: Set<string>) => {
    const node = byId.get(id)!;
    const url = node.callFrame.url;
    let next = seen;
    if (url.includes('/src/')) {
      const key = `${node.callFrame.functionName || '(anon)'} @ ${url.split('/src/')[1].split('?')[0]}:${node.callFrame.lineNumber + 1}`;
      if (!seen.has(key)) { result.set(key, (result.get(key) ?? 0) + (total.get(id) ?? 0)); next = new Set(seen); next.add(key); }
    }
    for (const child of node.children ?? []) walk(child, next);
  };
  walk(root, new Set());
  const idle = [...profile.nodes].filter((node) => node.callFrame.functionName === '(idle)').reduce((acc, node) => acc + (self.get(node.id) ?? 0), 0);
  return {
    busyMs: Math.round((all - idle) / 1000),
    top: [...result.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([name, us]) => ({ name, ms: Math.round(us / 1000) })),
  };
}

async function seed(page: Page) {
  await page.goto('/');
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(heavy()) });
  await page.reload();
  await page.locator('.app-container').waitFor();
}

test('C2 perf attribution', async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page);
  const cdp = await page.context().newCDPSession(page);
  const report: Record<string, unknown> = {};
  await page.locator('.stage-canvas-container').click({ position: { x: 5, y: 5 } });
  report.playback = await inclusive(cdp, async () => {
    await page.getByTitle('Play', { exact: true }).click();
    await page.waitForTimeout(2000);
    // The 60-frame sequence may finish on its own before the click lands.
    const pause = page.getByTitle('Pause', { exact: true });
    if (await pause.count()) await pause.click({ timeout: 2000 }).catch(() => undefined);
  });
  const ruler = page.getByRole('slider', { name: 'Playhead position' });
  report.scrub = await inclusive(cdp, async () => {
    await ruler.focus();
    await page.keyboard.press('Home');
    for (let index = 0; index < 40; index += 1) await page.keyboard.press('ArrowRight');
  });
  report.panelToggle = await inclusive(cdp, async () => {
    for (let index = 0; index < 4; index += 1) {
      await page.getByRole('button', { name: /^(Hide|Show) Inspector$/ }).click();
      await page.waitForTimeout(300);
    }
  });
  // C3 — what the Broadcast → Edit return costs (the edit chrome remounts).
  await page.getByRole('button', { name: 'BROADCAST', exact: true }).click();
  await page.waitForTimeout(600);
  report.modeSwitchToEdit = await inclusive(cdp, async () => {
    await page.getByRole('button', { name: 'EDIT MODE', exact: true }).click();
    await page.waitForTimeout(600);
  });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'attribution.json'), JSON.stringify(report, null, 2));
});
