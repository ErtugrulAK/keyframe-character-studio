import { test, expect, type Page } from '@playwright/test';

/**
 * Astra F-08: the naming dialog let the keyboard walk out of the modal and left
 * focus on `body` after it closed. This drives the real editor with real keys —
 * the trap only exists in the browser's own focus order.
 */
const activeElementInsideDialog = (page: Page) =>
  page.evaluate(() => {
    const dialog = document.querySelector('[aria-modal="true"]');
    const active = document.activeElement;
    return { hasDialog: Boolean(dialog), inside: Boolean(dialog && active && dialog.contains(active)), label: active?.getAttribute('aria-label') ?? active?.textContent?.trim() ?? '' };
  });

test('the naming dialog keeps the keyboard and returns it to its opener', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

  const opener = page.getByRole('button', { name: 'Create New Sequence' });
  await opener.click();

  const dialog = page.locator('[role="dialog"][aria-modal="true"]');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create New Sequence' })).toBeVisible();

  // The field is the dialog's initial action.
  const focusedField = await page.evaluate(() => document.activeElement?.className ?? '');
  expect(focusedField).toContain('modal-input');

  // Walking the stops never leaves the dialog.
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press('Tab');
    const state = await activeElementInsideDialog(page);
    expect(state.hasDialog).toBe(true);
    expect(state.inside).toBe(true);
  }
  for (let step = 0; step < 3; step += 1) {
    await page.keyboard.press('Shift+Tab');
    expect((await activeElementInsideDialog(page)).inside).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});
