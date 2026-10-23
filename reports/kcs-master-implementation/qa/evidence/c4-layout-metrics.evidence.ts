/**
 * C4 — layout metrics on the four required surfaces: 1440×900, 1024×768,
 * 768×900 and REAL 200 % browser zoom (profile zoom, 1440×900 window — see
 * c3-real-browser-zoom). A 12-layer scene; for each surface: stage size, the
 * number of FULLY visible layer rows, the Details and timeline heights, the
 * toolbar's hidden width, page horizontal overflow, and a screenshot.
 * KCS_EVIDENCE_TAG names the run (before / after).
 */
import { chromium, expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evidenceDir, STORAGE_KEY, emptyChannels } from './fixtures';

const TAG = process.env.KCS_EVIDENCE_TAG ?? 'probe';
const OUT = evidenceDir(path.join('c4-layout', TAG));
const BASE = 'http://127.0.0.1:5196';

const scene = () => {
  const layers = Array.from({ length: 12 }, (_, index) => ({
    id: `l${index}`, name: `Layer ${index + 1}`, type: index % 2 ? 'custom_rect' : 'custom_circle',
    x: (index % 4) * 220 - 330, y: Math.floor(index / 4) * 160 - 160, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 12 - index,
    fillColor: `hsl(${index * 30} 70% 55%)`, strokeColor: '#000', width: 140, height: 100,
  }));
  return { version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers,
    tracks: layers.map((layer) => ({ id: `track-${layer.id}`, partId: layer.id, name: layer.name, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() })) };
};

async function seed(page: Page) {
  await page.goto('/');
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene()) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('[role="tree"] [data-layer-id="l0"]').click();
  await page.waitForTimeout(500);
}

const measure = (page: Page) => page.evaluate(() => {
  const rect = (selector: string) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return { w: Math.round(box.width), h: Math.round(box.height) };
  };
  const list = document.querySelector('.outliner-table-body') as HTMLElement | null;
  let fullRows = 0;
  if (list) {
    const box = list.getBoundingClientRect();
    list.querySelectorAll('[role="treeitem"][data-layer-id]').forEach((row) => {
      const r = row.getBoundingClientRect();
      if (r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5 && r.height > 0) fullRows += 1;
    });
  }
  const toolbar = document.querySelector('.authoring-toolbar') as HTMLElement | null;
  const header = document.querySelector('.header-bar, header') as HTMLElement | null;
  return {
    css: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    stage: rect('.stage-canvas-container'),
    layerRowsFullyVisible: fullRows,
    layerList: list ? { h: Math.round(list.getBoundingClientRect().height) } : null,
    details: rect('.details-container'),
    timeline: rect('.sequencer-timeline'),
    header: header ? Math.round(header.getBoundingClientRect().height) : null,
    toolbarHiddenPx: toolbar ? toolbar.scrollWidth - toolbar.clientWidth : null,
    pageHorizontalOverflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    leftDockOpen: document.querySelector('.left-toolbar-toggle')?.getAttribute('aria-expanded'),
    vertical: [...(document.querySelector('.app-container')?.children ?? [])].map((child) => `${child.tagName.toLowerCase()}.${String((child as HTMLElement).className).split(' ')[0]}:${Math.round(child.getBoundingClientRect().height)}`),
    headerRows: [...(document.querySelector('.header-bar, header')?.children ?? [])].map((child) => `${String((child as HTMLElement).className).split(' ')[0]}:${Math.round(child.getBoundingClientRect().top)}/${Math.round(child.getBoundingClientRect().height)}`),
    timelineParts: [...(document.querySelector('.sequencer-timeline')?.children ?? [])].map((child) => `${String((child as HTMLElement).className).split(' ')[0]}:${Math.round(child.getBoundingClientRect().height)}`),
  };
});

const results: Record<string, unknown> = {};
test.describe.configure({ mode: 'serial' });

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 900 }]) {
  test(`metrics ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seed(page);
    results[`${viewport.width}x${viewport.height}`] = await measure(page);
    fs.mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, `${viewport.width}x${viewport.height}.png`) });
  });
}

test('metrics real 200 % browser zoom (1440×900 window)', async () => {
  test.setTimeout(120000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kcs-zoom-'));
  fs.mkdirSync(path.join(dir, 'Default'), { recursive: true });
  const level = Math.log(2) / Math.log(1.2);
  fs.writeFileSync(path.join(dir, 'Default', 'Preferences'), JSON.stringify({
    partition: { default_zoom_level: { x: level }, per_host_zoom_levels: { x: { '127.0.0.1': { last_modified: '13300000000000000', zoom_level: level } } } },
  }));
  const context = await chromium.launchPersistentContext(dir, {
    channel: 'chromium', headless: true, viewport: null, deviceScaleFactor: undefined, isMobile: undefined, hasTouch: undefined, baseURL: BASE, args: ['--window-size=1440,900'],
  });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await seed(page);
    const metrics = await measure(page);
    expect(metrics.css.dpr).toBeCloseTo(2, 1); // the zoom is real, not emulated
    results['real-zoom-200'] = metrics;
    const cdp = await context.newCDPSession(page);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }) as { data: string };
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'real-zoom-200.png'), Buffer.from(data, 'base64'));
  } finally {
    await context.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 1));
});
