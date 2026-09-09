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
    const leftHandle = document.querySelector('.left-toolbar-toggle')!;
    const rightHandle = document.querySelector('.inspector-dock-toggle')!;
    const right = document.querySelector('.motion-design-right-sidebar');
    return {
      railWidth: Math.round(rail.getBoundingClientRect().width),
      drawerWidth: Math.round(drawer.getBoundingClientRect().width),
      drawerPointerEvents: getComputedStyle(drawer).pointerEvents,
      leftHandleWidth: Math.round(leftHandle.getBoundingClientRect().width),
      rightHandleWidth: Math.round(rightHandle.getBoundingClientRect().width),
      rightHandleTransition: getComputedStyle(rightHandle).transition,
      rightWidth: right ? Math.round(right.getBoundingClientRect().width) : 0,
    };
  });
  expect(expandedLayout.railWidth).toBe(56);
  expect(expandedLayout.drawerWidth).toBeGreaterThan(0);
  expect(expandedLayout.drawerPointerEvents).toBe('auto');
  expect(expandedLayout.leftHandleWidth).toBe(26);
  expect(expandedLayout.rightHandleWidth).toBe(26);
  expect(expandedLayout.rightHandleTransition).toContain('right');
  expect(expandedLayout.rightWidth).toBeGreaterThan(0);

  // Collapse the contextual drawer without changing the rail or stage origin.
  await page.getByRole('button', { name: 'Hide Left Toolbar' }).click();
  await page.waitForFunction(() => {
    const drawer = document.querySelector('.left-drawer-panel');
    return drawer && getComputedStyle(drawer).pointerEvents === 'none' && getComputedStyle(drawer).opacity === '0';
  });
  const collapsed = await canvasBox(page);
  const collapsedLayout = await page.evaluate(() => {
    const rail = document.querySelector('.left-sidebar-nav')!;
    const drawer = document.querySelector('.left-drawer-panel')!;
    const leftHandle = document.querySelector('.left-toolbar-toggle')!;
    return {
      railWidth: Math.round(rail.getBoundingClientRect().width),
      drawerHidden: drawer.getAttribute('aria-hidden') === 'true',
      drawerPointerEvents: getComputedStyle(drawer).pointerEvents,
      leftHandleWidth: Math.round(leftHandle.getBoundingClientRect().width),
    };
  });
  expect(collapsed.width).toBeCloseTo(expanded.width, 0);
  expect(collapsed.left).toBeCloseTo(expanded.left, 0);
  expect(collapsedLayout.railWidth).toBe(56);
  expect(collapsedLayout.leftHandleWidth).toBe(26);
  expect(collapsedLayout.drawerHidden).toBe(true);
  expect(collapsedLayout.drawerPointerEvents).toBe('none');
  expect(await page.getByRole('button', { name: 'Media Assets' }).isVisible()).toBe(true);
  expect(await page.locator('.stage-canvas-container').isVisible()).toBe(true);

  // Reopening restores the drawer without geometry drift.
  await page.getByRole('button', { name: 'Show Left Toolbar' }).click();
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
  expect(rest[0].zIndex).toBe('3');
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
