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
    const drawer = document.querySelector('.left-drawer-panel');
    if (!dock || !drawer) return false;
    const dockStyle = getComputedStyle(dock);
    const drawerStyle = getComputedStyle(drawer);
    return dockStyle.width === '0px'
      && dockStyle.minWidth === '0px'
      && dockStyle.flexBasis === '0px'
      && drawerStyle.pointerEvents === 'none'
      && drawerStyle.opacity === '0'
      && drawerStyle.width === '0px'
      && drawerStyle.minWidth === '0px'
      && drawerStyle.flexBasis === '0px';
  });
  const collapsed = await canvasBox(page);
  expect(collapsed.width).toBeGreaterThan(expanded.width + 200);
  expect(collapsed.left).toBeLessThan(expanded.left - 200);
  const collapsedLayout = await page.evaluate(() => {
    const dock = document.querySelector('.left-toolbar-container')!;
    const rail = document.querySelector('.left-sidebar-nav')!;
    const drawer = document.querySelector('.left-drawer-panel')!;
    const leftHandle = document.querySelector('.left-toolbar-toggle')!;
    const dockStyle = getComputedStyle(dock);
    const drawerStyle = getComputedStyle(drawer);
    const drawerRect = drawer.getBoundingClientRect();
    const handleRect = leftHandle.getBoundingClientRect();
    return {
      dockWidth: Math.round(dock.getBoundingClientRect().width),
      dockMinWidth: dockStyle.minWidth,
      dockFlexBasis: dockStyle.flexBasis,
      railWidth: Math.round(rail.getBoundingClientRect().width),
      drawerWidth: Math.round(drawerRect.width),
      drawerMinWidth: drawerStyle.minWidth,
      drawerFlexBasis: drawerStyle.flexBasis,
      drawerHidden: drawer.getAttribute('aria-hidden') === 'true',
      dockHidden: dock.getAttribute('aria-hidden') === 'true',
      drawerVisibility: drawerStyle.visibility,
      drawerPointerEvents: drawerStyle.pointerEvents,
      leftHandleWidth: Math.round(handleRect.width),
      leftHandleLeft: Math.round(handleRect.left),
      leftHandleRight: Math.round(handleRect.right),
      railLeft: Math.round(rail.getBoundingClientRect().left),
    };
  });
  expect(collapsedLayout.dockWidth).toBe(0);
  expect(collapsedLayout.dockMinWidth).toBe('0px');
  expect(collapsedLayout.dockFlexBasis).toBe('0px');
  expect(collapsedLayout.railWidth).toBe(0);
  expect(collapsedLayout.drawerWidth).toBe(0);
  expect(collapsedLayout.drawerMinWidth).toBe('0px');
  expect(collapsedLayout.drawerFlexBasis).toBe('0px');
  expect(collapsedLayout.drawerVisibility).toBe('hidden');
  expect(collapsedLayout.leftHandleLeft).toBe(0);
  expect(collapsedLayout.leftHandleRight).toBe(collapsedLayout.leftHandleWidth);
  expect(collapsedLayout.drawerHidden).toBe(true);
  expect(collapsedLayout.dockHidden).toBe(true);
  expect(collapsedLayout.drawerPointerEvents).toBe('none');
  expect(await page.getByRole('button', { name: 'Media Assets' }).count()).toBe(0);
  expect(await page.locator('.stage-canvas-container').isVisible()).toBe(true);

  // Reopening restores the drawer without geometry drift.
  await page.getByRole('button', { name: 'Show Left Toolbar' }).click();
  await page.waitForFunction(() => {
    const drawer = document.querySelector('.left-drawer-panel');
    if (!drawer) return false;
    const style = getComputedStyle(drawer);
    return style.pointerEvents === 'auto'
      && style.opacity === '1'
      && style.width === '280px'
      && style.minWidth === '280px'
      && style.flexBasis === '280px';
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

test('Sidebar handles keep a mirrored narrow visual contract across interaction states', async ({ page }) => {
  await seed(page);
  const selectors = ['.left-toolbar-toggle', '.inspector-dock-toggle'];

  const readHandle = (selector: string) => page.locator(selector).evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const icon = element.querySelector('svg')?.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      minWidth: style.minWidth,
      minHeight: style.minHeight,
      padding: style.padding,
      margin: style.margin,
      borderWidth: style.borderWidth,
      borderRadius: style.borderRadius,
      position: style.position,
      zIndex: style.zIndex,
      outlineWidth: style.outlineWidth,
      outlineOffset: style.outlineOffset,
      outlineStyle: style.outlineStyle,
      before: getComputedStyle(element, '::before').content,
      after: getComputedStyle(element, '::after').content,
      ariaLabel: element.getAttribute('aria-label'),
      title: element.getAttribute('title'),
      iconWidth: icon?.width ?? 0,
      iconHeight: icon?.height ?? 0,
    };
  });

  const rest = await Promise.all(selectors.map(readHandle));
  expect(Math.abs(rest[0].width - rest[1].width)).toBeLessThanOrEqual(2);
  expect(Math.abs(rest[0].height - rest[1].height)).toBeLessThanOrEqual(2);
  expect(rest[0].width).toBeGreaterThanOrEqual(24);
  expect(rest[0].width).toBeLessThanOrEqual(28);
  expect(rest[0].height).toBeGreaterThanOrEqual(44);
  expect(rest[0].height).toBeLessThanOrEqual(50);
  expect(rest[0].borderWidth).toBe(rest[1].borderWidth);
  expect(rest[0].borderRadius).toBe(rest[1].borderRadius);
  expect(rest[0].iconWidth).toBe(rest[1].iconWidth);
  expect(rest[0].iconHeight).toBe(rest[1].iconHeight);
  expect(rest[0].position).toBe('absolute');
  expect(rest[1].position).toBe('absolute');
  expect(rest[0].zIndex).toBe('100');
  expect(rest[1].zIndex).toBe('100');
  expect(rest.every((handle) => handle.before === 'none' && handle.after === 'none')).toBe(true);
  expect(rest.every((handle) => handle.title === null && handle.ariaLabel)).toBe(true);

  for (const selector of selectors) {
    await page.locator(selector).hover({ force: true });
    const hover = await readHandle(selector);
    expect(hover.width).toBe(rest[selectors.indexOf(selector)].width);
    expect(hover.height).toBe(rest[selectors.indexOf(selector)].height);
    expect(hover.outlineStyle).toBe('none');
  }

  for (const selector of selectors) {
    await page.locator(selector).focus();
    const focus = await readHandle(selector);
    expect(focus.width).toBe(rest[selectors.indexOf(selector)].width);
    expect(focus.height).toBe(rest[selectors.indexOf(selector)].height);
    expect(focus.outlineStyle).toBe('solid');
    expect(focus.outlineWidth).toBe('2px');
    expect(focus.outlineOffset).toBe('-2px');
  }

  await page.locator('.left-toolbar-toggle').click();
  const collapsedLeft = await readHandle('.left-toolbar-toggle');
  expect(collapsedLeft.width).toBe(rest[0].width);
  expect(collapsedLeft.height).toBe(rest[0].height);
  await page.locator('.left-toolbar-toggle').click();
  await page.locator('.inspector-dock-toggle').click({ force: true });
  const hiddenRight = await readHandle('.inspector-dock-toggle');
  expect(hiddenRight.width).toBe(rest[1].width);
  expect(hiddenRight.height).toBe(rest[1].height);
});
