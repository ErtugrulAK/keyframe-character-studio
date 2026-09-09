import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

async function clearProject(page: Page) {
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();
}

async function createShapeByDrag(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click();
  const box = await page.locator('.stage-canvas-container').boundingBox();
  if (!box) throw new Error('Canvas bounds unavailable');
  await page.mouse.move(box.x + 360, box.y + 280);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 200);
  await page.mouse.up();
}

async function saveAndReadScene(page: Page) {
  await page.getByTitle('Auto-saved every 10 seconds. Click to save manually.').click();
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

test('Named Sequence V2 — stable IDs, authoring metadata, Broadcast status, and safe deletion', async ({ page }) => {
  test.setTimeout(90000);
  await clearProject(page);

  // Fresh authoring workflow: create a real layer and a named sequence.
  await page.getByRole('button', { name: 'Vector Shapes & Graphic Elements' }).click();
  await createShapeByDrag(page, 'Rectangle');
  await page.getByTitle('Create New Sequence').click();
  await page.getByPlaceholder('Sequence name (e.g. In_V1, Out_V1)...').fill('IN');
  await page.getByRole('button', { name: 'Create Sequence', exact: true }).click();

  const firstTab = page.locator('.timeline-seq-tab').filter({ hasText: 'IN' });
  await expect(firstTab).toHaveCount(1);

  // Stable sequence identity is an internal serialization contract; the
  // current timeline exposes the display name only. Persistence and channel
  // references are asserted below through the saved scene authority.

  // Add canonical channels to the named sequence, then rename the display label.
  await page.getByTitle('Add Composite Keyframe').click();
  await page.locator('.timeline-seq-tab-name').filter({ hasText: 'IN' }).dblclick();
  await page.locator('.timeline-seq-tab input').fill('Lower Third Enter');
  await page.locator('.timeline-seq-tab input').press('Enter');
  await page.locator('.duration-control-box input[type="number"]').fill('1');
  await page.locator('.duration-control-box input[type="number"]').press('Tab');

  await page.getByTitle('Create New Sequence').click();
  await page.getByPlaceholder('Sequence name (e.g. In_V1, Out_V1)...').fill('SPECIAL');
  await page.getByRole('button', { name: 'Create Sequence', exact: true }).click();
  await page.locator('.duration-control-box input[type="number"]').fill('0.5');
  await page.locator('.duration-control-box input[type="number"]').press('Tab');
  await page.getByTitle('Add Composite Keyframe').click();

  const sceneBeforeBroadcast = await saveAndReadScene(page);
  const renamed = sceneBeforeBroadcast.motionTemplates.find((template: { name: string }) => template.name === 'Lower Third Enter');
  const special = sceneBeforeBroadcast.motionTemplates.find((template: { name: string }) => template.name === 'SPECIAL');
  expect(renamed.id).toMatch(/^seq_/);
  expect(renamed.id).not.toBe(renamed.name);
  expect(special.id).toMatch(/^seq_/);
  expect(sceneBeforeBroadcast.tracks.flatMap((track: { channels?: Record<string, { templateId?: string }[]> }) =>
    Object.values(track.channels || {}).flat(),
  ).some((keyframe: { templateId?: string }) => keyframe.templateId === renamed.id)).toBe(true);

  // Reload must preserve stable identity, display name, and per-sequence duration.
  await page.reload();
  await expect(page.locator('.timeline-seq-tab-name').filter({ hasText: 'Lower Third Enter' })).toBeVisible();
  await expect(page.locator('.duration-control-box input[type="number"]')).toHaveValue('0.5');
  const sceneAfterReload = await saveAndReadScene(page);
  expect(sceneAfterReload.motionTemplates.find((template: { id: string }) => template.id === renamed.id)).toMatchObject({
    name: 'Lower Third Enter',
    durationFrames: sceneBeforeBroadcast.fps,
  });

  // Broadcast starts clean and uses the existing named-sequence runtime/RAF.
  await page.getByText('BROADCAST', { exact: true }).click();
  await expect(page.locator('g[transform^="translate"]').first()).toHaveCount(0);

  const lowerCard = page.locator(`[data-sequence-id="${renamed.id}"]`);
  const specialCard = page.locator(`[data-sequence-id="${special.id}"]`);
  await expect(lowerCard).toHaveAttribute('data-sequence-status', 'idle');
  await lowerCard.click();
  await expect(lowerCard).toHaveAttribute('data-sequence-status', 'playing');
  await expect.poll(() => lowerCard.getAttribute('data-sequence-frame')).toMatch(/^[1-9]\d*$/);
  await expect.poll(() => lowerCard.getAttribute('data-sequence-status')).toBe('holding');
  await expect(lowerCard).toHaveAttribute('data-sequence-frame', String(sceneBeforeBroadcast.fps));

  // Another sequence interrupts immediately and starts at frame 0.
  await specialCard.click();
  await expect(specialCard).toHaveAttribute('data-sequence-status', 'playing');
  await expect.poll(() => specialCard.getAttribute('data-sequence-frame')).toMatch(/^[1-9]\d*$/);
  await expect.poll(() => specialCard.getAttribute('data-sequence-status')).toBe('holding');
  await expect(specialCard).toHaveAttribute('data-sequence-frame', String(Math.round(sceneBeforeBroadcast.fps * 0.5)));

  // Same sequence replay starts over from frame 0.
  await specialCard.click();
  await expect(specialCard).toHaveAttribute('data-sequence-status', 'playing');

  await page.getByText('EDIT MODE', { exact: true }).click();
  await expect(page.getByText('Lower Third Enter', { exact: true })).toBeVisible();

  // Safe delete removes only the selected sequence's channels and metadata.
  await page.locator('.timeline-seq-tab').filter({ hasText: 'SPECIAL' }).locator('.timeline-seq-tab-close').click();
  const deletionDialog = page.getByRole('dialog', { name: 'Delete sequence?' });
  await expect(deletionDialog).toBeVisible();
  await deletionDialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('.timeline-seq-tab-name').filter({ hasText: 'SPECIAL' })).toHaveCount(0);
  const sceneAfterDelete = await saveAndReadScene(page);
  expect(sceneAfterDelete.motionTemplates.some((template: { id: string }) => template.id === special.id)).toBe(false);
  expect(sceneAfterDelete.tracks.flatMap((track: { channels?: Record<string, { templateId?: string }[]> }) =>
    Object.values(track.channels || {}).flat(),
  ).some((keyframe: { templateId?: string }) => keyframe.templateId === special.id)).toBe(false);
  expect(sceneAfterDelete.motionTemplates.some((template: { id: string }) => template.id === renamed.id)).toBe(true);
});

test('Named Sequence V2 — long names remain usable at a narrow desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await clearProject(page);
  await page.getByTitle('Create New Sequence').click();
  const longName = 'Lower Third Enter — Long Editorial Sequence Name';
  await page.getByPlaceholder('Sequence name (e.g. In_V1, Out_V1)...').fill(longName);
  await page.getByRole('button', { name: 'Create Sequence', exact: true }).click();

  const tab = page.locator('.timeline-seq-tab').filter({ hasText: longName });
  await expect(tab).toHaveCount(1);
  const box = await tab.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(900);
  await expect(tab.locator('.timeline-seq-tab-name')).toHaveCSS('text-overflow', 'ellipsis');
});
