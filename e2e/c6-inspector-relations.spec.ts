/**
 * C6 — the Details header and relations, and the two matte sections:
 * - the header names the layer kind in plain words, long names do not break
 *   the row;
 * - the Parent row says which relation it is (group membership vs transform
 *   parent), and its remove action takes the layer out without moving it;
 * - Track Matte is the main matte; the Legacy clip matte is a quiet
 *   "Advanced" card when unused, and says "In use" / "Kept · not applied"
 *   when a layer has one. Looking at it never changes data.
 */
import { expect, test, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const E = () => ({ x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [] });
const L = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218', width: 120, height: 60, ...extra });
const LONG = 'Hero character silhouette with a very long descriptive layer name';

async function seed(page: Page): Promise<void> {
  const layers = [
    L('crew', 'Characters', { isGroup: true, zIndex: 1, visible: false }),
    L('hero', LONG, { parentId: 'crew', zIndex: 2, x: 40 }),
    L('rig', 'Rig', { zIndex: 3, x: -300 }),
    L('arm', 'Arm', { parentId: 'rig', zIndex: 4, x: 60, y: 40 }),
    L('photo', 'Photo', { type: 'custom_circle', zIndex: 5, x: 300, trackMatte: { sourceLayerId: 'rig', mode: 'alpha', enabled: true } }),
    L('legacy', 'Old clip', { zIndex: 6, x: 300, y: 200, matte: { sourcePartId: 'rig', mode: 'clip', enabled: true }, trackMatte: { sourceLayerId: 'arm', mode: 'alpha', enabled: true } }),
  ];
  const scene = { version: 2, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers, tracks: layers.map((layer) => ({ id: `t-${layer.id}`, partId: layer.id, name: layer.name, color: '#fff', visible: true, locked: false, channels: E() })) };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const savedScene = async (page: Page) => {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
};
const select = (page: Page, id: string) => page.locator(`[role="tree"] [data-layer-id="${id}"]`).click();
const stageCentre = async (page: Page, id: string) => {
  const box = await page.locator(`.stage-svg g[data-part-id="${id}"]`).first().boundingBox();
  if (!box) throw new Error(`no ${id}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test('header and Parent row: plain kind, long names contained, group vs parent stated, remove keeps the layer in place', async ({ page }) => {
  await seed(page);
  await select(page, 'hero');
  const header = page.locator('.details-actor-header');
  await expect(header.locator('.actor-type-label')).toHaveText('Rectangle');
  // The long name is cut with an ellipsis inside the header; the actions stay visible.
  const fit = await page.evaluate(() => {
    const row = document.querySelector('.details-actor-header')!.getBoundingClientRect();
    const name = document.querySelector('.actor-main-name') as HTMLElement;
    const actions = document.querySelector('.actor-action-row')!.getBoundingClientRect();
    return { nameRight: name.getBoundingClientRect().right, actionsLeft: actions.left, actionsRight: actions.right, rowRight: row.right, truncated: name.scrollWidth > name.clientWidth, title: name.title };
  });
  expect(fit.truncated).toBe(true);
  expect(fit.title).toBe(LONG);
  expect(fit.nameRight).toBeLessThanOrEqual(fit.actionsLeft);
  expect(fit.actionsRight).toBeLessThanOrEqual(fit.rowRight + 0.5);

  // C7 — the Parent row lives on the Inspector's Layer tab.
  await openDetailsTab(page, 'Layer');
  const relation = page.getByTestId('layer-parent-relation');
  await expect(relation).toContainText('In group “Characters”');
  await expect(page.locator('.layer-parent-field')).toHaveAttribute('data-relation', 'group');
  const heroBefore = await stageCentre(page, 'hero');
  await page.getByRole('button', { name: 'Leave group' }).click();
  await expect(relation).toContainText('No parent');
  await expect(page.getByRole('button', { name: 'Remove parent' })).toBeDisabled();
  const heroAfter = await stageCentre(page, 'hero');
  expect(Math.abs(heroAfter.x - heroBefore.x)).toBeLessThan(0.5);
  expect(Math.abs(heroAfter.y - heroBefore.y)).toBeLessThan(0.5);
  expect((await savedScene(page)).layers.find((layer: any) => layer.id === 'hero').parentId).toBeUndefined();
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await savedScene(page)).layers.find((layer: any) => layer.id === 'hero').parentId).toBe('crew');

  await select(page, 'arm');
  await expect(relation).toContainText('Child of “Rig”');
  await expect(page.locator('.layer-parent-field')).toHaveAttribute('data-relation', 'parent');
  // The choice lists groups and layers separately.
  await expect(page.locator('.layer-parent-row select optgroup')).toHaveCount(2);
  const armBefore = await stageCentre(page, 'arm');
  await page.getByRole('button', { name: 'Remove parent' }).click();
  await expect(relation).toContainText('No parent');
  const armAfter = await stageCentre(page, 'arm');
  expect(Math.abs(armAfter.x - armBefore.x)).toBeLessThan(0.5);
  // The Parent row never mentions mattes: Track Matte has its own section.
  await select(page, 'photo');
  await expect(relation).not.toContainText(/matte/i);
});

test('Track Matte leads; the legacy clip matte is quiet when unused and explicit when used; viewing changes nothing', async ({ page }) => {
  await seed(page);
  const before = await savedScene(page);
  const legacyCard = () => page.locator('.inspector-section-card', { has: page.locator('.inspector-section-title', { hasText: 'LEGACY CLIP MATTE' }) });
  const trackCard = () => page.locator('.inspector-section-card', { has: page.locator('.inspector-section-title', { hasText: /^TRACK MATTE$/ }) });

  await select(page, 'photo');
  // C7 — both mattes live on the Inspector's Masks tab.
  await openDetailsTab(page, 'Masks');
  await expect(trackCard().locator('.inspector-section-badge')).toHaveText('On');
  await expect(legacyCard()).toHaveClass(/is-quiet/);
  await expect(legacyCard().locator('.inspector-section-badge')).toHaveText('Advanced');
  // Track Matte comes first.
  const order = await page.evaluate(() => [...document.querySelectorAll('.inspector-section-title')].map((node) => node.textContent));
  expect(order.indexOf('TRACK MATTE')).toBeLessThan(order.indexOf('LEGACY CLIP MATTE'));

  await select(page, 'legacy');
  await expect(legacyCard()).not.toHaveClass(/is-quiet/);
  await expect(legacyCard().locator('.inspector-section-badge')).toHaveText('Kept · not applied');
  await page.getByRole('button', { name: 'Expand LEGACY CLIP MATTE' }).click();
  await expect(legacyCard().locator('.matte-legacy-status')).toContainText('Not applied right now');
  await expect(legacyCard().getByRole('button', { name: /Remove/ })).toHaveAttribute('title', /legacy clip matte/);
  // Nothing was written by looking.
  expect((await savedScene(page)).layers).toEqual(before.layers);

  // Switching the Track Matte off makes the legacy one the applied matte (no conversion, no data loss).
  await page.getByRole('button', { name: 'Expand TRACK MATTE' }).click();
  await trackCard().getByLabel('Enabled').uncheck();
  await expect(legacyCard().locator('.inspector-section-badge')).toHaveText('In use');
  const after = (await savedScene(page)).layers.find((layer: any) => layer.id === 'legacy');
  expect(after.matte).toEqual(before.layers.find((layer: any) => layer.id === 'legacy').matte);
  expect(after.trackMatte).toMatchObject({ sourceLayerId: 'arm', enabled: false });
});
