import { zipSync } from 'fflate';
import { normalizePackagePath } from '../utils/pathSafety';
import { isSafeOGrafPackagePath, sanitizeOGrafId } from './compiler';
import { OGrafPackageWriteError } from './diagnostics';
import type { OGrafGeneratedPackage } from './types';

export interface OGrafBrowserZip {
  fileName: string;
  bytes: Uint8Array;
}

export function sanitizeOGrafDownloadName(name: string | undefined): string {
  return sanitizeOGrafId(name || 'graphic');
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export async function createOGrafBrowserZip(plan: OGrafGeneratedPackage): Promise<OGrafBrowserZip> {
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
      throw new OGrafPackageWriteError('OGRAF_UNSAFE_PACKAGE_PATH', `Unsafe or duplicate package path: ${file.path}`);
    }
    seenPaths.add(collisionKey);
    if (file.kind === 'asset') {
      if (!file.binaryContent) {
        throw new OGrafPackageWriteError('OGRAF_MISSING_PACKAGE_SOURCE', `Asset "${file.path}" is not available in the browser package plan.`);
      }
      files[normalizedPath] = file.binaryContent;
    } else if (file.content !== undefined) {
      files[normalizedPath] = textBytes(file.content);
    } else {
      throw new OGrafPackageWriteError('OGRAF_MISSING_PACKAGE_SOURCE', `Package file "${file.path}" has no generated content.`);
    }
  }

  return {
    fileName: `${sanitizeOGrafDownloadName(plan.manifest.name)}-ograf.zip`,
    bytes: zipSync(files),
  };
}
