/**
 * Text that fits its box, and a shape that fits its text.
 *
 * A text layer may have a box (`textFit`):
 * - it keeps its size until it reaches `maxWidth`;
 * - past that its font shrinks, down to `minScale` of the authored size;
 * - if it is still too wide it is squeezed horizontally, so it never leaves
 *   the box;
 * - `maxLength` caps the number of characters (also the OGraf field's limit).
 *
 * A box-like shape may follow a text layer (`fitToText`): its width is the
 * text's width plus `padding` on each side, at least `minWidth`, at most
 * `maxWidth`. A text with such a shape fits within the shape's `maxWidth` less
 * the padding. Its height and position stay as authored; its scale animation
 * keeps its proportions (a 0 -> 1 reveal still reveals the fitted width).
 *
 * The result is applied to the layer data before evaluation, so every renderer
 * (stage, static SVG/GIF, OGraf runtime), the text matte and the bounds see the
 * same fitted layers. The factory is self-contained: the OGraf runtime embeds
 * its source (see `ograf/runtimeSnippets`).
 */

export interface TextFitSettings {
  /** The widest the text may be, in scene pixels at the layer's own scale; absent = no limit. */
  maxWidth?: number;
  /** The smallest font size, as a share of the authored size (default 0.5). */
  minScale?: number;
  /** The most characters shown (and accepted in OGraf); absent = no limit. */
  maxLength?: number;
}

export interface FitToTextSettings {
  /** The text layer this shape follows. */
  textLayerId: string;
  /** Space on each side of the text, in scene pixels (default 24). */
  padding?: number;
  /** The narrowest the shape gets, in scene pixels. */
  minWidth?: number;
  /** The widest the shape gets, in scene pixels; the text shrinks beyond it. */
  maxWidth?: number;
}

/** Width of `text` set in bold `fontFamily` at `fontSize` px, unscaled. */
export type TextMeasure = (text: string, fontSize: number, fontFamily: string) => number;

/** What fitting changes on one layer; absent fields are unchanged. */
export interface TextFitAdjustment {
  fontSize?: number;
  textValue?: string;
  /** Multiplies the layer's base scaleX and every scaleX key. */
  scaleXFactor?: number;
}

interface FitLayer {
  id: string;
  type: string;
  textValue?: string;
  fontSize?: number;
  fontFamily?: string;
  textFit?: TextFitSettings;
  fitToText?: FitToTextSettings;
}

export function createTextFit() {
  const DEFAULT_MIN_SCALE = 0.5;
  const DEFAULT_PADDING = 24;
  /** The local width of each box-like primitive (`utils/geometry/shapeGeometry`). */
  const SHAPE_WIDTHS: Record<string, number> = { custom_box: 60, custom_rect: 120, custom_banner: 160, custom_capsule: 100, custom_card: 180 };

  const finite = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
  const positive = (value: unknown): number | undefined => {
    const number = finite(value);
    return number !== undefined && number > 0 ? number : undefined;
  };

  /** The text cut to `maxLength` characters (whole code points). */
  function limitLength(text: string, maxLength: unknown): string {
    const limit = positive(maxLength);
    if (limit === undefined) return text;
    const characters = Array.from(text);
    return characters.length > Math.floor(limit) ? characters.slice(0, Math.floor(limit)).join('') : text;
  }

  let measureContext: CanvasRenderingContext2D | null | undefined;
  /**
   * Measures with a canvas when the page has one (the editor, a browser
   * renderer). Without one (a test environment) it estimates 0.56 em per
   * character, so fitting still behaves sensibly.
   */
  function measureTextWidth(text: string, fontSize: number, fontFamily: string): number {
    if (measureContext === undefined) {
      measureContext = null;
      const isTestDom = typeof navigator === 'object' && /jsdom/iu.test(String(navigator.userAgent));
      if (!isTestDom && typeof document === 'object' && typeof document.createElement === 'function') {
        try {
          measureContext = document.createElement('canvas').getContext('2d');
        } catch {
          measureContext = null;
        }
      }
    }
    if (measureContext) {
      // Exactly the family the SVG text names, with no generic fallback added:
      // a missing font then falls back to the same face in both.
      measureContext.font = 'bold ' + fontSize + 'px ' + JSON.stringify(fontFamily);
      return measureContext.measureText(text).width;
    }
    return Array.from(text).length * fontSize * 0.56;
  }

  /**
   * The adjustments that fit every text box and every shape that follows a
   * text. `baseScaleXOf` reads a layer's authored (unanimated) scaleX.
   */
  function resolveTextFit(
    layers: readonly FitLayer[],
    baseScaleXOf: (layer: FitLayer) => number,
    measure: TextMeasure,
  ): Record<string, TextFitAdjustment> {
    const result: Record<string, TextFitAdjustment> = Object.create(null);
    const followers = layers.filter((layer) => layer.fitToText && typeof layer.fitToText.textLayerId === 'string' && SHAPE_WIDTHS[layer.type] !== undefined);
    const textWidths: Record<string, number> = Object.create(null);

    for (const layer of layers) {
      if (layer.type !== 'custom_text') continue;
      const own = layer.textFit;
      const shapes = followers.filter((shape) => shape.fitToText!.textLayerId === layer.id);
      if (!own && shapes.length === 0) continue;
      const adjustment: TextFitAdjustment = {};
      const authoredText = layer.textValue || 'TEXT';
      const text = limitLength(authoredText, own && own.maxLength);
      if (text !== authoredText) adjustment.textValue = text;
      const fontSize = positive(layer.fontSize) || 24;
      const fontFamily = layer.fontFamily || 'Outfit';
      const scale = Math.abs(finite(baseScaleXOf(layer)) || 1) || 1;
      // The widest the text may be, in scene pixels: its own box and every
      // shape it fills, less that shape's padding.
      let maxWidth = positive(own && own.maxWidth);
      for (const shape of shapes) {
        const shapeMax = positive(shape.fitToText!.maxWidth);
        if (shapeMax === undefined) continue;
        const room = Math.max(1, shapeMax - 2 * Math.max(0, finite(shape.fitToText!.padding) ?? DEFAULT_PADDING));
        maxWidth = maxWidth === undefined ? room : Math.min(maxWidth, room);
      }
      let size = fontSize;
      let width = measure(text, size, fontFamily) * scale;
      let squeeze = 1;
      if (maxWidth !== undefined && width > maxWidth) {
        const minScale = Math.min(1, Math.max(0.05, finite(own && own.minScale) ?? DEFAULT_MIN_SCALE));
        size = fontSize * Math.max(minScale, maxWidth / width);
        width = measure(text, size, fontFamily) * scale;
        if (width > maxWidth) {
          squeeze = maxWidth / width;
          width = maxWidth;
        }
      }
      if (size !== fontSize) adjustment.fontSize = size;
      if (squeeze !== 1) adjustment.scaleXFactor = squeeze;
      textWidths[layer.id] = width;
      if (adjustment.fontSize !== undefined || adjustment.textValue !== undefined || adjustment.scaleXFactor !== undefined) result[layer.id] = adjustment;
    }

    for (const shape of followers) {
      const settings = shape.fitToText!;
      const textWidth = textWidths[settings.textLayerId];
      if (textWidth === undefined) continue;
      const padding = Math.max(0, finite(settings.padding) ?? DEFAULT_PADDING);
      let width = textWidth + 2 * padding;
      const minWidth = positive(settings.minWidth);
      const maxWidth = positive(settings.maxWidth);
      if (minWidth !== undefined) width = Math.max(width, minWidth);
      if (maxWidth !== undefined) width = Math.min(width, Math.max(maxWidth, minWidth ?? 0));
      const base = finite(baseScaleXOf(shape)) ?? 1;
      if (base === 0) continue;
      const factor = width / (SHAPE_WIDTHS[shape.type] * Math.abs(base));
      if (Number.isFinite(factor) && factor > 0 && factor !== 1) result[shape.id] = { scaleXFactor: factor };
    }
    return result;
  }

  type SceneLike = {
    layers: Array<FitLayer & { scaleX?: number }>;
    tracks?: Array<{ partId?: string; channels?: Record<string, unknown>; keyframes?: unknown[] }>;
  };

  /** Scales a layer's scaleX keys (channel and legacy composite keys) by `factor`. */
  function scaleTrackX<T extends { channels?: Record<string, unknown>; keyframes?: unknown[] }>(track: T, factor: number): T {
    const next = { ...track };
    const channel = track.channels && Array.isArray(track.channels.scaleX) ? track.channels.scaleX as Array<{ value?: unknown }> : null;
    if (channel) {
      next.channels = { ...track.channels, scaleX: channel.map((key) => (typeof key.value === 'number' ? { ...key, value: key.value * factor } : key)) };
    }
    if (Array.isArray(track.keyframes)) {
      next.keyframes = track.keyframes.map((key) => {
        const legacy = key as { scaleX?: unknown };
        return typeof legacy.scaleX === 'number' ? { ...legacy, scaleX: legacy.scaleX * factor } : key;
      });
    }
    return next;
  }

  /** The scene (SceneData shape: `scaleX` on the layer) with every fit applied; the same object when nothing fits. */
  function applyTextFitToScene<T extends SceneLike>(scene: T, measure: TextMeasure = measureTextWidth): T {
    const adjustments = resolveTextFit(scene.layers, (layer) => (layer as { scaleX?: number }).scaleX ?? 1, measure);
    const ids = Object.keys(adjustments);
    if (ids.length === 0) return scene;
    return {
      ...scene,
      layers: scene.layers.map((layer) => {
        const adjustment = adjustments[layer.id];
        if (!adjustment) return layer;
        return {
          ...layer,
          ...(adjustment.fontSize !== undefined ? { fontSize: adjustment.fontSize } : {}),
          ...(adjustment.textValue !== undefined ? { textValue: adjustment.textValue } : {}),
          ...(adjustment.scaleXFactor !== undefined ? { scaleX: (layer.scaleX ?? 1) * adjustment.scaleXFactor } : {}),
        };
      }),
      tracks: scene.tracks?.map((track) => {
        const factor = track.partId ? adjustments[track.partId]?.scaleXFactor : undefined;
        return factor === undefined ? track : scaleTrackX(track, factor);
      }),
    };
  }

  return { resolveTextFit, applyTextFitToScene, scaleTrackX, measureTextWidth, limitLength };
}

const textFit = createTextFit();
export const { resolveTextFit, applyTextFitToScene, scaleTrackX, measureTextWidth, limitLength } = textFit;

/**
 * The editor's layers (`baseTransform.scaleX`) and tracks with every fit
 * applied; the same arrays when nothing fits. Render-only: the result is never
 * stored, so the authored values stay what the user typed.
 */
export function applyTextFitToParts<P extends FitLayer & { baseTransform: { scaleX: number } }, T extends { partId: string; channels?: Record<string, unknown>; keyframes?: unknown[] }>(
  parts: P[],
  tracks: T[],
  measure: TextMeasure = measureTextWidth,
): { parts: P[]; tracks: T[] } {
  const adjustments = resolveTextFit(parts, (layer) => (layer as P).baseTransform?.scaleX ?? 1, measure);
  if (Object.keys(adjustments).length === 0) return { parts, tracks };
  return {
    parts: parts.map((part) => {
      const adjustment = adjustments[part.id];
      if (!adjustment) return part;
      return {
        ...part,
        ...(adjustment.fontSize !== undefined ? { fontSize: adjustment.fontSize } : {}),
        ...(adjustment.textValue !== undefined ? { textValue: adjustment.textValue } : {}),
        ...(adjustment.scaleXFactor !== undefined ? { baseTransform: { ...part.baseTransform, scaleX: part.baseTransform.scaleX * adjustment.scaleXFactor } } : {}),
      };
    }),
    tracks: tracks.map((track) => {
      const factor = adjustments[track.partId]?.scaleXFactor;
      return factor === undefined ? track : scaleTrackX(track, factor);
    }),
  };
}
