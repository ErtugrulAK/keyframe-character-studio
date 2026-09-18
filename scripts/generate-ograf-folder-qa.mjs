#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { unzipSync } from 'fflate';

const execFileAsync = promisify(execFile);

/**
 * Repository root, resolved on demand from this module URL. It is deliberately
 * not a module-level constant: the test runner rewrites module URLs, and the
 * CLI path is the only caller that needs it.
 */
const repoRoot = () => fileURLToPath(new URL('..', import.meta.url));

const USAGE = `Usage:
  node scripts/generate-ograf-folder-qa.mjs --package <ograf.zip|package-dir> --out <qa-root> [--name <folder>] [--report <file>]
  node scripts/generate-ograf-folder-qa.mjs --package <ograf.zip|package-dir> --verify <existing-folder> [--report <file>]

Writes a clean folder QA copy of an OGraf package (the host import unit), verifies the
copy on disk against the package it came from file by file, validates the manifest with
the pinned offline schema closure, and writes a host-limited report. It never invents a
host contract, never modifies the source package, and refuses a QA root that would
overwrite the repository.

Options:
  --package <path>  OGraf package as a .zip produced by the editor, or an extracted package directory
  --out <dir>       QA root; the clean copy is written to <out>/<folder>
  --verify <dir>    verify an existing QA copy instead of writing one
  --name <folder>   Folder name for the clean copy (default: the sanitized manifest name)
  --report <file>   Report path (default: <qa-root>/<folder>-host-qa-report.md)
`;

const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
};

/**
 * Mirrors the browser-side `sanitizeOGrafId` policy (src/ograf/compiler.ts) so a
 * QA folder name is filesystem-safe on every platform and matches the id the
 * package itself uses.
 */
export const toSafeFolderName = (value) => {
  const sanitized = value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^[-.]+|[-.]+$/gu, '')
    .toLowerCase();
  return sanitized || 'graphic';
};

/** Package-relative files with their bytes, from a ZIP or a directory. */
async function readPackage(packagePath) {
  const stats = await stat(packagePath);
  if (stats.isDirectory()) return readDirectoryFiles(packagePath, packagePath);
  if (!stats.isFile()) throw new Error(`Not a file or directory: ${packagePath}`);
  const entries = unzipSync(new Uint8Array(await readFile(packagePath)));
  const files = new Map();
  for (const [name, content] of Object.entries(entries)) {
    if (name.endsWith('/')) continue;
    files.set(name.replace(/\\/gu, '/'), Buffer.from(content));
  }
  return files;
}

async function readDirectoryFiles(root, current) {
  const files = new Map();
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      for (const [name, content] of await readDirectoryFiles(root, absolute)) files.set(name, content);
      continue;
    }
    if (!entry.isFile()) continue;
    files.set(path.relative(root, absolute).split(path.sep).join('/'), await readFile(absolute));
  }
  return files;
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Sidecars that belong to the QA process, not to the host import unit. */
const SIDECAR_PATTERN = /\.diagnostics\.json$/iu;
const isSidecar = (name) => SIDECAR_PATTERN.test(name);

/** Exactly one root-level `<name>.ograf.json` manifest is expected. */
function findManifest(files) {
  const candidates = [...files.keys()].filter((name) => !name.includes('/') && name.toLowerCase().endsWith('.ograf.json'));
  if (candidates.length !== 1) {
    throw new Error(`Expected exactly one root manifest (<name>.ograf.json), found ${candidates.length}: ${candidates.join(', ') || 'none'}`);
  }
  return candidates[0];
}

async function validateManifest(manifestPath) {
  const validatorScript = path.join(repoRoot(), 'scripts', 'validate-ograf-manifest.mjs');
  try {
    const { stdout } = await execFileAsync(process.execPath, [validatorScript, manifestPath], { cwd: repoRoot(), encoding: 'utf8' });
    return { valid: true, output: stdout.trim() };
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim();
    return { valid: false, output: output || String(error.message) };
  }
}

/** Writes the clean copy and returns the digests it wrote. */
async function writeCleanCopy(source, outDirectory) {
  const written = new Map();
  for (const [name, bytes] of source) {
    if (isSidecar(name)) continue;
    const target = path.join(outDirectory, ...name.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    written.set(name, sha256(bytes));
  }
  return written;
}

/**
 * Verifies the copy on disk against the package: every package file must exist
 * with identical bytes, and the copy must not carry files the package does not
 * have. Reads the files back from disk, so a write that silently changed bytes
 * is caught here rather than trusted.
 */
async function verifyCopy(source, copyDirectory) {
  const problems = [];
  const onDisk = await readDirectoryFiles(copyDirectory, copyDirectory);
  for (const [name, bytes] of source) {
    if (isSidecar(name)) continue;
    const copy = onDisk.get(name);
    if (!copy) problems.push(`missing in the copy: ${name}`);
    else if (sha256(copy) !== sha256(bytes)) problems.push(`content drift: ${name}`);
  }
  for (const name of onDisk.keys()) if (!source.has(name)) problems.push(`extra file in the copy: ${name}`);
  return { problems, files: onDisk };
}

function buildReport({ packagePath, copyDirectory, folderName, source, verified, manifestName, manifestResult, problems }) {
  const sidecars = [...source.keys()].filter(isSidecar).sort();
  const lines = [];
  lines.push(`# OGraf folder QA report — ${folderName}`);
  lines.push('');
  lines.push(`- Source package: \`${packagePath}\``);
  lines.push(`- Clean folder copy: \`${copyDirectory}\``);
  lines.push(`- Manifest: \`${manifestName}\``);
  lines.push(`- Files in the package: ${source.size} (sidecars excluded from the copy: ${sidecars.length})`);
  lines.push(`- Files in the copy: ${verified.size}`);
  if (sidecars.length) lines.push(`- Excluded sidecars: ${sidecars.map((name) => `\`${name}\``).join(', ')}`);
  lines.push('');
  lines.push('## Manifest validation');
  lines.push('');
  lines.push(`- Result: ${manifestResult.valid ? 'valid' : 'INVALID'}`);
  lines.push(`- Validator output: \`${manifestResult.output.split('\n')[0]}\``);
  lines.push('- The validator uses the vendored, pin-verified OGraf schema closure (offline).');
  lines.push('');
  lines.push('## Folder ↔ package comparison');
  lines.push('');
  lines.push(problems.length === 0 ? '- Every package file is present in the copy with identical SHA-256 content.' : problems.map((problem) => `- ${problem}`).join('\n'));
  lines.push('');
  lines.push('## File hashes');
  lines.push('');
  for (const [name, bytes] of [...verified.entries()].sort()) lines.push(`- \`${name}\` — \`${sha256(bytes)}\``);
  lines.push('');
  lines.push('## Host limitation');
  lines.push('');
  lines.push('- No real host was executed. This report proves the folder layout, the manifest validity against the pinned schema closure, and file-level parity between the clean copy and the package it came from.');
  lines.push('- It does not prove that any specific host imports, renders, or accepts the folder; that evidence can only come from the host itself.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return;
  }
  const value = (flag) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const packagePath = value('--package');
  const outDirectory = value('--out');
  const verifyOnly = value('--verify');
  if (!packagePath || (!outDirectory && !verifyOnly)) {
    fail(`--package plus either --out or --verify are required.\n\n${USAGE}`);
    return;
  }
  const resolvedOut = outDirectory ? path.resolve(outDirectory) : undefined;
  if (resolvedOut && (resolvedOut === repoRoot() || repoRoot().startsWith(`${resolvedOut}${path.sep}`))) {
    fail(`Refusing to write a QA root that would overwrite the repository: ${resolvedOut}`);
    return;
  }

  const source = await readPackage(path.resolve(packagePath));
  const manifestName = findManifest(source);
  const manifest = JSON.parse(source.get(manifestName).toString('utf8'));
  const folderName =
    value('--name') ||
    (verifyOnly ? path.basename(path.resolve(verifyOnly)) : toSafeFolderName(manifest.name || path.basename(packagePath, path.extname(packagePath))));
  const copyDirectory = verifyOnly ? path.resolve(verifyOnly) : path.join(resolvedOut, folderName);

  if (!verifyOnly) await writeCleanCopy(source, copyDirectory);
  const { problems, files } = await verifyCopy(source, copyDirectory);
  const manifestResult = await validateManifest(path.join(copyDirectory, ...manifestName.split('/')));
  const reportPath = value('--report') || path.join(resolvedOut ?? path.dirname(copyDirectory), `${folderName}-host-qa-report.md`);
  await writeFile(reportPath, buildReport({ packagePath, copyDirectory, folderName, source, verified: files, manifestName, manifestResult, problems }));

  console.log(`${verifyOnly ? 'Verified' : 'Clean folder QA copy'}: ${copyDirectory}`);
  console.log(`Report: ${reportPath}`);
  if (!manifestResult.valid) fail(`Manifest validation failed: ${manifestResult.output.split('\n')[0]}`);
  if (problems.length) fail(`Folder comparison failed:\n  ${problems.join('\n  ')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
}
