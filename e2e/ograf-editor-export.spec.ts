import { test, expect } from '@playwright/test';

test('editor exports the current project as an OGraf ZIP', async ({ page }) => {
  await page.goto('/');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTitle('Export as OGraf').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/-ograf\.zip$/u);
  const path = await download.path();
  expect(path).toBeTruthy();
});
