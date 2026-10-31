/**
 * The OGraf graphic runtime: the code an exported package runs in the host.
 *
 * The package is a standalone ES module, so it cannot import the editor. The
 * runtime is therefore written as ONE self-contained factory: nothing inside
 * `createGraphicRuntime` refers to this module's scope, and everything it needs
 * — the scene, its public bindings, packaged asset paths, the module URL, the
 * element base class and the editor helpers it shares — comes in through the
 * environment. `runtimeTemplate` embeds the factory's own source with
 * `Function.prototype.toString` and calls it, the way the affine algebra is
 * carried, so the editor type-checks, lints and unit-tests the same code the
 * host executes.
 *
 * Keep it self-contained: an import, or a module-level value used inside the
 * factory, works in the editor and breaks in the package. Types are free to
 * live outside it, because they are erased.
 */
import type { Transform } from '../../types/animator';
import type { createWorldAffineAlgebra, WorldAffine } from '../../utils/geometry/containerMath';
import type { createShapeAppearance } from '../../utils/layers/shapeAppearance';
import type { describePaint, describeText } from '../../utils/layers/drawDescriptor';

export interface RuntimePoint {
  x: number;
  y: number;
}

export interface RuntimeKeyframe<T = number> {
  id?: string;
  frame: number;
  value: T;
  easing?: string;
  templateId?: string;
  bezierControlPoints?: number[];
  bezierIn?: RuntimePoint;
  bezierOut?: RuntimePoint;
}

export interface RuntimePathPoint extends RuntimePoint {
  id: string;
  kind?: string;
  handleIn?: RuntimePoint;
  handleOut?: RuntimePoint;
}

export interface RuntimePath {
  version?: number;
  coordinateSpace?: string;
  closed?: boolean;
  points: RuntimePathPoint[];
}

export interface RuntimeMask {
  id: string;
  mode?: string;
  enabled?: boolean;
  inverted?: boolean;
  opacity?: number;
  feather?: number;
  expansion?: number;
  path: RuntimePath;
}

export interface RuntimeLayer {
  id: string;
  type: string;
  zIndex: number;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  visible?: boolean;
  parentId?: string;
  booleanGroupId?: string;
  width?: number;
  height?: number;
  borderRadius?: number;
  path?: RuntimePath;
  points?: RuntimePoint[];
  strokeLinejoin?: string;
  fillColor?: string;
  fillEnabled?: boolean;
  fillOpacity?: number;
  strokeColor?: string;
  strokeEnabled?: boolean;
  strokeOpacity?: number;
  strokeWidth?: number;
  strokeAlignment?: string;
  textValue?: string;
  fontSize?: number;
  fontFamily?: string;
  textOrigin?: string;
  imageUrl?: string;
  trimPathEnabled?: boolean;
  trimPathStart?: number;
  trimPathEnd?: number;
  trimPathOffset?: number;
  masks?: RuntimeMask[];
  matte?: { sourcePartId?: string; mode?: string; inverted?: boolean; enabled?: boolean };
  trackMatte?: { sourceLayerId: string; mode: string; inverted?: boolean; sourceVisible?: boolean; enabled?: boolean };
  [field: string]: unknown;
}

export interface RuntimeTrack {
  partId: string;
  channels?: Record<string, RuntimeKeyframe[] | undefined>;
  keyframes?: Array<RuntimeKeyframe<unknown> & { transform?: Record<string, unknown> }>;
  maskChannels?: Record<string, RuntimeKeyframe[] | undefined>;
  maskPathChannels?: Record<string, RuntimeKeyframe<RuntimePath>[] | undefined>;
}

export interface RuntimeScene {
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  activeTemplateId?: string;
  layers: RuntimeLayer[];
  tracks: RuntimeTrack[];
}

export interface RuntimeBinding {
  layerId: string;
  property: string;
  allowedValues?: string[];
}

export type RuntimeFontFace = string | { path: string; unicodeRange?: string; fontWeight?: string };

export type RuntimeWorldTransform = Transform & { affine?: WorldAffine };

export interface EvaluatedRuntimeMask extends RuntimeMask {
  opacity: number;
  feather: number;
  expansion: number;
}

export interface EvaluatedRuntimeLayer extends RuntimeLayer {
  transform: RuntimeWorldTransform;
  visible: boolean;
  trimPathStart: number;
  trimPathEnd: number;
  trimPathOffset: number;
  masks: EvaluatedRuntimeMask[];
}

export interface RuntimeActionResult {
  statusCode: number;
  statusMessage?: string;
  currentStep?: number;
}

export interface GraphicRuntimeEnvironment {
  scene: RuntimeScene;
  bindings: { text: Record<string, RuntimeBinding>; image: Record<string, RuntimeBinding>; color: Record<string, RuntimeBinding> };
  imageReferences: Record<string, string>;
  fontReferences: Record<string, RuntimeFontFace | RuntimeFontFace[]>;
  /** The package module's own URL; packaged relative paths resolve against it. */
  moduleUrl: string;
  /** The element the graphic extends: `HTMLElement` in a host. */
  elementBase: typeof HTMLElement;
  /** The text box centre below the baseline, in em (`utils/geometry/textOrigin`). */
  textBoxCentreEm: number;
  /** The editor's paint order (`utils/layers/stackingOrder`). */
  compareByStackingOrder: (a: { zIndex: number }, b: { zIndex: number }) => number;
  /** The editor's matte precedence (`utils/layers/matte`). */
  resolveMatteSource: (part: Pick<RuntimeLayer, 'matte' | 'trackMatte'>) => { sourceId: string; kind: 'track' | 'legacy' } | undefined;
  /** The editor's world-affine algebra (`utils/geometry/containerMath`). */
  affine: ReturnType<typeof createWorldAffineAlgebra>;
  /** The editor's appearance rules (`utils/layers/shapeAppearance`). */
  resolveShapeAppearance: (part: RuntimeLayer) => ReturnType<ReturnType<typeof createShapeAppearance>['resolveShapeAppearance']>;
  /** What a layer paints and writes (`utils/layers/drawDescriptor`). */
  describePaint: typeof describePaint;
  describeText: typeof describeText;
}

export function createGraphicRuntime(environment: GraphicRuntimeEnvironment) {
  const {
    scene: SCENE,
    bindings: PUBLIC_BINDINGS,
    imageReferences: IMAGE_REFERENCES,
    fontReferences: FONT_REFERENCES,
    moduleUrl,
    elementBase,
    textBoxCentreEm,
    compareByStackingOrder,
    resolveMatteSource,
    resolveShapeAppearance,
    describePaint,
    describeText,
  } = environment;
  const { affineOfTransform, composeWorldTransform, composeAffine, applyAffine, withWorldAffine, worldAffineOf, affineTrsReading } = environment.affine;

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function escapeXml(value: unknown): string {
    return String(value).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;').split("'").join('&apos;');
  }

  function assertKeyframe(keyframe: RuntimeKeyframe<unknown>, path: string, scalar: boolean): void {
    if (!keyframe || typeof keyframe !== 'object' || Array.isArray(keyframe)) throw new Error('Invalid keyframe: ' + path);
    if (typeof keyframe.frame !== 'number' || !Number.isFinite(keyframe.frame)) throw new Error('Invalid keyframe frame: ' + path);
    if (scalar && (typeof keyframe.value !== 'number' || !Number.isFinite(keyframe.value))) throw new Error('Invalid keyframe value: ' + path);
    for (const handle of ['bezierIn', 'bezierOut'] as const) {
      const value = keyframe[handle];
      if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.x !== 'number' || !Number.isFinite(value.x) || typeof value.y !== 'number' || !Number.isFinite(value.y))) {
        throw new Error('Invalid keyframe handle: ' + path);
      }
    }
    if (keyframe.bezierControlPoints !== undefined && (!Array.isArray(keyframe.bezierControlPoints) || keyframe.bezierControlPoints.length !== 4 || keyframe.bezierControlPoints.some((value) => typeof value !== 'number' || !Number.isFinite(value)))) {
      throw new Error('Invalid keyframe control points: ' + path);
    }
  }

  function assertSafeScene(scene: RuntimeScene): void {
    const fields = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity', 'zIndex'];
    const optional = ['fillOpacity', 'strokeWidth', 'strokeOpacity', 'borderRadius', 'fontSize', 'width', 'height'];
    for (const layer of scene.layers || []) {
      for (const field of fields.concat(optional)) {
        if (layer[field] !== undefined && (typeof layer[field] !== 'number' || !Number.isFinite(layer[field]))) throw new Error('Invalid numeric scene value: ' + field);
      }
      for (const mask of layer.masks || []) {
        if (!['add', 'subtract', 'intersect', 'difference'].includes(mask.mode as string)) throw new Error('Invalid mask mode');
      }
      if (layer.matte && layer.matte.mode !== undefined && !['clip', 'alpha', 'luminance'].includes(layer.matte.mode)) throw new Error('Invalid matte mode');
      if (layer.trackMatte && !['alpha', 'luminance'].includes(layer.trackMatte.mode)) throw new Error('Invalid track matte mode');
    }
    const relationships = new Map<string, string>();
    for (const layer of scene.layers || []) {
      const parentId = layer.parentId || layer.booleanGroupId;
      if (!parentId) continue;
      if (parentId === '__proto__' || parentId === 'constructor' || parentId === 'prototype') throw new Error('Invalid layer parent: ' + layer.id);
      relationships.set(layer.id, parentId);
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string): void => {
      if (visiting.has(id)) throw new Error('Layer parent cycle detected: ' + id);
      if (visited.has(id)) return;
      visiting.add(id);
      const parentId = relationships.get(id);
      if (parentId) visit(parentId);
      visiting.delete(id);
      visited.add(id);
    };
    for (const id of relationships.keys()) visit(id);
    for (const track of scene.tracks || []) {
      for (const keyframe of track.keyframes || []) {
        assertKeyframe(keyframe, 'legacy', false);
        if (!keyframe.transform || typeof keyframe.transform !== 'object' || Array.isArray(keyframe.transform)) throw new Error('Invalid legacy transform');
        for (const field of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']) {
          if (typeof keyframe.transform[field] !== 'number' || !Number.isFinite(keyframe.transform[field])) throw new Error('Invalid legacy transform field: ' + field);
        }
      }
      for (const keyframes of Object.values(track.channels || {})) for (const keyframe of keyframes || []) assertKeyframe(keyframe, 'channel', true);
      for (const keyframes of Object.values(track.maskChannels || {})) for (const keyframe of keyframes || []) assertKeyframe(keyframe, 'mask-channel', true);
      for (const keyframes of Object.values(track.maskPathChannels || {})) {
        for (const keyframe of keyframes || []) {
          assertKeyframe(keyframe, 'mask-path-channel', false);
          if (!keyframe.value || typeof keyframe.value !== 'object' || !Array.isArray(keyframe.value.points)) throw new Error('Invalid mask path keyframe');
          for (const point of keyframe.value.points) {
            if (!point || typeof point.x !== 'number' || !Number.isFinite(point.x) || typeof point.y !== 'number' || !Number.isFinite(point.y)) throw new Error('Invalid mask path point');
            for (const handle of ['handleIn', 'handleOut'] as const) {
              const value = point[handle];
              if (value !== undefined && (!value || typeof value.x !== 'number' || !Number.isFinite(value.x) || typeof value.y !== 'number' || !Number.isFinite(value.y))) throw new Error('Invalid mask path handle');
            }
          }
        }
      }
    }
  }

  // Generated SVG ids: one deterministic, collision-free id per logical name.
  const RUNTIME_ID_CACHE: Record<string, string> = Object.create(null);
  const RUNTIME_ID_OWNERS: Record<string, string> = Object.create(null);
  function runtimeId(...parts: unknown[]): string {
    const logical = JSON.stringify(parts);
    if (Object.prototype.hasOwnProperty.call(RUNTIME_ID_CACHE, logical)) return RUNTIME_ID_CACHE[logical];
    const base = parts
      .filter((part) => part !== undefined && part !== null && part !== '')
      .map((part) => {
        const safe = String(part).replace(/[^a-zA-Z0-9_-]/gu, '_');
        return safe || '_';
      })
      .join('-')
      .replace(/^[0-9]/u, '_$&');
    let id = base || '_';
    let suffix = 2;
    while (Object.prototype.hasOwnProperty.call(RUNTIME_ID_OWNERS, id) && RUNTIME_ID_OWNERS[id] !== logical) id = base + '-' + suffix++;
    RUNTIME_ID_CACHE[logical] = id;
    RUNTIME_ID_OWNERS[id] = logical;
    return id;
  }

  function cssString(value: unknown): string {
    return JSON.stringify(String(value)).split('<').join('\\u003c').split('>').join('\\u003e');
  }

  function resourceUrl(value: unknown): string {
    const text = String(value);
    return text.includes(':') || text.startsWith('//') ? text : new URL(text, moduleUrl).href;
  }

  function fontStyles(): string {
    return Object.keys(FONT_REFERENCES).map((family) => ([] as RuntimeFontFace[]).concat(FONT_REFERENCES[family]).map((face) => {
      const path = typeof face === 'string' ? face : face.path;
      const range = typeof face === 'string' ? '' : String(face.unicodeRange || '');
      const weight = typeof face === 'string' ? '' : String(face.fontWeight || '');
      return '@font-face{font-family:' + cssString(family) + ';'
        + (/^[0-9]{3}( [0-9]{3})?$/u.test(weight) ? 'font-weight:' + weight + ';' : '')
        + 'src:url(' + cssString(resourceUrl(path)) + ');'
        + (/^[U+0-9A-Fa-f?, -]+$/u.test(range) ? 'unicode-range:' + range + ';' : '')
        + '}';
    }).join('')).join('');
  }

  function solveCubicBezier(x1: number, y1: number, x2: number, y2: number, input: number): number {
    if (input <= 0) return 0;
    if (input >= 1) return 1;
    let t = input;
    for (let index = 0; index < 8; index += 1) {
      const currentX = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
      const slope = 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
      if (Math.abs(slope) < 1e-6) break;
      t = clamp(t - (currentX - input) / slope, 0, 1);
    }
    return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  }

  function applyEasing(value: number, type: string | undefined, controlPoints: number[] | undefined, temporal: { out: RuntimePoint; in: RuntimePoint } | undefined): number {
    const progress = clamp(value, 0, 1);
    if (type === 'hold') return 0;
    if (temporal) return solveCubicBezier(temporal.out.x, temporal.out.y, temporal.in.x, temporal.in.y, progress);
    if (controlPoints) return solveCubicBezier(controlPoints[0], controlPoints[1], controlPoints[2], controlPoints[3], progress);
    if (type === 'easeIn') return solveCubicBezier(0.42, 0, 1, 1, progress);
    if (type === 'easeOut') return solveCubicBezier(0, 0, 0.58, 1, progress);
    if (type === 'easeInOut' || type === 'cubic_bezier' || type === 'bezier' || type === 'autoBezier') return solveCubicBezier(0.42, 0, 0.58, 1, progress);
    if (type === 'bounce') {
      const n1 = 7.5625;
      const d1 = 2.75;
      let x = progress;
      if (x < 1 / d1) return n1 * x * x;
      if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
      if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }
    if (type === 'elastic') {
      const c4 = (2 * Math.PI) / 3;
      return progress === 0 ? 0 : progress === 1 ? 1 : -Math.pow(2, 10 * progress - 10) * Math.sin((progress * 10 - 10.75) * c4);
    }
    if (type === 'anticipate') return solveCubicBezier(0.6, -0.28, 0.735, 0.045, progress);
    if (type === 'overshoot') return solveCubicBezier(0.175, 0.885, 0.32, 1.275, progress);
    return progress;
  }

  function normTrim01(value: number, fallback: number): number {
    const safe = Number.isFinite(value) ? value : fallback;
    return clamp(safe, 0, 1);
  }

  function normTrimOffsetDegrees(value: number): number {
    if (!Number.isFinite(value)) return 0;
    const turns = value % 360;
    return turns < 0 ? turns + 360 : turns;
  }

  function normMaskOpacity(value: number): number {
    return Number.isFinite(value) ? clamp(value, 0, 1) : 1;
  }

  function normMaskFeather(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function normMaskExpansion(value: number): number {
    return Number.isFinite(value) ? value : 0;
  }

  function deriveAutoBezier(previous: RuntimeKeyframe, next: RuntimeKeyframe, previousPrevious: RuntimeKeyframe | undefined, nextNext: RuntimeKeyframe | undefined): number[] {
    const duration = Math.max(1, next.frame - previous.frame);
    const delta = next.value - previous.value;
    if (Math.abs(delta) < 1e-8) return [1 / 3, 0, 2 / 3, 1];
    const previousSlope = previousPrevious ? (next.value - previousPrevious.value) / Math.max(1, next.frame - previousPrevious.frame) : delta / duration;
    const nextSlope = nextNext ? (nextNext.value - previous.value) / Math.max(1, nextNext.frame - previous.frame) : delta / duration;
    return [1 / 3, clamp(previousSlope * duration / delta / 3, 0, 1), 2 / 3, clamp(1 - nextSlope * duration / delta / 3, 0, 1)];
  }

  function channelValue(keyframes: RuntimeKeyframe[] | undefined, frame: number, fallback: number): number {
    const values = (keyframes || []).filter((keyframe) => (keyframe.templateId || 'Sequence') === (SCENE.activeTemplateId || 'Sequence')).slice().sort((a, b) => a.frame - b.frame);
    if (!values.length) return fallback;
    if (frame <= values[0].frame) return values[0].value;
    for (let exact = 0; exact < values.length; exact += 1) {
      if (values[exact].frame === frame) return values[exact].value;
    }
    if (frame >= values[values.length - 1].frame) return values[values.length - 1].value;
    let previous = values[0];
    let next = values[values.length - 1];
    let bracket = 0;
    for (let index = 0; index < values.length - 1; index += 1) {
      if (frame >= values[index].frame && frame <= values[index + 1].frame) {
        previous = values[index];
        next = values[index + 1];
        bracket = index;
        break;
      }
    }
    const progress = (frame - previous.frame) / Math.max(1, next.frame - previous.frame);
    const temporal = previous.bezierOut && next.bezierIn ? { out: previous.bezierOut, in: next.bezierIn } : undefined;
    const controlPoints = previous.bezierControlPoints || (previous.easing === 'autoBezier' ? deriveAutoBezier(previous, next, values[bracket - 1], values[bracket + 2]) : undefined);
    const eased = applyEasing(progress, previous.easing, controlPoints, temporal);
    return previous.value + (next.value - previous.value) * eased;
  }

  function topologyCompatible(first: RuntimePath, second: RuntimePath): boolean {
    return Boolean(first && second && first.closed === second.closed && first.coordinateSpace === second.coordinateSpace && first.points.length === second.points.length && first.points.every((point, index) => point.id === second.points[index].id));
  }

  function interpolatePath(first: RuntimePath, second: RuntimePath, progress: number): RuntimePath {
    if (!topologyCompatible(first, second)) return first;
    const t = clamp(progress, 0, 1);
    const lerp = (a: number, b: number) => a + (b - a) * t;
    const handle = (a: RuntimePoint | undefined, b: RuntimePoint | undefined): RuntimePoint | undefined => {
      if (!a && !b) return undefined;
      // One of the two exists past the check above.
      const start = (a || b)!;
      const end = (b || a)!;
      return { x: lerp(start.x, end.x), y: lerp(start.y, end.y) };
    };
    return {
      version: 1,
      coordinateSpace: first.coordinateSpace,
      closed: first.closed,
      points: first.points.map((point, index) => {
        const target = second.points[index];
        const inHandle = handle(point.handleIn, target.handleIn);
        const outHandle = handle(point.handleOut, target.handleOut);
        return {
          id: point.id,
          x: lerp(point.x, target.x),
          y: lerp(point.y, target.y),
          ...(inHandle ? { handleIn: inHandle } : {}),
          ...(outHandle ? { handleOut: outHandle } : {}),
          kind: t < 0.5 ? point.kind : target.kind,
        };
      }),
    };
  }

  function pathChannelValue(keyframes: RuntimeKeyframe<RuntimePath>[] | undefined, frame: number, fallback: RuntimePath): RuntimePath {
    const values = (keyframes || []).filter((keyframe) => (keyframe.templateId || 'Sequence') === (SCENE.activeTemplateId || 'Sequence')).slice().sort((a, b) => a.frame - b.frame);
    if (!values.length) return fallback;
    for (let exact = 0; exact < values.length; exact += 1) {
      if (values[exact].frame === frame) return values[exact].value;
    }
    if (frame <= values[0].frame) return values[0].value;
    if (frame >= values[values.length - 1].frame) return values[values.length - 1].value;
    let previous = values[0];
    let next = values[values.length - 1];
    for (let index = 0; index < values.length - 1; index += 1) {
      if (frame >= values[index].frame && frame <= values[index + 1].frame) {
        previous = values[index];
        next = values[index + 1];
        break;
      }
    }
    const progress = (frame - previous.frame) / Math.max(1, next.frame - previous.frame);
    const temporal = previous.bezierOut && next.bezierIn ? { out: previous.bezierOut, in: next.bezierIn } : undefined;
    return interpolatePath(previous.value, next.value, applyEasing(progress, previous.easing, previous.bezierControlPoints, temporal));
  }

  function pathD(path: RuntimePath | undefined, map: (point: RuntimePoint) => RuntimePoint): string {
    if (!path || !path.points || path.points.length < 2) return '';
    const points = path.points.map(map);
    const mappedHandle = (handle: RuntimePoint | undefined, fallback: RuntimePoint) => map(handle || fallback);
    let value = 'M ' + points[0].x + ' ' + points[0].y;
    for (let index = 1; index < points.length; index += 1) {
      const previous = path.points[index - 1];
      const current = path.points[index];
      const out = mappedHandle(previous.handleOut, previous);
      const incoming = mappedHandle(current.handleIn, current);
      value += previous.handleOut || current.handleIn
        ? ' C ' + out.x + ' ' + out.y + ', ' + incoming.x + ' ' + incoming.y + ', ' + points[index].x + ' ' + points[index].y
        : ' L ' + points[index].x + ' ' + points[index].y;
    }
    if (path.closed) {
      const previous = path.points[path.points.length - 1];
      const current = path.points[0];
      const out = mappedHandle(previous.handleOut, previous);
      const incoming = mappedHandle(current.handleIn, current);
      if (previous.handleOut || current.handleIn) value += ' C ' + out.x + ' ' + out.y + ', ' + incoming.x + ' ' + incoming.y + ', ' + points[0].x + ' ' + points[0].y;
      value += ' Z';
    }
    return value;
  }

  function localPathD(path: RuntimePath): string {
    return pathD(path, (point) => ({ x: point.x, y: point.y }));
  }

  function maskPathD(layer: EvaluatedRuntimeLayer, mask: EvaluatedRuntimeMask, scene: RuntimeScene): string {
    const bounds: Record<string, [number, number]> = { custom_circle: [60, 60], custom_box: [60, 60], custom_rect: [120, 60], custom_capsule: [100, 40] };
    const fallback = bounds[layer.type] || [120, 80];
    const width = Number.isFinite(layer.width) ? layer.width! : fallback[0];
    const height = Number.isFinite(layer.height) ? layer.height! : fallback[1];
    const radians = layer.transform.rotation * Math.PI / 180;
    const worldAffine = layer.transform.affine;
    // A mask path is world geometry, so it follows the layer's own world map: the
    // exact derived affine when the nesting is not a TRS, and the historical TRS
    // arithmetic (unchanged, byte for byte) otherwise.
    return pathD(mask.path, (point) => {
      const local = mask.path.coordinateSpace === 'normalized' ? { x: (point.x - 0.5) * width, y: (point.y - 0.5) * height } : point;
      if (worldAffine) {
        const mapped = applyAffine(worldAffine, local);
        return { x: scene.width / 2 + mapped.x, y: scene.height / 2 + mapped.y };
      }
      const x = local.x * layer.transform.scaleX;
      const y = local.y * layer.transform.scaleY;
      return {
        x: scene.width / 2 + layer.transform.x + x * Math.cos(radians) - y * Math.sin(radians),
        y: scene.height / 2 + layer.transform.y + x * Math.sin(radians) + y * Math.cos(radians),
      };
    });
  }

  // The same stacking rule the editor stage uses: ascending zIndex paints first.
  // The authored array order is NOT the paint order (the outliner keeps index 0 on
  // top), so painting the array directly inverts the scene in a standards renderer.
  function stackingOrder<T extends { zIndex: number }>(items: T[]): T[] {
    return items.slice().sort(compareByStackingOrder);
  }

  function evaluateScene(scene: RuntimeScene, frame: number): EvaluatedRuntimeLayer[] {
    const transforms: Record<string, RuntimeWorldTransform> = Object.create(null);
    const visiting = new Set<string>();
    const evaluateTransform = (layer: RuntimeLayer): RuntimeWorldTransform => {
      if (Object.prototype.hasOwnProperty.call(transforms, layer.id)) return transforms[layer.id];
      const track = scene.tracks.find((item) => item.partId === layer.id);
      const channels = track && track.channels ? track.channels : {};
      let result: RuntimeWorldTransform = {
        x: channelValue(channels.x, frame, layer.x),
        y: channelValue(channels.y, frame, layer.y),
        rotation: channelValue(channels.rotation, frame, layer.rotation),
        scaleX: channelValue(channels.scaleX, frame, layer.scaleX),
        scaleY: channelValue(channels.scaleY, frame, layer.scaleY),
        opacity: channelValue(channels.opacity, frame, layer.opacity),
      };
      if (visiting.has(layer.id)) return result;
      visiting.add(layer.id);
      if (layer.parentId || layer.booleanGroupId) {
        const parentId = layer.parentId || layer.booleanGroupId;
        const parent = scene.layers.find((item) => item.id === parentId);
        if (parent) {
          const parentTransform = evaluateTransform(parent);
          const local = result;
          result = withWorldAffine(composeWorldTransform(parentTransform, local), composeAffine(worldAffineOf(parentTransform), affineOfTransform(local)));
        }
      }
      visiting.delete(layer.id);
      transforms[layer.id] = result;
      return result;
    };
    return stackingOrder(scene.layers).map((layer) => {
      const track = scene.tracks.find((item) => item.partId === layer.id);
      const channels = track && track.channels ? track.channels : {};
      const transformValue = evaluateTransform(layer);
      const evaluated = {
        ...layer,
        transform: transformValue,
        visible: layer.visible !== false,
        opacity: layer.visible === false ? 0 : clamp(transformValue.opacity, 0, 1),
        trimPathEnabled: layer.trimPathEnabled,
        trimPathStart: channelValue(channels.trimPathStart, frame, layer.trimPathStart === undefined ? 0 : layer.trimPathStart),
        trimPathEnd: channelValue(channels.trimPathEnd, frame, layer.trimPathEnd === undefined ? 1 : layer.trimPathEnd),
        trimPathOffset: channelValue(channels.trimPathOffset, frame, layer.trimPathOffset || 0),
      } as EvaluatedRuntimeLayer;
      evaluated.masks = (layer.masks || []).map((mask) => {
        const maskTrack = track && track.maskChannels
          ? { opacity: track.maskChannels[mask.id + ':opacity'], feather: track.maskChannels[mask.id + ':feather'], expansion: track.maskChannels[mask.id + ':expansion'] }
          : undefined;
        const pathTrack = track && track.maskPathChannels ? track.maskPathChannels[mask.id + ':path'] : undefined;
        return {
          ...mask,
          opacity: normMaskOpacity(channelValue(maskTrack && maskTrack.opacity, frame, mask.opacity === undefined ? 1 : mask.opacity)),
          feather: normMaskFeather(channelValue(maskTrack && maskTrack.feather, frame, mask.feather === undefined ? 0 : mask.feather)),
          expansion: normMaskExpansion(channelValue(maskTrack && maskTrack.expansion, frame, mask.expansion === undefined ? 0 : mask.expansion)),
          path: pathChannelValue(pathTrack, frame, mask.path),
        };
      });
      return evaluated;
    });
  }

  type SvgAttributes = Record<string, string | number | undefined>;

  /** Attributes from one record, so an override replaces a value instead of repeating it. */
  function attributes(values: SvgAttributes): string {
    return Object.keys(values)
      .filter((key) => values[key] !== undefined)
      .map((key) => ' ' + key + '="' + escapeXml(values[key]) + '"')
      .join('');
  }

  function geometry(layer: RuntimeLayer, props: SvgAttributes): string {
    const attrs = attributes(props);
    const path = layer.path
      ? localPathD(layer.path)
      : layer.points && layer.points.length >= 3 ? 'M ' + layer.points.map((point) => point.x + ' ' + point.y).join(' L ') + ' Z' : '';
    if (layer.type === 'custom_freeform') return path ? '<path d="' + escapeXml(path) + '" stroke-linejoin="' + (layer.strokeLinejoin === 'miter' ? 'miter' : 'round') + '"' + attrs + ' />' : '';
    if (layer.type === 'custom_circle') return '<circle cx="0" cy="0" r="30"' + attrs + ' />';
    if (layer.type === 'custom_box') return '<rect x="-30" y="-30" width="60" height="60" rx="0"' + attrs + ' />';
    if (layer.type === 'custom_rect') return '<rect x="-60" y="-30" width="120" height="60" rx="' + (layer.borderRadius || 0) + '"' + attrs + ' />';
    if (layer.type === 'custom_capsule') return '<rect x="-50" y="-20" width="100" height="40" rx="20"' + attrs + ' />';
    const points: Record<string, string> = {
      custom_triangle: '0,-35 35,25 -35,25',
      custom_diamond: '0,-35 35,0 0,35 -35,0',
      custom_star: '0,-35 10,-10 35,-10 15,5 23,30 0,15 -23,30 -15,5 -35,-10 -10,-10',
      custom_parallelogram: '-35,-30 85,-30 35,30 -85,30',
    };
    return points[layer.type] ? '<polygon points="' + points[layer.type] + '"' + attrs + ' />' : '';
  }

  /**
   * A text layer's glyphs, painted as the editor paints them. A silhouette
   * caller (matte, clip) passes the paint that replaces the layer's own.
   */
  function text(layer: RuntimeLayer, silhouette?: { fill: string; stroke: string }): string {
    const paint = describePaint(resolveShapeAppearance(layer));
    const glyphs = describeText(layer, layer.textOrigin === 'center' ? (layer.fontSize || 24) * textBoxCentreEm : 0);
    return '<text x="0" y="' + glyphs.y + '" text-anchor="middle"' + attributes({
      fill: silhouette ? silhouette.fill : paint.fill,
      'fill-opacity': paint.fillOpacity,
      stroke: silhouette ? silhouette.stroke : paint.stroke,
      'stroke-opacity': paint.strokeOpacity,
      'stroke-width': paint.strokeWidth,
      'font-size': glyphs.fontSize,
      'font-weight': glyphs.fontWeight,
      'font-family': glyphs.fontFamily,
    }) + '>' + escapeXml(glyphs.text) + '</text>';
  }

  function image(layer: RuntimeLayer, imageReferences: Record<string, string>, props: SvgAttributes): string {
    const width = layer.width || 180;
    const height = layer.height || 120;
    const href = imageReferences[layer.imageUrl as string] || layer.imageUrl || '';
    return '<image href="' + escapeXml(resourceUrl(href)) + '" x="' + (-width / 2) + '" y="' + (-height / 2) + '" width="' + width + '" height="' + height + '" preserveAspectRatio="xMidYMid slice"' + attributes(props) + ' />';
  }

  /** A layer's content painted as a silhouette: the matte and clip sources. */
  function silhouette(layer: RuntimeLayer, imageReferences: Record<string, string>, fill: string): string {
    if (layer.type === 'custom_text') return text(layer, { fill, stroke: 'none' });
    if (layer.type === 'custom_image') return image(layer, imageReferences, { fill, stroke: 'none' });
    return geometry(layer, { fill, stroke: 'none' });
  }


  // The world map of a layer, spelled exactly like the editor's own emitter and
  // the static SVG renderer: affineTrsReading names the historical TRS form
  // whenever those numbers reproduce the map, the canonical rotate/scale reading
  // when the affine is shear-free but its axes were swapped (a 90°-rotated child of
  // a horizontally stretched container), and null — the exact matrix(...) form — only
  // when the map genuinely shears. Both renderers therefore paint such a child the
  // way the editor preview does, with no upward stretch.
  function transform(scene: RuntimeScene, layer: EvaluatedRuntimeLayer): string {
    const world = layer.transform;
    const affine = worldAffineOf(world);
    const reading = affineTrsReading(affine, world);
    if (reading) return 'translate(' + (scene.width / 2 + reading.x) + ' ' + (scene.height / 2 + reading.y) + ') rotate(' + reading.rotation + ') scale(' + reading.scaleX + ' ' + reading.scaleY + ')';
    return 'translate(' + (scene.width / 2) + ' ' + (scene.height / 2) + ') matrix(' + affine.a + ' ' + affine.b + ' ' + affine.c + ' ' + affine.d + ' ' + affine.e + ' ' + affine.f + ')';
  }

  // The precedence decision is the editor's resolver. Only the clip exclusion
  // stays local: the resolver names the source, it does not decide which SVG
  // mechanism consumes it.
  function matteRelationship(layer: RuntimeLayer): { sourceLayerId: string; mode: string; inverted: boolean; sourceVisible: boolean } | undefined {
    const ref = resolveMatteSource(layer);
    if (!ref) return undefined;
    // The resolver names a legacy source only from `matte`, a track source only
    // from `trackMatte`, so the record it named is present.
    if (ref.kind === 'legacy') {
      const matte = layer.matte!;
      if ((matte.mode || 'clip') === 'clip') return undefined;
      return { sourceLayerId: ref.sourceId, mode: matte.mode || 'alpha', inverted: matte.inverted === true, sourceVisible: true };
    }
    const v2 = layer.trackMatte!;
    return { sourceLayerId: v2.sourceLayerId, mode: v2.mode, inverted: v2.inverted === true, sourceVisible: v2.sourceVisible !== false };
  }

  function maskDefs(scene: RuntimeScene, layer: EvaluatedRuntimeLayer): { defs: string; ids: string[] } {
    const masks = layer.masks || [];
    const defs: string[] = [];
    const ids: string[] = [];
    const region = 'M 0 0 H ' + scene.width + ' V ' + scene.height + ' H 0 Z';
    const box = '" x="0" y="0" width="' + scene.width + '" height="' + scene.height + '"';
    let previousId: string | null = null;
    const filterMarkup = (id: string, mask: EvaluatedRuntimeMask): string => {
      const filterId = 'kcs-layer-mask-filter-' + id;
      return mask.feather > 0 || mask.expansion !== 0
        ? '<filter id="' + filterId + '" filterUnits="userSpaceOnUse"><feMorphology operator="' + (mask.expansion > 0 ? 'dilate' : 'erode') + '" radius="' + Math.abs(mask.expansion) + '" />' + (mask.feather > 0 ? '<feGaussianBlur stdDeviation="' + (mask.feather / 2) + '" />' : '') + '</filter>'
        : '';
    };
    masks.forEach((mask) => {
      if (mask.enabled === false) return;
      const d = maskPathD(layer, mask, scene);
      if (!d) return;
      const id = runtimeId('kcs-ograf-layer-mask', layer.id, mask.id, mask.mode === 'add' && !previousId ? 'add' : '');
      const mode = mask.inverted ? (mask.mode === 'add' ? 'subtract' : mask.mode === 'subtract' ? 'add' : 'difference') : (mask.mode || 'add');
      const filter = filterMarkup(id, mask);
      const filterId = 'kcs-layer-mask-filter-' + id;
      const filterAttribute = mask.feather > 0 || mask.expansion !== 0 ? ' filter="url(#' + filterId + ')"' : '';
      const opacity = mask.opacity === undefined ? 1 : mask.opacity;
      const fullRect = '<rect x="0" y="0" width="' + scene.width + '" height="' + scene.height + '"';
      let body: string;
      if (!previousId) {
        const hole = mode === 'subtract' || mode === 'difference';
        body = '<path d="' + escapeXml(hole ? region + ' ' + d : d) + '" fill="white" fill-opacity="' + (hole ? 1 : opacity) + '" fill-rule="' + (hole ? 'evenodd' : 'nonzero') + '"' + filterAttribute + ' />';
      } else if (mode === 'add') {
        body = fullRect + ' fill="white" mask="url(#' + previousId + ')" /><path d="' + escapeXml(d) + '" fill="white" fill-opacity="' + opacity + '"' + filterAttribute + ' />';
      } else if (mode === 'difference') {
        const shapeId = runtimeId(id, 'shape');
        const previousInverse = runtimeId(previousId, 'inverse');
        const currentInverse = runtimeId(id, 'inverse');
        defs.push(
          '<mask id="' + shapeId + box + ' maskUnits="userSpaceOnUse"><path d="' + escapeXml(d) + '" fill="white" /></mask>'
          + '<mask id="' + previousInverse + box + ' maskUnits="userSpaceOnUse">' + fullRect + ' fill="white" />' + fullRect + ' fill="black" mask="url(#' + previousId + ')" /></mask>'
          + '<mask id="' + currentInverse + box + ' maskUnits="userSpaceOnUse">' + fullRect + ' fill="white" /><path d="' + escapeXml(d) + '" fill="black" /></mask>',
        );
        body = '<g mask="url(#' + currentInverse + ')">' + fullRect + ' fill="white" mask="url(#' + previousId + ')" /></g>'
          + '<g mask="url(#' + previousInverse + ')">' + fullRect + ' fill="white" mask="url(#' + shapeId + ')" /></g>';
      } else if (mode === 'intersect') {
        body = '<path d="' + escapeXml(d) + '" fill="white" fill-opacity="' + opacity + '" mask="url(#' + previousId + ')"' + filterAttribute + ' />';
      } else {
        body = fullRect + ' fill="white" mask="url(#' + previousId + ')" /><path d="' + escapeXml(d) + '" fill="black" fill-opacity="' + opacity + '"' + filterAttribute + ' />';
      }
      defs.push(filter + '<mask id="' + id + box + ' maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="luminance" data-mask-operation="' + mode + '">' + body + '</mask>');
      previousId = id;
    });
    if (previousId) ids.push(previousId);
    return { defs: defs.join(''), ids };
  }

  function matteDefs(scene: RuntimeScene, evaluated: EvaluatedRuntimeLayer[]): { defs: string; ids: Record<string, string>; hidden: Record<string, boolean> } {
    const defs: string[] = [];
    const ids: Record<string, string> = Object.create(null);
    const hidden: Record<string, boolean> = Object.create(null);
    evaluated.forEach((layer) => {
      const relation = matteRelationship(layer);
      if (!relation) return;
      const source = evaluated.find((candidate) => candidate.id === relation.sourceLayerId);
      if (!source) throw new Error('Missing track matte source: ' + relation.sourceLayerId);
      const id = runtimeId('kcs-ograf-track-matte', layer.id, source.id, relation.mode, relation.inverted ? 'inverted' : '');
      const sourceFill = relation.inverted ? 'black' : (relation.mode === 'luminance' ? escapeXml(source.fillColor || 'white') : 'white');
      const sourceBody = silhouette(source, IMAGE_REFERENCES, sourceFill);
      const sourceShape = '<g transform="' + transform(scene, source) + '">' + sourceBody + '</g>';
      const body = relation.inverted ? '<rect x="0" y="0" width="' + scene.width + '" height="' + scene.height + '" fill="white" />' + sourceShape : sourceShape;
      defs.push('<mask id="' + id + '" x="0" y="0" width="' + scene.width + '" height="' + scene.height + '" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="' + (relation.inverted ? 'luminance' : relation.mode) + '">' + body + '</mask>');
      ids[layer.id] = id;
      if (!relation.sourceVisible) hidden[relation.sourceLayerId] = true;
    });
    return { defs: defs.join(''), ids, hidden };
  }

  function clipDefs(scene: RuntimeScene, evaluated: EvaluatedRuntimeLayer[]): string {
    const defs: string[] = [];
    const seen: Record<string, boolean> = Object.create(null);
    evaluated.forEach((target) => {
      const matte = target.matte;
      if (!matte || (matte.mode || 'clip') !== 'clip' || seen[matte.sourcePartId as string]) return;
      const source = evaluated.find((candidate) => candidate.id === matte.sourcePartId);
      if (!source) throw new Error('Missing clip matte source: ' + matte.sourcePartId);
      const id = runtimeId('kcs-clip', source.id);
      defs.push('<clipPath id="' + id + '" clipPathUnits="userSpaceOnUse"><g transform="' + transform(scene, source) + '">' + silhouette(source, IMAGE_REFERENCES, 'white') + '</g></clipPath>');
      seen[source.id] = true;
    });
    return defs.join('');
  }

  /**
   * A shape painted as the static renderer paints it: a centred outline on the
   * geometry itself, an inside or outside one as a double-width outline masked
   * by the geometry.
   */
  function renderShape(layer: EvaluatedRuntimeLayer): string {
    const paint = describePaint(resolveShapeAppearance(layer));
    const common: SvgAttributes = {
      fill: paint.fill,
      'fill-opacity': paint.fillOpacity,
      stroke: paint.stroke,
      'stroke-opacity': paint.strokeOpacity,
      'stroke-width': paint.strokeWidth,
      // As in the editor, the stroke is in scene units whatever the layer's own scale.
      'vector-effect': 'non-scaling-stroke',
      ...trimAttributes(layer),
    };
    if (paint.strokeAlignment === 'center' || !paint.stroked) return geometry(layer, common);
    const id = runtimeId(paint.strokeAlignment + '-stroke', layer.id);
    const inside = paint.strokeAlignment === 'inside';
    const maskShape = geometry(layer, { fill: inside ? 'white' : 'black', stroke: 'none' });
    const fillShape = geometry(layer, { ...common, stroke: 'none', 'stroke-width': 0 });
    const strokeShape = geometry(layer, { ...common, fill: 'none', 'stroke-width': paint.strokeWidth * 2, mask: 'url(#' + id + ')' });
    return '<g><defs><mask id="' + id + '" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"><rect x="-1000000" y="-1000000" width="2000000" height="2000000" fill="' + (inside ? 'black' : 'white') + '" />' + maskShape + '</mask></defs>' + fillShape + strokeShape + '</g>';
  }

  function trimAttributes(layer: EvaluatedRuntimeLayer): SvgAttributes {
    if (layer.trimPathEnabled !== true) return {};
    const start = normTrim01(layer.trimPathStart, 0);
    const end = normTrim01(layer.trimPathEnd, 1);
    const offset = normTrimOffsetDegrees(layer.trimPathOffset);
    const rawSpan = end - start;
    const span = ((rawSpan % 1) + 1) % 1;
    const begin = ((start + offset / 360) % 1 + 1) % 1;
    const dashOffset = begin === 0 ? 0 : -begin;
    if (rawSpan === 1) return { pathLength: 1 };
    if (span === 0) return { pathLength: 1, 'stroke-dasharray': '0 1', 'stroke-dashoffset': dashOffset };
    return { pathLength: 1, 'stroke-dasharray': span + ' ' + (1 - span), 'stroke-dashoffset': dashOffset };
  }

  function renderLayer(scene: RuntimeScene, layer: EvaluatedRuntimeLayer, maskMap: Record<string, string[]>, matteId: string | undefined, hidden: boolean): string {
    if (hidden || !layer.visible || layer.opacity <= 0) return '';
    const body = layer.type === 'custom_text' ? text(layer) : layer.type === 'custom_image' ? image(layer, IMAGE_REFERENCES, {}) : renderShape(layer);
    let inner = '<g transform="' + transform(scene, layer) + '">' + body + '</g>';
    const ids = (maskMap[layer.id] || []).concat(matteId ? [matteId] : []);
    ids.slice().reverse().forEach((id) => {
      inner = '<g mask="url(#' + id + ')">' + inner + '</g>';
    });
    const clip = layer.matte && (layer.matte.mode || 'clip') === 'clip' ? ' clip-path="url(#' + runtimeId('kcs-clip', layer.matte.sourcePartId) + ')"' : '';
    return '<g data-layer-id="' + escapeXml(layer.id) + '" data-z-index="' + layer.zIndex + '" opacity="' + layer.opacity + '"' + clip + '>' + inner + '</g>';
  }

  function renderScene(scene: RuntimeScene, frame: number, stopped: boolean): string {
    const evaluated = evaluateScene(scene, frame);
    const defs = [clipDefs(scene, evaluated)];
    const maskMap: Record<string, string[]> = Object.create(null);
    evaluated.forEach((layer) => {
      const masks = maskDefs(scene, layer);
      defs.push(masks.defs);
      maskMap[layer.id] = masks.ids;
    });
    const matte = matteDefs(scene, evaluated);
    defs.push(matte.defs);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + scene.width + '" height="' + scene.height + '" viewBox="0 0 ' + scene.width + ' ' + scene.height + '">'
      + '<style>' + fontStyles() + '</style><defs>' + defs.join('') + '</defs>'
      + evaluated.map((layer) => renderLayer(scene, layer, maskMap, matte.ids[layer.id], stopped || matte.hidden[layer.id])).join('')
      + '</svg>';
  }

  /** The OGraf graphic element: the host's load / play / stop / update / dispose contract. */
  class Graphic extends elementBase {
    declare _scene: RuntimeScene;
    declare _currentFrame: number;
    declare _currentStep: number | undefined;
    declare _stopped: boolean;
    declare _raf: number | null;
    declare _token: number;
    declare _resolveAction: ((result: RuntimeActionResult) => void) | null;

    _cancel(): void {
      this._token += 1;
      if (this._resolveAction) {
        this._resolveAction({ statusCode: 200, statusMessage: 'Superseded' });
        this._resolveAction = null;
      }
      if (this._raf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf);
      this._raf = null;
    }

    constructor() {
      super();
      this._scene = JSON.parse(JSON.stringify(SCENE));
      assertSafeScene(this._scene);
      this._currentFrame = 0;
      this._currentStep = undefined;
      this._stopped = false;
      this._raf = null;
      this._token = 0;
      this._resolveAction = null;
    }

    _render(): void {
      this.innerHTML = renderScene(this._scene, this._currentFrame, this._stopped);
    }

    _applyData(data: Record<string, unknown> | undefined): RuntimeActionResult | undefined {
      if (!data || typeof data !== 'object') return undefined;
      for (const key of Object.keys(data)) {
        const binding = (Object.prototype.hasOwnProperty.call(PUBLIC_BINDINGS.text, key) && PUBLIC_BINDINGS.text[key])
          || (Object.prototype.hasOwnProperty.call(PUBLIC_BINDINGS.image, key) && PUBLIC_BINDINGS.image[key])
          || (Object.prototype.hasOwnProperty.call(PUBLIC_BINDINGS.color, key) && PUBLIC_BINDINGS.color[key]);
        if (!binding) return { statusCode: 400, statusMessage: 'Unknown public field: ' + key };
        const layer = this._scene.layers.find((item) => item.id === binding.layerId);
        const value = data[key];
        if (!layer || typeof value !== 'string') return { statusCode: 400, statusMessage: 'Invalid public field value: ' + key };
        if (binding.property === 'imageUrl' && (!binding.allowedValues!.includes(value) || !Object.prototype.hasOwnProperty.call(IMAGE_REFERENCES, value) || !IMAGE_REFERENCES[value])) {
          return { statusCode: 400, statusMessage: 'Image value is not a packaged asset: ' + key };
        }
        if ((binding.property === 'fillColor' || binding.property === 'strokeColor') && !/^#[0-9a-f]{6}$/iu.test(value)) {
          return { statusCode: 400, statusMessage: 'Color value must be a #rrggbb value: ' + key };
        }
        layer[binding.property] = value;
      }
      return undefined;
    }

    async load(params?: { renderType?: string; data?: Record<string, unknown> }): Promise<RuntimeActionResult> {
      this._cancel();
      if (params && params.renderType && params.renderType !== 'realtime') return { statusCode: 400, statusMessage: 'Only realtime rendering is supported' };
      const error = this._applyData(params && params.data);
      if (error) return error;
      this._currentFrame = 0;
      this._currentStep = undefined;
      this._stopped = false;
      this._render();
      return { statusCode: 200 };
    }

    async dispose(): Promise<RuntimeActionResult> {
      this._cancel();
      this._scene = JSON.parse(JSON.stringify(SCENE));
      this._stopped = false;
      this.innerHTML = '';
      return { statusCode: 200 };
    }

    _animate(targetFrame: number, skipAnimation: boolean): Promise<RuntimeActionResult> {
      this._cancel();
      const token = this._token;
      const startFrame = this._currentFrame;
      if (skipAnimation || startFrame === targetFrame || typeof requestAnimationFrame !== 'function') {
        this._currentFrame = targetFrame;
        this._render();
        return Promise.resolve({ statusCode: 200 });
      }
      const duration = Math.abs(targetFrame - startFrame) / this._scene.fps * 1000;
      const started = typeof performance === 'object' ? performance.now() : Date.now();
      return new Promise((resolve) => {
        this._resolveAction = resolve;
        const tick = (now: number) => {
          if (token !== this._token || !this._scene) {
            resolve({ statusCode: 200, statusMessage: 'Superseded' });
            return;
          }
          const progress = clamp((now - started) / duration, 0, 1);
          this._currentFrame = startFrame + (targetFrame - startFrame) * progress;
          this._render();
          if (progress >= 1) {
            this._raf = null;
            this._resolveAction = null;
            resolve({ statusCode: 200 });
            return;
          }
          this._raf = requestAnimationFrame(tick);
        };
        this._raf = requestAnimationFrame(tick);
      });
    }

    async playAction(params: { goto?: number; delta?: number; skipAnimation?: boolean } = {}): Promise<RuntimeActionResult> {
      const current = this._currentStep;
      const goto = typeof params.goto === 'number' && params.goto >= 0 ? params.goto : undefined;
      const delta = typeof params.delta === 'number' ? params.delta : 1;
      const targetStep = goto === undefined ? (current === undefined ? -1 : current) + delta : goto;
      const stepCount = 1;
      const nextStep = targetStep >= stepCount ? undefined : Math.max(0, targetStep);
      this._currentStep = nextStep;
      this._stopped = nextStep === undefined;
      const result = await this._animate(this._scene.totalFrames, params.skipAnimation === true);
      return Object.assign({}, result, { currentStep: this._currentStep });
    }

    async stopAction(params: { skipAnimation?: boolean } = {}): Promise<RuntimeActionResult> {
      const result = await this._animate(this._scene.totalFrames, params.skipAnimation === true);
      if (result.statusMessage !== 'Superseded') {
        this._currentStep = undefined;
        this._stopped = true;
        this._render();
      }
      return result;
    }

    async updateAction(params?: { data?: Record<string, unknown> }): Promise<RuntimeActionResult> {
      this._cancel();
      const error = this._applyData(params && params.data);
      if (error) return error;
      this._render();
      return { statusCode: 200 };
    }

    async customAction(): Promise<RuntimeActionResult> {
      return { statusCode: 400, statusMessage: 'No custom actions supported' };
    }
  }

  return { Graphic, assertSafeScene, channelValue, pathChannelValue, applyEasing, evaluateScene, renderScene };
}
