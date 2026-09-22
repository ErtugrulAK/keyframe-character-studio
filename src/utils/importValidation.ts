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

/** Walks the document and reports the first prototype-sensitive key. */
const findPrototypeSensitiveKey = (value: unknown): { key: string; path: string } | undefined => {
  const stack: { node: unknown; path: string; depth: number }[] = [{ node: value, path: '$', depth: 0 }];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || current.depth > MAX_IMPORT_DEPTH) continue;

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
    return refuse(
      'KCS_IMPORT_UNSAFE_KEY',
      unsafeKey.path,
      `The document contains the reserved key "${unsafeKey.key}", which could alter object behaviour if it were merged.`,
      'Remove the reserved key from the file and import it again.',
    );
  }

  let document: ImportedDocument;
  if (isSceneDocument(parsed)) {
    const problem = sceneFieldProblem(parsed);
    if (problem) return refuse('KCS_IMPORT_INVALID_SCENE_FIELD', problem.path, problem.message, problem.action);
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
