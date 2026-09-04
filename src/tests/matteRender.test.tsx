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

function renderStage(
  parts: CharacterPart[],
  frame = 0,
  tracksOverride?: Track[],
  appMode: 'edit' | 'broadcast' = 'edit',
  projectResolution?: { width: number; height: number },
) {
  const tracks = tracksOverride ?? parts.map((p) => makeTrack(p.id));
  return renderToString(
    <StagePartLayers
      sortedParts={parts}
      appMode={appMode}
      broadcastState={{}}
      broadcastSessionActivated={appMode === 'broadcast'}
      projectResolution={projectResolution}
      currentFrame={frame}
      selectedPartId={null}
      totalFrames={60}
      onSelect={() => {}}
      onStartTranslateDrag={() => {}}
      tracks={tracks}
      customPresets={[]}
      liveStuntsState={{}}
    />,
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

  it('clip + inverted uses the existing alpha hole mask instead of a no-op clipPath', () => {
    const source = makePart('src', 'custom_box');
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'clip', inverted: true });
    const html = renderStage([source, target]);

    expect(html).toContain('<mask id="kcs-mask-src-alpha-inv"');
    expect(html).toContain('x="-660"');
    expect(html).toContain('y="-300"');
    expect(html).toContain('width="1920"');
    expect(html).toContain('height="1080"');
    expect(html).toContain('mask-type="alpha"');
    expect(html).toContain('fill-rule="evenodd"');
    expect(html).toContain('mask="url(#kcs-mask-src-alpha-inv)"');
    expect(html).not.toContain('clip-path="url(#kcs-clip-src)"');
    expect(html).not.toContain('<clipPath id="kcs-clip-src"');
  });

  it('uses the supplied project resolution center for broadcast matte output', () => {
    const source = makePart('src', 'custom_box');
    source.baseTransform = { x: 40, y: -20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    const target = makePart('tgt', 'custom_circle', { sourcePartId: 'src', mode: 'clip' });
    const expected = buildMatteClipPath(
      source,
      source.baseTransform,
      { x: 640, y: 360 },
    );
    const html = renderStage([source, target], 0, undefined, 'broadcast', { width: 1280, height: 720 });

    expect(expected).not.toBeNull();
    expect(html).toContain(`d="${expected!.pathD}"`);
  });

  it('applies explicit project coverage to Alpha and Luminance masks', () => {
    const source = makePart('src', 'custom_box');
    for (const mode of ['alpha', 'luminance'] as const) {
      const target = makePart('tgt', 'custom_text', { sourcePartId: 'src', mode });
      const html = renderStage([source, target]);

      expect(html).toContain(`<mask id="kcs-mask-src-${mode}" x="-660" y="-300" width="1920" height="1080"`);
      expect(html).toContain('maskUnits="userSpaceOnUse"');
      expect(html).toContain('maskContentUnits="userSpaceOnUse"');
    }
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

describe('StagePartLayers — M16 matte strength (fill-opacity)', () => {
  const src = () => makePart('src', 'custom_box');
  const target = (matte: CharacterPart['matte']) => makePart('tgt', 'custom_circle', matte);

  it('strength undefined → NO fill-opacity attribute (legacy DOM byte-for-byte)', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha' })]);
    expect(html).toContain('<mask id="kcs-mask-src-alpha"');
    expect(html).not.toContain('fill-opacity');
  });

  it('strength 1 → canonical: NO fill-opacity attribute, legacy mask id', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha', strength: 1 })]);
    expect(html).toContain('<mask id="kcs-mask-src-alpha"');
    expect(html).not.toContain('fill-opacity');
  });

  it('strength 0.5 → mask path carries fill-opacity="0.5" + -s0.5 id', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha', strength: 0.5 })]);
    expect(html).toContain('<mask id="kcs-mask-src-alpha-s0.5"');
    expect(html).toContain('fill-opacity="0.5"');
  });

  it('strength 0 → fill-opacity="0" + -s0 id (valid: matte disabled)', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha', strength: 0 })]);
    expect(html).toContain('<mask id="kcs-mask-src-alpha-s0"');
    expect(html).toContain('fill-opacity="0"');
  });

  it('inverted alpha + strength 0.5 → evenodd structure preserved + fill-opacity', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha', inverted: true, strength: 0.5 })]);
    expect(html).toContain('id="kcs-mask-src-alpha-inv-s0.5"');
    expect(html).toContain('fill-rule="evenodd"');
    expect(html).toContain('fill-opacity="0.5"');
  });

  it('luminance inverted + strength 0.5 → white region + black path both carry fill-opacity', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'luminance', inverted: true, strength: 0.5 })]);
    expect(html).toContain('id="kcs-mask-src-luminance-inv-s0.5"');
    expect(html).toContain('<rect');
    expect(html.match(/fill-opacity="0\.5"/g)).toHaveLength(2); // rect + black path
  });

  it('feather 12 + strength 0.5 → filter preserved + fill-opacity + -f12-s0.5 id', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha', feather: 12, strength: 0.5 })]);
    expect(html).toContain('id="kcs-mask-src-alpha-f12-s0.5"');
    expect(html).toContain('feGaussianBlur');
    expect(html).toContain('stdDeviation="6"'); // feather NOT multiplied by strength
    expect(html).toContain('fill-opacity="0.5"');
  });

  it('clip mode + strength 0.5 → strength NOT applied to clipPath (no fill-opacity)', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'clip', strength: 0.5 })]);
    expect(html).toContain('<clipPath id="kcs-clip-src"');
    expect(html).not.toContain('fill-opacity');
  });

  it('dedupe: same (source, mode, strength) across targets → ONE mask; different strengths → distinct ids', () => {
    const html = renderStage([
      src(),
      makePart('tA', 'custom_circle', { sourcePartId: 'src', mode: 'alpha', strength: 0.5 }),
      makePart('tB', 'custom_circle', { sourcePartId: 'src', mode: 'alpha', strength: 0.5 }),
      makePart('tC', 'custom_circle', { sourcePartId: 'src', mode: 'alpha' }),
    ]);
    expect(html.match(/<mask id="kcs-mask-src-alpha-s0.5"/g)).toHaveLength(1); // deduped
    expect(html.match(/<mask id="kcs-mask-src-alpha"/g)).toHaveLength(1);      // canonical separate
    expect(html.match(/mask="url\(#kcs-mask-src-alpha-s0\.5\)"/g)).toHaveLength(2); // 2 targets share it
  });
});

describe('StagePartLayers — M17 gradient matte (linearGradient render)', () => {
  const src = () => makePart('src', 'custom_box');
  const target = (matte: CharacterPart['matte']) => makePart('tgt', 'custom_circle', matte);

  it('alpha gradient → one userSpaceOnUse linearGradient, two stops, mask path fill=url(...)', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } })]);
    expect(html).toContain('<linearGradient');
    expect(html).toContain('gradientUnits="userSpaceOnUse"');
    expect(html).toContain('id="kcs-mg-src-45-alpha"');
    expect(html.match(/<stop /g)).toHaveLength(2);
    expect(html).toContain('stop-color="white" stop-opacity="1"');
    expect(html).toContain('stop-color="white" stop-opacity="0"');
    expect(html).toContain('<mask id="kcs-mask-src-alpha-g45"');
    expect(html).toContain('fill="url(#kcs-mg-src-45-alpha)"');
  });

  it('luminance gradient → white→black stops, mask-type luminance preserved', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'luminance', gradient: { angle: 45 } })]);
    expect(html).toContain('id="kcs-mg-src-45-luminance"');
    expect(html).toContain('stop-color="white" stop-opacity="1"');
    expect(html).toContain('stop-color="black" stop-opacity="1"');
    expect(html).toContain('mask-type="luminance"');
    expect(html).toContain('fill="url(#kcs-mg-src-45-luminance)"');
  });

  it('inverted alpha + gradient → ONE evenodd path with gradient fill', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha', inverted: true, gradient: { angle: 45 } })]);
    expect(html).toContain('id="kcs-mask-src-alpha-inv-g45"');
    expect(html.match(/fill-rule="evenodd"/g)).toHaveLength(1); // single path
    expect(html).toContain('fill="url(#kcs-mg-src-45-alpha)"');
  });

  it('inverted luminance + gradient → gradient rect + black contour preserved', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'luminance', inverted: true, gradient: { angle: 45 } })]);
    expect(html).toContain('id="kcs-mask-src-luminance-inv-g45"');
    expect(html).toContain('<rect'); // white-region rect keeps its role
    expect(html).toContain('fill="url(#kcs-mg-src-45-luminance)"');
    expect(html).toContain('fill="black"'); // contour path unchanged
  });

  it('clip mode → NO gradient, NO fill=url (clipPath is geometric only)', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'clip', gradient: { angle: 45 } })]);
    expect(html).toContain('<clipPath id="kcs-clip-src"');
    expect(html).not.toContain('linearGradient');
    expect(html).not.toContain('fill="url(');
  });

  it('feather + gradient → filter + stdDeviation unchanged + gradient fill', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha', feather: 12, gradient: { angle: 45 } })]);
    expect(html).toContain('id="kcs-mask-src-alpha-f12-g45"');
    expect(html).toContain('feGaussianBlur');
    expect(html).toContain('stdDeviation="6"'); // feather math untouched by gradient
    expect(html).toContain('fill="url(#kcs-mg-src-45-alpha)"');
  });

  it('strength + gradient → fill-opacity independent + gradient fill + -s suffix', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha', strength: 0.5, gradient: { angle: 45 } })]);
    expect(html).toContain('id="kcs-mask-src-alpha-s0.5-g45"');
    expect(html).toContain('fill-opacity="0.5"');
    expect(html).toContain('fill="url(#kcs-mg-src-45-alpha)"');
  });

  it('freeform + gradient → pathD unchanged (same as clip geometry), gradient fill', () => {
    const source = makePart('src', 'custom_freeform');
    source.points = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 }];
    const html = renderStage([source, target({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 0 } })]);
    // The freeform world pathD is the SAME one the clip produces — gradient is paint only
    const maskD = html.match(/<mask id="kcs-mask-src-alpha-g0"[\s\S]*?<path d="([^"]+)"/)?.[1];
    expect(maskD).toBe('M 300 240 L 360 240 L 300 270 Z');
    expect(html).toContain('fill="url(#kcs-mg-src-0-alpha)"');
  });

  it('dedupe: same source+angle → ONE gradient def; different angle → separate defs', () => {
    const html = renderStage([
      src(),
      makePart('tA', 'custom_circle', { sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } }),
      makePart('tB', 'custom_circle', { sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } }),
      makePart('tC', 'custom_circle', { sourcePartId: 'src', mode: 'alpha', gradient: { angle: 90 } }),
    ]);
    expect(html.match(/<linearGradient id="kcs-mg-src-45-alpha"/g)).toHaveLength(1); // shared
    expect(html.match(/<linearGradient id="kcs-mg-src-90-alpha"/g)).toHaveLength(1); // separate
    expect(html.match(/mask="url\(#kcs-mask-src-alpha-g45\)"/g)).toHaveLength(2);    // 2 targets share the mask
  });

  it('legacy: gradient undefined → NO gradient def, NO fill=url, canonical mask id', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha' })]);
    expect(html).not.toContain('linearGradient');
    expect(html).not.toContain('fill="url(');
    expect(html).toContain('<mask id="kcs-mask-src-alpha"');
  });

  it('M19: 3-stop render — def carries normalized offsets/colors/opacities in order', () => {
    const stops = [
      { offset: 0, color: '#ff0000', opacity: 1 },
      { offset: 0.5, color: '#00ff00', opacity: 0.5 },
      { offset: 1, color: '#0000ff', opacity: 1 },
    ];
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops } })]);
    const grad = html.match(/<linearGradient id="([^"]+)"[^>]*>([\s\S]*?)<\/linearGradient>/);
    expect(grad).not.toBeNull();
    expect(grad![1]).toMatch(/^kcs-mg-src-45-s[0-9a-f]{8}-alpha$/);
    const stopsHtml = grad![2].match(/<stop[^>]*>/g) ?? [];
    expect(stopsHtml).toHaveLength(3);
    expect(stopsHtml[0]).toContain('offset="0%"');
    expect(stopsHtml[0]).toContain('stop-color="#ff0000"');
    expect(stopsHtml[0]).toContain('stop-opacity="1"');
    expect(stopsHtml[1]).toContain('offset="50%"');
    expect(stopsHtml[1]).toContain('stop-color="#00ff00"');
    expect(stopsHtml[1]).toContain('stop-opacity="0.5"');
    expect(stopsHtml[2]).toContain('offset="100%"');
    expect(stopsHtml[2]).toContain('stop-color="#0000ff"');
  });

  it('M19: 4-stop render + normalized ordering (unsorted input → sorted output)', () => {
    const stops = [
      { offset: 1, color: 'black', opacity: 1 },
      { offset: 0, color: 'white', opacity: 1 },
      { offset: 0.66, color: 'gray', opacity: 0.4 },
      { offset: 0.33, color: 'silver', opacity: 0.8 },
    ];
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'luminance', gradient: { angle: 0, stops } })]);
    const grad = html.match(/<linearGradient id="([^"]+)"[^>]*>([\s\S]*?)<\/linearGradient>/);
    const offsets = (grad![2].match(/offset="([^"]+)"/g) ?? []).map((s) => s);
    expect(offsets).toEqual(['offset="0%"', 'offset="33%"', 'offset="66%"', 'offset="100%"']);
    expect(grad![1]).toMatch(/^kcs-mg-src-0-s[0-9a-f]{8}-luminance$/);
  });

  it('M19: same source+angle+normalized stops → ONE def (dedupe)', () => {
    const stops = [
      { offset: 0.5, color: 'white', opacity: 1 },
      { offset: 0, color: 'white', opacity: 1 },
      { offset: 1, color: 'white', opacity: 0 },
    ];
    const html = renderStage([
      src(),
      target({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops } }),
      makePart('t2', 'custom_circle', { sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops: [...stops].reverse() } }),
    ]);
    expect(html.match(/<linearGradient id="kcs-mg-src-45/g) ?? []).toHaveLength(1);
    expect(html.match(/<mask id="kcs-mask-src-alpha-g45/g) ?? []).toHaveLength(1);
  });

  it('M19: DIFFERENT stops on the same source+angle → DIFFERENT defs + DIFFERENT masks (no collision)', () => {
    const a = [
      { offset: 0, color: 'white', opacity: 1 },
      { offset: 1, color: 'white', opacity: 0 },
    ];
    const b = [
      { offset: 0, color: 'red', opacity: 1 },
      { offset: 1, color: 'blue', opacity: 1 },
    ];
    const html = renderStage([
      src(),
      target({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops: a } }),
      makePart('t2', 'custom_circle', { sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops: b } }),
    ]);
    const grads = html.match(/<linearGradient id="(kcs-mg-src-45-s[0-9a-f]{8}-alpha)"/g) ?? [];
    expect(grads).toHaveLength(2);
    expect(grads[0]).not.toBe(grads[1]);
    const masks = html.match(/<mask id="(kcs-mask-src-alpha-g45-s[0-9a-f]{8})"/g) ?? [];
    expect(masks).toHaveLength(2);
    expect(masks[0]).not.toBe(masks[1]);
    // each mask references its OWN def
    expect(html).toContain(`fill="url(#${grads[0].match(/id="([^"]+)"/)![1]})"`);
    expect(html).toContain(`fill="url(#${grads[1].match(/id="([^"]+)"/)![1]})"`);
  });

  it('M19: legacy gradient id unchanged — NO -s suffix, 2 default stops', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } })]);
    expect(html).toContain('<linearGradient id="kcs-mg-src-45-alpha"');
    expect(html).toContain('<mask id="kcs-mask-src-alpha-g45"');
    const grad = html.match(/<linearGradient id="kcs-mg-src-45-alpha"[^>]*>([\s\S]*?)<\/linearGradient>/);
    const stopsHtml = grad![1].match(/<stop[^>]*>/g) ?? [];
    expect(stopsHtml).toHaveLength(2);
    expect(stopsHtml[0]).toContain('offset="0%"');
    expect(stopsHtml[1]).toContain('offset="100%"');
  });

  it('M19: text matte + multi-stop — hashed def id + text fill=url (local endpoints intact)', () => {
    const stops = [
      { offset: 0, color: 'white', opacity: 1 },
      { offset: 0.5, color: 'white', opacity: 0.5 },
      { offset: 1, color: 'white', opacity: 0 },
    ];
    const text = makePart('txt', 'custom_text', { textValue: 'HHH', fontSize: 80, fontFamily: 'Arial' });
    const html = renderStage([text, target({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops } })]);
    const grad = html.match(/<linearGradient id="([^"]+)"[^>]*>([\s\S]*?)<\/linearGradient>/);
    expect(grad![1]).toMatch(/^kcs-mg-txt-0-s[0-9a-f]{8}-alpha$/);
    expect(html).toContain(`fill="url(#${grad![1]})"`);
    expect(html).toContain(`x1="-100"`); // M18 local endpoints preserved
  });

  it('M19: inverted TEXT + multi-stop → luminance structure def (structure key -luminance-inv, WORLD endpoints)', () => {
    const stops = [
      { offset: 0, color: 'white', opacity: 1 },
      { offset: 1, color: 'black', opacity: 1 },
    ];
    const text = makePart('txt', 'custom_text', { textValue: 'HHH', fontSize: 80, fontFamily: 'Arial' });
    const html = renderStage([text, target({ sourcePartId: 'txt', mode: 'alpha', inverted: true, gradient: { angle: 0, stops } })]);
    expect(html).toContain('mask-type="luminance"'); // 4A inverted-text structure
    expect(html).toContain('<linearGradient id="kcs-mg-txt-0-s'); // hashed
    // 5E blocker fix: inverted-text def uses WORLD endpoints (the region rect
    // is world-space; the black text never references the def) + a distinct
    // -luminance-inv identity (never collides with a local non-inverted def).
    expect(html).toMatch(/<linearGradient id="kcs-mg-txt-0-s[0-9a-f]{8}-luminance-inv"/);
    expect(html).toContain('x1="200"'); // WORLD endpoints: text box ±100 → applyWorld (identity) → 200..400
    expect(html).toContain('x2="400"');
    expect(html).toContain('fill="black"'); // the text stays PLAIN BLACK (never url()) — 4A contract
  });

  it('M19: feather + multi-stop → mask id carries -f AND -g+s suffixes; filter bound', () => {
    const stops = [
      { offset: 0, color: 'white', opacity: 1 },
      { offset: 1, color: 'white', opacity: 0 },
    ];
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha', feather: 12, gradient: { angle: 45, stops } })]);
    expect(html).toMatch(/<mask id="kcs-mask-src-alpha-f12-g45-s[0-9a-f]{8}"/);
    expect(html).toContain('kcs-matte-feather-src-alpha-f12-g45-s');
    expect(html).toContain('stdDeviation="6"');
  });

  it('M19: strength + multi-stop → mask id carries -s{strength} AND -g…-s{stopsHash}; fill-opacity applied', () => {
    const stops = [
      { offset: 0, color: 'white', opacity: 1 },
      { offset: 1, color: 'white', opacity: 0 },
    ];
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha', strength: 0.5, gradient: { angle: 45, stops } })]);
    expect(html).toMatch(/<mask id="kcs-mask-src-alpha-s0\.5-g45-s[0-9a-f]{8}"/);
    expect(html).toContain('fill-opacity="0.5"');
  });

  it('M19: malformed stops → deterministic default stops (id stable, def has 2 default stops)', () => {
    const html = renderStage([src(), target({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops: [] as never } })]);
    const grad = html.match(/<linearGradient id="([^"]+)"[^>]*>([\s\S]*?)<\/linearGradient>/);
    expect(grad![1]).toMatch(/^kcs-mg-src-45-s[0-9a-f]{8}-alpha$/);
    const stopsHtml = grad![2].match(/<stop[^>]*>/g) ?? [];
    expect(stopsHtml).toHaveLength(2);
    expect(stopsHtml[0]).toContain('stop-color="white"');
    expect(stopsHtml[0]).toContain('stop-opacity="1"');
    expect(stopsHtml[1]).toContain('stop-opacity="0"');
  });
});

describe('StagePartLayers — M18 text matte render (mask content <text>)', () => {
  const textSource = (overrides: Record<string, unknown> = {}) => {
    const p = makePart('txt', 'custom_text');
    return { ...p, textValue: 'HELLO', fontSize: 48, fontFamily: 'Arial', ...overrides } as CharacterPart;
  };
  const target = (matte: CharacterPart['matte']) => makePart('tgt', 'custom_circle', matte);

  it('A. basic text alpha: <text> mask content with renderer-parity attrs + transform bake', () => {
    const html = renderStage([textSource(), target({ sourcePartId: 'txt', mode: 'alpha' })]);
    expect(html).toContain('<mask id="kcs-mask-txt-alpha"');
    expect(html).toContain('mask-type="alpha"');
    expect(html).toContain('>HELLO</text>');                    // content from source at runtime
    expect(html).toContain('font-size="48"');
    expect(html).toContain('font-weight="bold"');
    expect(html).toContain('font-family="Arial"');
    expect(html).toContain('x="0"');
    expect(html).toContain('y="0"');
    expect(html).toContain('text-anchor="middle"');
    expect(html).toContain('dominant-baseline="middle"');
    expect(html).toContain('fill="white"');
    // transform bake = renderer inner-g math (identity world → canvas center)
    expect(html).toContain('translate(300, 240) rotate(0) scale(1, 1)');
    // NO path geometry — the mask content is the text element only
    expect(html).not.toContain('<path d="M 270');
  });

  it('B. text luminance: mask-type luminance + white text', () => {
    const html = renderStage([textSource(), target({ sourcePartId: 'txt', mode: 'luminance' })]);
    expect(html).toContain('<mask id="kcs-mask-txt-luminance"');
    expect(html).toContain('mask-type="luminance"');
    expect(html).toContain('fill="white"');
    expect(html).toContain('>HELLO</text>');
  });

  it('C. inverted text → luminance structure: mask-type luminance + white rect + black text (4A decision)', () => {
    const html = renderStage([textSource(), target({ sourcePartId: 'txt', mode: 'alpha', inverted: true })]);
    expect(html).toContain('<mask id="kcs-mask-txt-alpha-inv"');
    expect(html).toContain('mask-type="luminance"'); // alpha mode falls back to luminance structure
    expect(html).toContain('<rect ');                // white region rect
    expect(html).toContain('fill="black"');          // black text punches the hole
    expect(html).toContain('>HELLO</text>');
  });

  it('D. gradient: text fill=url(#kcs-mg-...) with LOCAL endpoints (default box ±100)', () => {
    const html = renderStage([textSource(), target({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0 } })]);
    expect(html).toContain('<linearGradient id="kcs-mg-txt-0-alpha"');
    expect(html).toContain('gradientUnits="userSpaceOnUse"');
    expect(html).toContain('fill="url(#kcs-mg-txt-0-alpha)"');
    // LOCAL endpoints: identity world → default text box ±100 (4A: text-local space)
    expect(html).toContain('x1="-100"');
    expect(html).toContain('x2="100"');
    expect(html).toContain('y1="0"');
  });

  it('E. feather: existing M14 filter bound to the text content', () => {
    const html = renderStage([textSource(), target({ sourcePartId: 'txt', mode: 'alpha', feather: 12 })]);
    expect(html).toContain('<mask id="kcs-mask-txt-alpha-f12"');
    expect(html).toContain('filter="url(#kcs-matte-feather-txt-alpha-f12)"');
    expect(html).toContain('stdDeviation="6"'); // M14 math untouched
  });

  it('F. strength: fill-opacity on the text (independent render param)', () => {
    const html = renderStage([textSource(), target({ sourcePartId: 'txt', mode: 'alpha', strength: 0.5 })]);
    expect(html).toContain('<mask id="kcs-mask-txt-alpha-s0.5"');
    expect(html).toContain('fill-opacity="0.5"');
  });

  it('G. transform bake: evaluated world (translate/rotate/scale) lands in the <g>', () => {
    const src = textSource({ baseTransform: { x: 40, y: -10, rotation: 90, scaleX: 2, scaleY: 3, opacity: 1 } });
    const html = renderStage([src, target({ sourcePartId: 'txt', mode: 'alpha' })]);
    expect(html).toContain('translate(340, 230) rotate(90) scale(2, 3)');
  });

  it('H. dedupe: two targets + same text source → ONE mask def, two references', () => {
    const html = renderStage([
      textSource(),
      makePart('tA', 'custom_circle', { sourcePartId: 'txt', mode: 'alpha' }),
      makePart('tB', 'custom_circle', { sourcePartId: 'txt', mode: 'alpha' }),
    ]);
    expect(html.match(/<mask id="kcs-mask-txt-alpha"/g)).toHaveLength(1);
    expect(html.match(/mask="url\(#kcs-mask-txt-alpha\)"/g)).toHaveLength(2);
    expect(html).toContain('>HELLO</text>'); // single content, still read from source
  });

  it('I. clip + text source → NO clipPath, NO mask (buildMattePath stays null)', () => {
    const html = renderStage([textSource(), target({ sourcePartId: 'txt', mode: 'clip' })]);
    expect(html).not.toContain('<clipPath');
    expect(html).not.toContain('clip-path=');
    expect(html).not.toContain('<mask id="kcs-mask'); // text clip unsupported → nothing applied
  });

  it('J. textValue change re-renders the mask content (no stale copy in the mask model)', () => {
    const a = renderStage([textSource({ textValue: 'ALPHA' }), target({ sourcePartId: 'txt', mode: 'alpha' })]);
    const b = renderStage([textSource({ textValue: 'BETA' }), target({ sourcePartId: 'txt', mode: 'alpha' })]);
    expect(a).toContain('>ALPHA</text>');
    expect(b).toContain('>BETA</text>');
    expect(a).not.toContain('>BETA</text>');
    expect(b).not.toContain('>ALPHA</text>');
  });
});

describe('StagePartLayers — M20 radial gradient render', () => {
  const star = () => makePart('src', 'custom_star');
  const target = (matte: CharacterPart['matte']) => makePart('tgt', 'custom_circle', matte);
  const textSource = () => ({ ...makePart('txt', 'custom_text'), textValue: 'HHH', fontSize: 80, fontFamily: 'Arial' } as CharacterPart);
  const stopStr = (s: { offset: number; color: string; opacity: number }) =>
    `<stop offset="${s.offset * 100}%" stop-color="${s.color}" stop-opacity="${s.opacity}"></stop>`;
  const stops2 = [
    { offset: 0, color: 'white', opacity: 1 },
    { offset: 1, color: 'white', opacity: 0 },
  ];

  it('1-4. radial shape: <radialGradient> with userSpaceOnUse + world cx/cy/r + stops', () => {
    const html = renderStage([star(), target({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: stops2 } })]);
    expect(html).toContain('<radialGradient');
    expect(html).toContain('gradientUnits="userSpaceOnUse"');
    expect(html).toContain('cx="300"'); // star local bounds center → world (identity)
    expect(html).toContain('cy="237.5"'); // star bbox y: -35..30 → center -2.5 → world 237.5
    expect(html).toMatch(/r="[0-9.]+"/); // deterministic radius
    expect(html).toContain(stopStr(stops2[0]));
    expect(html).toContain(stopStr(stops2[1]));
    expect(html).not.toContain('x1='); // no linear fields on a radial def
  });

  it('5-6. legacy linear unchanged: <linearGradient> + byte-for-byte id', () => {
    const html = renderStage([star(), target({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } })]);
    expect(html).toContain('<linearGradient');
    expect(html).toContain('id="kcs-mg-src-45-alpha"');
    expect(html).not.toContain('<radialGradient');
    expect(html).toContain('x1=');
  });

  it('7. radial id carries the -radial discriminator + stops hash', () => {
    const html = renderStage([star(), target({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: stops2 } })]);
    expect(html).toMatch(/id="kcs-mg-src-radial-s[0-9a-f]{8}-alpha"/);
  });

  it('8-9. dedupe: same radial def once; different stops → different defs', () => {
    const a = renderStage([
      star(),
      target({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: stops2 } }),
      makePart('tgt2', 'custom_rect', { sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: stops2 } }),
    ]);
    expect((a.match(/<radialGradient/g) ?? []).length).toBe(1); // same identity → 1 def
    const b = renderStage([
      star(),
      target({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: stops2 } }),
      makePart('tgt2', 'custom_rect', { sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: [{ offset: 0, color: 'white', opacity: 0.2 }, { offset: 1, color: 'white', opacity: 1 }] } }),
    ]);
    expect((b.match(/<radialGradient/g) ?? []).length).toBe(2); // different stops → 2 defs
  });

  it('10. linear vs radial on the same source never collide', () => {
    const html = renderStage([
      star(),
      target({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } }),
      makePart('tgt2', 'custom_rect', { sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: stops2 } }),
    ]);
    expect(html).toContain('<linearGradient');
    expect(html).toContain('<radialGradient');
    expect((html.match(/<linearGradient/g) ?? []).length).toBe(1);
    expect((html.match(/<radialGradient/g) ?? []).length).toBe(1);
  });

  it('11. radial + feather: mask id carries -radial + -f; filter bound', () => {
    const html = renderStage([star(), target({ sourcePartId: 'src', mode: 'alpha', feather: 12, gradient: { type: 'radial', stops: stops2 } })]);
    expect(html).toMatch(/id="kcs-mask-src-alpha-f12-radial-s[0-9a-f]{8}"/);
    expect(html).toContain('stdDeviation="6"');
    expect(html).toContain('filter="url(#kcs-matte-feather');
  });

  it('12. radial + strength: fill-opacity preserved', () => {
    const html = renderStage([star(), target({ sourcePartId: 'src', mode: 'alpha', strength: 0.5, gradient: { type: 'radial', stops: stops2 } })]);
    expect(html).toMatch(/id="kcs-mask-src-alpha-s0.5-radial-s[0-9a-f]{8}"/);
    expect(html).toContain('fill-opacity="0.5"');
  });

  it('13. radial + inverted luminance: rect consumes the world radial; black contour stays', () => {
    const html = renderStage([star(), target({ sourcePartId: 'src', mode: 'luminance', inverted: true, gradient: { type: 'radial', stops: stops2 } })]);
    expect(html).toMatch(/id="kcs-mg-src-radial-s[0-9a-f]{8}-luminance"/);
    expect(html).toContain('mask-type="luminance"');
    expect(html).toContain('fill="black"'); // contour stays black
    expect(html).toContain('cx="300"'); // WORLD geometry on the region rect
  });

  it('14. radial + freeform: pathD untouched, radial paint only', () => {
    const points = [{ x: -60, y: -40 }, { x: 60, y: -40 }, { x: 0, y: 70 }];
    const ff = { ...makePart('ff', 'custom_freeform'), points } as CharacterPart;
    const withGrad = renderStage([ff, target({ sourcePartId: 'ff', mode: 'alpha', gradient: { type: 'radial', stops: stops2 } })]);
    const noGrad = renderStage([ff, target({ sourcePartId: 'ff', mode: 'alpha' })]);
    // buildMattePath output is byte-for-byte identical with/without the gradient
    const dWith = withGrad.match(/<path d="([^"]+)"/)?.[1];
    const dNo = noGrad.match(/<path d="([^"]+)"/)?.[1];
    expect(dWith).toBe(dNo);
    expect(withGrad).toContain('<radialGradient');
  });

  it('15. non-inverted TEXT → LOCAL radial geometry (cx=0 cy=0, local box radius)', () => {
    const html = renderStage([textSource(), target({ sourcePartId: 'txt', mode: 'alpha', gradient: { type: 'radial', stops: stops2 } })]);
    expect(html).toMatch(/id="kcs-mg-txt-radial-s[0-9a-f]{8}-alpha"/);
    expect(html).toContain('cx="0"'); // LOCAL center
    expect(html).toContain('cy="0"');
    expect(html).toMatch(/r="104\.40[0-9]*"/); // sqrt(200²+60²)/2
    // the text element consumes the def
    expect(html).toContain('fill="url(#kcs-mg-txt-radial');
  });

  it('16-17. inverted TEXT → WORLD radial on the region rect; text stays BLACK', () => {
    const html = renderStage([textSource(), target({ sourcePartId: 'txt', mode: 'alpha', inverted: true, gradient: { type: 'radial', stops: stops2 } })]);
    expect(html).toMatch(/id="kcs-mg-txt-radial-s[0-9a-f]{8}-luminance-inv"/);
    expect(html).toContain('cx="300"'); // WORLD center
    expect(html).toContain('cy="240"');
    expect(html).toContain('fill="black"'); // text NEVER consumes the gradient
  });

  it('18. animated source: radial center follows the evaluated transform (frame 0 vs frame 40)', () => {
    const src = star();
    const tgt = target({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: stops2 } });
    const animTrack = {
      id: 't_src', partId: 'src', name: 'T', color: '#f00', visible: true,
      keyframes: [],
      channels: { ...makeEmptyChannels(), x: [
        { id: 'x0', frame: 0, value: 0, easing: 'linear' },
        { id: 'x40', frame: 40, value: 200, easing: 'linear' },
      ] },
    } as unknown as Track;
    const f0 = renderStage([src, tgt], 0, [animTrack]);
    const f40 = renderStage([src, tgt], 40, [animTrack]);
    const cx0 = f0.match(/<radialGradient[\s\S]*?cx="([\d.-]+)"/)?.[1];
    const cx40 = f40.match(/<radialGradient[\s\S]*?cx="([\d.-]+)"/)?.[1];
    expect(cx0).toBe('300');
    expect(cx40).not.toBe(cx0); // center moved with the animated source
  });

  it('19-20. mask suffix matches the gradient identity; no duplicate defs', () => {
    const html = renderStage([star(), target({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: stops2 } })]);
    const defId = html.match(/<radialGradient id="([^"]+)"/)![1];
    const maskId = html.match(/<mask id="([^"]+)"/)![1];
    expect(maskId).toBe('kcs-mask-src-alpha-radial-s37c8dd2b'); // radial mask discriminator
    expect(html).toContain(`fill="url(#${defId})"`); // the MASK CONTENT consumes the radial def
    expect(html).toContain(`mask="url(#${maskId})"`); // the TARGET consumes the mask
    expect((html.match(/<radialGradient/g) ?? []).length).toBe(1);
    expect((html.match(new RegExp(defId, 'g')) ?? []).length).toBe(2); // def + 1 fill reference (no duplicates)
  });
});

describe('StagePartLayers — M21 image matte render', () => {
  const imageSource = (overrides: Record<string, unknown> = {}) =>
    ({ ...makePart('img', 'custom_image'), imageUrl: 'https://example.com/logo.png', width: 200, height: 150, ...overrides }) as CharacterPart;
  const imageTarget = (matte: CharacterPart['matte']) =>
    makePart('tgt', 'custom_box', matte);
  const stops2 = [
    { offset: 0, color: 'white', opacity: 1 },
    { offset: 1, color: 'white', opacity: 0 },
  ];

  it('1. image + alpha: <image> in the mask, no pathD, real href', () => {
    const html = renderStage([imageSource(), imageTarget({ sourcePartId: 'img', mode: 'alpha' })]);
    expect(html).toContain('<image');
    expect(html).toContain('href="https://example.com/logo.png"');
    expect(html).not.toContain('<path'); // no geometry path for image
    expect(html).toContain('mask="url(#kcs-mask-img-alpha)"');
  });

  it('2. image + luminance: mask-type luminance', () => {
    const html = renderStage([imageSource(), imageTarget({ sourcePartId: 'img', mode: 'luminance' })]);
    expect(html).toContain('mask-type="luminance"');
    expect(html).toContain('<image');
  });

  it('3. image + inverted: luminance structure + real image, fill NEVER black', () => {
    const html = renderStage([imageSource(), imageTarget({ sourcePartId: 'img', mode: 'alpha', inverted: true })]);
    expect(html).toContain('mask-type="luminance"'); // inverted image → luminance semantics (7A)
    expect(html).toContain('<image'); // the real image IS the content
    expect(html).not.toContain('fill="black"'); // image is NEVER repainted black
    const img = html.match(/<image[^>]*fill="black"/);
    expect(img).toBeNull();
  });

  it('4. image + strength 0.5: opacity attr (NOT fill-opacity) — 7A contract', () => {
    const html = renderStage([imageSource(), imageTarget({ sourcePartId: 'img', mode: 'alpha', strength: 0.5 })]);
    expect(html).toContain('opacity="0.5"');
    expect(html).not.toContain('fill-opacity="0.5"'); // fill-opacity is INERT on <image>
  });

  it('5. image + feather: same filter pipeline', () => {
    const html = renderStage([imageSource(), imageTarget({ sourcePartId: 'img', mode: 'alpha', feather: 12 })]);
    expect(html).toContain('stdDeviation="6"');
    expect(html).toContain('filter="url(#kcs-matte-feather-img-alpha-f12)"');
  });

  it('6. image + LINEAR gradient: nested-mask multiplication (image mask wraps the gradient rect)', () => {
    const html = renderStage([imageSource(), imageTarget({ sourcePartId: 'img', mode: 'alpha', gradient: { angle: 0, stops: stops2 } })]);
    // nested content mask def exists and carries the image
    expect(html).toContain('id="kcs-mask-img-img"');
    expect(html).toContain('mask-type="alpha"'); // content mask = image alpha
    // the final mask wraps the gradient rect with the image alpha mask
    expect(html).toContain('mask="url(#kcs-mask-img-img)"');
    expect(html).toMatch(/fill="url\(#kcs-mg-img-0-s[0-9a-f]{8}-alpha\)"/);
    // the IMAGE element itself never consumes the gradient
    expect(html).not.toMatch(/<image[^>]*fill="url\(/);
  });

  it('7. image + RADIAL gradient: same nested composition with the radial def', () => {
    const html = renderStage([imageSource(), imageTarget({ sourcePartId: 'img', mode: 'alpha', gradient: { type: 'radial', stops: stops2 } })]);
    expect(html).toContain('<radialGradient');
    expect(html).toContain('id="kcs-mask-img-img"');
    expect(html).toMatch(/fill="url\(#kcs-mg-img-radial-s[0-9a-f]{8}-alpha\)"/);
  });

  it('8. image transform: content baked through the evaluated world transform', () => {
    const src = imageSource();
    src.baseTransform = { x: 100, y: 0, rotation: 45, scaleX: 2, scaleY: 1, opacity: 1 };
    const html = renderStage([src, imageTarget({ sourcePartId: 'img', mode: 'alpha' })]);
    expect(html).toContain('translate(400, 240) rotate(45) scale(2, 1)');
  });

  it('9. animated image source: content follows the evaluated transform (frame 0 vs frame 40)', () => {
    const src = imageSource();
    const tgt = imageTarget({ sourcePartId: 'img', mode: 'alpha' });
    const animTrack = {
      id: 't_img', partId: 'img', name: 'T', color: '#f00', visible: true,
      keyframes: [],
      channels: { ...makeEmptyChannels(), x: [
        { id: 'x0', frame: 0, value: 0, easing: 'linear' },
        { id: 'x40', frame: 40, value: 200, easing: 'linear' },
      ] },
    } as unknown as Track;
    const f0 = renderStage([src, tgt], 0, [animTrack]);
    const f40 = renderStage([src, tgt], 40, [animTrack]);
    expect(f0).toContain('translate(300, 240)');
    expect(f40).toContain('translate(500, 240)'); // moved with the animated source
  });

  it('10. dedupe: same image source + settings → ONE mask + ONE nested content mask', () => {
    const matte = { sourcePartId: 'img', mode: 'alpha', gradient: { angle: 0, stops: stops2 } };
    const html = renderStage([
      imageSource(),
      imageTarget(matte),
      makePart('tgt2', 'custom_box', matte),
    ]);
    expect((html.match(/id="kcs-mask-img-img"/g) ?? []).length).toBe(1); // one content mask
    expect((html.match(/id="kcs-mask-img-alpha-g0-s/g) ?? []).length).toBe(1); // one final mask
  });

  it('11. different image sources → separate mask identities', () => {
    const html = renderStage([
      imageSource(),
      imageTarget({ sourcePartId: 'img', mode: 'alpha' }),
      makePart('tgt2', 'custom_box', { sourcePartId: 'img2', mode: 'alpha' }),
      { ...makePart('img2', 'custom_image'), imageUrl: 'https://other.com/pic.png', width: 100, height: 80 } as CharacterPart,
    ]);
    expect(html).toContain('id="kcs-mask-img-alpha"');
    expect(html).toContain('id="kcs-mask-img2-alpha"');
    expect(html).toContain('href="https://other.com/pic.png"');
  });

  it('12. image + clip: NO clipPath generated (semantically unsupported)', () => {
    const html = renderStage([imageSource(), imageTarget({ sourcePartId: 'img', mode: 'clip' })]);
    expect(html).not.toContain('<clipPath'); // buildMatteClipPath(image) → null
    expect(html).not.toContain('clip-path=');
  });

  it('13. text regression: text mask content unchanged (local gradient + black inverted)', () => {
    const textSource = () => ({ ...makePart('txt', 'custom_text'), textValue: 'HHH', fontSize: 80, fontFamily: 'Arial' } as CharacterPart);
    const html = renderStage([textSource(), imageTarget({ sourcePartId: 'txt', mode: 'alpha', inverted: true, gradient: { type: 'radial', stops: stops2 } })]);
    expect(html).toContain('<text'); // text still renders as glyphs
    expect(html).toContain('fill="black"'); // inverted text keeps its black repaint (image does NOT)
  });

  it('14. freeform regression: freeform path mask unchanged', () => {
    const ff = { ...makePart('ff', 'custom_freeform'), points: [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 }] } as CharacterPart;
    const html = renderStage([ff, imageTarget({ sourcePartId: 'ff', mode: 'alpha' })]);
    expect(html).toContain('id="kcs-mask-ff-alpha"');
    expect(html).toContain('d="M 300 240 L 360 240 L 300 270 Z"');
    expect(html).not.toContain('<image');
  });
});
