import { test, expect } from '@playwright/test';

test('editor exports the current project as an OGraf ZIP', async ({ page }) => {
  await page.goto('/');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: 'OGraf', exact: true }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/-ograf\.zip$/u);
  const path = await download.path();
  expect(path).toBeTruthy();
});
