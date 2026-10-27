/** WP-07 visual evidence: the OGraf export check for a blocked and an exportable scene. */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { evidenceDir, imageLayer, seedScene, track, watchPage } from './fixtures';

const OUT = evidenceDir('wp07');
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

const card = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
  id, name, type: 'custom_rect', x: 0, y: 140, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2,
  fillColor: '#f59e0b', strokeColor: '#000000', width: 260, height: 50, ...overrides,
});

for (const variant of ['blocked', 'exportable'] as const) {
  test(`WP-07 — OGraf export check (${variant})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const watch = watchPage(page);
    const layers = variant === 'blocked'
      ? [imageLayer(), card('caption', 'Caption', { matte: { sourcePartId: 'landscape', mode: 'alpha', feather: 8 } }), card('badge', 'Badge', { y: -140, zIndex: 3, matte: { sourcePartId: 'caption', mode: 'clip' } })]
      : [imageLayer({ masks: [{ id: 'm1', name: 'Window', mode: 'add', enabled: true, path: { version: 1, coordinateSpace: 'normalized', closed: true, points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }] } }] }), card('caption', 'Caption')];
    await seedScene(page, { layers, tracks: layers.map((layer) => track(layer.id as string)) });
    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByRole('menuitem', { name: 'Check OGraf Export…' }).click();
    await expect(page.getByTestId('ograf-capability-summary')).toBeVisible();
    await shot(page, `${variant}_check`);
    expect(watch.errors).toEqual([]);
  });
}
