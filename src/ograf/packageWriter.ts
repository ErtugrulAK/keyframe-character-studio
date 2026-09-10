/// <reference types="node" />
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { isSafeOGrafPackagePath } from './compiler';
import type { OGrafGeneratedPackage, OGrafMaterializedPackage, OGrafPackageFile } from './types';

function assertSafePackagePath(root: string, relativePath: string): string {
  const normalized = relativePath.replace(/\\/gu, '/');
  if (!isSafeOGrafPackagePath(normalized)) throw new Error(`Unsafe package path: ${relativePath}`);
  const target = resolve(root, normalized);
  const targetRelative = resolve(root) === target ? '' : target.slice(resolve(root).length + 1);
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
    if (seenPaths.has(file.path)) throw new Error(`Duplicate package path: ${file.path}`);
    seenPaths.add(file.path);
    const target = assertSafePackagePath(outputDirectory, file.path);
    await mkdir(dirname(target), { recursive: true });
    if (file.kind === 'asset') {
      const asset = plan.assets.find((candidate) => candidate.packagedPath === file.path);
      if (!asset?.sourcePath && !asset?.binaryContent) throw new Error(`Missing local source or browser bytes for packaged asset: ${file.path}`);
      const binaryContent = asset.binaryContent || await readFile(asset.sourcePath as string);
      await writeFile(target, binaryContent);
      materializedFiles.push({ ...file, status: 'generated', binaryContent });
    } else {
      await writeFile(target, file.content || '', 'utf8');
      materializedFiles.push({ ...file, status: 'generated' });
    }
  }
  return { status: 'complete', isComplete: true, outputDirectory, manifest: plan.manifest, files: materializedFiles, diagnostics: plan.diagnostics };
}
