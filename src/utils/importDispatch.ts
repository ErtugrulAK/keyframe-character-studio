import { OGRAF_GRAPHICS_SCHEMA_URL } from '../ograf/types';
import { MAX_IMPORT_CHARACTERS, validateImportedDocument } from './importValidation';

/**
 * Which importer a dropped/selected file belongs to.
 *
 * The user has one import control, so something has to decide what the file is.
 * The decision is made from the **content**, never from the extension alone: a
 * document renamed `.kcs` still imports as what it actually is, and a file that
 * merely claims a kind it is not is routed by what it holds.
 *
 * The KCS scene / legacy project decision is not re-derived here — it comes from
 * the existing import boundary (`validateImportedDocument`), which is the single
 * authority for those two shapes. This module only adds the kinds that boundary
 * deliberately refuses: OGraf manifests/packages (routed to their existing
 * messages) and Lottie documents (routed to the Lottie importer).
 */
export type ImportKind =
  | 'ograf-package'
  | 'ograf-manifest'
  | 'lottie'
  | 'kcs-scene'
  | 'legacy-project'
  | 'unknown';

/** The canonical OGraf graphics schema, the authority the exporter writes. */
const OGRAF_SCHEMA_MARKER = '/ograf/';

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

/**
 * True when the text is an OGraf graphic manifest: it names the canonical schema
 * the exporter writes, or a schema path that marks itself as OGraf.
 */
/** Parses the document once, or `undefined` when it is not JSON at all. */
const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** True when the parsed document names the canonical OGraf schema, or a marker inside it. */
const isOGrafManifest = (parsed: unknown): boolean => {
  const schema = asRecord(parsed)?.$schema;
  if (typeof schema !== 'string') return false;
  return schema === OGRAF_GRAPHICS_SCHEMA_URL || schema.includes(OGRAF_SCHEMA_MARKER);
};

/**
 * True when the parsed document is a Lottie (bodymovin) document: it carries the
 * version string and a layer list, and one of the timing fields the importer
 * requires. A KCS scene has `version`/`tracks` instead, so the two never collide.
 */
const isLottieDocument = (parsed: unknown): boolean => {
  const record = asRecord(parsed);
  if (!record) return false;
  return typeof record.v === 'string' && Array.isArray(record.layers) && (typeof record.fr === 'number' || typeof record.op === 'number');
};

/**
 * Classifies a selected file for the unified import entry.
 *
 * `fileName` is used only for the package form, which is a binary archive that is
 * never read as text, and for the `.ograf.json` name the previous import path
 * recognised before it looked at the content.
 *
 * The boundary's size limit is applied **before** any parse here, so an oversized
 * document is never parsed by this module at all — the boundary itself refuses it
 * with its own `KCS_IMPORT_TOO_LARGE` diagnostic.
 */
export const classifyImport = (fileName: string, text: string): ImportKind => {
  if (/\.(?:zip|ograf)$/iu.test(fileName)) return 'ograf-package';
  // The name hints cost nothing and are checked before the size guard so an
  // oversized `.ograf.json` still keeps its own refusal message.
  if (/\.ograf\.json$/iu.test(fileName)) return 'ograf-manifest';
  // The boundary's size limit is applied before any parse, so an oversized
  // document is never parsed here — the boundary refuses it itself.
  if (text.length > MAX_IMPORT_CHARACTERS) return 'unknown';

  const parsed = parseJson(text);
  // An OGraf marker wins over the KCS shape: the exporter's own schema is the
  // stronger signal, and an OGraf document must never reach the project authority.
  if (parsed !== undefined && isOGrafManifest(parsed)) return 'ograf-manifest';

  const validation = validateImportedDocument(text);
  if (validation.ok) return validation.document.kind === 'scene' ? 'kcs-scene' : 'legacy-project';

  // Not a KCS document: the only other JSON kind this entry accepts is Lottie.
  return parsed !== undefined && isLottieDocument(parsed) ? 'lottie' : 'unknown';
};
