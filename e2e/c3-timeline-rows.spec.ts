/**
 * C3 — the timeline rows are memoized so a playhead frame does not re-render
 * every collapsed row. What a collapsed row shows of the playhead (its
 * previous/next keyframe navigation) must still follow the playhead, and its
 * actions must act on the CURRENT frame, never on a frame from a skipped render.
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
    { id: 'logo', name: 'Logo', type: 'custom_circle', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, fillColor: '#f59e0b', strokeColor: '#000', width: 100, height: 100 },
    { id: 'plain', name: 'Plain', type: 'custom_rect', x: 200, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#000', width: 100, height: 60 },
  ];
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers,
    tracks: layers.map((layer) => ({
      id: `track-${layer.id}`, partId: layer.id, name: layer.name, color: '#22d3ee', visible: true, locked: false, expanded: false,
      channels: { ...emptyChannels(), x: layer.id === 'logo' ? [{ id: 'k10', frame: 10, value: 0, easing: 'linear' }, { id: 'k40', frame: 40, value: 300, easing: 'linear' }] : [] },
    })),
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

const seek = async (page: Page, frame: number) => {
  const ruler = page.getByRole('slider', { name: 'Playhead position' });
  await ruler.focus();
  await page.keyboard.press('Home');
  for (let step = 0; step < Math.floor(frame / 10); step += 1) await page.keyboard.press('Shift+ArrowRight');
  for (let step = 0; step < frame % 10; step += 1) await page.keyboard.press('ArrowRight');
  await expect(ruler).toHaveAttribute('aria-valuenow', String(frame));
};

test('a collapsed row\'s keyframe navigation follows the playhead and its add-key action uses the current frame', async ({ page }) => {
  await seed(page);
  const row = page.locator('.ue-track-row', { hasText: 'Logo' }).first();
  const previous = row.getByRole('button', { name: /^Previous keyframe of Logo/ });
  const next = row.getByRole('button', { name: /^Next keyframe of Logo/ });

  await seek(page, 0);
  await expect(previous).toHaveAccessibleName('Previous keyframe of Logo (none)');
  await expect(next).toHaveAccessibleName('Next keyframe of Logo, frame 10');
  await seek(page, 25);
  await expect(previous).toHaveAccessibleName('Previous keyframe of Logo, frame 10');
  await expect(next).toHaveAccessibleName('Next keyframe of Logo, frame 40');
  await seek(page, 47);
  await expect(previous).toHaveAccessibleName('Previous keyframe of Logo, frame 40');
  await expect(next).toHaveAccessibleName('Next keyframe of Logo (none)');

  // Navigation jumps the playhead; the row then reports from the new frame.
  await previous.click();
  await expect(page.getByRole('slider', { name: 'Playhead position' })).toHaveAttribute('aria-valuenow', '40');
  await expect(next).toHaveAccessibleName('Next keyframe of Logo (none)');

  // The other row never animated: its add action must key frame 33, the frame
  // the playhead is on NOW (that row did not re-render while the playhead moved).
  await seek(page, 33);
  await page.locator('.ue-track-row', { hasText: 'Plain' }).first().getByTitle('Add Composite Keyframe').click();
  const scene = await savedScene(page);
  const plain = scene.tracks.find((track: any) => track.partId === 'plain');
  expect(plain.channels.x.map((key: any) => key.frame)).toEqual([33]);
});
