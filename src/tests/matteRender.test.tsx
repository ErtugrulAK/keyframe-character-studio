/**
 * M11 Step 2B — StagePartLayers track matte render integration.
 *
 * Behavior-level (renderToString) checks:
 *   - matte target gets clip-path="url(#kcs-clip-{sourceId})"
 *   - ONE clipPath per source in <defs>, shared by multiple targets
 *   - enabled=false → no clip
 *   - missing source → no clip, no crash
 *   - matte source itself still renders normally
 *   - no matte → no clip defs at all
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { StagePartLayers } from '../components/Canvas/StagePartLayers';
import { makeEmptyChannels } from '../utils/defaults';
import { matteClipPathId, buildMatteClipPath } from '../utils/matte';
import { evaluateTransform } from '../utils/evaluateTransform';
import type { CharacterPart, Track } from '../types/animator';

function makePart(id: string, type: string, matte?: CharacterPart['matte']): CharacterPart {
  return {
    id,
    type,
    name: id,
    zIndex: 1,
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    fillColor: '#ff0000',
    strokeColor: '#101218',
    matte,
  } as CharacterPart;
}

function makeTrack(partId: string): Track {
  return {
    id: `t_${partId}`, partId, name: 'T', color: '#f00', visible: true,
    keyframes: [], channels: makeEmptyChannels(),
  } as Track;
}

function renderStage(parts: CharacterPart[]) {
  const tracks = parts.map((p) => makeTrack(p.id));
  return renderToString(
    <StagePartLayers
      sortedParts={parts}
      appMode="edit"
      broadcastState={{}}
      currentFrame={0}
      selectedPartId={null}
      totalFrames={60}
      onSelect={() => {}}
      onStartTranslateDrag={() => {}}
      tracks={tracks}
      customPresets={[]}
      liveStuntsState={{}}
    />
  );
}

describe('StagePartLayers — track matte render', () => {
  it('applies clip-path to the matte target and defines the clip', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'clip' });
    const html = renderStage([source, target]);

    expect(html).toContain(`<clipPath id="${matteClipPathId('src')}"`);
    expect(html).toContain(`clip-path="url(#${matteClipPathId('src')})"`);
  });

  it('renders the matte source normally (its own <g> is present)', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'clip' });
    const html = renderStage([source, target]);

    // Source still renders its shape (box rect) — not hidden, not re-parented
    expect(html).toContain('width="60"');
  });

  it('one source shared by multiple targets → ONE clipPath, two clip-path refs', () => {
    const source = makePart('src', 'custom_box');
    const targetA = makePart('tgtA', 'custom_circle', { sourcePartId: 'src', mode: 'clip' });
    const targetB = makePart('tgtB', 'custom_rect', { sourcePartId: 'src', mode: 'clip' });
    const html = renderStage([source, targetA, targetB]);

    const clipDefs = html.match(/<clipPath id="kcs-clip-src"/g);
    expect(clipDefs).toHaveLength(1);
    const refs = html.match(/clip-path="url\(#kcs-clip-src\)"/g);
    expect(refs).toHaveLength(2);
  });

  it('enabled=false → target renders WITHOUT clip', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'clip', enabled: false });
    const html = renderStage([source, target]);

    expect(html).not.toContain(`clip-path="url(#${matteClipPathId('src')})"`);
    expect(html).not.toContain(`<clipPath id="${matteClipPathId('src')}"`);
  });

  it('missing source → no crash, target renders WITHOUT clip', () => {
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'ghost_source', mode: 'clip' });
    const html = renderStage([target]);

    expect(html).toContain('r="30"'); // target still renders
    expect(html).not.toContain('clip-path=');
  });

  it('M15: freeform source with points → clip produced, target clipped', () => {
    const source = makePart('src', 'custom_freeform');
    source.points = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 }];
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'clip' });
    const html = renderStage([source, target]);

    expect(html).toContain('r="30"');
    expect(html).toContain('<clipPath id="kcs-clip-src"');
    expect(html).toContain('clip-path="url(#kcs-clip-src)"');
    expect(html).toContain('M 300 240 L 360 240 L 300 270 Z'); // freeform world path in the def
  });

  it('freeform source WITHOUT points → no clip (degenerate, safe)', () => {
    const source = makePart('src', 'custom_freeform'); // no points
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'clip' });
    const html = renderStage([source, target]);

    expect(html).toContain('r="30"');
    expect(html).not.toContain('clip-path=');
  });

  it('no matte anywhere → no clipPath defs', () => {
    const a = makePart('a', 'custom_box');
    const b = makePart('b', 'custom_circle');
    const html = renderStage([a, b]);

    expect(html).not.toContain('<clipPath');
    expect(html).not.toContain('clip-path=');
  });

  // ─── M13 Step 2C: alpha / luminance / inverted masks ────────────────

  it('M13: mode=alpha renders an alpha mask with white fill (no clipPath)', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'alpha' });
    const html = renderStage([source, target]);

    expect(html).toContain(`<mask id="kcs-mask-src-alpha"`);
    expect(html).toContain('mask-type="alpha"');
    expect(html).toContain('maskUnits="userSpaceOnUse"');
    expect(html).toContain('fill="white"');
    expect(html).toContain(`mask="url(#kcs-mask-src-alpha)"`);
    expect(html).not.toContain('clip-path=');
    expect(html).not.toContain('<clipPath');
  });

  it('M13: mode=luminance renders a luminance mask with the source fillColor', () => {
    const source = makePart('src', 'custom_box'); // fillColor #ff0000
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'luminance' });
    const html = renderStage([source, target]);

    expect(html).toContain(`<mask id="kcs-mask-src-luminance"`);
    expect(html).toContain('mask-type="luminance"');
    expect(html).toContain('fill="#ff0000"');
    expect(html).toContain(`mask="url(#kcs-mask-src-luminance)"`);
  });

  it('M13: inverted luminance → explicit region + white background + black geometry', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'luminance', inverted: true });
    const html = renderStage([source, target]);

    expect(html).toContain(`<mask id="kcs-mask-src-luminance-inv"`);
    expect(html).toContain('mask-type="luminance"');
    // Explicit world-space artboard region (default 1920×1080 → 300±960, 240±540)
    expect(html).toContain('x="-660"');
    expect(html).toContain('y="-300"');
    expect(html).toContain('width="1920"');
    expect(html).toContain('height="1080"');
    expect(html).toContain('fill="white"'); // background rect
    expect(html).toContain('fill="black"'); // geometry path
    expect(html).toContain(`mask="url(#kcs-mask-src-luminance-inv)"`);
  });

  it('M13: inverted alpha → alpha mask + SINGLE evenodd path (region contour + geometry) — real hole', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'alpha', inverted: true });
    const html = renderStage([source, target]);

    expect(html).toContain(`<mask id="kcs-mask-src-alpha-inv"`);
    expect(html).toContain('mask-type="alpha"');
    // H fix: one evenodd path = outer region contour + matte contour
    // (Chromium alpha masks ignore a second element — pixel-verified).
    expect(html).toContain('fill-rule="evenodd"');
    expect(html).toContain('fill="white"'); // region contour: full alpha
    // Region contour (default 1920×1080 → 300±960, 240±540) + matte pathD
    expect(html).toContain('M -660 -300 H 1260 V 780 H -660 Z');
    expect(html).toContain(`mask="url(#kcs-mask-src-alpha-inv)"`);
  });

  it('M13: one source → N targets with alpha = one mask def, N mask refs', () => {
    const source = makePart('src', 'custom_box');
    const tA = makePart('tA', 'custom_circle', { sourcePartId: 'src', mode: 'alpha' });
    const tB = makePart('tB', 'custom_rect', { sourcePartId: 'src', mode: 'alpha' });
    const tC = makePart('tC', 'custom_triangle', { sourcePartId: 'src', mode: 'alpha' });
    const html = renderStage([source, tA, tB, tC]);

    const defs = html.match(/<mask id="kcs-mask-src-alpha"/g);
    expect(defs).toHaveLength(1);
    const refs = html.match(/mask="url\(#kcs-mask-src-alpha\)"/g);
    expect(refs).toHaveLength(3);
  });

  it('M13: mixed modes on the same source → distinct deterministic ids, shared geometry', () => {
    const source = makePart('src', 'custom_box');
    const tAlpha = makePart('tA', 'custom_circle', { sourcePartId: 'src', mode: 'alpha' });
    const tLum = makePart('tB', 'custom_rect', { sourcePartId: 'src', mode: 'luminance' });
    const tInv = makePart('tC', 'custom_triangle', { sourcePartId: 'src', mode: 'alpha', inverted: true });
    const html = renderStage([source, tAlpha, tLum, tInv]);

    expect(html).toContain('id="kcs-mask-src-alpha"');
    expect(html).toContain('id="kcs-mask-src-luminance"');
    expect(html).toContain('id="kcs-mask-src-alpha-inv"');
    // No id collisions: exactly one of each
    expect(html.match(/id="kcs-mask-src-alpha"/g)).toHaveLength(1);
    expect(html.match(/id="kcs-mask-src-luminance"/g)).toHaveLength(1);
    expect(html.match(/id="kcs-mask-src-alpha-inv"/g)).toHaveLength(1);
    // Geometry parity: every mask's path carries the SAME matte world-space
    // pathD (alpha-inv additionally prepends the region contour — allowed).
    const matteSubPath = 'M 270 210 L 330 210 L 330 270 L 270 270 Z';
    const pathDs = html.match(/<path d="([^"]+)"/g)?.map((m) => m) ?? [];
    expect(pathDs.length).toBeGreaterThanOrEqual(3);
    for (const p of pathDs) {
      expect(p).toContain(matteSubPath);
    }
  });

  it('M13: mode=undefined (legacy data) still resolves to clipPath', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src' } as any); // no mode
    const html = renderStage([source, target]);

    expect(html).toContain(`clip-path="url(#kcs-clip-src)"`);
    expect(html).not.toContain('<mask');
  });

  // ─── M14 Step 2C: feather (feGaussianBlur) ───────────────────────────

  it('M14: feather undefined → no filter (M13 structure byte-for-byte)', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'alpha' });
    const html = renderStage([source, target]);

    expect(html).not.toContain('feGaussianBlur');
    expect(html).not.toContain('kcs-matte-feather-');
    expect(html).toContain(`<mask id="kcs-mask-src-alpha"`); // M13 id unchanged
  });

  it('M14: feather 0 → no filter, M13 id unchanged', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'alpha', feather: 0 });
    const html = renderStage([source, target]);

    expect(html).not.toContain('feGaussianBlur');
    expect(html).toContain(`<mask id="kcs-mask-src-alpha"`);
  });

  it('M14: feather 12 → mask gets feGaussianBlur filter with wide region', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'alpha', feather: 12 });
    const html = renderStage([source, target]);

    expect(html).toContain(`<mask id="kcs-mask-src-alpha-f12"`); // deterministic feathered id
    expect(html).toContain(`mask="url(#kcs-mask-src-alpha-f12)"`);
    expect(html).toContain('feGaussianBlur');
    expect(html).toContain('stdDeviation="6"'); // feather/2
    // Wide explicit region: artboard (-660,-300,1920×1080) inflated by feather
    expect(html).toContain('kcs-matte-feather-src-alpha-f12');
    expect(html).toContain('x="-672"'); // -660 - 12
    expect(html).toContain('y="-312"'); // -300 - 12
    expect(html).toContain('width="1944"'); // 1920 + 24
    expect(html).toContain('height="1104"'); // 1080 + 24
    // The mask path references the filter
    expect(html).toContain(`filter="url(#kcs-matte-feather-src-alpha-f12)"`);
  });

  it('M14: pathD parity — feather 0 and feather 12 share identical geometry', () => {
    const source = makePart('src', 'custom_box');
    const t0 = makePart('tA', 'custom_circle', { sourcePartId: 'src', mode: 'alpha', feather: 0 });
    const t12 = makePart('tB', 'custom_rect', { sourcePartId: 'src', mode: 'alpha', feather: 12 });
    const html = renderStage([source, t0, t12]);

    const ds = [...html.matchAll(/<path d="(M 270 210[^"]*)"/g)].map((m) => m[1]);
    expect(ds.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ds).size).toBe(1); // identical world-space geometry
  });

  it('M14: inverted alpha keeps the evenodd single-path structure + filter on it', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'alpha', inverted: true, feather: 12 });
    const html = renderStage([source, target]);

    expect(html).toContain(`<mask id="kcs-mask-src-alpha-inv-f12"`);
    expect(html).toContain('fill-rule="evenodd"');
    expect(html).toContain('fill="white"');
    expect(html).toContain('M -660 -300 H 1260 V 780 H -660 Z'); // region contour preserved
    expect(html).toContain(`filter="url(#kcs-matte-feather-src-alpha-inv-f12)"`);
  });

  it('M14: inverted luminance — region rect NOT filtered, black matte path filtered', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'luminance', inverted: true, feather: 12 });
    const html = renderStage([source, target]);

    expect(html).toContain(`<mask id="kcs-mask-src-luminance-inv-f12"`);
    expect(html).toContain('<rect'); // white region rect still present
    expect(html).toContain('fill="black"'); // matte path
    expect(html).toContain(`filter="url(#kcs-matte-feather-src-luminance-inv-f12)"`);
    // Exactly ONE filter for this mask (region rect is never filtered):
    // the <filter id> def + the path's filter ref = 2 occurrences
    expect(html.match(/kcs-matte-feather-src-luminance-inv-f12/g)?.length).toBe(2);
  });

  it('M14: dedupe — same (source, mode, inverted, feather) across N targets → 1 mask + 1 filter', () => {
    const source = makePart('src', 'custom_box');
    const tA = makePart('tA', 'custom_circle', { sourcePartId: 'src', mode: 'alpha', feather: 12 });
    const tB = makePart('tB', 'custom_rect', { sourcePartId: 'src', mode: 'alpha', feather: 12 });
    const tC = makePart('tC', 'custom_triangle', { sourcePartId: 'src', mode: 'alpha', feather: 12 });
    const html = renderStage([source, tA, tB, tC]);

    expect(html.match(/<mask id="kcs-mask-src-alpha-f12"/g)).toHaveLength(1);
    expect(html.match(/<filter id="kcs-matte-feather-src-alpha-f12"/g)).toHaveLength(1);
    expect(html.match(/mask="url\(#kcs-mask-src-alpha-f12\)"/g)).toHaveLength(3);
  });

  it('M14: different feather values on the same source → distinct masks/filters (no id collision)', () => {
    const source = makePart('src', 'custom_box');
    const tA = makePart('tA', 'custom_circle', { sourcePartId: 'src', mode: 'alpha', feather: 6 });
    const tB = makePart('tB', 'custom_rect', { sourcePartId: 'src', mode: 'alpha', feather: 12 });
    const html = renderStage([source, tA, tB]);

    expect(html).toContain('id="kcs-mask-src-alpha-f6"');
    expect(html).toContain('id="kcs-mask-src-alpha-f12"');
    expect(html.match(/<mask id="kcs-mask-src-alpha-f6"/g)).toHaveLength(1);
    expect(html.match(/<mask id="kcs-mask-src-alpha-f12"/g)).toHaveLength(1);
    expect(html.match(/<filter id=/g)).toHaveLength(2);
  });

  it('M14: rotated+scaled feathered source — mask pathD identical to the clip geometry (feather never touches transform math)', () => {
    const source = makePart('src', 'custom_box');
    source.baseTransform = { x: 40, y: -20, rotation: 45, scaleX: 2, scaleY: 0.5, opacity: 1 };
    const tClip = makePart('tA', 'custom_circle', { sourcePartId: 'src', mode: 'clip' });
    const tMask = makePart('tB', 'custom_circle', { sourcePartId: 'src', mode: 'alpha', feather: 12 });
    const html = renderStage([source, tClip, tMask]);

    const world = evaluateTransform([source], [makeTrack('src')], 'Sequence', 'src', 0);
    const expectedClipPath = buildMatteClipPath(source, world)!.pathD;

    const maskD = html.match(/<mask id="kcs-mask-src-alpha-f12"[\s\S]*?<path d="([^"]+)"/)?.[1];
    expect(maskD).toBeTruthy();
    // Same evaluated world transform (rotate 45 + scale 2×0.5) → identical
    // geometry whether consumed by clipPath or by a feathered mask.
    expect(maskD).toBe(expectedClipPath);
  });
});
