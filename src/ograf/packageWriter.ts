/// <reference types="node" />
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { normalizePackagePath } from '../utils/pathSafety';
import { isSafeOGrafPackagePath } from './compiler';
import type { OGrafGeneratedPackage, OGrafMaterializedPackage, OGrafPackageFile } from './types';

function assertSafePackagePath(root: string, relativePath: string): string {
  const normalized = normalizePackagePath(relativePath);
  if (!isSafeOGrafPackagePath(normalized)) throw new Error(`Unsafe package path: ${relativePath}`);
  const rootPath = resolve(root);
  const target = resolve(rootPath, normalized);
  const targetRelative = target === rootPath ? '' : target.slice(rootPath.length + 1);
  if (!targetRelative || targetRelative.startsWith('..')) throw new Error(`Package path escapes output directory: ${relativePath}`);
  return target;
}

export async function materializeOGrafPackage(plan: OGrafGeneratedPackage, outputDirectory: string): Promise<OGrafMaterializedPackage> {
  if (plan.status === 'blocked') {
    return { status: 'blocked', isComplete: false, outputDirectory, manifest: plan.manifest, files: [], diagnostics: plan.diagnostics };
  }
  await mkdir(outputDirectory, { recursive: true });
  const materializedFiles: OGrafPackageFile[] = [];
  const seenPaths = new Set<string>();
  for (const file of plan.files) {
    const normalizedPath = normalizePackagePath(file.path);
    const collisionKey = normalizedPath.toLowerCase();
    if (seenPaths.has(collisionKey)) throw new Error(`Duplicate package path: ${file.path}`);
    seenPaths.add(collisionKey);
    const target = assertSafePackagePath(outputDirectory, normalizedPath);
    await mkdir(dirname(target), { recursive: true });
    if (file.kind === 'asset') {
      const asset = plan.assets.find((candidate) => normalizePackagePath(candidate.packagedPath) === normalizedPath);
      if (!asset?.sourcePath && !asset?.binaryContent) throw new Error(`Missing local source or browser bytes for packaged asset: ${file.path}`);
      const binaryContent = asset.binaryContent || await readFile(asset.sourcePath as string);
      await writeFile(target, binaryContent);
      materializedFiles.push({ ...file, path: normalizedPath, status: 'generated', binaryContent });
    } else {
      await writeFile(target, file.content || '', 'utf8');
      materializedFiles.push({ ...file, path: normalizedPath, status: 'generated' });
    }
  }
  return { status: 'complete', isComplete: true, outputDirectory, manifest: plan.manifest, files: materializedFiles, diagnostics: plan.diagnostics };
}
