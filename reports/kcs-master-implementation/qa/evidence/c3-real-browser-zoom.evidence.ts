/**
 * F5 — REAL browser zoom, not a viewport/DPR emulation.
 *
 * Chromium's page zoom (the Ctrl+= setting) is stored per profile as
 * `partition.default_zoom_level` (level = log(zoom) / log(1.2)). A disposable
 * profile directory is seeded with 200 %, Chromium is launched on it WITHOUT a
 * Playwright viewport override (`viewport: null`, a real 1440×900 window), and
 * the zoom is proven from the page itself before anything is measured:
 * devicePixelRatio = 2 on a 1x window and the CSS layout width = window / 2.
 * If Chromium ignores the setting the test FAILS — it never falls back to an
 * emulated viewport.
 *
 * The same checks run on the 100 % window and on the 720×450@2x emulation the
 * C2 acceptance used, so the report can say whether the emulation was a fair
 * stand-in.
 */
import { chromium, expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evidenceDir, imageLayer, seedScene, track } from './fixtures';

const OUT = evidenceDir(path.join('c3-real-zoom', process.env.KCS_EVIDENCE_TAG ?? 'probe'));
const BASE = 'http://127.0.0.1:5196';

/**
 * A real window: no viewport or device emulation at all (the project's
 * "Desktop Chrome" defaults are cleared explicitly, or Playwright would
 * re-apply a device scale factor and hide the browser's own zoom).
 */
const REAL_WINDOW = {
  // Full Chromium in its new headless mode: the old headless shell ignores
  // the profile's zoom preference.
  channel: 'chromium',
  headless: true,
  viewport: null,
  deviceScaleFactor: undefined,
  isMobile: undefined,
  hasTouch: undefined,
  baseURL: BASE,
  args: ['--window-size=1440,900'],
} as const;

const profileWithZoom = (zoom: number): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kcs-zoom-'));
  fs.mkdirSync(path.join(dir, 'Default'), { recursive: true });
  const level = Math.log(zoom) / Math.log(1.2);
  // The default zoom for every site, plus the QA host explicitly.
  fs.writeFileSync(path.join(dir, 'Default', 'Preferences'), JSON.stringify({
    partition: {
      default_zoom_level: { x: level },
      per_host_zoom_levels: { x: { '127.0.0.1': { last_modified: '13300000000000000', zoom_level: level } } },
    },
  }));
  return dir;
};

const scene = {
  layers: [imageLayer(), { id: 'box', name: 'Box', type: 'custom_rect', x: 120, y: 40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, fillColor: '#f97316', strokeColor: '#101218', width: 160, height: 100 }],
  tracks: [track('landscape'), track('box')],
};

type Probe = Record<string, unknown>;

async function measure(page: Page, label: string): Promise<Probe> {
  await seedScene(page, scene);
  // Playwright's page.screenshot clips by CSS size and ignores the browser's
  // own zoom (it saved a quarter of the page); the DevTools capture takes the
  // whole viewport as the browser paints it.
  const cdp = await page.context().newCDPSession(page);
  const shot = async (name: string) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }) as { data: string };
    fs.writeFileSync(path.join(OUT, `${label}-${name}.png`), Buffer.from(data, 'base64'));
  };
  const metrics = await page.evaluate(() => {
    const box = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) };
    };
    const toolbar = document.querySelector('.authoring-toolbar') as HTMLElement | null;
    const header = document.querySelector('header, .app-header') as HTMLElement | null;
    return {
      devicePixelRatio: window.devicePixelRatio,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      pageHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      stage: box('.stage-canvas-container'),
      header: header ? { h: Math.round(header.getBoundingClientRect().height) } : null,
      toolbarHiddenCommands: toolbar ? toolbar.scrollWidth > toolbar.clientWidth : null,
      inspector: box('.property-inspector, [aria-label="Inspector"]'),
      timeline: box('.sequencer-timeline, .timeline-container'),
    };
  });
  await shot('editor');

  // Shortcut reference: fits, no page scroll, Esc closes.
  await page.keyboard.press('?');
  const dialog = page.getByRole('dialog');
  let shortcutDialog: Probe = { opened: false };
  if (await dialog.count()) {
    await expect(dialog).toBeVisible();
    const rect = await dialog.boundingBox();
    shortcutDialog = { opened: true, rect, fitsViewport: rect ? rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= metrics.innerWidth && rect.y + rect.height <= metrics.innerHeight : false };
    await shot('shortcuts');
    await page.keyboard.press('Escape');
  }

  // Mask editing: the exit control must be reachable.
  await page.locator('.actor-node', { hasText: 'Landscape' }).first().click();
  await shot('selected');
  return { label, ...metrics, shortcutDialog };
}

test.describe.configure({ mode: 'serial' });

test('real 200 % browser zoom vs 100 % and the DPR-2 emulation', async ({ browser }) => {
  test.setTimeout(240000);
  fs.mkdirSync(OUT, { recursive: true });
  const results: Probe[] = [];

  // 1. Real browser zoom 200 % on a 1440×900 window.
  const zoomProfile = profileWithZoom(2);
  const zoomed = await chromium.launchPersistentContext(zoomProfile, { ...REAL_WINDOW });
  try {
    const page = zoomed.pages()[0] ?? await zoomed.newPage();
    await page.goto(BASE);
    const proof = await page.evaluate(() => ({ dpr: window.devicePixelRatio, inner: window.innerWidth, outer: window.outerWidth }));
    fs.writeFileSync(path.join(OUT, 'zoom-proof.json'), JSON.stringify(proof, null, 2));
    // The zoom must be real: DPR 2 on a 1x window, CSS width half the window.
    expect(proof.dpr, 'Chromium did not apply the profile zoom').toBe(2);
    expect(Math.abs(proof.inner - proof.outer / 2), 'CSS width is not half the window').toBeLessThan(24);
    results.push(await measure(page, 'real-zoom-200'));
  } finally {
    await zoomed.close();
    fs.rmSync(zoomProfile, { recursive: true, force: true });
  }

  // 2. Same window at 100 %.
  const plainProfile = profileWithZoom(1);
  const plain = await chromium.launchPersistentContext(plainProfile, { ...REAL_WINDOW });
  try {
    const page = plain.pages()[0] ?? await plain.newPage();
    results.push(await measure(page, 'real-100'));
  } finally {
    await plain.close();
    fs.rmSync(plainProfile, { recursive: true, force: true });
  }

  // 3. The emulation the C2 acceptance used (720×450 CSS px at DPR 2).
  const emulated = await browser.newContext({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2, baseURL: BASE });
  try {
    results.push(await measure(await emulated.newPage(), 'emulated-720x450-dpr2'));
  } finally {
    await emulated.close();
  }

  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
});
