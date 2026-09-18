import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { toSafeFolderName } from '../../scripts/generate-ograf-folder-qa.mjs';

const repoRoot = process.cwd();
const generator = path.join(repoRoot, 'scripts', 'generate-ograf-folder-qa.mjs');
const validManifest = readFileSync(path.join(repoRoot, 'fixtures', 'ograf', 'minimal.ograf.json'), 'utf8');

const run = (args: string[]) => {
  try {
    const stdout = execFileSync(process.execPath, [generator, ...args], { cwd: repoRoot, encoding: 'utf8' });
    return { status: 0, output: stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? 1, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
};

/** A package directory shaped like the editor's output, plus a QA sidecar. */
const buildPackage = (root: string, options: { manifest?: string } = {}) => {
  const directory = path.join(root, 'package');
  mkdirSync(path.join(directory, 'assets', 'images'), { recursive: true });
  writeFileSync(path.join(directory, 'qa-sample.ograf.json'), options.manifest ?? validManifest);
  writeFileSync(path.join(directory, 'graphic.js'), '// runtime placeholder');
  writeFileSync(path.join(directory, 'scene.kcs'), '{"layers":[]}');
  writeFileSync(path.join(directory, 'assets', 'images', 'pixel.bin'), Buffer.from([0, 1, 2, 3]));
  writeFileSync(path.join(directory, 'qa-sample.diagnostics.json'), '{"diagnostics":[]}');
  return directory;
};

describe('OGraf folder QA generator', () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(path.join(tmpdir(), 'kcs-folder-qa-'));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('writes a clean copy, leaves the QA sidecar out, and reports verified parity', () => {
    const packageDirectory = buildPackage(workspace);
    const qaRoot = path.join(workspace, 'qa');

    const { status, output } = run(['--package', packageDirectory, '--out', qaRoot, '--name', 'qa-sample']);

    expect(status).toBe(0);
    expect(output).toContain('Clean folder QA copy');
    const copyFiles = readdirSync(path.join(qaRoot, 'qa-sample'));
    expect(copyFiles.sort()).toEqual(['assets', 'graphic.js', 'qa-sample.ograf.json', 'scene.kcs']);

    const report = readFileSync(path.join(qaRoot, 'qa-sample-host-qa-report.md'), 'utf8');
    expect(report).toContain('Every package file is present in the copy with identical SHA-256 content.');
    expect(report).toContain('Excluded sidecars: `qa-sample.diagnostics.json`');
    expect(report).toContain('Result: valid');
    expect(report).toContain('No real host was executed');
  });

  it('verifies an existing copy and passes when the bytes still match', () => {
    const packageDirectory = buildPackage(workspace);
    const qaRoot = path.join(workspace, 'qa');
    run(['--package', packageDirectory, '--out', qaRoot, '--name', 'qa-sample']);

    const { status, output } = run(['--package', packageDirectory, '--verify', path.join(qaRoot, 'qa-sample')]);

    expect(status).toBe(0);
    expect(output).toContain('Verified');
  });

  it('fails the verification when a copied file no longer matches the package', () => {
    const packageDirectory = buildPackage(workspace);
    const qaRoot = path.join(workspace, 'qa');
    run(['--package', packageDirectory, '--out', qaRoot, '--name', 'qa-sample']);
    writeFileSync(path.join(qaRoot, 'qa-sample', 'scene.kcs'), '{"layers":["changed"]}');

    const { status, output } = run(['--package', packageDirectory, '--verify', path.join(qaRoot, 'qa-sample')]);

    expect(status).toBe(1);
    expect(output).toContain('content drift: scene.kcs');
  });

  it('fails when the copy carries a file the package does not have', () => {
    const packageDirectory = buildPackage(workspace);
    const qaRoot = path.join(workspace, 'qa');
    run(['--package', packageDirectory, '--out', qaRoot, '--name', 'qa-sample']);
    writeFileSync(path.join(qaRoot, 'qa-sample', 'stray.json'), '{}');

    const { status, output } = run(['--package', packageDirectory, '--verify', path.join(qaRoot, 'qa-sample')]);

    expect(status).toBe(1);
    expect(output).toContain('extra file in the copy: stray.json');
  });

  it('reports an invalid manifest and still writes the copy it inspected', () => {
    const packageDirectory = buildPackage(workspace, { manifest: '{"name":"broken"}' });
    const qaRoot = path.join(workspace, 'qa');

    const { status, output } = run(['--package', packageDirectory, '--out', qaRoot, '--name', 'qa-sample']);

    expect(status).toBe(1);
    expect(output).toContain('Manifest validation failed');
    const report = readFileSync(path.join(qaRoot, 'qa-sample-host-qa-report.md'), 'utf8');
    expect(report).toContain('Result: INVALID');
  });

  it('refuses a QA root that would overwrite the repository', () => {
    const packageDirectory = buildPackage(workspace);

    const { status, output } = run(['--package', packageDirectory, '--out', repoRoot]);

    expect(status).toBe(1);
    expect(output).toContain('Refusing to write a QA root that would overwrite the repository');
  });

  it('requires an explicit QA root', () => {
    const packageDirectory = buildPackage(workspace);

    const { status, output } = run(['--package', packageDirectory]);

    expect(status).toBe(1);
    expect(output).toContain('--out or --verify are required');
  });

  it('sanitizes the folder name with the same policy as the package id', () => {
    expect(toSafeFolderName('Keyframe Character Studio OGraf Fixture')).toBe('keyframe-character-studio-ograf-fixture');
    expect(toSafeFolderName('  ..  ')).toBe('graphic');
  });
});
