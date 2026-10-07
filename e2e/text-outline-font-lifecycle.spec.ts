import { test, expect } from '@playwright/test';

/**
 * A-02 — the text outline cache is invalidated when the font lifecycle settles.
 *
 * Real Chromium: the rasteriser only runs there (jsdom has no canvas). A trace
 * taken while a face is still loading is provisional and reused (no per-frame
 * thrash); once loading has settled it is retraced exactly once and kept, so the
 * geometry matches what the renderer now draws.
 *
 * The probe body is a string so the module specifier is resolved by the dev
 * server at runtime (the test intentionally exercises that boundary); a static
 * import here would be compiled against Node's resolver, not the browser's.
 */
test('a provisional text trace is retraced once the font settles', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

  const probe = await page.evaluate(`(async () => {
    const { getTextOutlinePolygons } = await import('/src/utils/textOutline.ts');
    const part = {
      id: 'probe', name: 'probe', type: 'custom_text',
      textValue: 'O', fontSize: 120, fontFamily: 'Audit Probe Face',
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    };

    const face = new FontFace('Audit Probe Face', 'url(/src/assets/fonts/playfair-display/PlayfairDisplay.ttf)');
    document.fonts.add(face);
    const loading = face.load();
    const statusWhileLoading = document.fonts.status;

    const provisional = getTextOutlinePolygons(part);
    const provisionalAgain = getTextOutlinePolygons(part);

    await loading;
    await document.fonts.ready;
    const statusAfterLoad = document.fonts.status;

    const settled = getTextOutlinePolygons(part);
    const settledAgain = getTextOutlinePolygons(part);

    return {
      statusWhileLoading,
      statusAfterLoad,
      provisionalIsGeometry: Array.isArray(provisional) && provisional.length > 0,
      reusedWhileLoading: provisional === provisionalAgain,
      retracedAfterSettle: settled !== provisional,
      reusedWhenSettled: settled === settledAgain,
    };
  })()`) as {
    statusWhileLoading: string;
    statusAfterLoad: string;
    provisionalIsGeometry: boolean;
    reusedWhileLoading: boolean;
    retracedAfterSettle: boolean;
    reusedWhenSettled: boolean;
  };

  expect(probe.statusWhileLoading).toBe('loading');
  expect(probe.statusAfterLoad).toBe('loaded');
  expect(probe.provisionalIsGeometry).toBe(true);
  // While loading: one raster is reused instead of retracing every frame.
  expect(probe.reusedWhileLoading).toBe(true);
  // After loading: the provisional raster is replaced exactly once.
  expect(probe.retracedAfterSettle).toBe(true);
  expect(probe.reusedWhenSettled).toBe(true);
});

/**
 * A-01: every family form the editor offers must trace. The canvas re-serialises
 * the family (quoting it), so a raw `includes` check rejected the quoted forms.
 */
test('quoted and fallback-list families trace real letterform geometry', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

  const probe = await page.evaluate(`(async () => {
    const { getTextOutlinePolygons } = await import('/src/utils/textOutline.ts');
    const trace = (fontFamily) => {
      const part = {
        id: 'probe', name: 'probe', type: 'custom_text',
        textValue: 'O', fontSize: 140, fontFamily,
        baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      };
      const polygons = getTextOutlinePolygons(part);
      return { ok: Array.isArray(polygons) && polygons.length > 0, rings: polygons ? polygons[0].length : 0 };
    };
    await document.fonts.ready;
    return {
      bare: trace('Outfit'),
      quoted: trace("'Playfair Display'"),
      fallbackList: trace("'Playfair Display', serif"),
      mono: trace("'JetBrains Mono'"),
    };
  })()`) as Record<string, { ok: boolean; rings: number }>;

  for (const [label, result] of Object.entries(probe)) {
    expect(result.ok, `${label} must trace`).toBe(true);
    // 'O' has a counter: a successful trace carries an exterior ring and a hole.
    expect(result.rings, `${label} must keep the counter`).toBeGreaterThanOrEqual(2);
  }
});

/**
 * A-05: the trace follows the renderer's SVG whitespace semantics, so two
 * visually identical texts produce identical Boolean geometry.
 */
test('repeated internal whitespace traces to the same geometry', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

  const probe = await page.evaluate(`(async () => {
    const { getTextOutlinePolygons } = await import('/src/utils/textOutline.ts');
    const trace = (textValue) => {
      const part = {
        id: 'probe', name: 'probe', type: 'custom_text',
        textValue, fontSize: 140, fontFamily: 'Outfit',
        baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      };
      return JSON.stringify(getTextOutlinePolygons(part));
    };
    await document.fonts.ready;
    return {
      single: trace('A A'),
      double: trace('A  A'),
      triple: trace('A   A'),
      padded: trace('  A A  '),
      plain: trace('A A'),
    };
  })()`) as Record<string, string>;

  expect(probe.double).toBe(probe.single);
  expect(probe.triple).toBe(probe.single);
  expect(probe.padded).toBe(probe.single);
  expect(probe.plain).toBe(probe.single);
});
