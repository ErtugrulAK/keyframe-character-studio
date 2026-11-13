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

test('an OGraf export packages every bundled family with both subsets, its weights and licence', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  const result = await page.evaluate(async () => {
    const { prepareLegacyOGrafExport } = await import('/src/ograf/legacyCompatibility.ts');
    const { compileOGrafPackage } = await import('/src/ograf/packageCompiler.ts');
    const families = ['Outfit', 'Inter', 'Roboto', 'Montserrat', "'Bebas Neue'", "'JetBrains Mono'"];
    const scene = {
      version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Fonts', width: 1280, height: 720, fps: 30, totalFrames: 30,
      layers: families.map((fontFamily, index) => ({
        id: `t${index}`, name: `Text ${index}`, type: 'custom_text', x: 0, y: index * 60 - 150, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        visible: true, zIndex: index + 1, fillColor: '#ffffff', strokeColor: '#000000', textValue: 'Çağrı İŞĞ', fontSize: 40, fontFamily,
      })),
      tracks: [],
    };
    const prepared = await prepareLegacyOGrafExport(scene as never);
    const built = compileOGrafPackage(prepared.sceneData, prepared.options);
    const runtime = String(built.files.find((file) => file.kind === 'runtime')?.content ?? '');
    return {
      status: built.status,
      errors: built.diagnostics.filter((d) => d.severity === 'ERROR').map((d) => d.code),
      paths: built.files.map((file) => file.path).sort(),
      runtimeHasRanges: runtime.includes('U+0100-02BA') && runtime.includes('U+0000-00FF'),
      bebasWeight: runtime.includes('"assets/fonts/bebas-neue-latin.woff2","unicodeRange"') && runtime.includes('"fontWeight":"400"'),
    };
  });
  expect(result.errors, 'no blocking diagnostic').toEqual([]);
  expect(result.status).toBe('ready-to-materialize');
  for (const slug of ['outfit', 'inter', 'roboto', 'montserrat', 'bebas-neue', 'jetbrains-mono']) {
    expect(result.paths).toContain(`assets/fonts/${slug}-latin.woff2`);
    expect(result.paths).toContain(`assets/fonts/${slug}-latin-ext.woff2`);
    expect(result.paths).toContain(`assets/fonts/${slug}-latin.woff2.LICENSE.txt`);
  }
  expect(result.runtimeHasRanges, 'the runtime declares each subset with its unicode-range').toBe(true);
  expect(result.bebasWeight, 'Bebas Neue keeps its single weight, as in the editor').toBe(true);
});
