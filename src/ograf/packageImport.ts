import { unzipSync } from 'fflate';
import { MAX_IMPORT_CHARACTERS, type ImportDiagnostic } from '../utils/importValidation';
import { hasCaseInsensitiveCollision, isPrototypeSensitiveKey, isReservedWindowsName, isSafePackageRelativePath, normalizePackagePath } from '../utils/pathSafety';

/**
 * Reads an OGraf package back into the editable scene it was exported from.
 *
 * Preflight (`admitEntry`) runs on each central-directory entry immediately
 * before that entry is inflated: its name is validated and its declared size
 * counted, so no name can hide behind the result object and the cumulative
 * declared output is bounded before it is materialised. The post-unzip checks
 * below only confirm what the preflight already admitted.

 * A package is a zip the exporter wrote; it always carries `scene.kcs`, the
 * canonical KCS scene. Importing therefore needs no reconstruction — it needs a
 * **guarded** decode: the archive is untrusted input, so entry count, entry size
 * and total size are bounded, every path is normalised and checked against the
 * package-path authority, duplicate (case-insensitive) and reserved names are
 * refused, and the manifest is walked for prototype-sensitive keys.
 *
 * Nothing here repairs an archive: a package that fails a check is reported with
 * a stable code and the import stops, exactly like the project boundary.
 */

/** Bounds for an imported package; reported, never silently truncated. */
export const OGRAF_PACKAGE_LIMITS = {
  /** Refuse an archive larger than this before decompressing anything. */
  bytes: 64 * 1024 * 1024,
  /** Refuse an archive with more entries than this. */
  entries: 512,
  /** Refuse a single entry larger than the scene import limit. */
  entryBytes: MAX_IMPORT_CHARACTERS,
  /** Refuse an archive whose declared contents add up to more than this. */
  totalBytes: 64 * 1024 * 1024,
} as const;

export interface OGrafPackageReadResult {
  ok: boolean;
  /** The `scene.kcs` text of the package, when it could be read. */
  sceneText?: string;
  /** The manifest's human name, when the package carries a readable one. */
  name?: string;
  diagnostics: ImportDiagnostic[];
}

const warning = (code: string, path: string, message: string, action: string): ImportDiagnostic => ({
  code,
  severity: 'warning',
  feature: 'ograf-import',
  path,
  message,
  action,
});

const refusal = (code: string, path: string, message: string, action: string): ImportDiagnostic => ({
  code,
  severity: 'error',
  feature: 'ograf-import',
  path,
  message,
  action,
});

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

/** Walks a decoded manifest and reports the first prototype-sensitive key. */
const findPrototypeSensitiveKey = (value: unknown): string | undefined => {
  const stack: { node: unknown; depth: number }[] = [{ node: value, depth: 0 }];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || current.depth > 64) continue;
    if (Array.isArray(current.node)) {
      for (const entry of current.node) stack.push({ node: entry, depth: current.depth + 1 });
      continue;
    }
    const record = asRecord(current.node);
    if (!record) continue;
    for (const [key, entry] of Object.entries(record)) {
      if (isPrototypeSensitiveKey(key)) return key;
      stack.push({ node: entry, depth: current.depth + 1 });
    }
  }
  return undefined;
};

/** True when the manifest nests deeper than the walk can safely check. */
const exceedsDepth = (value: unknown, limit = 64): boolean => {
  const stack: { node: unknown; depth: number }[] = [{ node: value, depth: 0 }];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (current.depth > limit) return true;
    if (Array.isArray(current.node)) {
      for (const entry of current.node) stack.push({ node: entry, depth: current.depth + 1 });
      continue;
    }
    const record = asRecord(current.node);
    if (!record) continue;
    for (const entry of Object.values(record)) stack.push({ node: entry, depth: current.depth + 1 });
  }
  return false;
};

/** Why a preflight stopped the archive before its contents were read. */
interface PreflightProblem {
  code: string;
  path: string;
  message: string;
  action: string;
}

/**
 * entry: its name is normalised and checked against the same authorities the
 * entry: its name is normalised and checked against the same authorities the
 * rest of the app uses, and its size counts against the total budget. Returning
 * `false` keeps the entry out, and `unzipSync` never inflates it.
 */
const admitEntry = (
  file: { name: string; originalSize: number },
  state: { count: number; total: number; names: Set<string>; problem?: PreflightProblem },
): boolean => {
  state.count += 1;
  if (state.count > OGRAF_PACKAGE_LIMITS.entries) {
    state.problem ??= { code: 'OGRAF_PACKAGE_TOO_MANY_ENTRIES', path: file.name, message: `The package carries more than the ${OGRAF_PACKAGE_LIMITS.entries}-file import limit.`, action: 'Import a package the exporter produced without extra files.' };
    return false;
  }
  state.total += file.originalSize;
  if (file.originalSize > OGRAF_PACKAGE_LIMITS.entryBytes) {
    state.problem ??= { code: 'OGRAF_PACKAGE_ENTRY_TOO_LARGE', path: file.name, message: 'The package carries a file larger than the import limit.', action: 'Import a package without that file.' };
    return false;
  }
  if (state.total > OGRAF_PACKAGE_LIMITS.totalBytes) {
    state.problem ??= { code: 'OGRAF_PACKAGE_TOO_LARGE', path: file.name, message: `The package contents exceed the ${Math.round(OGRAF_PACKAGE_LIMITS.totalBytes / (1024 * 1024))} MB import limit.`, action: 'Import a smaller package.' };
    return false;
  }
  const normalized = normalizePackagePath(file.name);
  const segments = normalized.split('/');
  if (!normalized || !isSafePackageRelativePath(normalized) || segments.some((segment) => isPrototypeSensitiveKey(segment))) {
    state.problem ??= { code: 'OGRAF_PACKAGE_UNSAFE_PATH', path: file.name, message: 'The package contains a file path that is not safe to import.', action: 'Export the graphic again; a package must only contain its own relative files.' };
    return false;
  }
  if (isReservedWindowsName(segments[segments.length - 1] ?? '')) {
    state.problem ??= { code: 'OGRAF_PACKAGE_UNSAFE_PATH', path: file.name, message: 'The package contains a file name that is reserved on Windows.', action: 'Re-export the graphic with a portable file name.' };
    return false;
  }
  const collisionKey = normalized.toLowerCase();
  if (state.names.has(collisionKey)) {
    state.problem ??= { code: 'OGRAF_PACKAGE_DUPLICATE_PATH', path: file.name, message: 'The package contains two entries with the same path.', action: 'Re-export the graphic without duplicate paths.' };
    return false;
  }
  state.names.add(collisionKey);
  return true;
};

/**
 * Reads an OGraf package (zip bytes) into its scene text.
 *
 * Fails closed: the first problem refuses the whole import with one diagnostic.
 */
export const readOGrafPackage = (bytes: Uint8Array): OGrafPackageReadResult => {
  if (bytes.length === 0) {
    return { ok: false, diagnostics: [refusal('OGRAF_PACKAGE_UNREADABLE', '$', 'The selected file is empty.', 'Select the OGraf package (.zip/.ograf) that was exported.')] };
  }
  if (bytes.length > OGRAF_PACKAGE_LIMITS.bytes) {
    return { ok: false, diagnostics: [refusal('OGRAF_PACKAGE_TOO_LARGE', '$', `The package is larger than the ${Math.round(OGRAF_PACKAGE_LIMITS.bytes / (1024 * 1024))} MB import limit.`, 'Import a smaller package.')] };
  }

  // every size counted before a single entry is inflated or stored.
  // every size counted before a single entry is inflated or stored.
  const preflight = { count: 0, total: 0, names: new Set<string>(), problem: undefined as PreflightProblem | undefined };
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (file) => admitEntry(file, preflight) });
  } catch {
    return { ok: false, diagnostics: [refusal('OGRAF_PACKAGE_UNREADABLE', '$', 'The selected file is not a readable OGraf package.', 'Export the graphic again and import the new package.')] };
  }

  if (preflight.problem) {
    const problem = preflight.problem;
    return { ok: false, diagnostics: [refusal(problem.code, problem.path, problem.message, problem.action)] };
  }

  const names = Object.keys(files);
  if (names.length === 0) {
    return { ok: false, diagnostics: [refusal('OGRAF_PACKAGE_UNREADABLE', '$', 'The package carries no files.', 'Export the graphic again and import the new package.')] };
  }
  if (names.length > OGRAF_PACKAGE_LIMITS.entries) {
    return { ok: false, diagnostics: [refusal('OGRAF_PACKAGE_TOO_MANY_ENTRIES', '$', `The package carries ${names.length} files, above the ${OGRAF_PACKAGE_LIMITS.entries}-file import limit.`, 'Import a package the exporter produced without extra files.')] };
  }

  const normalized = names.map((name) => normalizePackagePath(name));
  for (const [index, path] of normalized.entries()) {
    if (!path || !isSafePackageRelativePath(path)) {
      return { ok: false, diagnostics: [refusal('OGRAF_PACKAGE_UNSAFE_PATH', names[index] ?? '$', 'The package contains a file path that is not safe to import.', 'Export the graphic again; a package must only contain its own relative files.')] };
    }
    if (isReservedWindowsName(path.split('/').pop() ?? '')) {
      return { ok: false, diagnostics: [refusal('OGRAF_PACKAGE_UNSAFE_PATH', names[index] ?? '$', 'The package contains a file name that is reserved on Windows.', 'Re-export the graphic with a portable file name.')] };
    }
  }
  if (hasCaseInsensitiveCollision(normalized)) {
    return { ok: false, diagnostics: [refusal('OGRAF_PACKAGE_DUPLICATE_PATH', '$', 'The package contains two file paths that differ only by case.', 'Re-export the graphic without duplicate paths.')] };
  }

  const sceneName = names.find((name) => normalizePackagePath(name) === 'scene.kcs');
  if (!sceneName) {
    return { ok: false, diagnostics: [refusal('OGRAF_PACKAGE_MISSING_SCENE', '$', 'The package carries no `scene.kcs`, so it holds no editable scene.', 'Import a package that Keyframe Studio exported.')] };
  }

  const scene = files[sceneName];
  if (!scene || scene.length === 0) {
    return { ok: false, diagnostics: [refusal('OGRAF_PACKAGE_MISSING_SCENE', 'scene.kcs', 'The scene inside the package is empty.', 'Export the graphic again and import the new package.')] };
  }
  if (scene.length > MAX_IMPORT_CHARACTERS) {
    return { ok: false, diagnostics: [refusal('OGRAF_PACKAGE_TOO_LARGE', 'scene.kcs', 'The scene inside the package is larger than the import limit.', 'Import a smaller graphic.')] };
  }

  const sceneText = new TextDecoder().decode(scene);
  const diagnostics: ImportDiagnostic[] = [];
  const manifestName = names.find((name) => /\.ograf\.json$/iu.test(normalizePackagePath(name)));
  let name: string | undefined;
  if (manifestName) {
    try {
      const manifest = JSON.parse(new TextDecoder().decode(files[manifestName])) as unknown;
      const manifestRecord = asRecord(manifest);
      if (exceedsDepth(manifest)) {
        return { ok: false, diagnostics: [refusal('OGRAF_PACKAGE_MANIFEST_TOO_DEEP', manifestName, 'The package manifest nests deeper than the import can check.', 'Export the graphic again with a flatter manifest.')] };
      }
      const unsafeKey = findPrototypeSensitiveKey(manifest);
      if (unsafeKey) {
        return { ok: false, diagnostics: [refusal('OGRAF_PACKAGE_UNSAFE_KEY', manifestName, `The package manifest contains the reserved key "${unsafeKey}".`, 'Export the graphic again; the manifest must not carry reserved keys.')] };
      }
      if (typeof manifestRecord?.name === 'string') name = manifestRecord.name;
    } catch {
      diagnostics.push(warning('OGRAF_PACKAGE_UNREADABLE_MANIFEST', manifestName, 'The package manifest is not readable JSON; the scene is imported without its name.', 'Re-export the graphic if you need the manifest.'));
    }
  }

  diagnostics.push(warning('OGRAF_PACKAGE_ASSETS_OMITTED', '$', 'The package may carry assets beside the scene; only the scene is imported.', 'Re-link the graphic\'s images and fonts after import if it used any.'));
  return { ok: true, sceneText, ...(name ? { name } : {}), diagnostics };
};
