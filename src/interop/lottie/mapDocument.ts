import type { AnimationTrackData, BezierPath, PropertyKeyframe, TrackChannel } from '../../types/animator';
import type { SceneData, SceneLayer } from '../../types/composition';
import { isPrototypeSensitiveKey } from '../../utils/pathSafety';
import { LOTTIE_IMPORT_LIMITS, lottieError, lottieWarning, type LottieImportDiagnostic } from './diagnostics';
import { mapLottieKeyframes, type LottieKeyframe } from './temporal';

/**
 * Lottie import core (Milestone F, item 10, first slice).
 *
 * Implements the document- and layer-level mapping of
 * `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md` for the constructs the first slice
 * covers — document timing, shape/solid/null layers, transforms, paths,
 * primitives, fill/stroke/trim — and **reports** everything the slice does not
 * convert (precomps, text, images, effects, expressions, masks and track mattes)
 * instead of guessing. Nothing here silently approximates.
 *
 * The returned scene is a normal KCS `SceneData`, so the caller can hand it to
 * the existing import path (`useSerialization`), which validates it again.
 */

export interface LottieImportResult {
  ok: boolean;
  scene?: SceneData;
  diagnostics: LottieImportDiagnostic[];
}

interface LottieNumericProperty {
  staticValue?: number;
  keyframes?: LottieKeyframe[];
}

/** Values we read from an untrusted Lottie document. */
type LottieRecord = Record<string, unknown>;

const asRecord = (value: unknown): LottieRecord | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as LottieRecord) : undefined;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const readNumber = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

const readString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** A Lottie property object holds either `k` (static) or keyframed entries. */
const readNumericProperty = (value: unknown): LottieNumericProperty | undefined => {
  const record = asRecord(value);
  if (!record) return undefined;
  const raw = record.k;
  if (typeof raw === 'number' && Number.isFinite(raw)) return { staticValue: raw };
  if (!Array.isArray(raw)) return undefined;
  const keyframes: LottieKeyframe[] = [];
  for (const entry of raw) {
    const keyframe = asRecord(entry);
    const time = readNumber(keyframe?.t);
    if (!keyframe || time === undefined) continue;
    const incoming = asRecord(keyframe.i);
    const outgoing = asRecord(keyframe.o);
    const startValue = Array.isArray(keyframe.s) ? readNumber(keyframe.s[0]) : readNumber(keyframe.s);
    if (startValue === undefined) continue;
    keyframes.push({
      time,
      value: startValue,
      hold: keyframe.h === 1,
      ...(outgoing ? { out: { x: readNumber(outgoing.x) ?? 0, y: readNumber(outgoing.y) ?? 0 } } : {}),
      ...(incoming ? { in: { x: readNumber(incoming.x) ?? 0, y: readNumber(incoming.y) ?? 0 } } : {}),
      ...(keyframe.r === 1 ? { roving: true } : {}),
      ...(readString(keyframe.x) ? { expression: readString(keyframe.x) as string } : {}),
    });
  }
  return keyframes.length > 0 ? { keyframes } : { staticValue: 0 };
};

const toTransformChannel = (
  property: LottieNumericProperty | undefined,
  context: { documentInPoint: number; layerStartTime?: number; path: string; channel: string },
): { staticValue?: number; keyframes?: PropertyKeyframe[]; diagnostics: LottieImportDiagnostic[] } => {
  if (!property) return { diagnostics: [] };
  if (property.staticValue !== undefined) return { staticValue: property.staticValue, diagnostics: [] };
  const mapped = mapLottieKeyframes(property.keyframes ?? [], { ...context, keyframeLimit: LOTTIE_IMPORT_LIMITS.keyframesPerChannel });
  return {
    keyframes: mapped.keyframes as PropertyKeyframe[],
    diagnostics: mapped.diagnostics,
  };
};

/** Maps one Lottie path (`ks.k` with `v`/`i`/`o`/`c`) to a canonical `BezierPath`. */
const mapPath = (
  property: unknown,
  pathLabel: string,
  diagnostics: LottieImportDiagnostic[],
): BezierPath | { staticPath?: BezierPath } | undefined => {
  const record = asRecord(property);
  const shape = asRecord(record?.k);
  const vertices = asArray(shape?.v);
  if (vertices.length === 0) return undefined;
  if (vertices.length > LOTTIE_IMPORT_LIMITS.verticesPerPath) {
    diagnostics.push(
      lottieWarning(
        'LOTTIE_PATH_LIMIT',
        pathLabel,
        `A path with ${vertices.length} vertices exceeds the ${LOTTIE_IMPORT_LIMITS.verticesPerPath}-vertex import limit.`,
        'Simplify the path in the source document and import again.',
      ),
    );
    return undefined;
  }
  const inTangents = asArray(shape?.i);
  const outTangents = asArray(shape?.o);
  const points = vertices.flatMap((entry, index) => {
    const vertex = asRecord(entry);
    const x = readNumber(vertex?.x);
    const y = readNumber(vertex?.y);
    if (x === undefined || y === undefined) return [];
    const inPoint = asRecord(inTangents[index]);
    const outPoint = asRecord(outTangents[index]);
    return [{
      id: `v${index}`,
      x,
      y,
      ...(inPoint ? { inX: readNumber(inPoint.x) ?? 0, inY: readNumber(inPoint.y) ?? 0 } : {}),
      ...(outPoint ? { outX: readNumber(outPoint.x) ?? 0, outY: readNumber(outPoint.y) ?? 0 } : {}),
    }];
  });
  if (points.length === 0) return undefined;
  return { version: 1, coordinateSpace: 'local', closed: shape?.c === true, points: points as BezierPath['points'] };
};

const BASIC_LAYER_TYPES: Record<number, string> = { 1: 'custom', 3: 'custom', 4: 'custom' };

/** Maps a Lottie document (already parsed) into a KCS scene plus a loss report. */
export const mapLottieDocument = (document: unknown): LottieImportResult => {
  const diagnostics: LottieImportDiagnostic[] = [];
  const root = asRecord(document);
  if (!root) {
    return { ok: false, diagnostics: [lottieError('LOTTIE_INVALID_DOCUMENT', '$', 'The document is not a JSON object.', 'Export a Lottie (bodymovin) JSON file and import that.')] };
  }

  const frameRate = readNumber(root.fr);
  const outPoint = readNumber(root.op);
  const inPoint = readNumber(root.ip) ?? 0;
  if (frameRate === undefined || frameRate <= 0 || outPoint === undefined) {
    return {
      ok: false,
      diagnostics: [lottieError('LOTTIE_MISSING_TIMING', '$', 'The document has no usable frame rate (`fr`) or out point (`op`).', 'Export the animation again with timing information included.')],
    };
  }

  const fps = Math.round(frameRate);
  if (fps !== frameRate) {
    diagnostics.push(lottieWarning('LOTTIE_FRACTIONAL_FPS', '$.fr', `Frame rate ${frameRate} was rounded to ${fps}.`, 'Export at an integer frame rate to keep timing exact.'));
  }
  const totalFrames = Math.max(1, Math.round(outPoint - inPoint));
  if (inPoint !== 0) {
    diagnostics.push(lottieWarning('LOTTIE_IN_POINT_SHIFT', '$.ip', `The document starts at frame ${inPoint}; every keyframe is shifted so the scene starts at 0.`, 'Start the animation at frame 0 in the source document if the shift is unwanted.'));
  }

  const width = readNumber(root.w) ?? 1920;
  const height = readNumber(root.h) ?? 1080;
  const layers: SceneLayer[] = [];
  const tracks: AnimationTrackData[] = [];
  const layerIds: string[] = [];

  const lottieLayers = asArray(root.layers);
  lottieLayers.forEach((entry, index) => {
    const layer = asRecord(entry);
    const path = `layers[${index}]`;
    const type = readNumber(layer?.ty);
    if (!layer || type === undefined) {
      diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_LAYER', path, `Layer ${index} has no readable type.`, 'Remove the layer or export the document again.'));
      return;
    }
    if (BASIC_LAYER_TYPES[type] === undefined) {
      const kind = type === 0 ? 'precomposition' : type === 2 ? 'image' : type === 5 ? 'text' : `type ${type}`;
      diagnostics.push(
        lottieWarning(
          'LOTTIE_UNSUPPORTED_LAYER_TYPE',
          path,
          `Layer ${index} is a ${kind} layer, which the first import slice does not convert.`,
          'Flatten or bake the layer in the source document, then import again.',
        ),
      );
      return;
    }
    if (layer.ef !== undefined) diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_EFFECT', `${path}.ef`, `Layer ${index} carries effects, which are not converted.`, 'Remove the effect or bake it before exporting.'));
    if (layer.hasExpressions === true) diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_EXPRESSION', `${path}.hasExpressions`, `Layer ${index} uses expressions, which are preserved but not evaluated.`, 'Bake the expressions and export again.'));
    if (layer.tt !== undefined || layer.td !== undefined) diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_TRACK_MATTE', `${path}.tt`, `Layer ${index} uses a track matte, which the first import slice reports instead of converting.`, 'Apply the matte after import, or bake it in the source document.'));
    if (layer.hasMask === true || layer.masksProperties !== undefined) diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_MASK', `${path}.masksProperties`, `Layer ${index} carries masks, which the first import slice reports instead of converting.`, 'Bake the mask in the source document or re-create it after import.'));

    const transform = asRecord(layer.ks) ?? {};
    const layerStartTime = readNumber(layer.st);
    const context = { documentInPoint: inPoint, layerStartTime, path: `${path}.ks`, channel: '' };
    const position = readNumericProperty(transform.p);
    const x = toTransformChannel(position, { ...context, path: `${path}.ks.p`, channel: 'x' });
    const y = toTransformChannel(position, { ...context, path: `${path}.ks.p`, channel: 'y' });
    const rotation = toTransformChannel(readNumericProperty(transform.r), { ...context, path: `${path}.ks.r`, channel: 'rotation' });
    const scale = toTransformChannel(readNumericProperty(transform.s), { ...context, path: `${path}.ks.s`, channel: 'scaleX' });
    const opacity = toTransformChannel(readNumericProperty(transform.o), { ...context, path: `${path}.ks.o`, channel: 'opacity' });
    diagnostics.push(...x.diagnostics, ...rotation.diagnostics, ...scale.diagnostics, ...opacity.diagnostics);

    const layerId = `lottie-layer-${index}`;
    layerIds.push(layerId);
    const parentIndex = readNumber(layer.parent);
    const parentId = parentIndex !== undefined && parentIndex >= 0 && parentIndex < index ? `lottie-layer-${parentIndex}` : undefined;
    if (parentIndex !== undefined && parentId === undefined) {
      diagnostics.push(lottieWarning('LOTTIE_BROKEN_PARENT', `${path}.parent`, `Layer ${index} points at parent ${parentIndex}, which is not an already-imported layer.`, 'Reorder the layers in the source document so parents come first.'));
    }

    const scalePercent = scale.staticValue ?? 100;
    layers.push({
      id: layerId,
      name: readString(layer.nm) ?? `Layer ${index}`,
      type: BASIC_LAYER_TYPES[type],
      x: x.staticValue ?? 0,
      y: y.staticValue ?? 0,
      rotation: rotation.staticValue ?? 0,
      scaleX: scalePercent / 100,
      scaleY: scalePercent / 100,
      opacity: (opacity.staticValue ?? 100) / 100,
      ...(parentId ? { parentId } : {}),
      visible: true,
      zIndex: lottieLayers.length - index,
      fillColor: '#ffffff',
      strokeColor: '#101218',
    } as SceneLayer);
    const layerShape = layers[layers.length - 1];

    const shapes = asArray(layer.shapes);
    for (const [shapeIndex, shapeEntry] of shapes.entries()) {
      const shape = asRecord(shapeEntry);
      const shapeType = readString(shape?.ty);
      const shapePath = `${path}.shapes[${shapeIndex}]`;
      if (!shape || !shapeType) continue;
      if (shapeType === 'sh') {
        const mapped = mapPath(shape.ks, shapePath, diagnostics);
        if (mapped && 'version' in mapped) layerShape.path = mapped;
        continue;
      }
      if (shapeType === 'rc' || shapeType === 'el') {
        const sizeValue = asRecord(shape.s)?.k;
        const size = Array.isArray(sizeValue) ? sizeValue : [];
        const sizeX = readNumber(size[0]);
        const sizeY = readNumber(size[1]);
        if (shapeType === 'rc') {
          if (sizeX !== undefined) layerShape.width = sizeX;
          if (sizeY !== undefined) layerShape.height = sizeY;
        } else {
          const radius = sizeX ?? sizeY;
          if (radius !== undefined) {
            layerShape.width = radius * 2;
            layerShape.height = radius * 2;
          }
        }
        continue;
      }
      if (shapeType === 'fl') {
        layerShape.fillEnabled = true;
        const colourValue = asRecord(shape.c)?.k;
        const colour = Array.isArray(colourValue) ? colourValue : [];
        const [red, green, blue] = [readNumber(colour[0]), readNumber(colour[1]), readNumber(colour[2])];
        if (red !== undefined && green !== undefined && blue !== undefined) {
          const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value * 255))).toString(16).padStart(2, '0');
          layerShape.fillColor = `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
        }
        const fillOpacity = readNumber(asRecord(shape.o)?.k);
        if (fillOpacity !== undefined) layerShape.fillOpacity = fillOpacity / 100;
        continue;
      }
      if (shapeType === 'st') {
        layerShape.strokeEnabled = true;
        const strokeWidth = readNumber(asRecord(shape.w)?.k);
        if (strokeWidth !== undefined) layerShape.strokeWidth = strokeWidth;
        continue;
      }
      if (shapeType === 'tm') {
        layerShape.trimPathEnabled = true;
        const start = readNumber(asRecord(shape.s)?.k);
        const end = readNumber(asRecord(shape.e)?.k);
        const offset = readNumber(asRecord(shape.o)?.k);
        if (start !== undefined) layerShape.trimPathStart = start / 100;
        if (end !== undefined) layerShape.trimPathEnd = end / 100;
        if (offset !== undefined) layerShape.trimPathOffset = offset / 100;
        continue;
      }
      if (shapeType === 'gr') {
        diagnostics.push(lottieWarning('LOTTIE_SHAPE_GROUP_FLATTENED', shapePath, `Shape group ${shapeIndex} of layer ${index} was flattened in order.`, 'Check the layer after import; group transforms are not converted.'));
        continue;
      }
      diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_SHAPE', shapePath, `Shape item "${shapeType}" of layer ${index} is not converted by the first slice.`, 'Bake or remove that item in the source document.'));
    }

    const channels = {
      x: (x.keyframes ?? []) as PropertyKeyframe[],
      y: (y.keyframes ?? []) as PropertyKeyframe[],
      rotation: (rotation.keyframes ?? []) as PropertyKeyframe[],
      scaleX: (scale.keyframes ?? []) as PropertyKeyframe[],
      scaleY: (scale.keyframes ?? []) as PropertyKeyframe[],
      opacity: (opacity.keyframes ?? []) as PropertyKeyframe[],
    } as Record<TrackChannel, PropertyKeyframe[]>;
    if (Object.values(channels).some((keyframes) => keyframes.length > 0)) {
      tracks.push({ partId: layerId, channels: channels as AnimationTrackData['channels'] });
    }
  });

  if (layers.length === 0) {
    diagnostics.push(lottieWarning('LOTTIE_EMPTY_SCENE', '$.layers', 'No layer of this document could be converted by the first import slice.', 'Check the report above and bake the unsupported layers in the source document.'));
  }

  const scene: SceneData = {
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    name: readString(root.nm) ?? 'Imported Lottie',
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    fps,
    totalFrames,
    layers,
    tracks: tracks as SceneData['tracks'],
  };

  return { ok: layers.length > 0, scene, diagnostics };
};

/** Validates and maps raw Lottie text. The document is untrusted input. */
export const importLottieDocument = (text: string): LottieImportResult => {
  if (text.length > LOTTIE_IMPORT_LIMITS.characters) {
    return {
      ok: false,
      diagnostics: [lottieError('LOTTIE_DOCUMENT_TOO_LARGE', '$', `The document exceeds the ${Math.round(LOTTIE_IMPORT_LIMITS.characters / (1024 * 1024))} MB import limit.`, 'Split or reduce the animation and import again.')],
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, diagnostics: [lottieError('LOTTIE_MALFORMED_JSON', '$', 'The selected file is not valid JSON.', 'Export the Lottie document again and import the new file.')] };
  }
  const unsafe = findPrototypeKey(parsed);
  if (unsafe) {
    return {
      ok: false,
      diagnostics: [lottieError('LOTTIE_UNSAFE_KEY', unsafe.path, `The document contains the reserved key "${unsafe.key}".`, 'Remove the reserved key from the file and import it again.')],
    };
  }
  return mapLottieDocument(parsed);
};

const findPrototypeKey = (value: unknown): { key: string; path: string } | undefined => {
  const stack: { node: unknown; path: string; depth: number }[] = [{ node: value, path: '$', depth: 0 }];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || current.depth > 64) continue;
    if (Array.isArray(current.node)) {
      current.node.forEach((entry, index) => stack.push({ node: entry, path: `${current.path}[${index}]`, depth: current.depth + 1 }));
      continue;
    }
    const record = asRecord(current.node);
    if (!record) continue;
    for (const [key, entry] of Object.entries(record)) {
      if (isPrototypeSensitiveKey(key)) return { key, path: `${current.path}.${key}` };
      stack.push({ node: entry, path: `${current.path}.${key}`, depth: current.depth + 1 });
    }
  }
  return undefined;
};
