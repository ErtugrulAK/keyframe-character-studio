/** WP-05 visual evidence: five layers, C deleted (1..4), B reordered below D. */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { evidenceDir, imageLayer, seedScene, track, watchPage } from './fixtures';

const OUT = evidenceDir('wp05');
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

test('WP-05 — derived layer ordinals', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const watch = watchPage(page);
  const ids = ['a', 'b', 'c', 'd', 'e'];
  await seedScene(page, {
    layers: ids.map((id, index) => imageLayer({ id, name: `Photo ${id.toUpperCase()}`, x: -200 + index * 100, width: 96, height: 54, zIndex: 5 - index })),
    tracks: ids.map((id) => track(id)),
  });
  await shot(page, '01_five_layers');
  await page.locator('.ue-track-row', { hasText: 'Photo C' }).first().click();
  await page.getByRole('button', { name: 'Delete Actor Instance' }).click();
  await expect(page.locator('.ue-track-row')).toHaveCount(4);
  await shot(page, '02_deleted_c_renumbered');
  const row = (name: string) => page.locator('[role="treeitem"]', { hasText: name }).first();
  await row('Photo B').dragTo(row('Photo D'));
  await shot(page, '03_b_reordered_below_d');
  expect(watch.errors).toEqual([]);
});
