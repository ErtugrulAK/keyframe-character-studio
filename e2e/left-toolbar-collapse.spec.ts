import { test, expect, type Page } from '@playwright/test';

/**
 * UI CONTRACT — Left Toolbar collapse/expand (real browser).
 * Verifies: the 56px rail remains load-bearing, the drawer becomes hidden and
 * non-interactive, the canonical stage origin stays stable, and the canvas
 * remains usable while the Right Toolbar is unaffected.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

// Full layer shape — missing fields (e.g. visible/x/y/opacity) prevent the
// part from rendering on stage, so the seed must carry the complete shape.
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

async function seed(page: Page) {
  const scene = {
    version: 1,
    layers: [
      makeLayer('p1', 'Heading', 'custom_box', { zIndex: 1, fillColor: '#ff0000' }),
      makeLayer('p2', 'Sub', 'custom_circle', { zIndex: 2, fillColor: '#00ff00' }),
    ],
    tracks: [],
    fps: 30, totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'Toolbar Collapse',
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([k, d]: [string, string]) => { localStorage.setItem(k, d); }, [STORAGE_KEY, JSON.stringify(scene)]);
  await page.goto('/');
  await page.waitForFunction(() => document.querySelectorAll('g[transform^="translate"]').length >= 1, undefined, { timeout: 15000 });
}

function canvasBox(page: Page) {
  return page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
    const r = svg.getBoundingClientRect();
    return { width: Math.round(r.width), left: Math.round(r.left) };
  });
}

test('Left Toolbar collapse/expand — stable stage origin, hidden drawer, reachable rail', async ({ page }) => {
  await seed(page);

  // Expanded baseline
  const expanded = await canvasBox(page);
  const expandedLayout = await page.evaluate(() => {
    const rail = document.querySelector('.left-sidebar-nav')!;
    const drawer = document.querySelector('.left-drawer-panel')!;
    const right = document.querySelector('.motion-design-right-sidebar');
    return {
      railWidth: Math.round(rail.getBoundingClientRect().width),
      drawerWidth: Math.round(drawer.getBoundingClientRect().width),
      drawerPointerEvents: getComputedStyle(drawer).pointerEvents,
      rightWidth: right ? Math.round(right.getBoundingClientRect().width) : 0,
    };
  });
  expect(expandedLayout.railWidth).toBe(56);
  expect(expandedLayout.drawerWidth).toBeGreaterThan(0);
  expect(expandedLayout.drawerPointerEvents).toBe('auto');
  expect(expandedLayout.rightWidth).toBeGreaterThan(0);

  // Collapse the contextual drawer without changing the rail or stage origin.
  await page.getByTitle('Collapse toolbar').click();
  await page.waitForFunction(() => {
    const drawer = document.querySelector('.left-drawer-panel');
    return drawer && getComputedStyle(drawer).pointerEvents === 'none' && getComputedStyle(drawer).opacity === '0';
  });
  const collapsed = await canvasBox(page);
  const collapsedLayout = await page.evaluate(() => {
    const rail = document.querySelector('.left-sidebar-nav')!;
    const drawer = document.querySelector('.left-drawer-panel')!;
    return {
      railWidth: Math.round(rail.getBoundingClientRect().width),
      drawerHidden: drawer.getAttribute('aria-hidden') === 'true',
      drawerPointerEvents: getComputedStyle(drawer).pointerEvents,
    };
  });
  expect(collapsed.width).toBeCloseTo(expanded.width, 0);
  expect(collapsed.left).toBeCloseTo(expanded.left, 0);
  expect(collapsedLayout.railWidth).toBe(56);
  expect(collapsedLayout.drawerHidden).toBe(true);
  expect(collapsedLayout.drawerPointerEvents).toBe('none');
  expect(await page.getByTitle('Media Assets').isVisible()).toBe(true);
  expect(await page.locator('.stage-canvas-container').isVisible()).toBe(true);

  // Reopening restores the drawer without geometry drift.
  await page.getByTitle('Expand toolbar').click();
  await page.waitForFunction(() => {
    const drawer = document.querySelector('.left-drawer-panel');
    return drawer && getComputedStyle(drawer).pointerEvents === 'auto' && getComputedStyle(drawer).opacity === '1';
  });
  const reExpanded = await canvasBox(page);
  const reopenedDrawerWidth = await page.locator('.left-drawer-panel').evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(reExpanded.width).toBeCloseTo(expanded.width, 0);
  expect(reExpanded.left).toBeCloseTo(expanded.left, 0);
  expect(reopenedDrawerWidth).toBe(expandedLayout.drawerWidth);

  // Right Toolbar width remains unchanged across the toggle.
  const rightWidth1 = await page.locator('.motion-design-right-sidebar').evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(rightWidth1).toBe(expandedLayout.rightWidth);

  // The Right Toolbar has no collapse control; its width is independently
  // managed and must not introduce horizontal overflow with the rail collapsed.
  await page.waitForFunction(() => document.documentElement.scrollWidth <= window.innerWidth);
  await page.getByTitle('Collapse toolbar').click();
  await expect(page.getByTitle('Expand toolbar')).toBeVisible();

  // Supported compact QA viewport keeps the control reachable.
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(page.getByTitle('Expand toolbar')).toBeVisible();
  await page.getByTitle('Expand toolbar').click();
  await expect(page.locator('.stage-canvas-container')).toBeVisible();
  const afterResize = await canvasBox(page);
  expect(afterResize.width).toBeGreaterThan(200);
});
