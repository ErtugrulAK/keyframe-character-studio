import { test, expect, type Page } from '@playwright/test';
import zlib from 'zlib';

/**
 * M13 Step 2E — Track matte REAL-BROWSER validation (Chromium).
 *
 * Seeds the scene into localStorage (AUTOSAVE key) so the app boots with the
 * desired matte state, then verifies the actual SVG DOM: clipPath/mask defs,
 * mask-type/units, target clip/mask attributes, explicit inverted region,
 * source-opacity independence, and playback-driven geometry updates.
 *
 * Screenshots are saved to test-results/matte-*.png as visual evidence
 * (compositing is analyzed separately — see the step report).
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

interface MatteDom {
  clips: { id: string; d: string | null }[];
  masks: {
    id: string; type: string | null; units: string | null;
    children: { tag: string; fill: string | null; d: string | null; x: string | null; y: string | null; width: string | null; height: string | null }[];
  }[];
  layers: { clip: string | null; mask: string | null; style: string | null }[];
}

// ─── Minimal PNG decoder (RGBA 8-bit) — real pixel assertions ──────────

function decodePng(buf: Buffer): { width: number; height: number; data: Buffer; bpp: number } {
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat: Buffer[] = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    offset += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`Unsupported PNG format: depth=${bitDepth} colorType=${colorType}`);
  }
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
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`Unknown PNG filter ${filter}`);
      }
      cur[x] = v & 0xff;
    }
    prevLine.set(cur);
    pos += stride;
  }
  return { width, height, data: out, bpp };
}

type ColorClass = 'green' | 'red' | 'dark' | 'other';

function classify(r: number, g: number, b: number): ColorClass {
  if (g > 110 && g > r + 50 && g > b + 50) return 'green';   // target #00ff00
  if (r > 110 && r > g + 50 && r > b + 50) return 'red';     // source #ff0000
  if (r < 70 && g < 70 && b < 95) return 'dark';             // background
  return 'other';
}

/** World → screen pixel via the real SVG CTM, then read the pixel color
 *  from a fresh screenshot (decodePng). This asserts ACTUAL browser
 *  compositing — not just DOM structure. */
async function pixelAt(page: Page, worldX: number, worldY: number): Promise<ColorClass> {
  const buf = await page.screenshot();
  const png = decodePng(buf);
  const { x, y } = await page.evaluate(([wx, wy]: [number, number]) => {
    // The FIRST <svg> in the DOM may be a lucide icon — pick the editor stage:
    // it is the only <svg> containing the artboard-clip def (no viewBox attr).
    const svg = [...document.querySelectorAll('svg')].find(
      (s) => !!s.querySelector('#artboard-clip')
    ) ?? document.querySelector('svg')!;
    const pt = svg.createSVGPoint();
    pt.x = wx; pt.y = wy;
    const s = pt.matrixTransform(svg.getScreenCTM()!);
    return { x: Math.round(s.x), y: Math.round(s.y) };
  }, [worldX, worldY]);
  const i = (y * png.width + x) * png.bpp;
  return classify(png.data[i], png.data[i + 1], png.data[i + 2]);
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
    _sceneTitle: 'Matte E2E',
  };
  // Boot the page once (fresh context), clear any stale autosave, then seed via
  // init script so the restore effect loads OUR scene on the final navigation.
  // NOTE: init-script fns run in the BROWSER — closure variables are NOT
  // available there; pass everything as serialized arguments.
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    ([key, data]: [string, string]) => { localStorage.setItem(key, data); },
    [STORAGE_KEY, JSON.stringify(scene)],
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  // Wait for the matte defs to actually exist — this only happens AFTER the
  // initial localStorage restore effect has run and re-rendered the scene.
  // waitForFunction (not waitForSelector): the latter had trouble resolving
  // the SVG-namespace attribute selector reliably.
  await page.waitForFunction(
    () => document.querySelectorAll('[id^="kcs-"]').length > 0,
    undefined,
    { timeout: 15000 },
  );
}

async function matteDom(page: Page): Promise<MatteDom> {
  return page.evaluate(() => {
    // There are TWO <defs> elements: StageCanvas's (artboard-clip, patterns,
    // filters) and StagePartLayers's (matte clips/masks). Scan them all.
    const defsList = [...document.querySelectorAll('defs')];
    // Filter out the editor's own artboard-clip — only matte defs matter here.
    const clips = defsList.flatMap((d) =>
      [...d.querySelectorAll('clipPath')]
        .filter((c) => c.id !== 'artboard-clip')
        .map((c) => ({ id: c.id, d: c.querySelector('path')?.getAttribute('d') ?? null }))
    );
    const masks = defsList.flatMap((d) =>
      [...d.querySelectorAll('mask')].map((m) => ({
        id: m.id,
        type: m.getAttribute('mask-type'),
        units: m.getAttribute('maskUnits'),
        children: [...m.children].map((ch) => ({
          tag: ch.tagName,
          fill: ch.getAttribute('fill'),
          d: ch.getAttribute('d'),
          x: ch.getAttribute('x'),
          y: ch.getAttribute('y'),
          width: ch.getAttribute('width'),
          height: ch.getAttribute('height'),
        })),
      }))
    );
    const layers = [...document.querySelectorAll('g[transform^="translate"]')].map((g) => {
      // Step 2E: matte clip/mask live on the TRANSFORM-LESS outer <g>
      // (parent of the transformed inner <g>).
      const outer = g.parentElement;
      return {
        clip: outer?.getAttribute('clip-path') ?? null,
        mask: outer?.getAttribute('mask') ?? null,
        style: g.getAttribute('style'),
      };
    });
    return { clips, masks, layers };
  });
}

test.describe('M13 track matte — real browser', () => {
  // No beforeEach: seed() handles boot + clear + init-script + navigation.
  // (A goto-then-clear in beforeEach broke the localStorage restore — the app
  //  re-writes autosave while the first page stays mounted.)

  test('T1 — clip regression: mode=clip keeps the M11 clipPath pipeline', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1 });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, matte: { sourcePartId: 'src', mode: 'clip' } });
    await seed(page, [source, target]);

    const dom = await matteDom(page);
    const clip = dom.clips.find((c) => c.id === 'kcs-clip-src');
    expect(clip).toBeTruthy();
    expect(clip!.d).toBeTruthy();
    expect(dom.masks).toHaveLength(0);
    const targetLayer = dom.layers.find((l) => l.clip === 'url(#kcs-clip-src)');
    expect(targetLayer).toBeTruthy();
    expect(targetLayer!.mask).toBeNull();
    await page.screenshot({ path: 'test-results/matte-t1-clip.png', fullPage: false });
  });

  test('T2 — alpha matte: <mask mask-type=alpha> + white path, no clipPath', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1 });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, matte: { sourcePartId: 'src', mode: 'alpha' } });
    await seed(page, [source, target]);

    const dom = await matteDom(page);
    const mask = dom.masks.find((m) => m.id === 'kcs-mask-src-alpha');
    expect(mask).toBeTruthy();
    expect(mask!.type).toBe('alpha');
    expect(mask!.units).toBe('userSpaceOnUse');
    expect(mask!.children).toHaveLength(1);
    expect(mask!.children[0].tag.toLowerCase()).toBe('path');
    expect(mask!.children[0].fill).toBe('white');
    expect(mask!.children[0].d).toBeTruthy();
    const targetLayer = dom.layers.find((l) => l.mask === 'url(#kcs-mask-src-alpha)');
    expect(targetLayer).toBeTruthy();
    expect(targetLayer!.clip).toBeNull();
    expect(dom.clips).toHaveLength(0);
    await page.screenshot({ path: 'test-results/matte-t2-alpha.png', fullPage: false });
  });

  test('T3 — luminance matte: mask-type=luminance, path fill = source fillColor', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, matte: { sourcePartId: 'src', mode: 'luminance' } });
    await seed(page, [source, target]);

    const dom = await matteDom(page);
    const mask = dom.masks.find((m) => m.id === 'kcs-mask-src-luminance');
    expect(mask).toBeTruthy();
    expect(mask!.type).toBe('luminance');
    expect(mask!.units).toBe('userSpaceOnUse');
    expect(mask!.children[0].fill).toBe('#ff0000'); // evaluated source fillColor
    expect(mask!.children[0].d).toBeTruthy();
    expect(dom.layers.some((l) => l.mask === 'url(#kcs-mask-src-luminance)')).toBe(true);
    await page.screenshot({ path: 'test-results/matte-t3-luminance.png', fullPage: false });
  });

  test('T4/T6 — inverted luminance: explicit region + white bg + black geometry', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1 });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, matte: { sourcePartId: 'src', mode: 'luminance', inverted: true } });
    await seed(page, [source, target]);

    const dom = await matteDom(page);
    const mask = dom.masks.find((m) => m.id === 'kcs-mask-src-luminance-inv');
    expect(mask).toBeTruthy();
    expect(mask!.type).toBe('luminance');
    expect(mask!.units).toBe('userSpaceOnUse');
    // Explicit artboard region: CANVAS_CENTER(300,240) ± 1920×1080/2 → (-660,-300)
    const rect = mask!.children.find((ch) => ch.tag.toLowerCase() === 'rect');
    expect(rect).toBeTruthy();
    expect(rect!.x).toBe('-660');
    expect(rect!.y).toBe('-300');
    expect(rect!.width).toBe('1920');
    expect(rect!.height).toBe('1080');
    expect(rect!.fill).toBe('white');
    const path = mask!.children.find((ch) => ch.tag.toLowerCase() === 'path');
    expect(path!.fill).toBe('black');
    expect(path!.d).toBeTruthy();
    const targetLayer = dom.layers.find((l) => l.mask === 'url(#kcs-mask-src-luminance-inv)');
    expect(targetLayer).toBeTruthy();
    expect(targetLayer!.clip).toBeNull();
    await page.screenshot({ path: 'test-results/matte-t4-luminance-inverted.png', fullPage: false });
  });

  test('T5 — alpha + inverted: SINGLE evenodd path (region contour + geometry) punches the real hole', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', matte: { sourcePartId: 'src', mode: 'alpha', inverted: true } });
    await seed(page, [source, target]);

    const dom = await matteDom(page);
    const mask = dom.masks.find((m) => m.id === 'kcs-mask-src-alpha-inv');
    expect(mask).toBeTruthy();
    expect(mask!.type).toBe('alpha');
    expect(mask!.units).toBe('userSpaceOnUse');
    // H fix: exactly ONE evenodd path = region contour + matte contour
    // (Chromium alpha masks ignore a second element — pixel-verified).
    expect(mask!.children).toHaveLength(1);
    const path = mask!.children[0];
    expect(path.tag.toLowerCase()).toBe('path');
    expect(path.fill).toBe('white');
    expect(path.d).toContain('M -660 -300 H 1260 V 780 H -660 Z'); // region contour
    const targetLayer = dom.layers.find((l) => l.mask === 'url(#kcs-mask-src-alpha-inv)');
    expect(targetLayer).toBeTruthy();
    expect(targetLayer!.clip).toBeNull();
    // Screenshot evidence for real compositing (pixel analysis in step report)
    await page.screenshot({ path: 'test-results/matte-t5-alpha-inverted.png', fullPage: false });
  });

  test('T7 — source opacity independence: alpha mask stays white when source opacity = 0.2', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, opacity: 0.2 });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, matte: { sourcePartId: 'src', mode: 'alpha' } });
    await seed(page, [source, target]);

    const dom = await matteDom(page);
    const mask = dom.masks.find((m) => m.id === 'kcs-mask-src-alpha');
    expect(mask).toBeTruthy();
    expect(mask!.children[0].fill).toBe('white'); // NOT weakened by source opacity
    // The source itself renders at opacity 0.2 (its own visual, independent of matte strength)
    const sourceLayer = dom.layers.find((l) => l.mask === null && l.clip === null && l.style?.includes('opacity: 0.2'));
    expect(sourceLayer).toBeTruthy();
    await page.screenshot({ path: 'test-results/matte-t7-source-opacity.png', fullPage: false });
  });

  test('T8 — animated source: playback updates the mask pathD (id stays stable)', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1 });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, matte: { sourcePartId: 'src', mode: 'alpha' } });
    const tracks = [
      {
        id: 't_src', partId: 'src', name: 'Source',
        channels: {
          x: [
            { id: 'k1', frame: 0, value: 0, easing: 'linear' },
            { id: 'k2', frame: 60, value: 200, easing: 'linear' },
          ],
        },
      },
    ];
    await seed(page, [source, target], tracks);

    const d0 = (await matteDom(page)).masks.find((m) => m.id === 'kcs-mask-src-alpha')!.children[0].d;
    // Drive playback through the EXISTING rAF pipeline (no new loop)
    await page.getByTitle('Play', { exact: true }).click();
    await page.waitForTimeout(1500);
    await page.getByTitle('Pause', { exact: true }).click();
    const after = await matteDom(page);
    const mask = after.masks.find((m) => m.id === 'kcs-mask-src-alpha');
    expect(mask).toBeTruthy(); // id stable across frames
    expect(mask!.children[0].d).not.toBe(d0); // world geometry followed the animated transform
    await page.screenshot({ path: 'test-results/matte-t8-animated.png', fullPage: false });
  });
});

test.describe('M13 track matte — real browser COMPOSITING (pixel assertions)', () => {
  // Layout: source box 60×60 at world center (270–330), target circle scaled
  // 2× (r=60, 240–360) — box inside the circle, so:
  //   (310,240) = inside box           (350,240) = ring (box-outside, circle-inside)
  // After the Step 2E coordinate-space fix, world-space matte paths must clip
  // the transformed target correctly in the browser.

  test('V-A — clip + target transform (scale 2)', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'clip' } });
    await seed(page, [source, target]);
    expect(await pixelAt(page, 310, 240)).toBe('green'); // box region shows target
    expect(await pixelAt(page, 350, 240)).toBe('dark');  // ring clipped away
  });

  test('V-B — alpha + target transform (scale 2)', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha' } });
    await seed(page, [source, target]);
    expect(await pixelAt(page, 310, 240)).toBe('green');
    expect(await pixelAt(page, 350, 240)).toBe('dark');
  });

  test('V-C — luminance + target transform (scale 2, white source = full strength)', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ffffff' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'luminance' } });
    await seed(page, [source, target]);
    expect(await pixelAt(page, 310, 240)).toBe('green'); // luminance 255 → target fully visible in box
    expect(await pixelAt(page, 350, 240)).toBe('dark');
  });

  test('V-D — inverted luminance + target transform', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'luminance', inverted: true } });
    await seed(page, [source, target]);
    expect(await pixelAt(page, 310, 240)).toBe('red');   // box region = hole → source shows
    expect(await pixelAt(page, 350, 240)).toBe('green'); // ring visible
  });

  test('V-E — alpha + inverted + target transform', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha', inverted: true } });
    await seed(page, [source, target]);
    expect(await pixelAt(page, 310, 240)).toBe('red');   // black path = 0-alpha hole → source shows
    expect(await pixelAt(page, 350, 240)).toBe('green');
  });

  test('V-F — luminance + inverted + target transform', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'luminance', inverted: true } });
    await seed(page, [source, target]);
    expect(await pixelAt(page, 310, 240)).toBe('red');
    expect(await pixelAt(page, 350, 240)).toBe('green');
  });

  test('V-G — animated source + target transform: mask follows the source', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha' } });
    const tracks = [
      {
        id: 't_src', partId: 'src', name: 'Source',
        channels: {
          x: [
            { id: 'k1', frame: 0, value: 0, easing: 'linear' },
            { id: 'k2', frame: 60, value: 120, easing: 'linear' },
          ],
        },
      },
    ];
    await seed(page, [source, target], tracks);

    // Frame 0: mask at center → box region shows the target
    expect(await pixelAt(page, 310, 240)).toBe('green');

    // Play through the EXISTING rAF pipeline — the mask must follow the
    // source away from the center (box leaves the circle → target hidden at
    // the old spot, source visible at its new position outside the circle).
    await page.getByTitle('Play', { exact: true }).click();
    await page.waitForTimeout(1800); // ~54 frames → source x ≈ 108 → box (378–438)
    await page.getByTitle('Pause', { exact: true }).click();

    expect(await pixelAt(page, 310, 240)).toBe('dark'); // old spot: no mask → hidden
    expect(await pixelAt(page, 400, 240)).toBe('red');  // source at new spot (outside circle)
  });
});

test.describe('M14 track matte — FEATHER (real browser pixel assertions)', () => {
  // Box edge at world x=270 (source box 270–330). Points 264/266/268 are
  // OUTSIDE the box (6/4/2 px). feather=0 → all dark (sharp). feather>0 →
  // gradual ramp (264 < 266 < 268, intermediate values).

  async function greenStrengthAt(page: Page, worldX: number, worldY: number): Promise<number> {
    const buf = await page.screenshot();
    const png = decodePng(buf);
    const { x, y } = await page.evaluate(([wx, wy]: [number, number]) => {
      const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
      const pt = svg.createSVGPoint(); pt.x = wx; pt.y = wy;
      const s = pt.matrixTransform(svg.getScreenCTM()!);
      return { x: Math.round(s.x), y: Math.round(s.y) };
    }, [worldX, worldY]);
    const i = (y * png.width + x) * png.bpp;
    return png.data[i + 1]; // green channel → target visibility strength
  }

  async function edgeProbe(page: Page): Promise<number[]> {
    return Promise.all([264, 266, 268, 310].map((x) => greenStrengthAt(page, x, 240)));
  }

  test('V-H — feather 0 = sharp edge, feather 12 = gradual ramp (same fixture)', async ({ page }) => {
    // feather 0: outside edge fully hidden (sharp)
    const s0 = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const t0 = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha', feather: 0 } });
    await seed(page, [s0, t0]);
    const sharp = await edgeProbe(page);
    expect(sharp[0]).toBeLessThan(45); // 264 outside → hidden
    expect(sharp[1]).toBeLessThan(45); // 266 outside → hidden
    expect(sharp[2]).toBeLessThan(45); // 268 outside → hidden
    expect(sharp[3]).toBeGreaterThan(200); // 310 inside → fully visible

    // feather 12: gradual ramp across the same points
    const s1 = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const t1 = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha', feather: 12 } });
    await seed(page, [s1, t1]);
    const soft = await edgeProbe(page);
    // Monotonic ramp: 264 < 266 < 268 (approaching the edge)
    expect(soft[0]).toBeGreaterThan(45);          // already partially visible 6px out
    expect(soft[0]).toBeLessThan(soft[1]);
    expect(soft[1]).toBeLessThan(soft[2]);
    expect(soft[2]).toBeGreaterThan(soft[0] + 30); // meaningful gradient
    expect(soft[3]).toBeGreaterThan(200);          // inside still fully visible
  });

  test('V-I — feather stays world-aligned with a ROTATED target', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, rotation: 45, matte: { sourcePartId: 'src', mode: 'alpha', feather: 12 } });
    await seed(page, [source, target]);

    const soft = await edgeProbe(page);
    expect(soft[0]).toBeGreaterThan(45);
    expect(soft[0]).toBeLessThan(soft[1]);
    expect(soft[1]).toBeLessThan(soft[2]);
    expect(soft[3]).toBeGreaterThan(200);
  });

  test('V-J — animated feathered source: mask geometry follows, filter stays stable', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha', feather: 12 } });
    const tracks = [
      {
        id: 't_src', partId: 'src', name: 'Source',
        channels: {
          x: [
            { id: 'k1', frame: 0, value: 0, easing: 'linear' },
            { id: 'k2', frame: 60, value: 120, easing: 'linear' },
          ],
        },
      },
    ];
    await seed(page, [source, target], tracks);

    const d0 = await page.evaluate(() => {
      const m = document.querySelector('mask[id="kcs-mask-src-alpha-f12"] path');
      return m?.getAttribute('d');
    });
    expect(d0).toBeTruthy();
    expect(await page.evaluate(() => document.querySelectorAll('filter[id^="kcs-matte-feather-"]').length)).toBe(1);

    await page.getByTitle('Play', { exact: true }).click();
    await page.waitForTimeout(1800);
    await page.getByTitle('Pause', { exact: true }).click();

    const d1 = await page.evaluate(() => {
      const m = document.querySelector('mask[id="kcs-mask-src-alpha-f12"] path');
      return m?.getAttribute('d');
    });
    expect(d1).not.toBe(d0); // geometry followed the animated source
    expect(await page.evaluate(() => document.querySelectorAll('filter[id^="kcs-matte-feather-"]').length)).toBe(1); // filter stable
  });

  test('V-K — INVERTED alpha + feather: evenodd hole stays a real hole with a soft transition', async ({ page }) => {
    // Source box 270–330. Inverted alpha: OUTSIDE the box visible, INSIDE hidden.
    // Feather 12 → a gradual ramp at the boundary instead of a hard edge.
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha', inverted: true, feather: 12 } });
    await seed(page, [source, target]);

    const inv = await Promise.all([254, 260, 264, 268, 300].map((x) => greenStrengthAt(page, x, 240)));
    expect(inv[0]).toBeGreaterThan(200); // 16px outside box → target fully visible
    expect(inv[1]).toBeGreaterThan(45);  // 10px out → ramp region
    expect(inv[1]).toBeLessThan(inv[0]); // less visible approaching the hole
    expect(inv[1]).toBeGreaterThan(inv[2]); // monotonic decrease
    expect(inv[2]).toBeGreaterThan(inv[3]);
    expect(inv[4]).toBeLessThan(45);     // inside the box → genuinely hidden (real hole)

    // DOM: the feathered evenodd single-path structure (region contour + geometry)
    // NOTE: <mask> lives inside <defs> — never "visible" to Playwright; assert
    // existence + structure via evaluate.
    const maskDom = await page.evaluate(() => {
      const m = document.querySelector('mask[id="kcs-mask-src-alpha-inv-f12"]');
      const p = m?.querySelector('path');
      return { exists: !!m, evenodd: p?.getAttribute('fill-rule') ?? null, hasFilter: !!p?.getAttribute('filter') };
    });
    expect(maskDom.exists).toBe(true);
    expect(maskDom.evenodd).toBe('evenodd');
    expect(maskDom.hasFilter).toBe(true);
  });

  test('V-L — luminance + feather: white source = full-strength soft edge (source hidden)', async ({ page }) => {
    // Luminance uses the source FILL color: white → full strength. The source
    // itself is hidden (opacity 0) so its own pixels cannot pollute the probe.
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ffffff', opacity: 0 });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'luminance', feather: 12 } });
    await seed(page, [source, target]);

    const soft = await edgeProbe(page); // [264, 266, 268, 310] at y=240
    expect(soft[0]).toBeGreaterThan(45);      // ramp begins 6px outside the edge
    expect(soft[0]).toBeLessThan(200);        // partial, not full
    expect(soft[0]).toBeLessThan(soft[1]);    // monotonic increase toward the edge
    expect(soft[1]).toBeLessThan(soft[2]);
    expect(soft[2]).toBeLessThan(soft[3]);
    expect(soft[3]).toBeGreaterThan(200);     // inside → full strength (white luminance)

    // mask-type must be explicit luminance (never the browser default)
    const mt = await page.evaluate(() => document.querySelector('mask[id="kcs-mask-src-luminance-f12"]')?.getAttribute('mask-type'));
    expect(mt).toBe('luminance');
  });
});

test.describe('M15 freeform matte — real browser pixel assertions', () => {
  // Freeform triangle (CENTER-RELATIVE local points — same source the
  // renderer draws via buildFreeformPath): (0,0),(60,0),(0,30) at world
  // (300,240) → spans (300,240)-(360,240)-(300,270). At y=255 the interior
  // is x ∈ (300, 330).
  const TRI = [
    { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 },
  ];
  const freeformSource = (overrides: Record<string, unknown> = {}) =>
    makeLayer('src', 'Source', 'custom_freeform', { zIndex: 1, fillColor: '#ff0000', points: TRI, ...overrides });
  const greenTarget = (matte: Record<string, unknown>) =>
    makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte });

  /** Raw green channel at a world point (for feather ramp monotonicity —
   *  classify() would collapse partial visibility into 'green'). */
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

  test('V-M1 — freeform triangle → clip matte: target visible ONLY inside the polygon', async ({ page }) => {
    await seed(page, [freeformSource(), greenTarget({ sourcePartId: 'src', mode: 'clip' })]);

    // DOM: clipPath def carries the freeform world path
    const clipD = await page.evaluate(() => document.querySelector('clipPath[id="kcs-clip-src"] path')?.getAttribute('d'));
    expect(clipD).toBe('M 300 240 L 360 240 L 300 270 Z');
    expect(await page.evaluate(() => document.querySelectorAll('clipPath[id="kcs-clip-src"]').length)).toBe(1); // dedupe

    // PIXEL: inside triangle → green; outside triangle (inside target) → hidden
    expect(await pixelAt(page, 320, 255)).toBe('green');
    expect(await pixelAt(page, 340, 255)).toBe('dark');
  });

  test('V-M2 — freeform polygon → alpha matte: mask follows the polygon', async ({ page }) => {
    await seed(page, [freeformSource(), greenTarget({ sourcePartId: 'src', mode: 'alpha' })]);

    const m = await page.evaluate(() => {
      const mask = document.querySelector('mask[id="kcs-mask-src-alpha"]');
      return { type: mask?.getAttribute('mask-type'), d: mask?.querySelector('path')?.getAttribute('d') ?? null };
    });
    expect(m.type).toBe('alpha');
    expect(m.d).toBe('M 300 240 L 360 240 L 300 270 Z');

    expect(await pixelAt(page, 320, 255)).toBe('green');
    expect(await pixelAt(page, 340, 255)).toBe('dark');
  });

  test('V-M3 — freeform + inverted alpha: polygon interior hidden, outside visible', async ({ page }) => {
    await seed(page, [freeformSource(), greenTarget({ sourcePartId: 'src', mode: 'alpha', inverted: true })]);

    const maskDom = await page.evaluate(() => {
      const p = document.querySelector('mask[id="kcs-mask-src-alpha-inv"] path');
      return { rule: p?.getAttribute('fill-rule') ?? null, d: p?.getAttribute('d') ?? null };
    });
    expect(maskDom.rule).toBe('evenodd'); // M13 inverted-alpha structure preserved
    expect(maskDom.d).toContain('M 300 240 L 360 240 L 300 270 Z'); // freeform contour inside the region path

    expect(await pixelAt(page, 320, 255)).toBe('red');      // inside polygon → target masked out → source red
    expect(await pixelAt(page, 345, 250)).toBe('green');    // outside polygon (inside target) → visible
  });

  test('V-M4 — freeform + feather: soft ramp at the polygon edge (feGaussianBlur)', async ({ page }) => {
    await seed(page, [freeformSource(), greenTarget({ sourcePartId: 'src', mode: 'alpha', feather: 12 })]);

    // DOM: feathered mask + filter exist
    expect(await page.evaluate(() => !!document.querySelector('mask[id="kcs-mask-src-alpha-f12"]'))).toBe(true);
    expect(await page.evaluate(() => !!document.querySelector('filter[id="kcs-matte-feather-src-alpha-f12"] feGaussianBlur'))).toBe(true);

    // PIXEL: left edge x=300 (vertical) — probes 6/4/2px OUTSIDE + inside
    const a = await greenAt(page, 294, 255); // 6px outside
    const b = await greenAt(page, 296, 255); // 4px outside
    const c = await greenAt(page, 298, 255); // 2px outside
    const inside = await greenAt(page, 310, 255);
    expect(a).toBeGreaterThan(45);    // ramp already visible
    expect(a).toBeLessThan(200);      // not full
    expect(a).toBeLessThan(b);        // monotonic toward the edge
    expect(b).toBeLessThan(c);
    expect(inside).toBeGreaterThan(200);
  });

  test('V-M5 — rotated + scaled freeform source: matte follows the SOURCE transform', async ({ page }) => {
    // rotation 90 + scaleX 2 → vertices (300,240),(300,360),(270,240);
    // at y=255 interior x ∈ (273.75, 300)
    await seed(page, [
      freeformSource({ rotation: 90, scaleX: 2 }),
      greenTarget({ sourcePartId: 'src', mode: 'clip' }),
    ]);

    expect(await pixelAt(page, 285, 255)).toBe('green'); // inside rotated triangle
    expect(await pixelAt(page, 310, 255)).toBe('dark');  // outside → hidden
  });

  test('V-M6 — animated freeform source: matte path follows the animation (no stale cache)', async ({ page }) => {
    const tracks = [
      {
        id: 't_src', partId: 'src', name: 'Source',
        channels: {
          x: [
            { id: 'k1', frame: 0, value: 0, easing: 'linear' },
            { id: 'k2', frame: 60, value: 120, easing: 'linear' },
          ],
        },
      },
    ];
    await seed(page, [freeformSource(), greenTarget({ sourcePartId: 'src', mode: 'clip' })], tracks);

    const d0 = await page.evaluate(() => document.querySelector('clipPath[id="kcs-clip-src"] path')?.getAttribute('d'));
    expect(d0).toBe('M 300 240 L 360 240 L 300 270 Z');

    await page.getByTitle('Play', { exact: true }).click();
    await page.waitForTimeout(1800);
    await page.getByTitle('Pause', { exact: true }).click();

    const d1 = await page.evaluate(() => document.querySelector('clipPath[id="kcs-clip-src"] path')?.getAttribute('d'));
    expect(d1).not.toBe(d0);                    // geometry followed the animated source
    expect(d1).toMatch(/^M 4\d\d 240 L 4\d\d 240/); // moved right (x grew) — cache rebuilt from evaluated transform
    expect(await page.evaluate(() => document.querySelectorAll('clipPath[id="kcs-clip-src"]').length)).toBe(1); // still deduped
  });

  test('V-M7 — IMPORT → RENDER round-trip: freeform points + matte survive the app serialization, pixels identical', async ({ page }) => {
    await seed(page, [freeformSource(), greenTarget({ sourcePartId: 'src', mode: 'clip' })]);

    // Pixel BEFORE the round-trip
    expect(await pixelAt(page, 320, 255)).toBe('green');
    expect(await pixelAt(page, 340, 255)).toBe('dark');

    // The app's OWN autosave serializes the current scene back to localStorage —
    // wait for it, then verify freeform points + matte survived the export path.
    await page.waitForFunction(() => {
      try {
        const s = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}');
        const l = (s.layers ?? []).find((x: any) => x.id === 'src');
        return Array.isArray(l?.points) && l.points.length >= 3;
      } catch { return false; }
    }, undefined, { timeout: 10000 });
    const autosaved = await page.evaluate(() => JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5')!));
    expect(autosaved.layers.find((l: any) => l.id === 'src').points).toEqual([
      { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 },
    ]);
    expect(autosaved.layers.find((l: any) => l.id === 'tgt').matte).toEqual({ sourcePartId: 'src', mode: 'clip' });

    // IMPORT path: reload → the app restores the scene from the autosaved JSON
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[id^="kcs-"]').length > 0, undefined, { timeout: 15000 });

    // Pixel AFTER the round-trip — identical (serialization changed nothing)
    expect(await pixelAt(page, 320, 255)).toBe('green');
    expect(await pixelAt(page, 340, 255)).toBe('dark');
    // No duplicate defs after re-import
    expect(await page.evaluate(() => document.querySelectorAll('clipPath[id="kcs-clip-src"]').length)).toBe(1);
  });

  test('V-M8 — IMPORT → RENDER round-trip: alpha + feather survive, feathered ramp identical after reload', async ({ page }) => {
    await seed(page, [freeformSource(), greenTarget({ sourcePartId: 'src', mode: 'alpha', feather: 12 })]);

    const rampBefore = [
      await greenAt(page, 294, 255),
      await greenAt(page, 298, 255),
      await greenAt(page, 310, 255),
    ];

    await page.waitForFunction(() => {
      try {
        const s = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}');
        const l = (s.layers ?? []).find((x: any) => x.id === 'tgt');
        return l?.matte?.feather === 12;
      } catch { return false; }
    }, undefined, { timeout: 10000 });
    const autosaved = await page.evaluate(() => JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5')!));
    expect(autosaved.layers.find((l: any) => l.id === 'tgt').matte).toEqual({
      sourcePartId: 'src', mode: 'alpha', feather: 12,
    });
    expect(autosaved.layers.find((l: any) => l.id === 'src').points).toEqual([
      { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 },
    ]);

    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[id^="kcs-"]').length > 0, undefined, { timeout: 15000 });

    const rampAfter = [
      await greenAt(page, 294, 255),
      await greenAt(page, 298, 255),
      await greenAt(page, 310, 255),
    ];
    // Pixel parity: the feathered ramp is identical after the real import
    expect(rampAfter[0]).toBe(rampBefore[0]);
    expect(rampAfter[1]).toBe(rampBefore[1]);
    expect(rampAfter[2]).toBe(rampBefore[2]);
    expect(await page.evaluate(() => document.querySelectorAll('mask[id="kcs-mask-src-alpha-f12"]').length)).toBe(1);
  });
});

test.describe('M16 matte strength — real browser pixel assertions', () => {
  // Same freeform-triangle fixture as M15: polygon (300,240)-(360,240)-(300,270);
  // inside probe (320,255), outside (340,255), inverted-outside (345,250).
  const TRI = [
    { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 },
  ];
  const source = (overrides: Record<string, unknown> = {}) =>
    makeLayer('src', 'Source', 'custom_freeform', { zIndex: 1, fillColor: '#ff0000', points: TRI, ...overrides });
  const greenTarget = (matte: Record<string, unknown>) =>
    makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte });

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

  test('V-S1 — alpha strength=1: full matte (legacy pixel behavior)', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', strength: 1 })]);
    expect(await greenAt(page, 320, 255)).toBeGreaterThan(200); // inside fully visible
    expect(await greenAt(page, 340, 255)).toBeLessThan(45);     // outside hidden
  });

  test('V-S2 — alpha strength=0.5: pixel opacity ~half of full strength', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', strength: 0.5 })]);
    const inside = await greenAt(page, 320, 255);
    expect(inside).toBeGreaterThan(45);   // partially visible
    expect(inside).toBeLessThan(200);     // NOT full strength
    expect(inside).toBeGreaterThan(80);   // meaningful half-strength signal (≈128)
    expect(await greenAt(page, 340, 255)).toBeLessThan(45); // outside still hidden
  });

  test('V-S3 — alpha strength=0: matte content opacity 0 → target invisible inside', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', strength: 0 })]);
    expect(await greenAt(page, 320, 255)).toBeLessThan(45); // source red shows, no green
    expect(await greenAt(page, 340, 255)).toBeLessThan(45);
  });

  test('V-S4 — inverted alpha + strength=0.5: hole preserved, outside at half strength', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', inverted: true, strength: 0.5 })]);
    expect(await greenAt(page, 320, 255)).toBeLessThan(45);              // inside hole → target masked out
    const outside = await greenAt(page, 345, 250);                      // outside polygon, inside target
    expect(outside).toBeGreaterThan(45);
    expect(outside).toBeLessThan(200);                                  // half strength (≈128)
  });

  test('V-S5 — feather=12 + strength=0.5: ramp preserved, total strength halved', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', feather: 12, strength: 0.5 })]);
    const a = await greenAt(page, 294, 255);
    const b = await greenAt(page, 296, 255);
    const c = await greenAt(page, 298, 255);
    const inside = await greenAt(page, 310, 255);
    expect(a).toBeGreaterThan(20);        // ramp visible
    expect(a).toBeLessThan(b);            // monotonic (feather preserved)
    expect(b).toBeLessThan(c);
    expect(inside).toBeGreaterThan(45);   // half-strength inside
    expect(inside).toBeLessThan(200);     // NOT full
  });

  test('V-S6 — strength import/reload: alpha + feather 12 + strength 0.5 survive, DOM fill-opacity visible', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', feather: 12, strength: 0.5 })]);

    // App's own autosave (export path) carries the full matte
    await page.waitForFunction(() => {
      try {
        const s = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}');
        const l = (s.layers ?? []).find((x: any) => x.id === 'tgt');
        return l?.matte?.strength === 0.5 && l?.matte?.feather === 12;
      } catch { return false; }
    }, undefined, { timeout: 10000 });
    const autosaved = await page.evaluate(() => JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5')!));
    expect(autosaved.layers.find((l: any) => l.id === 'tgt').matte).toEqual({
      sourcePartId: 'src', mode: 'alpha', feather: 12, strength: 0.5,
    });

    // Reload → real import path
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[id^="kcs-"]').length > 0, undefined, { timeout: 15000 });
    expect(await page.evaluate(() => document.querySelectorAll('mask[id="kcs-mask-src-alpha-f12-s0.5"]').length)).toBe(1);
    expect(await page.evaluate(() =>
      document.querySelector('mask[id="kcs-mask-src-alpha-f12-s0.5"] path')?.getAttribute('fill-opacity'))).toBe('0.5');
  });

  test('V-S7 — pixel parity after reload: strength 0.5 + feather ramp identical pre/post import', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', feather: 12, strength: 0.5 })]);

    const before = [
      await greenAt(page, 294, 255),
      await greenAt(page, 298, 255),
      await greenAt(page, 310, 255),
    ];
    expect(before[2]).toBeGreaterThan(45); // half-strength signal present

    await page.waitForFunction(() => {
      try {
        const s = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}');
        return (s.layers ?? []).find((x: any) => x.id === 'tgt')?.matte?.strength === 0.5;
      } catch { return false; }
    }, undefined, { timeout: 10000 });
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[id^="kcs-"]').length > 0, undefined, { timeout: 15000 });

    const after = [
      await greenAt(page, 294, 255),
      await greenAt(page, 298, 255),
      await greenAt(page, 310, 255),
    ];
    expect(after[0]).toBe(before[0]); // exact pixel parity (same fixture, same viewport)
    expect(after[1]).toBe(before[1]);
    expect(after[2]).toBe(before[2]);
  });

  test('V-S8 — inverted alpha + strength 0.5 survives reload (evenodd + fill-opacity)', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', inverted: true, strength: 0.5 })]);
    await page.waitForFunction(() => {
      try {
        const s = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}');
        return (s.layers ?? []).find((x: any) => x.id === 'tgt')?.matte?.inverted === true;
      } catch { return false; }
    }, undefined, { timeout: 10000 });
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[id^="kcs-"]').length > 0, undefined, { timeout: 15000 });
    // evenodd hole + strength preserved after the real import
    expect(await page.evaluate(() =>
      document.querySelector('mask[id="kcs-mask-src-alpha-inv-s0.5"] path')?.getAttribute('fill-rule'))).toBe('evenodd');
    expect(await page.evaluate(() =>
      document.querySelector('mask[id="kcs-mask-src-alpha-inv-s0.5"] path')?.getAttribute('fill-opacity'))).toBe('0.5');
    expect(await greenAt(page, 320, 255)).toBeLessThan(45);  // hole preserved (pixel)
    const outside = await greenAt(page, 345, 250);
    expect(outside).toBeGreaterThan(45);                     // half-strength outside
    expect(outside).toBeLessThan(200);
  });
});
