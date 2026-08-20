import { test, expect, type Page } from '@playwright/test';

const SCENE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function channels(x: Array<Record<string, unknown>> = []): Record<string, unknown[]> {
  return { x, y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] };
}

async function seed(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate((key) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      layers: [
        { id: 'a', name: 'Source', type: 'custom_box', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, width: 100, height: 100, inAnimPreset: 'fade', inAnimDuration: 12, outAnimPreset: 'slide-right', outAnimDuration: 18 },
        { id: 'b', name: 'Target', type: 'custom_box', x: 300, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, width: 100, height: 100, inAnimPreset: 'none', outAnimPreset: 'none' },
      ],
      tracks: [
        { partId: 'a', channels: { x: [{ id: 'x0', frame: 0, value: 0, easing: 'linear', templateId: 'Sequence' }, { id: 'x30', frame: 30, value: 300, easing: 'linear', templateId: 'Sequence' }], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] } },
        { partId: 'b', channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] } },
      ],
      fps: 30, totalFrames: 90, projectResolution: { width: 1920, height: 1080 },
    }));
  }, SCENE_KEY);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible();
}

async function selectPart(page: Page, name: string): Promise<void> {
  await page.locator('.actor-node', { hasText: name }).click();
  await expect(page.getByText('ANIMATION DATA')).toBeVisible();
}

async function savedScene(page: Page): Promise<Record<string, unknown>> {
  await page.locator('.autosave-status-badge').click();
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), SCENE_KEY);
}

test.describe('M26 — animation data actions in the current Transform UI', () => {
  test('copy/paste transfers animation onto the target without changing identity or source', async ({ page }) => {
    await seed(page);
    await selectPart(page, 'Source');
    await page.getByRole('button', { name: 'Copy Animation', exact: true }).click();

    await selectPart(page, 'Target');
    await expect(page.getByRole('button', { name: 'Paste Animation', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Paste Animation', exact: true }).click();

    const scene = await savedScene(page) as { layers: Array<Record<string, unknown>>; tracks: Array<{ partId: string; channels: ReturnType<typeof channels> }> };
    const source = scene.layers.find((p) => p.id === 'a')!;
    const target = scene.layers.find((p) => p.id === 'b')!;
    expect(target.id).toBe('b');
    expect(target.inAnimPreset).toBe('fade');
    expect(target.outAnimPreset).toBe('slide-right');
    expect(source.inAnimPreset).toBe('fade');
    const sourceX = scene.tracks.find((t) => t.partId === 'a')!.channels.x;
    const targetX = scene.tracks.find((t) => t.partId === 'b')!.channels.x;
    expect(targetX.map((k) => k.frame)).toEqual([0, 30]);
    expect(targetX.map((k) => k.value)).toEqual([0, 300]);
    expect(targetX.map((k) => k.id)).not.toEqual(sourceX.map((k) => k.id));
  });

  test('clear resets animation fields and canonical channels without deleting the target', async ({ page }) => {
    await seed(page);
    await selectPart(page, 'Source');
    await page.getByRole('button', { name: 'Clear Animation', exact: true }).click();

    const scene = await savedScene(page) as { layers: Array<Record<string, unknown>>; tracks: Array<{ partId: string; channels: ReturnType<typeof channels> }> };
    const source = scene.layers.find((p) => p.id === 'a')!;
    expect(source.id).toBe('a');
    expect(source.inAnimPreset).toBe('none');
    expect(source.outAnimPreset).toBe('none');
    expect(source.inAnimDuration).toBe(30);
    expect(source.outAnimDuration).toBe(30);
    expect(scene.tracks.find((t) => t.partId === 'a')!.channels.x).toEqual([]);
  });
});
