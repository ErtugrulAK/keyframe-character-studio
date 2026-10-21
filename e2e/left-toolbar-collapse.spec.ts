import { test, expect, type Page } from '@playwright/test';

/**
 * UI CONTRACT — Left Toolbar collapse/expand (real browser).
 * Visibility is parent-owned: hidden left dock has zero footprint and its
 * content is inaccessible, while a sibling handle remains reachable at x=0.
 * Expanded layout gives the stage the dock footprint and centres the handle
 * on the sidebar's far-right boundary.
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
  // Layout-settled gate (root cause of the load-only red): the left dock
  // reaches its expanded width through a mount transition. Measuring the
  // expanded baseline mid-transition breaks the arithmetic contract
  // (dockWidth = railWidth + drawerWidth) — under contention the first
  // evaluate could land there while a clean run measured after settle.
  // This waits for the real condition: a consistent, non-zero geometry.
  await page.waitForFunction(() => {
    const dock = document.querySelector('.left-toolbar-container');
    const rail = document.querySelector('.left-sidebar-nav');
    const drawer = document.querySelector('.left-drawer-panel');
    if (!dock || !rail || !drawer) return false;
    const dockWidth = dock.getBoundingClientRect().width;
    const drawerWidth = drawer.getBoundingClientRect().width;
    return drawerWidth > 0 && Math.abs(dockWidth - (rail.getBoundingClientRect().width + drawerWidth)) <= 1;
  }, undefined, { timeout: 15000 });
}

/**
 * The layout footprint of the canvas surface. The stage SVG itself carries the
 * camera transform (which deliberately holds the authored world still while the
 * panels change), so the dock contract is measured on the stage container.
 */
function canvasBox(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector('.stage-canvas-container')!;
    const r = stage.getBoundingClientRect();
    return { width: Math.round(r.width), left: Math.round(r.left) };
  });
}

/**
 * Wait until the docked edge has genuinely COMPLETED its travel.
 *
 * `useDockedPanelEdge` commits the target class first and only then lets the
 * frame ease write its first interpolated width on the next animation frame.
 * A scalar target check can therefore resolve TRUE on the pre-motion target
 * flash and the driver's next roundtrip measures the reversed, mid-flight
 * geometry — the V71 full-suite failure (stage 908 where 548 was expected).
 * Real completion is observable: the ease hands the inline edge-width
 * override back to the stylesheet, the dock resolves to its target, and the
 * whole geometry signature (dock, drawer, stage box, container polish
 * transitions) then survives consecutive animation frames unchanged. The
 * pending-start flash cannot survive the ease's first write, a mid-flight
 * value changes every frame, and a reduced-motion snap is settled from its
 * first frame — all three are distinguished without sleeps or retries.
 */
type EdgeTarget = { dockWidth: number; expanded: boolean };
async function waitForDockedEdgeSettled(page: Page, want: EdgeTarget): Promise<void> {
  await page.waitForFunction((target) => new Promise<boolean>((resolve) => {
    const at100 = (value: number) => Math.round(value * 100) / 100;
    let previous = '';
    let stable = 0;
    const tick = (): void => {
      const dock = document.querySelector<HTMLElement>('.left-toolbar-container');
      const drawer = document.querySelector('.left-drawer-panel');
      const stage = document.querySelector('.stage-canvas-container');
      if (!dock || !drawer || !stage) { requestAnimationFrame(tick); return; }
      const style = getComputedStyle(dock);
      const targetReached = target.expanded
        ? dock.style.width === ''
          && Math.round(dock.getBoundingClientRect().width) === target.dockWidth
          && getComputedStyle(drawer).opacity === '1'
        : dock.style.width === ''
          && dock.getBoundingClientRect().width === 0
          && style.visibility === 'hidden';
      const key = targetReached
        ? [
            dock.style.width,
            at100(dock.getBoundingClientRect().width),
            at100(drawer.getBoundingClientRect().width),
            at100(stage.getBoundingClientRect().width),
            at100(stage.getBoundingClientRect().left),
            style.opacity,
            style.transform,
          ].join('|')
        : 'pending';
      stable = targetReached && key === previous ? stable + 1 : 0;
      previous = key;
      if (stable >= 3) resolve(true);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), want, { timeout: 15000 });
}

test('Left Toolbar collapse/expand — stable stage origin, hidden drawer, reachable rail', async ({ page }) => {
  // The normal-motion contract is asserted against the host-independent
  // animation intent, not whatever the machine's OS setting happens to be.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
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
      // The hit target straddles the drawer's empty boundary gutter.
      leftHandleLeft: Math.round(handleRect.left),
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
  expect(Math.abs(expandedLayout.leftHandleLeft + expandedLayout.leftHandleWidth / 2 - expandedLayout.drawerRight)).toBeLessThanOrEqual(1);
  expect(expandedLayout.drawerPointerEvents).toBe('auto');
  expect(expandedLayout.drawerVisibility).toBe('visible');
  // R4-01 — the compact edge-handle family: a thin vertical pill, chevron only.
  expect(expandedLayout.leftHandleWidth).toBe(20);
  expect(expandedLayout.rightHandleWidth).toBe(20);
  expect(expandedLayout.rightHandleTransition).toContain('right');
  expect(expandedLayout.rightWidth).toBeGreaterThan(0);

  // Collapse the contextual drawer; the in-flow rail expands the canvas footprint.
  await page.getByRole('button', { name: 'Hide Left Toolbar' }).click();
  await waitForDockedEdgeSettled(page, { dockWidth: 0, expanded: false });
  const collapsed = await canvasBox(page);
  expect(collapsed.width).toBeGreaterThan(expanded.width + 200);
  expect(collapsed.left).toBeLessThan(expanded.left - 200);
  // The footprint the dock relinquished is exactly what the stage regained —
  // an arithmetic expectation independent of the >200 reachability bound.
  expect(collapsed.width).toBeCloseTo(expanded.width + expandedLayout.dockWidth, 0);
  expect(collapsed.left).toBeCloseTo(expanded.left - expandedLayout.dockWidth, 0);
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
  await expect(page.getByRole('button', { name: 'Show Left Toolbar' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Show Left Toolbar' })).toHaveAttribute('aria-controls', 'left-toolbar-panel');
  await expect(page.locator('.left-toolbar-container')).toHaveAttribute('inert', '');
  expect(await page.getByRole('button', { name: 'Media Assets' }).count()).toBe(0);
  expect(await page.locator('.stage-canvas-container').isVisible()).toBe(true);

  // Reopening restores the drawer without geometry drift.
  await page.getByRole('button', { name: 'Show Left Toolbar' }).click();
  await waitForDockedEdgeSettled(page, { dockWidth: expandedLayout.dockWidth, expanded: true });
  const reExpanded = await canvasBox(page);
  const reopenedDrawerWidth = await page.locator('.left-drawer-panel').evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(reExpanded.width).toBeCloseTo(expanded.width, 0);
  expect(reExpanded.left).toBeCloseTo(expanded.left, 0);
  expect(reopenedDrawerWidth).toBe(expandedLayout.drawerWidth);

  // The reopened dock is again its own arithmetic, measured independently of
  // the baseline snapshot, and the handle/dock a11y state has flipped back.
  const reopenedLayout = await page.evaluate(() => {
    const dock = document.querySelector('.left-toolbar-container')!;
    const rail = document.querySelector('.left-sidebar-nav')!;
    const drawer = document.querySelector('.left-drawer-panel')!;
    return {
      dockWidth: Math.round(dock.getBoundingClientRect().width),
      railWidth: Math.round(rail.getBoundingClientRect().width),
      drawerWidth: Math.round(drawer.getBoundingClientRect().width),
    };
  });
  expect(reopenedLayout.dockWidth).toBe(reopenedLayout.railWidth + reopenedLayout.drawerWidth);
  expect(reopenedLayout.railWidth).toBe(expandedLayout.railWidth);
  await expect(page.getByRole('button', { name: 'Hide Left Toolbar' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Hide Left Toolbar' })).toHaveAttribute('aria-controls', 'left-toolbar-panel');
  await expect(page.locator('.left-toolbar-container')).not.toHaveAttribute('inert');

  // Right Toolbar width remains unchanged across the toggle.
  const rightWidth1 = await page.locator('.motion-design-right-sidebar').evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(rightWidth1).toBe(expandedLayout.rightWidth);

  // The Right Toolbar has no collapse control; its width is independently
  // managed and must not introduce horizontal overflow with the rail collapsed.
  await page.waitForFunction(() => document.documentElement.scrollWidth <= window.innerWidth);
  // The same toggle the keyboard must drive: Enter activates the focused handle.
  await page.getByRole('button', { name: 'Hide Left Toolbar' }).press('Enter');
  await waitForDockedEdgeSettled(page, { dockWidth: 0, expanded: false });
  await expect(page.getByRole('button', { name: 'Show Left Toolbar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show Left Toolbar' })).toBeFocused();

  // Supported compact QA viewport keeps the control reachable.
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(page.getByRole('button', { name: 'Show Left Toolbar' })).toBeVisible();
  // Space is the global play/pause shortcut (useKeyboardShortcuts owns it and
  // preventDefaults), so it deliberately does NOT activate the handle here.
  // The keyboard reopen rides the RETAINED focus with a bare key press, then
  // waits for the genuinely completed ease before any final assertion.
  await expect(page.getByRole('button', { name: 'Show Left Toolbar' })).toBeFocused();
  await page.keyboard.press('Enter');
  await waitForDockedEdgeSettled(page, { dockWidth: expandedLayout.dockWidth, expanded: true });
  await expect(page.getByRole('button', { name: 'Hide Left Toolbar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hide Left Toolbar' })).toHaveAttribute('aria-expanded', 'true');
  const finalLayout = await page.evaluate(() => {
    const dock = document.querySelector('.left-toolbar-container')!;
    const rail = document.querySelector('.left-sidebar-nav')!;
    const drawer = document.querySelector('.left-drawer-panel')!;
    return {
      dockWidth: Math.round(dock.getBoundingClientRect().width),
      railWidth: Math.round(rail.getBoundingClientRect().width),
      drawerWidth: Math.round(drawer.getBoundingClientRect().width),
    };
  });
  expect(finalLayout.dockWidth).toBe(finalLayout.railWidth + finalLayout.drawerWidth);

  await expect(page.locator('.stage-canvas-container')).toBeVisible();
  const afterResize = await canvasBox(page);
  expect(afterResize.width).toBeGreaterThan(200);
});

/**
 * Reduced-motion boundary: the hook's documented snap path. With no frame
 * ease scheduled there is no pending-start window at all — the very next
 * observation after the toggle must already be the resting target, and it
 * must still be that after the settled-edge gate ran.
 */
test('prefers-reduced-motion — the docked edge snaps to its resting target', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page);
  const expanded = await canvasBox(page);
  const baselineDockWidth = await page.locator('.left-toolbar-container')
    .evaluate((element) => Math.round(element.getBoundingClientRect().width));

  await page.getByRole('button', { name: 'Hide Left Toolbar' }).click();
  const snapped = await page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>('.left-toolbar-container')!;
    const stage = document.querySelector('.stage-canvas-container')!;
    return {
      dockWidth: dock.getBoundingClientRect().width,
      dockInlineWidth: dock.style.width,
      visibility: getComputedStyle(dock).visibility,
      stageWidth: Math.round(stage.getBoundingClientRect().width),
    };
  });
  expect(snapped.dockWidth).toBe(0);
  expect(snapped.dockInlineWidth).toBe('');
  expect(snapped.visibility).toBe('hidden');
  expect(snapped.stageWidth).toBeGreaterThan(expanded.width + 200);
  await waitForDockedEdgeSettled(page, { dockWidth: 0, expanded: false });

  await page.getByRole('button', { name: 'Show Left Toolbar' }).click();
  const reopened = await page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>('.left-toolbar-container')!;
    const stage = document.querySelector('.stage-canvas-container')!;
    return {
      dockWidth: Math.round(dock.getBoundingClientRect().width),
      dockInlineWidth: dock.style.width,
      stageWidth: Math.round(stage.getBoundingClientRect().width),
      stageLeft: Math.round(stage.getBoundingClientRect().left),
    };
  });
  expect(reopened.dockInlineWidth).toBe('');
  expect(reopened.dockWidth).toBe(baselineDockWidth);
  expect(reopened.stageWidth).toBeCloseTo(expanded.width, 0);
  expect(reopened.stageLeft).toBeCloseTo(expanded.left, 0);
  await waitForDockedEdgeSettled(page, { dockWidth: baselineDockWidth, expanded: true });
});
