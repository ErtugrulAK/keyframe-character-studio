import { describe, expect, it } from 'vitest';
import type { CharacterPart, ColorCorrectionEffect, LayerMask, Track } from '../types/animator';
import type { SceneData } from '../types/composition';
import {
  alphaMasks,
  colorCorrectionFilter,
  createColorCorrection,
  effectsValidationError,
  isNeutralCorrection,
  resetColorCorrection,
  resolveColorCorrection,
  sceneUsesEffectFeatures,
} from '../utils/layers/colorCorrection';
import { validateImportedDocument } from '../utils/persistence/importValidation';
import { validateSceneForOGraf } from '../ograf/validation';
import { validateGifScene } from '../export/gifPlan';
import { evaluateSceneFrame } from '../ograf/evaluation';
import { renderOGrafSvg } from '../ograf/svgRenderer';
import { cloneAnimationOntoTarget } from '../utils/animation/animationTransfer';

/**
 * WP-08 — mask-constrained colour correction: the resolution rules, the filter
 * numbers, the v3 boundary (import, OGraf, GIF), the SVG export renderer and
 * the animation-transfer guarantee.
 */

const square = (x0: number, x1: number): LayerMask['path'] => ({
  version: 1,
  coordinateSpace: 'normalized',
  closed: true,
  points: [{ id: 'a', x: x0, y: 0 }, { id: 'b', x: x1, y: 0 }, { id: 'c', x: x1, y: 1 }, { id: 'd', x: x0, y: 1 }],
});
const effectMask = (extra: Partial<LayerMask> = {}): LayerMask => ({ id: 'em', name: 'Effect Mask 1', mode: 'add', enabled: true, opacity: 1, feather: 0, expansion: 0, affectsAlpha: false, path: square(0, 0.5), ...extra });
const desaturate = (extra: Partial<ColorCorrectionEffect> = {}): ColorCorrectionEffect => ({ id: 'cc1', type: 'colorCorrection', enabled: true, amount: 1, brightness: 0, contrast: 1, saturation: 0, scope: 'mask', maskId: 'em', ...extra });

const imageLayer = (extra: Record<string, unknown> = {}) => ({
  id: 'photo', name: 'Photo', type: 'custom_image', imageUrl: 'data:image/png;base64,iVBORw0KGgo=', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#ffffff', strokeColor: '#000000', width: 200, height: 100, ...extra,
});
const scene = (layerExtra: Record<string, unknown> = {}, version: number = 3): SceneData => ({
  version, coordinateSystem: 'project-unit-center-v1', width: 640, height: 360, fps: 30, totalFrames: 30,
  layers: [imageLayer(layerExtra)],
  tracks: [{ partId: 'photo', channels: {} }],
} as unknown as SceneData);

describe('WP-08 resolution rules', () => {
  it('a mask scope applies only with an existing, enabled mask — never widened to the whole layer', () => {
    expect(resolveColorCorrection({ effects: [desaturate()] }, [effectMask()]).kind).toBe('applied');
    expect(resolveColorCorrection({ effects: [desaturate()] }, []).kind).toBe('missing-mask');
    expect(resolveColorCorrection({ effects: [desaturate()] }, [effectMask({ enabled: false })]).kind).toBe('disabled-mask');
    expect(resolveColorCorrection({ effects: [desaturate({ enabled: false })] }, [effectMask()]).kind).toBe('off');
    expect(resolveColorCorrection({ effects: [desaturate({ saturation: 1 })] }, [effectMask()]).kind).toBe('neutral');
    expect(resolveColorCorrection({ effects: [desaturate({ amount: 0 })] }, [effectMask()]).kind).toBe('neutral');
    expect(resolveColorCorrection({}, []).kind).toBe('none');
    expect(resolveColorCorrection({ effects: [desaturate({ scope: 'layer', maskId: undefined })] }, []).kind).toBe('applied');
  });

  it('neutral values are the identity filter; reset returns to neutral and keeps the scope', () => {
    const neutral = createColorCorrection('x');
    expect(isNeutralCorrection(neutral)).toBe(true);
    expect(colorCorrectionFilter(neutral)).toEqual({ slope: 1, intercept: 0, matrix: '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0' });
    const reset = resetColorCorrection(desaturate({ brightness: 0.3, contrast: 1.4 }));
    expect(isNeutralCorrection(reset)).toBe(true);
    expect(reset).toMatchObject({ scope: 'mask', maskId: 'em', enabled: true });
  });

  it('brightness then contrast is one linear map about 0.5; saturation 0 is Rec.709 luma', () => {
    const f = colorCorrectionFilter(desaturate({ brightness: 0.2, contrast: 1.5 }));
    expect(f.slope).toBe(1.5);
    expect(f.intercept).toBeCloseTo(1.5 * 0.2 + 0.5 * (1 - 1.5), 6);
    const rows = f.matrix.split(' ').map(Number);
    expect(rows.slice(0, 3)).toEqual([0.2126, 0.7152, 0.0722]);
    expect(rows.slice(5, 8)).toEqual([0.2126, 0.7152, 0.0722]);
    expect(rows.slice(15)).toEqual([0, 0, 0, 1, 0]); // alpha untouched
  });

  it('effect-only masks never take part in the alpha cut', () => {
    expect(alphaMasks([effectMask(), effectMask({ id: 'cut', affectsAlpha: undefined })]).map((mask) => mask.id)).toEqual(['cut']);
  });
});

describe('WP-08 v3 boundary', () => {
  it('only a scene that uses an effect or an effect-only mask needs version 3', () => {
    expect(sceneUsesEffectFeatures([{ masks: [effectMask({ affectsAlpha: undefined })] }])).toBe(false);
    expect(sceneUsesEffectFeatures([{ masks: [effectMask()] }])).toBe(true);
    expect(sceneUsesEffectFeatures([{ effects: [desaturate()] }])).toBe(true);
  });

  it('this build reads v1/v2/v3 and refuses a newer version', () => {
    expect(validateImportedDocument(JSON.stringify(scene({ masks: [effectMask()], effects: [desaturate()] }, 3))).ok).toBe(true);
    expect(validateImportedDocument(JSON.stringify(scene({}, 2))).ok).toBe(true);
    const newer = validateImportedDocument(JSON.stringify(scene({}, 4)));
    expect(newer.ok).toBe(false);
  });

  it('a malformed effect refuses the whole file', () => {
    const refusals = [
      { masks: [effectMask()], effects: [desaturate({ saturation: 5 })] },
      { masks: [effectMask()], effects: [desaturate({ maskId: undefined })] },
      { masks: [effectMask()], effects: [desaturate({ maskId: 'nope' })] },
      { masks: [effectMask()], effects: [{ ...desaturate(), type: 'blur' }] },
      { masks: [effectMask({ affectsAlpha: 'no' as unknown as boolean })] },
    ];
    for (const extra of refusals) expect(validateImportedDocument(JSON.stringify(scene(extra))).ok, JSON.stringify(extra)).toBe(false);
    expect(effectsValidationError([desaturate(), desaturate({ id: 'cc2' })], 'Photo', ['em'])).toMatch(/one colour correction/);
  });

  it('OGraf blocks colour correction and effect-only masks with a reason; GIF does not', () => {
    const doc = scene({ masks: [effectMask()], effects: [desaturate()] });
    const codes = validateSceneForOGraf(doc).diagnostics.filter((d) => d.severity === 'ERROR').map((d) => d.code);
    expect(codes).toEqual(expect.arrayContaining(['OGRAF_UNSUPPORTED_COLOR_CORRECTION', 'OGRAF_UNSUPPORTED_EFFECT_MASK']));
    expect(codes).not.toContain('OGRAF_INVALID_PROJECT');
    expect(validateGifScene(doc).map((d) => d.code)).not.toEqual(expect.arrayContaining(['OGRAF_UNSUPPORTED_COLOR_CORRECTION']));
  });
});

describe('WP-08 export SVG renderer (GIF frames)', () => {
  it('draws the corrected copy under the mask coverage and never cuts with the effect-only mask', () => {
    const svg = renderOGrafSvg(evaluateSceneFrame(scene({ masks: [effectMask()], effects: [desaturate()] }), 0));
    expect(svg).toContain('data-color-correction="applied"');
    expect(svg).toContain('mix-blend-mode:plus-lighter');
    expect(svg).toContain('kcs-cc-cover-photo-cc1');
    expect(svg).toContain('kcs-cc-inverse-photo-cc1');
    expect(svg).not.toContain('kcs-ograf-layer-mask-photo-em');
  });

  it('a missing or switched-off mask draws the image untouched (no correction markup)', () => {
    const disabled = renderOGrafSvg(evaluateSceneFrame(scene({ masks: [effectMask({ enabled: false })], effects: [desaturate()] }), 0));
    expect(disabled).not.toContain('data-color-correction');
    const neutral = renderOGrafSvg(evaluateSceneFrame(scene({ masks: [effectMask()], effects: [desaturate({ saturation: 1 })] }), 0));
    expect(neutral).not.toContain('data-color-correction');
  });
});

describe('WP-08 animation transfer keeps the target effects', () => {
  it('copies animation only: effects, masks and matte of the target stay deep-equal', () => {
    const source = { id: 'src', name: 'Src', type: 'custom_rect', inAnimPreset: 'fade' } as unknown as CharacterPart;
    const target = { id: 'photo', name: 'Photo', type: 'custom_image', masks: [effectMask()], effects: [desaturate()], trackMatte: { sourceLayerId: 'src', mode: 'alpha' } } as unknown as CharacterPart;
    const sourceTrack = { id: 't-src', partId: 'src', name: 'Src', color: '#fff', visible: true, locked: false, keyframes: [], channels: { x: [{ id: 'k', frame: 0, value: 10, easing: 'linear' }] } } as unknown as Track;
    const result = cloneAnimationOntoTarget(sourceTrack, source, 'photo', undefined);
    const after = { ...target, ...result.animationFields };
    expect(after.effects).toEqual(target.effects);
    expect(after.masks).toEqual(target.masks);
    expect(after.trackMatte).toEqual(target.trackMatte);
  });
});
