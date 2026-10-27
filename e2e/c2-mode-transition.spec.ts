/**
 * C2-G — Edit ⇄ Broadcast is a chrome transition: the stage stays mounted and
 * still, the scene and the editor's working state survive the round trip, a
 * rapid double switch settles, reduced motion runs no animation (and leaves no
 * transition flag behind), and Broadcast never runs the edit playback loop.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

async function seed(page: Page): Promise<void> {
  const layers = [
    { id: 'rig', name: 'Rig', type: 'custom_rect', isGroup: true, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 3, fillColor: '#000', strokeColor: '#000', width: 10, height: 10 },
    { id: 'arm', name: 'Arm', type: 'custom_rect', parentId: 'rig', x: 60, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, fillColor: '#22d3ee', strokeColor: '#000', width: 120, height: 60 },
    { id: 'logo', name: 'Logo', type: 'custom_circle', x: -200, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#f59e0b', strokeColor: '#000', width: 100, height: 100 },
  ];
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers,
    tracks: layers.map((layer) => ({ id: `track-${layer.id}`, partId: layer.id, name: layer.name, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: { ...emptyChannels(), x: layer.id === 'logo' ? [{ id: 'k0', frame: 0, value: -200, easing: 'linear' }, { id: 'k1', frame: 40, value: 200, easing: 'linear' }] : [] } })),
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const toBroadcast = (page: Page) => page.getByRole('button', { name: 'BROADCAST', exact: true }).click();
const toEdit = (page: Page) => page.getByRole('button', { name: 'EDIT MODE', exact: true }).click();

test('a round trip keeps the scene, the selection, the playhead and the editor working state; the stage element is never replaced', async ({ page }) => {
  await seed(page);
  // Working state: a selection, a playhead, a collapsed group row, an open section, the Inspector hidden-state.
  await page.locator('.tree-node[data-layer-id="logo"]').click();
  // C3: an opened Inspector card and a moved camera are working state too.
  await page.getByRole('button', { name: 'Expand TRANSFORM' }).click();
  await expect(page.getByRole('button', { name: 'Collapse TRANSFORM' })).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const camera = () => page.locator('.stage-svg').evaluate((node) => (node as SVGElement).style.transform);
  const cameraBefore = await camera();
  await page.getByRole('button', { name: 'Collapse Rig' }).click();
  const divider = await page.locator('.sidebar-pane-divider').boundingBox();
  await page.mouse.move(divider!.x + divider!.width / 2, divider!.y + divider!.height / 2);
  await page.mouse.down();
  await page.mouse.move(divider!.x + divider!.width / 2, divider!.y + divider!.height / 2 - 40, { steps: 4 });
  await page.mouse.up();
  const outlinerHeight = await page.locator('.outliner-dock').evaluate((node) => (node as HTMLElement).style.height);
  const ruler = page.getByRole('slider', { name: 'Playhead position' });
  await ruler.focus();
  for (let index = 0; index < 17; index += 1) await page.keyboard.press('ArrowRight');
  const frameBefore = await ruler.getAttribute('aria-valuenow');
  await page.evaluate(() => { (window as unknown as { __stage: Element | null }).__stage = document.querySelector('.stage-canvas-container'); });
  const sceneBefore = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

  await toBroadcast(page);
  await expect(page.locator('.live-director-panel')).toBeVisible();
  await toEdit(page);
  await expect(page.locator('.sequencer-timeline')).toBeVisible();

  expect(await page.evaluate(() => document.querySelector('.stage-canvas-container') === (window as unknown as { __stage: Element | null }).__stage)).toBe(true);
  await expect(page.locator('.tree-node[data-layer-id="logo"]')).toHaveClass(/primary-selected/);
  await expect(ruler).toHaveAttribute('aria-valuenow', frameBefore!);
  await expect(page.getByRole('button', { name: 'Collapse TRANSFORM' })).toBeVisible();
  expect(await camera()).toBe(cameraBefore);
  // The tree row stays collapsed and the layer list keeps its height.
  await expect(page.locator('.tree-node[data-layer-id="arm"]')).toHaveCount(0);
  expect(await page.locator('.outliner-dock').evaluate((node) => (node as HTMLElement).style.height)).toBe(outlinerHeight);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(sceneBefore);
});

test('a rapid double switch settles in the requested mode with no transition flag left behind', async ({ page }) => {
  await seed(page);
  await page.evaluate(() => {
    const broadcast = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'BROADCAST') as HTMLButtonElement;
    broadcast.click();
    const edit = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'EDIT MODE') as HTMLButtonElement;
    edit.click();
  });
  await expect(page.locator('.sequencer-timeline')).toBeVisible();
  await expect(page.locator('.app-container')).not.toHaveClass(/kcs-mode-swap/, { timeout: 2000 });
});

test('reduced motion: no animation runs and the transition flag does not stick', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page);
  await toBroadcast(page);
  await expect(page.locator('.live-director-panel')).toBeVisible();
  const animations = await page.evaluate(() => document.getAnimations().filter((animation) => (animation as CSSAnimation).animationName === 'kcs-mode-enter').length);
  expect(animations).toBe(0);
  await expect(page.locator('.app-container')).not.toHaveClass(/kcs-mode-swap/);
  await toEdit(page);
  await expect(page.locator('.app-container')).not.toHaveClass(/kcs-mode-swap/);
});

test('Broadcast stops the edit playback loop; Edit playback resumes from the kept frame on request', async ({ page }) => {
  await seed(page);
  await page.locator('.stage-canvas-container').click({ position: { x: 5, y: 5 } });
  await page.getByTitle('Play', { exact: true }).click();
  await expect(page.getByTitle('Pause', { exact: true })).toBeVisible();
  await toBroadcast(page);
  await toEdit(page);
  // Playback was stopped by the mode change, and stays stopped.
  await expect(page.getByTitle('Play', { exact: true })).toBeVisible();
  const ruler = page.getByRole('slider', { name: 'Playhead position' });
  const frame = await ruler.getAttribute('aria-valuenow');
  await page.waitForTimeout(300);
  await expect(ruler).toHaveAttribute('aria-valuenow', frame!);
});
