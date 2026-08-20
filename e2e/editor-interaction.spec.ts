import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function emptyChannels(): Record<string, unknown[]> {
  return { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] };
}

async function seed(page: Page, layers: Record<string, unknown>[], tracks: Record<string, unknown>[]): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    ([key, scene]: [string, string]) => localStorage.setItem(key, scene),
    [STORAGE_KEY, JSON.stringify({
      version: 1,
      layers,
      tracks,
      fps: 30,
      totalFrames: 90,
      projectResolution: { width: 1920, height: 1080 },
    })],
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

function layer(id: string, name: string, type: string, x: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, name, type, x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: id === 'source' ? 1 : 2,
    width: 160, height: 100, fillColor: id === 'source' ? '#ffffff' : '#ff2080',
    strokeColor: '#101218', strokeWidth: 2,
    ...extra,
  };
}

async function selectPart(page: Page, name: string): Promise<void> {
  await page.locator('.actor-node', { hasText: name }).first().click();
}

async function saveNow(page: Page): Promise<void> {
  await page.locator('.autosave-status-badge').click();
}

test.describe('editor interaction regressions', () => {
  for (const fixture of [
    { label: 'inside', x: 0, type: 'custom_box' },
    { label: 'partially clipped', x: 120, type: 'custom_box' },
    { label: 'fully clipped', x: 220, type: 'custom_image' },
  ]) {
    test(`selected matte target remains draggable when ${fixture.label}`, async ({ page }) => {
      const targetExtra = fixture.type === 'custom_image'
        ? { imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="160" height="100"%3E%3Crect width="160" height="100" fill="%23ff2080"/%3E%3C/svg%3E' }
        : {};
      await seed(page, [
        layer('source', 'Matte Source', 'custom_box', 0, { width: 200, height: 140 }),
        layer('target', 'Matte Target', fixture.type, fixture.x, {
          ...targetExtra,
          matte: { sourcePartId: 'source', mode: 'clip', enabled: true },
        }),
      ], [
        { partId: 'source', channels: emptyChannels() },
        { partId: 'target', channels: emptyChannels() },
      ]);
      await selectPart(page, 'Matte Target');

      const hitArea = page.locator('[data-testid="matte-editor-hit-area"][data-part-id="target"]');
      await expect(hitArea).toBeVisible();
      const targetOuter = page.locator('g[clip-path="url(#kcs-clip-source)"]').first();
      await expect(targetOuter).toHaveCount(1);
      expect(await targetOuter.evaluate((outer, hitAreaElement) => !outer.contains(hitAreaElement), await hitArea.elementHandle())).toBe(true);

      const box = await hitArea.boundingBox();
      expect(box).not.toBeNull();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.down();
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      await page.mouse.move(box!.x + box!.width / 2 + 80, box!.y + box!.height / 2, { steps: 4 });
      await page.mouse.up();
      await saveNow(page);

      await expect.poll(() => page.evaluate((key) => {
        const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
        return scene.layers?.find((candidate: { id: string }) => candidate.id === 'target')?.x;
      }, STORAGE_KEY)).not.toBe(fixture.x);
      await expect(targetOuter).toHaveAttribute('clip-path', 'url(#kcs-clip-source)');

      if (fixture.label === 'fully clipped') {
        await page.getByText('BROADCAST', { exact: true }).click();
        await expect(page.locator('[data-testid="matte-editor-hit-area"]')).toHaveCount(0);
      }
    });
  }

  test('Backspace deletes the selected canonical frame group, preserves the part, and one undo restores it', async ({ page }) => {
    const channels = emptyChannels();
    channels.x = [
      { id: 'x20', frame: 20, value: 55, easing: 'linear', templateId: 'Sequence' },
      { id: 'x30', frame: 30, value: 80, easing: 'linear', templateId: 'Sequence' },
    ];
    channels.rotation = [{ id: 'r20', frame: 20, value: 30, easing: 'linear', templateId: 'Sequence' }];
    await seed(page, [layer('part', 'Animated Part', 'custom_box', 0)], [
      { partId: 'part', channels },
    ]);
    await selectPart(page, 'Animated Part');
    await page.locator('.keyframe-diamond').first().click();
    await page.locator('.tab-btn', { hasText: /^Transform/ }).click();
    await expect(page.getByText('SELECTED KEYFRAME @ FRAME 20')).toBeVisible();

    await page.keyboard.press('Backspace');

    await expect(page.getByText('SELECTED KEYFRAME @ FRAME 20')).toHaveCount(0);
    await expect(page.locator('.actor-node', { hasText: 'Animated Part' })).toHaveCount(1);
    await expect(page.locator('.keyframe-diamond')).toHaveCount(1);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

    await page.keyboard.press('Control+Z');
    await expect(page.locator('.keyframe-diamond')).toHaveCount(2);
    await expect(page.locator('.actor-node', { hasText: 'Animated Part' })).toHaveCount(1);
  });

  test('Delete has the same keyframe precedence and focused inputs suppress editor deletion', async ({ page }) => {
    const channels = emptyChannels();
    channels.x = [{ id: 'x20', frame: 20, value: 55, easing: 'linear', templateId: 'Sequence' }];
    await seed(page, [layer('part', 'Animated Part', 'custom_box', 0)], [{ partId: 'part', channels }]);
    await selectPart(page, 'Animated Part');
    await page.locator('.keyframe-diamond').click();
    await page.locator('.tab-btn', { hasText: /^Transform/ }).click();
    const input = page.locator('input[aria-label="Keyframe Location X"]');
    await input.focus();
    await page.keyboard.press('Backspace');
    await expect(page.locator('.actor-node', { hasText: 'Animated Part' })).toHaveCount(1);
    await expect(page.locator('.keyframe-diamond')).toHaveCount(1);

    await page.locator('.keyframe-diamond').click();
    await page.keyboard.press('Delete');
    await expect(page.locator('.keyframe-diamond')).toHaveCount(0);
    await expect(page.locator('.actor-node', { hasText: 'Animated Part' })).toHaveCount(1);
  });

  test('Backspace keeps the existing part-delete behavior when no keyframe is selected', async ({ page }) => {
    await seed(page, [layer('part', 'Plain Part', 'custom_box', 0)], []);
    await selectPart(page, 'Plain Part');

    await page.keyboard.press('Backspace');

    await expect(page.locator('.actor-node', { hasText: 'Plain Part' })).toHaveCount(0);
  });
});
