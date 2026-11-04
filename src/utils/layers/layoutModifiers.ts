/**
 * Layout modifiers: layers that size, place, hide or repeat themselves from
 * other layers, as Unreal Motion Design modifiers do.
 *
 * - Text box (`textFit`, text): the text keeps its size up to `maxWidth`, then
 *   shrinks down to `minScale`, then is squeezed, so it never leaves its box;
 *   `maxLength` caps its characters (also the OGraf field's limit); `align`
 *   makes the layer's x its left or right edge instead of its centre;
 *   `hideWhenEmpty` hides it (and every shape that sizes to it) when it is empty.
 * - Auto size (`fitToText`, box-like shapes): the width is the text's width
 *   plus `padding` on each side, between `minWidth` and `maxWidth`; a text that
 *   fills such a shape fits within its `maxWidth` less the padding. `anchor`
 *   keeps the left or right edge in place instead of the centre.
 * - Auto follow (`follow`, any layer): the layer sits next to another layer's
 *   edge and moves when that layer grows. Its x becomes the gap to that edge;
 *   with `vertical` its y becomes the offset from the target's y.
 * - Justify (`justify`, groups): the group's children keep their combined
 *   bounds left, centred or right on the group's origin as their sizes change.
 * - Repeater (`repeater`, any layer but a group): copies of the layer in a line,
 *   a grid or a ring, each one offset, turned, scaled, faded and delayed a step
 *   further than the one before.
 *
 * The result is applied to the layer data before evaluation, so every renderer
 * (stage, static SVG/GIF, OGraf runtime), the matte and the bounds see the same
 * laid-out layers, and an animation keeps its shape: a moved layer moves its
 * keys with it, a resized one scales its scale keys. Positions and sizes are
 * computed from the authored (unanimated) pose, once per data change, not per
 * frame. The factory is self-contained: the OGraf runtime embeds its source (see
 * `ograf/runtimeSnippets`), with the shape extents passed in as data.
 */
import type { BodyPartType } from '../../types/animator';
import { getShapeGeometry } from '../geometry/shapeGeometry';

export type HorizontalAlign = 'left' | 'center' | 'right';

export interface TextFitSettings {
  /** The widest the text may be, in scene pixels at the layer's own scale; absent = no limit. */
  maxWidth?: number;
  /** The smallest font size, as a share of the authored size (default 0.5). */
  minScale?: number;
  /** The most characters shown (and accepted in OGraf); absent = no limit. */
  maxLength?: number;
  /** Which point of the text the layer's x is: its left edge, centre (default) or right edge. */
  align?: HorizontalAlign;
  /** An empty text is hidden, with every shape that sizes to it. */
  hideWhenEmpty?: boolean;
}

export interface FitToTextSettings {
  /** The text layer this shape follows. */
  textLayerId: string;
  /** More texts (a title and a subtitle): the shape takes the widest. */
  extraTextLayerIds?: string[];
  /** Space on each side of the text, in scene pixels (default 24). */
  padding?: number;
  /** The narrowest the shape gets, in scene pixels. */
  minWidth?: number;
  /** The widest the shape gets, in scene pixels; the text shrinks beyond it. */
  maxWidth?: number;
  /** The edge that stays in place as the shape grows: left, centre (default) or right. */
  anchor?: HorizontalAlign;
}

export interface FollowSettings {
  /** The layer whose edge this one sits next to (same parent). */
  targetLayerId: string;
  /** Which side of the target: 'right' (default) or 'left'. */
  side?: 'left' | 'right';
  /** The layer also moves up and down with the target; its y is then the offset from the target's y. */
  vertical?: boolean;
}

export interface JustifySettings {
  /** Where the children's combined bounds sit on the group's origin. */
  horizontal: HorizontalAlign;
}

export interface RepeaterSettings {
  /** Copies including the layer itself (2 or more to repeat). */
  count: number;
  /** 'line' (default): each copy a step further; 'grid': rows of `columns`; 'radial': a ring of `radius`. */
  layout?: 'line' | 'grid' | 'radial';
  /** Step between copies, in scene pixels (line and grid). */
  offsetX?: number;
  offsetY?: number;
  /** Copies per row of a grid. */
  columns?: number;
  /** Radius of a ring, in scene pixels. */
  radius?: number;
  /** Turn added per copy, in degrees. */
  rotation?: number;
  /** Scale factor per copy (1 = the same size). */
  scale?: number;
  /** Opacity removed per copy (0..1). */
  fade?: number;
  /** Frames each copy's animation starts after the previous one. */
  delay?: number;
}

/** Width of `text` set in bold `fontFamily` at `fontSize` px, unscaled. */
export type TextMeasure = (text: string, fontSize: number, fontFamily: string) => number;

/** The local horizontal extent of each shape type with static geometry. */
export type ShapeExtents = Record<string, { minX: number; maxX: number }>;

/** What layout changes on one layer; absent fields are unchanged. */
export interface LayoutAdjustment {
  fontSize?: number;
  textValue?: string;
  /** Multiplies the layer's base scaleX and every scaleX key. */
  scaleXFactor?: number;
  /** Added to the layer's base position and every position key (parent space). */
  dx?: number;
  dy?: number;
  /** The layer is hidden: its opacity and every opacity key become 0. */
  hidden?: boolean;
}

/** One repeated copy of a layer, relative to the laid-out layer itself. */
export interface LayoutCopy {
  sourceId: string;
  /** 1 for the first copy after the layer. */
  index: number;
  dx: number;
  dy: number;
  rotation: number;
  scale: number;
  opacity: number;
  delay: number;
}

export interface LayoutResult {
  adjustments: Record<string, LayoutAdjustment>;
  copies: LayoutCopy[];
  /** The x shift each justified group gives its children (part of their `dx`). */
  justifyShifts: Record<string, number>;
}

/** The authored pose a layout is computed from. */
export interface LayoutPose {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

interface LayoutLayer {
  id: string;
  type: string;
  parentId?: string;
  isGroup?: boolean;
  textValue?: string;
  fontSize?: number;
  fontFamily?: string;
  width?: number;
  points?: Array<{ x: number; y: number }>;
  textFit?: TextFitSettings;
  fitToText?: FitToTextSettings;
  follow?: FollowSettings;
  justify?: JustifySettings;
  repeater?: RepeaterSettings;
}

export function createLayoutModifiers(shapeExtents: ShapeExtents) {
  const DEFAULT_MIN_SCALE = 0.5;
  const DEFAULT_PADDING = 24;
  const MAX_COPIES = 200;
  /** The box-like primitives a text can size (`utils/geometry/shapeGeometry`). */
  const SIZABLE = ['custom_box', 'custom_rect', 'custom_banner', 'custom_capsule', 'custom_card'];

  const finite = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
  const positive = (value: unknown): number | undefined => {
    const number = finite(value);
    return number !== undefined && number > 0 ? number : undefined;
  };
  const alignSign = (align: unknown): number => (align === 'left' ? 1 : align === 'right' ? -1 : 0);
  const sizableWidth = (type: string): number | undefined => {
    const extent = SIZABLE.indexOf(type) >= 0 ? shapeExtents[type] : undefined;
    return extent ? extent.maxX - extent.minX : undefined;
  };
  /** Every text an Auto Size shape sizes to, the first one first. */
  const fitTextIds = (settings: FitToTextSettings): string[] => {
    const ids = [settings.textLayerId];
    if (Array.isArray(settings.extraTextLayerIds)) {
      for (const id of settings.extraTextLayerIds) if (typeof id === 'string' && ids.indexOf(id) < 0) ids.push(id);
    }
    return ids;
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
   * character, so layout still behaves sensibly.
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
   * Every layer's layout. `poseOf` reads a layer's authored (unanimated) pose.
   */
  function resolveLayout(
    layers: readonly LayoutLayer[],
    poseOf: (layer: LayoutLayer) => LayoutPose,
    measure: TextMeasure,
  ): LayoutResult {
    const adjustments: Record<string, LayoutAdjustment> = Object.create(null);
    const copies: LayoutCopy[] = [];
    const justifyShifts: Record<string, number> = Object.create(null);
    const byId: Record<string, LayoutLayer> = Object.create(null);
    for (const layer of layers) if (!byId[layer.id]) byId[layer.id] = layer;
    const poses: Record<string, LayoutPose> = Object.create(null);
    const pose = (layer: LayoutLayer): LayoutPose => {
      if (!poses[layer.id]) {
        const raw = poseOf(layer) || ({} as LayoutPose);
        poses[layer.id] = {
          x: finite(raw.x) ?? 0,
          y: finite(raw.y) ?? 0,
          rotation: finite(raw.rotation) ?? 0,
          scaleX: finite(raw.scaleX) ?? 1,
          scaleY: finite(raw.scaleY) ?? 1,
        };
      }
      return poses[layer.id];
    };
    const adjust = (id: string): LayoutAdjustment => {
      if (!adjustments[id]) adjustments[id] = {};
      return adjustments[id];
    };
    /** Moves a layer along its own x axis (turned with it). */
    const shiftAlong = (layer: LayoutLayer, distance: number) => {
      if (!distance) return;
      const angle = (pose(layer).rotation * Math.PI) / 180;
      const adjustment = adjust(layer.id);
      adjustment.dx = (adjustment.dx || 0) + distance * Math.cos(angle);
      adjustment.dy = (adjustment.dy || 0) + distance * Math.sin(angle);
    };
    const parentOf = (layer: LayoutLayer) => layer.parentId || '';

    const sizers = layers.filter((layer) => layer.fitToText && typeof layer.fitToText.textLayerId === 'string' && sizableWidth(layer.type) !== undefined);
    /** A text's laid-out width in scene pixels (0 when hidden). */
    const textWidths: Record<string, number> = Object.create(null);

    // 1. Text boxes: size, characters, squeeze, hiding and alignment.
    for (const layer of layers) {
      if (layer.type !== 'custom_text') continue;
      const own = layer.textFit;
      const shapes = sizers.filter((shape) => fitTextIds(shape.fitToText!).indexOf(layer.id) >= 0);
      if (!own && shapes.length === 0) continue;
      if (own && own.hideWhenEmpty && !String(layer.textValue || '').trim()) {
        adjust(layer.id).hidden = true;
        textWidths[layer.id] = 0;
        continue;
      }
      const authoredText = layer.textValue || 'TEXT';
      const text = limitLength(authoredText, own && own.maxLength);
      const fontSize = positive(layer.fontSize) || 24;
      const fontFamily = layer.fontFamily || 'Outfit';
      const scale = Math.abs(pose(layer).scaleX) || 1;
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
      textWidths[layer.id] = width;
      if (text !== authoredText) adjust(layer.id).textValue = text;
      if (size !== fontSize) adjust(layer.id).fontSize = size;
      if (squeeze !== 1) adjust(layer.id).scaleXFactor = squeeze;
      shiftAlong(layer, (alignSign(own && own.align) * width) / 2);
    }

    // 2. Shapes sized to a text.
    for (const shape of sizers) {
      const settings = shape.fitToText!;
      // The widest of its texts; hidden only when every one of them is.
      let textWidth: number | undefined;
      let anyShown = false;
      for (const id of fitTextIds(settings)) {
        const width = textWidths[id];
        if (width === undefined) continue;
        const text = adjustments[id];
        if (text && text.hidden) continue;
        anyShown = true;
        textWidth = textWidth === undefined ? width : Math.max(textWidth, width);
      }
      if (textWidth === undefined) {
        if (!anyShown && fitTextIds(settings).some((id) => textWidths[id] !== undefined)) adjust(shape.id).hidden = true;
        continue;
      }
      const padding = Math.max(0, finite(settings.padding) ?? DEFAULT_PADDING);
      let width = textWidth + 2 * padding;
      const minWidth = positive(settings.minWidth);
      const maxWidth = positive(settings.maxWidth);
      if (minWidth !== undefined) width = Math.max(width, minWidth);
      if (maxWidth !== undefined) width = Math.min(width, Math.max(maxWidth, minWidth ?? 0));
      const base = pose(shape).scaleX;
      if (base === 0) continue;
      const authored = sizableWidth(shape.type)! * Math.abs(base);
      const factor = width / authored;
      if (!Number.isFinite(factor) || factor <= 0) continue;
      if (factor !== 1) adjust(shape.id).scaleXFactor = factor;
      shiftAlong(shape, (alignSign(settings.anchor) * (width - authored)) / 2);
    }

    // 3. Horizontal extents in the parent's space, as laid out so far. A
    // following layer's extent includes its follow (resolved on demand, in
    // dependency order; a cycle leaves the layers where they are).
    const followDone: Record<string, boolean> = Object.create(null);
    const following: Record<string, boolean> = Object.create(null);
    const localExtent = (layer: LayoutLayer): { minX: number; maxX: number } | undefined => {
      const adjustment = adjustments[layer.id];
      if (adjustment && adjustment.hidden) return { minX: 0, maxX: 0 };
      const scale = Math.abs(pose(layer).scaleX * ((adjustment && adjustment.scaleXFactor) || 1));
      if (layer.type === 'custom_text') {
        let width = textWidths[layer.id];
        if (width === undefined) width = measure(layer.textValue || 'TEXT', positive(layer.fontSize) || 24, layer.fontFamily || 'Outfit') * Math.abs(pose(layer).scaleX);
        return { minX: -width / 2, maxX: width / 2 };
      }
      if (layer.isGroup) {
        let minX = Infinity;
        let maxX = -Infinity;
        for (const child of layers) {
          if (child.parentId !== layer.id) continue;
          const extent = extentOf(child);
          if (!extent) continue;
          minX = Math.min(minX, extent.minX);
          maxX = Math.max(maxX, extent.maxX);
        }
        return minX <= maxX ? { minX: minX * scale, maxX: maxX * scale } : undefined;
      }
      const shape = shapeExtents[layer.type];
      if (shape) return { minX: shape.minX * scale, maxX: shape.maxX * scale };
      if (layer.type === 'custom_image' || layer.type === 'custom_video') {
        const half = (positive(layer.width) ?? (layer.type === 'custom_video' ? 200 : 180)) / 2;
        return { minX: -half * scale, maxX: half * scale };
      }
      if (layer.points && layer.points.length > 0) {
        let minX = Infinity;
        let maxX = -Infinity;
        for (const point of layer.points) {
          minX = Math.min(minX, point.x);
          maxX = Math.max(maxX, point.x);
        }
        return { minX: minX * scale, maxX: maxX * scale };
      }
      return undefined;
    };
    function extentOf(layer: LayoutLayer): { minX: number; maxX: number } | undefined {
      resolveFollow(layer);
      const local = localExtent(layer);
      if (!local) return undefined;
      const x = pose(layer).x + ((adjustments[layer.id] && adjustments[layer.id].dx) || 0);
      return { minX: x + Math.min(local.minX, local.maxX), maxX: x + Math.max(local.minX, local.maxX) };
    }
    function resolveFollow(layer: LayoutLayer): void {
      if (followDone[layer.id] || !layer.follow || following[layer.id]) return;
      following[layer.id] = true;
      const target = byId[layer.follow.targetLayerId];
      // A follow chain that comes back to this layer is a cycle: none of it moves.
      let link = target;
      let cyclic = false;
      for (let step = 0; link && link.follow && step < layers.length; step += 1) {
        if (link.follow.targetLayerId === layer.id) cyclic = true;
        link = byId[link.follow.targetLayerId];
      }
      if (target && !cyclic && target.id !== layer.id && parentOf(target) === parentOf(layer)) {
        const edges = extentOf(target);
        const own = localExtent(layer);
        if (edges && own && !following[target.id]) {
          // The layer's x is its gap to the edge: its near edge sits at the
          // target's edge plus x, wherever that edge goes.
          const right = layer.follow.side !== 'left';
          const near = right ? Math.min(own.minX, own.maxX) : Math.max(own.minX, own.maxX);
          const edge = right ? edges.maxX : edges.minX;
          const adjustment = adjust(layer.id);
          adjustment.dx = edge - near;
        }
        if (layer.follow.vertical === true) {
          adjust(layer.id).dy = pose(target).y + ((adjustments[target.id] && adjustments[target.id].dy) || 0);
        }
      }
      following[layer.id] = false;
      followDone[layer.id] = true;
    }
    for (const layer of layers) resolveFollow(layer);

    // 4. Justified groups, innermost first.
    const depthOf = (layer: LayoutLayer): number => {
      let depth = 0;
      let current = layer;
      while (current.parentId && byId[current.parentId] && depth < 64) {
        current = byId[current.parentId];
        depth += 1;
      }
      return depth;
    };
    const groups = layers.filter((layer) => layer.isGroup && layer.justify).sort((a, b) => depthOf(b) - depthOf(a));
    for (const group of groups) {
      let minX = Infinity;
      let maxX = -Infinity;
      const children = layers.filter((child) => child.parentId === group.id);
      for (const child of children) {
        const extent = extentOf(child);
        if (!extent || (adjustments[child.id] && adjustments[child.id].hidden)) continue;
        minX = Math.min(minX, extent.minX);
        maxX = Math.max(maxX, extent.maxX);
      }
      if (!(minX <= maxX)) continue;
      const mode = group.justify!.horizontal;
      const shift = mode === 'left' ? -minX : mode === 'right' ? -maxX : -(minX + maxX) / 2;
      if (!shift) continue;
      justifyShifts[group.id] = shift;
      for (const child of children) {
        const adjustment = adjust(child.id);
        adjustment.dx = (adjustment.dx || 0) + shift;
      }
    }

    // 5. Repeated copies.
    for (const layer of layers) {
      const settings = layer.repeater;
      if (!settings || layer.isGroup) continue;
      const count = Math.min(MAX_COPIES, Math.floor(finite(settings.count) ?? 1));
      if (count < 2) continue;
      const layout = settings.layout || 'line';
      const offsetX = finite(settings.offsetX) ?? 0;
      const offsetY = finite(settings.offsetY) ?? 0;
      const columns = Math.max(1, Math.floor(finite(settings.columns) ?? count));
      const radius = finite(settings.radius) ?? 0;
      const placeOf = (index: number): { x: number; y: number } => {
        if (layout === 'radial') {
          const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
          return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
        }
        if (layout === 'grid') return { x: (index % columns) * offsetX, y: Math.floor(index / columns) * offsetY };
        return { x: index * offsetX, y: index * offsetY };
      };
      // A ring is centred on the layer: the layer itself is its first place.
      const first = placeOf(0);
      if (first.x || first.y) {
        const adjustment = adjust(layer.id);
        adjustment.dx = (adjustment.dx || 0) + first.x;
        adjustment.dy = (adjustment.dy || 0) + first.y;
      }
      for (let index = 1; index < count; index += 1) {
        const place = placeOf(index);
        copies.push({
          sourceId: layer.id,
          index,
          dx: place.x - first.x,
          dy: place.y - first.y,
          rotation: index * (finite(settings.rotation) ?? 0),
          scale: Math.pow(Math.max(0, finite(settings.scale) ?? 1), index),
          opacity: Math.max(0, 1 - index * Math.min(1, Math.max(0, finite(settings.fade) ?? 0))),
          delay: index * Math.max(0, finite(settings.delay) ?? 0),
        });
      }
    }

    for (const id of Object.keys(adjustments)) {
      const adjustment = adjustments[id];
      if (adjustment.dx === 0) delete adjustment.dx;
      if (adjustment.dy === 0) delete adjustment.dy;
      if (Object.keys(adjustment).length === 0) delete adjustments[id];
    }
    return { adjustments, copies, justifyShifts };
  }

  type KeyList = Array<{ frame?: number; value?: unknown }>;
  type TrackLike = { id?: string; partId?: string; channels?: Record<string, unknown>; keyframes?: unknown[] };

  /** A track's channel keys and legacy composite keys, each value mapped by `field`. */
  function mapTrack<T extends TrackLike>(track: T, map: Record<string, (value: number) => number>, frameShift = 0): T {
    const next = { ...track };
    if (track.channels) {
      const channels: Record<string, unknown> = { ...track.channels };
      for (const name of Object.keys(channels)) {
        const list = channels[name];
        if (!Array.isArray(list)) continue;
        const valueMap = map[name];
        if (!valueMap && !frameShift) continue;
        channels[name] = (list as KeyList).map((key) => {
          const moved = frameShift && typeof key.frame === 'number' ? { ...key, frame: key.frame + frameShift } : { ...key };
          if (valueMap && typeof key.value === 'number') moved.value = valueMap(key.value);
          return moved;
        });
      }
      next.channels = channels;
    }
    if (Array.isArray(track.keyframes)) {
      next.keyframes = track.keyframes.map((key) => {
        const legacy = { ...(key as Record<string, unknown>) };
        if (frameShift && typeof legacy.frame === 'number') legacy.frame = legacy.frame + frameShift;
        for (const field of Object.keys(map)) {
          if (typeof legacy[field] === 'number') legacy[field] = map[field](legacy[field] as number);
        }
        return legacy;
      });
    }
    return next;
  }

  /** The value maps that apply one adjustment to a pose and its keys. */
  function adjustmentMaps(adjustment: LayoutAdjustment | undefined): Record<string, (value: number) => number> {
    const map: Record<string, (value: number) => number> = {};
    if (!adjustment) return map;
    const factor = adjustment.scaleXFactor;
    if (factor !== undefined) map.scaleX = (value) => value * factor;
    if (adjustment.dx) map.x = (value) => value + adjustment.dx!;
    if (adjustment.dy) map.y = (value) => value + adjustment.dy!;
    if (adjustment.hidden) map.opacity = () => 0;
    return map;
  }

  function copyMaps(copy: LayoutCopy): Record<string, (value: number) => number> {
    const map: Record<string, (value: number) => number> = {};
    if (copy.dx) map.x = (value) => value + copy.dx;
    if (copy.dy) map.y = (value) => value + copy.dy;
    if (copy.rotation) map.rotation = (value) => value + copy.rotation;
    if (copy.scale !== 1) {
      map.scaleX = (value) => value * copy.scale;
      map.scaleY = (value) => value * copy.scale;
    }
    if (copy.opacity !== 1) map.opacity = (value) => value * copy.opacity;
    return map;
  }

  const copyIdOf = (id: string, index: number): string => id + '__copy' + index;
  const TIMING_FIELDS = ['inAnimTimelineStart', 'inAnimTimelineEnd', 'outAnimTimelineStart', 'outAnimTimelineEnd'];

  /**
   * Lays out a list of layers and their tracks. `readPose`/`writePose` adapt
   * the two layer shapes (SceneData's flat pose, the editor's baseTransform).
   * Copies are inserted before their layer, so the layer paints on top.
   */
  function applyLayout<L extends LayoutLayer & { name?: string; zIndex?: number }, T extends TrackLike>(
    layers: L[],
    tracks: T[],
    readPose: (layer: L) => LayoutPose & { opacity: number },
    writePose: (layer: L, pose: Partial<LayoutPose & { opacity: number }>) => L,
    measure: TextMeasure,
  ): { layers: L[]; tracks: T[]; result: LayoutResult } {
    const result = resolveLayout(layers, (layer) => readPose(layer as L), measure);
    const { adjustments, copies } = result;
    if (Object.keys(adjustments).length === 0 && copies.length === 0) return { layers, tracks, result };

    const laidOut = layers.map((layer) => {
      const adjustment = adjustments[layer.id];
      if (!adjustment) return layer;
      const current = readPose(layer);
      let next = {
        ...layer,
        ...(adjustment.fontSize !== undefined ? { fontSize: adjustment.fontSize } : {}),
        ...(adjustment.textValue !== undefined ? { textValue: adjustment.textValue } : {}),
      } as L;
      const posePatch: Partial<LayoutPose & { opacity: number }> = {};
      if (adjustment.scaleXFactor !== undefined) posePatch.scaleX = current.scaleX * adjustment.scaleXFactor;
      if (adjustment.dx) posePatch.x = current.x + adjustment.dx;
      if (adjustment.dy) posePatch.y = current.y + adjustment.dy;
      if (adjustment.hidden) posePatch.opacity = 0;
      if (Object.keys(posePatch).length > 0) next = writePose(next, posePatch);
      return next;
    });
    const laidOutTracks = tracks.map((track) => {
      const adjustment = track.partId ? adjustments[track.partId] : undefined;
      return adjustment ? mapTrack(track, adjustmentMaps(adjustment)) : track;
    });
    if (copies.length === 0) return { layers: laidOut, tracks: laidOutTracks, result };

    const layerById: Record<string, L> = Object.create(null);
    for (const layer of laidOut) layerById[layer.id] = layer;
    const trackByPart: Record<string, T> = Object.create(null);
    for (const track of laidOutTracks) if (track.partId && !trackByPart[track.partId]) trackByPart[track.partId] = track;
    const copiesOf: Record<string, L[]> = Object.create(null);
    const copyTracks: T[] = [];
    for (const copy of copies) {
      const source = layerById[copy.sourceId];
      if (!source) continue;
      const id = copyIdOf(source.id, copy.index);
      const current = readPose(source);
      const clone = { ...source, id, name: (source.name || source.id) + ' ' + (copy.index + 1), repeatSourceId: source.id } as unknown as Record<string, unknown>;
      delete clone.fitToText;
      delete clone.follow;
      delete clone.repeater;
      delete clone.textFit;
      if (copy.delay) {
        for (const field of TIMING_FIELDS) if (typeof clone[field] === 'number') clone[field] = (clone[field] as number) + copy.delay;
      }
      const placed = writePose(clone as unknown as L, {
        x: current.x + copy.dx,
        y: current.y + copy.dy,
        rotation: current.rotation + copy.rotation,
        scaleX: current.scaleX * copy.scale,
        scaleY: current.scaleY * copy.scale,
        opacity: current.opacity * copy.opacity,
      });
      (copiesOf[source.id] = copiesOf[source.id] || []).push(placed);
      const sourceTrack = trackByPart[source.id];
      if (sourceTrack) {
        copyTracks.push({ ...mapTrack(sourceTrack, copyMaps(copy), copy.delay), id: (sourceTrack.id || source.id) + '__copy' + copy.index, partId: id });
      }
    }
    const withCopies: L[] = [];
    for (const layer of laidOut) {
      const own = copiesOf[layer.id];
      // The last copy paints first: copies stack behind the layer, in order.
      if (own) for (let index = own.length - 1; index >= 0; index -= 1) withCopies.push(own[index]);
      withCopies.push(layer);
    }
    return { layers: withCopies, tracks: laidOutTracks.concat(copyTracks), result };
  }

  type SceneLike = {
    layers: Array<LayoutLayer & { x?: number; y?: number; rotation?: number; scaleX?: number; scaleY?: number; opacity?: number; name?: string; zIndex?: number }>;
    tracks?: TrackLike[];
  };

  /** The scene (SceneData shape: the pose on the layer) laid out; the same object when nothing changes. */
  function applyLayoutToScene<S extends SceneLike>(scene: S, measure: TextMeasure = measureTextWidth): S {
    type Layer = S['layers'][number];
    const { layers, tracks } = applyLayout<Layer, TrackLike>(
      scene.layers,
      scene.tracks || [],
      (layer) => ({ x: layer.x ?? 0, y: layer.y ?? 0, rotation: layer.rotation ?? 0, scaleX: layer.scaleX ?? 1, scaleY: layer.scaleY ?? 1, opacity: layer.opacity ?? 1 }),
      (layer, patch) => ({ ...layer, ...patch }),
      measure,
    );
    if (layers === scene.layers && tracks === (scene.tracks || [])) return scene;
    return { ...scene, layers, tracks: scene.tracks ? tracks : scene.tracks };
  }

  return { resolveLayout, applyLayout, applyLayoutToScene, mapTrack, measureTextWidth, limitLength, copyIdOf, fitTextIds };
}

/** The horizontal extent of every shape type with static geometry. */
export const SHAPE_EXTENTS: ShapeExtents = (() => {
  const types: BodyPartType[] = ['custom_star', 'custom_circle', 'custom_box', 'custom_rect', 'custom_triangle', 'custom_parallelogram', 'custom_banner', 'custom_capsule', 'custom_diamond', 'custom_card'];
  const extents: ShapeExtents = {};
  for (const type of types) {
    const geometry = getShapeGeometry(type);
    if (!geometry) continue;
    if (geometry.kind === 'circle') extents[type] = { minX: -geometry.r, maxX: geometry.r };
    else if (geometry.kind === 'polygon') extents[type] = { minX: Math.min(...geometry.points.map((point) => point.x)), maxX: Math.max(...geometry.points.map((point) => point.x)) };
    else extents[type] = { minX: geometry.x, maxX: geometry.x + geometry.width };
  }
  return extents;
})();

const layoutModifiers = createLayoutModifiers(SHAPE_EXTENTS);
export const { resolveLayout, applyLayoutToScene, mapTrack, measureTextWidth, limitLength, copyIdOf, fitTextIds } = layoutModifiers;

type EditorPart = LayoutLayer & {
  name?: string;
  zIndex?: number;
  baseTransform: { x: number; y: number; rotation: number; scaleX: number; scaleY: number; opacity: number };
};

/**
 * The editor's layers (`baseTransform`) and tracks laid out; the same arrays
 * when nothing changes. Render-only: the result is never stored, so the
 * authored values stay what the user typed. Copies carry `repeatSourceId`.
 */
export function applyLayoutToParts<P extends EditorPart, T extends { id: string; partId: string; channels?: Record<string, unknown>; keyframes?: unknown[] }>(
  parts: P[],
  tracks: T[],
  measure: TextMeasure = measureTextWidth,
): { parts: P[]; tracks: T[]; result: LayoutResult } {
  const { layers, tracks: laidOutTracks, result } = layoutModifiers.applyLayout<P, T>(
    parts,
    tracks,
    (part) => part.baseTransform,
    (part, patch) => ({ ...part, baseTransform: { ...part.baseTransform, ...patch } }),
    measure,
  );
  return { parts: layers, tracks: laidOutTracks, result };
}

/**
 * Settings edits that keep the picture still: every layer whose laid-out
 * position the edit would move is moved back by its authored position and
 * position keys, so binding a follow, changing an anchor or justifying a group
 * changes how the layers react to their content, not where they are now.
 */
export function compensateLayoutChange<P extends EditorPart, T extends { id: string; partId: string; channels?: Record<string, unknown>; keyframes?: unknown[] }>(
  before: P[],
  after: P[],
  tracks: T[],
  measure: TextMeasure = measureTextWidth,
): { parts: P[]; tracks: T[] } {
  const poseOf = (layer: LayoutLayer) => (layer as P).baseTransform;
  /** Each layer's laid-out position in its parent, leaving out its group's justify shift. */
  const placesOf = (parts: P[]) => {
    const result = resolveLayout(parts, poseOf, measure);
    const places: Record<string, { x: number; y: number }> = {};
    for (const part of parts) {
      const adjustment = result.adjustments[part.id];
      const justify = (part.parentId && result.justifyShifts[part.parentId]) || 0;
      places[part.id] = {
        x: part.baseTransform.x + ((adjustment && adjustment.dx) || 0) - justify,
        y: part.baseTransform.y + ((adjustment && adjustment.dy) || 0),
      };
    }
    return { places, justifyShifts: result.justifyShifts };
  };
  const target = placesOf(before);
  let parts = after;
  let moved: Record<string, { x: number; y: number }> = {};
  // A follower's place depends on where its target ends up, so this settles
  // one link of a follow chain per pass.
  for (let pass = 0; pass < 8; pass += 1) {
    const current = placesOf(parts).places;
    const moves: Record<string, { x: number; y: number }> = {};
    for (const part of parts) {
      const want = target.places[part.id];
      const have = current[part.id];
      if (!want || !have) continue;
      const x = want.x - have.x;
      const y = want.y - have.y;
      if (Math.abs(x) > 1e-6 || Math.abs(y) > 1e-6) moves[part.id] = { x, y };
    }
    if (Object.keys(moves).length === 0) break;
    parts = parts.map((part) => {
      const move = moves[part.id];
      return move ? { ...part, baseTransform: { ...part.baseTransform, x: part.baseTransform.x + move.x, y: part.baseTransform.y + move.y } } : part;
    });
    for (const id of Object.keys(moves)) {
      const total = moved[id] || { x: 0, y: 0 };
      moved = { ...moved, [id]: { x: total.x + moves[id].x, y: total.y + moves[id].y } };
    }
  }
  // A justified group keeps its children where they are on screen by moving
  // its own origin by the change of its shift (turned and scaled with it).
  const shifts = placesOf(parts).justifyShifts;
  parts = parts.map((part) => {
    const change = (shifts[part.id] || 0) - (target.justifyShifts[part.id] || 0);
    if (!change || !part.isGroup) return part;
    const angle = (part.baseTransform.rotation * Math.PI) / 180;
    const distance = -change * part.baseTransform.scaleX;
    const move = { x: distance * Math.cos(angle), y: distance * Math.sin(angle) };
    const total = moved[part.id] || { x: 0, y: 0 };
    moved = { ...moved, [part.id]: { x: total.x + move.x, y: total.y + move.y } };
    return { ...part, baseTransform: { ...part.baseTransform, x: part.baseTransform.x + move.x, y: part.baseTransform.y + move.y } };
  });
  if (Object.keys(moved).length === 0) return { parts, tracks };
  return {
    parts,
    tracks: tracks.map((track) => {
      const move = moved[track.partId];
      return move ? mapTrack(track, { x: (value) => value + move.x, y: (value) => value + move.y }) : track;
    }),
  };
}
