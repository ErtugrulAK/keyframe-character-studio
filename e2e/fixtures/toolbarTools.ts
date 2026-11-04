import type { Page } from '@playwright/test';

/**
 * Arms a creation tool from the authoring toolbar, by the name the left
 * Elements panel used to give it: the circle and the Pen have their own
 * buttons; the other shapes are in the shape button's flyout (right-click
 * opens it, as a held press does).
 */
export async function armTool(page: Page, name: string): Promise<void> {
  const toolbar = page.getByRole('toolbar', { name: 'Authoring tools' });
  if (name === 'Circle') {
    await toolbar.getByRole('button', { name: 'Add circle', exact: true }).click();
    return;
  }
  if (name === 'Free Draw' || name === 'Pen') {
    await toolbar.getByRole('button', { name: 'Pen', exact: true }).click();
    return;
  }
  const shapeButton = toolbar.locator('.tool-flyout-button').first();
  await shapeButton.click({ button: 'right' });
  await page.getByRole('menuitemradio', { name: new RegExp(`^${name}`) }).click();
}

/** Opens the project settings (resolution, autosave, Library) from File > Project Settings… */
export async function openProjectSettings(page: Page): Promise<void> {
  await page.getByRole('menubar', { name: 'Editor menu' }).getByRole('menuitem', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Project Settings…' }).click();
}
