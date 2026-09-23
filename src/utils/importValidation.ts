import type { CharacterPart, Track } from '../types/animator';
import type { SceneData } from '../types/composition';
import { isPrototypeSensitiveKey } from './pathSafety';
import { isSceneCoordinateSystem } from './coordinateMigration';

/**
 * Validated parse for imported project documents.
 *
 * Every imported file is untrusted input: it can be malformed, enormous, or
 * crafted to pollute prototypes. This module is the single boundary that turns
 * raw text into a typed document, and it fails closed with a diagnostic instead
 * of handing an unvalidated object to the serializer. It replaces parsing
 * straight into `any` and narrowing afterwards.
 *
 * See `docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md` §4 (item 12, security half)
 * and `reports/progress_119_kcs_import_boundary.md` for the decision record.
 */

/** One reason an import was refused, shaped like the export diagnostics. */
export interface ImportDiagnostic {
  code: string;
  severity: 'error' | 'warning';
  feature: string;
  path: string;
  message: string;
  action: string;
}

/**
 * The legacy project shape the importer still accepts (backward compatibility).
 *
 * `tracks` and `characterParts` are proven arrays by the boundary; the remaining
 * fields are the ones the legacy application path reads and are typed `unknown`
 * on purpose — the consumer narrows each one (`typeof`, guards) instead of
 * trusting the document, which is what the previous `any` did.
 */
export interface LegacyProjectDocument {
  tracks: Track[];
  characterParts: CharacterPart[];
  fps?: unknown;
  totalFrames?: unknown;
  projectResolution?: unknown;
  motionTemplates?: unknown;
  activeTemplateId?: unknown;
  coordinateSystem?: unknown;
  lastSavedTime?: unknown;
  sceneTitle?: unknown;
  name?: unknown;
}

/** A document the importer accepts: the current scene shape or the legacy project shape. */
export type ImportedDocument = { kind: 'scene'; scene: SceneData } | { kind: 'legacy-project'; project: LegacyProjectDocument };

export type ImportValidationResult =
  | { ok: true; document: ImportedDocument; diagnostics: ImportDiagnostic[] }
  | { ok: false; diagnostics: ImportDiagnostic[] };

/**
 * What the importer reports back to the UI: whether the document was applied,
 * plus the diagnostics that refused it (or the warnings worth showing).
 */
export interface ImportResult {
  ok: boolean;
  diagnostics: ImportDiagnostic[];
}

/** Refuse documents larger than this before parsing them. */
export const MAX_IMPORT_CHARACTERS = 32 * 1024 * 1024;
/** Refuse documents that declare more layers or tracks than this. */
export const MAX_IMPORT_LAYERS = 5000;
/** Bound the tree walk so a hostile document cannot make validation unbounded. */
export const MAX_IMPORT_DEPTH = 64;

const refuse = (code: string, path: string, message: string, action: string): ImportValidationResult => ({
  ok: false,
  diagnostics: [{ code, severity: 'error', feature: 'project-import', path, message, action }],
});

/**
 * Narrowing helper: a plain object we may index by string key. The runtime check
 * (object, not null, not an array) is what makes the index signature truthful —
 * the cast only supplies the signature the compiler cannot infer from `object`.
 */
const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
};

/**
 * Walks the document and reports the first prototype-sensitive key, or the first
 * node deeper than the walk can check — a document that nests further is refused
 * rather than accepted with an unchecked subtree.
 */
const findPrototypeSensitiveKey = (value: unknown): { key: string; path: string } | undefined => {
  const stack: { node: unknown; path: string; depth: number }[] = [{ node: value, path: '$', depth: 0 }];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (current.depth > MAX_IMPORT_DEPTH) return { key: '', path: current.path };

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

/**
 * True for a current KCS scene document: a numeric `version` of at least 1
 * *and* the two arrays the scene contract requires. Checking `version` alone
 * would accept a document the serializer cannot apply.
 */
const isSceneDocument = (value: unknown): value is SceneData => {
  const record = asRecord(value);
  if (!record) return false;
  return typeof record.version === 'number' && record.version >= 1 && Array.isArray(record.layers) && Array.isArray(record.tracks);
};

/**
 * Fields `fromSceneData` consumes after it has queued its state updates. A
 * scene that carries one of them in the wrong shape would apply part of itself
 * and then fail, so the boundary refuses it here instead.
 */
const sceneFieldProblem = (scene: SceneData): { path: string; message: string; action: string } | undefined => {
  const record = scene as unknown as Record<string, unknown>;
  if (record.motionTemplates !== undefined && !Array.isArray(record.motionTemplates)) {
    return { path: '$.motionTemplates', message: 'The scene declares motion templates that are not a list.', action: 'Re-export the project from Keyframe Studio and import the new file.' };
  }
  if (record.activeTemplateId !== undefined && typeof record.activeTemplateId !== 'string') {
    return { path: '$.activeTemplateId', message: 'The scene declares an active template id that is not text.', action: 'Re-export the project from Keyframe Studio and import the new file.' };
  }
  if (record.coordinateSystem !== undefined && !isSceneCoordinateSystem(record.coordinateSystem)) {
    return { path: '$.coordinateSystem', message: 'The scene declares an unknown coordinate system.', action: 'Re-export the project from Keyframe Studio and import the new file.' };
  }
  return undefined;
};

// ─── Semantic validation of a scene document ─────────────────────────────
//
// `sceneFieldProblem` above checks the fields the *apply* path reads while it
// queues its updates. This pass checks the values the **renderers and the
// evaluator** read at frame time: an import returns long before those run, so a
// wrong shape there surfaces later as a blank stage, a dropped layer or a
// component crash instead of a refused file.
//
// The policy, so the rules stay predictable:
//
//   * a **required** field is one the apply path has no default for, so its
//     absence silently breaks an id lookup or the z-order;
//   * every other consumed field is validated **when present** — the documented
//     defaults (`0`, `1`, `'none'`) are what an absent value already means, so
//     refusing absence would reject documents the editor applies today;
//   * the first problem refuses the whole document, so nothing is applied.

/** The one refusal carries a stable code, a path the author can find, and a next step. */
interface SceneProblem {
  code: string;
  path: string;
  message: string;
  action: string;
}

const REIMPORT_ACTION = 'Re-export the project from Keyframe Studio and import the new file.';

/** Scene versions this build can apply; a higher one is a file from a newer build. */
const SUPPORTED_SCENE_VERSIONS: readonly number[] = [1, 2];

const sceneProblem = (code: string, path: string, message: string, action: string = REIMPORT_ACTION): SceneProblem =>
  ({ code, path, message, action });

const isFiniteNumberValue = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Numeric layer fields the canvas renderers and the evaluator do arithmetic on.
 * A non-numeric value reaches the SVG attributes as `NaN`.
 */
const NUMERIC_LAYER_FIELDS = [
  'x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity', 'zIndex',
  'fillOpacity', 'strokeOpacity', 'strokeWidth', 'fontSize',
  'trimPathStart', 'trimPathEnd', 'trimPathOffset',
  'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'borderRadius',
  'width', 'height', 'maskOffsetX', 'maskOffsetY', 'maskScale', 'maskRotation',
  'inAnimDuration', 'outAnimDuration',
] as const;

/**
 * Layer fields handed straight to a renderer, an id lookup or the accessibility
 * tree. A non-string here is rendered as a React child or concatenated into a
 * lookup key, which is what made a `textValue` object crash the stage.
 */
const STRING_LAYER_FIELDS = [
  'name', 'type', 'fillColor', 'strokeColor', 'fontFamily', 'imageUrl', 'videoUrl',
  'inAnimPreset', 'outAnimPreset', 'strokeAlignment', 'textValue',
] as const;

/** `{ x, y }` lists the geometry helpers read as coordinates. */
const pointListProblem = (value: unknown, path: string, owner: string, code: string): SceneProblem | undefined => {
  if (!Array.isArray(value)) return sceneProblem(code, path, `${owner} carries a coordinate list that is not a list.`);
  for (const [index, point] of value.entries()) {
    const record = asRecord(point);
    if (!record || !isFiniteNumberValue(record.x) || !isFiniteNumberValue(record.y)) {
      return sceneProblem(code, `${path}[${index}]`, `${owner} has a point without finite x/y coordinates.`);
    }
  }
  return undefined;
};

/**
 * The canonical freeform path. `buildBezierPathD` reads `path.points` directly,
 * and the V6 migration only replaces a path it can normalize — an unusable one
 * stays on the layer and reaches the renderer.
 */
const pathProblem = (value: unknown, path: string, owner: string, code: string): SceneProblem | undefined => {
  const record = asRecord(value);
  if (!record) return sceneProblem(code, path, `${owner} carries a path that is not an object.`);
  const points = pointListProblem(record.points, `${path}.points`, `${owner}'s path`, code);
  if (points) return points;
  if ((record.points as unknown[]).length < 2) {
    return sceneProblem(code, path, `${owner} carries a path with fewer than two points, which cannot be drawn.`);
  }
  return undefined;
};

/** The V6 same-layer masks; the migration dereferences `mask.path` unguarded. */
const masksProblem = (value: unknown, path: string, owner: string): SceneProblem | undefined => {
  if (!Array.isArray(value)) return sceneProblem('KCS_IMPORT_INVALID_LAYER', path, `${owner} carries masks that are not a list.`);
  for (const [index, mask] of value.entries()) {
    const maskPath = `${path}[${index}]`;
    const record = asRecord(mask);
    if (!record) return sceneProblem('KCS_IMPORT_INVALID_LAYER', maskPath, `${owner} has a mask that is not an object.`);
    if (record.path === undefined) {
      return sceneProblem('KCS_IMPORT_INVALID_LAYER', `${maskPath}.path`, `${owner} has a mask without a path, which the mask evaluator reads directly.`);
    }
    const nested = pathProblem(record.path, `${maskPath}.path`, `${owner}'s mask`, 'KCS_IMPORT_INVALID_LAYER');
    if (nested) return nested;
    for (const field of ['opacity', 'feather', 'expansion'] as const) {
      if (record[field] !== undefined && !isFiniteNumberValue(record[field])) {
        return sceneProblem('KCS_IMPORT_INVALID_LAYER', `${maskPath}.${field}`, `${owner} has a mask with a non-numeric ${field}.`);
      }
    }
  }
  return undefined;
};

const layerProblem = (value: unknown, index: number, seenIds: Set<string>): SceneProblem | undefined => {
  const path = `$.layers[${index}]`;
  const record = asRecord(value);
  if (!record) return sceneProblem('KCS_IMPORT_INVALID_LAYER', path, `Layer ${index} is not an object.`);

  const id = record.id;
  if (typeof id !== 'string' || id.length === 0) {
    return sceneProblem('KCS_IMPORT_INVALID_LAYER', `${path}.id`, `Layer ${index} has no usable id, and the editor addresses every layer by id.`);
  }
  if (seenIds.has(id)) {
    return sceneProblem(
      'KCS_IMPORT_DUPLICATE_LAYER_ID',
      `${path}.id`,
      `Two layers share the id "${id}", so only one of them can be selected and animated.`,
      'Give the layers distinct ids in the source document, or re-export the project.',
    );
  }
  seenIds.add(id);

  // The apply path keeps `zIndex` verbatim (it has no default) and the frame
  // pipeline sorts by it, so a missing one leaves the draw order undefined.
  if (!isFiniteNumberValue(record.zIndex)) {
    return sceneProblem('KCS_IMPORT_INVALID_LAYER', `${path}.zIndex`, `Layer "${id}" has no finite z-order, so the draw order cannot be resolved.`);
  }

  for (const field of NUMERIC_LAYER_FIELDS) {
    if (field === 'zIndex') continue;
    const fieldValue = record[field];
    if (fieldValue !== undefined && !isFiniteNumberValue(fieldValue)) {
      return sceneProblem('KCS_IMPORT_INVALID_LAYER', `${path}.${field}`, `Layer "${id}" has a non-numeric ${field}.`);
    }
  }
  for (const field of STRING_LAYER_FIELDS) {
    const fieldValue = record[field];
    if (fieldValue !== undefined && typeof fieldValue !== 'string') {
      return sceneProblem('KCS_IMPORT_INVALID_LAYER', `${path}.${field}`, `Layer "${id}" has a ${field} that is not text, which the renderer cannot draw.`);
    }
  }

  const owner = `Layer "${id}"`;
  if (record.points !== undefined) {
    const points = pointListProblem(record.points, `${path}.points`, owner, 'KCS_IMPORT_INVALID_LAYER');
    if (points) return points;
  }
  if (record.path !== undefined) {
    const pathShape = pathProblem(record.path, `${path}.path`, owner, 'KCS_IMPORT_INVALID_LAYER');
    if (pathShape) return pathShape;
  }
  if (record.masks !== undefined) {
    const masks = masksProblem(record.masks, `${path}.masks`, owner);
    if (masks) return masks;
  }
  for (const field of ['matte', 'trackMatte'] as const) {
    if (record[field] !== undefined && !asRecord(record[field])) {
      return sceneProblem('KCS_IMPORT_INVALID_LAYER', `${path}.${field}`, `${owner} declares a ${field} that is not an object.`);
    }
  }
  if (record.booleanOperandIds !== undefined
    && !(Array.isArray(record.booleanOperandIds) && record.booleanOperandIds.every((entry) => typeof entry === 'string'))) {
    return sceneProblem('KCS_IMPORT_INVALID_LAYER', `${path}.booleanOperandIds`, `${owner} lists boolean operands that are not layer ids.`);
  }
  if (record.booleanContours !== undefined) {
    if (!Array.isArray(record.booleanContours)) {
      return sceneProblem('KCS_IMPORT_INVALID_LAYER', `${path}.booleanContours`, `${owner} carries boolean contours that are not a list.`);
    }
    for (const [contourIndex, contour] of record.booleanContours.entries()) {
      const contourProblem = pointListProblem(contour, `${path}.booleanContours[${contourIndex}]`, owner, 'KCS_IMPORT_INVALID_LAYER');
      if (contourProblem) return contourProblem;
    }
  }
  return undefined;
};

/** Numeric channels (`channels`, `maskChannels`): the evaluator interpolates every value. */
const numericChannelProblem = (value: unknown, path: string, owner: string): SceneProblem | undefined => {
  const record = asRecord(value);
  if (!record) return sceneProblem('KCS_IMPORT_INVALID_TRACK', path, `${owner} carries channels that are not an object.`);
  for (const [channel, keyframes] of Object.entries(record)) {
    const channelPath = `${path}.${channel}`;
    if (!Array.isArray(keyframes)) {
      return sceneProblem('KCS_IMPORT_INVALID_TRACK', channelPath, `${owner}'s "${channel}" channel is not a list of keyframes.`);
    }
    for (const [index, keyframe] of keyframes.entries()) {
      const keyframeRecord = asRecord(keyframe);
      if (!keyframeRecord || !isFiniteNumberValue(keyframeRecord.frame)) {
        return sceneProblem('KCS_IMPORT_INVALID_TRACK', `${channelPath}[${index}]`, `${owner}'s "${channel}" channel has a keyframe without a finite frame.`);
      }
      if (!isFiniteNumberValue(keyframeRecord.value)) {
        return sceneProblem('KCS_IMPORT_INVALID_TRACK', `${channelPath}[${index}].value`, `${owner}'s "${channel}" channel has a keyframe whose value is not a finite number.`);
      }
    }
  }
  return undefined;
};

/** Animated mask geometry: every keyframe carries a canonical path. */
const maskPathChannelProblem = (value: unknown, path: string, owner: string): SceneProblem | undefined => {
  const record = asRecord(value);
  if (!record) return sceneProblem('KCS_IMPORT_INVALID_TRACK', path, `${owner} carries mask paths that are not an object.`);
  for (const [channel, keyframes] of Object.entries(record)) {
    const channelPath = `${path}.${channel}`;
    if (!Array.isArray(keyframes)) {
      return sceneProblem('KCS_IMPORT_INVALID_TRACK', channelPath, `${owner}'s "${channel}" mask path channel is not a list of keyframes.`);
    }
    for (const [index, keyframe] of keyframes.entries()) {
      const keyframeRecord = asRecord(keyframe);
      if (!keyframeRecord || !isFiniteNumberValue(keyframeRecord.frame)) {
        return sceneProblem('KCS_IMPORT_INVALID_TRACK', `${channelPath}[${index}]`, `${owner}'s "${channel}" mask path channel has a keyframe without a finite frame.`);
      }
      const valuePath = pathProblem(keyframeRecord.value, `${channelPath}[${index}].value`, owner, 'KCS_IMPORT_INVALID_TRACK');
      if (valuePath) return valuePath;
    }
  }
  return undefined;
};

/** Legacy composite keyframes, kept for backward compatibility. */
const legacyKeyframeProblem = (value: unknown, path: string, owner: string): SceneProblem | undefined => {
  if (!Array.isArray(value)) return sceneProblem('KCS_IMPORT_INVALID_TRACK', path, `${owner} carries keyframes that are not a list.`);
  for (const [index, keyframe] of value.entries()) {
    const keyframePath = `${path}[${index}]`;
    const record = asRecord(keyframe);
    if (!record || !isFiniteNumberValue(record.frame)) {
      return sceneProblem('KCS_IMPORT_INVALID_TRACK', keyframePath, `${owner} has a keyframe without a finite frame.`);
    }
    const transform = asRecord(record.transform);
    if (!transform) return sceneProblem('KCS_IMPORT_INVALID_TRACK', `${keyframePath}.transform`, `${owner} has a keyframe without a transform.`);
    for (const [field, fieldValue] of Object.entries(transform)) {
      if (fieldValue !== undefined && !isFiniteNumberValue(fieldValue)) {
        return sceneProblem('KCS_IMPORT_INVALID_TRACK', `${keyframePath}.transform.${field}`, `${owner} has a keyframe transform with a non-numeric ${field}.`);
      }
    }
  }
  return undefined;
};

const trackProblem = (value: unknown, index: number): SceneProblem | undefined => {
  const path = `$.tracks[${index}]`;
  const record = asRecord(value);
  if (!record) return sceneProblem('KCS_IMPORT_INVALID_TRACK', path, `Track ${index} is not an object.`);

  // P4-S3: `partId` is canonical, but v1 files wrote `layerId` and the apply
  // path still reads both — either name identifies the layer.
  const partId = record.partId ?? record.layerId;
  if (typeof partId !== 'string' || partId.length === 0) {
    return sceneProblem('KCS_IMPORT_INVALID_TRACK', `${path}.partId`, `Track ${index} names no layer, so its animation cannot be attached.`);
  }
  const owner = `Track ${index} (layer "${partId}")`;

  if (record.channels !== undefined) {
    const channels = numericChannelProblem(record.channels, `${path}.channels`, owner);
    if (channels) return channels;
  }
  if (record.maskChannels !== undefined) {
    const maskChannels = numericChannelProblem(record.maskChannels, `${path}.maskChannels`, owner);
    if (maskChannels) return maskChannels;
  }
  if (record.maskPathChannels !== undefined) {
    const maskPathChannels = maskPathChannelProblem(record.maskPathChannels, `${path}.maskPathChannels`, owner);
    if (maskPathChannels) return maskPathChannels;
  }
  if (record.keyframes !== undefined) {
    const keyframes = legacyKeyframeProblem(record.keyframes, `${path}.keyframes`, owner);
    if (keyframes) return keyframes;
  }
  if (record.sequencerTemplateId !== undefined && typeof record.sequencerTemplateId !== 'string') {
    return sceneProblem('KCS_IMPORT_INVALID_TRACK', `${path}.sequencerTemplateId`, `${owner} names a sequence that is not text.`);
  }
  return undefined;
};

/**
 * The semantic pass over a scene document: the version policy, the document
 * numbers the timeline and the canvas are built from, then every layer and track
 * value the renderers and the evaluator read.
 */
const sceneSemanticProblem = (scene: SceneData): SceneProblem | undefined => {
  const record = scene as unknown as Record<string, unknown>;

  if (!SUPPORTED_SCENE_VERSIONS.includes(record.version as number)) {
    return sceneProblem(
      'KCS_IMPORT_UNSUPPORTED_VERSION',
      '$.version',
      `The file declares scene version ${String(record.version)}, which this build does not know how to apply.`,
      'Open the file in the Keyframe Studio version that wrote it, or export it again from a supported one.',
    );
  }

  // Playback timing. `fps` divides the animation duration and `totalFrames`
  // bounds the timeline, so both must be usable numbers; absence keeps the
  // current values, which is the documented behaviour for a v1 file.
  if (record.fps !== undefined && !(isFiniteNumberValue(record.fps) && record.fps > 0)) {
    return sceneProblem('KCS_IMPORT_INVALID_TIMELINE', '$.fps', 'The file declares a frame rate that is not a positive number, so playback has no usable duration.');
  }
  if (record.totalFrames !== undefined && !(isFiniteNumberValue(record.totalFrames) && record.totalFrames >= 1)) {
    return sceneProblem('KCS_IMPORT_INVALID_TIMELINE', '$.totalFrames', 'The file declares a timeline length that is not a positive number.');
  }

  // Canvas size. Absent means the documented 1920×1080 default; a present value
  // must be usable, because the SVG viewBox and the stage zoom are built from it.
  for (const field of ['width', 'height'] as const) {
    if (record[field] !== undefined && !(isFiniteNumberValue(record[field]) && record[field] > 0)) {
      return sceneProblem('KCS_IMPORT_INVALID_CANVAS', `$.${field}`, `The file declares a canvas ${field} that is not a positive number.`);
    }
  }

  const seenIds = new Set<string>();
  for (const [index, layer] of scene.layers.entries()) {
    const problem = layerProblem(layer, index, seenIds);
    if (problem) return problem;
  }
  for (const [index, track] of scene.tracks.entries()) {
    const problem = trackProblem(track, index);
    if (problem) return problem;
  }

  // `normalizeMotionTemplates` dereferences every entry while it derives the
  // missing ids and names, so a non-object entry cannot be applied.
  for (const [index, template] of (scene.motionTemplates ?? []).entries()) {
    if (!asRecord(template)) {
      return sceneProblem('KCS_IMPORT_INVALID_TEMPLATE', `$.motionTemplates[${index}]`, `Sequence ${index} is not an object.`);
    }
  }
  return undefined;
};

/** True for the legacy project shape (a `tracks` and a `characterParts` array). */
const isLegacyProject = (value: unknown): value is LegacyProjectDocument => {
  const record = asRecord(value);
  if (!record) return false;
  return Array.isArray(record.tracks) && Array.isArray(record.characterParts);
};

const declaredLayerCount = (document: ImportedDocument): number =>
  document.kind === 'scene'
    ? document.scene.layers.length + document.scene.tracks.length
    : document.project.characterParts.length + document.project.tracks.length;

/**
 * Validates raw imported text.
 *
 * The checks run cheapest-first — size, JSON syntax, prototype keys, shape,
 * then the declared counts — so a hostile document is refused before any
 * allocation-heavy work happens.
 */
export const validateImportedDocument = (text: string): ImportValidationResult => {
  if (text.length > MAX_IMPORT_CHARACTERS) {
    return refuse(
      'KCS_IMPORT_TOO_LARGE',
      '$',
      `The selected file is larger than the ${Math.round(MAX_IMPORT_CHARACTERS / (1024 * 1024))} MB import limit.`,
      'Export the project again, or split it into smaller templates before importing.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return refuse(
      'KCS_IMPORT_MALFORMED_JSON',
      '$',
      'The selected file is not valid JSON.',
      'Re-export the project from Keyframe Studio and import the new file.',
    );
  }

  const unsafeKey = findPrototypeSensitiveKey(parsed);
  if (unsafeKey) {
    if (unsafeKey.key === '') {
      return refuse(
        'KCS_IMPORT_TOO_DEEP',
        unsafeKey.path,
        `The document nests deeper than the ${MAX_IMPORT_DEPTH}-level import limit, so part of it cannot be checked.`,
        'Re-export the project from Keyframe Studio; a project document does not need that much nesting.',
      );
    }
    return refuse(
      'KCS_IMPORT_UNSAFE_KEY',
      unsafeKey.path,
      `The document contains the reserved key "${unsafeKey.key}", which could alter object behaviour if it were merged.`,
      'Remove the reserved key from the file and import it again.',
    );
  }

  let document: ImportedDocument;
  if (isSceneDocument(parsed)) {
    const fieldProblem = sceneFieldProblem(parsed);
    if (fieldProblem) return refuse('KCS_IMPORT_INVALID_SCENE_FIELD', fieldProblem.path, fieldProblem.message, fieldProblem.action);
    const semanticProblem = sceneSemanticProblem(parsed);
    if (semanticProblem) return refuse(semanticProblem.code, semanticProblem.path, semanticProblem.message, semanticProblem.action);
    document = { kind: 'scene', scene: parsed };
  }
  else if (isLegacyProject(parsed)) document = { kind: 'legacy-project', project: parsed };
  else {
    return refuse(
      'KCS_IMPORT_UNKNOWN_SHAPE',
      '$',
      'The file is neither a current KCS scene nor a legacy project document.',
      'Import a .kcs project file exported by Keyframe Studio.',
    );
  }

  const declaredLayers = declaredLayerCount(document);
  if (declaredLayers > MAX_IMPORT_LAYERS) {
    return refuse(
      'KCS_IMPORT_TOO_MANY_LAYERS',
      '$',
      `The document declares ${declaredLayers} layers/tracks, above the ${MAX_IMPORT_LAYERS} import limit.`,
      'Split the project into smaller templates before importing it.',
    );
  }

  // The legacy shape is accepted, but importing it runs a migration: say so
  // instead of letting the user discover it after their work is replaced.
  const diagnostics: ImportDiagnostic[] =
    document.kind === 'legacy-project'
      ? [
        {
          code: 'KCS_IMPORT_LEGACY_MIGRATED',
          severity: 'warning',
          feature: 'project-import',
          path: '$',
          message: 'This is a legacy project document; it is migrated to the current scene format on import.',
          action: 'Review the imported template and export it again to store the current format.',
        },
      ]
      : [];

  return { ok: true, document, diagnostics };
};
