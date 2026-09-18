import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  loadSchemaDocument,
  schemaHashes,
  schemaUrl,
  vendoredSchemaFile,
  vendoredSchemaPaths,
  verifyPinnedBytes,
} from '../../scripts/ografSchemaClosure.mjs';

// The tests run with the repository root as the working directory, which is also
// how the `validate:ograf` npm script and CI invoke the validator.
const repoRoot = process.cwd();
const validator = path.join(repoRoot, 'scripts', 'validate-ograf-manifest.mjs');

const runValidator = (args) =>
  execFileSync(process.execPath, [validator, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    // A poisoned proxy proves the offline path never reaches the network: any
    // fetch attempt would fail instead of silently succeeding.
    env: { ...process.env, HTTP_PROXY: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9' },
  });

describe('OGraf schema closure — vendored copies match the pins', () => {
  it('ships a vendored document for every pinned URL', () => {
    expect(Object.keys(vendoredSchemaPaths).sort()).toEqual(Object.keys(schemaHashes).sort());
    for (const uri of Object.keys(schemaHashes)) expect(vendoredSchemaFile(uri, repoRoot)).toBeTruthy();
  });

  it('has bytes on disk that hash to the recorded pin', async () => {
    for (const [uri, expected] of Object.entries(schemaHashes)) {
      const bytes = await readFile(vendoredSchemaFile(uri, repoRoot) as string);
      expect(createHash('sha256').update(bytes).digest('hex'), uri).toBe(expected);
    }
  });

  it('rejects a vendored document whose bytes changed', () => {
    const bytes = Buffer.from('{"tampered":true}');

    expect(() => verifyPinnedBytes(schemaUrl, bytes)).toThrow(/Schema hash mismatch/);
  });

  it('refuses a document that is not pinned', () => {
    expect(() => verifyPinnedBytes('https://example.invalid/schema.json', Buffer.from('{}'))).toThrow(
      /Unpinned remote schema reference/,
    );
  });
});

describe('OGraf schema closure — loading modes', () => {
  it('loads the closure from the vendored copies by default and never fetches', async () => {
    let fetched = 0;
    const document = await loadSchemaDocument(schemaUrl, {
      root: repoRoot,
      fetchBytes: async () => {
        fetched += 1;
        throw new Error('fetch must not be used in the default mode');
      },
    });

    expect(document).toBeTypeOf('object');
    expect(fetched).toBe(0);
  });

  it('verifies pin integrity in the online mode as well', async () => {
    const vendored = await readFile(vendoredSchemaFile(schemaUrl, repoRoot) as string);

    await expect(
      loadSchemaDocument(schemaUrl, { online: true, fetchBytes: async () => vendored }),
    ).resolves.toBeTypeOf('object');
    await expect(
      loadSchemaDocument(schemaUrl, { online: true, fetchBytes: async () => Buffer.from('{"drifted":true}') }),
    ).rejects.toThrow(/Schema hash mismatch/);
  });
});

describe('OGraf manifest validator script', () => {
  it('validates the committed fixture without network access', () => {
    const output = runValidator([]);

    expect(output).toContain('valid OGraf v1 manifest');
  });

  it('accepts an explicit fixture path', () => {
    const output = runValidator(['fixtures/ograf/minimal.ograf.json']);

    expect(output).toContain('valid OGraf v1 manifest');
  });
});
