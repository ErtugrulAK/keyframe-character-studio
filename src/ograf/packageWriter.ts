/// <reference types="node" />
import { lstat, mkdir, open, writeFile } from 'node:fs/promises';
import { dirname, join, parse, relative, resolve } from 'node:path';
import { normalizePackagePath } from '../utils/pathSafety';
import { isSafeOGrafPackagePath } from './compiler';
import { OGrafPackageWriteError, describeOGrafValueForDiagnostics } from './diagnostics';
import type { OGrafGeneratedPackage, OGrafMaterializedPackage, OGrafPackageFile } from './types';

function assertSafePackagePath(root: string, relativePath: string): string {
  const normalized = normalizePackagePath(relativePath);
  if (!isSafeOGrafPackagePath(normalized)) {
    throw new OGrafPackageWriteError('OGRAF_UNSAFE_PACKAGE_PATH', `Unsafe package path: ${describeOGrafValueForDiagnostics(relativePath)}`);
  }
  const rootPath = resolve(root);
  const target = resolve(rootPath, normalized);
  const targetRelative = target === rootPath ? '' : target.slice(rootPath.length + 1);
  if (!targetRelative || targetRelative.startsWith('..')) {
    throw new OGrafPackageWriteError('OGRAF_UNSAFE_PACKAGE_PATH', `Package path escapes output directory: ${describeOGrafValueForDiagnostics(relativePath)}`);
  }
  return target;
}
async function readRegularLocalFile(sourcePath: string): Promise<Uint8Array> {
  const sourcePathStat = await lstat(sourcePath);
  if (sourcePathStat.isSymbolicLink()) {
    throw new OGrafPackageWriteError('OGRAF_UNSAFE_ASSET_SOURCE', `Unsafe local asset source: ${describeOGrafValueForDiagnostics(sourcePath)}`);
  }
  const handle = await open(sourcePath, 'r');
  try {
    const handleStat = await handle.stat();
    if (!handleStat.isFile()) {
      throw new OGrafPackageWriteError('OGRAF_UNSAFE_ASSET_SOURCE', `Unsafe local asset source: ${describeOGrafValueForDiagnostics(sourcePath)}`);
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

/** Error-number code of a filesystem failure, or a neutral placeholder. */
function fileSystemFailureReason(error: unknown): string {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return typeof code === 'string' && /^[A-Z]+$/u.test(code) ? code : 'unknown error';
}

/**
 * Filesystem access is an external boundary: unreadable or missing sources become
 * coded failures. The raw OS message is never forwarded because it embeds the
 * machine path; only its error code is kept.
 */
async function assertRegularLocalFile(sourcePath: string): Promise<Uint8Array> {
  try {
    return await readRegularLocalFile(sourcePath);
  } catch (error) {
    if (error instanceof OGrafPackageWriteError) throw error;
    throw new OGrafPackageWriteError('OGRAF_PACKAGE_SOURCE_UNREADABLE', `Local asset source could not be read (${fileSystemFailureReason(error)}).`);
  }
}

async function ensureSafeDirectorySegment(path: string): Promise<void> {
  try {
    await mkdir(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new OGrafPackageWriteError('OGRAF_UNSAFE_OUTPUT_DIRECTORY', `Unsafe output directory: ${describeOGrafValueForDiagnostics(path)}`);
  }
}

async function assertSafeOutputDirectory(outputDirectory: string): Promise<string> {
  const rootPath = resolve(outputDirectory);
  const filesystemRoot = parse(rootPath).root;
  let current = filesystemRoot;
  const segments = relative(filesystemRoot, rootPath).split(/[\\/]/u).filter(Boolean);
  for (const segment of segments) {
    current = join(current, segment);
    await ensureSafeDirectorySegment(current);
  }
  const rootStat = await lstat(rootPath);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new OGrafPackageWriteError('OGRAF_UNSAFE_OUTPUT_DIRECTORY', `Unsafe output directory: ${describeOGrafValueForDiagnostics(outputDirectory)}`);
  }
  return rootPath;
}

async function assertSafeOutputAncestors(rootPath: string, targetDirectory: string): Promise<void> {
  const relativeDirectory = relative(rootPath, targetDirectory);
  let current = rootPath;
  for (const segment of relativeDirectory.split(/[\\/]/u).filter(Boolean)) {
    current = join(current, segment);
    await ensureSafeDirectorySegment(current);
  }
}
async function assertSafeOutputTarget(target: string): Promise<void> {
  try {
    const targetStat = await lstat(target);
    if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
      throw new OGrafPackageWriteError('OGRAF_UNSAFE_OUTPUT_TARGET', `Unsafe output target: ${describeOGrafValueForDiagnostics(target)}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

/** Classifies an unexpected output-side filesystem failure as a coded write failure. */
function toOutputWriteFailure(error: unknown): OGrafPackageWriteError {
  if (error instanceof OGrafPackageWriteError) return error;
  return new OGrafPackageWriteError('OGRAF_OUTPUT_WRITE_FAILED', `OGraf package output could not be written (${fileSystemFailureReason(error)}).`);
}

export async function materializeOGrafPackage(plan: OGrafGeneratedPackage, outputDirectory: string): Promise<OGrafMaterializedPackage> {
  if (plan.status === 'blocked') {
    return { status: 'blocked', isComplete: false, outputDirectory, manifest: plan.manifest, files: [], diagnostics: plan.diagnostics };
  }
  let rootPath: string;
  try {
    rootPath = await assertSafeOutputDirectory(outputDirectory);
  } catch (error) {
    throw toOutputWriteFailure(error);
  }
  const materializedFiles: OGrafPackageFile[] = [];
  const seenPaths = new Set<string>();
  for (const file of plan.files) {
    const normalizedPath = normalizePackagePath(file.path);
    const collisionKey = normalizedPath.toLowerCase();
    if (seenPaths.has(collisionKey)) {
      throw new OGrafPackageWriteError('OGRAF_UNSAFE_PACKAGE_PATH', `Duplicate package path: ${describeOGrafValueForDiagnostics(file.path)}`);
    }
    seenPaths.add(collisionKey);
    try {
      const target = assertSafePackagePath(rootPath, normalizedPath);
      const targetDirectory = dirname(target);
      await assertSafeOutputAncestors(rootPath, targetDirectory);
      await assertSafeOutputTarget(target);
      if (file.kind === 'asset') {
        const asset = plan.assets.find((candidate) => normalizePackagePath(candidate.packagedPath) === normalizedPath);
        if (!asset?.sourcePath && !asset?.binaryContent) {
          throw new OGrafPackageWriteError('OGRAF_MISSING_PACKAGE_SOURCE', `Missing local source or browser bytes for packaged asset: ${describeOGrafValueForDiagnostics(file.path)}`);
        }
        const binaryContent = asset.binaryContent || await assertRegularLocalFile(asset.sourcePath as string);
        await writeFile(target, binaryContent);
        materializedFiles.push({ ...file, path: normalizedPath, status: 'generated', binaryContent });
      } else {
        if (file.content === undefined) {
          throw new OGrafPackageWriteError('OGRAF_MISSING_PACKAGE_SOURCE', `Missing text content for packaged file: ${describeOGrafValueForDiagnostics(file.path)}`);
        }
        await writeFile(target, file.content, 'utf8');
        materializedFiles.push({ ...file, path: normalizedPath, status: 'generated' });
      }
    } catch (error) {
      throw toOutputWriteFailure(error);
    }
  }
  return { status: 'complete', isComplete: true, outputDirectory, manifest: plan.manifest, files: materializedFiles, diagnostics: plan.diagnostics };
}
