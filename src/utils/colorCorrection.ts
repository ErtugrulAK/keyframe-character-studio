import type { CharacterPart, ColorCorrectionEffect, LayerMask } from '../types/animator';

/**
 * WP-08 — mask-constrained colour correction, the pure authority shared by
 * the editor renderer (StagePartLayers/PartRenderer), the SVG export renderer
 * (GIF) and the Inspector.
 *
 * Equation (09_WP08_DESIGN_PROPOSAL): C_out = (1 − w)·C + w·F(C), A_out = A,
 * w = m·q — m the effect mask's coverage (1 for the whole layer), q the
 * amount. F = brightness → contrast → (clamp) → saturation (Rec.709) in sRGB.
 * In SVG: the layer is drawn twice inside an isolated group, the original
 * under coverage (1 − w) and F(original) under coverage w with
 * `mix-blend-mode: plus-lighter` (premultiplied add), which keeps the alpha.
 *
 * Scene data: absent fields are today's behaviour (no effects; a mask cuts
 * the layer's alpha). A scene that uses an effect or an effect-only mask is
 * written as version 3 (option B), so builds that cannot render it refuse it
 * instead of showing a wrong picture.
 */

export const COLOR_CORRECTION_RANGES = {
  brightness: { min: -1, max: 1, neutral: 0 },
  contrast: { min: 0, max: 2, neutral: 1 },
  saturation: { min: 0, max: 2, neutral: 1 },
  amount: { min: 0, max: 1, neutral: 1 },
} as const;

export type ColorCorrectionField = keyof typeof COLOR_CORRECTION_RANGES;

/** The scene version a document needs: 3 only when it uses effects or effect-only masks. */
export const SCENE_VERSION_WITH_EFFECTS = 3;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const finiteOr = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

/** The effect's parameters with every default filled in and every range respected. */
export const resolvedParameters = (effect: ColorCorrectionEffect) => ({
  brightness: clamp(finiteOr(effect.brightness, 0), -1, 1),
  contrast: clamp(finiteOr(effect.contrast, 1), 0, 2),
  saturation: clamp(finiteOr(effect.saturation, 1), 0, 2),
  amount: clamp(finiteOr(effect.amount, 1), 0, 1),
});

/** True when the correction cannot change any pixel (F is the identity or nothing is mixed in). */
export const isNeutralCorrection = (effect: ColorCorrectionEffect): boolean => {
  const p = resolvedParameters(effect);
  return p.amount === 0 || (p.brightness === 0 && p.contrast === 1 && p.saturation === 1);
};

/** A new, neutral correction for the whole layer. */
export const createColorCorrection = (id: string): ColorCorrectionEffect => ({ id, type: 'colorCorrection', enabled: true, amount: 1, brightness: 0, contrast: 1, saturation: 1, scope: 'layer' });

/** The same effect back at neutral values (scope, mask and enabled state kept). */
export const resetColorCorrection = (effect: ColorCorrectionEffect): ColorCorrectionEffect => ({ ...effect, amount: 1, brightness: 0, contrast: 1, saturation: 1 });

/** A mask that only scopes an effect and does NOT cut the layer's alpha. */
export const isEffectOnlyMask = (mask: Pick<LayerMask, 'affectsAlpha'>): boolean => mask.affectsAlpha === false;

/** The masks that cut the layer's alpha (effect-only masks are excluded). */
export const alphaMasks = <T extends Pick<LayerMask, 'affectsAlpha'>>(masks: readonly T[] | undefined): T[] => (masks ?? []).filter((mask) => !isEffectOnlyMask(mask));

export type ColorCorrectionStatus =
  | { kind: 'none' }
  | { kind: 'off'; effect: ColorCorrectionEffect }
  | { kind: 'neutral'; effect: ColorCorrectionEffect }
  | { kind: 'missing-mask'; effect: ColorCorrectionEffect; message: string }
  | { kind: 'disabled-mask'; effect: ColorCorrectionEffect; mask: LayerMask; message: string }
  | { kind: 'applied'; effect: ColorCorrectionEffect; mask?: LayerMask };

/** The (first) colour correction of a layer. Version 1 supports one per layer. */
export const colorCorrectionOf = (part: Pick<CharacterPart, 'effects'>): ColorCorrectionEffect | undefined =>
  part.effects?.find((effect) => effect.type === 'colorCorrection');

/**
 * What the renderer will do with a layer's correction, given the layer's
 * EVALUATED masks. A mask scope whose mask is missing or switched off is
 * NOT applied — never silently widened to the whole layer — and says why.
 */
export const resolveColorCorrection = (
  part: Pick<CharacterPart, 'effects'>,
  masks: readonly LayerMask[] | undefined,
): ColorCorrectionStatus => {
  const effect = colorCorrectionOf(part);
  if (!effect) return { kind: 'none' };
  if (effect.enabled === false) return { kind: 'off', effect };
  if (effect.scope === 'mask') {
    const mask = masks?.find((candidate) => candidate.id === effect.maskId);
    if (!mask) return { kind: 'missing-mask', effect, message: 'The correction’s mask no longer exists: the correction is not applied.' };
    if (mask.enabled === false) return { kind: 'disabled-mask', effect, mask, message: `The mask “${mask.name}” is off: the correction is not applied.` };
    if (isNeutralCorrection(effect)) return { kind: 'neutral', effect };
    return { kind: 'applied', effect, mask };
  }
  if (isNeutralCorrection(effect)) return { kind: 'neutral', effect };
  return { kind: 'applied', effect };
};

/**
 * F as SVG filter numbers: one linear transfer (brightness then contrast about
 * 0.5, clamped once by the primitive) and a Rec.709 saturation matrix.
 */
export const colorCorrectionFilter = (effect: ColorCorrectionEffect) => {
  const { brightness, contrast, saturation } = resolvedParameters(effect);
  const slope = contrast;
  const intercept = contrast * brightness + 0.5 * (1 - contrast);
  const r = 0.2126;
  const g = 0.7152;
  const b = 0.0722;
  const s = saturation;
  const matrix = [
    r + (1 - r) * s, g - g * s, b - b * s, 0, 0,
    r - r * s, g + (1 - g) * s, b - b * s, 0, 0,
    r - r * s, g - g * s, b + (1 - b) * s, 0, 0,
    0, 0, 0, 1, 0,
  ];
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  return { slope: round(slope), intercept: round(intercept), matrix: matrix.map(round).join(' ') };
};

/** Deterministic def ids for one layer's correction. */
export const colorCorrectionIds = (partId: string, effectId: string) => {
  const safe = `${partId}-${effectId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  return {
    filter: `kcs-cc-filter-${safe}`,
    coverage: `kcs-cc-cover-${safe}`,
    inverse: `kcs-cc-inverse-${safe}`,
  };
};

/** True when a scene's layers use anything only version 3 can carry. */
export const sceneUsesEffectFeatures = (layers: readonly { effects?: readonly unknown[]; masks?: readonly Pick<LayerMask, 'affectsAlpha'>[] }[]): boolean =>
  layers.some((layer) => (layer.effects?.length ?? 0) > 0 || (layer.masks ?? []).some(isEffectOnlyMask));

/**
 * Structural validation of one layer's `effects` (import boundary): the whole
 * file is refused on the first problem. Returns an error message or null.
 */
export const effectsValidationError = (effects: unknown, layerName: string, maskIds: readonly string[]): string | null => {
  if (effects === undefined) return null;
  if (!Array.isArray(effects)) return `Layer “${layerName}”: effects must be a list.`;
  if (effects.length > 1) return `Layer “${layerName}”: this version supports one colour correction per layer.`;
  for (const effect of effects as unknown[]) {
    if (!effect || typeof effect !== 'object') return `Layer “${layerName}”: an effect is not an object.`;
    const candidate = effect as Record<string, unknown>;
    if (candidate.type !== 'colorCorrection') return `Layer “${layerName}”: unknown effect type “${String(candidate.type)}”.`;
    if (typeof candidate.id !== 'string' || candidate.id.length === 0) return `Layer “${layerName}”: an effect has no id.`;
    if (candidate.enabled !== undefined && typeof candidate.enabled !== 'boolean') return `Layer “${layerName}”: effect “enabled” must be true or false.`;
    for (const field of Object.keys(COLOR_CORRECTION_RANGES) as ColorCorrectionField[]) {
      const value = candidate[field];
      if (value === undefined) continue;
      const range = COLOR_CORRECTION_RANGES[field];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < range.min || value > range.max) {
        return `Layer “${layerName}”: ${field} must be a number from ${range.min} to ${range.max}.`;
      }
    }
    if (candidate.scope !== 'layer' && candidate.scope !== 'mask') return `Layer “${layerName}”: effect scope must be “layer” or “mask”.`;
    if (candidate.scope === 'mask') {
      if (typeof candidate.maskId !== 'string' || candidate.maskId.length === 0) return `Layer “${layerName}”: a mask-scoped effect needs its mask id.`;
      if (!maskIds.includes(candidate.maskId)) return `Layer “${layerName}”: the effect’s mask “${candidate.maskId}” is not one of the layer’s masks.`;
    }
  }
  return null;
};
