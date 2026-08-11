/**
 * M11 Step 2B — Track matte MVP tests.
 *
 * Pure helper coverage: world-space path generation (matching PartRenderer's
 * transform order), shape-type coverage, deterministic output, enabled
 * semantics, freeform deferral — plus evaluation-integrated tests (animated /
 * rotated / scaled / parented sources) using evaluateTransform.
 */
import { describe, it, expect } from 'vitest';
import { buildMatteClipPath, buildMatteMask, buildMatteMaskFromPath, buildMattePath, normalizeFeather, matteClipPathId, matteMaskId, isMatteActive, resolveMatteMode } from '../utils/matte';
import type { PartMatte } from '../types/animator';
import { getShapeGeometry } from '../utils/shapeGeometry';
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

  it('returns null for freeform (DEFERRED — no clip produced)', () => {
    const source = makeSourcePart('custom_freeform', { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }] } as any);
    expect(getShapeGeometry('custom_freeform')).toBeNull();
    expect(buildMatteClipPath(source, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 })).toBeNull();
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
