# Progress 115 — OGraf Offline Schema Closure (Milestone E, item 7, Option 7-A)

## 1. Scope

Implements the approved **7-A** from `docs/design/KCS_MILESTONE_E_OGRAF_QA_STUDY.md`: the pinned OGraf schema closure is vendored into the repository and `npm run validate:ograf` resolves it locally by default, so the validator — and the CI step that calls it — no longer depends on two remote hosts. The fail-closed contract is unchanged: every document is still verified against its pinned SHA-256.

## 2. Branch

- `chore/ograf-offline-schema-closure`, based on `main` at `46021eece4714fa8880ae4d3018e8f8f064c3a81`.

## 3. What changed

- **`fixtures/ograf/schema/`** — unmodified copies of all **8** pinned documents (33,567 bytes total), laid out as `graphics/schema.json`, `lib/action.json`, `lib/constraints/{number,boolean}.json`, `gdd/{object,gdd-types,basic-types}.json`, `json-schema-2020-12/schema.json`.
- **`fixtures/ograf/schema/NOTICE.md`** — the upstream notices required by both licences (EBU MIT; JSON Schema Specification Authors BSD-style) plus the refresh procedure, which says a vendored document may never be edited without updating its pin.
- **`scripts/ografSchemaClosure.mjs`** — the closure definition in one place: `schemaUrl`, `schemaHashes` (the same pins as before), `vendoredSchemaPaths`, `verifyPinnedBytes`, and `loadSchemaDocument(uri, { online, root, readFile, fetchBytes })`. The repository root is injected rather than derived from `import.meta.url`, which keeps the module importable by the test runner.
- **`scripts/validate-ograf-manifest.mjs`** — unchanged behaviour and exit codes; it now loads the closure through the shared module, defaults to the vendored copies, and fetches only with `--online` (the refresh path). The pinned-digest check runs on both paths.
- **`src/tests/ografSchemaClosure.test.ts`** — 8 focused cases: every pinned URL has a vendored file; each vendored file hashes to its pin; a changed document fails with `Schema hash mismatch`; an unpinned URI fails with `Unpinned remote schema reference`; the default mode never calls `fetch`; the online mode verifies pins too; the CLI validates the committed fixture with a poisoned proxy (proving no network); the CLI accepts an explicit fixture path.

No workflow change was needed: `.github/workflows/ci.yml:27-28` already runs `npm run validate:ograf`, so the existing step became offline and deterministic.

## 4. Validation (branch `chore/ograf-offline-schema-closure`)

| Check | Command | Result |
|---|---|---|
| Offline validation | `npm run validate:ograf` | PASS — `valid OGraf v1 manifest` |
| Offline with poisoned proxy | `HTTP_PROXY=http://127.0.0.1:9 HTTPS_PROXY=http://127.0.0.1:9 npm run validate:ograf` | PASS — proves no fetch is attempted |
| Online refresh path | `node scripts/validate-ograf-manifest.mjs --online` | PASS |
| Vendored pins | hash every vendored file against `schemaHashes` | 8/8 match |
| Tamper control | add one byte to a vendored document, run the validator | FAILS CLOSED with `Schema hash mismatch` (file restored afterwards) |
| Focused tests | `npx vitest run src/tests/ografSchemaClosure.test.ts` | PASS — 8 cases |
| Full suite | `npm test` | PASS — 115 files / 1,708 tests |
| Lint / TypeScript / build | `npm run lint`, `npx tsc --noEmit`, `npm run build` | clean / clean / PASS, no chunk-size advisory |
| Release gate | `npm run qa:release` | PASS — 2 Chromium tests |

## 5. Protected invariants

- The pins, the fail-closed checks, the validator's exit codes and its console wording are unchanged; `fixtures/ograf/minimal.ograf.json` is untouched.
- No dependency, `package.json`, `package-lock.json` or workflow change.
- The vendored documents are byte-identical to upstream (verified by the pin check in the tests and by the gate run).
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, global OMP configuration and the user's folders are unchanged.

## 6. Residual risks

- **Stale vendored closure:** if upstream publishes a new schema, the vendored copy keeps validating the old one until someone runs the refresh procedure. The procedure is documented in `NOTICE.md`; a repository-wide reminder is not automated.
- **`.gitattributes` and hashes:** the new `* text=auto eol=lf` rule normalises line endings. The vendored documents are already LF, and the pin test asserts the bytes on disk, so a normalisation change would fail the suite rather than silently passing.
- **`--online` remains a live-network path** by design, used only for refreshing the closure.

## 7. Next

- Item 8 (folder QA automation) is approved and implemented on its own branch.
