import { test, expect, type Page } from '@playwright/test';

/**
 * UI CONTRACT — Left Toolbar collapse/expand (real browser).
 * Visibility is parent-owned: hidden left dock has zero footprint and its
 * content is inaccessible, while a sibling handle remains reachable at x=0.
 * Expanded layout gives the stage the left dock footprint and anchors its handle
 * at the full sidebar's far-right edge.
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
  const expanded = await canvasBox(page);
  // Expanded baseline
  const expandedLayout = await page.evaluate(() => {
    const dock = document.querySelector('.left-toolbar-container')!;
    const rail = document.querySelector('.left-sidebar-nav')!;
    const drawer = document.querySelector('.left-drawer-panel')!;
    const leftHandle = document.querySelector('.left-toolbar-toggle')!;
    const rightHandle = document.querySelector('.inspector-dock-toggle')!;
    const right = document.querySelector('.motion-design-right-sidebar');
    const drawerStyle = getComputedStyle(drawer);
    const drawerRect = drawer.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    const handleRect = leftHandle.getBoundingClientRect();
    return {
      dockWidth: Math.round(dockRect.width),
      railWidth: Math.round(rail.getBoundingClientRect().width),
      drawerWidth: Math.round(drawerRect.width),
      drawerMinWidth: drawerStyle.minWidth,
      drawerFlexBasis: drawerStyle.flexBasis,
      drawerPointerEvents: drawerStyle.pointerEvents,
      drawerVisibility: drawerStyle.visibility,
      leftHandleWidth: Math.round(handleRect.width),
      leftHandleCenter: Math.round(handleRect.left + handleRect.width / 2),
      drawerRight: Math.round(drawerRect.right),
      rightHandleWidth: Math.round(rightHandle.getBoundingClientRect().width),
      rightHandleTransition: getComputedStyle(rightHandle).transition,
      rightWidth: right ? Math.round(right.getBoundingClientRect().width) : 0,
    };
  });
  expect(expandedLayout.dockWidth).toBe(expandedLayout.railWidth + expandedLayout.drawerWidth);
  expect(expandedLayout.railWidth).toBe(56);
  expect(expandedLayout.drawerWidth).toBeGreaterThan(0);
  expect(expandedLayout.drawerMinWidth).toBe(`${expandedLayout.drawerWidth}px`);
  expect(Math.abs(expandedLayout.leftHandleCenter - expandedLayout.drawerRight)).toBeLessThanOrEqual(1);
  expect(expandedLayout.drawerPointerEvents).toBe('auto');
  expect(expandedLayout.drawerVisibility).toBe('visible');
  expect(expandedLayout.leftHandleWidth).toBe(26);
  expect(expandedLayout.rightHandleWidth).toBe(26);
  expect(expandedLayout.rightHandleTransition).toContain('right');
  expect(expandedLayout.rightWidth).toBeGreaterThan(0);

  // Collapse the contextual drawer; the in-flow rail expands the canvas footprint.
  await page.getByRole('button', { name: 'Hide Left Toolbar' }).click();
  await page.waitForFunction(() => {
    const dock = document.querySelector('.left-toolbar-container');
    return !!dock && dock.getBoundingClientRect().width === 0
      && getComputedStyle(dock).visibility === 'hidden';
  });
  const collapsed = await canvasBox(page);
  expect(collapsed.width).toBeGreaterThan(expanded.width + 200);
  expect(collapsed.left).toBeLessThan(expanded.left - 200);
  const collapsedLayout = await page.evaluate(() => {
    const dock = document.querySelector('.left-toolbar-container')!;
    const drawer = document.querySelector('.left-drawer-panel')!;
    const leftHandle = document.querySelector('.left-toolbar-toggle')!;
    const handleRect = leftHandle.getBoundingClientRect();
    return {
      dockWidth: Math.round(dock.getBoundingClientRect().width),
      drawerHidden: drawer.getAttribute('aria-hidden') === 'true',
      dockHidden: dock.getAttribute('aria-hidden') === 'true',
      dockVisibility: getComputedStyle(dock).visibility,
      leftHandleWidth: Math.round(handleRect.width),
      leftHandleLeft: Math.round(handleRect.left),
      leftHandleRight: Math.round(handleRect.right),
    };
  });
  expect(collapsedLayout.dockWidth).toBe(0);
  expect(collapsedLayout.dockVisibility).toBe('hidden');
  expect(collapsedLayout.leftHandleLeft).toBe(0);
  expect(collapsedLayout.leftHandleRight).toBe(collapsedLayout.leftHandleWidth);
  expect(collapsedLayout.drawerHidden).toBe(true);
  expect(collapsedLayout.dockHidden).toBe(true);
  expect(await page.getByRole('button', { name: 'Media Assets' }).count()).toBe(0);
  expect(await page.locator('.stage-canvas-container').isVisible()).toBe(true);

  // Reopening restores the drawer without geometry drift.
  await page.getByRole('button', { name: 'Show Left Toolbar' }).click();
  await page.waitForFunction((expandedWidth) => {
    const dock = document.querySelector('.left-toolbar-container');
    const drawer = document.querySelector('.left-drawer-panel');
    return !!dock && !!drawer
      && Math.round(dock.getBoundingClientRect().width) === expandedWidth
      && getComputedStyle(drawer).opacity === '1';
  }, expandedLayout.dockWidth);
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
  await page.getByRole('button', { name: 'Hide Left Toolbar' }).click();
  await expect(page.getByRole('button', { name: 'Show Left Toolbar' })).toBeVisible();

  // Supported compact QA viewport keeps the control reachable.
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(page.getByRole('button', { name: 'Show Left Toolbar' })).toBeVisible();
  await page.getByRole('button', { name: 'Show Left Toolbar' }).click();
  await expect(page.locator('.stage-canvas-container')).toBeVisible();
  const afterResize = await canvasBox(page);
  expect(afterResize.width).toBeGreaterThan(200);
});
