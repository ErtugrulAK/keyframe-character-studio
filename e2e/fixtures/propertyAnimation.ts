import { expect, type Locator, type Page } from '@playwright/test';

/**
 * C10 — the timeline has no stopwatch. A property row carries its animation
 * state (`data-animation-state`: off / animated / keyed); an unanimated
 * property's "+" starts its animation, and the row's right-click "Remove all
 * keyframes" asks to stop it (the same confirmation as before).
 */
export const propertyRow = (page: Page, channel: string): Locator =>
  page.locator(`.ue-channel-row[data-property-channel="${channel}"]`);

export async function armProperty(page: Page, channel: string): Promise<void> {
  const row = propertyRow(page, channel);
  await expect(row).toHaveAttribute('data-animation-state', 'off');
  await row.locator('button.track-add-kf-btn').click();
}

/** Opens the row menu and asks to remove the property's keys; the confirmation dialog follows. */
export async function requestRemoveAllKeyframes(page: Page, channel: string): Promise<void> {
  await propertyRow(page, channel).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Remove all keyframes' }).click();
}
