import { test, expect, type Page } from '@playwright/test';

/**
 * Milestone A — direct canvas tangent handle authoring, real-browser smoke.
 *
 * Seeds a scene with a canonical-path freeform layer through the app's autosave
 * key, then drives the real editor: overlay eligibility, handle drag through the
 * real stage pointer mapper, one-undo-entry commit, Escape cancel without a
 * history entry, and overlay lifecycle on layer changes.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const FREE_PATH = {
  version: 1,
  coordinateSpace: 'local',
  closed: true,
  points: [
    { id: 'a', x: 0, y: 0, handleOut: { x: 140, y: -40 }, handleIn: { x: -140, y: 40 }, kind: 'smooth' },
    { id: 'b', x: 320, y: -220 },
    { id: 'c', x: 320, y: 220 },
  ],
};

async function seed(page: Page): Promise<void> {
  const scene = {
    version: 1,
    layers: [
      {
        id: 'free',
        name: 'Free',
        type: 'custom_freeform',
        zIndex: 2,
        path: FREE_PATH,
        points: [{ x: 0, y: 0 }, { x: 320, y: -220 }, { x: 320, y: 220 }],
        baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
        fillColor: '#22d3ee',
      },
      {
        id: 'box',
        name: 'Box',
        type: 'custom_rect',
        zIndex: 1,
        baseTransform: { x: -420, y: -300, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
        width: 200,
        height: 140,
        fillColor: '#f97316',
      },
    ],
    tracks: [],
    fps: 30,
    totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'Tangent Smoke',
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    ([key, data]: [string, string]) => { localStorage.setItem(key, data); },
    [STORAGE_KEY, JSON.stringify(scene)],
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.stage-canvas-container')).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('path[d^="M"]').length > 0, undefined, { timeout: 15000 });
}

/** The rendered geometry of the seeded freeform layer. */
const freeformD = (page: Page) => page.evaluate(() => {
  const target = Array.from(document.querySelectorAll('path[d]'))
    .find((element) => (element.getAttribute('d') ?? '').startsWith('M 0 0'));
  return target ? target.getAttribute('d') : null;
});

const handleCenter = async (page: Page, kind: 'in' | 'out') => {
  const box = await page.locator(`[data-testid="freeform-tangent-handle-${kind}"]`).boundingBox();
  if (!box) throw new Error(`handle ${kind} has no box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const dragBy = async (page: Page, from: { x: number; y: number }, dx: number, dy: number) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 4 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 4 });
  await page.mouse.up();
};

test.describe('canvas tangent authoring', () => {
  test('authoring affordance: markers, handle drag, undo/redo, Escape cancel', async ({ page }) => {
    await seed(page);

    await expect(page.locator('[data-testid="freeform-tangent-overlay"]')).toHaveCount(0);

    await page.locator('.actor-node', { hasText: 'Free' }).click();
    await expect(page.locator('[data-testid="freeform-tangent-overlay"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="freeform-vertex-marker"]')).toHaveCount(3);

    const beforeDrag = await freeformD(page);
    expect(beforeDrag).not.toBeNull();

    // Selecting a vertex reveals its handles.
    await page.locator('[data-testid="freeform-vertex-marker"]').first().click();
    await expect(page.locator('[data-testid="freeform-tangent-handle-out"]')).toHaveCount(1);

    // The dragged handle follows the pointer 1:1 in screen space and the shape updates live.
    const start = await handleCenter(page, 'out');
    await dragBy(page, start, 90, -60);
    const afterDrag = await freeformD(page);
    expect(afterDrag).not.toBe(beforeDrag);
    const moved = await handleCenter(page, 'out');
    expect(Math.abs((moved.x - start.x) - 90)).toBeLessThan(2);
    expect(Math.abs((moved.y - start.y) + 60)).toBeLessThan(2);

    // One undo entry per drag: undo restores, redo reapplies.
    await page.keyboard.press('Control+z');
    await expect.poll(() => freeformD(page)).toBe(beforeDrag);
    await page.keyboard.press('Control+Shift+z');
    await expect.poll(() => freeformD(page)).toBe(afterDrag);

    // Escape during a drag restores the shape and records no history entry.
    const beforeCancel = await freeformD(page);
    const cancelStart = await handleCenter(page, 'out');
    await page.mouse.move(cancelStart.x, cancelStart.y);
    await page.mouse.down();
    await page.mouse.move(cancelStart.x + 70, cancelStart.y + 70, { steps: 5 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect.poll(() => freeformD(page)).toBe(beforeCancel);
    await page.keyboard.press('Control+z');
    await expect.poll(() => freeformD(page)).toBe(beforeDrag);
    await page.keyboard.press('Control+Shift+z');

    await page.screenshot({ path: 'test-results/tangent-authoring-handles.png' });

    // The overlay follows the selection: away from the freeform layer and back.
    await page.locator('.actor-node', { hasText: 'Box' }).click();
    await expect(page.locator('[data-testid="freeform-tangent-overlay"]')).toHaveCount(0);
    await page.locator('.actor-node', { hasText: 'Free' }).click();
    await expect(page.locator('[data-testid="freeform-tangent-overlay"]')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/tangent-authoring-eligibility.png' });
  });
});
