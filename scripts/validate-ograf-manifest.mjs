#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schemaUrl = 'https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json';
const schemaHashes = {
  'https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json': 'f9bba3e2c26d5ab0e8de29d342b535024d7a6d6c89583143f247a71708ddd1b8',
  'https://ograf.ebu.io/v1/specification/json-schemas/lib/action.json': 'f83db0ad6aadfb5ca590ef89bf6f64f04f9e55ec5a1b0e8c7e96271e470942fa',
  'https://ograf.ebu.io/v1/specification/json-schemas/gdd/object.json': '58b42a14ead4c4147f9e8dd4bfe304f0ba4210272963383a28ea9ea83f491689',
  'https://json-schema.org/draft/2020-12/schema': '41da76f5afb7ce062d248f762463a92f7ca47e4e0f905b224ba6afeef91ded0f',
  'https://ograf.ebu.io/v1/specification/json-schemas/gdd/gdd-types.json': 'a8efad17c0a05b6443d229242cbe642b40aa3ab89b56b52d1c9352546e1978c6',
  'https://ograf.ebu.io/v1/specification/json-schemas/gdd/basic-types.json': 'f8e30b149b33d3d1d697654dcc873fa21a7b45a98bc99ee7bcbf00a1f06c5663',
  'https://ograf.ebu.io/v1/specification/json-schemas/lib/constraints/number.json': '9478cd10295099a96dd4db8f89cb320c2396b9e7c9f7154c547fb7e926f9303f',
  'https://ograf.ebu.io/v1/specification/json-schemas/lib/constraints/boolean.json': 'bf8c11ac37d051ce2eb191698c24ebfbb3913ba45b5691fd76bcdc8eca2c87a6',
};
const defaultManifest = fileURLToPath(new URL('../fixtures/ograf/minimal.ograf.json', import.meta.url));
const paths = process.argv.slice(2);
if (paths.length === 0) paths.push(defaultManifest);

async function fetchJson(uri) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Could not load schema ${uri}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const expectedSha256 = schemaHashes[uri];
  if (!expectedSha256) throw new Error(`Unpinned remote schema reference: ${uri}`);
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== expectedSha256) throw new Error(`Schema hash mismatch for ${uri}`);
  return JSON.parse(bytes.toString('utf8'));
}

const ajv = new Ajv2020({ strict: false, loadSchema: fetchJson });
addFormats(ajv);
const validate = await ajv.compileAsync(await fetchJson(schemaUrl));
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
