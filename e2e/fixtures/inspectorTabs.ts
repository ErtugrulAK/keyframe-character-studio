import { expect, type Page } from '@playwright/test';

/**
 * C7 — the Inspector's Details tabs: Properties (transform, paint, text, Trim
 * Path, geometry, effects), Masks (layer masks, Track Matte, legacy clip
 * matte) and Layer (hierarchy / Parent, animation data). Opens one and checks
 * that it is the selected tab.
 */
export async function openDetailsTab(page: Page, name: 'Properties' | 'Masks' | 'Layer'): Promise<void> {
  const tab = page.getByRole('tab', { name: new RegExp(`^${name}`) });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

/**
 * C8 — the Details header has no Delete / Duplicate buttons any more. These
 * run the same commands the way a user now does: the keyboard for delete and
 * duplicate (focus released first, so a focused timeline row cannot take
 * Delete as "delete keyframes").
 */
export async function deleteSelectedLayer(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Delete');
}

export async function duplicateSelectedLayer(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Control+d');
}
