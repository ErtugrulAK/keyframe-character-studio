import { test, expect, type Page } from '@playwright/test';

/**
 * R5-01 / R5-02 — the panel edge handles, in a real browser.
 *
 * Handles are centred on the panel boundary's empty gutter, never on content.
 * Their vertical anchor remains the workspace row's top edge, independent of
 * timeline height.
 *
 * R5-02: the handles belong to the handle layer of the editor stack, so an open
 * overlay paints OVER them: the export dropdown and the GIF panel are owned by
 * the chrome band above that layer, and a dialog sits above everything.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
/** Half a pixel of layout rounding, and nothing more. */
const TOLERANCE = 1;

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

async function seed(page: Page): Promise<void> {
  const layers = [
    { id: 'alpha', name: 'Alpha', type: 'custom_rect', x: -80, y: -40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, fillColor: '#22d3ee', strokeColor: '#101218', fillEnabled: true, strokeEnabled: false, width: 160, height: 120 },
    { id: 'beta', name: 'Beta', type: 'custom_rect', x: 90, y: 60, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#f97316', strokeColor: '#101218', fillEnabled: true, strokeEnabled: false, width: 120, height: 90 },
  ];
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers,
    tracks: layers.map((layer) => ({ partId: layer.id, name: layer.name, channels: channel() })),
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript((payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value), { key: STORAGE_KEY, value: scene });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await expect(page.locator('.inspector-section-title').first()).toBeVisible();
}

/** One rect, in viewport coordinates. */
interface Box {
  x: number;
  y: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** A leaf element that actually paints text inside a panel. */
interface TextLeaf extends Omit<Box, 'width' | 'height'> {
  cls: string;
  text: string;
}

/** The dock geometry of one layout state: the handles, the panels, the row. */
export interface DockBoundaryReport {
  leftHandle: Box | null;
  rightHandle: Box | null;
  drawer: Box | null;
  inspector: Box | null;
  row: Box | null;
  timeline: Box | null;
  drawerText: TextLeaf[];
  inspectorText: TextLeaf[];
}

/**
 * The handle's centre is the dock boundary; no text-bearing leaf or control is covered.
 */
async function dockBoundaryReport(page: Page): Promise<DockBoundaryReport> {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const textLeaves = (selector: string) => {
      const root = document.querySelector(selector);
      if (!root) return [];
      const out: { cls: string; text: string; x: number; y: number; right: number; bottom: number }[] = [];
      for (const node of Array.from(root.querySelectorAll('*'))) {
        // C7 — a control (a disclosure chevron, an icon button, a field) is
        // content too, even when it paints no text of its own.
        const control = node.matches('button, [role="button"], input, select, textarea');
        if (node.children.length > 0 && !control) continue;
        const text = (node.textContent ?? '').trim() || (control ? node.getAttribute('aria-label') ?? node.tagName : '');
        if (!text) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        out.push({
          cls: typeof (node as HTMLElement).className === 'string' ? (node as HTMLElement).className : '(svg)',
          text: text.slice(0, 40),
          x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom,
        });
      }
      return out;
    };
    return {
      leftHandle: box('.left-toolbar-toggle'),
      rightHandle: box('.inspector-dock-toggle'),
      drawer: box('.left-drawer-panel'),
      inspector: box('.motion-design-right-sidebar'),
      row: box('.main-layout'),
      timeline: box('.sequencer-timeline'),
      drawerText: textLeaves('#left-toolbar-panel'),
      inspectorText: textLeaves('.motion-design-right-sidebar'),
    };
  });
}

/**
 * The handle stays centred on the open panel boundary (or retires fully inside
 * the viewport edge), clear of panel text and above the timeline.
 */
function expectHandleBoundary(
  label: string,
  report: DockBoundaryReport,
  side: 'left' | 'right',
  panelOpen: boolean,
) {
  const handle = side === 'left' ? report.leftHandle : report.rightHandle;
  const panel = side === 'left' ? report.drawer : report.inspector;
  expect(handle, `${label}: the ${side} handle is missing`).not.toBeNull();
  expect(panel, `${label}: the ${side} panel is missing`).not.toBeNull();
  expect(report.row, `${label}: the workspace row is missing`).not.toBeNull();
  expect(report.timeline, `${label}: the timeline is missing`).not.toBeNull();

  if (panelOpen) {
    expect(panel!.width, `${label}: the ${side} panel should be open`).toBeGreaterThan(0);
    if (side === 'left') {
      expect(Math.abs(handle!.x + handle!.width / 2 - panel!.right), `${label}: the left handle lost the drawer boundary`).toBeLessThanOrEqual(TOLERANCE);
    } else {
      expect(Math.abs(handle!.x + handle!.width / 2 - panel!.x), `${label}: the right handle lost the inspector boundary`).toBeLessThanOrEqual(TOLERANCE);
    }
  } else if (side === 'left') {
    expect(Math.abs(handle!.x), `${label}: the hidden-drawer handle left the edge`).toBeLessThanOrEqual(TOLERANCE);
  } else {
    expect(Math.abs(handle!.right - report.row!.right), `${label}: the hidden-inspector handle left the edge`).toBeLessThanOrEqual(TOLERANCE);
  }

  // It rides the workspace row (the box a timeline resize shortens from below),
  // so it never paints over the timeline and never leaves the workspace.
  expect(handle!.y, `${label}: the ${side} handle left the workspace row`).toBeGreaterThanOrEqual(report.row!.y - TOLERANCE);
  expect(handle!.bottom, `${label}: the ${side} handle left the workspace row`).toBeLessThanOrEqual(report.row!.bottom + TOLERANCE);
  expect(handle!.bottom, `${label}: the ${side} handle paints over the timeline`).toBeLessThanOrEqual(report.timeline!.y + TOLERANCE);

  // No text-bearing leaf inside the panel is underneath either handle.
  const panelText = panelOpen ? (side === 'left' ? report.drawerText : report.inspectorText) : [];
  for (const leaf of panelText) {
    const intersected = handle!.x < leaf.right && handle!.right > leaf.x && handle!.y < leaf.bottom && handle!.bottom > leaf.y;
    expect(intersected, `${label}: the ${side} handle covers "${leaf.text}" (${leaf.cls})`).toBe(false);
  }
}

test('R5-01 — both dock handles are anchored to the panel boundary, never to panel content', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  // Default layout.
  const atDefault = await dockBoundaryReport(page);
  expectHandleBoundary('default', atDefault, 'left', true);
  expectHandleBoundary('default', atDefault, 'right', true);
  // Symmetric vertical anchor: both handles ride the same inset.
  expect(Math.abs(atDefault.leftHandle!.y - atDefault.rightHandle!.y)).toBeLessThanOrEqual(TOLERANCE);

  const resizer = page.getByTestId('timeline-height-resizer');
  const timelineHeight = () => page.evaluate(() => document.querySelector('[data-testid="sequencer-timeline"]')!.getBoundingClientRect().height);
  const drag = async (deltaY: number) => {
    const box = (await resizer.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + deltaY, { steps: 12 });
    await page.mouse.up();
  };

  // Minimum timeline height.
  await drag(400);
  const atMinimum = await timelineHeight();
  expect(atMinimum).toBeLessThan(200);
  const minReport = await dockBoundaryReport(page);
  expectHandleBoundary('timeline minimum', minReport, 'left', true);
  expectHandleBoundary('timeline minimum', minReport, 'right', true);

  // Maximum timeline height.
  let atMaximum = atMinimum;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await drag(-200);
    const next = await timelineHeight();
    if (next === atMaximum) break;
    atMaximum = next;
  }
  expect(atMaximum, 'the drag never resized the panel').toBeGreaterThan(atMinimum + 40);
  const maxReport = await dockBoundaryReport(page);
  expectHandleBoundary('timeline maximum', maxReport, 'left', true);
  expectHandleBoundary('timeline maximum', maxReport, 'right', true);

  // Short viewport (the compact QA window).
  await drag(2000);
  await page.setViewportSize({ width: 1120, height: 620 });
  await expect.poll(timelineHeight).toBeGreaterThan(0);
  const shortReport = await dockBoundaryReport(page);
  expectHandleBoundary('short viewport', shortReport, 'left', true);
  expectHandleBoundary('short viewport', shortReport, 'right', true);

  // Left panel closed: the handle retires to the viewport edge and stays
  // reachable, with its accessible name flipped to the restore action.
  await page.setViewportSize({ width: 1440, height: 900 });
  const leftToggle = page.getByRole('button', { name: 'Hide Left Toolbar' });
  await expect(leftToggle).toHaveAttribute('aria-controls', 'left-toolbar-panel');
  expect(await page.locator('#left-toolbar-panel').count()).toBe(1);
  await leftToggle.click();
  await expect(page.getByRole('button', { name: 'Show Left Toolbar' })).toBeVisible();
  // The handle rides the collapsing edge, so let that 240ms ride settle.
  await expect.poll(async () => Math.round((await dockBoundaryReport(page)).leftHandle!.x)).toBeLessThanOrEqual(TOLERANCE);
  const drawerClosed = await dockBoundaryReport(page);
  expectHandleBoundary('left panel closed', drawerClosed, 'left', false);
  expectHandleBoundary('left panel closed', drawerClosed, 'right', true);
  await page.getByRole('button', { name: 'Show Left Toolbar' }).click();
  await expect(page.locator('.left-drawer-panel')).toBeVisible();

  // Right panel closed: the same contract on the other side.
  const inspectorToggle = page.getByRole('button', { name: 'Hide Inspector' });
  await expect(inspectorToggle).toHaveAttribute('aria-controls', 'right-inspector-panel');
  expect(await page.locator('#right-inspector-panel').count()).toBe(1);
  await inspectorToggle.click();
  await expect(page.getByRole('button', { name: 'Show Inspector' })).toBeVisible();
  await expect.poll(async () => {
    const report = await dockBoundaryReport(page);
    return Math.round(report.row!.right - report.rightHandle!.right);
  }).toBeLessThanOrEqual(TOLERANCE);
  const inspectorClosed = await dockBoundaryReport(page);
  expectHandleBoundary('right panel closed', inspectorClosed, 'left', true);
  expectHandleBoundary('right panel closed', inspectorClosed, 'right', false);
  await page.getByRole('button', { name: 'Show Inspector' }).click();
  await expect(page.locator('.motion-design-right-sidebar')).toBeVisible();
});

test('R5-01 — the dock handles keep their accessible names and a visible keyboard focus ring', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  // C2: the seed's mouse click now focuses the (focusable) layer-tree row, so the
  // browser's last input modality is "pointer". A keyboard user reaches these
  // handles with the keyboard: establish that modality before focusing them.
  await page.keyboard.press('Shift');

  for (const selector of ['.left-toolbar-toggle', '.inspector-dock-toggle']) {
    const state = await page.evaluate((sel) => {
      const node = document.querySelector(sel) as HTMLElement;
      node.focus();
      const cs = getComputedStyle(node);
      return { outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, focusVisible: node.matches(':focus-visible') };
    }, selector);
    expect(state.focusVisible, `${selector} did not take keyboard focus`).toBe(true);
    expect(state.outlineStyle, `${selector} lost its focus ring`).not.toBe('none');
    expect(parseFloat(state.outlineWidth), `${selector} lost its focus ring width`).toBeGreaterThanOrEqual(2);
    expect(await page.locator(selector).getAttribute('aria-expanded')).not.toBeNull();
  }
});

test('R5-02 — an open overlay paints over the dock handles, never under them', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  // The layer ordering itself: the chrome band that owns the export dropdown and
  // the GIF panel sits above the handle layer, which sits above the panels.
  const layers = await page.evaluate(() => ({
    chrome: getComputedStyle(document.querySelector('.header-bar')!).zIndex,
    authoring: getComputedStyle(document.querySelector('.authoring-toolbar')!).zIndex,
    handle: getComputedStyle(document.querySelector('.inspector-dock-toggle')!).zIndex,
    panel: getComputedStyle(document.querySelector('.motion-design-right-sidebar')!).zIndex,
  }));
  expect(Number(layers.chrome)).toBeGreaterThan(Number(layers.handle));
  expect(Number(layers.authoring)).toBeGreaterThan(Number(layers.handle));
  expect(Number(layers.handle)).toBeGreaterThan(Number(layers.panel));

  // Export dropdown open: it is owned by the chrome band, and the handles stay
  // reachable on their own layer.
  await page.locator('.export-btn').click();
  const menu = page.locator('[role="menu"][aria-label="Export options"]');
  await expect(menu).toBeVisible();
  expect(await menu.evaluate((node) => node.closest('.header-bar') !== null)).toBe(true);
  const withMenu = await page.evaluate(() => {
    const owns = (selector: string) => {
      const node = document.querySelector(selector) as HTMLElement;
      const rect = node.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) as HTMLElement | null;
      return Boolean(hit) && (hit === node || node.contains(hit));
    };
    return { left: owns('.left-toolbar-toggle'), right: owns('.inspector-dock-toggle') };
  });
  expect(withMenu.left, 'the export dropdown covers the left handle').toBe(true);
  expect(withMenu.right, 'the export dropdown covers the right handle').toBe(true);

  // GIF panel open: it really overlaps the right handle, and it wins the hit
  // test there — the handle is below the overlay.
  await page.locator('[role="menuitem"]', { hasText: 'Animated GIF' }).click();
  // The panel is lazy: the gate first paints a loading card with the same
  // footprint class, and the measured node is replaced when the chunk mounts.
  // Wait for the real panel (role=dialog, the same `.gif-export-panel` node)
  // so the hit test measures mounted layout, never the Suspense-to-panel
  // replacement window.
  await expect(page.getByRole('dialog', { name: 'Export animated GIF' })).toBeVisible();
  const panel = page.locator('.gif-export-panel');
  const covered = await page.evaluate(() => {
    const handle = document.querySelector('.inspector-dock-toggle') as HTMLElement;
    const overlay = document.querySelector('.gif-export-panel') as HTMLElement;
    const h = handle.getBoundingClientRect();
    const o = overlay.getBoundingClientRect();
    const hit = document.elementFromPoint(h.x + h.width / 2, h.y + h.height / 2) as HTMLElement | null;
    return {
      geometricOverlap: h.x < o.right && h.right > o.x && h.y < o.bottom && h.bottom > o.y,
      hitIsHandle: hit === handle,
      hitInsideOverlay: Boolean(hit && overlay.contains(hit)),
      hit: hit ? `${hit.tagName}.${typeof hit.className === 'string' ? hit.className : '(svg)'}` : null,
    };
  });
  expect(covered.geometricOverlap, 'the GIF panel does not overlap the right handle in this layout').toBe(true);
  expect(covered.hitIsHandle, `the right handle painted over the GIF panel (hit: ${covered.hit})`).toBe(false);
  expect(covered.hitInsideOverlay, `the GIF panel did not take the hit (hit: ${covered.hit})`).toBe(true);

  await page.locator('.gif-export-close').click();
  await expect(panel).toHaveCount(0);
});
