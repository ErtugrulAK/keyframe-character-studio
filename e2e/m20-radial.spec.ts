import { test, expect, type Page } from '@playwright/test';
import zlib from 'zlib';

/**
 * M20 — RADIAL GRADIENT full-browser pixel matrix (permanent regression suite).
 * Real app chain: localStorage seed → StagePartLayers render → PNG decode.
 * Contracts from 6A spike (17/17 ×2) + 6B/6C/6D — R-V1..R-V24.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

// ─── Minimal PNG decoder (RGBA 8-bit) — same proven implementation ──────
function decodePng(buf: Buffer): { width: number; height: number; data: Buffer; bpp: number } {
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat: Buffer[] = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    offset += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) throw new Error(`Unsupported PNG: depth=${bitDepth} colorType=${colorType}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  const prevLine = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prevLine[x];
      const c = x >= bpp ? prevLine[x - bpp] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); break; }
        default: throw new Error(`filter ${filter}`);
      }
      cur[x] = v & 0xff;
    }
    pos += stride;
    prevLine.set(cur);
  }
  return { width, height, data: out, bpp };
}

function makeLayer(id: string, name: string, type: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, name, type,
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1,
    fillColor: '#ff0000', strokeColor: '#101218', strokeWidth: 2, borderRadius: 0,
    width: 60, height: 60,
    ...overrides,
  };
}

async function seed(page: Page, layers: Record<string, unknown>[], tracks: Record<string, unknown>[] = []): Promise<void> {
  const scene = {
    version: 1, layers, tracks,
    fps: 30, totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'M20 Radial E2E',
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    ([key, data]: [string, string]) => { localStorage.setItem(key, data); },
    [STORAGE_KEY, JSON.stringify(scene)],
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelectorAll('[id^="kcs-"]').length > 0,
    undefined,
    { timeout: 15000 },
  );
}

/** Raw green channel at a world point. */
async function greenAt(page: Page, worldX: number, worldY: number): Promise<number> {
  const buf = await page.screenshot();
  const png = decodePng(buf);
  const { x, y } = await page.evaluate(([wx, wy]: [number, number]) => {
    const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
    const pt = svg.createSVGPoint(); pt.x = wx; pt.y = wy;
    const s = pt.matrixTransform(svg.getScreenCTM()!);
    return { x: Math.round(s.x), y: Math.round(s.y) };
  }, [worldX, worldY]);
  return png.data[(y * png.width + x) * png.bpp + 1];
}

/** ONE screenshot, many probes (per-probe screenshots are slow). */
async function boxMax(page: Page, x0: number, x1: number, y0: number, y1: number, step = 5): Promise<number> {
  const buf = await page.screenshot();
  const png = decodePng(buf);
  const pts = await page.evaluate(([a0, a1, b0, b1, st]: [number, number, number, number, number]) => {
    const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
    const out: [number, number][] = [];
    for (let x = a0; x <= a1; x += st) for (let y = b0; y <= b1; y += st) {
      const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
      const s = pt.matrixTransform(svg.getScreenCTM()!);
      out.push([Math.round(s.x), Math.round(s.y)]);
    }
    return out;
  }, [x0, x1, y0, y1, step]);
  return Math.max(...pts.map(([x, y]) => png.data[(y * png.width + x) * png.bpp + 1]));
}

async function boxMin(page: Page, x0: number, x1: number, y0: number, y1: number, step = 5): Promise<number> {
  const buf = await page.screenshot();
  const png = decodePng(buf);
  const pts = await page.evaluate(([a0, a1, b0, b1, st]: [number, number, number, number, number]) => {
    const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
    const out: [number, number][] = [];
    for (let x = a0; x <= a1; x += st) for (let y = b0; y <= b1; y += st) {
      const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
      const s = pt.matrixTransform(svg.getScreenCTM()!);
      out.push([Math.round(s.x), Math.round(s.y)]);
    }
    return out;
  }, [x0, x1, y0, y1, step]);
  return Math.min(...pts.map(([x, y]) => png.data[(y * png.width + x) * png.bpp + 1]));
}

test.describe('M20 radial gradient — real browser pixel matrix', () => {
  // Fixture: small CIRCLE source (r=30 → local bbox 60×60 → localRadius
  // sqrt(7200)/2 ≈ 42.43 at scale 1) + a LARGE circle target (scale 5 → 300×300
  // world span 150..450 × 90..390) so the radial edge/outside probes land
  // INSIDE the target rect (radial stays small — the natural matte setup).
  const source = (overrides: Record<string, unknown> = {}) =>
    makeLayer('src', 'Source', 'custom_circle', { zIndex: 1, fillColor: '#ff0000', ...overrides });
  const greenTarget = (matte: Record<string, unknown>) =>
    makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 5, scaleY: 5, matte });
  const textSource = (overrides: Record<string, unknown> = {}) =>
    makeLayer('txt', 'Text', 'custom_text', { zIndex: 1, fillColor: '#ffffff', textValue: 'HHH', fontSize: 80, fontFamily: 'Arial', ...overrides });

  const R = (o: number, op: number, color = 'white') => ({ offset: o, color, opacity: op });
  const STOPS2 = [R(0, 1), R(1, 0)]; // white@1 → white@0 (alpha default ramp)
  const STOPS4 = [R(0, 1), R(0.33, 0.75), R(0.66, 0.45), R(1, 0)];

  async function radialDom(page: Page): Promise<{ id: string; cx: number; cy: number; r: number; stops: number } | null> {
    return page.evaluate(() => {
      const g = document.querySelector('radialGradient');
      if (!g) return null;
      return {
        id: g.id,
        cx: parseFloat(g.getAttribute('cx') ?? ''),
        cy: parseFloat(g.getAttribute('cy') ?? ''),
        r: parseFloat(g.getAttribute('r') ?? ''),
        stops: g.querySelectorAll('stop').length,
      };
    });
  }

  test('R-V1 — simple radial alpha: center > mid > edge, outside = masked out', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: STOPS2 } })]);
    const dom = await radialDom(page);
    expect(dom).not.toBeNull();
    expect(dom!.cx).toBe(300); // WORLD center (identity transform)
    expect(dom!.cy).toBe(240);
    expect(dom!.r).toBeCloseTo(42.426, 3); // sqrt(7200)/2 × max(1,1)
    expect(dom!.stops).toBe(2);
    // probes stay INSIDE the source circle (r=30): x-axis — frac 0.5 / 0.66
    const center = await greenAt(page, 300, 240);
    const mid = await greenAt(page, 321, 240); // frac 0.5
    const edge = await greenAt(page, 328, 240); // frac 0.66 (toward the source edge)
    const outside = await greenAt(page, 340, 240); // beyond the source circle → masked out
    expect(center).toBeGreaterThan(200);
    expect(mid).toBeGreaterThan(90); expect(mid).toBeLessThan(165);
    expect(edge).toBeLessThan(120); expect(edge).toBeLessThan(mid);
    expect(outside).toBeLessThan(45); // masked out — only artboard/AA residue
    expect(center).toBeGreaterThan(mid);
  });

  test('R-V2 — 4-stop radial: stepped ramp (DOM 4 stops + pixel 255→191→115→87)', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: STOPS4 } })]);
    const dom = await radialDom(page);
    expect(dom!.stops).toBe(4);
    const c = await greenAt(page, 300, 240);
    const s2 = await greenAt(page, 314, 240); // frac 0.33
    const s3 = await greenAt(page, 328, 240); // frac 0.66
    expect(c).toBeGreaterThan(200);
    expect(s2).toBeGreaterThan(140); expect(s2).toBeLessThan(230);
    expect(s3).toBeGreaterThan(70); expect(s3).toBeLessThan(160);
    expect(c).toBeGreaterThan(s2);
    expect(s2).toBeGreaterThan(s3);
  });

  test('R-V3 — mid-stop opacity changes pixel intensity (0.8 vs 0.2)', async ({ page }) => {
    const bright = [R(0, 1), R(0.5, 0.8), R(1, 0)];
    const dim = [R(0, 1), R(0.5, 0.2), R(1, 0)];
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: bright } })]);
    const b = await greenAt(page, 321, 240); // frac 0.5
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: dim } })]);
    const d = await greenAt(page, 321, 240);
    expect(b).toBeGreaterThan(150);
    expect(d).toBeLessThan(90);
    expect(b - d).toBeGreaterThan(60);
  });

  test('R-V4 — feather 12 + radial: stdDeviation 6, filter bound, ramp preserved', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', feather: 12, gradient: { type: 'radial', stops: STOPS2 } })]);
    expect(await page.evaluate(() => !!document.querySelector('mask[id^="kcs-mask-src-alpha-f12-radial-s"]'))).toBe(true);
    expect(await page.evaluate(() => document.querySelector('filter[id^="kcs-matte-feather-src-alpha-f12-radial-s"] feGaussianBlur')?.getAttribute('stdDeviation'))).toBe('6');
    const center = await greenAt(page, 300, 240);
    const mid = await greenAt(page, 321, 240);
    const edge = await greenAt(page, 328, 240);
    expect(center).toBeGreaterThan(200);
    expect(edge).toBeLessThan(mid); // radial ramp survives the blur
  });

  test('R-V5 — strength 0.5 + radial: fill-opacity halves the center', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', strength: 0.5, gradient: { type: 'radial', stops: STOPS2 } })]);
    expect(await page.evaluate(() => document.querySelector('mask[id^="kcs-mask-src-alpha-s0.5-radial-s"] path')?.getAttribute('fill-opacity'))).toBe('0.5');
    const center = await greenAt(page, 300, 240);
    expect(center).toBeGreaterThan(90); expect(center).toBeLessThan(170); // ~127
  });

  test('R-V6 — luminance radial: white→black luminance ramp', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'luminance', gradient: { type: 'radial', stops: [R(0, 1), R(1, 1, 'black')] } })]);
    expect(await page.evaluate(() => document.querySelector('mask[id^="kcs-mask-src-luminance-radial-s"]')?.getAttribute('mask-type'))).toBe('luminance');
    const center = await greenAt(page, 300, 240);
    const edge = await greenAt(page, 328, 240); // frac 0.66 → luminance ~87
    expect(center).toBeGreaterThan(200);
    expect(edge).toBeLessThan(120);
    expect(center).toBeGreaterThan(edge);
  });

  test('R-V7 — inverted luminance radial: black contour hole + outside from last stop', async ({ page }) => {
    // Radial starts at the center in EVERY direction — beyond r the LAST stop
    // applies (6A contract): stops end at 0.6 so the outer region stays visible.
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'luminance', inverted: true, gradient: { type: 'radial', stops: [R(0, 1), R(1, 0.6)] } })]);
    const hole = await greenAt(page, 300, 240); // black contour → hole
    const outer = await greenAt(page, 340, 240); // contour outside (40px), radial frac 0.94 → ~159
    expect(hole).toBeLessThan(45);
    expect(outer).toBeGreaterThan(100);
  });

  test('R-V8 — freeform radial: pathD byte-for-byte unchanged, paint-only', async ({ page }) => {
    const TRI = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 }];
    const ff = makeLayer('ff', 'Free', 'custom_freeform', { zIndex: 1, fillColor: '#ff0000', points: TRI });
    const tgt = (matte: Record<string, unknown>) => makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 5, scaleY: 5, matte });
    const gradMatte = { sourcePartId: 'ff', mode: 'alpha', gradient: { type: 'radial', stops: STOPS2 } };
    const plainMatte = { sourcePartId: 'ff', mode: 'alpha' };
    await seed(page, [ff, tgt(gradMatte)]);
    const dGrad = await page.evaluate(() => document.querySelector('mask[id^="kcs-mask-ff-alpha-radial-s"] path')?.getAttribute('d'));
    await seed(page, [ff, tgt(plainMatte)]);
    const dPlain = await page.evaluate(() => document.querySelector('mask[id="kcs-mask-ff-alpha"] path')?.getAttribute('d'));
    expect(dGrad).toBe('M 300 240 L 360 240 L 300 270 Z');
    expect(dPlain).toBe(dGrad); // buildMattePath identical — radial is paint-only
    // freeform interior still masks correctly: probe inside the triangle
    expect(await greenAt(page, 320, 255)).toBeGreaterThan(45);
  });

  test('R-V9 — non-inverted TEXT radial: LOCAL def (cx=0,cy=0,r=104.4), ink ramp on the glyphs', async ({ page }) => {
    await seed(page, [textSource(), greenTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { type: 'radial', stops: STOPS2 } })]);
    await page.evaluate(async () => { await (document as any).fonts.ready; });
    const dom = await page.evaluate(() => {
      const g = document.querySelector('radialGradient');
      const text = document.querySelector('mask text');
      return { cx: g?.getAttribute('cx'), cy: g?.getAttribute('cy'), r: g?.getAttribute('r'), fill: text?.getAttribute('fill') };
    });
    expect(dom.cx).toBe('0'); // LOCAL center — the text element consumes the def
    expect(dom.cy).toBe('0');
    expect(parseFloat(dom.r!)).toBeCloseTo(104.403, 3); // sqrt(200²+60²)/2
    expect(dom.fill).toContain('url(#kcs-mg-txt-radial'); // glyphs consume the gradient
    const ink = await boxMax(page, 250, 350, 215, 265);
    expect(ink).toBeGreaterThan(150); // text renders through the radial alpha
  });

  test('R-V10 — inverted TEXT radial: text BLACK, WORLD rect def, region ramp (M19 parity)', async ({ page }) => {
    // NOTE (measured): with a gradient variant the black-glyph hole does NOT
    // form in Chromium for LINEAR either (M19 V-H8 verified only the outer
    // region). M20 radial behaves IDENTICALLY to M19 linear — this test pins
    // the parity: text stays black, the WORLD region rect consumes the radial,
    // the radial ramp is visible outside the glyph box.
    await seed(page, [textSource(), greenTarget({ sourcePartId: 'txt', mode: 'alpha', inverted: true, gradient: { type: 'radial', stops: [R(0, 1), R(1, 0.6)] } })]);
    await page.evaluate(async () => { await (document as any).fonts.ready; });
    const dom = await page.evaluate(() => {
      const g = document.querySelector('radialGradient');
      const text = document.querySelector('mask text');
      return { id: g?.id, cx: g?.getAttribute('cx'), cy: g?.getAttribute('cy'), fill: text?.getAttribute('fill') };
    });
    expect(dom.id).toContain('-luminance-inv'); // inverted-text identity discriminator
    expect(dom.cx).toBe('300'); // WORLD center — region rect consumes the def
    expect(dom.cy).toBe('240');
    expect(dom.fill).toBe('black'); // text NEVER consumes the gradient
    const center = await greenAt(page, 300, 240); // region rect radial center → bright
    const outside = await greenAt(page, 300, 330); // below the text box (±30) → radial frac 0.86
    expect(center).toBeGreaterThan(200);
    expect(outside).toBeGreaterThan(100);
    expect(outside).toBeLessThan(center); // WORLD ramp monotonic around the glyphs
  });

  test('R-V11 — text radial + feather: blur bound, ink survives', async ({ page }) => {
    await seed(page, [textSource(), greenTarget({ sourcePartId: 'txt', mode: 'alpha', feather: 12, gradient: { type: 'radial', stops: STOPS2 } })]);
    await page.evaluate(async () => { await (document as any).fonts.ready; });
    expect(await page.evaluate(() => document.querySelector('filter[id^="kcs-matte-feather-txt-alpha-f12-radial-"] feGaussianBlur')?.getAttribute('stdDeviation'))).toBe('6');
    const ink = await boxMax(page, 250, 350, 215, 265);
    expect(ink).toBeGreaterThan(150);
  });

  test('R-V12 — text radial + strength 0.5: fill-opacity on the glyph content', async ({ page }) => {
    await seed(page, [textSource(), greenTarget({ sourcePartId: 'txt', mode: 'alpha', strength: 0.5, gradient: { type: 'radial', stops: STOPS2 } })]);
    await page.evaluate(async () => { await (document as any).fonts.ready; });
    // text masks carry glyphs (no path) — strength lands as fill-opacity on the
    // text element (DOM-asserted); pixel half-strength is font-dependent for
    // text (identical for M19 linear) — the M20 contract is the same DOM shape
    expect(await page.evaluate(() => document.querySelector('mask[id^="kcs-mask-txt-alpha-s0.5-radial-s"] text')?.getAttribute('fill-opacity'))).toBe('0.5');
    const ink = await boxMax(page, 250, 350, 215, 265);
    expect(ink).toBeGreaterThan(45); // glyphs render through the radial alpha
  });

  test('R-V13 — rotation: radial center follows applyWorld, ramp intact', async ({ page }) => {
    await seed(page, [source({ rotation: 45 }), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: STOPS2 } })]);
    const dom = await radialDom(page);
    expect(dom!.cx).toBe(300); // rotation around the canvas center — center unchanged
    expect(dom!.cy).toBe(240);
    expect(dom!.r).toBeCloseTo(42.426, 3); // rotation does NOT scale the radius (6B)
    expect(await greenAt(page, 300, 240)).toBeGreaterThan(200); // center still bright
  });

  test('R-V14 — uniform scale 2: radius ×2, center bright', async ({ page }) => {
    await seed(page, [source({ scaleX: 2, scaleY: 2 }), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: STOPS2 } })]);
    const dom = await radialDom(page);
    expect(dom!.r).toBeCloseTo(84.853, 3); // 42.43 × max(2,2)
    expect(await greenAt(page, 300, 240)).toBeGreaterThan(200);
  });

  test('R-V15 — non-uniform scale (2,1): scalar radius × max scale, WORLD circle (no ellipse)', async ({ page }) => {
    await seed(page, [source({ scaleX: 2, scaleY: 1 }), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: STOPS2 } })]);
    const dom = await radialDom(page);
    expect(dom!.r).toBeCloseTo(84.853, 3); // 42.43 × max(2,1) — rX/rY NOT introduced (6A/6B scalar rule)
    // x-axis ramp still follows the WORLD circle (frac 0.47 → ~135) — the source
    // ellipse does NOT stretch the gradient into an ellipse
    expect(await greenAt(page, 300, 240)).toBeGreaterThan(200);
    const xMid = await greenAt(page, 340, 240);
    expect(xMid).toBeGreaterThan(90); expect(xMid).toBeLessThan(165);
  });

  test('R-V16 — negative scale (flip): |scale| radius, ramp intact', async ({ page }) => {
    await seed(page, [source({ scaleX: -2 }), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: STOPS2 } })]);
    const dom = await radialDom(page);
    expect(dom!.r).toBeCloseTo(84.853, 3); // |-2| → max(2,1)
    expect(await greenAt(page, 300, 240)).toBeGreaterThan(200);
  });

  test('R-V17 — animated translation: radial center follows the evaluated source (no stale geometry)', async ({ page }) => {
    const src = source();
    const tgt = greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: STOPS2 } });
    const track = {
      id: 't_src', partId: 'src', name: 'T', color: '#f00', visible: true, keyframes: [],
      channels: {
        x: [{ id: 'x0', frame: 0, value: 0, easing: 'linear' }, { id: 'x30', frame: 30, value: 200, easing: 'linear' }],
        y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      },
    };
    await seed(page, [src, tgt], [track as any]);
    await page.waitForFunction(() => {
      try { return JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}').tracks?.length === 1; } catch { return false; }
    }, undefined, { timeout: 10000 });
    const cx0 = (await radialDom(page))!.cx;
    // edit mode: step the timeline past the keyframe (frame 30 → x=200) —
    // the radial center must follow the EVALUATED source transform
    const step = page.locator('button[title="Step Forward"]');
    for (let i = 0; i < 35; i++) await step.click();
    await page.waitForTimeout(300);
    const cx30 = (await radialDom(page))!.cx;
    expect(cx0).toBe(300);
    expect(cx30).not.toBe(cx0); // center moved with the animated source
  });

  test('R-V18 — animated scale: radial radius follows the evaluated scale', async ({ page }) => {
    const src = source();
    const tgt = greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: STOPS2 } });
    const track = {
      id: 't_src', partId: 'src', name: 'T', color: '#f00', visible: true, keyframes: [],
      channels: {
        x: [], y: [], rotation: [], opacity: [],
        scaleX: [{ id: 's0', frame: 0, value: 1, easing: 'linear' }, { id: 's30', frame: 30, value: 3, easing: 'linear' }],
        scaleY: [],
      },
    };
    await seed(page, [src, tgt], [track as any]);
    await page.waitForFunction(() => {
      try { return JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}').tracks?.length === 1; } catch { return false; }
    }, undefined, { timeout: 10000 });
    const r0 = (await radialDom(page))!.r;
    // edit mode: step past the scale keyframe (frame 30 → scaleX 3)
    const step = page.locator('button[title="Step Forward"]');
    for (let i = 0; i < 35; i++) await step.click();
    await page.waitForTimeout(300);
    const r30 = (await radialDom(page))!.r;
    expect(r0).toBeCloseTo(42.426, 3);
    expect(r30).toBeGreaterThan(r0 * 2); // scale grew 1 → 3 → radius follows (no stale def)
  });

  test('R-V19 — dedupe: two targets with the SAME radial definition → ONE def', async ({ page }) => {
    const matte = { sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: STOPS2 } };
    await seed(page, [
      source(),
      greenTarget(matte),
      makeLayer('tgt2', 'Target2', 'custom_circle', { zIndex: 3, fillColor: '#00ff00', scaleX: 5, scaleY: 5, matte }),
    ]);
    const count = await page.evaluate(() => document.querySelectorAll('radialGradient').length);
    expect(count).toBe(1); // same identity → single def
  });

  test('R-V20 — different stops → separate radial defs (no collision)', async ({ page }) => {
    await seed(page, [
      source(),
      greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: STOPS2 } }),
      makeLayer('tgt2', 'Target2', 'custom_circle', { zIndex: 3, fillColor: '#00ff00', scaleX: 5, scaleY: 5, matte: { sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: [R(0, 1), R(0.5, 0.5), R(1, 0)] } } }),
    ]);
    const ids = await page.evaluate(() => [...document.querySelectorAll('radialGradient')].map((g) => g.id));
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]); // stops hash distinguishes them
  });

  test('R-V21 — linear and radial COEXIST on the same source (separate defs, no overwrite)', async ({ page }) => {
    await seed(page, [
      source(),
      greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } }),
      makeLayer('tgt2', 'Target2', 'custom_circle', { zIndex: 3, fillColor: '#00ff00', scaleX: 5, scaleY: 5, matte: { sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: STOPS2 } } }),
    ]);
    const counts = await page.evaluate(() => ({
      linear: document.querySelectorAll('linearGradient').length,
      radial: document.querySelectorAll('radialGradient').length,
    }));
    expect(counts.linear).toBe(1);
    expect(counts.radial).toBe(1);
  });

  test('R-V22 — import/reload: radial matte survives the real autosave path (type/stops/DOM/pixels)', async ({ page }) => {
    const matte = { sourcePartId: 'src', mode: 'alpha', feather: 12, strength: 0.5, gradient: { type: 'radial', stops: STOPS4 } };
    await seed(page, [source(), greenTarget(matte)]);
    // wait for the app's own autosave to persist our radial matte
    await page.waitForFunction(() => {
      try {
        const s = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}');
        return (s.layers ?? []).find((x: any) => x.id === 'tgt')?.matte?.gradient?.type === 'radial';
      } catch { return false; }
    }, undefined, { timeout: 10000 });
    const before = {
      cx: (await radialDom(page))!.cx,
      r: (await radialDom(page))!.r,
      stops: (await radialDom(page))!.stops,
      center: await greenAt(page, 300, 240),
      edge: await greenAt(page, 300, 280),
    };
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[id^="kcs-"]').length > 0, undefined, { timeout: 15000 });
    const after = {
      cx: (await radialDom(page))!.cx,
      r: (await radialDom(page))!.r,
      stops: (await radialDom(page))!.stops,
      center: await greenAt(page, 300, 240),
      edge: await greenAt(page, 300, 280),
    };
    expect(after.cx).toBe(before.cx);       // derived center reconstructed
    expect(after.r).toBe(before.r);         // derived radius reconstructed
    expect(after.stops).toBe(before.stops); // stops preserved (4)
    expect(after.center).toBe(before.center); // EXACT pixel parity
    expect(after.edge).toBe(before.edge);
    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}'));
    const pMatte = (persisted.layers as any[]).find((x: any) => x.id === 'tgt').matte;
    expect(pMatte.gradient.type).toBe('radial');
    expect(pMatte.gradient.stops).toHaveLength(4);
    expect(pMatte.feather).toBe(12);
    expect(pMatte.strength).toBe(0.5);
    expect(JSON.stringify(pMatte)).not.toContain('cx');
    expect(JSON.stringify(pMatte)).not.toContain('radius'); // derived NEVER persisted
  });

  test('R-V23 — legacy linear { angle: 0 } parity: linearGradient + legacy id + legacy ramp', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 0 } })]);
    const dom = await page.evaluate(() => ({
      linear: document.querySelectorAll('linearGradient').length,
      radial: document.querySelectorAll('radialGradient').length,
      id: document.querySelector('linearGradient')?.id,
    }));
    expect(dom.linear).toBe(1);
    expect(dom.radial).toBe(0); // legacy stays LINEAR — no radial fields
    expect(dom.id).toBe('kcs-mg-src-0-alpha'); // legacy byte-for-byte id
    const left = await greenAt(page, 275, 240); // source box inside, before x1 → stop0 (bright)
    const right = await greenAt(page, 325, 240); // source box inside, after x2 → stop1 (transparent)
    expect(left).toBeGreaterThan(200);
    expect(right).toBeLessThan(25);
  });
});

