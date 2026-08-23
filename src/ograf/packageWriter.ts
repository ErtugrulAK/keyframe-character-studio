/// <reference types="node" />
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { OGrafGeneratedPackage, OGrafMaterializedPackage, OGrafPackageFile } from './types';

function assertSafePackagePath(root: string, relativePath: string): string {
  const normalized = relativePath.replace(/\\/gu, '/');
  if (!normalized || normalized.startsWith('/') || isAbsolute(relativePath) || /^[a-zA-Z]:\//u.test(normalized) || normalized.split('/').includes('..')) {
    throw new Error(`Unsafe package path: ${relativePath}`);
  }
  const target = resolve(root, relativePath);
  const targetRelative = relative(resolve(root), target);
  if (targetRelative.startsWith('..') || isAbsolute(targetRelative)) throw new Error(`Package path escapes output directory: ${relativePath}`);
  return target;
}

export async function materializeOGrafPackage(plan: OGrafGeneratedPackage, outputDirectory: string): Promise<OGrafMaterializedPackage> {
  if (plan.status === 'blocked') {
    return { status: 'blocked', isComplete: false, outputDirectory, manifest: plan.manifest, files: [], diagnostics: plan.diagnostics };
  }
  await mkdir(outputDirectory, { recursive: true });
  const materializedFiles: OGrafPackageFile[] = [];
  for (const file of plan.files) {
    const target = assertSafePackagePath(outputDirectory, file.path);
    await mkdir(dirname(target), { recursive: true });
    if (file.kind === 'asset') {
      const asset = plan.assets.find((candidate) => candidate.packagedPath === file.path);
      if (!asset?.sourcePath) throw new Error(`Missing source path for packaged asset: ${file.path}`);
      const binaryContent = await readFile(asset.sourcePath);
      await writeFile(target, binaryContent);
      materializedFiles.push({ ...file, status: 'generated', binaryContent });
    } else {
      await writeFile(target, file.content || '', 'utf8');
      materializedFiles.push({ ...file, status: 'generated' });
    }
  }
  return { status: 'complete', isComplete: true, outputDirectory, manifest: plan.manifest, files: materializedFiles, diagnostics: plan.diagnostics };
}
