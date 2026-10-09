import { test, expect, type Page } from '@playwright/test';

/**
 * Authoring UX slice 1: the right-sidebar disclosure target, the Boolean
 * operation icons and the selection frame's contrast halo.
 *
 * The disclosure size and the frame's two strokes only exist in a real browser
 * (jsdom applies no stylesheet and no SVG layout), so this spec is the proof.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const shape = (id: string, name: string, x: number) => ({
  id, name, type: 'custom_rect', x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218',
  fillEnabled: true, strokeEnabled: false, width: 160, height: 120,
});

async function seed(page: Page, layers: Record<string, unknown>[]): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1',
    width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers, tracks: layers.map((layer) => ({ partId: layer.id as string, channels: channel() })),
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: scene },
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

test('the disclosure target is a comfortable size while the icon stays small', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', 0)]);
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();

  const button = page.getByRole('button', { name: 'Expand TRANSFORM' }).first();
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(32);
  expect(box!.height).toBeGreaterThanOrEqual(32);

  // The icon itself stays compact.
  const icon = await button.locator('span').first().boundingBox();
  expect(icon!.width).toBeLessThanOrEqual(24);

  // Keyboard operation and the disclosure contract survive.
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Collapse TRANSFORM' }).first()).toHaveAttribute('aria-expanded', 'true');
});

test('each Boolean operation renders its own icon and accessible name', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', -60), shape('b', 'Beta', 60)]);
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await page.locator('.actor-node', { hasText: 'Beta' }).first().click({ modifiers: ['Control'] });

  const operations = ['union', 'subtract', 'intersect', 'exclude'] as const;
  const paths: string[] = [];
  for (const operation of operations) {
    const button = page.getByRole('button', { name: `Create ${operation} Boolean`, exact: true });
    await expect(button).toBeVisible();
    const svg = button.locator('svg');
    await expect(svg).toHaveCount(1);
    // Union and Exclude share the operand geometry and differ by fill rule, so
    // the pair is what makes each icon distinguishable.
    const path = svg.locator('path');
    paths.push(`${await path.getAttribute('d')}|${await path.getAttribute('fill-rule')}`);
  }
  // Four operations, four distinguishable icons.
  expect(new Set(paths).size).toBe(4);
  expect(paths.every((d) => d.length > 0)).toBe(true);
});

test('the selection frame keeps a contrast halo under the accent stroke', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', 0)]);
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();

  const frame = page.getByTestId('transform-gizmo').first();
  const halo = page.getByTestId('selection-frame-halo').first();
  await expect(halo).toBeVisible();

  // The halo is the wider, non-interactive stroke underneath the accent dash.
  const strokes = await frame.locator('rect').evaluateAll((nodes) => nodes.map((node) => ({
    width: Number((node as SVGRectElement).style.strokeWidth || node.getAttribute('stroke-width') || 0),
    dash: node.getAttribute('stroke-dasharray'),
  })));
  // The halo is wider than the accent dash and carries no dash itself.
  const haloStroke = strokes.find((entry) => entry.dash === null);
  const accentStroke = strokes.find((entry) => entry.dash !== null);
  expect(haloStroke).toBeTruthy();
  expect(accentStroke).toBeTruthy();
  expect(haloStroke!.width).toBeGreaterThan(accentStroke!.width);

  // Neither stroke may take the pointer away from the artwork.
  await expect(halo).toHaveCSS('pointer-events', 'none');
});
