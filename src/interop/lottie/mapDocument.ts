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
  /** Every dimension of a static value (`p: [x, y]` keeps both). */
  staticValues?: number[];
  keyframes?: LottieKeyframe[];
}

/** Values we read from an untrusted Lottie document. */
type LottieRecord = Record<string, unknown>;

const asRecord = (value: unknown): LottieRecord | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as LottieRecord) : undefined;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const readNumber = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

const readString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** Which properties of each shape item this slice reads as static only. */
const ANIMATED_SHAPE_PROPERTIES: Record<string, string[]> = {
  fl: ['c', 'o'],
  st: ['w', 'c', 'o'],
  rc: ['r', 's'],
  el: ['s'],
  tm: ['s', 'e', 'o'],
};

/**
 * Reports an animated shape item exactly once, naming the animated
 * properties. Items this slice reads only as static values must never be
 * imported silently.
 */
const noteAnimatedShape = (
  diagnostics: LottieImportDiagnostic[],
  shape: LottieRecord,
  shapeType: string,
  shapePath: string,
  shapeIndex: number,
  layerIndex: number,
): void => {
  const keys = ANIMATED_SHAPE_PROPERTIES[shapeType] ?? ['c', 'w', 'o', 'r'];
  const animated = keys.filter((key) => isAnimatedProperty(shape[key]));
  if (animated.length === 0) return;
  diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_ANIMATED_SHAPE', shapePath, 'Shape item ' + shapeIndex + ' of layer ' + layerIndex + ' animates ' + animated.join('/') + ', which the first slice reads as static only.', 'Bake that animation in the source document or re-create it after import.'));
};

/**
 * True when a property holds keyframes rather than a static value list.
 * Deciding by structure (`k[0]` is an object with a numeric `t`) keeps a
 * static colour list such as `k: [1, 0, 0]` from being reported as animated.
 */
const isAnimatedProperty = (value: unknown): boolean => {
  const entries = (asRecord(value) ?? {}).k;
  if (!Array.isArray(entries)) return false;
  const first = asRecord(entries[0]);
  return typeof first?.t === 'number';
};

/** A Lottie property object holds either `k` (static) or keyframed entries. */
/** Reads `{ k: number | number[] }` or `{ k: [ { t, s, i, o, h, r, x } … ] }`. */
const readNumericProperty = (value: unknown): LottieNumericProperty | undefined => {
  const record = asRecord(value);
  if (!record) return undefined;
  const raw = record.k;
  if (typeof raw === 'number' && Number.isFinite(raw)) return { staticValues: [raw] };
  if (!Array.isArray(raw)) return undefined;
  // A keyframe entry is an object carrying a numeric `t`; anything else is a
  // static component list. Deciding by structure (not truthiness) keeps a
  // keyframe at time 0 on the keyframe path.
  const firstEntry = asRecord(raw[0]);
  if (!firstEntry || typeof firstEntry.t !== 'number') {
    const staticValues = raw.map((entry) => readNumber(entry)).filter((entry): entry is number => entry !== undefined);
    return staticValues.length > 0 ? { staticValues } : undefined;
  }
  const keyframes: LottieKeyframe[] = [];
  for (const entry of raw) {
    const keyframe = asRecord(entry);
    const time = readNumber(keyframe?.t);
    if (!keyframe || time === undefined) continue;
    const incoming = asRecord(keyframe.i);
    const outgoing = asRecord(keyframe.o);
    const rawValues = Array.isArray(keyframe.s) ? keyframe.s : [keyframe.s];
    const values = rawValues.map((entry) => readNumber(entry)).filter((entry): entry is number => entry !== undefined);
    if (values.length === 0) continue;
    keyframes.push({
      time,
      values,
      hold: keyframe.h === 1,
      ...(outgoing ? { out: { x: readNumber(outgoing.x) ?? 0, y: readNumber(outgoing.y) ?? 0 } } : {}),
      ...(incoming ? { in: { x: readNumber(incoming.x) ?? 0, y: readNumber(incoming.y) ?? 0 } } : {}),
      ...(keyframe.r === 1 ? { roving: true } : {}),
      ...(readString(keyframe.x) ? { expression: readString(keyframe.x) as string } : {}),
    });
  }
  return keyframes.length > 0 ? { keyframes } : undefined;
};

const toTransformChannel = (
  property: LottieNumericProperty | undefined,
  context: { dimension?: number; documentInPoint: number; layerStartTime?: number; path: string; channel: string },
): { staticValue?: number; keyframes?: PropertyKeyframe[]; diagnostics: LottieImportDiagnostic[] } => {
  if (!property) return { diagnostics: [] };
  const dimension = context.dimension ?? 0;
  if (property.staticValues) {
    return { staticValue: property.staticValues[dimension] ?? property.staticValues[0] ?? 0, diagnostics: [] };
  }
  const mapped = mapLottieKeyframes(property.keyframes ?? [], { ...context, dimension, keyframeLimit: LOTTIE_IMPORT_LIMITS.keyframesPerChannel });
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

  if (root.ddd === 1) {
    diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_3D', '$.ddd', 'The document is flagged as 3D; only its 2D transform components are imported.', 'Disable 3D layers in the source document and export again.'));
  }

  const width = readNumber(root.w) ?? 1920;
  const height = readNumber(root.h) ?? 1080;
  const layers: SceneLayer[] = [];
  const tracks: AnimationTrackData[] = [];
  const layerIds: string[] = [];
  /** Parent-chain depth per Lottie layer index, so the limit counts levels, not gaps. */
  const parentDepth = new Map<number, number>();

  /** Lottie stores scale and opacity as percentages; KCS stores factors. */
  const asFactor = (keyframes: PropertyKeyframe[]): PropertyKeyframe[] =>
    keyframes.map((keyframe) => ({ ...keyframe, value: keyframe.value / 100 }));

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
    if (layer.ip !== undefined || layer.op !== undefined) diagnostics.push(lottieWarning('LOTTIE_LAYER_TIMING', `${path}.ip`, `Layer ${index} has an in/out range, which KCS does not model.`, 'Trim the layer after import, or remove the in/out range in the source document.'));
    if (asRecord(layer.ks)?.sk !== undefined || asRecord(layer.ks)?.sa !== undefined) diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_SKEW', `${path}.ks.sk`, `Layer ${index} is skewed, which KCS does not model.`, 'Bake the skew in the source document.'));
    if (layer.ao === 1) diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_AUTO_ORIENT', `${path}.ao`, `Layer ${index} uses auto-orient, which KCS does not model.`, 'Bake the orientation in the source document.'));
    if (layer.hasMask === true || layer.masksProperties !== undefined) diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_MASK', `${path}.masksProperties`, `Layer ${index} carries masks, which the first import slice reports instead of converting.`, 'Bake the mask in the source document or re-create it after import.'));

    const solidFill = readString(layer.sc);
    const solidWidth = readNumber(layer.sw);
    const solidHeight = readNumber(layer.sh);
    const transform = asRecord(layer.ks) ?? {};
    if (asRecord(transform.a)?.k !== undefined) {
      diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_ANCHOR', path + '.ks.a', 'Layer ' + index + ' uses an anchor point; KCS derives the pivot instead, so the anchor is not converted.', 'Re-check the layer position after import, or move the anchor in the source document.'));
    }
    const layerStartTime = readNumber(layer.st);
    const context = { documentInPoint: inPoint, layerStartTime, path: `${path}.ks`, channel: '' };
    const position = readNumericProperty(transform.p);
    const x = toTransformChannel(position, { ...context, dimension: 0, path: `${path}.ks.p`, channel: 'x' });
    const y = toTransformChannel(position, { ...context, dimension: 1, path: `${path}.ks.p`, channel: 'y' });
    const rotation = toTransformChannel(readNumericProperty(transform.r), { ...context, path: `${path}.ks.r`, channel: 'rotation' });
    const scaleProperty = readNumericProperty(transform.s);
    const scaleX = toTransformChannel(scaleProperty, { ...context, dimension: 0, path: `${path}.ks.s`, channel: 'scaleX' });
    const scaleY = toTransformChannel(scaleProperty, { ...context, dimension: 1, path: `${path}.ks.s`, channel: 'scaleY' });
    const opacity = toTransformChannel(readNumericProperty(transform.o), { ...context, dimension: 0, path: `${path}.ks.o`, channel: 'opacity' });
    diagnostics.push(...x.diagnostics, ...y.diagnostics, ...rotation.diagnostics, ...scaleX.diagnostics, ...scaleY.diagnostics, ...opacity.diagnostics);

    const layerId = `lottie-layer-${index}`;
    layerIds.push(layerId);
    const parentIndex = readNumber(layer.parent);
    const parentChainDepth = parentIndex !== undefined && parentIndex >= 0 && parentIndex < index ? (parentDepth.get(parentIndex) ?? 0) + 1 : 0;
    parentDepth.set(index, parentChainDepth);
    if (parentChainDepth > LOTTIE_IMPORT_LIMITS.hierarchyDepth) {
      diagnostics.push(lottieWarning('LOTTIE_HIERARCHY_LIMIT', `${path}.parent`, `Layer ${index} sits ${parentChainDepth} levels below its parent chain, above the ${LOTTIE_IMPORT_LIMITS.hierarchyDepth}-level import limit.`, 'Flatten the hierarchy in the source document and import again.'));
    }
    const parentId = parentIndex !== undefined && parentIndex >= 0 && parentIndex < index ? `lottie-layer-${parentIndex}` : undefined;
    if (parentIndex !== undefined && parentId === undefined) {
      diagnostics.push(lottieWarning('LOTTIE_BROKEN_PARENT', `${path}.parent`, `Layer ${index} points at parent ${parentIndex}, which is not an already-imported layer.`, 'Reorder the layers in the source document so parents come first.'));
    }

    const scaleXPercent = scaleX.staticValue ?? 100;
    const scaleYPercent = scaleY.staticValue ?? 100;
    layers.push({
      id: layerId,
      name: readString(layer.nm) ?? `Layer ${index}`,
      type: BASIC_LAYER_TYPES[type],
      x: x.staticValue ?? 0,
      y: y.staticValue ?? 0,
      rotation: rotation.staticValue ?? 0,
      scaleX: scaleXPercent / 100,
      scaleY: scaleYPercent / 100,
      opacity: (opacity.staticValue ?? 100) / 100,
      ...(parentId ? { parentId } : {}),
      visible: true,
      zIndex: lottieLayers.length - index,
      fillColor: solidFill ?? '#ffffff',
      strokeColor: '#101218',
      ...(solidWidth !== undefined ? { width: solidWidth } : {}),
      ...(solidHeight !== undefined ? { height: solidHeight } : {}),
    } as SceneLayer);
    const layerShape = layers[layers.length - 1];

    const shapes = asArray(layer.shapes);
    for (const [shapeIndex, shapeEntry] of shapes.entries()) {
      const shape = asRecord(shapeEntry);
      const shapeType = readString(shape?.ty);
      const shapePath = `${path}.shapes[${shapeIndex}]`;
      if (!shape || !shapeType) {
        diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_SHAPE', shapePath, `Shape item ${shapeIndex} of layer ${index} has no readable type and was skipped.`, 'Re-export the document; an unsupported item should carry a type.'));
        continue;
      }
      noteAnimatedShape(diagnostics, shape, shapeType, shapePath, shapeIndex, index);
      if (shapeType === 'sh') {
        const mapped = mapPath(shape.ks, shapePath, diagnostics);
        if (mapped && 'version' in mapped) layerShape.path = mapped;
        else if (mapped === undefined) diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_PATH', shapePath, `Path ${shapeIndex} of layer ${index} has no readable vertices and was skipped.`, 'Re-export the path from the source document.'));
        continue;
      }
      if (shapeType === 'rc' || shapeType === 'el') {
        const sizeValue = asRecord(shape.s)?.k;
        const size = Array.isArray(sizeValue) ? sizeValue : [];
        const sizeX = readNumber(size[0]);
        const sizeY = readNumber(size[1]);
        if (sizeX === undefined && sizeY === undefined) diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_SIZE', shapePath, `Shape ${shapeIndex} of layer ${index} has no readable size.`, 'Re-export the shape from the source document.'));
        if (asRecord(shape.p)?.k !== undefined) {
          diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_SHAPE_POSITION', shapePath + '.p', 'Shape ' + shapeIndex + ' of layer ' + index + ' has its own position, which KCS does not model per shape.', 'Bake the shape position into the layer transform in the source document.'));
        }
        if (shapeType === 'rc') {
          const cornerRadius = readNumber(asRecord(shape.r)?.k);
          if (cornerRadius !== undefined && cornerRadius > 0) layerShape.borderRadius = cornerRadius;
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
        if (red === undefined || green === undefined || blue === undefined) diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_COLOUR', shapePath, `Fill ${shapeIndex} of layer ${index} has no readable colour.`, 'Re-export the shape from the source document.'));
        const fillOpacity = readNumber(asRecord(shape.o)?.k);
        if (fillOpacity !== undefined) layerShape.fillOpacity = fillOpacity / 100;
        continue;
      }
      if (shapeType === 'st') {
        layerShape.strokeEnabled = true;
        const strokeWidth = readNumber(asRecord(shape.w)?.k);
        if (strokeWidth !== undefined) layerShape.strokeWidth = strokeWidth;
        else diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_STROKE_WIDTH', shapePath, `Stroke ${shapeIndex} of layer ${index} has no readable width.`, 'Re-export the shape from the source document.'));
        const strokeOpacity = readNumber(asRecord(shape.o)?.k);
        if (strokeOpacity !== undefined) layerShape.strokeOpacity = strokeOpacity / 100;
        const lineCap = readNumber(shape.lc);
        const lineJoin = readNumber(shape.lj);
        if ((lineCap !== undefined && lineCap !== 2) || (lineJoin !== undefined && lineJoin !== 2)) {
          diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_STROKE_STYLE', shapePath, 'Stroke ' + shapeIndex + ' of layer ' + index + ' sets a line cap or join, which KCS does not model.', 'Accept the default stroke style or bake it in the source document.'));
        }
        const strokeColourValue = asRecord(shape.c)?.k;
        const strokeColour = Array.isArray(strokeColourValue) ? strokeColourValue : [];
        const [strokeRed, strokeGreen, strokeBlue] = [readNumber(strokeColour[0]), readNumber(strokeColour[1]), readNumber(strokeColour[2])];
        if (strokeRed !== undefined && strokeGreen !== undefined && strokeBlue !== undefined) {
          const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value * 255))).toString(16).padStart(2, '0');
          layerShape.strokeColor = `#${toHex(strokeRed)}${toHex(strokeGreen)}${toHex(strokeBlue)}`;
        }
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
      scaleX: asFactor((scaleX.keyframes ?? []) as PropertyKeyframe[]),
      scaleY: asFactor((scaleY.keyframes ?? []) as PropertyKeyframe[]),
      opacity: asFactor((opacity.keyframes ?? []) as PropertyKeyframe[]),
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
