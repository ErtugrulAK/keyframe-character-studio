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
