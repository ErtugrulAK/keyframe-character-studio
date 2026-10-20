import { test, expect, type Page } from '@playwright/test';

/**
 * Milestone B — graph + keyboard accessibility (real-browser smoke).
 *
 * Seeds a canonical channel track, then drives the timeline WITHOUT a mouse:
 * Tab reaches the keyframe diamonds, ArrowLeft/ArrowRight walk focus along the
 * lane, Enter selects a keyframe through the existing pipeline, the focus ring
 * is visible, and the previous mouse behavior still works.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function makeLayer(id: string, name: string): Record<string, unknown> {
  return {
    id, name, type: 'custom_box',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1,
    fillColor: '#ff2020', strokeColor: '#101218', strokeWidth: 2, borderRadius: 0,
    width: 120, height: 120,
  };
}

function kf(id: string, frame: number, value: number, extra?: Record<string, unknown>): Record<string, unknown> {
  return { id, frame, value, easing: 'easeInOut', templateId: 'Sequence', ...extra };
}

async function seed(page: Page, xKeyframes?: Record<string, unknown>[]): Promise<void> {
  const channels: Record<string, unknown[]> = {
    x: xKeyframes ?? [kf('x_0', 0, 10), kf('x_12', 12, 60), kf('x_30', 30, 20)],
    y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
    maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  };
  const scene = {
    version: 1,
    layers: [makeLayer('a', 'Part A')],
    tracks: [{ id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels, keyframes: [], visible: true, locked: false, expanded: true }],
    fps: 30,
    totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'Milestone B Graph Accessibility Smoke',
  };
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); });
  await page.addInitScript(
    ([key, data]: [string, string]) => { localStorage.setItem(key, data); },
    [STORAGE_KEY, JSON.stringify(scene)],
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.keyframe-diamond').first()).toBeVisible({ timeout: 15000 });
}

const activeDiamondLabel = (page: Page) => page.evaluate(() => {
  const active = document.activeElement as HTMLElement | null;
  return active && active.classList.contains('keyframe-diamond') ? active.getAttribute('aria-label') : null;
});

test.describe('Milestone B — keyboard accessibility', () => {
  test('keyframe diamonds are Tab-reachable, arrow-navigable and Enter-activatable', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await seed(page);

    // 1. Real Tab traversal reaches a diamond (bounded walk from the document body).
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    let reached = false;
    for (let press = 0; press < 80 && !reached; press += 1) {
      await page.keyboard.press('Tab');
      reached = (await activeDiamondLabel(page)) !== null;
    }
    expect(reached, 'Tab traversal must reach a timeline keyframe diamond').toBe(true);

    // 2. The focused diamond exposes its accessible name and the selected state.
    const firstLabel = await activeDiamondLabel(page);
    expect(firstLabel).toContain('Keyframe at frame');
    // The seeded track name is normalized by the importer, so assert the channel
    // context that the label must carry rather than the fixture's name.
    expect(firstLabel).toContain('channels x');
    const pressed = await page.evaluate(() => document.activeElement?.getAttribute('aria-pressed'));
    expect(pressed === 'true' || pressed === 'false').toBe(true);

    // 3. The focus ring is really painted: the stylesheet rule must reach the element.
    expect(await page.evaluate(() => document.activeElement?.matches(':focus-visible') ?? false)).toBe(true);
    const focusRing = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return null;
      const style = getComputedStyle(active);
      return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
    });
    expect(focusRing?.style).toBe('solid');
    expect(Number.parseFloat(focusRing?.width ?? '0')).toBeGreaterThanOrEqual(2);

    // 4. ArrowRight walks the lane forward, ArrowLeft walks back: focus moves in frame order.
    await page.keyboard.press('ArrowRight');
    const secondLabel = await activeDiamondLabel(page);
    expect(secondLabel).not.toBe(firstLabel);
    expect(secondLabel).toContain('frame 12');
    await page.keyboard.press('ArrowLeft');
    expect(await activeDiamondLabel(page)).toBe(firstLabel);
    await page.keyboard.press('ArrowRight');

    // 5. Enter selects the focused keyframe through the existing pipeline.
    await page.keyboard.press('Enter');
    await expect(page.locator('.keyframe-diamond.selected')).toHaveCount(1);
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-pressed'))).toBe('true');
    // Selecting a keyframe opens no property editor for it.
    await expect(page.locator('.timeline-selected-keyframe-panel')).toHaveCount(0);
    await expect(page.getByText('SELECTED KEYFRAME @ FRAME', { exact: false })).toHaveCount(0);

    // 6. The mouse path still selects the same way.
    await page.locator('.keyframe-diamond').first().click();
    await expect(page.locator('.keyframe-diamond.selected')).toHaveCount(1);

    expect(consoleErrors).toEqual([]);
  });

  test('the value graph exposes a labelled group whose keyframe points are keyboard operable', async ({ page }) => {
    await seed(page);
    await page.locator('.actor-node', { hasText: 'Part A' }).click();

    // Motion Curves shapes the segment that leads INTO the selected keyframe, and
    // the seeded x channel has keyframes at frames 0, 12 and 30. Selecting the
    // first diamond leaves the studio intentionally inactive, so select the
    // incoming segment's end keyframe (frame 12) first.
    await page.locator('.keyframe-diamond[aria-label*="frame 12"]').click();

    // The graph lives in the Curve Studio modal: open it through its own control,
    // so this test fails if the graph semantics regress.
    await page.getByTitle('Open Expanded Pro Cubic Bezier Motion Curve Studio Modal').click();
    const graphGroup = page.getByRole('group', { name: 'Value Graph' });
    await expect(graphGroup).toBeVisible({ timeout: 10000 });

    const point = page.getByRole('button', { name: /Keyframe at frame 0, value/ });
    await expect(point).toHaveCount(1);

    // Reach the graph point with the keyboard only, then confirm the real ring.
    let reached = false;
    for (let press = 0; press < 40 && !reached; press += 1) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => (document.activeElement?.getAttribute('aria-label') ?? '').startsWith('Keyframe at frame 0, value'));
    }
    expect(reached, 'Tab traversal must reach the graph keyframe point').toBe(true);
    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return { outline: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(ring.outline).toBe('solid');
    expect(ring.width).toBeGreaterThanOrEqual(2);

    const before = await point.getAttribute('aria-label');
    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => point.getAttribute('aria-label')).not.toBe(before);

  });

  test('segment badges expose the authority branch that actually drives each segment', async ({ page }) => {
    // The stored easing NAME may be stale; the badge must describe the branch
    // applyEasing actually takes (effectiveSegmentAuthority order):
    // HOLD > complete handle pair > control points > autoBezier > named.
    // f0 hold; f6 stores control points YET a complete pair drives it; f12
    // stores the name "linear" YET its control points drive it; f18 autoBezier;
    // f24 named easeInOut.
    await seed(page, [
      kf('b_0', 0, 10, { easing: 'hold' }),
      kf('b_6', 6, 60, {
        easing: 'cubic_bezier',
        bezierControlPoints: [0.42, 0, 0.58, 1],
        bezierOut: { x: 0.7, y: 0.1 },
      }),
      kf('b_12', 12, 20, {
        easing: 'linear',
        bezierControlPoints: [0.33, 0, 0.67, 1],
        bezierIn: { x: 0.3, y: 0.9 },
      }),
      kf('b_18', 18, 50, { easing: 'autoBezier' }),
      kf('b_24', 24, 30, { easing: 'easeInOut' }),
      kf('b_30', 30, 5, { easing: 'easeInOut' }),
    ]);
    await page.locator('.actor-node', { hasText: 'Part A' }).click();
    await page.locator('.keyframe-diamond[aria-label*="frame 12"]').click();
    await page.getByTitle('Open Expanded Pro Cubic Bezier Motion Curve Studio Modal').click();
    await expect(page.getByRole('group', { name: 'Value Graph' })).toBeVisible({ timeout: 10000 });

    const badge = (range: string, label: string) => page.getByRole('img', { name: `Segment frame ${range}: ${label}` });
    await expect(badge('0 to 6', 'HOLD')).toHaveCount(1);
    await expect(badge('6 to 12', 'BEZ')).toHaveCount(1);
    await expect(badge('12 to 18', 'BEZ')).toHaveCount(1);
    await expect(badge('18 to 24', 'AUTO')).toHaveCount(1);
    await expect(badge('24 to 30', 'ease in out')).toHaveCount(1);

    // The stored name must not outlive the authority: the control-point-driven
    // segment is never announced as LIN.
    await expect(badge('12 to 18', 'LIN')).toHaveCount(0);

    // The two BEZ badges carry the same visible label reached by DIFFERENT
    // authority branches; the carried attribute distinguishes them.
    await expect(badge('0 to 6', 'HOLD')).toHaveAttribute('data-segment-easing', 'hold');
    await expect(badge('6 to 12', 'BEZ')).toHaveAttribute('data-segment-easing', 'bezier');
    await expect(badge('12 to 18', 'BEZ')).toHaveAttribute('data-segment-easing', 'cubic_bezier');
    await expect(badge('18 to 24', 'AUTO')).toHaveAttribute('data-segment-easing', 'autoBezier');
    await expect(badge('24 to 30', 'ease in out')).toHaveAttribute('data-segment-easing', 'easeInOut');
  });
});
