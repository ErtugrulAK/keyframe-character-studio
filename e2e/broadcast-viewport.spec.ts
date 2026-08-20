import { test, expect, type Page } from '@playwright/test';

/**
 * BUGFIX — BROADCAST DEFAULT VIEWPORT: entering Broadcast mode must ALWAYS
 * show the FULL artboard (all four corners visible, no crop, aspect correct),
 * regardless of the edit-mode zoom/pan state — and survive window resizes.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function makeLayer(id: string, name: string, type: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, name, type,
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1,
    fillColor: '#ff0000', strokeColor: '#101218', strokeWidth: 2, borderRadius: 0,
    width: 60, height: 60,
    ...overrides,
  };
}

async function seed(page: Page, scene: Record<string, unknown>) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([k, d]: [string, string]) => { localStorage.setItem(k, d); }, [STORAGE_KEY, JSON.stringify(scene)]);
  await page.goto('/');
  await page.waitForFunction(() => document.querySelectorAll('g[transform^="translate"]').length >= 1, undefined, { timeout: 15000 });
}

function scene() {
  // parts at the artboard EDGES — they must be visible in broadcast fit
  const edge1 = makeLayer('e1', 'Edge1', 'custom_box', { x: 800, y: 400, width: 200, height: 150, fillColor: '#ff0000' });
  const edge2 = makeLayer('e2', 'Edge2', 'custom_box', { x: -800, y: -400, width: 200, height: 150, fillColor: '#00ff00' });
  return {
    version: 1, layers: [edge1, edge2], tracks: [],
    fps: 30, totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'Viewport Fit',
  };
}

async function artboardScreenRect(page: Page) {
  return page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
    const pr = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5')!).projectResolution;
    const p1 = svg.createSVGPoint(); p1.x = 300 - pr.width / 2; p1.y = 240 - pr.height / 2;
    const p2 = svg.createSVGPoint(); p2.x = 300 + pr.width / 2; p2.y = 240 + pr.height / 2;
    const s1 = p1.matrixTransform(svg.getScreenCTM()!);
    const s2 = p2.matrixTransform(svg.getScreenCTM()!);
    return { left: s1.x, top: s1.y, right: s2.x, bottom: s2.y };
  });
}

function expectFullArtboard(rect: { left: number; top: number; right: number; bottom: number }, vp: { w: number; h: number }) {
  // all four artboard corners inside the viewport → NO crop, full fit
  expect(rect.left).toBeGreaterThanOrEqual(0);
  expect(rect.top).toBeGreaterThanOrEqual(0);
  expect(rect.right).toBeLessThanOrEqual(vp.w);
  expect(rect.bottom).toBeLessThanOrEqual(vp.h);
}

test('BROADCAST-1 — first entry fits the FULL artboard (no crop) at any edit zoom', async ({ page }) => {
  await seed(page, scene());

  // Zoom In x5 in EDIT mode (real UI)
  for (let i = 0; i < 5; i++) {
    await page.getByTitle('Zoom In (+)').click();
    await page.waitForTimeout(60);
  }
  const editViewBox = await page.evaluate(() => [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!.getAttribute('viewBox'));
  expect(editViewBox).toBe('0 0 600 480'); // edit space untouched

  // EDIT → BROADCAST
  await page.getByText('BROADCAST', { exact: true }).click();
  await page.waitForTimeout(700);
  const vp = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const rect = await artboardScreenRect(page);
  expectFullArtboard(rect, vp);
  const bcViewBox = await page.evaluate(() => [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!.getAttribute('viewBox'));
  expect(bcViewBox).toBe('-660 -300 1920 1080'); // full artboard bounds
});

test('BROADCAST-2 — clean entry is empty, then triggered edge parts are ON SCREEN', async ({ page }) => {
  await seed(page, scene());
  await page.getByText('BROADCAST', { exact: true }).click();
  await expect.poll(() => page.locator('g[transform^="translate"]').count()).toBe(0);

  await page.getByText('Sequence', { exact: true }).first().click();
  await expect.poll(() => page.locator('g[transform^="translate"]').count()).toBe(2);

  const parts = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
    return [...svg.querySelectorAll('g[transform^="translate"]')].map((g) => {
      const r = (g as SVGGElement).getBoundingClientRect();
      return {
        onScreen: r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight,
        w: r.width, h: r.height,
      };
    });
  });
  expect(parts.length).toBe(2);
  expect(parts.every((p) => p.onScreen && p.w > 0 && p.h > 0)).toBe(true);
});

test('BROADCAST-3 — resize keeps the fit (viewBox-based, no re-fit logic needed)', async ({ page }) => {
  await seed(page, scene());
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByText('BROADCAST', { exact: true }).click();
  await page.waitForTimeout(700);
  const vp1 = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const r1 = await artboardScreenRect(page);
  expectFullArtboard(r1, vp1);

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(500);
  const vp2 = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const r2 = await artboardScreenRect(page);
  expectFullArtboard(r2, vp2);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(500);
  const vp3 = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const r3 = await artboardScreenRect(page);
  expectFullArtboard(r3, vp3);
});

test('BROADCAST-4 — BROADCAST→EDIT→BROADCAST: fit is re-applied identically', async ({ page }) => {
  await seed(page, scene());
  await page.getByText('BROADCAST', { exact: true }).click();
  await page.waitForTimeout(700);
  const vp = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const first = await artboardScreenRect(page);
  expectFullArtboard(first, vp);

  await page.getByText('EDIT MODE', { exact: true }).click();
  await page.waitForTimeout(500);
  const editViewBox = await page.evaluate(() => [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!.getAttribute('viewBox'));
  expect(editViewBox).toBe('0 0 600 480'); // edit view restored

  await page.getByText('BROADCAST', { exact: true }).click();
  await page.waitForTimeout(700);
  const second = await artboardScreenRect(page);
  expectFullArtboard(second, vp);
  expect(second.left).toBeCloseTo(first.left, 1);
  expect(second.right).toBeCloseTo(first.right, 1);
});
