import { zipSync } from 'fflate';
import { isSafeOGrafPackagePath, sanitizeOGrafId } from './compiler';
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
    throw new Error('OGraf package validation failed.');
  }

  const files: Record<string, Uint8Array> = {};
  for (const file of plan.files) {
    if (!isSafeOGrafPackagePath(file.path) || files[file.path]) {
      throw new Error(`Unsafe or duplicate package path: ${file.path}`);
    }
    if (file.kind === 'asset') {
      if (!file.binaryContent) throw new Error(`Asset "${file.path}" is not available in the browser package plan.`);
      files[file.path] = file.binaryContent;
    } else if (file.content !== undefined) {
      files[file.path] = textBytes(file.content);
    } else {
      throw new Error(`Package file "${file.path}" has no generated content.`);
    }
  }

  return {
    fileName: `${sanitizeOGrafDownloadName(plan.manifest.name)}-ograf.zip`,
    bytes: zipSync(files),
  };
}
