import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * The OGraf schema closure: the upstream documents the manifest validator
 * compiles against, the digest each one must have, and the vendored copy of
 * each document under `fixtures/ograf/schema/`.
 *
 * Two rules define the contract and must not weaken:
 *   1. every document is verified against its pinned SHA-256, whether it came
 *      from the local copy or from the network;
 *   2. a document that is not in this map is refused (`Unpinned remote schema
 *      reference`), so a `$ref` cannot pull in an unverified file.
 *
 * See `fixtures/ograf/schema/NOTICE.md` for the upstream notices and the
 * refresh procedure.
 */
export const schemaUrl = 'https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json';

export const schemaHashes = {
  'https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json': 'f9bba3e2c26d5ab0e8de29d342b535024d7a6d6c89583143f247a71708ddd1b8',
  'https://ograf.ebu.io/v1/specification/json-schemas/lib/action.json': 'f83db0ad6aadfb5ca590ef89bf6f64f04f9e55ec5a1b0e8c7e96271e470942fa',
  'https://ograf.ebu.io/v1/specification/json-schemas/gdd/object.json': '58b42a14ead4c4147f9e8dd4bfe304f0ba4210272963383a28ea9ea83f491689',
  'https://json-schema.org/draft/2020-12/schema': '41da76f5afb7ce062d248f762463a92f7ca47e4e0f905b224ba6afeef91ded0f',
  'https://ograf.ebu.io/v1/specification/json-schemas/gdd/gdd-types.json': 'a8efad17c0a05b6443d229242cbe642b40aa3ab89b56b52d1c9352546e1978c6',
  'https://ograf.ebu.io/v1/specification/json-schemas/gdd/basic-types.json': 'f8e30b149b33d3d1d697654dcc873fa21a7b45a98bc99ee7bcbf00a1f06c5663',
  'https://ograf.ebu.io/v1/specification/json-schemas/lib/constraints/number.json': '9478cd10295099a96dd4db8f89cb320c2396b9e7c9f7154c547fb7e926f9303f',
  'https://ograf.ebu.io/v1/specification/json-schemas/lib/constraints/boolean.json': 'bf8c11ac37d051ce2eb191698c24ebfbb3913ba45b5691fd76bcdc8eca2c87a6',
};

/** Vendored path per pinned URL, relative to the vendored schema root. */
export const vendoredSchemaPaths = {
  'https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json': 'graphics/schema.json',
  'https://ograf.ebu.io/v1/specification/json-schemas/lib/action.json': 'lib/action.json',
  'https://ograf.ebu.io/v1/specification/json-schemas/gdd/object.json': 'gdd/object.json',
  'https://json-schema.org/draft/2020-12/schema': 'json-schema-2020-12/schema.json',
  'https://ograf.ebu.io/v1/specification/json-schemas/gdd/gdd-types.json': 'gdd/gdd-types.json',
  'https://ograf.ebu.io/v1/specification/json-schemas/gdd/basic-types.json': 'gdd/basic-types.json',
  'https://ograf.ebu.io/v1/specification/json-schemas/lib/constraints/number.json': 'lib/constraints/number.json',
  'https://ograf.ebu.io/v1/specification/json-schemas/lib/constraints/boolean.json': 'lib/constraints/boolean.json',
};

/** Repository-relative location of the vendored schema root. */
export const vendoredSchemaRelativeRoot = 'fixtures/ograf/schema';

/** Absolute path of a vendored document for a pinned URL, under `root`. */
export const vendoredSchemaFile = (uri, root) => {
  const relative = vendoredSchemaPaths[uri];
  if (!relative) return undefined;
  return path.resolve(root, vendoredSchemaRelativeRoot, relative);
};

/**
 * Verifies raw document bytes against the pin for `uri`.
 * Throws on an unpinned reference or a digest mismatch — the fail-closed
 * behaviour both the offline and the online path rely on.
 */
export const verifyPinnedBytes = (uri, bytes) => {
  const expectedSha256 = schemaHashes[uri];
  if (!expectedSha256) throw new Error(`Unpinned remote schema reference: ${uri}`);
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== expectedSha256) throw new Error(`Schema hash mismatch for ${uri}`);
};

const readVendoredBytes = async (uri, root) => {
  const file = vendoredSchemaFile(uri, root);
  if (!file) throw new Error(`Unpinned remote schema reference: ${uri}`);
  return readFile(file);
};

const fetchBytesOverNetwork = async (uri) => {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Could not load schema ${uri}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};

/**
 * Loads one closure document and verifies its pin.
 *
 * @param uri pinned document URL
 * @param options.online read from the network instead of the vendored copy
 * @param options.root repository root that holds `fixtures/ograf/schema`
 *                      (required unless `readFile` is supplied)
 * @param options.readFile injectable reader (tests)
 * @param options.fetchBytes injectable fetcher (tests)
 */
export const loadSchemaDocument = async (
  uri,
  { online = false, root, readFile: readBytes, fetchBytes = fetchBytesOverNetwork } = {},
) => {
  const bytes = online
    ? await fetchBytes(uri)
    : await (readBytes ? readBytes(uri) : readVendoredBytes(uri, root));
  verifyPinnedBytes(uri, bytes);
  return JSON.parse(bytes.toString('utf8'));
};
