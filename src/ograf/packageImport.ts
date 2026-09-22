import { unzipSync } from 'fflate';
import { MAX_IMPORT_CHARACTERS, type ImportDiagnostic } from '../utils/importValidation';
import { hasCaseInsensitiveCollision, isPrototypeSensitiveKey, isReservedWindowsName, isSafePackageRelativePath, normalizePackagePath } from '../utils/pathSafety';

/**
 * Reads an OGraf package back into the editable scene it was exported from.
 *
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

  let files: Record<string, Uint8Array>;
  let oversizedEntry: string | undefined;
  try {
    // The filter runs on the central directory, so an oversized member is never
    // decompressed; dropping one is recorded rather than silently ignored.
    files = unzipSync(bytes, {
      filter: (file) => {
        if (file.originalSize <= OGRAF_PACKAGE_LIMITS.entryBytes) return true;
        oversizedEntry = file.name;
        return false;
      },
    });
  } catch {
    return { ok: false, diagnostics: [refusal('OGRAF_PACKAGE_UNREADABLE', '$', 'The selected file is not a readable OGraf package.', 'Export the graphic again and import the new package.')] };
  }

  if (oversizedEntry) {
    return { ok: false, diagnostics: [refusal('OGRAF_PACKAGE_ENTRY_TOO_LARGE', oversizedEntry, 'The package carries a file larger than the import limit.', 'Import a package without that file. ')] };
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
