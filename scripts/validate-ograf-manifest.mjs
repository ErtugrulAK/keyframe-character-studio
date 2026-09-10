#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schemaUrl = 'https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json';
const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('Usage: node scripts/validate-ograf-manifest.mjs <manifest.ograf.json> [...]');
  process.exit(2);
}

const ajv = new Ajv2020({ strict: false, loadSchema: async (uri) => {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Could not load schema ${uri}: ${response.status}`);
  return response.json();
} });
addFormats(ajv);
const validate = await ajv.compileAsync(await (await fetch(schemaUrl)).json());
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
