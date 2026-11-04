/**
 * The Track Matte mask of an exported graphic: soft edge (feather), strength
 * and gradient, in the structures the editor's stage draws
 * (`components/Canvas/StagePartLayers`), so the static renderer and the OGraf
 * runtime show what the editor shows.
 *
 * - A shape source is blurred in world space; a text or image source in its
 *   own space (the stage filters the element inside its transform), over the
 *   region `utils/layers/matte` `matteContentBlurBox` gives.
 * - Strength scales the source's coverage (an inverted matte: the area
 *   outside it, and for luminance the hole too, as the editor composites it).
 * - A gradient is world space, except on a non-inverted text, where it is in
 *   the text's own space. Its stops arrive normalised for the mask's structure
 *   (`utils/layers/matte` `normalizeGradientStops`).
 *
 * The factory is self-contained: the OGraf runtime embeds its source (see
 * `ograf/runtimeSnippets`), with the shapes' local bounds passed in as data.
 */
import type { BodyPartType, TrackMatteV2 } from '../types/animator';
import { getShapeGeometry } from '../utils/geometry/shapeGeometry';
import { matteContentBlurBox, normalizeFeather, normalizeGradientAngle, normalizeGradientStops, normalizeGradientType, normalizeStrength } from '../utils/layers/matte';

export interface MatteBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TrackMatteGradientInput {
  type: 'linear' | 'radial';
  /** Degrees in [0, 360); 0 = left to right. */
  angle: number;
  stops: Array<{ offset: number; color: string; opacity: number }>;
}

export interface TrackMatteMaskInput {
  id: string;
  /** The scene: the mask covers 0..width, 0..height. */
  width: number;
  height: number;
  mode: 'alpha' | 'luminance';
  inverted: boolean;
  /** Normalised: 0 = a hard edge. */
  feather: number;
  /** Normalised to 0..1. */
  strength: number;
  gradient?: TrackMatteGradientInput;
  /** The source layer. */
  source: {
    type: string;
    points?: Array<{ x: number; y: number }>;
    width?: number;
    height?: number;
    fontSize?: number;
    textValue?: string;
  };
  /** The source's world `transform` attribute. */
  transform: string;
  /** The same map as numbers, with the scene centre in e/f: world = (a x + c y + e, b x + d y + f). */
  affine: { a: number; b: number; c: number; d: number; e: number; f: number };
  /** The source painted in `fill` in its own space, at full opacity. */
  silhouette: (fill: string) => string;
  /** A non-inverted luminance matte paints the source in its own fill colour. */
  fillColor: string;
}

export function createTrackMatteMarkup(shapeBounds: Record<string, MatteBounds>, contentBlurBox: typeof matteContentBlurBox) {
  /** The editor's canonical text box for gradients (a text has no geometry). */
  const TEXT_BOX: MatteBounds = { minX: -100, minY: -30, maxX: 100, maxY: 30 };

  const number = (value: number): string => String(Number.isFinite(value) ? value : 0);
  const escape = (value: string): string => String(value).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');

  /** The source's local bounds the gradient spans, as the editor derives them. */
  function gradientBounds(source: TrackMatteMaskInput['source']): MatteBounds | undefined {
    if (source.type === 'custom_text') return TEXT_BOX;
    if (source.type === 'custom_image') {
      const width = typeof source.width === 'number' && Number.isFinite(source.width) && source.width > 0 ? source.width : 180;
      const height = typeof source.height === 'number' && Number.isFinite(source.height) && source.height > 0 ? source.height : 120;
      return { minX: -width / 2, minY: -height / 2, maxX: width / 2, maxY: height / 2 };
    }
    if (source.type === 'custom_freeform') {
      const points = source.points || [];
      if (points.length === 0) return undefined;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const point of points) {
        minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
      }
      return { minX, minY, maxX, maxY };
    }
    return shapeBounds[source.type];
  }

  function stopsMarkup(stops: TrackMatteGradientInput['stops']): string {
    return stops.map((stop) => '<stop offset="' + number(stop.offset * 100) + '%" stop-color="' + escape(stop.color) + '" stop-opacity="' + number(stop.opacity) + '" />').join('');
  }

  /**
   * A gradient def. `space`: 'world' (consumed in world space), 'world-in-local'
   * (world geometry consumed inside the source's transform), 'local'.
   */
  function gradientDef(id: string, input: TrackMatteMaskInput, space: 'world' | 'world-in-local' | 'local'): string {
    const gradient = input.gradient!;
    const box = gradientBounds(input.source)!;
    const m = input.affine;
    const toWorld = (x: number, y: number) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    let transform = '';
    if (space === 'world-in-local') {
      const det = m.a * m.d - m.b * m.c;
      transform = ' gradientTransform="matrix(' + [m.d / det, -m.b / det, -m.c / det, m.a / det, (m.c * m.f - m.d * m.e) / det, (m.b * m.e - m.a * m.f) / det].map(number).join(' ') + ')"';
    }
    if (gradient.type === 'radial') {
      const width = box.maxX - box.minX;
      const height = box.maxY - box.minY;
      const radius = Math.sqrt(width * width + height * height) / 2;
      let centre = { x: cx, y: cy };
      let r = radius;
      if (space !== 'local') {
        // A world circle that covers the transformed source: the radius times
        // the map's largest stretch.
        centre = toWorld(cx, cy);
        const trace = m.a * m.a + m.b * m.b + m.c * m.c + m.d * m.d;
        const det = m.a * m.d - m.b * m.c;
        r = radius * Math.sqrt(Math.max(0, (trace + Math.sqrt(Math.max(0, trace * trace - 4 * det * det))) / 2));
      }
      return '<radialGradient id="' + id + '" gradientUnits="userSpaceOnUse" cx="' + number(centre.x) + '" cy="' + number(centre.y) + '" r="' + number(r) + '"' + transform + '>' + stopsMarkup(gradient.stops) + '</radialGradient>';
    }
    // Through the box centre along the angle, as far as the box reaches.
    const angle = (gradient.angle * Math.PI) / 180;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let minP = Infinity;
    let maxP = -Infinity;
    for (const corner of [[box.minX, box.minY], [box.maxX, box.minY], [box.minX, box.maxY], [box.maxX, box.maxY]]) {
      const projection = corner[0] * dx + corner[1] * dy;
      minP = Math.min(minP, projection);
      maxP = Math.max(maxP, projection);
    }
    const half = (maxP - minP) / 2;
    let p1 = { x: cx - dx * half, y: cy - dy * half };
    let p2 = { x: cx + dx * half, y: cy + dy * half };
    if (space !== 'local') {
      p1 = toWorld(p1.x, p1.y);
      p2 = toWorld(p2.x, p2.y);
    }
    return '<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="' + number(p1.x) + '" y1="' + number(p1.y) + '" x2="' + number(p2.x) + '" y2="' + number(p2.y) + '"' + transform + '>' + stopsMarkup(gradient.stops) + '</linearGradient>';
  }

  /** The `<mask>` (and the defs it uses) of one Track Matte relationship. */
  function trackMatteMask(input: TrackMatteMaskInput): string {
    const { id, width, height, mode, inverted, feather, strength } = input;
    const kind = input.source.type === 'custom_text' ? 'text' : input.source.type === 'custom_image' ? 'image' : 'shape';
    const det = input.affine.a * input.affine.d - input.affine.b * input.affine.c;
    const gradient = input.gradient && gradientBounds(input.source) && Math.abs(det) > 1e-12 ? input.gradient : undefined;
    const defs: string[] = [];
    const opacity = strength < 1 ? ' opacity="' + number(strength) + '"' : '';
    const fillOpacity = strength < 1 ? ' fill-opacity="' + number(strength) + '"' : '';
    // A shape is blurred in world space; a text or an image in its own, as the stage does.
    let worldFilter = '';
    let localFilter = '';
    if (feather > 0) {
      const box = kind === 'shape'
        ? { x: -feather, y: -feather, width: width + 2 * feather, height: height + 2 * feather }
        : contentBlurBox({ kind, text: input.source.textValue, fontSize: input.source.fontSize, width: input.source.width, height: input.source.height }, feather);
      defs.push('<filter id="' + id + '-f" filterUnits="userSpaceOnUse" x="' + number(box.x) + '" y="' + number(box.y) + '" width="' + number(box.width) + '" height="' + number(box.height) + '"><feGaussianBlur stdDeviation="' + number(feather / 2) + '" /></filter>');
      if (kind === 'shape') worldFilter = ' filter="url(#' + id + '-f)"';
      else localFilter = ' filter="url(#' + id + '-f)"';
    }
    const inSource = (inner: string) => '<g transform="' + escape(input.transform) + '">' + inner + '</g>';
    /** A group carrying a filter and/or an opacity; no group when it has neither. */
    const group = (attributes: string, inner: string) => (attributes ? '<g' + attributes + '>' + inner + '</g>' : inner);
    const region = (fill: string, extra: string) => '<rect x="0" y="0" width="' + number(width) + '" height="' + number(height) + '" fill="' + fill + '"' + extra + ' />';
    const sourceFill = mode === 'alpha' ? 'white' : escape(input.fillColor || 'white');
    const worldGradient = () => {
      defs.push(gradientDef(id + '-g', input, 'world'));
      return 'url(#' + id + '-g)';
    };
    let type: string = mode;
    let body: string;

    if (kind === 'shape' && !inverted) {
      let fill = sourceFill;
      if (gradient) {
        defs.push(gradientDef(id + '-g', input, 'world-in-local'));
        fill = 'url(#' + id + '-g)';
      }
      body = group(worldFilter + opacity, inSource(input.silhouette(fill)));
    } else if (kind === 'shape') {
      // Inverted: the region, with the source painted black over it, in a
      // luminance mask. An alpha matte's hole is cut whole whatever the
      // strength (the editor's even-odd path); a luminance matte's black is
      // composited at the strength too, as the editor draws it.
      type = 'luminance';
      body = region(gradient ? worldGradient() : 'white', fillOpacity) + group(worldFilter + (mode === 'luminance' ? opacity : ''), inSource(input.silhouette('black')));
    } else if (!inverted && kind === 'text') {
      let fill = sourceFill;
      if (gradient) {
        defs.push(gradientDef(id + '-g', input, 'local'));
        fill = 'url(#' + id + '-g)';
      }
      body = inSource(group(localFilter + opacity, input.silhouette(fill)));
    } else if (!inverted && gradient) {
      // An image under a gradient: the gradient region, through the image's alpha.
      defs.push('<mask id="' + id + '-img" x="0" y="0" width="' + number(width) + '" height="' + number(height) + '" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="alpha">' + inSource(group(opacity, input.silhouette('white'))) + '</mask>');
      body = '<g mask="url(#' + id + '-img)">' + region(worldGradient(), '') + '</g>';
    } else if (!inverted) {
      body = inSource(group(localFilter + opacity, input.silhouette('white')));
    } else {
      // An inverted text or image: the region, with the source painted over it
      // (black glyphs; an image's dark pixels) in a luminance mask.
      type = 'luminance';
      body = region(gradient ? worldGradient() : 'white', fillOpacity) + inSource(group(localFilter + opacity, input.silhouette(kind === 'text' ? 'black' : 'white')));
    }
    return defs.join('') + '<mask id="' + id + '" x="0" y="0" width="' + number(width) + '" height="' + number(height) + '" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="' + type + '">' + body + '</mask>';
  }

  return { trackMatteMask, gradientBounds };
}

/** The local bounds of every shape type with static geometry. */
export const SHAPE_BOUNDS: Record<string, MatteBounds> = (() => {
  const types: BodyPartType[] = ['custom_star', 'custom_circle', 'custom_box', 'custom_rect', 'custom_triangle', 'custom_parallelogram', 'custom_banner', 'custom_capsule', 'custom_diamond', 'custom_card'];
  const bounds: Record<string, MatteBounds> = {};
  for (const type of types) {
    const geometry = getShapeGeometry(type);
    if (!geometry) continue;
    if (geometry.kind === 'circle') bounds[type] = { minX: -geometry.r, minY: -geometry.r, maxX: geometry.r, maxY: geometry.r };
    else if (geometry.kind === 'polygon') {
      const xs = geometry.points.map((point) => point.x);
      const ys = geometry.points.map((point) => point.y);
      bounds[type] = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    } else bounds[type] = { minX: geometry.x, minY: geometry.y, maxX: geometry.x + geometry.width, maxY: geometry.y + geometry.height };
  }
  return bounds;
})();

export const { trackMatteMask } = createTrackMatteMarkup(SHAPE_BOUNDS, matteContentBlurBox);

/**
 * A Track Matte's soft edge, strength and gradient normalised as the editor
 * reads them; the gradient's stops for the structure the mask uses (an
 * inverted text is a luminance structure whatever its mode).
 */
export function trackMatteRenderParameters(
  trackMatte: Pick<TrackMatteV2, 'mode' | 'inverted' | 'feather' | 'strength' | 'gradient'>,
  sourceType: string,
): { feather: number; strength: number; gradient?: TrackMatteGradientInput } {
  const feather = normalizeFeather(trackMatte.feather);
  const strength = normalizeStrength(trackMatte.strength);
  const gradient = trackMatte.gradient;
  if (!gradient || typeof gradient !== 'object') return { feather, strength };
  const structure = sourceType === 'custom_text' && trackMatte.inverted === true ? 'luminance' : trackMatte.mode;
  return {
    feather,
    strength,
    gradient: {
      type: normalizeGradientType(gradient.type),
      angle: normalizeGradientAngle(gradient.angle) ?? 0,
      stops: normalizeGradientStops(gradient.stops, structure),
    },
  };
}
