/**
 * Layer effects: drop shadow, outer glow, layer blur and blend mode.
 *
 * The ONE description of how a layer's effects paint. The stage, the static
 * SVG and the generated OGraf graphic all draw the filter this builds, so an
 * effect looks the same everywhere (the drop shadow used to be drawn only by
 * the stage and was silently missing from every export).
 *
 * The filter sits on the layer's transformed content, like the stage's shadow
 * always did: offsets and radii are in the layer's own units and turn and scale
 * with it. The drop shadow is spelled as the primitives `feDropShadow` is
 * defined by (blur, offset, flood, composite, merge): an HTML parser may
 * lower-case the `feDropShadow` tag name, which disables it, while these
 * names are kept everywhere. The blend mode applies to the whole layer against
 * what is painted under it.
 *
 * Self-contained (no module-scope references): the OGraf runtime embeds this
 * exact source (`ograf/runtimeSnippets`).
 */
export type LayerBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'add';

export const LAYER_BLEND_MODES: readonly LayerBlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'add'];

export interface LayerEffectFields {
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  /** Gaussian blur of the whole layer, in its own units; 0 or absent = sharp. */
  layerBlur?: number;
  /** Outer glow colour; absent = no glow. */
  glowColor?: string;
  /** Glow spread (blur radius), in the layer's units (default 12; 0 = off). */
  glowSize?: number;
  /** Glow opacity 0..1 (default 0.8). */
  glowStrength?: number;
  blendMode?: LayerBlendMode;
}

export function createLayerEffects() {
  const finite = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
  const attr = (value: unknown): string => String(value).replace(/[&<>"']/g, (character) => (
    character === '&' ? '&amp;' : character === '<' ? '&lt;' : character === '>' ? '&gt;' : character === '"' ? '&quot;' : '&#39;'
  ));
  const CSS_BLEND: Record<string, string> = { multiply: 'multiply', screen: 'screen', overlay: 'overlay', darken: 'darken', lighten: 'lighten', add: 'plus-lighter' };

  // A glow with no size yet spreads 12 units; a size of 0 switches it off.
  const glowOf = (layer: LayerEffectFields) => (layer.glowColor && finite(layer.glowSize, 12) > 0
    ? { color: layer.glowColor, size: finite(layer.glowSize, 12), strength: Math.min(1, Math.max(0, finite(layer.glowStrength, 0.8))) }
    : null);

  /** True when the layer paints through a filter (shadow, glow or blur). */
  const hasLayerFilter = (layer: LayerEffectFields): boolean =>
    Boolean(layer.shadowColor) || finite(layer.layerBlur, 0) > 0 || glowOf(layer) !== null;

  /** The `<filter>` element for the layer's effects, or '' when it has none. */
  const layerFilterMarkup = (layer: LayerEffectFields, id: string): string => {
    if (!hasLayerFilter(layer)) return '';
    const blur = Math.max(0, finite(layer.layerBlur, 0));
    const glow = glowOf(layer);
    const shadow = layer.shadowColor
      ? { dx: finite(layer.shadowOffsetX, 0), dy: finite(layer.shadowOffsetY, 4), blur: finite(layer.shadowBlur, 8) || 8, color: layer.shadowColor }
      : null;
    const parts: string[] = [];
    const merge: string[] = [];
    if (shadow) {
      parts.push('<feGaussianBlur in="SourceAlpha" stdDeviation="' + shadow.blur + '" result="kcsShadowBlur"></feGaussianBlur>'
        + '<feOffset in="kcsShadowBlur" dx="' + shadow.dx + '" dy="' + shadow.dy + '" result="kcsShadowOffset"></feOffset>'
        + '<feFlood flood-color="' + attr(shadow.color) + '" flood-opacity="0.85" result="kcsShadowColor"></feFlood>'
        + '<feComposite in="kcsShadowColor" in2="kcsShadowOffset" operator="in" result="kcsShadow"></feComposite>');
      merge.push('kcsShadow');
    }
    if (glow) {
      parts.push('<feGaussianBlur in="SourceAlpha" stdDeviation="' + glow.size + '" result="kcsGlowBlur"></feGaussianBlur>'
        + '<feFlood flood-color="' + attr(glow.color) + '" flood-opacity="' + glow.strength + '" result="kcsGlowColor"></feFlood>'
        + '<feComposite in="kcsGlowColor" in2="kcsGlowBlur" operator="in" result="kcsGlow"></feComposite>');
      merge.push('kcsGlow');
    }
    if (blur > 0) {
      parts.push('<feGaussianBlur in="SourceGraphic" stdDeviation="' + blur + '" result="kcsBody"></feGaussianBlur>');
      merge.push('kcsBody');
    } else {
      merge.push('SourceGraphic');
    }
    // A glow or a blur reaches further than a shadow: a wider filter region.
    const region = glow || blur > 0 ? 'x="-100%" y="-100%" width="300%" height="300%"' : 'x="-50%" y="-50%" width="200%" height="200%"';
    return '<filter id="' + attr(id) + '" ' + region + '>' + parts.join('')
      + '<feMerge>' + merge.map((name) => '<feMergeNode in="' + name + '"></feMergeNode>').join('') + '</feMerge></filter>';
  };

  /** The CSS `mix-blend-mode` of the layer, or null for normal blending. */
  const layerBlendMode = (layer: LayerEffectFields): string | null => (layer.blendMode ? CSS_BLEND[layer.blendMode] ?? null : null);

  return { hasLayerFilter, layerFilterMarkup, layerBlendMode };
}

export const { hasLayerFilter, layerFilterMarkup, layerBlendMode } = createLayerEffects();
