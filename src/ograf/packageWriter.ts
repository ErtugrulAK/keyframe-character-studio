/// <reference types="node" />
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
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
async function assertRegularLocalFile(sourcePath: string): Promise<Uint8Array> {
  const sourceStat = await lstat(sourcePath);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
    throw new Error(`Unsafe local asset source: ${sourcePath}`);
  }
  return readFile(sourcePath);
}

async function assertSafeOutputDirectory(outputDirectory: string): Promise<string> {
  const rootPath = resolve(outputDirectory);
  await mkdir(rootPath, { recursive: true });
  const rootStat = await lstat(rootPath);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`Unsafe output directory: ${outputDirectory}`);
  }
  return rootPath;
}

async function assertSafeOutputAncestors(rootPath: string, targetDirectory: string): Promise<void> {
  const relativeDirectory = relative(rootPath, targetDirectory);
  let current = rootPath;
  for (const segment of relativeDirectory.split(/[\\/]/u).filter(Boolean)) {
    current = join(current, segment);
    const currentStat = await lstat(current);
    if (currentStat.isSymbolicLink() || !currentStat.isDirectory()) {
      throw new Error(`Unsafe output directory ancestor: ${current}`);
    }
  }
}
async function assertSafeOutputTarget(target: string): Promise<void> {
  try {
    const targetStat = await lstat(target);
    if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
      throw new Error(`Unsafe output target: ${target}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function materializeOGrafPackage(plan: OGrafGeneratedPackage, outputDirectory: string): Promise<OGrafMaterializedPackage> {
  if (plan.status === 'blocked') {
    return { status: 'blocked', isComplete: false, outputDirectory, manifest: plan.manifest, files: [], diagnostics: plan.diagnostics };
  }
  const rootPath = await assertSafeOutputDirectory(outputDirectory);
  const materializedFiles: OGrafPackageFile[] = [];
  const seenPaths = new Set<string>();
  for (const file of plan.files) {
    const normalizedPath = normalizePackagePath(file.path);
    const collisionKey = normalizedPath.toLowerCase();
    if (seenPaths.has(collisionKey)) throw new Error(`Duplicate package path: ${file.path}`);
    seenPaths.add(collisionKey);
    const target = assertSafePackagePath(rootPath, normalizedPath);
    const targetDirectory = dirname(target);
    await mkdir(targetDirectory, { recursive: true });
    await assertSafeOutputAncestors(rootPath, targetDirectory);
    await assertSafeOutputTarget(target);
    if (file.kind === 'asset') {
      const asset = plan.assets.find((candidate) => normalizePackagePath(candidate.packagedPath) === normalizedPath);
      if (!asset?.sourcePath && !asset?.binaryContent) throw new Error(`Missing local source or browser bytes for packaged asset: ${file.path}`);
      const binaryContent = asset.binaryContent || await assertRegularLocalFile(asset.sourcePath as string);
      await writeFile(target, binaryContent);
      materializedFiles.push({ ...file, path: normalizedPath, status: 'generated', binaryContent });
    } else {
      if (file.content === undefined) throw new Error(`Missing text content for packaged file: ${file.path}`);
      await writeFile(target, file.content, 'utf8');
      materializedFiles.push({ ...file, path: normalizedPath, status: 'generated' });
    }
  }
  return { status: 'complete', isComplete: true, outputDirectory, manifest: plan.manifest, files: materializedFiles, diagnostics: plan.diagnostics };
}
