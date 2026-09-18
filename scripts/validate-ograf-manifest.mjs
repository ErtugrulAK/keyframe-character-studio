#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { loadSchemaDocument, schemaUrl } from './ografSchemaClosure.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const defaultManifest = fileURLToPath(new URL('../fixtures/ograf/minimal.ograf.json', import.meta.url));
const argv = process.argv.slice(2);
// The closure is vendored under `fixtures/ograf/schema/` (see its NOTICE.md), so
// validation is offline and deterministic by default; `--online` fetches the
// pinned documents instead, which is only needed when refreshing the closure.
// Either way every document is verified against its pinned SHA-256.
const online = argv.includes('--online');
const paths = argv.filter((argument) => !argument.startsWith('--'));
if (paths.length === 0) paths.push(defaultManifest);

const loadSchema = (uri) => loadSchemaDocument(uri, { online, root: repoRoot });

const ajv = new Ajv2020({ strict: false, loadSchema });
addFormats(ajv);
const validate = await ajv.compileAsync(await loadSchema(schemaUrl));
let failed = false;
for (const path of paths) {
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  const valid = validate(manifest);
  if (!valid) {
    failed = true;
    console.error(`${path}: invalid OGraf v1 manifest`);
    for (const error of validate.errors || []) console.error(`  ${error.instancePath || '<root>'} ${error.message}`);
  } else {
    console.log(`${path}: valid OGraf v1 manifest`);
  }
}
process.exitCode = failed ? 1 : 0;
