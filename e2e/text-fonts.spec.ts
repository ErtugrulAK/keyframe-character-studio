import { expect, test } from '@playwright/test';

/**
 * Every text font the editor offers is bundled and really drawn: Bebas Neue,
 * Montserrat and Roboto used to be offered but never loaded, so the stage drew
 * them with a fallback face. Nothing is fetched from a font CDN.
 */

const FAMILIES = ['Outfit', 'Inter', 'Roboto', 'Montserrat', 'Playfair Display', 'Bebas Neue', 'JetBrains Mono'];

test('each offered text font loads from the app itself and draws differently from the fallback', async ({ page }) => {
  const fontHosts: string[] = [];
  page.on('request', (request) => {
    const host = new URL(request.url()).host;
    if (/fonts\.(googleapis|gstatic)\.com$/u.test(host)) fontHosts.push(host);
  });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

  const results = await page.evaluate(async (families) => {
    const sample = 'Hızlı ĞŞİ çağrı 0123';
    const width = (family: string) => {
      const context = document.createElement('canvas').getContext('2d')!;
      context.font = `bold 40px ${family}`;
      return context.measureText(sample).width;
    };
    const fallback = width('KcsNoSuchFont, sans-serif');
    const out: Array<{ family: string; loaded: boolean; differs: boolean }> = [];
    for (const family of families) {
      const faces = await document.fonts.load(`bold 40px "${family}"`, sample);
      out.push({ family, loaded: faces.length > 0, differs: Math.abs(width(`"${family}", sans-serif`) - fallback) > 1 });
    }
    return out;
  }, FAMILIES);

  for (const result of results) {
    expect(result.loaded, `${result.family} has a bundled face`).toBe(true);
    expect(result.differs, `${result.family} is drawn with its own glyphs`).toBe(true);
  }
  expect(fontHosts, 'no font CDN request').toEqual([]);
});
