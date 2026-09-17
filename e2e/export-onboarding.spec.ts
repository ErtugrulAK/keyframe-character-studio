import { test, expect, type Page } from '@playwright/test';

/**
 * Milestone C — first export / onboarding flow (real-browser smoke).
 *
 * Walks the beginner journey against the real editor: open the first-export
 * guidance, run the readiness check (which reuses the export diagnostics
 * authority), see that a ready scene is not reported as exported, then produce
 * the actual OGraf package through the existing Export menu.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function makeLayer(id: string, name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, name, type: 'custom_box',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1,
    fillColor: '#22d3ee', strokeColor: '#101218', strokeWidth: 2, borderRadius: 0,
    width: 160, height: 120,
    ...overrides,
  };
}

async function seed(page: Page): Promise<void> {
  const scene = {
    version: 1,
    layers: [makeLayer('hero', 'Hero')],
    tracks: [],
    fps: 30,
    totalFrames: 60,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'First Export Demo',
  };
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); });
  await page.addInitScript(
    ([key, data]: [string, string]) => { localStorage.setItem(key, data); },
    [STORAGE_KEY, JSON.stringify(scene)],
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.stage-canvas-container')).toBeVisible({ timeout: 30000 });
}

test.describe('Milestone C — first export onboarding', () => {
  test('guidance, readiness check, and a real package export', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await seed(page);

    // The guidance is opt-in: nothing is shown until the user asks for it.
    await expect(page.getByRole('group', { name: 'First export help' })).toHaveCount(0);

    await page.getByRole('button', { name: 'First export help' }).click();
    const guide = page.getByRole('group', { name: 'First export help' });
    await expect(guide).toBeVisible();
    await expect(guide.getByText('FIRST OGRAF EXPORT')).toBeVisible();
    await expect(guide.getByText(/Keep at least one visible layer/)).toBeVisible();
    await expect(guide.getByText(/Nothing is written until you export/)).toBeVisible();

    // The readiness check reports readiness without claiming that anything was written.
    await page.getByRole('button', { name: 'Check export readiness' }).click();
    await expect(page.getByText('Ready to export', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/-ograf\.zip/).first()).toBeVisible();
    await expect(page.getByText(/^Exported/)).toHaveCount(0);

    // The guidance closes again and leaves the existing export surface untouched.
    await page.getByRole('button', { name: 'First export help' }).click();
    await expect(page.getByRole('group', { name: 'First export help' })).toHaveCount(0);

    // The real first export through the existing menu.
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'OGraf Package', exact: true }).click(),
    ]);
    // The ZIP writer names the archive <sanitized scene name>-ograf.zip.
    expect(download.suggestedFilename()).toMatch(/-ograf\.zip$/u);
    await expect(page.getByText(/^Exported "/)).toBeVisible({ timeout: 10000 });

    expect(consoleErrors).toEqual([]);
  });
});
