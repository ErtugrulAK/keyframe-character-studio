# Progress 145 — H4 jsdom 30.1.x triage (audit only, no change)

Milestone H, task H4. **No repository change**: the candidate jsdom versions were measured in an
isolated directory outside the repository (`npm install jsdom@30.0.1` / `jsdom@30.1.1` there), so the
project keeps `jsdom` 30.0.1 (specifier `^30.0.1`, lockfile 30.0.1) and its suite stays green.

## 1. The recorded reasons for deferring, re-measured

`reports/progress_130_dependency_maintenance_option_b.md` recorded two blockers for `jsdom` 30.1.x.
Neither reproduces in this checkout.

### 1.1 "`URL.createObjectURL` stops accepting the Blob this environment produces" — does not reproduce as a jsdom regression

| Probe (isolated, outside the repository) | jsdom 30.0.1 | jsdom 30.1.1 |
|---|---|---|
| `typeof window.URL.createObjectURL` on a bare jsdom window | **undefined** | **undefined** |
| jsdom `Blob` passed to **Node's** `URL.createObjectURL` | throws (`must be an instance of Blob`) | throws (`must be an instance of Blob`) |
| **Node** `Blob` passed to Node's `URL.createObjectURL` (same realm) | works (`blob:nodedata:…`) | works |

`URL.createObjectURL` is **not implemented by jsdom at all** in either version, and the failing pairing
is *Node's* implementation receiving a *jsdom* `Blob` — a cross-realm type check that fails identically
on both versions. It is a property of the test environment's mixing of realms, not a 30.1.x regression.

That is also why the repository is unaffected: the two test files that drive a download already stub the
API, with the reason written down at the call site —

```ts
// src/tests/presetExportImportUi.test.tsx:68
// jsdom lacks URL.createObjectURL — stub it for the export download flow
vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
```

and the same in `src/tests/ografBrowserZip.test.tsx:97`. In a real browser both objects come from one
realm, and the real download path is proven in Chromium by `e2e/export-onboarding.spec.ts` and
`e2e/ograf-editor-export.spec.ts`.

### 1.2 "`@asamuzakjp/dom-selector` 8.3.2 stops matching capitalised attribute selectors" — does not reproduce

Probe: a jsdom document with `aria-label="Enabled"`, `data-x="Enabled"` and `data-y="Inverted"`,
queried through jsdom's own `querySelectorAll` — the path the suite uses
(`src/tests/styleMatteSection.test.tsx` and ten other test files use this form).

| Selector | dom-selector 8.3.0 | dom-selector 8.3.2 (what jsdom 30.1.1 resolves) |
|---|---|---|
| `[aria-label="Enabled"]` | 1 | **1** |
| `[data-y="Inverted"]` | 1 | **1** |
| `[data-x="Enabled"]` | 1 | **1** |
| `[aria-label="enabled"]` (wrong case, must not match) | 0 | **0** |

The case-sensitive behaviour is correct in 8.3.2. jsdom 30.1.1 resolves `@asamuzakjp/dom-selector` to
8.3.2 in a clean tree, and that build matches capitalised attribute values.

## 2. Classification

| Question | Answer |
|---|---|
| **A — product bug?** | **No.** The production code uses the platform API correctly, and the browser path is proven by two Playwright export specs. |
| **B — test-environment mismatch?** | **Yes, for `createObjectURL`.** The vitest jsdom environment pairs Node's `URL` with the environment's `Blob`; jsdom implements neither. The repository already handles it by stubbing in the two tests that need it. |
| **C — jsdom behaviour/regression?** | **Not demonstrated.** Both recorded claims fail to reproduce (above). Nothing in the two versions breaks `createObjectURL` differently or the selectors. |
| **D — shim the browser API in tests?** | **Already done, in place.** A setup-level shim would centralise two per-test stubs and is a cleanup, not a requirement; the prompt's rule against adding fake browser behaviour to *production* code is respected either way. |

## 3. Verdict: **DEFERRED — on a corrected record, with a bounded verification needed to adopt it**

- The bump is an **in-range minor** (`^30.0.1`), pinned back by the lockfile; the release is verified on
  30.0.1, so nothing in the release depends on this decision.
- The reasons previously recorded for deferring **do not hold**, so the honest state is "plausibly safe,
  **unverified**": the only way to know is to install 30.1.1 and run the suite, the export smoke and the
  state check under it — a bounded experiment, not a refactor.
- **Recommended:** take it as its own small task (branch `chore/jsdom-30-1`): bump the one devDependency,
  run `npm test`, `npm run lint`, `npm run build`, `npm run validate:ograf`, `npm run qa:release` and the
  export Playwright spec, and fix only what actually fails. If it is green, the bump is a one-line
  manifest change; if something fails, the failure — not a remembered one — decides the follow-up.

## 4. State left behind

- `package.json` and `package-lock.json`: **untouched** (`jsdom` stays 30.0.1).
- No test, source or setup file changed.
- Probe artefacts live only in the system temp directory.
