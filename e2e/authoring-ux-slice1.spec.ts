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
    const label = `${operation[0].toUpperCase()}${operation.slice(1)}`;
    const button = page.getByRole('button', { name: `Boolean ${label}` });
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
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

test('the selection frame keeps a paired light/dark outline under the accent stroke', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', 0)]);
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();

  const frame = page.getByTestId('transform-gizmo').first();
  const keyline = page.getByTestId('selection-frame-keyline').first();
  const halo = page.getByTestId('selection-frame-halo').first();
  await expect(keyline).toBeVisible();
  await expect(halo).toBeVisible();

  // What the frame actually paints, in paint order.
  const strokes = await frame.locator('rect').evaluateAll((nodes) => nodes.map((node) => {
    const element = node as SVGRectElement;
    const luminanceOf = (value: string): number | null => {
      const rgb = (value.match(/\d+/g) ?? []).slice(0, 3).map(Number);
      if (rgb.length < 3) return null;
      const [r, g, b] = rgb.map((channel) => channel / 255);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const computed = getComputedStyle(element).stroke;
    return {
      width: Number(element.style.strokeWidth || element.getAttribute('stroke-width') || 0),
      dash: element.getAttribute('stroke-dasharray'),
      luminance: luminanceOf(computed) ?? luminanceOf(element.getAttribute('stroke') ?? element.style.stroke),
    };
  }));

  const solid = strokes.filter((entry) => entry.dash === null && entry.luminance !== null);
  // One solid stroke reads over dark artwork, the other over light artwork.
  expect(Math.max(...solid.map((entry) => entry.luminance!))).toBeGreaterThan(0.7);
  expect(Math.min(...solid.map((entry) => entry.luminance!))).toBeLessThan(0.2);
  // The pair stays thin: the widest half is narrower than the single black band
  // the frame used to be backed with.
  expect(Math.max(...solid.map((entry) => entry.width))).toBeLessThan(7);
  expect(strokes.some((entry) => entry.dash !== null)).toBe(true);

  // Neither half may take the pointer away from the artwork.
  await expect(keyline).toHaveCSS('pointer-events', 'none');
  await expect(halo).toHaveCSS('pointer-events', 'none');
});
