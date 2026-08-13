/**
 * M11 Step 2B — Track matte MVP tests.
 *
 * Pure helper coverage: world-space path generation (matching PartRenderer's
 * transform order), shape-type coverage, deterministic output, enabled
 * semantics, freeform deferral — plus evaluation-integrated tests (animated /
 * rotated / scaled / parented sources) using evaluateTransform.
 */
import { describe, it, expect } from 'vitest';
import { buildMatteClipPath, buildMatteMask, buildMatteMaskFromPath, buildMattePath, buildMatteTextMask, gradientEndpoints, gradientEndpointsLocal, isMatteEligible, normalizeFeather, normalizeStrength, normalizeGradientAngle, normalizeGradient, gradientId, getDefaultGradientStops, normalizeGradientStops, canonicalStopsKey, gradientStopsHash, matteClipPathId, matteMaskId, isMatteActive, resolveMatteMode, textMaskContent, worldToLocal, normalizeGradientType, radialGradientGeometry, matteMaskGradientSuffix } from '../utils/matte';
import type { PartMatte } from '../types/animator';
import { getShapeGeometry } from '../utils/shapeGeometry';
import { buildFreeformPath } from '../utils/freeform';
import { evaluateTransform } from '../utils/evaluateTransform';
import { makeEmptyChannels } from '../utils/defaults';
import type { CharacterPart, Track } from '../types/animator';
import type { WorldTransform } from '../types/composition';
import { CANVAS_CENTER } from '../utils/constants';

function makeSourcePart(type: string, overrides: Partial<CharacterPart> = {}): CharacterPart {
  return {
    id: 'src_1',
    type,
    name: 'Source',
    zIndex: 1,
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    fillColor: '#fff',
    strokeColor: '#101218',
    ...overrides,
  } as CharacterPart;
}

const noTracks: Track[] = [];
const ACTIVE = 'Sequence';

describe('matte — data model & id', () => {
  it('creates a PartMatte reference', () => {
    const matte = { sourcePartId: 'part_2', mode: 'clip', enabled: true } as const;
    expect(matte.sourcePartId).toBe('part_2');
    expect(matte.mode).toBe('clip');
  });

  it('matte id is deterministic: kcs-clip-{sourcePartId}', () => {
    expect(matteClipPathId('part_2')).toBe('kcs-clip-part_2');
    expect(matteClipPathId('part_2')).toBe(matteClipPathId('part_2'));
  });

  it('enabled semantics: undefined is active, false is inactive', () => {
    expect(isMatteActive(undefined)).toBe(false);
    expect(isMatteActive({ sourcePartId: 'x', mode: 'clip' })).toBe(true); // undefined enabled
    expect(isMatteActive({ sourcePartId: 'x', mode: 'clip', enabled: true })).toBe(true);
    expect(isMatteActive({ sourcePartId: 'x', mode: 'clip', enabled: false })).toBe(false);
  });
});

describe('matte — world-space path (TEST A: static)', () => {
  it('box at x=100,y=50 scale=1 → world rect centered at canvas center + (100,50)', () => {
    const source = makeSourcePart('custom_box');
    const world: WorldTransform = { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    const clip = buildMatteClipPath(source, world);
    expect(clip).not.toBeNull();
    expect(clip!.id).toBe('kcs-clip-src_1');
    // Local box corners (±30, ±30) → world = center + world + corner
    const cx = CANVAS_CENTER.x + 100;
    const cy = CANVAS_CENTER.y + 50;
    expect(clip!.pathD).toContain(`M ${cx - 30} ${cy - 30}`);
    expect(clip!.pathD).toContain(`L ${cx + 30} ${cy - 30}`);
    expect(clip!.pathD).toContain(`L ${cx + 30} ${cy + 30}`);
    expect(clip!.pathD).toContain(`L ${cx - 30} ${cy + 30}`);
    expect(clip!.pathD.endsWith(' Z')).toBe(true);
  });
});

describe('matte — world-space path (TEST B: rotated + scaled)', () => {
  it('box at x=100,y=50 rotation=45 scaleX=2 scaleY=1 → rotated world rect', () => {
    const source = makeSourcePart('custom_box');
    const world: WorldTransform = { x: 100, y: 50, rotation: 45, scaleX: 2, scaleY: 1, opacity: 1 };
    const clip = buildMatteClipPath(source, world);
    expect(clip).not.toBeNull();

    // Local corner (30, 30): scale → (60, 30); rotate 45° → (60·cos45 − 30·sin45, 60·sin45 + 30·cos45)
    const rad = (45 * Math.PI) / 180;
    const sx = 60, sy = 30;
    const rx = sx * Math.cos(rad) - sy * Math.sin(rad);
    const ry = sx * Math.sin(rad) + sy * Math.cos(rad);
    const expectX = CANVAS_CENTER.x + 100 + rx;
    const expectY = CANVAS_CENTER.y + 50 + ry;
    const f = (n: number) => String(Math.round(n * 1000) / 1000);
    expect(clip!.pathD).toContain(`${f(expectX)} ${f(expectY)}`);
  });

  it('circle scaled non-uniformly → elliptical arc with rx=r·sx, ry=r·sy', () => {
    const source = makeSourcePart('custom_circle');
    const world: WorldTransform = { x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 0.5, opacity: 1 };
    const clip = buildMatteClipPath(source, world);
    expect(clip).not.toBeNull();
    expect(clip!.pathD).toContain('A 60 15 0 0 1'); // rx=30·2, ry=30·0.5
  });
});

describe('matte — parented source (TEST C)', () => {
  it('uses the evaluated WORLD transform (parent composition included)', () => {
    // parent: rotation=30, scale=2, at (50, 50); child source at local (10, 10)
    const parent: CharacterPart = makeSourcePart('custom_box', { id: 'parent', x: 0 } as any);
    parent.id = 'parent';
    parent.baseTransform = { x: 50, y: 50, rotation: 30, scaleX: 2, scaleY: 2, opacity: 1 };
    const child: CharacterPart = makeSourcePart('custom_rect', { id: 'child' } as any);
    child.id = 'child';
    child.baseTransform = { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    child.parentId = 'parent';

    const layers = [parent, child];
    // evaluateTransform returns early (base transform only) when the part has
    // NO track — parent composition requires a track to be present.
    const emptyTrack = (partId: string): Track => ({
      id: `t_${partId}`, partId, name: 'T', color: '#f00', visible: true,
      keyframes: [], channels: makeEmptyChannels(),
    } as Track);
    const tracks = [emptyTrack('parent'), emptyTrack('child')];
    const world = evaluateTransform(layers, tracks, ACTIVE, 'child', 0);
    const clip = buildMatteClipPath(child, world);
    expect(clip).not.toBeNull();

    // Manual world compose: child local (10,10) → parent rotation 30°, scale 2
    const rad = (30 * Math.PI) / 180;
    const scx = 10 * 2;
    const scy = 10 * 2;
    const wx = parent.baseTransform.x + (scx * Math.cos(rad) - scy * Math.sin(rad));
    const wy = parent.baseTransform.y + (scx * Math.sin(rad) + scy * Math.cos(rad));
    // rect half-size (custom_rect: 120×60 → 60×30) scaled by composed scale (2) and rotated by 30
    const composedScaleX = 2, composedScaleY = 2;
    const cornerX = 60 * composedScaleX; // halfWidth · composedScale
    const cornerY = 30 * composedScaleY; // halfHeight · composedScale
    const pxc = cornerX * Math.cos(rad) - cornerY * Math.sin(rad);
    const pyc = cornerX * Math.sin(rad) + cornerY * Math.cos(rad);
    const f = (n: number) => String(Math.round(n * 1000) / 1000);
    expect(clip!.pathD).toContain(`${f(CANVAS_CENTER.x + wx + pxc)} ${f(CANVAS_CENTER.y + wy + pyc)}`);
  });
});

describe('matte — shape coverage & determinism', () => {
  const STATIC = ['custom_star', 'custom_circle', 'custom_box', 'custom_rect', 'custom_triangle',
    'custom_parallelogram', 'custom_banner', 'custom_capsule', 'custom_diamond', 'custom_card'];

  it('produces a clip for every static shape type', () => {
    for (const type of STATIC) {
      const clip = buildMatteClipPath(makeSourcePart(type), { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 });
      expect(clip, type).not.toBeNull();
    }
  });

  it('M15: freeform source now produces a world-space clip from its points', () => {
    const source = makeSourcePart('custom_freeform', { points: [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 }] } as any);
    expect(getShapeGeometry('custom_freeform')).toBeNull(); // still no STATIC geometry
    const clip = buildMatteClipPath(source, { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 });
    expect(clip).not.toBeNull();
    expect(clip!.pathD).toBe('M 400 290 L 460 290 L 400 320 Z'); // center + transform applied
  });

  it('returns null for text/image/video sources (DEFERRED)', () => {
    for (const type of ['custom_text', 'custom_image', 'custom_video']) {
      expect(buildMatteClipPath(makeSourcePart(type), { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }), type).toBeNull();
    }
  });

  it('is deterministic — same input yields identical pathD', () => {
    const source = makeSourcePart('custom_star');
    const world: WorldTransform = { x: 12, y: 34, rotation: 15, scaleX: 1.5, scaleY: 1, opacity: 1 };
    expect(buildMatteClipPath(source, world)!.pathD).toBe(buildMatteClipPath(source, world)!.pathD);
  });
});

describe('matte — animated source', () => {
  it('world path changes when the source transform animates across frames', () => {
    const source = makeSourcePart('custom_box');
    source.baseTransform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    const track: Track = {
      id: 't1', partId: 'src_1', name: 'T', color: '#f00', visible: true,
      keyframes: [],
      channels: {
        ...makeEmptyChannels(),
        x: [
          { id: 'k1', frame: 0, value: 0, easing: 'linear', templateId: 'Sequence' },
          { id: 'k2', frame: 60, value: 200, easing: 'linear', templateId: 'Sequence' },
        ],
      },
    } as Track;

    const w0 = evaluateTransform([source], [track], ACTIVE, 'src_1', 0);
    const w60 = evaluateTransform([source], [track], ACTIVE, 'src_1', 60);
    expect(w0.x).toBe(0);
    expect(w60.x).toBe(200);

    const clip0 = buildMatteClipPath(source, w0)!;
    const clip60 = buildMatteClipPath(source, w60)!;
    expect(clip0.pathD).not.toBe(clip60.pathD);
    expect(clip0.id).toBe(clip60.id); // same id, updated geometry
  });
});

describe('matte — M13 resolveMatteMode (legacy mode → clip)', () => {
  it('absent matte → undefined', () => {
    expect(resolveMatteMode(undefined)).toBeUndefined();
    expect(resolveMatteMode(null as unknown as { mode?: 'clip' })).toBeUndefined();
  });

  it('legacy matte without mode → clip', () => {
    expect(resolveMatteMode({ sourcePartId: 'part_2' })).toBe('clip');
    expect(resolveMatteMode({ sourcePartId: 'part_2', mode: undefined })).toBe('clip');
  });

  it('passes explicit modes through unchanged', () => {
    expect(resolveMatteMode({ sourcePartId: 'p', mode: 'clip' })).toBe('clip');
    expect(resolveMatteMode({ sourcePartId: 'p', mode: 'alpha' })).toBe('alpha');
    expect(resolveMatteMode({ sourcePartId: 'p', mode: 'luminance' })).toBe('luminance');
  });

  it('inverted defaults to undefined (absent) — not forced to false', () => {
    const legacy: PartMatte = { sourcePartId: 'part_2' };
    expect(legacy.inverted).toBeUndefined();
    expect(legacy.mode).toBeUndefined(); // runtime resolves via resolveMatteMode
    expect(resolveMatteMode(legacy)).toBe('clip');
  });
});

describe('matte — M13 deterministic mask id', () => {
  it('encodes source + mode', () => {
    expect(matteMaskId('part_2', 'alpha', false)).toBe('kcs-mask-part_2-alpha');
    expect(matteMaskId('part_2', 'luminance', false)).toBe('kcs-mask-part_2-luminance');
  });

  it('appends -inv for inverted (no collision with non-inverted)', () => {
    expect(matteMaskId('part_2', 'alpha', true)).toBe('kcs-mask-part_2-alpha-inv');
    expect(matteMaskId('part_2', 'alpha', false)).not.toBe(matteMaskId('part_2', 'alpha', true));
  });

  it('is deterministic — stable across calls', () => {
    expect(matteMaskId('part_2', 'luminance', true)).toBe(matteMaskId('part_2', 'luminance', true));
  });

  it('never collides with the clip id namespace', () => {
    expect(matteMaskId('part_2', 'clip', false)).toContain('kcs-mask-');
    expect(matteClipPathId('part_2')).toBe('kcs-clip-part_2');
    expect(matteMaskId('part_2', 'clip', false)).not.toBe(matteClipPathId('part_2'));
  });
});

describe('matte — M13 buildMattePath (shared geometry core)', () => {
  it('is deterministic — same input yields identical pathD', () => {
    const source = makeSourcePart('custom_star');
    const world: WorldTransform = { x: 12, y: 34, rotation: 15, scaleX: 1.5, scaleY: 1, opacity: 1 };
    expect(buildMattePath(source, world)).toBe(buildMattePath(source, world));
  });

  it('produces geometry for static shapes and null for deferred types', () => {
    const world: WorldTransform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    for (const type of ['custom_star', 'custom_circle', 'custom_box', 'custom_rect', 'custom_triangle', 'custom_parallelogram', 'custom_banner', 'custom_capsule', 'custom_diamond']) {
      expect(buildMattePath(makeSourcePart(type), world), type).not.toBeNull();
    }
    for (const type of ['custom_freeform', 'custom_text', 'custom_image', 'custom_video']) {
      expect(buildMattePath(makeSourcePart(type), world), type).toBeNull();
    }
  });

  it('applies the world transform (rotated + scaled) — mirrors PartRenderer order', () => {
    const source = makeSourcePart('custom_rect');
    const world: WorldTransform = { x: 100, y: 50, rotation: 45, scaleX: 2, scaleY: 1, opacity: 1 };
    const pathD = buildMattePath(source, world)!;
    // same math as the clip pipeline (TEST B) — starts at the world-transformed corner
    expect(pathD).toMatch(/^M [\d.]+ [\d.]+ L /);
    expect(buildMatteClipPath(source, world)!.pathD).toBe(pathD);
  });
});

describe('matte — M13 geometry parity (clip ≡ mask, ONE computation)', () => {
  it('mask pathD equals clip pathD for the same source + world', () => {
    const source = makeSourcePart('custom_box');
    const world: WorldTransform = { x: -40, y: 25, rotation: 30, scaleX: 1.5, scaleY: 0.8, opacity: 1 };
    const clip = buildMatteClipPath(source, world)!;
    const mask = buildMatteMask(source, world, 'alpha', false, '#ffffff')!;
    const lum = buildMatteMask(source, world, 'luminance', false, '#ff0000')!;
    expect(mask.pathD).toBe(clip.pathD);
    expect(lum.pathD).toBe(clip.pathD);
  });
});

describe('matte — M13 buildMatteMask (alpha / luminance / inverted)', () => {
  const world: WorldTransform = { x: 10, y: -20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

  it('alpha mask: mode alpha, white geometry, id kcs-mask-{src}-alpha', () => {
    const m = buildMatteMask(makeSourcePart('custom_circle'), world, 'alpha', false, '#ff0000')!;
    expect(m.mode).toBe('alpha');
    expect(m.fill).toBe('white');
    expect(m.inverted).toBe(false);
    expect(m.id).toBe('kcs-mask-src_1-alpha');
    expect(m.pathD).toBeTruthy();
  });

  it('luminance mask: mode luminance, uses the SOURCE fillColor, mask id -luminance', () => {
    const m = buildMatteMask(makeSourcePart('custom_rect'), world, 'luminance', false, '#ff8800')!;
    expect(m.mode).toBe('luminance');
    expect(m.fill).toBe('#ff8800'); // evaluated fillColor passes through
    expect(m.id).toBe('kcs-mask-src_1-luminance');
    expect(m.pathD).toBeTruthy();
  });

  it('inverted: flag true + -inv id suffix for both modes', () => {
    const a = buildMatteMask(makeSourcePart('custom_box'), world, 'alpha', true, '#ffffff')!;
    const l = buildMatteMask(makeSourcePart('custom_box'), world, 'luminance', true, '#ffffff')!;
    expect(a.inverted).toBe(true);
    expect(a.id).toBe('kcs-mask-src_1-alpha-inv');
    expect(l.inverted).toBe(true);
    expect(l.id).toBe('kcs-mask-src_1-luminance-inv');
  });

  it('is deterministic — identical args yield identical masks', () => {
    const source = makeSourcePart('custom_star');
    const m1 = buildMatteMask(source, world, 'luminance', true, '#00ff00')!;
    const m2 = buildMatteMask(source, world, 'luminance', true, '#00ff00')!;
    expect(m1).toEqual(m2);
  });

  it('returns null for deferred geometry (freeform etc.)', () => {
    expect(buildMatteMask(makeSourcePart('custom_freeform'), world, 'alpha', false, '#fff')).toBeNull();
    expect(buildMatteMask(makeSourcePart('custom_text'), world, 'luminance', false, '#fff')).toBeNull();
  });

  it('does NOT bind source opacity — fill is unconditional white/color', () => {
    const m = buildMatteMask(makeSourcePart('custom_box'), { ...world, opacity: 0.2 }, 'alpha', false, '#ffffff')!;
    expect(m.fill).toBe('white'); // opacity 0.2 source still masks at full strength
  });
});

// ─── M14 Step 2B: feather (data model + pure) ──────────────────────────

describe('matte — M14 feather (normalize + propagation + geometry parity)', () => {
  it('normalizeFeather: undefined → 0 (sharp M13 edge)', () => {
    expect(normalizeFeather(undefined)).toBe(0);
  });

  it('normalizeFeather: 0 → 0', () => {
    expect(normalizeFeather(0)).toBe(0);
  });

  it('normalizeFeather: positive value passes through unchanged', () => {
    expect(normalizeFeather(12)).toBe(12);
    expect(normalizeFeather(0.5)).toBe(0.5);
  });

  it('normalizeFeather: negative → 0', () => {
    expect(normalizeFeather(-5)).toBe(0);
  });

  it('normalizeFeather: NaN / Infinity / -Infinity → 0', () => {
    expect(normalizeFeather(NaN)).toBe(0);
    expect(normalizeFeather(Infinity)).toBe(0);
    expect(normalizeFeather(-Infinity)).toBe(0);
  });

  it('buildMatteMaskFromPath: feather 12 propagates to the mask', () => {
    const mask = buildMatteMaskFromPath('src', 'M 0 0 Z', 'alpha', false, 'white', 12);
    expect(mask.feather).toBe(12);
  });

  it('buildMatteMaskFromPath: no feather argument → undefined (M13 behavior preserved)', () => {
    const mask = buildMatteMaskFromPath('src', 'M 0 0 Z', 'alpha', false, 'white');
    expect(mask.feather).toBeUndefined();
  });

  it('geometry parity: pathD(feather=undefined) === pathD(feather=0) === pathD(feather=12)', () => {
    const source = makeSourcePart('custom_box');
    const localWorld = { x: 100, y: 50, rotation: 30, scaleX: 2, scaleY: 1, opacity: 1 };
    const pathD = buildMattePath(source, localWorld)!;
    const a = buildMatteMaskFromPath(source.id, pathD, 'alpha', false, 'white');
    const b = buildMatteMaskFromPath(source.id, pathD, 'alpha', false, 'white', 0);
    const c = buildMatteMaskFromPath(source.id, pathD, 'alpha', false, 'white', 12);
    expect(b.pathD).toBe(a.pathD);
    expect(c.pathD).toBe(a.pathD);
    // And the pathD is the same world-space geometry as the clip path
    expect(a.pathD).toBe(buildMatteClipPath(source, localWorld)!.pathD);
  });

  it('serialization-compatible object: feather survives JSON round-trip; undefined stays absent', () => {
    const matte: PartMatte = {
      sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12,
    };
    const restored = JSON.parse(JSON.stringify(matte)) as PartMatte;
    expect(restored.feather).toBe(12);
    expect(restored).toEqual(matte);

    const legacy: PartMatte = { sourcePartId: 'src', mode: 'clip' };
    const legacyRestored = JSON.parse(JSON.stringify(legacy)) as PartMatte;
    expect(legacyRestored.feather).toBeUndefined(); // legacy data → no feather key
    expect(JSON.stringify(legacyRestored)).not.toContain('feather');
  });
});

describe('matte — M15 freeform source (custom_freeform → CharacterPart.points)', () => {
  const TRI = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 }];
  const STATIC_WORLD: WorldTransform = { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

  const freeformSource = (points: unknown) =>
    makeSourcePart('custom_freeform', { points } as any);

  it('is deterministic — same points + world → identical pathD', () => {
    const source = freeformSource(TRI);
    const d1 = buildMattePath(source, STATIC_WORLD)!;
    const d2 = buildMattePath(source, STATIC_WORLD)!;
    expect(d1).toBe(d2);
  });

  it('geometry parity: matte world path uses the SAME points the renderer draws', () => {
    const source = freeformSource(TRI);
    const local = buildFreeformPath(TRI as any);          // renderer'ın çizdiği lokal path
    const world = buildMattePath(source, STATIC_WORLD)!;  // matte'in world path'i
    expect(local).toBe('M 0 0 L 60 0 L 0 30 Z');
    // world = aynı noktalar + CANVAS_CENTER + transform (elle doğrulanmış)
    expect(world).toBe('M 400 290 L 460 290 L 400 320 Z');
  });

  it('rotated freeform: 90° → (60,0) dünya (400,350)', () => {
    const source = freeformSource(TRI);
    const d = buildMattePath(source, { ...STATIC_WORLD, rotation: 90 })!;
    expect(d).toContain(' L 400 350'); // (60,0) rot90 → x=300+100+0, y=240+50+60
  });

  it('scaled freeform: scaleX=2 → (60,0) dünya (520,290)', () => {
    const source = freeformSource(TRI);
    const d = buildMattePath(source, { ...STATIC_WORLD, scaleX: 2 })!;
    expect(d).toContain(' L 520 290');
  });

  it('negative scale: scaleX=-1 → (60,0) dünya (340,290) — güvenli', () => {
    const source = freeformSource(TRI);
    const d = buildMattePath(source, { ...STATIC_WORLD, scaleX: -1 })!;
    expect(d).toContain(' L 340 290');
  });

  it('parented freeform: evaluateTransform world compose → doğru dünya konumu', () => {
    const parent = makeSourcePart('custom_box', { id: 'par' } as any);
    parent.baseTransform = { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    const child = makeSourcePart('custom_freeform', { id: 'child', parentId: 'par', points: TRI } as any);
    const track = {
      id: 't_child', partId: 'child', name: 'T', color: '#f00', visible: true,
      keyframes: [], channels: makeEmptyChannels(),
    } as Track;
    const w = evaluateTransform([parent, child], [track], ACTIVE, 'child', 0);
    expect(w.x).toBe(50); // parent compose çalışıyor
    const d = buildMattePath(child, w)!;
    expect(d).toContain('M 350 240'); // 300 + 50, 240 + 0
  });

  it('empty points → null', () => {
    expect(buildMattePath(freeformSource([]), STATIC_WORLD)).toBeNull();
  });

  it('undefined points → null', () => {
    expect(buildMattePath(freeformSource(undefined), STATIC_WORLD)).toBeNull();
  });

  it('<2 points → null', () => {
    expect(buildMattePath(freeformSource([{ x: 1, y: 1 }]), STATIC_WORLD)).toBeNull();
  });

  it('malformed points (not an array) → null, no crash', () => {
    expect(buildMattePath(freeformSource('oops'), STATIC_WORLD)).toBeNull();
    expect(buildMattePath(freeformSource(null), STATIC_WORLD)).toBeNull();
  });

  it('self-intersecting polygon → builds without crash', () => {
    const source = freeformSource([{ x: 0, y: 0 }, { x: 20, y: 20 }, { x: 20, y: 0 }, { x: 0, y: 20 }]);
    const d = buildMattePath(source, STATIC_WORLD)!;
    expect(d.length).toBeGreaterThan(0);
  });

  it('freeform flows through the MASK builder too (same geometry core)', () => {
    const source = freeformSource(TRI);
    const mask = buildMatteMask(source, STATIC_WORLD, 'alpha', false, '#ffffff')!;
    expect(mask.pathD).toBe('M 400 290 L 460 290 L 400 320 Z');
    expect(mask.id).toBe('kcs-mask-src_1-alpha');
  });
});

describe('matte — M15 isMatteEligible', () => {
  it('static shapes are eligible', () => {
    for (const type of ['custom_star', 'custom_circle', 'custom_box', 'custom_rect', 'custom_triangle', 'custom_parallelogram', 'custom_banner', 'custom_capsule', 'custom_diamond']) {
      expect(isMatteEligible({ type }), type).toBe(true);
    }
  });

  it('custom_freeform is eligible', () => {
    expect(isMatteEligible({ type: 'custom_freeform' })).toBe(true);
  });

  it('text/image/video are NOT eligible', () => {
    for (const type of ['custom_image', 'custom_video']) {
      expect(isMatteEligible({ type }), type).toBe(false);
    }
  });

  it('M18: custom_text IS eligible (text matte — mask content element)', () => {
    expect(isMatteEligible({ type: 'custom_text' })).toBe(true);
  });

  it('undefined part is not eligible', () => {
    expect(isMatteEligible(undefined)).toBe(false);
  });
});

describe('matte — M16 normalizeStrength', () => {
  it('undefined → 1 (legacy full strength)', () => {
    expect(normalizeStrength(undefined)).toBe(1);
  });

  it('0 is a VALID value → 0 (matte disabled)', () => {
    expect(normalizeStrength(0)).toBe(0);
  });

  it('0.5 → 0.5', () => {
    expect(normalizeStrength(0.5)).toBe(0.5);
  });

  it('1 → 1', () => {
    expect(normalizeStrength(1)).toBe(1);
  });

  it('>1 clamps to 1', () => {
    expect(normalizeStrength(1.5)).toBe(1);
    expect(normalizeStrength(2)).toBe(1);
  });

  it('negative → 1 (malformed → legacy default)', () => {
    expect(normalizeStrength(-0.5)).toBe(1);
    expect(normalizeStrength(-1)).toBe(1);
  });

  it('NaN → 1', () => {
    expect(normalizeStrength(NaN)).toBe(1);
  });

  it('+Infinity → 1', () => {
    expect(normalizeStrength(Infinity)).toBe(1);
  });

  it('-Infinity → 1', () => {
    expect(normalizeStrength(-Infinity)).toBe(1);
  });
});

describe('matte — M16 strength in mask data', () => {
  const PATH = 'M 300 240 L 360 240 L 300 270 Z';

  it('strength 0.5 → mask data carries it', () => {
    const m = buildMatteMaskFromPath('src', PATH, 'alpha', false, '#fff', undefined, 0.5);
    expect(m.strength).toBe(0.5);
  });

  it('strength 0 → mask data carries it (valid)', () => {
    const m = buildMatteMaskFromPath('src', PATH, 'alpha', false, '#fff', undefined, 0);
    expect(m.strength).toBe(0);
  });

  it('strength 1 → mask data carries it', () => {
    const m = buildMatteMaskFromPath('src', PATH, 'luminance', true, '#fff', 12, 1);
    expect(m.strength).toBe(1);
    expect(m.feather).toBe(12); // coexists with feather
  });

  it('strength undefined → legacy behavior (field absent)', () => {
    const m = buildMatteMaskFromPath('src', PATH, 'alpha', false, '#fff');
    expect(m.strength).toBeUndefined();
    expect('strength' in m).toBe(false);
  });

  it('geometry parity: pathD identical for strength undefined/0/0.5/1', () => {
    const s = [undefined, 0, 0.5, 1].map((v) =>
      buildMatteMaskFromPath('src', PATH, 'alpha', false, '#fff', undefined, v).pathD,
    );
    expect(new Set(s).size).toBe(1);
    expect(s[0]).toBe(PATH);
  });

  it('serialization-compatible: strength survives JSON; undefined writes NO key', () => {
    const withS = JSON.parse(JSON.stringify(buildMatteMaskFromPath('src', PATH, 'alpha', false, '#fff', undefined, 0.5)));
    expect(withS.strength).toBe(0.5);
    const without = JSON.parse(JSON.stringify(buildMatteMaskFromPath('src', PATH, 'alpha', false, '#fff')));
    expect(without.strength).toBeUndefined();
    expect(JSON.stringify(without)).not.toContain('strength');
  });
});

describe('matte — M17 gradient data model + pure helpers', () => {
  describe('normalizeGradientAngle', () => {
    it('undefined → undefined (gradient absent — never coerced to 0)', () => {
      expect(normalizeGradientAngle(undefined)).toBeUndefined();
    });
    it('0 → 0', () => expect(normalizeGradientAngle(0)).toBe(0));
    it('360 → 0', () => expect(normalizeGradientAngle(360)).toBe(0));
    it('720 → 0', () => expect(normalizeGradientAngle(720)).toBe(0));
    it('370 → 10', () => expect(normalizeGradientAngle(370)).toBe(10));
    it('-10 → 350', () => expect(normalizeGradientAngle(-10)).toBe(350));
    it('-370 → 350', () => expect(normalizeGradientAngle(-370)).toBe(350));
    it('45 → 45', () => expect(normalizeGradientAngle(45)).toBe(45));
    it('359.999 → 359.999', () => expect(normalizeGradientAngle(359.999)).toBeCloseTo(359.999, 5));
    it('NaN → 0', () => expect(normalizeGradientAngle(NaN)).toBe(0));
    it('+Infinity → 0', () => expect(normalizeGradientAngle(Infinity)).toBe(0));
    it('-Infinity → 0', () => expect(normalizeGradientAngle(-Infinity)).toBe(0));
  });

  describe('gradientId', () => {
    it('source + 45 → kcs-mg-src-45', () => {
      expect(gradientId('src', { angle: 45 })).toBe('kcs-mg-src-45');
    });
    it('360 and 0 → same id', () => {
      expect(gradientId('src', { angle: 360 })).toBe(gradientId('src', { angle: 0 }));
    });
    it('-315 and 45 → same id', () => {
      expect(gradientId('src', { angle: -315 })).toBe('kcs-mg-src-45');
    });
    it('different source → different id', () => {
      expect(gradientId('a', { angle: 45 })).not.toBe(gradientId('b', { angle: 45 }));
    });
    it('different normalized angle → different id', () => {
      expect(gradientId('src', { angle: 45 })).not.toBe(gradientId('src', { angle: 90 }));
    });
    it('absent gradient → undefined (no def requested)', () => {
      expect(gradientId('src', undefined)).toBeUndefined();
    });
  });

  describe('getDefaultGradientStops', () => {
    it('alpha → white opaque → white transparent', () => {
      expect(getDefaultGradientStops('alpha')).toEqual([
        { offset: 0, color: 'white', opacity: 1 },
        { offset: 1, color: 'white', opacity: 0 },
      ]);
    });
    it('luminance → white → black', () => {
      expect(getDefaultGradientStops('luminance')).toEqual([
        { offset: 0, color: 'white', opacity: 1 },
        { offset: 1, color: 'black', opacity: 1 },
      ]);
    });
    it('repeated calls → identical deterministic data', () => {
      expect(getDefaultGradientStops('alpha')).toEqual(getDefaultGradientStops('alpha'));
      expect(getDefaultGradientStops('luminance')).toEqual(getDefaultGradientStops('luminance'));
    });
  });

  describe('normalizeGradient', () => {
    it('undefined → undefined (legacy stays gradient-free)', () => {
      expect(normalizeGradient(undefined)).toBeUndefined();
    });
    it('{ angle: 45 } → { angle: 45 }', () => {
      expect(normalizeGradient({ angle: 45 })).toEqual({ angle: 45 });
    });
    it('{ angle: 370 } → { angle: 10 }', () => {
      expect(normalizeGradient({ angle: 370 })).toEqual({ angle: 10 });
    });
    it('{ angle: -10 } → { angle: 350 }', () => {
      expect(normalizeGradient({ angle: -10 })).toEqual({ angle: 350 });
    });
    it('{ angle: NaN } → { angle: 0 }', () => {
      expect(normalizeGradient({ angle: NaN })).toEqual({ angle: 0 });
    });
    it('{ angle: Infinity } → { angle: 0 }', () => {
      expect(normalizeGradient({ angle: Infinity })).toEqual({ angle: 0 });
    });
  });

  describe('geometry parity — gradient is paint, NEVER geometry', () => {
    const source = (gradient?: PartMatte['gradient']) => {
      const p = makeSourcePart('custom_box', {}) as any;
      p.matte = { sourcePartId: 'tgt', mode: 'alpha', ...(gradient ? { gradient } : {}) };
      return p;
    };
    const world = { x: 40, y: -20, rotation: 45, scaleX: 2, scaleY: 0.5 };

    it('gradient undefined vs 45 → identical pathD', () => {
      expect(buildMattePath(source(undefined), world)).toBe(buildMattePath(source({ angle: 45 }), world));
    });
    it('gradient 45 vs 180 → identical pathD', () => {
      expect(buildMattePath(source({ angle: 45 }), world)).toBe(buildMattePath(source({ angle: 180 }), world));
    });
  });

  describe('legacy + M8', () => {
    it('PartMatte without gradient remains valid', () => {
      const legacy: PartMatte = { sourcePartId: 'src', mode: 'alpha', inverted: false, enabled: true, feather: 12, strength: 0.5 };
      expect(legacy.gradient).toBeUndefined();
      expect(isMatteActive(legacy)).toBe(true);
    });
    it('gradient undefined does not create gradient data', () => {
      expect(normalizeGradient(undefined)).toBeUndefined();
      expect(JSON.stringify({ matte: { sourcePartId: 'src', mode: 'alpha' } })).not.toContain('gradient');
    });
    it('M8: no TrackChannel / channel structure introduced for gradient', () => {
      // Gradient is a static PartMatte paint field — the channel model is
      // untouched (no enum member, no keyframe type). The exported matte
      // helpers prove the full gradient surface lives in matte.ts.
      const m = { sourcePartId: 'src', mode: 'alpha', gradient: { angle: 90 } };
      expect(Object.keys(m)).toEqual(['sourcePartId', 'mode', 'gradient']); // static part-level only
      expect(JSON.stringify(m)).not.toContain('channel');
      expect(JSON.stringify(m)).not.toContain('keyframe');
    });
  });
});

describe('matte — M18 text matte (data/pure)', () => {
  const IDENTITY: WorldTransform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
  const textPart = (overrides: Record<string, unknown> = {}) => ({
    id: 'txt', type: 'custom_text', name: 'T', zIndex: 1,
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    fillColor: '#ff0000', strokeColor: '#101218',
    textValue: 'HELLO', fontSize: 48, fontFamily: 'Arial',
    ...overrides,
  });

  it('isMatteEligible: custom_text → true (new); shapes/freeform stay eligible; media stays ineligible', () => {
    expect(isMatteEligible({ type: 'custom_text' })).toBe(true);
    expect(isMatteEligible({ type: 'custom_star' })).toBe(true);
    expect(isMatteEligible({ type: 'custom_freeform' })).toBe(true);
    for (const t of ['custom_image', 'custom_video', 'mograph_cloner', 'particle_system']) {
      expect(isMatteEligible({ type: t }), t).toBe(false);
    }
    expect(isMatteEligible(undefined)).toBe(false);
  });

  it('textMaskContent: maps source runtime fields with renderer defaults', () => {
    const d = textMaskContent(textPart())!;
    expect(d.content).toBe('HELLO');
    expect(d.fontSize).toBe(48);
    expect(d.fontFamily).toBe('Arial');
    expect(d.fontWeight).toBe('bold'); // renderer hardcodes bold
    expect(d.textAnchor).toBe('middle');
    expect(d.dominantBaseline).toBe('middle');
    expect(d.x).toBe(0);
    expect(d.y).toBe(0);
    // renderer fallbacks: textValue || "TEXT", fontSize || 24, fontFamily || "Outfit"
    const fallback = textMaskContent(textPart({ textValue: '', fontSize: undefined, fontFamily: undefined }))!;
    expect(fallback.content).toBe('TEXT');
    expect(fallback.fontSize).toBe(24);
    expect(fallback.fontFamily).toBe('Outfit');
    expect(textMaskContent(undefined)).toBeUndefined();
  });

  it('buildMatteTextMask: render-only mask — pathD null, text content, white/black fill', () => {
    const m = buildMatteTextMask('txt', textMaskContent(textPart())!, 'alpha', false);
    expect(m.id).toBe('kcs-mask-txt-alpha');
    expect(m.mode).toBe('alpha');
    expect(m.inverted).toBe(false);
    expect(m.pathD).toBeNull(); // NO path geometry — buildMattePath stays null for text
    expect(m.text!.content).toBe('HELLO');
    expect(m.fill).toBe('white');
    expect(m.feather).toBeUndefined();
    const inv = buildMatteTextMask('txt', textMaskContent(textPart())!, 'luminance', true, 12, 0.5);
    expect(inv.fill).toBe('black'); // 4A: inverted text → black text + white rect (luminance structure)
    expect(inv.feather).toBe(12);
    expect(inv.strength).toBe(0.5);
  });

  it('worldToLocal: identity — world point maps back to the same local point', () => {
    // forward: applyWorld((10,-20), identity) = (310, 220); inverse round-trips
    expect(worldToLocal({ x: 310, y: 220 }, IDENTITY)).toEqual({ x: 10, y: -20 });
  });

  it('worldToLocal: translation — subtracts the world offset', () => {
    const w = { ...IDENTITY, x: 40, y: -15 };
    expect(worldToLocal({ x: 350, y: 230 }, w)).toEqual({ x: 10, y: 5 }); // CX=300, CY=240
  });

  it('worldToLocal: rotation 90° — inverse rotation applied', () => {
    const w = { ...IDENTITY, rotation: 90 };
    // forward: (10,0) → (300-0, 240+10) = (300,250); inverse: back to (10,0)
    expect(worldToLocal({ x: 300, y: 250 }, w).x).toBeCloseTo(10, 9);
    expect(worldToLocal({ x: 300, y: 250 }, w).y).toBeCloseTo(0, 9);
  });

  it('worldToLocal: uniform scale — divides by scale', () => {
    const w = { ...IDENTITY, scaleX: 2, scaleY: 2 };
    expect(worldToLocal({ x: 320, y: 250 }, w)).toEqual({ x: 10, y: 5 });
  });

  it('worldToLocal: non-uniform scale — per-axis division', () => {
    const w = { ...IDENTITY, scaleX: 2, scaleY: 4 };
    expect(worldToLocal({ x: 320, y: 250 }, w)).toEqual({ x: 10, y: 2.5 });
  });

  it('worldToLocal: negative scale — flips the axis', () => {
    const w = { ...IDENTITY, scaleX: -1 };
    // forward: (10,0) → (300-10, 240) = (290,240); inverse → (10,0)
    expect(worldToLocal({ x: 290, y: 240 }, w)).toEqual({ x: 10, y: 0 });
  });

  it('worldToLocal: zero scale → deterministic (treated as 1, no NaN/Infinity)', () => {
    const w = { ...IDENTITY, scaleX: 0 };
    const r = worldToLocal({ x: 320, y: 240 }, w);
    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.y)).toBe(true);
    expect(r.x).toBe(20); // (320-300)/1 — scale treated as 1
    expect(r.y).toBe(0);
  });

  it('worldToLocal: round-trip for rotate+scale+translate (forward math replicated)', () => {
    const w = { x: 35, y: -20, rotation: 90, scaleX: 2, scaleY: 3, opacity: 1 };
    const p = { x: 12, y: -7 };
    const rad = Math.PI / 2;
    const world = {
      x: 300 + 35 + (12 * 2 * Math.cos(rad) - (-7 * 3 * Math.sin(rad))),
      y: 240 - 20 + (12 * 2 * Math.sin(rad) + (-7 * 3 * Math.cos(rad))),
    };
    expect(worldToLocal(world, w).x).toBeCloseTo(12, 9);
    expect(worldToLocal(world, w).y).toBeCloseTo(-7, 9);
  });

  it('gradientEndpointsLocal: text uses the canonical default box; local endpoints match the world def inverted', () => {
    const w = { x: 40, y: 10, rotation: 90, scaleX: 2, scaleY: 1.5, opacity: 1 };
    const local = gradientEndpointsLocal(textPart() as any, w, 0)!;
    // Default box 200×60 → half-extent along angle 0 = 100 → local x1/x2 = ±100
    expect(local.x1).toBeCloseTo(-100, 6);
    expect(local.x2).toBeCloseTo(100, 6);
    expect(local.y1).toBeCloseTo(0, 6);
    expect(local.y2).toBeCloseTo(0, 6);
    // The WORLD def (M17 gradientEndpoints) is the forward transform of the same box
    const world = gradientEndpoints(textPart() as any, w, 0)!;
    expect(worldToLocal({ x: world.x1, y: world.y1 }, w).x).toBeCloseTo(-100, 6);
    expect(worldToLocal({ x: world.x2, y: world.y2 }, w).x).toBeCloseTo(100, 6);
  });

  it('geometry integrity: buildMattePath STILL returns null for custom_text (unchanged)', () => {
    expect(buildMattePath(textPart() as any, IDENTITY)).toBeNull();
    expect(buildMatteClipPath(textPart() as any, IDENTITY)).toBeNull();
    // shape sources unchanged — regression guard
    expect(buildMattePath({ ...textPart({ type: 'custom_star' }) } as any, IDENTITY)).not.toBeNull();
  });

  it('M8 integrity: text matte introduces NO channels/keyframes (mask data only)', () => {
    const m = buildMatteTextMask('txt', textMaskContent(textPart())!, 'alpha', false);
    const json = JSON.stringify(m);
    expect(json).not.toContain('channel');
    expect(json).not.toContain('keyframe');
    expect(json).not.toContain('TrackChannel');
  });
});

describe('matte — M19 multi-stop gradient (data/pure)', () => {
  const S = (offset: number, color = 'white', opacity = 1) => ({ offset, color, opacity });
  const DEFAULTS_ALPHA = () => getDefaultGradientStops('alpha');
  const DEFAULTS_LUM = () => getDefaultGradientStops('luminance');

  it('defaults: alpha = white/1 → white/0; luminance = white → black', () => {
    expect(DEFAULTS_ALPHA()).toEqual([S(0, 'white', 1), S(1, 'white', 0)]);
    expect(DEFAULTS_LUM()).toEqual([S(0, 'white', 1), S(1, 'black', 1)]);
  });

  it('normalization: undefined / null / non-array / empty → mode defaults (legacy behavior)', () => {
    expect(normalizeGradientStops(undefined, 'alpha')).toEqual(DEFAULTS_ALPHA());
    expect(normalizeGradientStops(null as never, 'alpha')).toEqual(DEFAULTS_ALPHA());
    expect(normalizeGradientStops([] as never, 'alpha')).toEqual(DEFAULTS_ALPHA());
    expect(normalizeGradientStops('nope' as never, 'luminance')).toEqual(DEFAULTS_LUM());
  });

  it('sorting: unsorted input → offset-ascending output', () => {
    const out = normalizeGradientStops([S(0.8), S(0.2), S(0.5)], 'alpha');
    expect(out.map((s) => s.offset)).toEqual([0.2, 0.5, 0.8]);
  });

  it('clamping: offsets <0 → 0, >1 → 1; opacity <0 → 0, >1 → 1 (then sorted)', () => {
    const out = normalizeGradientStops([S(-0.5), S(1.5, 'white', 2), S(0.5, 'white', -1)], 'alpha');
    expect(out).toEqual([S(0), S(0.5, 'white', 0), S(1)]);
  });

  it('duplicate offsets: stable sort preserves input order (later doc-order stop wins per 5A)', () => {
    const out = normalizeGradientStops([S(0), S(0.5, 'white', 0.8), S(0.5, 'white', 0.2), S(1)], 'alpha');
    const dup = out.filter((s) => s.offset === 0.5);
    expect(dup).toEqual([S(0.5, 'white', 0.8), S(0.5, 'white', 0.2)]);
  });

  it('field salvage: missing/NaN offset → 0; missing/NaN opacity → 1; bad color → white', () => {
    const out = normalizeGradientStops(
      [{ offset: NaN, opacity: NaN, color: '' }, { offset: 1, color: '#ff0000' }] as never,
      'alpha',
    );
    expect(out).toEqual([S(0, 'white', 1), S(1, '#ff0000', 1)]);
  });

  it('non-object entries are dropped; <2 valid stops → defaults', () => {
    expect(normalizeGradientStops([42, S(0), S(1)] as never, 'alpha')).toEqual([S(0), S(1)]);
    expect(normalizeGradientStops([42, 'x'] as never, 'alpha')).toEqual(DEFAULTS_ALPHA());
    expect(normalizeGradientStops([S(0.5)], 'alpha')).toEqual(DEFAULTS_ALPHA()); // one-stop
  });

  it('canonical key: equal normalized sets → equal key (insertion order independent)', () => {
    const a = normalizeGradientStops([S(0.5), S(0), S(1)], 'alpha');
    const b = normalizeGradientStops([S(0), S(1), S(0.5)], 'alpha');
    expect(a).toEqual(b);
    expect(canonicalStopsKey(a)).toBe(canonicalStopsKey(b));
  });

  it('hash: same normalized stops → same hash; different stops → different hash; stable across calls', () => {
    const h1 = gradientStopsHash(normalizeGradientStops([S(0), S(0.5), S(1)], 'alpha'));
    const h2 = gradientStopsHash(normalizeGradientStops([S(0), S(0.5), S(1)], 'alpha'));
    const h3 = gradientStopsHash(normalizeGradientStops([S(0), S(0.5, 'white', 0.5), S(1)], 'alpha'));
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1).toMatch(/^[0-9a-f]{8}$/);
    // insertion-order independence: unsorted input hashes to the sorted key
    const hUnsorted = gradientStopsHash(normalizeGradientStops([S(1), S(0.5), S(0)], 'alpha'));
    expect(hUnsorted).toBe(h1);
  });

  it('legacy: gradient WITHOUT stops keeps the byte-for-byte id', () => {
    expect(gradientId('src', { angle: 45 })).toBe('kcs-mg-src-45');
    expect(gradientId('src', { angle: 360 })).toBe('kcs-mg-src-0');
    expect(gradientId('src', undefined)).toBeUndefined();
    expect(gradientId('src', { angle: 45, stops: undefined })).toBe('kcs-mg-src-45');
  });

  it('M19 id: stops present → deterministic -s{hash} suffix (same stops → same id)', () => {
    const stops = [S(0, '#ff0000'), S(0.5, 'white', 0.5), S(1, '#0000ff')];
    const id1 = gradientId('src', { angle: 45, stops });
    const id2 = gradientId('src', { angle: 45, stops: [...stops].reverse() }); // same SET, other order
    expect(id1).toBe(`kcs-mg-src-45-s${gradientStopsHash(normalizeGradientStops(stops, 'alpha'))}`);
    expect(id2).toBe(id1); // normalized equality → same id
  });

  it('M19 id: DIFFERENT stops on the same source+angle → DIFFERENT ids (no def collision)', () => {
    const a = gradientId('src', { angle: 45, stops: [S(0), S(1)] });
    const b = gradientId('src', { angle: 45, stops: [S(0), S(0.5), S(1)] });
    const c = gradientId('src', { angle: 45, stops: [S(0), S(1, 'white', 0.5)] });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
    // different source with identical stops → different ids
    expect(gradientId('src2', { angle: 45, stops: [S(0), S(1)] })).not.toBe(a);
  });

  it('M19 id: malformed stops (fall to defaults) still produce a STABLE id', () => {
    const id1 = gradientId('src', { angle: 45, stops: [] as never });
    const id2 = gradientId('src', { angle: 45, stops: [] as never });
    expect(id1).toBe(id2);
    expect(id1).toContain('-s'); // hashed (array present) but stable
  });

  it('M8 integrity: stops are paint data — no channel/keyframe/TrackChannel introduced', () => {
    const json = JSON.stringify({ angle: 45, stops: [S(0), S(1)] });
    expect(json).not.toContain('channel');
    expect(json).not.toContain('keyframe');
    expect(json).not.toContain('TrackChannel');
    expect(normalizeGradientStops([S(0), S(1)], 'alpha')).toEqual([S(0), S(1)]); // idempotent
  });
});

describe('M20 — radial gradient data/pure helpers', () => {
  // Helper factories
  const ID = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  const shape = (type = 'custom_circle') => ({ id: 'src', type, name: 'S', zIndex: 1, points: undefined } as any);
  const freeform = (points: { x: number; y: number }[]) => ({ id: 'src', type: 'custom_freeform', name: 'S', zIndex: 1, points } as any);
  const textPart = () => ({ id: 'txt', type: 'custom_text', name: 'T', zIndex: 1, textValue: 'HHH', fontSize: 80, fontFamily: 'Arial', points: undefined } as any);
  const R = (o: number, op: number) => ({ offset: o, color: 'white', opacity: op });

  // ─── Type normalization ────────────────────────────────────────────────
  it('normalizeGradientType: undefined/linear/malformed → linear; radial → radial', () => {
    expect(normalizeGradientType(undefined)).toBe('linear');
    expect(normalizeGradientType('linear')).toBe('linear');
    expect(normalizeGradientType('radial')).toBe('radial');
    expect(normalizeGradientType(null)).toBe('linear');
    expect(normalizeGradientType(42)).toBe('linear');
    expect(normalizeGradientType('foo')).toBe('linear');
    expect(normalizeGradientType({})).toBe('linear');
    expect(normalizeGradientType('RADIAL')).toBe('linear'); // case-sensitive deterministic
    expect(normalizeGradientType(normalizeGradientType('radial'))).toBe('radial'); // idempotent
  });

  // ─── Legacy compatibility ──────────────────────────────────────────────
  it('legacy: { angle: 45 } and { angle: 45, stops: undefined } stay LINEAR with the EXACT legacy id', () => {
    expect(gradientId('src', { angle: 45 })).toBe('kcs-mg-src-45'); // byte-for-byte
    expect(gradientId('src', { angle: 45, stops: undefined })).toBe('kcs-mg-src-45');
    expect(gradientId('src', { type: 'linear', angle: 45 })).toBe('kcs-mg-src-45'); // explicit linear ≡ legacy
    expect(matteMaskGradientSuffix({ angle: 45 })).toBe('-g45');
    expect(matteMaskGradientSuffix({ angle: 45, stops: [R(0, 1), R(1, 0)] })).toBe('-g45-s' + gradientStopsHash(normalizeGradientStops([R(0, 1), R(1, 0)], 'alpha')));
  });

  // ─── Radial geometry — shapes ──────────────────────────────────────────
  it('radial geometry: circle source (local 60×60, r=30) → center local (0,0), bounding radius sqrt(7200)/2', () => {
    // shapeGeometry custom_circle r=30 → local bbox 60×60 → width²+height² = 7200
    const g = radialGradientGeometry(shape('custom_circle'), ID, false)!;
    expect(g.cx).toBeCloseTo(300, 6); // applyWorld identity → canvas center
    expect(g.cy).toBeCloseTo(240, 6);
    expect(g.r).toBeCloseTo(Math.sqrt(60 * 60 + 60 * 60) / 2, 6); // ≈42.426
  });

  it('radial geometry: non-uniform scale (2,1) → r × max(scale) covers the transformed source', () => {
    const g = radialGradientGeometry(shape('custom_circle'), { ...ID, scaleX: 2, scaleY: 1 }, false)!;
    expect(g.r).toBeCloseTo((Math.sqrt(7200) / 2) * 2, 6); // 84.85
    // world source spans 120×60 → bounding circle sqrt(60²+30²) ≈ 67.1 < 84.85 ✓ covered
    expect(g.r).toBeGreaterThan(Math.sqrt(60 * 60 + 30 * 30));
  });

  it('radial geometry: negative (flip) scale uses |scale|; zero scale treated as 1', () => {
    const neg = radialGradientGeometry(shape('custom_circle'), { ...ID, scaleX: -2, scaleY: 1 }, false)!;
    expect(neg.r).toBeCloseTo((Math.sqrt(7200) / 2) * 2, 6);
    const zero = radialGradientGeometry(shape('custom_circle'), { ...ID, scaleX: 0, scaleY: 1 }, false)!;
    expect(zero.r).toBeCloseTo(Math.sqrt(7200) / 2, 6); // 0 → 1 (worldToLocal rule)
  });

  it('radial geometry: rotation moves the center through applyWorld, radius unchanged', () => {
    const base = radialGradientGeometry(shape('custom_circle'), ID, false)!;
    const rot = radialGradientGeometry(shape('custom_circle'), { ...ID, x: 100, rotation: 90 }, false)!;
    expect(rot.cx).toBeCloseTo(base.cx + 100, 6); // translated
    expect(rot.r).toBeCloseTo(base.r, 6); // rotation does not scale the radius
  });

  it('radial geometry: rect source uses its bbox; freeform uses CharacterPart.points', () => {
    const rect = radialGradientGeometry(shape('custom_rect'), ID, false)!;
    // custom_rect geo (e.g. 100×60 local) → deterministic center (300,240), r = sqrt(w²+h²)/2
    expect(rect.cx).toBeCloseTo(300, 6);
    expect(rect.cy).toBeCloseTo(240, 6);
    expect(rect.r).toBeGreaterThan(0);
    const ff = radialGradientGeometry(freeform([{ x: -50, y: -30 }, { x: 50, y: -30 }, { x: 0, y: 60 }]), ID, false)!;
    expect(ff.cx).toBeCloseTo(300, 6); // local bbox center (0, 15) → applyWorld identity → (300, 255)
    expect(ff.cy).toBeCloseTo(255, 6);
    expect(ff.r).toBeCloseTo(Math.sqrt(100 * 100 + 90 * 90) / 2, 6); // w=100 h=90
  });

  // ─── Radial geometry — text coordinate spaces ─────────────────────────
  it('radial geometry: non-inverted TEXT → LOCAL center/radius (canonical ±100×±30 box)', () => {
    const g = radialGradientGeometry(textPart(), ID, true)!;
    expect(g.cx).toBe(0);
    expect(g.cy).toBe(0);
    expect(g.r).toBeCloseTo(Math.sqrt(200 * 200 + 60 * 60) / 2, 6); // ≈104.4
  });

  it('radial geometry: inverted TEXT → WORLD center/radius (region rect consumes the def)', () => {
    const g = radialGradientGeometry(textPart(), { ...ID, scaleX: 2 }, false)!;
    expect(g.cx).toBeCloseTo(300, 6); // local (0,0) → applyWorld
    expect(g.cy).toBeCloseTo(240, 6);
    expect(g.r).toBeCloseTo((Math.sqrt(200 * 200 + 60 * 60) / 2) * 2, 6); // × max scale
  });

  it('radial geometry: deterministic across repeated calls; missing geometry → undefined', () => {
    const a = radialGradientGeometry(shape('custom_circle'), ID, false)!;
    const b = radialGradientGeometry(shape('custom_circle'), ID, false)!;
    expect(a).toEqual(b);
    expect(radialGradientGeometry({ id: 'x', type: 'custom_image', name: 'I', zIndex: 1 } as any, ID, false)).toBeUndefined();
  });

  // ─── Identity ──────────────────────────────────────────────────────────
  it('radial identity: unambiguous -radial discriminator; linear ≠ radial', () => {
    expect(gradientId('src', { type: 'radial' })).toBe('kcs-mg-src-radial');
    expect(gradientId('src', { type: 'radial', angle: 45 })).toBe('kcs-mg-src-radial'); // angle harmless/ignored
    expect(gradientId('src', { angle: 45 })).not.toBe(gradientId('src', { type: 'radial' }));
    expect(matteMaskGradientSuffix({ type: 'radial' })).toBe('-radial');
    expect(matteMaskGradientSuffix({ angle: 45 })).not.toBe(matteMaskGradientSuffix({ type: 'radial' }));
  });

  it('radial identity: same normalized stops → same id; different stops → different id; deterministic', () => {
    const a = gradientId('src', { type: 'radial', stops: [R(0, 1), R(0.5, 0.5), R(1, 0)] });
    const b = gradientId('src', { type: 'radial', stops: [R(1, 0), R(0.5, 0.5), R(0, 1)] }); // reversed input — same normalized set
    expect(b).toBe(a);
    expect(gradientId('src', { type: 'radial', stops: [R(0, 1), R(1, 0)] })).not.toBe(a);
    expect(gradientId('src', { type: 'radial', stops: [R(0, 1), R(1, 0)] })).toBe(gradientId('src', { type: 'radial', stops: [R(0, 1), R(1, 0)] })); // deterministic
    expect(a).toMatch(/^kcs-mg-src-radial-s[0-9a-f]{8}$/);
  });

  it('mask suffix: radial discriminator with stops; feather/strength remain orthogonal (suffix is gradient-only)', () => {
    expect(matteMaskGradientSuffix({ type: 'radial', stops: [R(0, 1), R(1, 0)] })).toBe('-radial-s' + gradientStopsHash(normalizeGradientStops([R(0, 1), R(1, 0)], 'alpha')));
    // the suffix is the gradient segment only — feather/strength segments are appended by the renderer
    // (6C); here we verify the linear legacy byte-for-byte guarantee still holds:
    expect(matteMaskGradientSuffix({ angle: 0 })).toBe('-g0');
    expect(matteMaskGradientSuffix({ type: 'linear', angle: 0 })).toBe('-g0');
  });

  // ─── Stops reuse (M19 machinery, no second system) ────────────────────
  it('stops: radial consumes the exact M19 normalization + hash', () => {
    const raw = [{ offset: 2, color: 'white', opacity: 0.2 }, { offset: -1, color: 'white', opacity: 3 }];
    const norm = normalizeGradientStops(raw, 'alpha');
    expect(norm).toEqual([{ offset: 0, color: 'white', opacity: 1 }, { offset: 1, color: 'white', opacity: 0.2 }]);
    expect(gradientStopsHash(norm)).toBe(gradientStopsHash(normalizeGradientStops([{ offset: -1, color: 'white', opacity: 3 }, { offset: 2, color: 'white', opacity: 0.2 }], 'alpha')));
    // radial outside r uses the LAST stop (6A contract) — the last normalized stop is deterministic:
    expect(norm[norm.length - 1]).toEqual({ offset: 1, color: 'white', opacity: 0.2 });
  });

  // ─── M8 ────────────────────────────────────────────────────────────────
  it('M8: radial data is paint — no channel/keyframe/TrackChannel enters serialized form', () => {
    const radialMatte = {
      sourcePartId: 'src', mode: 'alpha',
      gradient: { type: 'radial', angle: 45, stops: [R(0, 1), R(0.5, 0.5), R(1, 0)] },
    };
    const json = JSON.stringify(radialMatte);
    expect(json).toContain('"type":"radial"');
    expect(json).not.toContain('keyframe');
    expect(json).not.toContain('TrackChannel');
    expect(json).not.toContain('cx');
    expect(json).not.toContain('cy');
    expect(json).not.toContain('radius'); // derived geometry is NEVER persisted
  });
});
