import type { AnimationTrackData, BezierPath, LayerMask, LayerMaskChannel, LayerMaskMode, LayerMaskPathChannel, PathKeyframe, PropertyKeyframe, TrackChannel } from '../../types/animator';
import { layerMaskChannel, layerMaskPathChannel } from '../../types/animator';
import type { SceneData, SceneLayer } from '../../types/composition';
import { isPrototypeSensitiveKey } from '../../utils/pathSafety';
import { KCS_DEFAULT_TEXT_FONT, matchTextFontFamily, normalizeTextFontName } from '../../utils/textFonts';
import { isSupportedEmbeddedImage } from '../../ograf/legacyCompatibility';
import { LOTTIE_IMPORT_LIMITS, lottieError, lottieWarning, type LottieImportDiagnostic } from './diagnostics';
import { mapLottieKeyframes, mapLottieSegmentTiming, type LottieKeyframe } from './temporal';

/**
 * Lottie import core (Milestone F, item 10).
 *
 * Implements the document- and layer-level mapping of
 * `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md` for the constructs the imported
 * slices cover — document timing, shape/solid/null layers, transforms, paths,
 * primitives, fill/stroke/trim, layer masks and track mattes — and **reports**
 * everything the slices do not convert (precomps, text, images, effects,
 * expressions) instead of guessing. Nothing here silently approximates.
 *
 * Masks and mattes reuse the KCS authorities that already exist (`LayerMask`,
 * `TrackMatteV2`, `maskChannels`/`maskPathChannels`); the importer introduces no
 * parallel mask or matte model.
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

/** Reads a bare number or a `{ k: number }` wrapper; both forms appear in the wild. */
const readPlainNumber = (value: unknown): number | undefined => readNumber(value) ?? readNumber(asRecord(value)?.k);

const readString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/**
 * Reads one point of a Lottie path. The specification stores vertices and
 * tangents as `[x, y]` pairs; an `{ x, y }` object is accepted as well, so a
 * document written by a tool that prefers the object form still imports.
 */
const readPoint = (value: unknown): { x: number; y: number } | undefined => {
  if (Array.isArray(value)) {
    const x = readNumber(value[0]);
    const y = readNumber(value[1]);
    return x === undefined || y === undefined ? undefined : { x, y };
  }
  const record = asRecord(value);
  if (!record) return undefined;
  const x = readNumber(record.x);
  const y = readNumber(record.y);
  return x === undefined || y === undefined ? undefined : { x, y };
};

/** Which properties of each shape item this slice reads as static only. */
const ANIMATED_SHAPE_PROPERTIES: Record<string, string[]> = {
  fl: ['c', 'o'],
  st: ['w', 'c', 'o'],
  rc: ['r', 's'],
  el: ['s'],
  tm: ['s', 'e', 'o'],
  sh: ['ks'],
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

/**
 * Reads a Lottie path payload (`{ v, i, o, c }`) into a canonical `BezierPath`.
 * The vertices are layer-local, which is the same space KCS stores as
 * `coordinateSpace: 'local'` — the renderer's existing mask/geometry authority
 * applies the layer transform, so no per-call-site conversion exists.
 */
const toBezierPath = (
  shape: LottieRecord | undefined,
  pathLabel: string,
  diagnostics: LottieImportDiagnostic[],
): BezierPath | undefined => {
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
    const vertex = readPoint(entry);
    if (!vertex) return [];
    const inPoint = readPoint(inTangents[index]);
    const outPoint = readPoint(outTangents[index]);
    return [{
      id: `v${index}`,
      x: vertex.x,
      y: vertex.y,
      ...(inPoint ? { inX: inPoint.x, inY: inPoint.y } : {}),
      ...(outPoint ? { outX: outPoint.x, outY: outPoint.y } : {}),
    }];
  });
  if (points.length === 0) return undefined;
  return { version: 1, coordinateSpace: 'local', closed: shape?.c === true, points: points as BezierPath['points'] };
};

/** Maps one Lottie path property (`ks`/`pt` with `v`/`i`/`o`/`c`) to a canonical `BezierPath`. */
const mapPath = (
  property: unknown,
  pathLabel: string,
  diagnostics: LottieImportDiagnostic[],
): BezierPath | undefined => toBezierPath(asRecord(asRecord(property)?.k), pathLabel, diagnostics);

/** One Lottie path keyframe: the timing plus the shape it holds. */
const readPathKeyframes = (property: unknown): { keyframes: LottieKeyframe[]; shapes: LottieRecord[] } => {
  const raw = (asRecord(property) ?? {}).k;
  const keyframes: LottieKeyframe[] = [];
  const shapes: LottieRecord[] = [];
  if (!Array.isArray(raw)) return { keyframes, shapes };
  for (const entry of raw) {
    const keyframe = asRecord(entry);
    const time = readNumber(keyframe?.t);
    // A path keyframe carries its shape in a single-entry array ().
    const shape = asRecord(Array.isArray(keyframe?.s) ? keyframe.s[0] : keyframe?.s);
    if (!keyframe || time === undefined || !shape) continue;
    const incoming = asRecord(keyframe.i);
    const outgoing = asRecord(keyframe.o);
    keyframes.push({
      time,
      // A path keyframe carries no scalar value; the geometry travels beside
      // the timing in `mapPathChannel`, so this placeholder is never read.
      values: [0],
      hold: keyframe.h === 1,
      ...(outgoing ? { out: { x: readNumber(outgoing.x) ?? 0, y: readNumber(outgoing.y) ?? 0 } } : {}),
      ...(incoming ? { in: { x: readNumber(incoming.x) ?? 0, y: readNumber(incoming.y) ?? 0 } } : {}),
      ...(keyframe.r === 1 ? { roving: true } : {}),
      ...(readString(keyframe.x) ? { expression: readString(keyframe.x) as string } : {}),
    });
    shapes.push(shape);
  }
  return { keyframes, shapes };
};

/** Maps an animated path property onto the existing mask path channel. */
const mapPathChannel = (
  property: unknown,
  pathLabel: string,
  context: { documentInPoint: number; layerStartTime?: number; channel: string },
  diagnostics: LottieImportDiagnostic[],
): PathKeyframe[] | undefined => {
  const { keyframes, shapes } = readPathKeyframes(property);
  if (keyframes.length === 0) return undefined;
  const { timing, diagnostics: timingDiagnostics } = mapLottieSegmentTiming(keyframes, {
    ...context,
    dimension: 0,
    keyframeLimit: LOTTIE_IMPORT_LIMITS.keyframesPerChannel,
    path: pathLabel,
  });
  diagnostics.push(...timingDiagnostics);
  const mapped: PathKeyframe[] = [];
  timing.forEach((entry, index) => {
    const shape = shapes[index];
    const path = shape ? toBezierPath(shape, `${pathLabel}[${index}]`, diagnostics) : undefined;
    if (!path) return;
    mapped.push({
      id: `kf-${context.channel}-${index}`,
      frame: entry.frame,
      value: path,
      easing: entry.easing,
      ...(entry.bezierIn ? { bezierIn: entry.bezierIn } : {}),
      ...(entry.bezierOut ? { bezierOut: entry.bezierOut } : {}),
    });
  });
  return mapped.length > 0 ? mapped : undefined;
};

/** Lottie mask modes that map onto the KCS `LayerMaskMode` union. */
const MASK_MODES: Record<string, LayerMaskMode> = { a: 'add', s: 'subtract', i: 'intersect' };

/**
 * Maps `masksProperties[]` onto the KCS `LayerMask` stack plus the existing
 * `maskChannels`/`maskPathChannels` for anything animated — see the design §5.
 */
const mapLayerMasks = (
  masks: unknown[],
  layerIndex: number,
  layerPath: string,
  context: { documentInPoint: number; layerStartTime?: number },
  diagnostics: LottieImportDiagnostic[],
): { masks: LayerMask[]; maskChannels: Record<LayerMaskChannel, PropertyKeyframe[]>; maskPathChannels: Record<LayerMaskPathChannel, PathKeyframe[]> } => {
  const imported: LayerMask[] = [];
  const maskChannels: Record<LayerMaskChannel, PropertyKeyframe[]> = {};
  const maskPathChannels: Record<LayerMaskPathChannel, PathKeyframe[]> = {};

  masks.forEach((entry, maskIndex) => {
    const maskPathLabel = `${layerPath}.masksProperties[${maskIndex}]`;
    const mask = asRecord(entry);
    if (!mask) {
      diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_MASK', maskPathLabel, `Mask ${maskIndex} of layer ${layerIndex} is not an object and was skipped.`, 'Re-export the document with a readable mask.'));
      return;
    }
    if (maskIndex >= LOTTIE_IMPORT_LIMITS.masksPerLayer) {
      diagnostics.push(lottieWarning('LOTTIE_MASK_LIMIT', maskPathLabel, `Layer ${layerIndex} carries ${masks.length} masks; only the first ${LOTTIE_IMPORT_LIMITS.masksPerLayer} were imported.`, 'Reduce the mask count in the source document and import again.'));
      return;
    }
    const mode = readString(mask.mode);
    const mappedMode = mode ? MASK_MODES[mode] : undefined;
    if (!mappedMode) {
      diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_MASK_MODE', `${maskPathLabel}.mode`, `Mask ${maskIndex} of layer ${layerIndex} uses mode "${mode ?? 'unknown'}", which KCS cannot represent.`, 'Use the add, subtract or intersect mask mode in the source document.'));
      return;
    }

    const maskId = `mask-${maskIndex}`;
    const pathChannel = layerMaskPathChannel(maskId);
    const animatedGeometry = isAnimatedProperty(mask.pt);
    let path: BezierPath | undefined;
    if (animatedGeometry) {
      const keyframes = mapPathChannel(mask.pt, `${maskPathLabel}.pt`, { ...context, channel: maskId }, diagnostics);
      if (keyframes) {
        maskPathChannels[pathChannel] = keyframes;
        path = keyframes[0].value;
      }
    } else {
      path = mapPath(mask.pt, `${maskPathLabel}.pt`, diagnostics);
    }
    if (!path) {
      diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_MASK', `${maskPathLabel}.pt`, `Mask ${maskIndex} of layer ${layerIndex} has no readable path and was skipped.`, 'Re-export the mask from the source document.'));
      return;
    }

    /** Reads one static mask scalar, reporting the animated form onto its channel. */
    const readMaskScalar = (property: string, channelProperty: 'opacity' | 'feather' | 'expansion', scale: number): number | undefined => {
      const value = mask[property];
      if (value === undefined) return undefined;
      if (isAnimatedProperty(value)) {
        const mapped = mapLottieKeyframes(readNumericProperty(value)?.keyframes ?? [], {
          ...context,
          dimension: 0,
          keyframeLimit: LOTTIE_IMPORT_LIMITS.keyframesPerChannel,
          path: `${maskPathLabel}.${property}`,
          channel: layerMaskChannel(maskId, channelProperty),
        });
        if (mapped.keyframes.length > 0) {
          maskChannels[layerMaskChannel(maskId, channelProperty)] = (scale === 1
            ? mapped.keyframes
            : mapped.keyframes.map((keyframe) => ({ ...keyframe, value: keyframe.value * scale }))) as PropertyKeyframe[];
          diagnostics.push(...mapped.diagnostics);
          return mapped.keyframes[0].value * scale;
        }
        diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_MASK', `${maskPathLabel}.${property}`, `Mask ${maskIndex} of layer ${layerIndex} has no readable "${property}" keyframes.`, 'Re-export the mask from the source document.'));
        return undefined;
      }
      const staticValue = readNumber(asRecord(value)?.k ?? value);
      if (staticValue === undefined) {
        diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_MASK', `${maskPathLabel}.${property}`, `Mask ${maskIndex} of layer ${layerIndex} has no readable "${property}" value.`, 'Re-export the mask from the source document.'));
        return undefined;
      }
      return staticValue * scale;
    };

    const opacity = readMaskScalar('o', 'opacity', 1 / 100);
    const feather = readMaskScalar('f', 'feather', 1);
    const expansion = readMaskScalar('x', 'expansion', 1);
    if (mask.nm !== undefined && readString(mask.nm) === undefined) {
      diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_MASK', `${maskPathLabel}.nm`, `Mask ${maskIndex} of layer ${layerIndex} has an unreadable name.`, 'Re-export the mask from the source document.'));
    }
    if (mask.inv !== undefined && typeof mask.inv !== 'boolean') {
      diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_MASK', `${maskPathLabel}.inv`, `Mask ${maskIndex} of layer ${layerIndex} has an unreadable invert flag.`, 'Re-export the mask from the source document.'));
    }

    imported.push({
      id: maskId,
      name: readString(mask.nm) ?? `Mask ${maskIndex + 1}`,
      path,
      mode: mappedMode,
      enabled: true,
      ...(mask.inv === true ? { inverted: true } : {}),
      ...(opacity !== undefined ? { opacity } : {}),
      ...(feather !== undefined ? { feather } : {}),
      ...(expansion !== undefined ? { expansion } : {}),
    });
  });

  return { masks: imported, maskChannels, maskPathChannels };
};

/** Lottie track matte types (`tt`) → the KCS `TrackMatteV2` mode and inversion. */
const TRACK_MATTE_TYPES: Record<number, { mode: 'alpha' | 'luminance'; inverted: boolean }> = {
  1: { mode: 'alpha', inverted: false },
  2: { mode: 'alpha', inverted: true },
  3: { mode: 'luminance', inverted: false },
  4: { mode: 'luminance', inverted: true },
};

/** Lottie text fields KCS has no counterpart for; a present, non-default one is reported. */
const UNSUPPORTED_TEXT_STYLE_FIELDS: { key: string; label: string; defaultValue: number }[] = [
  { key: 'j', label: 'justification', defaultValue: 0 },
  { key: 'tr', label: 'tracking', defaultValue: 0 },
  { key: 'lh', label: 'line height', defaultValue: 0 },
  { key: 'ls', label: 'baseline shift', defaultValue: 0 },
  { key: 'ca', label: 'all-caps', defaultValue: 0 },
];

/** Reads `[r, g, b]` (0..1 floats) into a hex colour, the form KCS stores. */
const toHexColour = (value: unknown): string | undefined => {
  const channels = Array.isArray(value) ? value : [];
  const [red, green, blue] = [readNumber(channels[0]), readNumber(channels[1]), readNumber(channels[2])];
  if (red === undefined || green === undefined || blue === undefined) return undefined;
  const toHex = (component: number) => Math.max(0, Math.min(255, Math.round(component * 255))).toString(16).padStart(2, '0');
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

/**
 * Reports a font family KCS cannot render, once per family per document.
 *
 * `fonts.list` and the text documents both name families, and both spellings
 * ("Roboto" and "Roboto-Bold") are the same family — hence the normalised key.
 */
/**
 * Reports a font family KCS cannot render, once per family per document.
 *
 * `fonts.list` and the text documents both name families, and both spellings
 * ("Roboto" and "Roboto-Bold") are the same family — hence the normalised key.
 */
const reportFontFamily = (
  family: string,
  sourcePath: string,
  reported: Set<string>,
  diagnostics: LottieImportDiagnostic[],
): void => {
  const key = normalizeTextFontName(family);
  if (key.length === 0 || reported.has(key)) return;
  reported.add(key);
  if (matchTextFontFamily(family) !== undefined) return;
  diagnostics.push(lottieWarning('LOTTIE_UNKNOWN_FONT', sourcePath, `Font family "${family}" is not one of the fonts KCS can render; the default font "${KCS_DEFAULT_TEXT_FONT}" is used.`, 'Choose a portable font before exporting, or set the family after import.'));
};

/**
 * Maps a Lottie text layer (`ty: 5`) onto the KCS text fields. Only the
 * static text document maps; animators, text boxes, text-on-path and the
 * document properties KCS does not model are reported (§3 of the design).
 *
 * Diagnostics carry the document's own node path (`layers[i].t.d.k[0].s…`), so
 * the author can find the construct in the source file.
 */
const mapTextLayer = (layer: LottieRecord, layerPath: string, index: number, reportedFonts: Set<string>, diagnostics: LottieImportDiagnostic[]): { textValue?: string; fontSize?: number; fontFamily?: string; fillColor?: string } => {
  const textProperty = asRecord(layer.t);
  const textPath = `${layerPath}.t`;
  if (!textProperty) {
    diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_TEXT', `${textPath}`, `Text layer ${index} carries no readable text property.`, 'Re-export the layer from the source document.'));
    return {};
  }
  const documents = asArray(asRecord(textProperty.d)?.k);
  const documentPath = `${textPath}.d.k`;
  if (documents.length === 0) {
    if (textProperty.d !== undefined && !Array.isArray(asRecord(textProperty.d)?.k)) {
      diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_TEXT', documentPath, `Text layer ${index} has an unreadable text document list.`, 'Re-export the layer from the source document.'));
      return {};
    }
    diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_TEXT', documentPath, `Text layer ${index} carries no readable text document.`, 'Re-export the layer from the source document.'));
    return {};
  }
  if (documents.length > 1) {
    diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_ANIMATED_TEXT', documentPath, `Text layer ${index} animates its text document; only the first document is imported.`, 'Bake the text animation in the source document or re-create it after import.'));
  }
  const document = asRecord(asRecord(documents[0])?.s);
  const valuePath = `${documentPath}[0].s`;
  if (!document) {
    diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_TEXT', valuePath, `Text layer ${index} has an unreadable text document.`, 'Re-export the layer from the source document.'));
    return {};
  }

  const textValue = readString(document.t) ?? readString(document.s);
  if (textValue === undefined) {
    diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_TEXT', `${valuePath}.t`, `Text layer ${index} has no readable text string.`, 'Re-export the layer from the source document.'));
    return {};
  }

  const sourceFamily = readString(document.f);
  if (document.f !== undefined && sourceFamily === undefined) {
    diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_TEXT', `${valuePath}.f`, `Text layer ${index} has an unreadable font name.`, 'Re-export the layer from the source document.'));
  }
  const fontFamily = matchTextFontFamily(sourceFamily);
  if (sourceFamily !== undefined) reportFontFamily(sourceFamily, `${valuePath}.f`, reportedFonts, diagnostics);

  const fontSize = readNumber(document.s);
  if (document.s !== undefined && fontSize === undefined) {
    diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_TEXT', `${valuePath}.s`, `Text layer ${index} has an unreadable font size.`, 'Re-export the layer from the source document.'));
  }

  const fillColor = toHexColour(document.fc);
  if (fillColor === undefined) {
    diagnostics.push(lottieWarning('LOTTIE_MISSING_TEXT_COLOUR', `${valuePath}.fc`, `Text layer ${index} declares no readable text colour.`, 'Set the text colour again after import.'));
  }

  const unsupported: string[] = [];
  const unreadable: string[] = [];
  for (const { key, label, defaultValue } of UNSUPPORTED_TEXT_STYLE_FIELDS) {
    if (document[key] === undefined) continue;
    const value = readPlainNumber(document[key]);
    if (value === undefined) unreadable.push(label);
    else if (value !== defaultValue) unsupported.push(label);
  }
  if (unsupported.length > 0) {
    diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_TEXT_STYLE', valuePath, `Text layer ${index} uses ${unsupported.join(', ')}, which KCS does not model.`, 'Accept the default text layout or re-create it after import.'));
  }
  if (unreadable.length > 0) {
    diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_TEXT', valuePath, `Text layer ${index} has unreadable ${unreadable.join(', ')} value(s).`, 'Re-export the layer from the source document.'));
  }

  if (textProperty.a !== undefined) {
    if (Array.isArray(textProperty.a)) {
      const animators = textProperty.a.length;
      if (animators > 0) {
        diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_TEXT_ANIMATOR', `${textPath}.a`, `Text layer ${index} carries ${animators} text animator(s), which are not applied.`, 'Bake the text animation in the source document and import again.'));
      }
    } else {
      diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_TEXT', `${textPath}.a`, `Text layer ${index} has an unreadable animator list.`, 'Re-export the layer from the source document.'));
    }
  }
  for (const layoutField of ['m', 'p']) {
    if (textProperty[layoutField] === undefined) continue;
    diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_TEXT_LAYOUT', `${textPath}.${layoutField}`, layoutField === 'm'
      ? `Text layer ${index} uses a text box, which KCS does not model.`
      : `Text layer ${index} follows a text path, which KCS does not model.`, 'Convert the text to a shape in the source document, or re-create the layout after import.'));
  }

  return {
    textValue,
    ...(fontSize !== undefined ? { fontSize } : {}),
    ...(fontFamily !== undefined ? { fontFamily } : {}),
    ...(fillColor !== undefined ? { fillColor } : {}),
  };
};

/**
 * Resolves a Lottie image layer (`ty: 2`) against the document asset table.
 *
 * Only an embedded data URL that already passes the application's embedded-image
 * policy is imported; a path or URL is never read, fetched or resolved, because
 * the importer receives the document text and nothing else. Everything else is
 * reported and the layer skipped. Asset problems are reported at the asset's own
 * node (`assets[i].p`), so the path points at what the author must fix.
 */
const mapImageLayer = (layer: LottieRecord, layerPath: string, index: number, assets: Map<string, AssetEntry>, diagnostics: LottieImportDiagnostic[]): { imageUrl?: string; width?: number; height?: number } | undefined => {
  const refId = readString(layer.refId);
  if (refId === undefined) {
    diagnostics.push(lottieWarning('LOTTIE_MISSING_ASSET', `${layerPath}.refId`, `Image layer ${index} names no asset.`, 'Re-export the document with its asset table.'));
    return undefined;
  }
  const entry = assets.get(refId);
  if (!entry) {
    diagnostics.push(lottieWarning('LOTTIE_MISSING_ASSET', `${layerPath}.refId`, `Image layer ${index} references asset "${refId}", which the document does not carry.`, 'Export the animation with its assets embedded and import it again.'));
    return undefined;
  }
  const { asset, assetPath } = entry;

  const fileName = readString(asset.p);
  if (fileName === undefined) {
    diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_IMAGE_ASSET', `${assetPath}.p`, `Image layer ${index} references asset "${refId}", which carries no readable file name.`, 'Re-export the document with its asset table.'));
    return undefined;
  }
  if (!fileName.startsWith('data:')) {
    const prefix = readString(asset.u) ?? '';
    // Never echo the raw source: a path can carry a machine tree and a URL can
    // carry credentials, so the diagnostic states the shape, not the value.
    const shape = prefix.length > 0 ? 'a file path' : 'a file name';
    diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_IMAGE_SOURCE', `${assetPath}.p`, `Image layer ${index} references ${shape} outside the document, which the importer cannot read.`, 'Export the animation with the image embedded as a data URL and import it again.'));
    return undefined;
  }
  if (/%0?\d*d/u.test(fileName)) {
    diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_IMAGE_SEQUENCE', `${assetPath}.p`, `Image layer ${index} references asset "${refId}", an image sequence, which KCS does not model.`, 'Export the animation with single images instead of a sequence.'));
    return undefined;
  }
  if (!isSupportedEmbeddedImage(fileName)) {
    const mimeType = /^data:([^;,]+)/u.exec(fileName)?.[1] ?? 'unknown';
    diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_IMAGE_TYPE', `${assetPath}.p`, `Image layer ${index} embeds "${mimeType}", which is not a supported image type.`, 'Use a PNG, JPEG, GIF, WebP or safe SVG asset.'));
    return undefined;
  }

  const assetWidth = readNumber(asset.w);
  const assetHeight = readNumber(asset.h);
  if (assetWidth === undefined) {
    diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_IMAGE_ASSET', `${assetPath}.w`, asset.w === undefined
      ? `Image layer ${index} references asset "${refId}", which declares no width.`
      : `Image layer ${index} references asset "${refId}", which declares an unreadable width.`, 'Re-export the asset from the source document.'));
  }
  if (assetHeight === undefined) {
    diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_IMAGE_ASSET', `${assetPath}.h`, asset.h === undefined
      ? `Image layer ${index} references asset "${refId}", which declares no height.`
      : `Image layer ${index} references asset "${refId}", which declares an unreadable height.`, 'Re-export the asset from the source document.'));
  }

  return {
    imageUrl: fileName,
    ...(assetWidth !== undefined ? { width: assetWidth } : {}),
    ...(assetHeight !== undefined ? { height: assetHeight } : {}),
  };
};

/** One entry of the document asset table, with the node path the reports point at. */
interface AssetEntry {
  asset: LottieRecord;
  assetPath: string;
}

/** Collects the document asset table by id, so a layer can resolve its `refId`. */
const readAssetTable = (assets: unknown[]): Map<string, AssetEntry> => {
  const table = new Map<string, AssetEntry>();
  assets.forEach((entry, index) => {
    const asset = asRecord(entry);
    const id = readString(asset?.id);
    if (asset && id !== undefined && !table.has(id)) table.set(id, { asset, assetPath: `assets[${index}]` });
  });
  return table;
};

/**
 * Walks the precomp asset graph for cycles, nesting beyond the import limit and
 * missing precomp assets. Nothing is converted — the design keeps precomps
 * *unsupported, preserved* — but a document that would recurse forever is worth
 * telling the author about.
 *
 * Each asset is expanded once across the whole walk and every finding is
 * reported once, so a shared sub-precomp cannot produce duplicate entries.
 */
const reportPrecompGraph = (assets: Map<string, AssetEntry>, diagnostics: LottieImportDiagnostic[]): void => {
  if (assets.size === 0) return;
  const reported = new Set<string>();
  const reportOnce = (key: string, code: string, sourcePath: string, message: string, action: string): void => {
    if (reported.has(key)) return;
    reported.add(key);
    diagnostics.push(lottieWarning(code, sourcePath, message, action));
  };

  // The walk is bounded twice over: a branch never re-enters an asset it is
  // already inside (that is the cycle case), and the total number of expansions
  // is capped, so a dense graph cannot make the import unbounded work.
  let budget = assets.size * (LOTTIE_IMPORT_LIMITS.hierarchyDepth + 2);

  const walk = (assetId: string, chain: string[]): void => {
    const entry = assets.get(assetId);
    if (!entry) return;
    const cycleStart = chain.indexOf(assetId);
    if (cycleStart >= 0) {
      // The same cycle is reachable from every asset it contains; the member
      // list is the key, so the document is told about it exactly once.
      const members = [...chain.slice(cycleStart)].sort();
      reportOnce(`cycle:${members.join('|')}`, 'LOTTIE_PRECOMP_CYCLE', `${entry.assetPath}.layers`, `The precomposition assets of this document form a cycle through "${members[0]}".`, 'Break the precomposition cycle in the source document and export again.');
      return;
    }
    if (chain.length > LOTTIE_IMPORT_LIMITS.hierarchyDepth) {
      reportOnce('depth-limit', 'LOTTIE_PRECOMP_DEPTH_LIMIT', `${entry.assetPath}.layers`, `The precomposition assets nest deeper than the ${LOTTIE_IMPORT_LIMITS.hierarchyDepth}-level import limit.`, 'Flatten the precomposition nesting in the source document.');
      return;
    }
    if (budget <= 0) return;
    budget -= 1;

    const layers = entry.asset.layers;
    if (!Array.isArray(layers)) {
      reportOnce(`unreadable:${assetId}`, 'LOTTIE_UNREADABLE_PRECOMP', `${entry.assetPath}.layers`, `Precomposition "${assetId}" carries a layer list that is not an array.`, 'Re-export the document so its precompositions travel with the layers.');
      return;
    }
    // The chain is per branch: a sibling may legitimately reach the same asset
    // the previous sibling reached without that being a cycle.
    const nested = [...chain, assetId];
    layers.forEach((childEntry, childIndex) => {
      const child = asRecord(childEntry);
      if (readNumber(child?.ty) !== 0) return;
      const childRef = readString(child?.refId);
      if (childRef === undefined) {
        reportOnce(`unreadable-ref:${assetId}:${childIndex}`, 'LOTTIE_UNREADABLE_PRECOMP', `${entry.assetPath}.layers[${childIndex}].refId`, `A precomposition layer inside "${assetId}" names no readable asset.`, 'Re-export the document so its precompositions travel with the layers.');
        return;
      }
      if (!assets.has(childRef)) {
        reportOnce(`missing:${childRef}`, 'LOTTIE_PRECOMP_MISSING_ASSET', `${entry.assetPath}.layers[${childIndex}].refId`, `A precomposition layer references asset "${childRef}", which the document does not carry.`, 'Export the animation with all precompositions included.');
        return;
      }
      walk(childRef, nested);
    });
  };

  for (const [assetId, entry] of assets) {
    if (entry.asset.layers === undefined) continue;
    walk(assetId, []);
  }
};


const BASIC_LAYER_TYPES: Record<number, string> = {
  1: 'custom',
  2: 'custom_image',
  3: 'custom',
  4: 'custom',
  5: 'custom_text',
};

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

  const documentWidth = readNumber(root.w);
  const documentHeight = readNumber(root.h);
  if (documentWidth === undefined || documentHeight === undefined) {
    diagnostics.push(lottieWarning('LOTTIE_MISSING_DOCUMENT_SIZE', '$.w', 'The document does not declare both a width (`w`) and a height (`h`); the import uses 1920x1080.', 'Export the document with an explicit composition size.'));
  }
  const width = documentWidth ?? 1920;
  const height = documentHeight ?? 1080;
  const layers: SceneLayer[] = [];
  const tracks: AnimationTrackData[] = [];
  const layerIds: string[] = [];
  /** Parent-chain depth per Lottie layer index, so the limit counts levels, not gaps. */
  const parentDepth = new Map<number, number>();
  /** The document asset table (`assets[]`), so image and precomp layers can resolve their `refId`. */
  const assetTable = readAssetTable(asArray(root.assets));
  /** Font families already reported, so one family is named once per document. */
  const reportedFonts = new Set<string>();
  // The document's font table names families the layers may not use; the design
  // reports an unknown family once, so it is checked here as well.
  asArray(asRecord(root.fonts)?.list).forEach((entry, fontIndex) => {
    const fontEntry = asRecord(entry);
    const family = readString(fontEntry?.fFamily);
    const familyPath = `$.fonts.list[${fontIndex}].fFamily`;
    if (family !== undefined) reportFontFamily(family, familyPath, reportedFonts, diagnostics);
    else if (fontEntry?.fFamily !== undefined) {
      diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_TEXT', familyPath, `Font entry ${fontIndex} has an unreadable family name.`, 'Re-export the document so its font table travels with the text.'));
    }
  });
  /** One report per precomp layer, and one precomp-graph pass per document. */
  let precompGraphReported = false;

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
    if (type === 0) {
      const refId = readString(layer.refId);
      if (!precompGraphReported) {
        precompGraphReported = true;
        reportPrecompGraph(assetTable, diagnostics);
      }
      if (layer.refId === undefined) {
        diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_PRECOMP', `${path}.refId`, `Precomposition layer ${index} names no asset.`, 'Re-export the document so its precompositions travel with the layers.'));
      } else if (refId === undefined) {
        diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_PRECOMP', `${path}.refId`, `Precomposition layer ${index} has an unreadable asset reference.`, 'Re-export the document so its precompositions travel with the layers.'));
      } else if (!assetTable.has(refId)) {
        diagnostics.push(lottieWarning('LOTTIE_PRECOMP_MISSING_ASSET', `${path}.refId`, `Precomposition layer ${index} references asset "${refId}", which the document does not carry.`, 'Export the animation with all precompositions included.'));
      }
      diagnostics.push(
        lottieWarning(
          'LOTTIE_PRECOMP_UNMAPPED',
          path,
          `Layer ${index} is a precomposition layer${refId !== undefined ? ` ("${refId}")` : ''}; a precomposition owns its own timeline, so it is preserved in the source document instead of being flattened.`,
          'Render the precomposition in the source document and re-create it after import.',
        ),
      );
      return;
    }
    if (BASIC_LAYER_TYPES[type] === undefined) {
      diagnostics.push(
        lottieWarning(
          'LOTTIE_UNSUPPORTED_LAYER_TYPE',
          path,
          `Layer ${index} is a layer of type ${type}, which this importer does not convert.`,
          'Flatten or bake the layer in the source document, then import again.',
        ),
      );
      return;
    }
    if (layer.ef !== undefined) diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_EFFECT', `${path}.ef`, `Layer ${index} carries effects, which are not converted.`, 'Remove the effect or bake it before exporting.'));
    if (layer.hasExpressions === true) diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_EXPRESSION', `${path}.hasExpressions`, `Layer ${index} uses expressions, which are preserved but not evaluated.`, 'Bake the expressions and export again.'));
    if (layer.ip !== undefined || layer.op !== undefined) diagnostics.push(lottieWarning('LOTTIE_LAYER_TIMING', `${path}.ip`, `Layer ${index} has an in/out range, which KCS does not model.`, 'Trim the layer after import, or remove the in/out range in the source document.'));
    if (asRecord(layer.ks)?.sk !== undefined || asRecord(layer.ks)?.sa !== undefined) diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_SKEW', `${path}.ks.sk`, `Layer ${index} is skewed, which KCS does not model.`, 'Bake the skew in the source document.'));
    if (layer.ao === 1) diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_AUTO_ORIENT', `${path}.ao`, `Layer ${index} uses auto-orient, which KCS does not model.`, 'Bake the orientation in the source document.'));
    if (layer.masksProperties !== undefined && !Array.isArray(layer.masksProperties)) {
      diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_MASK', `${path}.masksProperties`, `Layer ${index} carries a mask list that is not an array.`, 'Re-export the document so the mask list travels with the layer.'));
    } else if (layer.hasMask === true && layer.masksProperties === undefined) {
      diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_MASK', `${path}.masksProperties`, `Layer ${index} is flagged as masked but carries no mask list.`, 'Re-export the document so the mask list travels with the layer.'));
    }

    const solidFill = readString(layer.sc);
    const solidWidth = readNumber(layer.sw);
    const solidHeight = readNumber(layer.sh);
    if (type === 1 && (solidFill === undefined || solidWidth === undefined || solidHeight === undefined)) {
      diagnostics.push(lottieWarning('LOTTIE_MISSING_SOLID_PAINT', path, 'Solid layer ' + index + ' does not carry both a colour (`sc`) and a size (`sw`/`sh`); the missing values fall back to white and the layer size.', 'Set the solid colour and size in the source document.'));
    }
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
    let image: { imageUrl?: string; width?: number; height?: number } | undefined;
    if (type === 2) {
      image = mapImageLayer(layer, path, index, assetTable, diagnostics);
      // A reported image layer stays out of the scene entirely, so no later
      // layer can point at an id that does not exist.
      if (!image) return;
    }
    layerIds.push(layerId);
    const parentIndex = readNumber(layer.parent);
    const parentChainDepth = parentIndex !== undefined && parentIndex >= 0 && parentIndex < index ? (parentDepth.get(parentIndex) ?? 0) + 1 : 0;
    parentDepth.set(index, parentChainDepth);
    if (parentChainDepth > LOTTIE_IMPORT_LIMITS.hierarchyDepth) {
      diagnostics.push(lottieWarning('LOTTIE_HIERARCHY_LIMIT', `${path}.parent`, `Layer ${index} sits ${parentChainDepth} levels below its parent chain, above the ${LOTTIE_IMPORT_LIMITS.hierarchyDepth}-level import limit.`, 'Flatten the hierarchy in the source document and import again.'));
    }
    const candidateParentId = parentIndex !== undefined && parentIndex >= 0 && parentIndex < index ? `lottie-layer-${parentIndex}` : undefined;
    const parentId = candidateParentId !== undefined && layerIds.includes(candidateParentId) ? candidateParentId : undefined;
    if (parentIndex !== undefined && parentId === undefined) {
      diagnostics.push(lottieWarning('LOTTIE_BROKEN_PARENT', `${path}.parent`, `Layer ${index} points at parent ${parentIndex}, which is not an imported layer of this scene.`, 'Reorder the layers in the source document so parents come first, and make sure the parent layer itself can be imported.'));
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

    if (image) {
      if (image.imageUrl !== undefined) layerShape.imageUrl = image.imageUrl;
      if (image.width !== undefined) layerShape.width = image.width;
      if (image.height !== undefined) layerShape.height = image.height;
    }

    if (type === 5) {
      const text = mapTextLayer(layer, path, index, reportedFonts, diagnostics);
      if (text.textValue !== undefined) layerShape.textValue = text.textValue;
      if (text.fontSize !== undefined) layerShape.fontSize = text.fontSize;
      if (text.fontFamily !== undefined) layerShape.fontFamily = text.fontFamily;
      if (text.fillColor !== undefined) layerShape.fillColor = text.fillColor;
    }

    const masks = mapLayerMasks(asArray(layer.masksProperties), index, path, { documentInPoint: inPoint, layerStartTime }, diagnostics);
    if (masks.masks.length > 0) layerShape.masks = masks.masks;

    // The matte source is the layer directly above unless `tp` names another
    // one (Lottie's rule); `td` is the 0/1 flag that marks a matte layer, so it
    // can only ever confirm or contradict that positional rule.
    const matteType = readNumber(layer.tt);
    if (matteType !== undefined) {
      const matte = TRACK_MATTE_TYPES[matteType];
      const sourceId = `lottie-layer-${index - 1}`;
      const sourceLayer = index > 0 ? asRecord(lottieLayers[index - 1]) : undefined;
      const sourceImported = index > 0 && layers.some((candidate) => candidate.id === sourceId);
      const matteParent = readNumber(layer.tp);
      if (!matte) {
        diagnostics.push(lottieWarning('LOTTIE_TRACK_MATTE_UNSUPPORTED', `${path}.tt`, `Layer ${index} declares track matte type ${matteType}, which KCS does not model.`, 'Use an alpha or luminance matte in the source document.'));
      } else if (matteParent !== undefined) {
        diagnostics.push(lottieWarning('LOTTIE_TRACK_MATTE_UNSUPPORTED', `${path}.tp`, `Layer ${index} names layer ${matteParent} as its matte parent, which this slice does not resolve.`, 'Remove the explicit matte parent in the source document so the layer above is used.'));
      } else if (!sourceImported) {
        diagnostics.push(lottieWarning('LOTTIE_TRACK_MATTE_MISSING_SOURCE', `${path}.tt`, `Layer ${index} declares a track matte, but the layer above it (layer ${index - 1}), which Lottie uses as the matte source, was not imported.`, 'Import the source layer as well, or bake the matte in the source document.'));
      } else if (readNumber(sourceLayer?.td) === 0) {
        diagnostics.push(lottieWarning('LOTTIE_TRACK_MATTE_AMBIGUOUS', `layers[${index - 1}].td`, `Layer ${index} declares a track matte, but the layer above it marks itself as no matte target (\`td: 0\`).`, 'Correct the matte flags in the source document and export again.'));
      } else {
        // Lottie never draws a matte layer on its own, so the source is hidden —
        // the same relationship `sourceVisible: false` describes in KCS.
        layerShape.trackMatte = {
          sourceLayerId: sourceId,
          mode: matte.mode,
          enabled: true,
          sourceVisible: false,
          ...(matte.inverted ? { inverted: true } : {}),
        };
      }
    } else if (layer.tt !== undefined) {
      diagnostics.push(lottieWarning('LOTTIE_TRACK_MATTE_UNSUPPORTED', `${path}.tt`, `Layer ${index} declares a track matte type that is not a number.`, 'Re-export the document with a valid matte type.'));
    } else if (readNumber(layer.td) === 1) {
      const targetLayer = index + 1 < lottieLayers.length ? asRecord(lottieLayers[index + 1]) : undefined;
      if (readNumber(targetLayer?.tt) === undefined) {
        diagnostics.push(lottieWarning('LOTTIE_TRACK_MATTE_UNSUPPORTED', `${path}.td`, `Layer ${index} marks itself as a matte source, but the layer below it declares no track matte.`, 'Remove the matte flag in the source document, or declare the matte on the layer below.'));
      }
    }

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
        // An animated path already carries its own, accurate report above.
        else if (mapped === undefined && !isAnimatedProperty(shape.ks)) diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_PATH', shapePath, `Path ${shapeIndex} of layer ${index} has no readable vertices and was skipped.`, 'Re-export the path from the source document.'));
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
        if (shape.d !== undefined) {
          diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_STROKE_DASH', shapePath, 'Stroke ' + shapeIndex + ' of layer ' + index + ' uses a dash pattern, which KCS does not model.', 'Accept a solid stroke or bake the dashes in the source document.'));
        }
        const lineCap = readPlainNumber(shape.lc);
        const lineJoin = readPlainNumber(shape.lj);
        if ((lineCap !== undefined && lineCap !== 2) || (lineJoin !== undefined && lineJoin !== 2)) {
          diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_STROKE_STYLE', shapePath, 'Stroke ' + shapeIndex + ' of layer ' + index + ' sets a line cap or join, which KCS does not model.', 'Accept the default stroke style or bake it in the source document.'));
        }
        const strokeColourValue = asRecord(shape.c)?.k;
        const strokeColour = Array.isArray(strokeColourValue) ? strokeColourValue : [];
        const [strokeRed, strokeGreen, strokeBlue] = [readNumber(strokeColour[0]), readNumber(strokeColour[1]), readNumber(strokeColour[2])];
        if (strokeRed === undefined || strokeGreen === undefined || strokeBlue === undefined) {
          diagnostics.push(lottieWarning('LOTTIE_UNREADABLE_COLOUR', shapePath, 'Stroke ' + shapeIndex + ' of layer ' + index + ' has no readable colour.', 'Re-export the shape from the source document.'));
        }
        if (strokeRed !== undefined && strokeGreen !== undefined && strokeBlue !== undefined) {
          const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value * 255))).toString(16).padStart(2, '0');
          layerShape.strokeColor = `#${toHex(strokeRed)}${toHex(strokeGreen)}${toHex(strokeBlue)}`;
        }
        continue;
      }
      if (shapeType === 'tm') {
        const trimMode = readPlainNumber(shape.m);
        if (trimMode !== undefined && trimMode !== 1) {
          diagnostics.push(lottieWarning('LOTTIE_UNSUPPORTED_TRIM_MODE', shapePath, 'Trim ' + shapeIndex + ' of layer ' + index + ' uses trim mode ' + trimMode + ', which KCS does not model.', 'Use the default trim mode in the source document.'));
        }
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
    const maskChannels = masks.maskChannels;
    const maskPathChannels = masks.maskPathChannels;
    const hasMaskChannels = Object.keys(maskChannels).length > 0;
    const hasMaskPathChannels = Object.keys(maskPathChannels).length > 0;
    if (Object.values(channels).some((keyframes) => keyframes.length > 0) || hasMaskChannels || hasMaskPathChannels) {
      tracks.push({
        partId: layerId,
        channels: channels as AnimationTrackData['channels'],
        ...(hasMaskChannels ? { maskChannels } : {}),
        ...(hasMaskPathChannels ? { maskPathChannels } : {}),
      });
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
