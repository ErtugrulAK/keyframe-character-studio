import { test, expect, type Page } from '@playwright/test';

/**
 * Quick easing from the timeline: right-click a keyframe for Linear / Ease In /
 * Ease Out / Easy Ease / Hold, and F9 eases the selected keyframes. The named
 * easing really drives the segment (the curve data that outranks it goes), and
 * one command is one undo step.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function makeLayer(id: string, name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, name, type: 'custom_box',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1,
    fillColor: '#ff2020', strokeColor: '#101218', strokeWidth: 2, borderRadius: 0,
    width: 120, height: 120,
    ...overrides,
  };
}

function emptyChannels(): Record<string, unknown[]> {
  return { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] };
}

function kf(id: string, frame: number, value: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, frame, value, easing: 'easeInOut', templateId: 'Sequence', ...extra };
}

async function seed(
  page: Page,
  layers: Record<string, unknown>[],
  tracks: Record<string, unknown>[],
  totalFrames = 90,
): Promise<void> {
  const scene = {
    version: 1, layers, tracks, fps: 30, totalFrames,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'Quick easing E2E',
  };
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); });
  await page.addInitScript(
    ([key, data]: [string, string]) => {
      if (!localStorage.getItem('__KCS_E2E_SEEDED__')) {
        localStorage.setItem(key, data);
        localStorage.setItem('__KCS_E2E_SEEDED__', '1');
      }
    },
    [STORAGE_KEY, JSON.stringify(scene)],
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

async function selectPart(page: Page, name: string): Promise<void> {
  const row = page.locator('.actor-node', { has: page.locator('.actor-name', { hasText: name }) }).first();
  await row.waitFor({ state: 'visible', timeout: 10000 });
  await row.click();
  await page.waitForTimeout(250);
}

async function saveNow(page: Page): Promise<void> {
  const badge = page.locator('.autosave-status-badge');
  if (await badge.count()) {
    await badge.click();
    await page.waitForTimeout(300);
  }
}

async function storedTrack(page: Page, partId: string): Promise<Record<string, unknown>> {
  await saveNow(page);
  return page.evaluate(([key, pid]) => {
    const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
    return (scene.tracks ?? []).find((t: Record<string, unknown>) => t.partId === pid) ?? null;
  }, [STORAGE_KEY, partId] as [string, string]);
}

type Key = { id: string; frame: number; easing: string; bezierControlPoints?: unknown; bezierOut?: unknown; bezierIn?: unknown };
const xKeys = async (page: Page): Promise<Key[]> => ((await storedTrack(page, 'a')).channels as Record<string, Key[]>).x;

const twoKeyScene = (extra: Record<string, unknown> = {}) => {
  const ch = emptyChannels();
  ch.x = [kf('x0', 0, 0, { easing: 'linear', ...extra }), kf('x30', 30, 200, { easing: 'linear' })];
  ch.y = [kf('y0', 0, 0, { easing: 'linear' }), kf('y30', 30, 100, { easing: 'linear' })];
  return [{ id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: ch, keyframes: [], visible: true, locked: false, expanded: true }];
};

test('right-click a keyframe → Ease In sets every channel of that frame, and Undo restores it in one step', async ({ page }) => {
  await seed(page, [makeLayer('a', 'Part A')], twoKeyScene({ easing: 'cubic_bezier', bezierControlPoints: [0.1, 0.9, 0.2, 1] }));
  await selectPart(page, 'Part A');
  await page.locator('.keyframe-diamond').first().click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Keyframe actions' });
  await expect(menu.getByRole('menuitem', { name: 'Easy Ease (In-Out)' })).toContainText('F9');
  await menu.getByRole('menuitem', { name: 'Ease In', exact: true }).click();
  await expect(menu).toHaveCount(0);

  const eased = await xKeys(page);
  expect(eased[0].easing).toBe('easeIn');
  expect(eased[0].bezierControlPoints).toBeUndefined(); // it no longer outranks the named easing
  const track = await storedTrack(page, 'a');
  expect((track.channels as Record<string, Key[]>).y[0].easing).toBe('easeIn');

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Control+z');
  const undone = await xKeys(page);
  expect(undone[0].easing).toBe('cubic_bezier');
  expect(undone[0].bezierControlPoints).toEqual([0.1, 0.9, 0.2, 1]);
});

test('F9 eases the selected keyframes (Easy Ease); without a selection it does nothing', async ({ page }) => {
  await seed(page, [makeLayer('a', 'Part A')], twoKeyScene());
  await selectPart(page, 'Part A');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('F9');
  expect((await xKeys(page))[0].easing).toBe('linear');

  await page.locator('.keyframe-diamond').first().click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('F9');
  expect((await xKeys(page))[0].easing).toBe('easeInOut');
});
