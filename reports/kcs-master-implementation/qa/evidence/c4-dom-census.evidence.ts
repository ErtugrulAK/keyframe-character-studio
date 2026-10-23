/**
 * C4 — DOM census of the edit chrome on the heavy synthetic scene: how many
 * elements each region mounts, and how many rows of the layer list and the
 * timeline are actually inside their scroll viewports.
 */
import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDir, LANDSCAPE_URI, STORAGE_KEY, emptyChannels } from './fixtures';

const TAG = process.env.KCS_EVIDENCE_TAG ?? 'probe';
const OUT = evidenceDir(path.join('c4-mode', TAG));
const COUNT = Number(process.env.KCS_LAYERS ?? 150);

const scene = () => {
  const layers: Record<string, unknown>[] = [];
  const tracks: Record<string, unknown>[] = [];
  for (let index = 0; index < COUNT; index += 1) {
    const id = `l${index}`;
    const kind = index % 3;
    layers.push({
      id, name: `Layer ${index}`, type: kind === 0 ? 'custom_image' : kind === 1 ? 'custom_rect' : 'custom_circle',
      x: ((index * 97) % 1400) - 700, y: ((index * 53) % 800) - 400, rotation: (index * 7) % 360, scaleX: 1, scaleY: 1, opacity: 1,
      visible: true, zIndex: COUNT - index, fillColor: `hsl(${(index * 37) % 360} 70% 55%)`, strokeColor: '#000', width: 160, height: 100,
      ...(kind === 0 ? { imageUrl: LANDSCAPE_URI } : {}),
    });
    tracks.push({ id: `track-${id}`, partId: id, name: id, color: '#22d3ee', visible: true, locked: false, expanded: false,
      channels: { ...emptyChannels(), x: [{ id: `${id}k0`, frame: 0, value: -50, easing: 'easeInOut' }, { id: `${id}k1`, frame: 59, value: 50, easing: 'easeInOut' }] } });
  }
  return { version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers, tracks };
};

test('C4 DOM census', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene()) });
  await page.reload();
  await page.locator('.app-container').waitFor();
  const census = await page.evaluate(() => {
    const count = (selector: string) => {
      const root = document.querySelector(selector);
      return root ? root.querySelectorAll('*').length + 1 : 0;
    };
    const regions = ['.header-bar, header', '.authoring-toolbar', '.left-toolbar-container', '.stage-canvas-container', '.motion-design-right-sidebar', '.sequencer-timeline'];
    const out: Record<string, number> = { total: document.querySelectorAll('*').length };
    for (const r of regions) out[r] = count(r);
    out.outlinerRows = document.querySelectorAll('[role="treeitem"]').length;
    out.timelineTrackRows = document.querySelectorAll('.sequencer-timeline .track-row').length;
    // Elements per region child, two levels deep, to find the heavy subtrees.
    const heavy: { path: string; n: number }[] = [];
    const visit = (el: Element, depth: number, label: string) => {
      const n = el.querySelectorAll('*').length;
      if (n > 300) heavy.push({ path: label, n });
      if (depth < 6) [...el.children].forEach((child) => visit(child, depth + 1, `${label} > ${child.tagName.toLowerCase()}${child.className && typeof child.className === 'string' ? '.' + child.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`));
    };
    visit(document.querySelector('.sequencer-timeline')!, 0, 'timeline');
    visit(document.querySelector('.motion-design-right-sidebar')!, 0, 'inspector');
    return { out, heavy: heavy.slice(0, 40) };
  });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'census.json'), JSON.stringify(census, null, 2));
  console.log(JSON.stringify(census, null, 1));
});
