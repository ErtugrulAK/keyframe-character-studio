import { zipSync } from 'fflate';
import { normalizePackagePath } from '../utils/persistence/pathSafety';
import { isSafeOGrafPackagePath, sanitizeOGrafId } from './compiler';
import { OGrafPackageWriteError, describeOGrafValueForDiagnostics } from './diagnostics';
import type { OGrafGeneratedPackage } from './types';

interface OGrafBrowserZip {
  fileName: string;
  bytes: Uint8Array;
}

export function sanitizeOGrafDownloadName(name: string | undefined): string {
  return sanitizeOGrafId(name || 'graphic');
}

/** The manifest text with the thumbnail listed (spec: `thumbnails[].file` and its pixel `resolution`). */
function withThumbnail(manifestText: string, thumbnail: { width: number; height: number }): string {
  const manifest = JSON.parse(manifestText) as Record<string, unknown>;
  manifest.thumbnails = [{ file: OGRAF_THUMBNAIL_PATH, resolution: { width: thumbnail.width, height: thumbnail.height } }];
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/** Where the package keeps its thumbnail; assets live under `assets/`, so it cannot collide. */
export const OGRAF_THUMBNAIL_PATH = 'thumbnail.png';

interface OGrafBrowserZipOptions {
  /** A rendered preview; the manifest then lists it under `thumbnails`. */
  thumbnail?: { bytes: Uint8Array; width: number; height: number };
}

export async function createOGrafBrowserZip(plan: OGrafGeneratedPackage, options: OGrafBrowserZipOptions = {}): Promise<OGrafBrowserZip> {
  await Promise.resolve();
  if (plan.status === 'blocked') {
    throw new OGrafPackageWriteError('OGRAF_BLOCKED_PACKAGE', 'OGraf package validation failed.');
  }

  const files: Record<string, Uint8Array> = {};
  const seenPaths = new Set<string>();
  for (const file of plan.files) {
    const normalizedPath = normalizePackagePath(file.path);
    const collisionKey = normalizedPath.toLowerCase();
    if (!isSafeOGrafPackagePath(normalizedPath) || seenPaths.has(collisionKey)) {
      throw new OGrafPackageWriteError('OGRAF_UNSAFE_PACKAGE_PATH', `Unsafe or duplicate package path: ${describeOGrafValueForDiagnostics(file.path)}`);
    }
    seenPaths.add(collisionKey);
    if (file.kind === 'asset') {
      if (!file.binaryContent) {
        throw new OGrafPackageWriteError('OGRAF_MISSING_PACKAGE_SOURCE', `Asset "${describeOGrafValueForDiagnostics(file.path)}" is not available in the browser package plan.`);
      }
      files[normalizedPath] = file.binaryContent;
    } else if (file.content !== undefined) {
      files[normalizedPath] = textBytes(file.kind === 'manifest' && options.thumbnail ? withThumbnail(file.content, options.thumbnail) : file.content);
    } else {
      throw new OGrafPackageWriteError('OGRAF_MISSING_PACKAGE_SOURCE', `Package file "${describeOGrafValueForDiagnostics(file.path)}" has no generated content.`);
    }
  }

  if (options.thumbnail) {
    if (seenPaths.has(OGRAF_THUMBNAIL_PATH)) {
      throw new OGrafPackageWriteError('OGRAF_UNSAFE_PACKAGE_PATH', `Duplicate package path: ${OGRAF_THUMBNAIL_PATH}`);
    }
    files[OGRAF_THUMBNAIL_PATH] = options.thumbnail.bytes;
  }

  // `<name>.ograf.zip`: Windows "Extract All" makes a `<name>.ograf` folder,
  // the folder name Reality Hub looks for (one ending in `-ograf` was not listed).
  return {
    fileName: `${sanitizeOGrafDownloadName(plan.manifest.name)}.ograf.zip`,
    bytes: zipSync(files),
  };
}
