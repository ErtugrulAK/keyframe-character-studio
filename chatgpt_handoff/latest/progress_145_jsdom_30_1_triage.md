# Progress 145 — H4 jsdom 30.1.x: triage, then the verified bump

Milestone H, task H4. The audit ran first and the user then approved a bounded attempt, so this report
carries both: what the triage found, and the result of taking the bump.

> **Correction to the first version of this report.** It concluded, from probes run outside the test
> environment, that the recorded `createObjectURL` blocker did not reproduce. That conclusion was
> wrong, and the error was mine: a standalone jsdom `Blob` is not the object the *test environment*
> produces. Probing inside the environment reproduces the recorded failure exactly, and the section
> below records that evidence instead. Nothing else in the triage changed.

## 1. The recorded blocker, reproduced in the environment that matters

`reports/progress_130_dependency_maintenance_option_b.md` recorded that `jsdom` 30.1.x makes
`URL.createObjectURL` stop accepting the Blob the test environment produces. A throwaway probe test
inside the vitest environment reports the pairing directly:

| Probe value | `jsdom` 30.0.1 | `jsdom` 30.1.1 |
|---|---|---|
| `blob.constructor.name` | `Blob` | `Blob` |
| `Object.getOwnPropertySymbols(blob)` | `Symbol(impl)` | **(none)** |
| `typeof URL.createObjectURL` | `function` (Node's) | `function` (Node's) |
| `URL.createObjectURL(new Blob([…]))` | works (the suite passes) | **throws `Cannot read properties of undefined (reading '_buffer')`** |

So the failure is real and its mechanism is precise: **jsdom implements neither `createObjectURL` nor
`revokeObjectURL`** (both are `undefined` on a bare jsdom window in *either* version), so the
environment always pairs **Node's `URL`** with **jsdom's `Blob`**. Node's implementation looks for its
own Blob internals; `jsdom` 30.0.1's Blob happened to carry the `Symbol(impl)` it could follow, and
30.1.1's Blob carries no such symbol, so the call fails on the very Blob the environment produces.

Why the suite was affected at all: `src/tests/presetExportImportUi.test.tsx:68` and
`src/tests/ografBrowserZip.test.tsx:97` already stub the API locally, with the reason written at the
call site (`// jsdom lacks URL.createObjectURL — stub it for the export download flow`).
`src/tests/firstExportFlow.test.tsx` — the OGraf package export path — did not, so
`src/components/Header/HeaderBar.tsx:222` threw inside its `try`, the success toast never fired, and
the test's `waitFor` timed out at line 143. **One test failed; the other 1,933 passed.**

### The other recorded claim does not reproduce
`@asamuzakjp/dom-selector`'s capitalised attribute selectors were claimed to break in 8.3.2. Measured
through jsdom's own `querySelectorAll` — the path eleven test files use — with a document carrying
`aria-label="Enabled"`, `data-x="Enabled"` and `data-y="Inverted"`:

| Selector | dom-selector 8.3.0 | 8.3.2 | 9.2.1 (what jsdom 30.1.1 resolves) |
|---|---|---|---|
| `[aria-label="Enabled"]` | 1 | 1 | **1** |
| `[data-y="Inverted"]` | 1 | 1 | **1** |
| `[aria-label="enabled"]` (wrong case, must not match) | 0 | 0 | **0** |

Case-sensitive matching is correct in every version, so the bump does not threaten those selectors.

## 2. Classification

| Question | Answer |
|---|---|
| **A — product bug?** | **No.** The production code uses the platform API correctly; in a browser both `Blob` and `URL` come from one realm, and the real download path is proven by `e2e/export-onboarding.spec.ts`, `e2e/ograf-editor-export.spec.ts` and `e2e/ograf-phase2d-interoperability.spec.ts`. |
| **B — test-environment mismatch?** | **Yes.** Node's `URL` receiving jsdom's `Blob` is the whole failure. |
| **C — jsdom behaviour change?** | **Yes, as the trigger:** 30.1.1's Blob stopped exposing what the Node implementation needs. Not a defect in either project's contract — a pairing nothing guarantees. |
| **D — shim the browser API in tests?** | **Yes, and that is the fix.** No fake browser behaviour was added to production code. |

## 3. Applied (branch `chore/jsdom-30-1`)

| File | Change |
|---|---|
| `package.json` | `"jsdom": "^30.0.1"` → `"^30.1.1"` (one line; the only manifest change) |
| `package-lock.json` | jsdom 30.0.1 → 30.1.1 and its own tree: `@asamuzakjp/dom-selector` 8.3.2 → 9.2.1, `@asamuzakjp/css-color` 6.0.7 → 7.0.1, `html-encoding-sniffer` 6.0.0 → 7.0.0, two entries removed. No unrelated package moved. |
| `src/tests/setup.ts` | one definition of `URL.createObjectURL`/`revokeObjectURL` for the test environment, with the mechanism written down — the same place, and the same reasoning, as the existing download-link shim |

`jsdom` 30.1.1 declares `engines.node: "^22.22.2 || ^24.15.0 || >=26.0.0"` — exactly the intersection
this project already declares and CI already pins, so the bump is inside the supported toolchain.

## 4. Validation (with the bump and the shim in place)

| Check | Result |
|---|---|
| `npm test` | PASS — 126 files / **1,934 tests** (the failing test now passes; no other change) |
| `npm run lint` | clean |
| `npm run build` (`tsc -b` + vite) | PASS |
| `npx tsc -b --pretty false` | exit 0 |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests |
| `npx playwright test e2e/export-onboarding.spec.ts` | PASS — 1 test (the real download path) |
| `npx playwright test e2e/lottie-import-report.spec.ts e2e/ograf-matte-visual.spec.ts` | PASS — 7 tests |
| `node scripts/check-state-consistency.mjs` | PASS — 35 checks |
| `git diff --check` | clean |

## 5. Self-review (read-only, same model)

- **The shim is test-only and central.** It replaces an API the environment does not implement with the
  one property the download helpers use (a stable object URL), and it lives next to the download-link
  shim that exists for the same class of reason. The two tests that assert on their own object-URL calls
  stub locally, which still overrides it.
- **Determinism improved:** the suite no longer depends on the accident that jsdom's Blob matched Node's
  internals, which is what made a jsdom patch silently change test behaviour.
- **Blast radius of the manifest change:** one devDependency specifier plus its transitive tree. No
  runtime dependency, script, engine, workflow or source file is touched.
- **Not a product change:** no file under `src/` outside `src/tests/` is modified.

## 6. Not changed

- The `oxlint` deferral (H3) is untouched: the linter stays 1.74.0.
- No release, tag, draft or npm action.
