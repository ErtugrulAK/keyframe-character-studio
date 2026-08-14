import { test, expect, type Page } from '@playwright/test';
import zlib from 'zlib';

/**
 * M21 — IMAGE MATTE full-browser pixel matrix (permanent regression suite).
 * Real app chain: localStorage seed → StagePartLayers render → PNG decode.
 * Contracts from 7A spike (16/16 ×2) — V-M1..V-M9.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

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
  // pre-decode every data-URI payload into the browser image cache FIRST —
  // SVG <image> elements then resolve from cache synchronously and the mask
  // alpha/luminance reads are deterministic (no decode-timing flake)
  const uris = [...new Set(
    layers
      .map((l) => (l.imageUrl as string | undefined) ?? '')
      .filter((u) => u.startsWith('data:')),
  )];
  await page.goto('/');
  await page.evaluate(async (srcs: string[]) => {
    await Promise.all(srcs.map((src) => new Promise<void>((res) => {
      const im = new Image();
      im.onload = () => res();
      im.onerror = () => res();
      im.src = src;
    })));
  }, uris);
  const scene = {
    version: 1, layers, tracks,
    fps: 30, totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'M21 Image Matte E2E',
  };
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
  // settle window for the SVG <image> elements to composite their cache-hit
  // payloads into the mask (measured: fully-decoded luminance reads within
  // ~1.2s — 1000ms measured flaky, keep the margin)
  await page.waitForTimeout(1500);
}

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

// ─── Deterministic data-URI image fixtures (network-free) ───────────────
function imgDataUri(body: string, w = 200, h = 100): string {
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
}
const FIX_HALF = imgDataUri('<rect x="0" y="0" width="100" height="100" fill="white"/>'); // left opaque, right transparent
const FIX_HALF_BW = imgDataUri('<rect x="0" y="0" width="100" height="100" fill="white"/><rect x="100" y="0" width="100" height="100" fill="black"/>');
const FIX_WIDE = imgDataUri('<rect x="0" y="0" width="400" height="100" fill="white"/>', 400, 100);
const FIX_WHITE = imgDataUri('<rect x="0" y="0" width="200" height="100" fill="white"/>');
// black-opaque variants: alpha 1 but ZERO green-channel bleed from the
// visible source layer (the source stays part of the scene below the matted
// target — pixel probes then read the PURE mask value like the 7A spike)
const FIX_BLACK = imgDataUri('<rect x="0" y="0" width="200" height="100" fill="black"/>');
const FIX_WIDE_BLACK = imgDataUri('<rect x="0" y="0" width="400" height="100" fill="black"/>', 400, 100);
const FIX_BW_SQUARE = imgDataUri('<rect x="0" y="0" width="100" height="100" fill="white"/><rect x="100" y="0" width="100" height="100" fill="black"/>', 200, 100);

test.describe('M21 image matte — real browser pixel matrix', () => {
  const imgSource = (href: string, overrides: Record<string, unknown> = {}) =>
    makeLayer('img', 'Image', 'custom_image', { zIndex: 1, imageUrl: href, width: 200, height: 150, ...overrides });
  const greenTarget = (matte: Record<string, unknown>) =>
    makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 5, scaleY: 5, matte });
  const R = (o: number, op: number) => ({ offset: o, color: 'white', opacity: op });
  const STOPS2 = [R(0, 1), R(1, 0)];

  test('V-M1 — image + alpha: opaque region visible, transparent region hidden', async ({ page }) => {
    await seed(page, [imgSource(FIX_HALF), greenTarget({ sourcePartId: 'img', mode: 'alpha' })]);
    const dom = await page.evaluate(() => ({
      hasImage: !!document.querySelector('mask[id="kcs-mask-img-alpha"] image'),
      hasPath: document.querySelectorAll('mask[id="kcs-mask-img-alpha"] path').length,
      href: document.querySelector('mask image')?.getAttribute('href'),
    }));
    expect(dom.hasImage).toBe(true);
    expect(dom.hasPath).toBe(0); // content element — no geometry path
    expect(dom.href).toContain('data:image/svg+xml');
    const opaque = await greenAt(page, 250, 240); // left white half → alpha 1
    const transparent = await greenAt(page, 350, 240); // right transparent half → alpha 0
    const outside = await greenAt(page, 150, 240);
    expect(opaque).toBeGreaterThan(200);
    expect(transparent).toBeLessThan(45);
    expect(outside).toBeLessThan(45);
  });

  test('V-M2 — image + luminance: white visible, black hidden', async ({ page }) => {
    await seed(page, [imgSource(FIX_HALF_BW), greenTarget({ sourcePartId: 'img', mode: 'luminance' })]);
    expect(await page.evaluate(() => document.querySelector('mask[id="kcs-mask-img-luminance"]')?.getAttribute('mask-type'))).toBe('luminance');
    const white = await greenAt(page, 250, 240);
    const black = await greenAt(page, 350, 240);
    expect(white).toBeGreaterThan(200);
    expect(black).toBeLessThan(45);
  });

  test('V-M3 — image + inverted: luminance structure — dark pixels hole, bright pixels visible', async ({ page }) => {
    await seed(page, [imgSource(FIX_HALF_BW), greenTarget({ sourcePartId: 'img', mode: 'alpha', inverted: true })]);
    expect(await page.evaluate(() => document.querySelector('mask[id="kcs-mask-img-alpha-inv"]')?.getAttribute('mask-type'))).toBe('luminance');
    const bright = await greenAt(page, 250, 240); // white image area stays visible (7A: cannot repaint)
    const dark = await greenAt(page, 350, 240); // black image area → hole
    const noImg = await greenAt(page, 170, 240); // outside image, INSIDE the target circle (150..450 — (150,240) is the AA edge)
    // poll: the data-URI luminance composite settles within a couple of
    // screenshot passes (decode gate — measured: first pass can be partial)
    await expect.poll(async () => greenAt(page, 250, 240)).toBeGreaterThan(150);
    await expect.poll(async () => greenAt(page, 170, 240)).toBeGreaterThan(150);
    expect(dark).toBeLessThan(45);
  });

  test('V-M4 — image + strength 0.5: opacity halves the mask intensity', async ({ page }) => {
    await seed(page, [imgSource(FIX_BLACK), greenTarget({ sourcePartId: 'img', mode: 'alpha', strength: 0.5 })]);
    expect(await page.evaluate(() => document.querySelector('mask[id="kcs-mask-img-alpha-s0.5"] image')?.getAttribute('opacity'))).toBe('0.5');
    expect(await page.evaluate(() => document.querySelector('mask[id="kcs-mask-img-alpha-s0.5"] image')?.getAttribute('fill-opacity'))).toBeNull(); // 7A: fill-opacity INERT
    const opaque = await greenAt(page, 250, 240);
    expect(opaque).toBeGreaterThan(90); expect(opaque).toBeLessThan(170); // ~128
  });

  test('V-M5 — image + feather: same filter pipeline, edge ramp', async ({ page }) => {
    await seed(page, [imgSource(FIX_BLACK), greenTarget({ sourcePartId: 'img', mode: 'alpha', feather: 12 })]);
    expect(await page.evaluate(() => document.querySelector('filter[id="kcs-matte-feather-img-alpha-f12"] feGaussianBlur')?.getAttribute('stdDeviation'))).toBe('6');
    const inside = await greenAt(page, 250, 240);
    const rampA = await greenAt(page, 205, 240);
    const outside = await greenAt(page, 180, 240);
    expect(inside).toBeGreaterThan(200);
    expect(outside).toBeLessThan(45);
    expect(rampA).toBeGreaterThan(outside); // blur ramp at the image edge
  });

  test('V-M6 — image + LINEAR gradient: nested-mask multiplication (image × gradient)', async ({ page }) => {
    // wide image (400×150 world x 100..500) × linear gradient (box endpoints 100→500)
    await seed(page, [imgSource(FIX_WIDE_BLACK, { width: 400 }), greenTarget({ sourcePartId: 'img', mode: 'alpha', gradient: { angle: 0, stops: STOPS2 } })]);
    const dom = await page.evaluate(() => ({
      contentMask: !!document.querySelector('mask[id="kcs-mask-img-img"]'),
      nested: !!document.querySelector('mask[id^="kcs-mask-img-alpha-g0-"] g[mask="url(#kcs-mask-img-img)"]'),
      imageFill: !!document.querySelector('mask image[fill^="url("]'),
    }));
    expect(dom.contentMask).toBe(true); // image alpha rides its own mask
    expect(dom.nested).toBe(true); // final mask wraps the gradient rect with it
    expect(dom.imageFill).toBe(false); // <image> NEVER consumes the gradient
    const near = await greenAt(page, 250, 240); // frac 0.375 → ~159
    const mid = await greenAt(page, 400, 240); // frac 0.75 → ~64
    const far = await greenAt(page, 450, 240); // frac 0.875 → ~32
    expect(near).toBeGreaterThan(140);
    expect(mid).toBeGreaterThan(45); expect(mid).toBeLessThan(100);
    expect(far).toBeLessThan(45);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });

  test('V-M7 — image + RADIAL gradient: same nested composition', async ({ page }) => {
    await seed(page, [imgSource(FIX_WIDE_BLACK, { width: 400 }), greenTarget({ sourcePartId: 'img', mode: 'alpha', gradient: { type: 'radial', stops: STOPS2 } })]);
    const dom = await page.evaluate(() => ({
      radial: !!document.querySelector('radialGradient'),
      contentMask: !!document.querySelector('mask[id="kcs-mask-img-img"]'),
    }));
    expect(dom.radial).toBe(true);
    expect(dom.contentMask).toBe(true);
    // image box (400×150) → radial r = sqrt(400²+150²)/2 ≈ 213.6
    const center = await greenAt(page, 300, 240);
    const mid = await greenAt(page, 400, 240); // frac 0.47 → ~135
    const edge = await greenAt(page, 490, 240); // frac 0.89 → ~28
    expect(center).toBeGreaterThan(200);
    expect(mid).toBeGreaterThan(90); expect(mid).toBeLessThan(165);
    expect(edge).toBeLessThan(45);
    expect(center).toBeGreaterThan(mid);
  });

  test('V-M8 — image transform: content follows the source transform (scale)', async ({ page }) => {
    await seed(page, [imgSource(FIX_HALF, { scaleX: 2 }), greenTarget({ sourcePartId: 'img', mode: 'alpha' })]);
    const transform = await page.evaluate(() => document.querySelector('mask[id="kcs-mask-img-alpha"] g')?.getAttribute('transform'));
    expect(transform).toContain('scale(2, 1)');
    // world: image 400×150; FIX_HALF left half → x 100..300
    const leftWhite = await greenAt(page, 200, 240);
    const rightTransparent = await greenAt(page, 400, 240);
    expect(leftWhite).toBeGreaterThan(200);
    expect(rightTransparent).toBeLessThan(60); // AA edge tolerance
  });

  test('V-M9 — animated image source: content follows the evaluated transform (no stale)', async ({ page }) => {
    const src = imgSource(FIX_BLACK);
    const tgt = greenTarget({ sourcePartId: 'img', mode: 'alpha' });
    const track = {
      id: 't_img', partId: 'img', name: 'T', color: '#f00', visible: true, keyframes: [],
      channels: {
        x: [{ id: 'x0', frame: 0, value: 0, easing: 'linear' }, { id: 'x30', frame: 30, value: 200, easing: 'linear' }],
        y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      },
    };
    await seed(page, [src, tgt], [track as any]);
    await page.waitForFunction(() => {
      try { return JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}').tracks?.length === 1; } catch { return false; }
    }, undefined, { timeout: 10000 });
    const t0 = await page.evaluate(() => document.querySelector('mask[id="kcs-mask-img-alpha"] g')?.getAttribute('transform'));
    expect(t0).toContain('translate(300, 240)');
    const step = page.locator('button[title="Step Forward"]');
    for (let i = 0; i < 35; i++) await step.click();
    await page.waitForTimeout(800); // re-render + image decode settle at the new spot
    const t30 = await page.evaluate(() => document.querySelector('mask[id="kcs-mask-img-alpha"] g')?.getAttribute('transform'));
    expect(t30).toContain('translate(500, 240)'); // moved with the animated source
    // NOTE: probes must stay INSIDE the target circle (150..450 world):
    // old image area → (250,240); new image area (400..600) ∩ target → (430,240).
    // Also avoid (300,240) — the edit-mode cyan center marker lives exactly there.
    const stale = await greenAt(page, 250, 240); // old image area (inside target)
    const moved = await greenAt(page, 430, 240); // new image area (inside target)
    expect(stale).toBeLessThan(45); // no stale content at the old location
    await expect.poll(async () => greenAt(page, 430, 240)).toBeGreaterThan(200);
  });

  // ─── V-M10..V-M26 — final validation matrix (7E) ──────────────────────
  test('V-M10 — image + 4-stop LINEAR gradient: stepped ramp via nested composition', async ({ page }) => {
    const stops = [R(0, 1), R(0.33, 0.75), R(0.66, 0.5), R(1, 0)];
    await seed(page, [imgSource(FIX_WIDE_BLACK, { width: 400 }), greenTarget({ sourcePartId: 'img', mode: 'alpha', gradient: { angle: 0, stops } })]);
    // box x 100..500 → stops at 100/232/364/500; probes interpolate: 250→0.72,
    // 350→0.53, 430→0.26, 480→0.07
    const s0 = await greenAt(page, 250, 240); // ~183
    const s1 = await greenAt(page, 350, 240); // ~134
    const s2 = await greenAt(page, 430, 240); // ~66
    const s3 = await greenAt(page, 480, 240); // ~19
    expect(s0).toBeGreaterThan(150); expect(s0).toBeLessThan(210);
    expect(s1).toBeGreaterThan(100); expect(s1).toBeLessThan(170);
    expect(s2).toBeGreaterThan(40); expect(s2).toBeLessThan(100);
    expect(s3).toBeLessThan(60);
    expect(s0).toBeGreaterThan(s1);
    expect(s1).toBeGreaterThan(s2);
    expect(s2).toBeGreaterThan(s3);
    const stopsInDom = await page.evaluate(() => document.querySelector('linearGradient')?.querySelectorAll('stop').length);
    expect(stopsInDom).toBe(4);
  });

  test('V-M11 — image + gradient + FEATHER: blur applied over the nested composition', async ({ page }) => {
    await seed(page, [imgSource(FIX_BLACK), greenTarget({ sourcePartId: 'img', mode: 'alpha', feather: 12, gradient: { angle: 0, stops: STOPS2 } })]);
    expect(await page.evaluate(() => document.querySelector('filter feGaussianBlur')?.getAttribute('stdDeviation'))).toBe('6');
    const inside = await greenAt(page, 250, 240); // gradient near (frac 0.25 → ~191)
    const ramp = await greenAt(page, 205, 240); // image edge blur
    const outside = await greenAt(page, 180, 240);
    expect(inside).toBeGreaterThan(150);
    expect(outside).toBeLessThan(45);
    expect(ramp).toBeGreaterThan(outside);
  });

  test('V-M12 — image + gradient + STRENGTH 0.5: opacity on the content mask (NOT fill-opacity)', async ({ page }) => {
    await seed(page, [imgSource(FIX_BLACK), greenTarget({ sourcePartId: 'img', mode: 'alpha', strength: 0.5, gradient: { angle: 0, stops: STOPS2 } })]);
    const dom = await page.evaluate(() => {
      const contentImg = document.querySelector('mask[id="kcs-mask-img-img"] image');
      const finalMask = document.querySelector('mask[id^="kcs-mask-img-alpha"]'); // strength suffix (-s0.5) may sit between alpha and -g0
      return {
        contentOpacity: contentImg?.getAttribute('opacity'),
        contentFillOpacity: contentImg?.getAttribute('fill-opacity'),
        hasNested: !!finalMask?.querySelector('g[mask="url(#kcs-mask-img-img)"]'),
      };
    });
    expect(dom.contentOpacity).toBe('0.5'); // strength → opacity (7A contract)
    expect(dom.contentFillOpacity).toBeNull(); // fill-opacity NEVER used for image
    expect(dom.hasNested).toBe(true); // gradient composition intact
    const near = await greenAt(page, 250, 240);
    expect(near).toBeGreaterThan(90); expect(near).toBeLessThan(170); // ~127 = 255×0.5
  });

  test('V-M13 — image + RADIAL + 4-stop: radial multi-stop ramp', async ({ page }) => {
    const stops = [R(0, 1), R(0.33, 0.75), R(0.66, 0.5), R(1, 0)];
    await seed(page, [imgSource(FIX_WIDE_BLACK, { width: 400 }), greenTarget({ sourcePartId: 'img', mode: 'alpha', gradient: { type: 'radial', stops } })]);
    expect(await page.evaluate(() => document.querySelector('radialGradient')?.querySelectorAll('stop').length)).toBe(4);
    const center = await greenAt(page, 300, 240); // stop0 → 255
    const mid = await greenAt(page, 400, 240); // frac 0.47 → ~0.66×255=169
    expect(center).toBeGreaterThan(200);
    expect(mid).toBeGreaterThan(120); expect(mid).toBeLessThan(200);
    expect(center).toBeGreaterThan(mid);
  });

  test('V-M14 — image + INVERTED + RADIAL: luminance semantics + nested gradient below the image', async ({ page }) => {
    await seed(page, [imgSource(FIX_BW_SQUARE), greenTarget({ sourcePartId: 'img', mode: 'alpha', inverted: true, gradient: { type: 'radial', stops: STOPS2 } })]);
    expect(await page.evaluate(() => document.querySelector('mask[id^="kcs-mask-img-alpha-inv"]')?.getAttribute('mask-type'))).toBe('luminance');
    // FIX_BW_SQUARE 200×100 → world 200..400 × 165..315; white half x 200..300
    const whiteImg = await greenAt(page, 250, 240); // bright image area stays visible (7A)
    const blackImg = await greenAt(page, 350, 240); // dark image area → hole
    await expect.poll(async () => greenAt(page, 250, 240)).toBeGreaterThan(150);
    expect(blackImg).toBeLessThan(45);
  });

  test('V-M15 — image + INVERTED + LINEAR: same luminance + gradient structure', async ({ page }) => {
    await seed(page, [imgSource(FIX_BW_SQUARE), greenTarget({ sourcePartId: 'img', mode: 'alpha', inverted: true, gradient: { angle: 0, stops: STOPS2 } })]);
    expect(await page.evaluate(() => document.querySelector('mask[id^="kcs-mask-img-alpha-inv"]')?.getAttribute('mask-type'))).toBe('luminance');
    const whiteImg = await greenAt(page, 250, 240);
    const blackImg = await greenAt(page, 350, 240);
    await expect.poll(async () => greenAt(page, 250, 240)).toBeGreaterThan(150);
    expect(blackImg).toBeLessThan(45);
  });

  test('V-M16 — image + RADIAL + FEATHER + STRENGTH combo: all contracts together', async ({ page }) => {
    await seed(page, [imgSource(FIX_BLACK), greenTarget({ sourcePartId: 'img', mode: 'alpha', feather: 12, strength: 0.5, gradient: { type: 'radial', stops: STOPS2 } })]);
    const dom = await page.evaluate(() => ({
      blur: document.querySelector('filter feGaussianBlur')?.getAttribute('stdDeviation'),
      contentOpacity: document.querySelector('mask[id="kcs-mask-img-img"] image')?.getAttribute('opacity'),
      radial: !!document.querySelector('radialGradient'),
    }));
    expect(dom.blur).toBe('6');
    expect(dom.contentOpacity).toBe('0.5');
    expect(dom.radial).toBe(true);
    const center = await greenAt(page, 300, 240); // 255 × 0.5 → ~127
    expect(center).toBeGreaterThan(90); expect(center).toBeLessThan(170);
  });

  test('V-M17 — two targets, same image source → ONE content mask + ONE final mask (dedupe)', async ({ page }) => {
    const matte = { sourcePartId: 'img', mode: 'alpha', gradient: { angle: 0, stops: STOPS2 } };
    await seed(page, [imgSource(FIX_BLACK), greenTarget(matte), makeLayer('tgt2', 'T2', 'custom_circle', { zIndex: 3, fillColor: '#00ff00', scaleX: 5, scaleY: 5, matte })]);
    const counts = await page.evaluate(() => ({
      contentMasks: document.querySelectorAll('mask[id="kcs-mask-img-img"]').length,
      finalMasks: document.querySelectorAll('mask[id^="kcs-mask-img-alpha-g0-"]').length,
      maskRefs: document.querySelectorAll('[mask*="kcs-mask-img-alpha-g0-"]').length,
    }));
    expect(counts.contentMasks).toBe(1);
    expect(counts.finalMasks).toBe(1);
    expect(counts.maskRefs).toBe(2); // two targets reference the shared mask
  });

  test('V-M18 — different image sources → no accidental collision', async ({ page }) => {
    await seed(page, [
      imgSource(FIX_BLACK),
      makeLayer('img2', 'Image2', 'custom_image', { zIndex: 1, imageUrl: FIX_HALF_BW, width: 200, height: 150 }),
      greenTarget({ sourcePartId: 'img', mode: 'alpha' }),
      makeLayer('tgt2', 'T2', 'custom_circle', { zIndex: 3, fillColor: '#00ff00', scaleX: 5, scaleY: 5, matte: { sourcePartId: 'img2', mode: 'alpha' } }),
    ]);
    const ids = await page.evaluate(() => [...document.querySelectorAll('mask')].map((m) => m.id).filter((id) => id.includes('-alpha')));
    expect(ids).toContain('kcs-mask-img-alpha');
    expect(ids).toContain('kcs-mask-img2-alpha');
    expect(ids.length).toBe(2); // separate defs, no reuse
  });

  test('V-M19 — shape + text + image mattes coexist in one scene', async ({ page }) => {
    await seed(page, [
      imgSource(FIX_BLACK),
      makeLayer('txt', 'Text', 'custom_text', { zIndex: 1, textValue: 'HHH', fontSize: 80, fontFamily: 'Arial' }),
      makeLayer('shp', 'Star', 'custom_star', { zIndex: 1, fillColor: '#ffffff' }),
      greenTarget({ sourcePartId: 'img', mode: 'alpha' }),
      makeLayer('tgt2', 'T2', 'custom_circle', { zIndex: 3, fillColor: '#00ff00', scaleX: 5, scaleY: 5, matte: { sourcePartId: 'txt', mode: 'alpha' } }),
      makeLayer('tgt3', 'T3', 'custom_circle', { zIndex: 4, fillColor: '#00ff00', scaleX: 5, scaleY: 5, matte: { sourcePartId: 'shp', mode: 'alpha' } }),
    ]);
    await page.evaluate(async () => { await (document as any).fonts.ready; });
    const dom = await page.evaluate(() => ({
      imageMask: !!document.querySelector('mask[id="kcs-mask-img-alpha"] image'),
      textMask: !!document.querySelector('mask[id="kcs-mask-txt-alpha"] text'),
      shapeMask: !!document.querySelector('mask[id="kcs-mask-shp-alpha"] path'),
    }));
    expect(dom.imageMask).toBe(true);
    expect(dom.textMask).toBe(true);
    expect(dom.shapeMask).toBe(true);
  });

  test('V-M20 — REAL USER FLOW: Inspector source switch image→shape preserves matte settings', async ({ page }) => {
    // scene: image source + shape source + a target with a fully-configured
    // image matte (radial + stops + strength + inverted) — the user switches
    // the MATTE SOURCE select in the Inspector to the shape part
    await seed(page, [
      imgSource(FIX_BLACK),
      makeLayer('shp', 'Star', 'custom_star', { zIndex: 1, fillColor: '#ffffff' }),
      greenTarget({ sourcePartId: 'img', mode: 'alpha', inverted: true, strength: 0.5, gradient: { type: 'radial', stops: STOPS2 } }),
    ]);
    // select the target part: click INSIDE the matted <g> but away from its
    // center — the edit-mode cyan center marker sits exactly at (300,240)
    // world and would swallow the click
    const pt = await page.evaluate(() => {
      const g = document.querySelector('g[mask*="kcs-mask-img-alpha-inv"]');
      if (!g) return null;
      const r = g.getBoundingClientRect();
      return { x: r.x + r.width * 0.35, y: r.y + r.height * 0.5 };
    });
    expect(pt).not.toBeNull();
    await page.mouse.click(pt!.x, pt!.y);
    await page.waitForTimeout(600);
    // ensure the Inspector shows the STYLE tab (TRACK MATTE lives there)
    const styleTab = page.locator('button', { hasText: /^Style$/ }).first();
    if (await styleTab.count()) {
      await styleTab.click();
      await page.waitForTimeout(400);
    }
    // Inspector opens on the target — switch the matte source select to the shape
    const sourceSelect = page.locator('select.select-control:has(option[value="img"])');
    await sourceSelect.waitFor({ state: 'visible', timeout: 10000 });
    await sourceSelect.selectOption('shp');
    await page.waitForTimeout(400);
    // the matte settings must survive: only sourcePartId changed → the shape
    // mask keeps radial + strength + inverted (DOM identity proves it)
    const dom = await page.evaluate(() => {
      const mask = document.querySelector('mask[id^="kcs-mask-shp-alpha"]');
      return {
        hasShapeMask: !!mask,
        radial: !!document.querySelector('radialGradient'),
        strengthSuffix: mask?.id.includes('-s0.5'),
        invSuffix: mask?.id.includes('-inv'),
      };
    });
    expect(dom.hasShapeMask).toBe(true); // source switched
    expect(dom.radial).toBe(true); // radial gradient preserved across the switch
    expect(dom.strengthSuffix).toBe(true); // strength preserved
    expect(dom.invSuffix).toBe(true); // inverted preserved
  });

  test('V-M21 — image + clip: NO clipPath, renderer safe', async ({ page }) => {
    // NOTE: clip mode produces NO mask def — the kcs- wait in seed() is
    // skipped for this scene (no matte defs exist by design)
    const scene = {
      version: 1,
      layers: [imgSource(FIX_BLACK), greenTarget({ sourcePartId: 'img', mode: 'clip' })],
      tracks: [], fps: 30, totalFrames: 90,
      projectResolution: { width: 1920, height: 1080 },
      _sceneTitle: 'M21 Image Matte E2E',
    };
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.addInitScript(
      ([key, data]: [string, string]) => { localStorage.setItem(key, data); },
      [STORAGE_KEY, JSON.stringify(scene)],
    );
    await page.goto('/');
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
    const dom = await page.evaluate(() => ({
      matteClipPaths: document.querySelectorAll('clipPath[id^="kcs-clip"]').length,
      matteClipRefs: document.querySelectorAll('[clip-path*="kcs-clip"]').length,
    }));
    expect(dom.matteClipPaths).toBe(0); // buildMatteClipPath(image) → null
    expect(dom.matteClipRefs).toBe(0); // nothing references a matte clipPath
  });

  test('V-M22 — animated translation + RADIAL gradient: center follows the source, no stale mask', async ({ page }) => {
    const src = imgSource(FIX_BLACK);
    const tgt = greenTarget({ sourcePartId: 'img', mode: 'alpha', gradient: { type: 'radial', stops: STOPS2 } });
    const track = {
      id: 't_img', partId: 'img', name: 'T', color: '#f00', visible: true, keyframes: [],
      channels: {
        x: [{ id: 'x0', frame: 0, value: 0, easing: 'linear' }, { id: 'x30', frame: 30, value: 200, easing: 'linear' }],
        y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      },
    };
    await seed(page, [src, tgt], [track as any]);
    await page.waitForFunction(() => {
      try { return JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}').tracks?.length === 1; } catch { return false; }
    }, undefined, { timeout: 10000 });
    const r0 = await page.evaluate(() => document.querySelector('radialGradient')?.getAttribute('cx'));
    expect(r0).toBe('300');
    const step = page.locator('button[title="Step Forward"]');
    for (let i = 0; i < 35; i++) await step.click();
    await page.waitForTimeout(800);
    const r35 = await page.evaluate(() => document.querySelector('radialGradient')?.getAttribute('cx'));
    expect(r35).toBe('500'); // derived radial center follows the animated source
    // with a gradient the transform lives on the nested CONTENT mask (the
    // final mask wraps the gradient rect — 7A composition)
    const maskT = await page.evaluate(() => document.querySelector('mask[id="kcs-mask-img-img"] g')?.getAttribute('transform'));
    expect(maskT).toContain('translate(500, 240)'); // content follows too
  });

  test('V-M23 — animated rotation + scale + RADIAL: geometry follows (r × max|scale|)', async ({ page }) => {
    const src = imgSource(FIX_BLACK);
    const tgt = greenTarget({ sourcePartId: 'img', mode: 'alpha', gradient: { type: 'radial', stops: STOPS2 } });
    const track = {
      id: 't_img', partId: 'img', name: 'T', color: '#f00', visible: true, keyframes: [],
      channels: {
        x: [], y: [],
        rotation: [{ id: 'r0', frame: 0, value: 0, easing: 'linear' }, { id: 'r30', frame: 30, value: 45, easing: 'linear' }],
        scaleX: [{ id: 's0', frame: 0, value: 1, easing: 'linear' }, { id: 's30', frame: 30, value: 2, easing: 'linear' }],
        scaleY: [], opacity: [],
      },
    };
    await seed(page, [src, tgt], [track as any]);
    const r0 = await page.evaluate(() => document.querySelector('radialGradient')?.getAttribute('r'));
    expect(Number(r0)).toBeCloseTo(Math.sqrt(200 * 200 + 150 * 150) / 2, 1); // base radius
    const step = page.locator('button[title="Step Forward"]');
    for (let i = 0; i < 35; i++) await step.click();
    await page.waitForTimeout(800);
    const r35 = await page.evaluate(() => document.querySelector('radialGradient')?.getAttribute('r'));
    expect(Number(r35)).toBeCloseTo((Math.sqrt(200 * 200 + 150 * 150) / 2) * 2, 1); // × max|scale| 2
    // with a gradient the transform lives on the nested CONTENT mask
    const t35 = await page.evaluate(() => document.querySelector('mask[id="kcs-mask-img-img"] g')?.getAttribute('transform'));
    expect(t35).toContain('rotate(45) scale(2, 1)'); // content transform follows
  });

  test('V-M24 — import/reload exact visual parity', async ({ page }) => {
    const matte = { sourcePartId: 'img', mode: 'alpha', feather: 12, strength: 0.5, gradient: { type: 'radial', stops: STOPS2 } };
    await seed(page, [imgSource(FIX_BLACK), greenTarget(matte)]);
    const before = {
      maskId: await page.evaluate(() => document.querySelector('mask[id^="kcs-mask-img-alpha-radial"]')?.getAttribute('id')),
      gradId: await page.evaluate(() => document.querySelector('radialGradient')?.getAttribute('id')),
      cx: await page.evaluate(() => document.querySelector('radialGradient')?.getAttribute('cx')),
      center: await greenAt(page, 300, 240),
    };
    // let autosave persist, then reload through the real app path
    await page.waitForFunction(() => {
      try { return JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}').layers?.length === 2; } catch { return false; }
    }, undefined, { timeout: 10000 });
    await page.reload();
    await page.waitForSelector('radialGradient', { state: 'attached', timeout: 30000 });
    await page.waitForTimeout(1200); // fixture settle after reload
    const after = {
      maskId: await page.evaluate(() => document.querySelector('mask[id^="kcs-mask-img-alpha-radial"]')?.getAttribute('id')),
      gradId: await page.evaluate(() => document.querySelector('radialGradient')?.getAttribute('id')),
      cx: await page.evaluate(() => document.querySelector('radialGradient')?.getAttribute('cx')),
      center: await greenAt(page, 300, 240),
    };
    expect(after.maskId).toBe(before.maskId); // identical deterministic identity
    expect(after.gradId).toBe(before.gradId);
    expect(after.cx).toBe(before.cx);
    expect(Math.abs(after.center - before.center)).toBeLessThanOrEqual(10); // exact pixel parity (±AA)
  });

  test('V-M25 — legacy LINEAR gradient regression (image + {angle} only)', async ({ page }) => {
    await seed(page, [imgSource(FIX_WIDE_BLACK, { width: 400 }), greenTarget({ sourcePartId: 'img', mode: 'alpha', gradient: { angle: 0 } })]);
    // legacy form → no stops, legacy-style linear id on the final mask
    const dom = await page.evaluate(() => ({
      linear: !!document.querySelector('linearGradient'),
      stops: document.querySelectorAll('linearGradient stop').length,
      hasType: document.querySelector('linearGradient')?.getAttribute('type'),
    }));
    expect(dom.linear).toBe(true);
    expect(dom.stops).toBe(2); // normalized mode defaults at render (data stays legacy)
    expect(dom.hasType).toBeNull();
    const near = await greenAt(page, 250, 240);
    const far = await greenAt(page, 470, 240);
    expect(near).toBeGreaterThan(140);
    expect(far).toBeLessThan(45);
  });

  test('V-M26 — legacy TEXT matte regression (M18 pattern unchanged)', async ({ page }) => {
    const txt = makeLayer('txt', 'Text', 'custom_text', { zIndex: 1, textValue: 'HHH', fontSize: 80, fontFamily: 'Arial', fillColor: '#ffffff' });
    await seed(page, [txt, greenTarget({ sourcePartId: 'txt', mode: 'alpha' })]);
    await page.evaluate(async () => { await (document as any).fonts.ready; });
    const dom = await page.evaluate(() => ({
      textInMask: !!document.querySelector('mask[id="kcs-mask-txt-alpha"] text'),
      hasImage: !!document.querySelector('mask[id="kcs-mask-txt-alpha"] image'),
    }));
    expect(dom.textInMask).toBe(true);
    expect(dom.hasImage).toBe(false); // text masks never carry images
  });
});
