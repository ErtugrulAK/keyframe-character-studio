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

const OGRAF_SCHEMA_MARKER = '/ograf/';

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

/**
 * True when the text is a Lottie (bodymovin) document: it carries the document
 * version string and a layer list, and one of the timing fields the importer
 * requires. A KCS scene has `version`/`tracks` instead, so the two never collide.
 */
const isLottieDocument = (text: string): boolean => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  const record = asRecord(parsed);
  if (!record) return false;
  if (typeof record.$schema === 'string' && record.$schema.includes(OGRAF_SCHEMA_MARKER)) return false;
  return typeof record.v === 'string' && Array.isArray(record.layers) && (typeof record.fr === 'number' || typeof record.op === 'number');
};

/** True for an OGraf graphic manifest, which the project importer does not accept. */
const isOGrafManifest = (text: string): boolean => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  const schema = asRecord(parsed)?.$schema;
  return typeof schema === 'string' && schema.includes(OGRAF_SCHEMA_MARKER);
};

/**
 * Classifies a selected file for the unified import entry.
 *
 * `fileName` is used only for the package form, which is a binary archive that is
 * never read as text; every other decision comes from `text`.
 */
export const classifyImport = (fileName: string, text: string): ImportKind => {
  if (/\.(?:zip|ograf)$/iu.test(fileName)) return 'ograf-package';
  // The OGraf manifest keeps its file-name route as well: an OGraf `$schema` does
  // not always carry the `/ograf/` marker, and the existing behaviour rejected the
  // `.ograf.json` name before it looked at the content.
  if (/\.ograf\.json$/iu.test(fileName)) return 'ograf-manifest';
  if (isOGrafManifest(text)) return 'ograf-manifest';

  const validation = validateImportedDocument(text);
  if (validation.ok) return validation.document.kind === 'scene' ? 'kcs-scene' : 'legacy-project';

  // Not a KCS document: the only other JSON kind this entry accepts is Lottie.
  // The size guard keeps a hostile file from being parsed here as well.
  if (text.length <= MAX_IMPORT_CHARACTERS && isLottieDocument(text)) return 'lottie';
  return 'unknown';
};
