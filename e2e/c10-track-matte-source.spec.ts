import { test, expect, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

/**
 * C10 — choosing a Track Matte source from the list hides that source, as in
 * After Effects: the photo shows through the star's shape and the star itself
 * is not painted. "Show source" paints it again. There is no pick-whip.
 */
const SCENE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

async function seed(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate((key) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      layers: [
        { id: 'photo', name: 'Photo', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 3, scaleY: 3, opacity: 1, visible: true, zIndex: 1, fillColor: '#3b82f6' },
        { id: 'star', name: 'Star', type: 'custom_star', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, fillColor: '#facc15' },
      ],
      tracks: [], fps: 30, totalFrames: 60,
      projectResolution: { width: 1920, height: 1080 },
    }));
  }, SCENE_KEY);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible();
}

const painted = (page: Page, id: string) => page.locator(`.stage-svg g[data-part-id="${id}"]`);

test('a new Track Matte hides its source; Show source paints it again', async ({ page }) => {
  await seed(page);
  await expect(painted(page, 'star')).toHaveCount(1);

  await page.locator('.actor-node', { hasText: 'Photo' }).click();
  await openDetailsTab(page, 'Masks');
  const card = page.getByRole('button', { name: /(?:Expand|Collapse) TRACK MATTE/ });
  if (await card.getAttribute('aria-expanded') === 'false') await card.click();
  await expect(page.locator('.track-matte-pick-whip')).toHaveCount(0);

  await page.getByLabel('Track matte source').selectOption('star');
  await expect(painted(page, 'star')).toHaveCount(0);
  const showSource = page.getByRole('checkbox', { name: 'Show source' });
  await expect(showSource).not.toBeChecked();

  await showSource.check();
  await expect(painted(page, 'star')).toHaveCount(1);
});
