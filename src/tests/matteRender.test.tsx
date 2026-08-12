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
    expect(html).toContain('<mask id="kcs-mask-src-alpha"'); // byte-for-byte legacy
    expect(html).toContain('fill="white"'); // solid mask fill unchanged
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
