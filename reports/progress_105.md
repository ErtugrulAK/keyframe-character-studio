# Progress 105 — Export Diagnostics Remediation UX

## Scope

Turn OGraf/package export diagnostics into user-actionable remediation. A blocked export must now tell the user what is wrong, which layer or asset is involved, and what to do next; warnings must stay warnings and must never block the package; a blocked export must never report success.

This is a source implementation task, so focused tests, the full suite, and a report are required.

Out of scope: new export/validation/evaluator engines, changes to the OGraf package contract, dependency upgrades, unrelated lint/format churn, and the GitHub draft release/npm publication state.

## Branch

- Implementation branch: `feat/export-diagnostics-ux`
- Feature commit: `828f3fb` — `feat: improve export diagnostics remediation UX`
- No branch deletion, no tag movement, no release publication.

## Baseline main SHA

- Audit baseline `main`: `5ee65925335defc14d287ab7c0aaf83b5f1d9a33` (`main == origin/main` before the change)
- Annotated tag `v1.1.0-rc.1` target (unchanged): `46d2a3e59e065816d972dcd56951803951b577f6`

## Implementation summary

The existing diagnostic authority in `src/ograf` was extended; no second validation authority was introduced.

1. `src/ograf/diagnostics.ts` — remediation authority:
   - `DIAGNOSTIC_REMEDIATIONS`: an exhaustive `Record<OGrafDiagnosticCode, { title, action }>` covering all 20 diagnostic codes, so a new code cannot be added without remediation text.
   - `WRITE_FAILURE_REMEDIATIONS`: the same for the new package-write failure codes.
   - `describeOGrafExportDiagnostic` returns `{ code, severity, title, message, action, context }`, where `message` is the unchanged diagnostic authority message and `context` is the layer name (preferred) or the feature slug.
   - `getOGrafExportRemediationReport` splits unique blocking and warning remediations and exposes `hasBlocking`.
   - `getUniqueOGrafExportWarnings` was added; the shared dedupe helper keeps `getUniqueOGrafExportErrors` behaviour (ERROR-only, once per font root cause) unchanged.
   - `OGrafPackageWriteError` carries stable failure codes; `describeOGrafPackageWriteFailure` converts a recognized failure into sanitized guidance and returns `null` for anything else, so unknown errors keep the previous generic message.
   - `sanitizeOGrafPathForDisplay` reduces machine-absolute paths to their final segment and keeps package-relative paths as authored.
   - `OGRAF_TRUSTED_DIRECTORY_NOTE` states the accepted filesystem constraints once: trusted dedicated source/output directories are required, concurrent filesystem mutation by other processes is unsupported, and KCS does not claim perfect OS-level protection against it.

2. `src/ograf/types.ts` — added `OGrafPackageWriteFailureCode` (`OGRAF_UNSAFE_OUTPUT_DIRECTORY`, `OGRAF_UNSAFE_OUTPUT_TARGET`, `OGRAF_UNSAFE_ASSET_SOURCE`, `OGRAF_UNSAFE_PACKAGE_PATH`, `OGRAF_MISSING_PACKAGE_SOURCE`, `OGRAF_BLOCKED_PACKAGE`).

3. `src/ograf/packageWriter.ts`, `src/ograf/browserZip.ts` — the existing filesystem/ownership guards now throw `OGrafPackageWriteError` with those codes. Guard conditions, order, and message text are unchanged; only the error type gained a code.

4. `src/hooks/useToast.ts` — `showToast(message, type, options?)` gained optional `title`, `action`, and `durationMs`; `ToastItem` carries `title`/`action`. Default behaviour (3200 ms dwell, plain message) is unchanged.

5. `src/context/AnimatorContext.tsx` — removed the duplicated `ToastItem` declaration (now re-exported from `useToast`) and widened the context `showToast` signature. No other consumer changed.

6. `src/components/Toast/ToastPortal.tsx` — renders the optional title and next step as a structured card; a plain toast renders exactly as before.

7. `src/components/Header/HeaderBar.tsx` — both OGraf export handlers use `notifyOGrafDiagnostics`, which emits one error toast per unique blocking diagnostic (title, explanation, next step, context), emits one grouped info toast for warnings, and returns a stop flag so the success toast is unreachable while blocked. The catch path now uses `describeOGrafPackageWriteFailure` when the failure is a recognized package write failure.

No new engine, no duplicated validator, no package-format change.

## Files changed

Source:

- `src/ograf/diagnostics.ts`
- `src/ograf/types.ts`
- `src/ograf/packageWriter.ts`
- `src/ograf/browserZip.ts`
- `src/hooks/useToast.ts`
- `src/context/AnimatorContext.tsx`
- `src/components/Toast/ToastPortal.tsx`
- `src/components/Header/HeaderBar.tsx`

Tests:

- `src/tests/ografDiagnostics.test.ts` (new)
- `src/tests/toastPortal.test.tsx` (new)
- `src/tests/ografBrowserZip.test.tsx` (extended)
- `src/tests/useToast.test.ts` (extended)

Docs:

- `CHANGELOG.md`
- `reports/progress_105.md`
- `docs/KCS_POST_RC_ROADMAP.md`
- `NEXT_SESSION.md`
- `PROJECT_STATE.md`

## User-facing behavior added

- Blocking diagnostics render a card with a stable title, the failing layer/feature in brackets, the explanation from the diagnostic authority, and a concrete next step. Example shown for a text layer without a portable font: title `Font is not portable [Subheading]`, explanation `Display Subheading uses Inter, but KCS has no portable font file for this font...`, next step `Import or upload the font file so KCS owns a portable copy, switch the layer to a font with an available file, or bake the text into an image asset.`
- Missing/invalid asset guidance tells the user to re-select/re-import the file, confirm it still exists, and keep it in a trusted dedicated source directory.
- External-asset guidance asks for a local re-import inside a trusted dedicated source directory.
- Unsupported-feature guidance names the feature and asks the user to remove, bake, or convert it; no downstream host behaviour is invented.
- Filesystem failures name the trusted-directory requirement, the unsupported hostile-concurrency case, and avoid claiming perfect protection; machine paths are reduced to their final segment.
- Warnings are surfaced once per root cause as a single info notification that states export continued and that warnings do not block the package.
- Blocking notifications stay visible for 9000 ms and warning notifications for 7000 ms (plain notifications remain 3200 ms).

Intentionally unchanged:

- Diagnostic codes, messages, severities, ordering, and dedupe rules.
- Package layout, manifest content, runtime generation, and validation authority.
- Package-write guard conditions and their message text.
- Plain toast rendering and default dwell time.
- Public exports: `getUniqueOGrafExportErrors` keeps its signature and semantics; new exports are additive.

## Tests added/updated

- `src/tests/ografDiagnostics.test.ts` (new, 9 tests): every diagnostic code has a non-empty title and next step; blocking diagnostics stay unique per root cause while warnings are separated; warning-only diagnostics are non-blocking; context prefers the layer name and falls back to the feature; both dedupe helpers stay split by severity; machine paths are reduced to a display-safe form; the trusted-directory failure states the accepted constraints, never leaks `C:\Users\...`, and embeds the shared note; unrecognized failures return `null`; a failure without a path detail stays readable.
- `src/tests/ografBrowserZip.test.tsx` (+2 tests): a blocked export shows title/explanation/next step, calls the browser ZIP writer zero times, and never reports success; a warning-only scene exports successfully, reports a single `Export warnings (1)` notification, and still shows the success toast.
- `src/tests/toastPortal.test.tsx` (new, 2 tests): a plain toast renders only its message; a structured toast renders title, explanation, and next step.
- `src/tests/useToast.test.ts` (+1 test): a toast carries `title`/`action` and honours a custom duration (still visible at 3200 ms, removed by 9000 ms).

## Validation matrix

| Check | Command | Result |
|---|---|---|
| Focused tests | `npx vitest run src/tests/ografDiagnostics.test.ts src/tests/ografBrowserZip.test.tsx src/tests/toastPortal.test.tsx src/tests/useToast.test.ts` | PASS — 4 files / 27 tests |
| Full Vitest | `npm test` | PASS — 103 files / 1509 tests (baseline 101 / 1495) |
| OGraf fixture validation | `npm run validate:ograf` | PASS — `fixtures/ograf/minimal.ograf.json: valid OGraf v1 manifest` |
| Release gate | `npm run qa:release` | PASS — candidate `5ee6592`, 2 Chromium tests passed |
| Production build | `npm run build` | PASS — existing Vite chunk-size warning only |
| TypeScript | `npx tsc --noEmit` and `tsc -b` (through build) | PASS |
| Lint | `npm run lint` | PASS — existing `AnimatorContext.tsx` Fast Refresh warning only |
| Whitespace | `git diff --check` | PASS |
| UI verification | Vite dev server on port 5199 + headless Chromium interaction | PASS — blocked export rendered the structured card without any download; a clean scene exported `template-ograf.zip` with no blocker or warning |

## Known warnings

Pre-existing and unrelated to this task:

- Oxlint `react(only-export-components)` Fast Refresh warning in `src/context/AnimatorContext.tsx` (the file exports the provider and the context; unchanged behaviour).
- Vite chunk-size warning for the single production bundle.
- npm install-script warning for `sqlite3`.
- OGraf schema validation still requires network access; offline validation is not claimed.
- Hostile concurrent filesystem mutation remains outside the supported threat model; no perfect OS-level protection is claimed.
- Git line-ending notices (LF → CRLF) for files written on Windows; no whitespace errors.

No new warnings were introduced.

## Protected invariants

- Tag `v1.1.0-rc.1` was not moved, recreated, or deleted; target remains `46d2a3e59e065816d972dcd56951803951b577f6`.
- The GitHub release remains an unpublished draft prerelease; no publish, finalize, or edit occurred.
- npm publish was not performed; the package remains private at `1.1.0-rc.1`.
- `without-mask` was not touched.
- Global OMP configuration, model roles, provider mappings, `memory.backend: mnemopi`, and `task.maxConcurrency: 8` were not changed.
- No Supabase production connection, Strix scan, Skill UI crawl/init, hook, routing, gateway, or server activation.
- No secrets, tokens, or API keys were printed or copied.
- `C:\Users\ertugrul.ak\Desktop\ograf-graphics` was not modified.
- No documentation, report, or QA folder was deleted.

## Review result

Two independent review passes (single read-only reviewer each) ran on the change set.

Pass 1 — verdict `BLOCKED`, with three findings:

1. HIGH: user-facing diagnostic text could still carry machine-absolute paths and URL credentials/query tokens for user-authored asset references.
2. HIGH: not every package materialization failure carried a stable failure code (raw `ENOENT` and similar filesystem errors stayed uncoded).
3. MEDIUM: the `ToastItem` type re-exported through `AnimatorContext` had narrowed `type` from optional to required.

Resolutions in commit `b80267c`:

1. `sanitizeOGrafDiagnosticText` redacts URL userinfo, URL query/fragment, Windows drive/UNC absolute paths, and POSIX absolute paths; it is applied to the diagnostic message and the display context in `describeOGrafExportDiagnostic`, and to the unclassified failure message in both `HeaderBar` catch paths. Covered by unit tests and by a `HeaderBar` test that exports a layer whose asset reference is a machine path and asserts the toast never contains the machine path or user name.
2. `packageWriter.ts` now classifies filesystem boundary failures: source reads become `OGRAF_PACKAGE_SOURCE_UNREADABLE`, and unexpected output-side failures become `OGRAF_OUTPUT_WRITE_FAILED`. Existing policy failures keep their codes and messages. `src/tests/ografPackage.test.ts` now asserts the real `.code` raised at the materialization boundary for the missing-source, non-regular-source, symlinked-source, symlinked-output-root, symlinked-output-target, and missing-content cases.
3. `ToastItem.type` is optional again, restoring the previously exported public shape while toasts still always set it.

Additionally, remediation wording was corrected so no action promises a capability KCS does not have (for example, unsupported-video guidance now says to replace the layer with an image asset authored outside KCS, and matte guidance asks for the specific legacy matte option to be changed).

Pass 2 — verdict `BLOCKED`. Findings 2 and 3 were confirmed CLOSED. Finding 1 remained open for protocol-relative URLs, single-segment and string-initial POSIX paths, paths whose segments contain spaces, and the wrapped OS-error detail.

Resolution in commit `5efdd1f`:

- Redaction was rewritten as ordered passes: embedded `data:` payloads, URL-like tokens (scheme-qualified and protocol-relative, stripping userinfo and query/fragment), whole-string absolute paths, quoted spans whose content is machine-absolute, unquoted drive/UNC paths, and unquoted POSIX paths. Spaces inside a path are consumed only while a further separator follows, so ordinary message words are never swallowed, and console-quoted paths (as Node formats them) are redacted wholesale, which covers segment names containing spaces.
- `describeOGrafPackageWriteFailure` now distinguishes a KCS-owned path detail (kept and reduced to its basename as the display context) from a wrapped OS message (routed through the text redactor), so `ENOENT: ... lstat 'C:\...'` no longer survives as a path.
- Regression coverage is table-driven at both layers: six machine-path forms, four URL/embedded-payload forms, bare-path context, authored relative paths, and the wrapped filesystem message at the remediation layer; three asset-reference forms (machine path, protocol-relative URL with credentials and token, `data:` payload) through the real `HeaderBar` export chain.

Pass 3 — verdict `BLOCKED`. Two gaps remained: a quoted `data:` payload whose body contains markup was only partly redacted, and a machine path that opens a longer string (`/home/alice/.../logo.png: permission denied`) survived. Coverage of the unclassified fallback catch path was also requested.

Resolution in commit `ec2fe4c`:

- Data-URL redaction now runs inside the quoted-span pass and the unquoted data-URL pattern no longer stops at `<` or `>`; `redactOGrafDataUrl` returns the token unchanged when no media parameters or payload remain, so the passes stay idempotent.
- The unquoted POSIX pattern also matches at the start of the string, so a leading machine path in a longer message is reduced to its final segment.
- Added unit rows for `data:image/svg+xml,<svg>TOP_SECRET</svg>`, three string-initial machine paths, and an `EACCES`-style wrapped filesystem detail, plus a `HeaderBar` test that rejects the ZIP writer with `/home/alice/private/out: permission denied` and asserts the toast keeps `out: permission denied`, never contains `/home/alice`, and carries the next-step hint.

Pass 4 — verdict `BLOCKED`. Two further realistic leaks were reported: a raw SVG `data:` payload containing an inner double quote, and a URL whose query contains `@` (userinfo was stripped before the query boundary was known). The legacy fallback catch path was also untested.

Resolution in commit `d8f213c`:

- The data-URL pass was reworked so a quoted payload is consumed to its closing quote, and `redactOGrafDataUrl` returns the token unchanged when no media parameters or payload remain, keeping the passes idempotent. (Commit `26e8f1b` later replaced this pattern with a deterministic scanner.)
- `redactOGrafUrlSecrets` now finds the query/fragment boundary first and strips userinfo only inside the authority part, so a `@` inside a query can no longer re-expose the query.
- Added rows for `<svg id="TOP_SECRET"/>`, `<svg onload="alert(1)">SECRET</svg>`, and the `@`-in-query URL, plus a `HeaderBar` legacy-handler test where `URL.createObjectURL` throws a machine path.

Pass 5 — verdict `BLOCKED`. Three further variants were reported: an SVG `data:` payload with two quoted attributes, a userinfo containing two `@`, and `file:///home/...`.

Resolution in commits `26e8f1b` and `425e0e7`:

- Embedded payload redaction is no longer pattern-based: it is now a deterministic scanner that consumes the whole quoted value (including inner quotes and markup) and stays idempotent.
- `redactOGrafUrlSecrets` uses the last `@` before the path separator, and reduces an empty-host URL's machine path to its basename (`file:///home/alice/x.png` becomes `file:///x.png`).
- The redaction is now fail-closed: `OGRAF_RESIDUAL_SECRET_PATTERN` checks the redacted text (and the display context) for any leftover drive/UNC path, leading-slash multi-segment path, URL-ish token containing `@?#`, or `data:` token containing `;,%` or 60+ characters. When it matches, the value is replaced by a withheld-value message and the context is dropped, while the stable title, code, severity, and next step are always preserved.

Pass 6 — verdict `BLOCKED`. Three further variants were reported: a URL whose userinfo contains an apostrophe (`https://alice:PASS'WORD@host/...`), a mixed-case `Data:` scheme, and a single-slash `file:/...` URI. All three are forms the redactor's quote-delimited token patterns do not cover.

Decision: the merge gate was not passed. Text-level redaction of user-authored values is heuristic by nature, and each round closes the reported forms while another quote or case variant surfaces. The airtight fix is structural — stop placing raw user-authored values into diagnostic messages at their source (`validation.ts`, `packageCompiler.ts`, `packageWriter.ts`) and format a safe rendering there — but that changes the diagnostic message text the authority produces and lies outside this task's approved change list. The work is therefore complete, validated, and unmerged, pending a scope decision.

Important context for that decision: none of the remaining forms is a regression. On the base commit `5ee6592` `HeaderBar` passed `diagnostic.message` to `showToast` unredacted, so every residual case behaves exactly as it did before this task; the common machine-path, credential-URL, and embedded-payload forms are now redacted where they previously were not.

Pass 6 detail — final merge-decision review: `BLOCKED`, merge withheld.

## Validation evidence for the fix commits

| Check | Command | Result |
|---|---|---|
| Focused tests | `npx vitest run src/tests/ografDiagnostics.test.ts src/tests/ografBrowserZip.test.tsx src/tests/ografPackage.test.ts src/tests/toastPortal.test.tsx src/tests/useToast.test.ts` | PASS — 5 files / 78 tests |
| Full Vitest | `npm test` | PASS — 103 files / 1539 tests |
| Release gate | `npm run qa:release` | PASS — candidate `425e0e7` lineage, 2 Chromium tests passed |
| Production build / TypeScript / lint / `git diff --check` | `npm run build`, `npx tsc --noEmit`, `npm run lint`, `git diff --check` | PASS — existing warnings only |
| UI verification | Vite dev server + headless Chromium, text layer without a portable font | PASS — blocking card rendered with title, explanation, and next step; no download |

## Merge/push status

- `feat/export-diagnostics-ux`: `828f3fb` (feature), `b80267c`, `5efdd1f`, `ec2fe4c`, `d8f213c`, `26e8f1b`, `425e0e7` (review fixes), plus this docs commit.
- **Not merged and not pushed.** The independent review remained `BLOCKED` at the merge gate, so `main` is untouched and the branch is retained.
- No normal merge commit, rebase, force push, tag change, release change, or npm publish occurred.

## Next recommended task

Roadmap task 2: **Track-matte source selection affordance** (`feat/track-matte-source-picker`). It targets the documented authoring gap while reusing `sourcePartId`, outliner identity, and the existing validation authority; scope must exclude validation duplication and matte-engine changes, and it needs a visual smoke plus focused UI tests.
