import { test, expect, type Page } from '@playwright/test';

/**
 * UI FEATURE — Left Toolbar collapse/expand (real browser).
 * Verifies: toggle behavior, canvas really gains width, Right Toolbar is
 * unaffected, both rails can collapse together, resize keeps layout sane.
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

test('Left Toolbar collapse/expand — canvas gains space, Right Toolbar untouched', async ({ page }) => {
  await seed(page);
  await page.waitForTimeout(400);

  // Expanded baseline
  const expanded = await canvasBox(page);
  const rightWidth0 = await page.evaluate(() => {
    const right = document.querySelector('.motion-design-right-sidebar');
    return right ? Math.round(right.getBoundingClientRect().width) : 0;
  });
  expect(rightWidth0).toBeGreaterThan(0);

  // Collapse Left Toolbar
  await page.getByTitle('Collapse toolbar').click();
  await page.waitForTimeout(400); // transition
  const collapsed = await canvasBox(page);
  expect(collapsed.width).toBeGreaterThan(expanded.width); // canvas REALLY widened
  expect(collapsed.left).toBeLessThan(expanded.left);      // canvas started further left

  // Tool icons still reachable (nav rail remains)
  expect(await page.getByTitle('Media Assets').isVisible()).toBe(true);

  // Expand again — canvas returns
  await page.getByTitle('Expand toolbar').click();
  await page.waitForTimeout(400);
  const reExpanded = await canvasBox(page);
  expect(reExpanded.width).toBeCloseTo(expanded.width, 0);

  // Right Toolbar width unchanged across the whole toggle
  const rightWidth1 = await page.evaluate(() => {
    const right = document.querySelector('.motion-design-right-sidebar');
    return right ? Math.round(right.getBoundingClientRect().width) : 0;
  });
  expect(rightWidth1).toBe(rightWidth0);

  // Both rails collapsed at once — layout must not break (no horizontal overflow)
  await page.getByTitle('Collapse toolbar').click();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    // Right Toolbar has no collapse button — shrink it via its resizer handle
    const resizer = document.querySelector('.sidebar-left-resizer') as HTMLElement;
    if (resizer) {
      const r = resizer.getBoundingClientRect();
      const ev = new MouseEvent('mousedown', { clientX: r.left, clientY: r.top + 5, bubbles: true });
      resizer.dispatchEvent(ev);
      const mv = new MouseEvent('mousemove', { clientX: window.innerWidth - 260, clientY: r.top + 5, bubbles: true });
      window.dispatchEvent(mv);
      const up = new MouseEvent('mouseup', { bubbles: true });
      window.dispatchEvent(up);
    }
  });
  await page.waitForTimeout(300);
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noOverflow).toBe(true);

  // Resize the window — layout stays intact, toggle still works
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.waitForTimeout(300);
  expect(await page.getByTitle('Expand toolbar').isVisible()).toBe(true);
  await page.getByTitle('Expand toolbar').click();
  await page.waitForTimeout(400);
  const afterResize = await canvasBox(page);
  expect(afterResize.width).toBeGreaterThan(200);
});
