# Vendored OGraf schema closure — upstream notices

The JSON documents under this directory are unmodified copies of the upstream
documents that `scripts/validate-ograf-manifest.mjs` pins by SHA-256. They are
vendored so that `npm run validate:ograf` (and the CI step that calls it) can
validate manifests without network access. The validator still verifies every
document against the pinned digest, so an edited copy fails closed.

| Local path | Upstream URL |
|---|---|
| `graphics/schema.json` | `https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json` |
| `lib/action.json` | `https://ograf.ebu.io/v1/specification/json-schemas/lib/action.json` |
| `lib/constraints/number.json` | `https://ograf.ebu.io/v1/specification/json-schemas/lib/constraints/number.json` |
| `lib/constraints/boolean.json` | `https://ograf.ebu.io/v1/specification/json-schemas/lib/constraints/boolean.json` |
| `gdd/object.json` | `https://ograf.ebu.io/v1/specification/json-schemas/gdd/object.json` |
| `gdd/gdd-types.json` | `https://ograf.ebu.io/v1/specification/json-schemas/gdd/gdd-types.json` |
| `gdd/basic-types.json` | `https://ograf.ebu.io/v1/specification/json-schemas/gdd/basic-types.json` |
| `json-schema-2020-12/schema.json` | `https://json-schema.org/draft/2020-12/schema` |

## Refresh procedure

1. Run `node scripts/validate-ograf-manifest.mjs --online <fixture>` against the live upstream documents.
2. If an upstream document changed, copy the new bytes into this directory, update the corresponding SHA-256 in `schemaHashes` (`scripts/ografSchemaClosure.mjs` — the validator imports the pins from there), and re-run the validator plus its tests.
3. Never edit a vendored document in place without updating its pin: the pin check is the fail-closed contract.

## Upstream licence notices

### OGraf specification schemas — European Broadcasting Union (EBU)

Source: `https://github.com/ebu/ograf` (MIT License), retrieved 2026-09-18.

```
MIT License

Copyright (c) 2026 European Broadcasting Union (EBU)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### JSON Schema 2020-12 meta-schema — JSON Schema Specification Authors

Source: `https://github.com/json-schema-org/json-schema-spec` (`LICENSE`, the
JSON Schema Specification Authors notice; the same file also carries an
Academic Free License 3.0 text for the specification document itself),
retrieved 2026-09-18.

```
Copyright (c) 2022 JSON Schema Specification Authors

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

1. Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright
notice, this list of conditions and the following disclaimer in the
documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
