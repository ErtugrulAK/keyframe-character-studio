# KCS ChatGPT One-File Handoff
## 0. Upload Instructions

- This file is rebuilt from the current `chatgpt_handoff/latest/` bundle; it is not an archive.
- Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT.
- Repository root: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`.
- `C:\Users\ertugrul.ak\Desktop\KCS` and `C:\Users\ertugrul.ak\Desktop\ograf-graphics` were not touched.

---

## 1. OMP Final Response

# KCS Final Maintenance Reconciliation — OMP Response

## 1) Phase 0 baseline

The run started from clean synchronized `main` at `c5bed46`, with the latest CI green, the state checker passing, and no Git operation in progress.

## 2) Task 1 — dialog focus restoration

Merged at `5cb8a45`. Confirmation and import-report dialogs focus their initial action and restore focus to a connected opener after Cancel, Confirm, or `Escape`. A removed opener is ignored safely. Focused tests, full regression, build, lint, and an actual browser focus smoke passed. CI `36314400055` passed.

## 3) Task 2 — SQLite repository hygiene

Merged at `b3f3c6c`. `server/db/keyframe_studio.sqlite` is runtime-generated and Git-ignored rather than tracked. A clean first start recreated and seeded the file; health and project routes passed. CI `36314754294` passed.

## 4) Task 3 — API CORS policy

Merged at `2a313d7`. Browser access defaults to exact local editor/QA origins; `KCS_CORS_ORIGINS` adds exact `http(s)` origins, and malformed or widening forms fail startup. Origin-less clients remain supported. Actual API and test coverage passed. CI `36315091917` passed.

## 5) Task 4 — Oxlint 1.85

Merged at `feca773`. Three genuine findings were fixed; deliberate latest-ref and synchronization effects retain line-specific suppressions with adjacent rationale. No broad or file-level rule disable was added. Full validation and unused-disable enforcement passed. CI `36315413652` passed.

## 6) Task 5 — TypeScript 7 and Vitest 5

Merged at `37904fb`. TypeScript 7.0.2, Vitest 5.0.2, and `@vitest/coverage-v8` 5.0.2 are aligned. No source compatibility patch was required. A fresh install, type check, 128 files / 1,951 tests, lint, build, OGraf validation, release QA, eight focused browser tests, V6 QA, the combined check, state consistency, audit, diff hygiene, and CI `36315904883` passed.

## 7) Task 6 — docs and handoff reconciliation

The live documents now record all five tasks as closed. `reports/progress_150_final_maintenance_reconciliation.md` is the durable report. `chatgpt_handoff/latest/` was cleaned and rebuilt with eight documents, and the one-file upload was regenerated from those current sources only.

## 8) Validation and CI matrix

All five implementation commits were fast-forwarded to `main`, pushed, and followed by green CI. The final implementation baseline reports zero npm vulnerabilities. The documentation patch is documents-only and uses the state checker plus diff/stale-claim gates before integration.

## 9) Branch, commit, merge, and push summary

Implementation commits: `5cb8a45`, `b3f3c6c`, `2a313d7`, `feca773`, `37904fb`. Documentation branch: `docs/final-maintenance-reconciliation`; commit message: `docs: reconcile final maintenance state`. Integration is fast-forward only. Branches are retained. No rebase, reset, force push, branch deletion, or history rewrite occurred.

## 10) Handoff paths

- Bundle sources: `chatgpt_handoff\latest\`
- Upload artifact: `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`
- Engineering record: `reports\progress_150_final_maintenance_reconciliation.md`

## 11) Final release-readiness verdict

The technical baseline is ready for a read-only release audit. H7 nevertheless remains HOLD by user decision. The GitHub Actions Node runtime and Ubuntu runner migration annotations are non-blocking workflow-maintenance warnings, not evidence of a product failure.

## 12) Explicit no-release statement

No tag was created, moved, or deleted. The GitHub draft prerelease was not published or finalized. No npm package was published. `v1.1.0-rc.1` remains at `46d2a3e59e065816d972dcd56951803951b577f6`, and the package remains private at `1.1.0-rc.1`.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.

---

## 2. Bundle README

# KCS Minimal ChatGPT Upload Bundle — final maintenance reconciliation

This is the clean, task-specific handoff for the five-task post-hold maintenance run. It replaces the previous bundle; it is not an archive.

## Current truth

- `main` contains the five implementation commits through `37904fb`.
- Dialog focus restoration: closed at `5cb8a45`.
- Runtime SQLite repository hygiene: closed at `b3f3c6c`.
- Exact API browser-origin policy: closed at `2a313d7`.
- Oxlint 1.85 adoption: closed at `feca773`.
- TypeScript 7 plus Vitest and coverage-v8 5: closed at `37904fb`.
- Each implementation commit has a green `main` CI run; the latest implementation run is `36315904883`.
- Milestone H remains complete through H6 and H7 remains HOLD. The release tag, draft prerelease, private package version, and npm publication state are unchanged.

## Verification baseline

The TypeScript/Vitest baseline passed a fresh `npm ci`, TypeScript build mode, Oxlint, 128 Vitest files / 1,951 tests, production build, OGraf validation, release QA, export/Lottie/matte browser specs, V6 QA, the combined check, state consistency, `npm audit` with zero vulnerabilities, diff hygiene, and Linux CI.

## Files

- `OMP_FINAL_RESPONSE.md` — maintenance close-out response.
- `progress_150_final_maintenance_reconciliation.md` — durable engineering record.
- `NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`, `CHANGELOG.md` — current mirrored documents.
- `manifest.txt` — bundle inventory and boundaries.
- `README.md` — this guide.

The four mirrored documents are byte-equivalent to their repository sources after CRLF/LF normalization and whole-document trimming.

## Deliberately omitted

Source, tests, package files, workflows, historical reports, binaries, archives, assets, caches, and QA output are not copied. Historical reports remain in `reports/` and were not rewritten or deleted.

Nothing was copied to `C:\Users\ertugrul.ak\Desktop\KCS` or `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.

---

## 3. Bundle Manifest

# KCS ChatGPT Upload Manifest — final maintenance reconciliation

Clean refreshed: YES
Bundle scope: minimal and task-specific; not an archive
Task record: reports/progress_150_final_maintenance_reconciliation.md

Implementation baseline: main at or after 37904fb
Dialog focus restoration: CLOSED at 5cb8a45; CI 36314400055 PASS
Runtime SQLite repository hygiene: CLOSED at b3f3c6c; CI 36314754294 PASS
Exact API CORS policy: CLOSED at 2a313d7; CI 36315091917 PASS
Oxlint 1.85 adoption: CLOSED at feca773; CI 36315413652 PASS
TypeScript 7 / Vitest 5: CLOSED at 37904fb; CI 36315904883 PASS
Latest full suite: 128 files / 1,951 tests PASS
Dependency audit: 0 vulnerabilities
Release state: H7 HOLD; tag v1.1.0-rc.1 remains at 46d2a3e59e065816d972dcd56951803951b577f6; GitHub release remains draft prerelease; package remains private at 1.1.0-rc.1; npm publish NO
Non-blocking CI annotations: Node 20 action runtime forced to Node 24; announced ubuntu-latest migration to Ubuntu 26

Copied files (8):
- CHANGELOG.md
- KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md
- NEXT_SESSION.md
- OMP_FINAL_RESPONSE.md
- PROJECT_STATE.md
- README.md
- manifest.txt
- progress_150_final_maintenance_reconciliation.md

Omitted: source, tests, package/lock files, workflows, historical reports, binaries, archives, assets, caches, and QA output.
Never touched: C:\Users\ertugrul.ak\Desktop\KCS; C:\Users\ertugrul.ak\Desktop\ograf-graphics; origin/without-mask; global OMP configuration.

Upload only chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md to ChatGPT. The files above are the sources of that one-file artifact.

---

## 4. Development Report 150

# KCS Development Report — Final Post-Hold Maintenance Reconciliation

Metadata:
- Date: 2026-09-27
- Milestone: Five-task post-hold maintenance close-out
- Branch: `docs/final-maintenance-reconciliation`
- Starting HEAD: `37904fb178b36aabb7f8bcb3ec11b8caa1162ceb`
- Ending HEAD: the focused documentation commit named `docs: reconcile final maintenance state`; its hash cannot be embedded in its own content
- Commit status: five implementation commits are merged and pushed; this report is part of the final documentation commit
- Report number: 150

# 1. Executive Summary

Five approved maintenance tasks were completed sequentially, each on its own branch and focused commit, then fast-forwarded to `main` only after local validation and green CI. Dialogs restore opener focus, the runtime SQLite database is no longer tracked, browser CORS uses an exact allowlist, Oxlint 1.85 is adopted, and TypeScript 7 plus Vitest 5 are adopted as an aligned toolchain pair. Live documents and the ChatGPT handoff now state that these items are closed. The release decision remains HOLD; no tag, GitHub release, npm publication, or package version changed.

# 2. Original Objectives

In scope: execute the five named maintenance tasks in order, preserve runtime and public contracts except for the explicitly approved fixes, validate each task, integrate by fast-forward only, reconcile live documents, and rebuild the handoff. Out of scope: release publication, tag movement, npm publication, branch deletion, unrelated refactors, OMP configuration, `origin/without-mask`, `C:\Users\ertugrul.ak\Desktop\KCS`, and `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.

# 3. Problems Discovered

1. Confirmation and import-report dialogs did not restore focus to their opener. Root cause: no shared focus-lifecycle authority. Status: fixed at `5cb8a45`.
2. `server/db/keyframe_studio.sqlite` was tracked even though the server creates and seeds it at runtime. Status: removed from Git tracking and ignored at `b3f3c6c`.
3. Express used unrestricted browser CORS. Status: exact local allowlist plus validated opt-in origins at `2a313d7`.
4. Oxlint 1.85 surfaced 34 warnings. Three represented genuine problems; 31 represented intentional latest-ref or synchronization-effect patterns. Status: three fixes plus line-specific documented suppressions at `feca773`.
5. TypeScript 7 and Vitest 5 had been deferred without an installed compatibility result. Status: aligned upgrade completed at `37904fb` with no source compatibility patch required.
6. GitHub Actions reports non-blocking platform annotations: Node 20-based action runtimes are forced onto Node 24, and `ubuntu-latest` is scheduled to migrate to Ubuntu 26.

# 4. Files Created

- `src/hooks/useDialogFocusRestoration.ts` — shared capture, initial-focus, and connected-opener restoration authority.
- `src/tests/dialogFocusRestoration.test.tsx` — observable focus lifecycle coverage for both dialogs.
- `server/corsPolicy.js` — exact-origin parsing and Express CORS options.
- `src/tests/apiCorsPolicy.test.ts` — allowed, disallowed, origin-less, opt-in, and malformed-origin behavior.
- `reports/progress_150_final_maintenance_reconciliation.md` — this durable close-out record.

# 5. Files Modified

- `src/components/Modal/ConfirmationDialog.tsx`, `src/components/Modal/ImportReportDialog.tsx` — use the shared focus-restoration hook.
- `src/components/Header/HeaderBar.tsx`, `src/components/Header/HeaderBar.css` — make the template-delete opener a semantic focusable button without visual regression.
- `.gitignore`, `server/db/keyframe_studio.sqlite` — ignore the runtime database and remove its tracked copy; local runtime creation remains unchanged.
- `server/index.js`, `.env.example`, `README.md`, `docs/API.md` — apply and document the CORS policy and API boundary.
- `src/hooks/usePlayback.ts`, `src/hooks/useBroadcast.ts`, `src/tests/trackMutations.test.ts` — fix the three genuine Oxlint 1.85 findings.
- `src/components/Canvas/StageCanvas.tsx`, `src/components/Canvas/overlays/FreeformTangentOverlay.tsx`, `src/components/Inspector/InteractiveCubicBezierEditor.tsx`, `src/components/Inspector/TemporalGraphPanel.tsx`, `src/components/Inspector/inputs/SmartHexInput.tsx`, `src/components/Inspector/inputs/SmartNumberInput.tsx`, `src/components/Inspector/sections/transform/TransformInOutPresetCard.tsx`, `src/components/Modal/NewItemModal.tsx`, `src/hooks/useFreeformDraw.ts`, `src/hooks/useHistory.ts`, `src/hooks/usePresets.ts`, `src/hooks/useProjectState.ts`, `src/hooks/useSerialization.ts`, and `src/tests/freeformTangentHistory.test.tsx` — add only line-specific Oxlint suppressions with adjacent rationale for deliberate React synchronization patterns.
- `package.json`, `package-lock.json` — adopt Oxlint 1.85, TypeScript 7.0.2, Vitest 5.0.2, and `@vitest/coverage-v8` 5.0.2 with their aligned lockfile graph.
- `CHANGELOG.md`, `NEXT_SESSION.md`, `PROJECT_STATE.md`, `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`, `docs/KCS_RELEASE_CANDIDATE_SUMMARY.md`, `docs/README_INDEX.md`, `reports/README.md` — reconcile the live state and report indexes.
- `chatgpt_handoff/latest/**`, `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` — clean, minimal handoff rebuilt from current documents only.

# 6. Architecture Overview

```text
Dialog opener -> shared focus hook -> initial action -> close/unmount -> connected opener
Browser Origin -> corsPolicy exact set -> Express cors middleware -> response headers
API startup -> SQLite module -> runtime file creation/seed (ignored by Git)
package.json -> aligned TypeScript/Vitest/Oxlint versions -> existing build/test/lint gates
```

No parallel state, evaluation, playback, serialization, or timing authority was introduced.

# 7. Data Model Changes

No authored, serialized, evaluated, or transient animation data model changed. SQLite schema and seed behavior are unchanged; only repository ownership of the runtime file changed.

# 8. Coordinate Space Model

Not applicable. The maintenance work does not change canvas, transform, selection, hit-test, drag, mask, or animation coordinate spaces.

# 9. Component / Module Walkthrough

`useDialogFocusRestoration` captures the active connected element when a dialog opens, focuses the supplied initial-action ref, and restores the opener during cleanup only when it remains connected. `corsPolicy.js` owns the default local-origin set, parses `KCS_CORS_ORIGINS`, rejects widening or malformed forms, and returns Express CORS options that continue to allow origin-less clients. Existing dialog key traps, server routes, SQLite initialization, and toolchain configuration remain the consumers.

# 10. Important Code Changes

The focus hook centralizes a lifecycle that had been missing from two dialogs. The CORS parser fails startup on invalid configuration instead of silently weakening the browser boundary. The SQLite database remains created by the existing server path; Git simply stops treating that generated state as source. Toolchain upgrades required no compatibility shim or production fallback.

# 11. Public Interfaces

- New internal hook: `useDialogFocusRestoration(isOpen, initialFocusRef)`; no public package API changed.
- New server exports in `server/corsPolicy.js` support policy tests and server wiring.
- New environment variable: `KCS_CORS_ORIGINS`, a comma-separated list of exact `http(s)` origins.
- No API endpoint, response schema, saved-project format, or component public prop changed.

# 12. Algorithms and Geometry

No geometry algorithm changed. CORS parsing is linear in the number of configured origin tokens and validates each token with `URL`. Focus restoration performs constant-time DOM checks and focus operations per dialog lifecycle.

# 13. Interaction / UX Behavior

Before: closing either affected dialog could leave keyboard focus without a useful destination. After: Cancel, Confirm, and `Escape` return focus to a still-connected opener; a removed opener is ignored safely. The dialog's existing initial Cancel focus and focus trap remain intact. No other interaction changed.

# 14. Design Decisions

- Reuse one focus-lifecycle hook rather than duplicate effects in dialogs.
- Make the non-focusable template delete span a real button so restoration has a valid target.
- Keep CORS as a browser response policy, not pretend it is authentication; disallowed-origin requests can still receive an HTTP response, but browsers receive no allow-origin header.
- Reject malformed CORS configuration at startup rather than fall back to a wider policy.
- Preserve intentional React synchronization patterns with narrow comments instead of broad rule disables or behavioral rewrites.
- Upgrade Vitest and its coverage provider together to satisfy the exact peer contract.

# 15. Invariants That Must Be Preserved

- Dialog key traps and Escape ownership remain unchanged.
- Focus restoration never targets a disconnected element.
- Origin-less CLI/server clients remain supported.
- CORS never substitutes for authentication; wider network bind still requires explicit `KCS_API_HOST`.
- The SQLite file is runtime state, not a fixture or migration authority.
- Oxlint suppressions remain line-specific and rationale-bearing; no global or file-wide rule disable.
- TypeScript project references continue to be checked with `tsc -b`.
- H7 remains HOLD until a new explicit release instruction.

# 16. Testing and Verification

- Dialog task: 43 focused tests; full suite 127 files / 1,942 tests; TypeScript, lint, build; actual browser focus smoke; CI run `36314400055` PASS.
- SQLite task: first-start API generation and seed proof; health and projects endpoints; 12 focused tests; full suite 127 / 1,942; build, lint, state check; CI `36314754294` PASS.
- CORS task: 21 focused tests; actual allowed, disallowed, origin-less, opt-in, and malformed-startup API runs; full suite 128 / 1,951; TypeScript, lint, build, state check; CI `36315091917` PASS.
- Oxlint task: focused 4 files / 22 tests; full suite 128 / 1,951; lint plus unused-disable reporting at error severity; TypeScript, build, OGraf validation, state check, audit; CI `36315413652` PASS.
- Toolchain task: `npm ci`; TypeScript; lint; full suite 128 / 1,951; build; OGraf validation; release QA 2; browser specs 1 + 3 + 4; V6 QA 3; combined check; state check; audit 0; diff check; CI `36315904883` PASS.
- Documentation task: `node scripts/check-state-consistency.mjs` PASS (35 checks with the clean eight-document bundle); `git diff --check` PASS; exact stale-claim searches returned no matches; the changed-path guard returned no product, server, test, script, package, lockfile, or workflow path.

# 17. Manual QA Results

- PASS — actual confirmation dialog opened from a template delete button, initial Cancel focus observed, and `Escape` restored focus to the connected opener.
- PASS — clean SQLite first startup created a 28,672-byte database, initialized the health route, and returned the seed project.
- PASS — actual API responses carried the exact allow-origin header for allowed origins, omitted it for a disallowed origin, accepted origin-less requests, accepted an exact configured origin, and refused malformed startup configuration.

# 18. Regression Risk Assessment

- Focus lifecycle: LOW; shared hook is limited to two dialogs and covered across close paths and disconnected openers.
- SQLite hygiene: LOW; runtime generation was proven from a missing file.
- CORS: MEDIUM for custom browser deployments because they must list exact origins; this is the intended approved boundary and is documented.
- Oxlint: LOW; three direct fixes and deliberate narrow suppressions, with full regression coverage.
- Toolchain majors: MEDIUM inherent ecosystem risk, reduced by fresh install, full local gate, focused browser suites, and green Linux CI.

# 19. Performance Considerations

No measured runtime regression. Focus work occurs only on dialog lifecycle. CORS set lookup is constant-time after startup parsing. Removing the tracked SQLite file does not change database runtime work. Toolchain changes affect development and CI only.

# 20. Dependencies

- `oxlint`: `^1.85.0`, development lint tool, upgraded from the prior 1.74 lock.
- `typescript`: `~7.0.2`, development compiler, upgraded from 6.0.
- `vitest`: `^5.0.2`, development test runner, upgraded from 4.1.
- `@vitest/coverage-v8`: `^5.0.2`, aligned coverage provider, upgraded with Vitest.
- Vite 8.3.0 and `@vitejs/plugin-react` 6.1.1 remain unchanged.

# 21. Compatibility

Verified on Windows 11 with Node 24.18.0 and on the repository's Ubuntu GitHub Actions job. TypeScript 7, Vitest 5, Vite 8.3, React 19.3, jsdom 30.1, and the existing strict configurations work together. Saved projects, OGraf manifests, API payloads, and database schema remain backward compatible.

# 22. Known Limitations

- CORS is not authentication and does not protect the API from non-browser clients.
- CI does not run the focused browser suites automatically; those were run locally on Windows.
- `v1.1.0-rc.1` still targets the older workflow-tested commit by deliberate HOLD decision.
- GitHub Actions emits the two non-blocking platform migration annotations recorded above.

# 23. Technical Debt

Only the GitHub Actions runtime/platform annotations are identified by this maintenance run. Address them in a separate workflow task after checking available action majors and runner compatibility; do not mix them into release publication.

# 24. Git Summary

Implementation commits, all fast-forwarded to `main` and pushed:

- `5cb8a45` — `fix: restore focus after dialogs close`
- `b3f3c6c` — `chore: stop tracking runtime sqlite state`
- `2a313d7` — `fix: restrict api cors origins`
- `feca773` — `chore: adopt oxlint 1.85`
- `37904fb` — `chore: upgrade typescript and vitest majors`

Documentation branch: `docs/final-maintenance-reconciliation`. Documentation commit message: `docs: reconcile final maintenance state`. Integration policy: fast-forward only. No rebase, reset, force push, branch deletion, tag, release, or npm action.

# 25. Updated Project Tree

```text
server/
  corsPolicy.js                         [new]
src/
  hooks/useDialogFocusRestoration.ts    [new]
  tests/apiCorsPolicy.test.ts           [new]
  tests/dialogFocusRestoration.test.tsx [new]
reports/
  progress_150_final_maintenance_reconciliation.md [new]
chatgpt_handoff/
  CHATGPT_UPLOAD_ONEFILE.md             [rebuilt]
  latest/                               [clean rebuilt document bundle]
```

# 26. Self Review

Good: each task had isolated scope, observable proof, full regression coverage, fast-forward integration, and green CI. The final documents distinguish the historical release gate from the newer maintenance baseline and preserve H7. Could improve: CI browser coverage and action-runtime maintenance remain separate. Uncertainty: host-specific behavior outside the tested Windows and Ubuntu environments. Score: 9/10 because evidence is strong but release-host/browser coverage is intentionally not universal.

# 27. Next Recommended Task

Run one read-only final release-readiness audit against the reconciled `main`; do not publish, finalize, or retag.

# 28. Project Status

Milestones A–G are complete. Milestone H is complete through H6; H7 is held by user decision. All five post-hold maintenance tasks are complete and integrated through `37904fb`. The release tag, draft prerelease, private package version, and npm state are unchanged.

# 29. AI Development Notes

The focus hook is the authority for opener restoration in the two affected dialogs. `server/corsPolicy.js` is the authority for browser origin policy; route code must not grow ad hoc headers. `server/db/keyframe_studio.sqlite` is generated state. The narrow Oxlint comments document intentional React synchronization; replacing them requires behavior-level evidence. TypeScript and Vitest majors are an aligned baseline, not independent downgrade candidates.

## DO NOT CHANGE CASUALLY

- Do not broaden CORS with `*`, origin reflection, or silent malformed-config fallback.
- Do not re-track the runtime SQLite database.
- Do not restore focus without checking `isConnected`.
- Do not replace exact Vitest/coverage major alignment with a peer-invalid mix.
- Do not weaken or globally disable Oxlint rules to remove warnings.
- Do not move the release tag or publish the draft/package without explicit approval.

# 30. Lessons Learned

A small shared lifecycle hook is safer than repeating dialog focus effects. Runtime-created databases should not be repository fixtures unless explicitly designed as such. CORS configuration needs fail-closed parsing and precise documentation because it is often mistaken for authorization. Linter upgrades require classifying findings rather than either blindly refactoring or broadly disabling rules. Major toolchain compatibility is established by a fresh install plus the real build/test/browser gates, not by version metadata alone.

---

## 5. Next Session

# Next Session Handoff

## Repository state

- Checkout: `main` at or after `37904fb`, matching `origin/main` after the five-task maintenance run. The run closed dialog focus restoration (`5cb8a45`), runtime SQLite repository hygiene (`b3f3c6c`), the exact API CORS allowlist (`2a313d7`), Oxlint 1.85 adoption (`feca773`), and the aligned TypeScript 7 / Vitest 5 upgrade (`37904fb`). Milestones A–G remain complete, Milestone H remains complete through H6, and its release decision remains held (H7). The historical checkpoint `docs/checkpoints/2026-09-18-after-lottie-core/` remains unchanged.
- Milestone A (canvas tangent handles) is integrated into `main` by approved replay + fast-forward; `main` is a strict superset of its previous state
- Task 105 (export diagnostics UX) and Task 107 (track-matte source selection) are integrated by fast-forward; both are retained
- Checkout after the item 12 merge: `main` at or after `a4f8642` (the OGraf package import and its handoff refresh), matching `origin/main`
- Milestone D item 9 **Option B is merged into `main` at `73426e5`** (`reports/progress_130_dependency_maintenance_option_b.md`) and `main` matches `origin/main`
- The **`engines` declaration and the npm-12 `allowScripts` question are answered on `chore/engines-allow-scripts`** (`reports/progress_131_engines_allow_scripts.md`): `engines.node: "^22.22.2 || ^24.15.0 || >=26.0.0"` (the locked toolchain's supported intersection) plus a version-pinned `allowScripts` approval for `sqlite3@6.0.1`; `package-lock.json` mirrors only the root engine metadata and its dependency graph is unchanged (**merged into `main` at `1a12d79`**)
- Workflow-tested release code candidate (tag target): `46d2a3e59e065816d972dcd56951803951b577f6`
- Release tags: `v1.1.0-rc.1` (annotated) and `v1.1.0-public-controls`, both unchanged
- Branches kept: `feat/canvas-tangent-authoring` (Milestone A review artefact) and `feat/canvas-tangent-authoring-replay` (identical to `main`; deleting it needs approval)

## Current result

Milestones A–E are complete, and Milestone F item 10 is complete (all four slices merged):

- Milestone F item 10, first slice — **the Lottie import core is merged into `main`** at `ff32d6c` (base `06a5dfcf`, `--no-ff`, pushed; branch `feat/lottie-import-core` kept at `f76ae6a`): `importLottieDocument(text)` maps document timing, shape/solid/null layers, transforms, paths, primitives and fill/stroke/trim, applies the segment-to-keyframe easing rules, and reports every construct it does not convert through the loss-report contract. 37 contract cases; five independent read-only review rounds (BLOCKED, BLOCKED, BLOCKED, READY WITH WARNINGS, READY WITH WARNINGS) plus a merge-eligibility review of the last delta. The importer now has a user-facing entry point (`3b30bff`): the header offers a separate "Import Lottie" control that parses the document in memory, shows the report before anything is applied, and applies only on an explicit confirm.

- Milestone A — canvas tangent authoring (`077911b`): vertex selection shows Bezier handles on the stage, dragging reshapes the path live, one history entry per completed drag, `Escape` cancels.
- Milestone B — graph + keyboard accessibility (`96e8f9d`): named keyframe diamonds with a lane-local arrow walk, a labelled value graph with keyboard-editable points, decorative SVG hidden from assistive tech, focus rings.
- Milestone C — first export / onboarding (`c2dcb22`): opt-in "First export help" panel, readiness check reading the same OGraf diagnostics authority as the export, one shared compile path for readiness and both export actions.
- Milestone D item 6 — state consistency check (`b91e8b9`, CI follow-up `be76df9`): `node scripts/check-state-consistency.mjs`.
- Milestone D item 9 and its maintenance follow-ups are closed. Option A is merged at `3923141`, Option B at `73426e5`, `engines`/npm-12 `allowScripts` at `1a12d79`, `jsdom` 30.1.1 at `c1431db`, Oxlint 1.85 at `feca773`, and Option C (TypeScript 7 plus Vitest and `@vitest/coverage-v8` 5) at `37904fb`. The runtime SQLite file is ignored rather than tracked, API browser origins are exact by default, and the two remaining dialogs restore opener focus.

The release stance is unchanged: annotated tag `v1.1.0-rc.1` and a GitHub draft prerelease exist at the workflow-tested code candidate; nothing was published, finalized, or pushed to npm.

## Validation

On `main` at `37904fb`: TypeScript 7.0.2 and Vitest 5.0.2 pass `npx tsc -b --pretty false`, full Vitest (128 files / 1,951 tests), `npm run lint`, `npm run build`, `npm run validate:ograf`, `npm run qa:release` (2 Chromium tests), the export/Lottie/matte browser specs (8 tests), `npm run qa:v6` (3 tests), `npm run check`, `node scripts/check-state-consistency.mjs`, `npm audit` (0 vulnerabilities), and `git diff --check`. The five maintenance commits each have a green `main` CI run; the latest is `36315904883`.

## Next scoped work

1. **Milestone H remains HELD at H7.** H1–H6 are complete, the release artefacts remain at `46d2a3e`, and no tag, GitHub release, or npm publication action was taken.
2. The five maintenance tasks that followed the hold are complete: focus restoration, SQLite repository hygiene, the API CORS allowlist, Oxlint 1.85, and TypeScript 7 / Vitest 5 are merged with green CI.
3. Preserve the tag and draft prerelease. Publishing, finalizing, or re-tagging requires a new explicit user instruction.
4. The GitHub Actions Node 20 deprecation annotation and the announced `ubuntu-latest` migration to Ubuntu 26 are non-blocking workflow-maintenance warnings; they do not change the held release decision.

## Guardrails

- Do not reset, force-push, rebase, tag, or delete branches/reports. Integrate by fast-forward, or by an approved replay.
- Do not modify `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.
- Keep `.omp/config.yml`, model roles, provider mappings, task concurrency, and global tooling unchanged.
- Keep `origin/without-mask` untouched and classified ARCHIVE.
- Production draft is not published; publish/finalize requires further explicit user instruction.

## ChatGPT handoff policy

- `chatgpt_handoff/latest/` is a per-response, task-specific upload bundle: clean it first, then place only the files that this specific ChatGPT conversation needs.
- Preferred upload artifact: `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` is regenerated from scratch for each task/milestone. Before writing it, delete or overwrite the old file. Build it only from the current `chatgpt_handoff/latest/` bundle plus `latest/OMP_FINAL_RESPONSE.md`. Do not append old content, do not preserve previous task sections, and do not use it as an archive. If a historical handoff archive is ever needed, create a separate explicitly named archive file under `chatgpt_handoff/archive/` only after user approval. The default ChatGPT upload is always this one file.
- Handoff documents must state one current truth: never append a correction block on top of stale sections — rewrite the stale section instead.
- Never store flattened source or test copies there. Those copies are separate files, and the ones named `src__*test*` are picked up by the Vitest default include glob, which breaks CI.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset folder, not a handoff dump. Never copy the bundle there unless the user explicitly asks.
- Omitted files are never deleted from the repository; they simply are not part of the bundle.

## Milestone B merged — graph + keyboard accessibility

- Branch `feat/graph-accessibility` was fast-forward-merged into `main` at `96e8f9d0313cb81752c04fe58d6e7d00d700a6f4` (no merge commit, no rebase, no history rewrite).
- What it adds: timeline keyframe diamonds are named, focusable buttons (`Enter`/`Space` selects the keyframe and moves the playhead, `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order and are consumed at the ends); the value graph is a labelled group whose keyframe points are Tab-reachable and announced with frame and value, editable with the arrow keys; decorative SVG geometry is hidden from assistive technology; the selected-keyframe panel is a group scoped to its frame; focus rings were added for the diamonds and the graph points.
- Review: one focused round returned BLOCKED (3 findings, 6 documentation over-claims) — all closed; the re-review returned READY WITH WARNINGS.
- Validation: 109 files / 1,652 Vitest tests, `validate:ograf`, `qa:release`, build, TypeScript, lint, `git diff --check`, plus the real-browser spec `e2e/graph-accessibility.spec.ts`.
- Out of scope (unchanged): graph engine or evaluator changes, new shortcut registry, keyframe model or drag redesign, new dependencies, release/package/workflow changes.
- Roadmap status when this milestone landed: D was next (items 6 and 9) and C was merged. Current status: milestones A–G are complete, and Milestone H is complete through H6 with its release decision held (H7), see "Current result" above.

---

## 6. Project State

# KCS Project State

## Current position

The accepted product and security follow-up line is integrated into `main`, the grouped post-RC roadmap has completed milestones A–G, and `main` is at or after `37904fb`. Milestone F and the post-review correctness follow-up are complete. Milestone H is complete through H6 with its release decision held (H7). The subsequent five-task maintenance run is also integrated: dialog focus restoration (`5cb8a45`), runtime SQLite repository hygiene (`b3f3c6c`), the exact API CORS allowlist (`2a313d7`), Oxlint 1.85 adoption (`feca773`), and TypeScript 7 / Vitest 5 (`37904fb`).

Annotated tag `v1.1.0-rc.1` was created and pushed at workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`. The GitHub release exists as a draft prerelease; no npm publication occurred.

**Checkpoint `2026-09-18-after-lottie-core`** (`docs/checkpoints/2026-09-18-after-lottie-core/`) records the state it was written from: `main` stood at `47d3368a2b54…` then, the Lottie import core (Milestone F item 10, first slice) was merged with `--no-ff` at `ff32d6c` and pushed, and its branch `feat/lottie-import-core` is kept at `f76ae6a` as the review artefact. The checkpoint folder carries the summary (`README.md`), the tasklist (`TASKLIST.md`), a copy-paste next-session prompt (`RESUME_PROMPT.md`) and a machine-readable summary (`STATE.json`); the task record is `reports/progress_124_checkpoint_after_lottie_core.md`. The Milestone F study is merged (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`); **item 11 (evaluator profiling) is implemented** on `chore/evaluator-profiling-harness` as measurement only (`reports/progress_118_evaluator_profiling.md`), **item 12’s first step (validated import boundary)** is merged at `44218a6` (`reports/progress_119_kcs_import_boundary.md`), its **product half** (compatibility matrix executed as fixtures, the legacy migration report, and the autosave restore routed through the same boundary) is implemented on `feat/kcs-import-product-half` (`reports/progress_121_kcs_import_product_half.md`), and **item 10’s mapping design** is delivered in `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`; item 10’s **first implementation slice (the import core)** is **merged into `main`** at `ff32d6c` (`reports/progress_123_lottie_import_core.md`), its **second slice — layer masks + track mattes — is merged at `8670b2a`** (`reports/progress_125_lottie_mask_matte_slice.md`), its **third slice — text, image and precomp layers — is merged at `bda62cb`** (`reports/progress_126_lottie_text_image_precomp_slice.md`), and its **final slice — the import entry point with the report-before-replace UX — is merged at `3b30bff`** (`reports/progress_127_lottie_import_entry_report_ux.md`): a separate "Import Lottie" control parses the document in memory, shows blockers and losses before anything is applied, cancels as a true no-op, applies only on an explicit confirm through the existing project authority, and reconciles imported layer types onto existing KCS types the OGraf export accepts; item 10 is therefore complete. Milestone F item 10 is then complete apart from the follow-ups listed below.

- Task 105 (export diagnostics remediation UX): blocking OGraf export diagnostics carry a stable title, the failing layer or feature, and a concrete next step; warnings are grouped into one non-blocking notification; user-authored values are formatted at every construction site so machine paths, URL credentials/query, embedded payloads, and raw OS messages never reach a diagnostic, a thrown error, or a toast.
- Task 107 (track-matte source selection affordance): the matte source relation, whichever model holds it, is resolved by one shared helper that mirrors the rendered relationship, so the outliner indicator shows what the stage actually applies; the Track Matte V2 card keeps its self-excluded source list, `None` clearing, and field preservation, and unnamed layers fall back to their ids in both source pickers.
- **Milestone A (canvas tangent handle authoring) — MERGED.** Selecting a single freeform layer in edit mode shows its vertices on the stage; clicking a vertex reveals its Bezier tangent handles; dragging a handle reshapes the rendered path live; double-clicking a vertex toggles corner ↔ smooth with neighbour-derived symmetric handles. One history entry per completed drag; `Escape` cancels a drag without recording one.
  - Integration path: the original branch `feat/canvas-tangent-authoring` was reviewed across six rounds (final verdict `READY`, all five findings closed) and replayed onto current `main` as `feat/canvas-tangent-authoring-replay`, then fast-forward merged. No rebase, no merge commit, no force push, no history rewrite.
  - Not covered: vertex add/remove, multi-vertex transforms, keyboard nudging, handle constraints, boolean or trim-enabled freeform layers, broadcast mode.

The release tag `v1.1.0-public-controls` remains unchanged. The `without-mask` branch remains a preserved archive candidate.

## Accepted baseline

Public Controls V1, OGraf Package Export V2, host compatibility work, Windows path hardening, parent/broadcast hardening, SourcePath/filesystem hardening, mask/matte parity, deterministic OGraf fixture validation, the isolated release smoke gate, the export diagnostics remediation UX, the track-matte source selection affordance, and Milestone A canvas tangent handle authoring are present in the accepted main line. OMP tooling remains separate.

## Validation status (at the last reconciliation)

| Area | Status | Evidence |
|---|---|---|
| Full Vitest | PASS | 128 files / 1,951 tests on Vitest 5.0.2 |
| OGraf fixture validation | PASS | `npm run validate:ograf` — offline against the vendored closure |
| OGraf release smoke | PASS | `npm run qa:release`; 2 Chromium tests |
| Focused browser smoke | PASS | export onboarding (1), Lottie import report (3), and OGraf matte visual (4) |
| State consistency | PASS | `node scripts/check-state-consistency.mjs` |
| TypeScript | PASS | TypeScript 7.0.2; `npx tsc -b --pretty false` and the build/check paths pass |
| Lint | PASS | Oxlint 1.85.0 clean, including unused-disable reporting at error severity |
| Production build | PASS | Vite 8.3.0 production bundle |
| Dependency audit | PASS | `npm audit` reports 0 vulnerabilities |
| CI on `main` | PASS | maintenance commits `5cb8a45`, `b3f3c6c`, `2a313d7`, `feca773`, and `37904fb`; latest run `36315904883` |

## Post-review correctness follow-up (complete)

The full-project review's release-blocking findings are closed, one task at a time and one branch each: **H-01** at `0c19751`, **H-03/H-04/M-03** at `fc672f2`, **M-01/M-02/H-05** at `85c3929`, **H-02** at `ac3bda1`, **H-06** at `352d272`, **M-04** at `16e1610`, **M-05** at `2b0bba0`. The final correctness gate and finding map are in `reports/progress_141_astra_correctness_followup_summary.md`. Its later maintenance observations are now closed: the tracked runtime SQLite file at `b3f3c6c`, unrestricted browser CORS at `2a313d7`, and dialog opener focus restoration at `5cb8a45`.

## Milestone H — release readiness (COMPLETE — H1–H6 merged; H7 held)

The controlled release-readiness pass ran end to end and its evidence is `reports/progress_142_release_readiness_audit.md` (audit), `reports/progress_144_oxlint_1_85_triage.md` and `reports/progress_145_jsdom_30_1_triage.md` (the two dependency triages), `reports/progress_143_ci_typecheck_step.md` (the audit's one required fix) and `reports/progress_146_final_release_gate.md` (the gate).

- **Audit verdict:** READY WITH REQUIRED FIXES — one required item, and it was fixed: the CI step named "TypeScript Type Check" ran `npx tsc --noEmit`, which builds no referenced project and therefore checked no project file, so its green tick meant nothing. The step and the `check` script now run `npx tsc -b --pretty false` (151 project files), committed at `b4bf3c0`.
- **Option C (TypeScript 6→7, Vitest 4→5): closed after the hold** — TypeScript 7.0.2, Vitest 5.0.2, and `@vitest/coverage-v8` 5.0.2 are merged at `37904fb`; the full local gate and CI pass.
- **Oxlint 1.85: closed after the hold** — adopted at `feca773`. Three genuine findings were fixed; deliberate latest-ref and synchronization-effect patterns carry only line-specific suppressions with adjacent rationale.
- **`jsdom` 30.1.x: closed** — the bump was taken at `c1431db` with one test-only object-URL shim in `src/tests/setup.ts`; jsdom implements neither `createObjectURL` nor `revokeObjectURL`, and 30.1.1's Blob no longer carries what Node's implementation follows.
- **Final release gate: RELEASE READY WITH DOCUMENTED DEFERRALS** on clean `main` at `c1431db` — build, type check, 126 files / 1,934 tests, lint, `validate:ograf`, `qa:release` (2 Chromium), the Lottie/matte/export browser specs (8), `qa:v6` (3), `npm run check`, the state check (35 checks at that commit — the total scales with the number of live and bundle documents scanned, so a later count is not comparable), `npm audit` (0), `git diff --check`, and the API health plus the sqlite3 binding on this machine.
- **H6 — the live documents and the handoff are reconciled** at `5b68543` (`reports/progress_147_milestone_h_docs_handoff.md`), and the final handoff refresh for the held state followed it (`reports/progress_148_final_handoff_after_hold.md`). That merge changed documents only: the code delta between the gated `c1431db` and `5b68543` is empty.
- **H7 — the release decision: HELD by user decision.** No tag, release or npm action was taken. `v1.1.0-rc.1` still points at `46d2a3e59e065816d972dcd56951803951b577f6`, the GitHub release is still a draft prerelease, the package is private at `1.1.0-rc.1`, and nothing was published. The decision is no longer open — it is a hold — and a future release still needs explicit user instruction.
- **Post-hold maintenance:** the five approved maintenance tasks are merged and green through `37904fb`; they do not alter H7, move the tag, publish the draft, or publish npm.

## Remaining work

- Grouped roadmap execution plan: `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`; roadmap items 1 and 2 are completed, and **Milestone A is merged**.
- **Milestone B (graph + keyboard accessibility, item 4) — MERGED** at `96e8f9d`: the timeline keyframe diamonds are named keyboard buttons with a lane-local arrow walk, the value graph exposes a labelled group with keyboard-editable points, decorative SVG geometry is hidden from assistive tech, and focus rings were added. One review round returned BLOCKED (3 findings, 6 over-claims), all closed; the re-review returned READY WITH WARNINGS.
- Milestones A–G and H1–H6 are complete. The release decision H7 remains held. The maintenance follow-ups previously listed as deferred or open are closed through `37904fb`: dialog focus restoration, SQLite repository hygiene, the API CORS allowlist, Oxlint 1.85, and TypeScript 7 / Vitest 5. No further package, workflow, tag, release, or npm action is implicit; each requires explicit approval.
- Publish/finalize the GitHub draft only with further explicit user instruction.
- No npm publication occurred; package remains private at `1.1.0-rc.1`.
- Branch cleanup needs approval: `feat/canvas-tangent-authoring-replay` is identical to `main` and can be deleted whenever the user approves; `feat/canvas-tangent-authoring` is kept as the Milestone A review artefact.

## ChatGPT handoff policy

- `chatgpt_handoff/latest/` holds a minimal, task-specific upload bundle, refreshed for each ChatGPT response instead of accumulating context files.
- `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` is regenerated from scratch for each task/milestone. Before writing it, delete or overwrite the old file. Build it only from the current `chatgpt_handoff/latest/` bundle plus `latest/OMP_FINAL_RESPONSE.md`. Do not append old content, do not preserve previous task sections, and do not use it as an archive. A historical handoff archive, if ever needed, is a separate explicitly named file under `chatgpt_handoff/archive/` and only after user approval.
- Every handoff document states one current truth: a correction is never appended on top of a stale section — the stale section is rewritten.
- Flattened source and test copies must not live there: the Vitest default include glob picks up files named `src__*test*`, which failed CI runs `35094144225` and `35095655446`.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination.

## Protected state

- The current main documentation commits are intentionally newer than the tag target; the tag remains on the workflow-tested code candidate.
- `v1.1.0-public-controls` remains unchanged.
- `origin/without-mask` remains untouched and classified ARCHIVE.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, task concurrency, and global OMP configuration remain unchanged.
- Candidate package version is `1.1.0-rc.1`; package remains private and unreleased.

## Milestone B merged — graph + keyboard accessibility

- Branch `feat/graph-accessibility` was fast-forward-merged into `main` at `96e8f9d0313cb81752c04fe58d6e7d00d700a6f4` (no merge commit, no rebase, no history rewrite).
- What it adds: timeline keyframe diamonds are named, focusable buttons (`Enter`/`Space` selects the keyframe and moves the playhead, `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order and are consumed at the ends); the value graph is a labelled group whose keyframe points are Tab-reachable and announced with frame and value, editable with the arrow keys; decorative SVG geometry is hidden from assistive technology; the selected-keyframe panel is a group scoped to its frame; focus rings were added for the diamonds and the graph points.
- Review: one focused round returned BLOCKED (3 findings, 6 documentation over-claims) — all closed; the re-review returned READY WITH WARNINGS.
- Validation: 109 files / 1,652 Vitest tests, `validate:ograf`, `qa:release`, build, TypeScript, lint, `git diff --check`, plus the real-browser spec `e2e/graph-accessibility.spec.ts`.
- Out of scope (unchanged): graph engine or evaluator changes, new shortcut registry, keyframe model or drag redesign, new dependencies, release/package/workflow changes.
- **Milestone D item 6 — state consistency check — MERGED** at `b91e8b9` (follow-up `be76df9`): `node scripts/check-state-consistency.mjs` fails when the live docs contradict the tag/`main` SHA, when the roadmap and the next action disagree, when the handoff upload instruction is superseded, or when the bundle carries source/test/binary copies, collapsed Windows paths or secret markers (see `reports/progress_111_state_hygiene_gate.md`).
- **Item 9 (dependency and warning maintenance) — COMPLETE.** Option A merged at `3923141`; Option B merged at `73426e5` and brought `npm audit` to zero; `engines`/npm-12 `allowScripts` merged at `1a12d79`; `jsdom` 30.1.1 was taken at `c1431db`; Oxlint 1.85 was adopted at `feca773`; and TypeScript 7 plus Vitest and `@vitest/coverage-v8` 5 merged at `37904fb`.
- The original Option A preserved dependency versions while fixing the warning catalogue and local sqlite3 binding. Its approval-gated follow-ups were then handled on isolated branches with their own validation. The runtime database is now ignored rather than tracked, and the API starts from a clean checkout by creating and seeding it through the existing SQLite authority.

---

## 7. Grouped Roadmap

# KCS Grouped Roadmap Execution Plan

Orchestrator close-out for the grouped post-RC roadmap run. Milestones A–G are complete. Milestone H is complete through H6 and its release decision remains held at H7. The later approved maintenance run closed dialog focus restoration (`5cb8a45`), runtime SQLite repository hygiene (`b3f3c6c`), the API CORS allowlist (`2a313d7`), Oxlint 1.85 (`feca773`), and TypeScript 7 / Vitest 5 (`37904fb`) without moving any release artefact.

## Milestone map and status

| Milestone | Roadmap items | Branch | Status |
|---|---|---|---|
| A — Canvas path authoring UX (tangent handles) | 3 | `feat/canvas-tangent-authoring` (replayed as `feat/canvas-tangent-authoring-replay`) | **MERGED** — five review findings closed across six rounds (final verdict READY), fast-forward merged into `main` |
| B — Graph + keyboard accessibility | 4 | `feat/graph-accessibility` | **MERGED** — one review round returned BLOCKED (3 findings, 6 over-claims), all closed; re-review returned READY WITH WARNINGS; fast-forward merged at `96e8f9d` |
| C — First export / onboarding flow | 5 | `feat/export-onboarding` | **MERGED** — six review rounds; final gate verdict READY WITH WARNINGS; fast-forward merged into `main` at `c2dcb22` |
| D — State / CI / warning hygiene | 6, 9 | `chore/state-hygiene-gate`, dependency/toolchain maintenance branches | **COMPLETE** — the state checker, Option A, Option B, `engines`/npm-12 `allowScripts`, `jsdom` 30.1.1, Oxlint 1.85, and TypeScript 7 / Vitest 5 are merged. The later maintenance run also removed the runtime SQLite database from tracking, restricted API browser origins, and restored dialog opener focus. Latest maintenance commit: `37904fb` |
| E — OGraf QA / schema hardening study | 7, 8 | `docs/milestone-e-ograf-qa-study`, `chore/ograf-offline-schema-closure`, `test/ograf-folder-qa-automation` | **COMPLETE** — study and plan delivered (`docs/design/KCS_MILESTONE_E_OGRAF_QA_STUDY.md`, `reports/progress_114_ograf_qa_study.md`); **item 7 (7-A) implemented and merged** on `chore/ograf-offline-schema-closure` (`reports/progress_115_ograf_offline_schema_closure.md`) and **item 8 implemented and merged** on `test/ograf-folder-qa-automation` (`reports/progress_116_ograf_folder_qa.md`), integrated at `22335a5` with green CI. **Plan only** for anything beyond those two approved scopes |
| F — Interop design and its approved slices | 10, 11, 12 | `docs/milestone-f-interop-study` | **COMPLETE** — the study is delivered (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`, `reports/progress_117_interop_study.md`): item 10 Lottie mapping contract, item 11 evaluator profiling plan, item 12 editable-KCS-import product/security plan. **Plan only** for every slice that has not been approved yet. **Item 11 approved and implemented** on `chore/evaluator-profiling-harness` (`reports/progress_118_evaluator_profiling.md`): deterministic scenes, an on-demand harness and a first baseline; measurement only, no caching. **Item 12 first step implemented** on `fix/kcs-import-boundary-hardening` (`reports/progress_119_kcs_import_boundary.md`): a validated import boundary with stable refusal codes and limits; item 10 is designed in `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`, and **item 10's first implementation slice (the Lottie import core) is merged at `ff32d6c`** (`reports/progress_123_lottie_import_core.md`); its **second slice (layer masks + track mattes) is merged at `8670b2a`** (`reports/progress_125_lottie_mask_matte_slice.md`), its **third slice (text, image and precomp layers) is merged at `bda62cb`** (`reports/progress_126_lottie_text_image_precomp_slice.md`), and its **final slice (the import entry point with the report-before-replace UX) is merged at `3b30bff`** (`reports/progress_127_lottie_import_entry_report_ux.md`) — **item 10 is complete**; **item 12 is complete and merged** (the unified import entry with its handoff refresh at `a4f8642`, the OGraf package/editable import at `419fc6a`); and **item 9 Option B** (dependency maintenance) is merged into `main` at `73426e5`. Checkpoint `2026-09-18-after-lottie-core` |
| G — Post-review correctness follow-up | review findings H-01…M-05 | one branch per task (`fix/modal-shortcut-isolation`, `fix/import-serialization-transaction-integrity`, `fix/lottie-structure-correctness`, `fix/ograf-inverse-alpha-matte`, `fix/api-network-trust-boundary`, `fix/evaluator-profile-fixtures`, `fix/state-consistency-live-docs`) | **COMPLETE** — the full-project review's release-blocking findings, taken one at a time: each gets its own branch, its own validation, a read-only self-review and an approval-gated fast-forward merge. H-01 (blocking dialogs left the editor's global commands live) is merged at `0c19751`; H-03/H-04/M-03 (import boundary validation, the track authoring-state round-trip and the document transaction) at `fc672f2`; M-01/M-02/H-05 (Lottie parent resolution, static hierarchy and multi-geometry loss) at `85c3929`; H-02 (the OGraf inverted track matte) at `ac3bda1`; H-06 (the unauthenticated API bound to every interface) at `352d272`; M-04 (the evaluator profile fixtures) at `16e1610`. **M-05** (the live-document reconciliation) is merged at `2b0bba0`, and the shallow-checkout CI regression it caused was fixed at `dcbf9f5`, and the final correctness gate ran on `main` after that fix (`reports/progress_141_astra_correctness_followup_summary.md`): every finding is closed. |
| H — Release finalization and approval-gated maintenance | review follow-up decisions | Milestone H branches plus the five maintenance branches | **NEXT (held)** — **H1–H6 are COMPLETE** and the post-hold maintenance tasks are merged through `37904fb`. **H7 = HOLD** by user decision: no tag, release, or npm action; artefacts stay at `46d2a3e`. This row keeps the plan's single NEXT marker because the only remaining plan decision is a future explicitly authorized release action. |

Completed earlier: item 1 (export diagnostics remediation UX, Task 105), item 2 (track-matte source selection affordance, Task 107).

## Milestone A — the blocker list that was closed (historical record)

From `reports/progress_108_canvas_tangent_authoring.md` §7:

1. Normalize legacy points in `resolveFreeformPath` (`normalizeClosedPoints`) to match the contract.
2. Complete the §7 selection model: handle-selection state, empty-canvas "clear overlay selection only", and resetting the overlay selection when the selected layer changes.
3. Restrict the Escape listener to the drag lifetime and close the batch deterministically for a pointerdown-then-Escape with no move.
4. Build the contract's verification matrix: real-origin coordinate parity under rotation/non-uniform/negative scale; behaviour tests for every `StageCanvas` eligibility guard (extract the guard list into a pure predicate so it is testable); canonical-path priority; real `useHistory` undo/redo/cancel entry counts; serialization/import round-trip of a materialized path; OGraf byte-parity for an untouched canonical path; one manual editor smoke.
5. Decide the smooth-handle-at-anchor edge: dragging a handle exactly onto its anchor must not silently collapse the counterpart (`Math.hypot(...) || 1`).

All five items were closed, the focused re-review and its follow-up rounds returned READY, and the milestone was replayed and fast-forward merged into `main` (`077911b`) with a green CI run. This list is history, not open work.

## Milestone B — Graph + keyboard accessibility (roadmap item 4)

- Scope: keyboard reachability and screen-reader labelling for graph/path editing surfaces that already exist (`TemporalGraphPanel`, keyframe rows, selected-keyframe sections).
- Constraints: no graph engine rewrite, no broad style churn, reuse existing graph/value/channel authorities.
- Validation: focused keyboard/a11y tests, one Playwright smoke, full suite, independent review.
- Gate: stop if the work grows beyond narrow UI/accessibility.

## Milestone C — First export / onboarding flow (roadmap item 5)

- Scope: a short "first successful OGraf export" path for new users, reusing the Task 105 diagnostics, existing templates, and the existing export UI.
- Constraints: no host/vendor contract invention, no package format change, no `Desktop\KCS` interaction.
- Validation: onboarding/sample fixture tests, `qa:release`, full suite, independent review.

## Milestone D — State / CI / warning hygiene (roadmap items 6, 9)

- Item 6 (current-state consistency check) is a documentation/tooling task: a small script or CI check that fails when live docs contradict the tag/main SHA. No gate beyond normal review.
- Item 9 and its approved follow-ups are complete: Option A (`3923141`), Option B (`73426e5`), `engines`/npm-12 `allowScripts` (`1a12d79`), `jsdom` 30.1.1 (`c1431db`), Oxlint 1.85 (`feca773`), and TypeScript 7 / Vitest 5 (`37904fb`).

## Milestone E — OGraf QA / schema hardening study (roadmap items 7, 8)

- Item 7 (offline schema closure): **7-A approved and implemented** — the eight pinned documents (33,567 B) are vendored under `fixtures/ograf/schema/` with both upstream notices in `NOTICE.md`; `npm run validate:ograf` is offline and deterministic by default and verifies every pin, `--online` is the refresh path, and the existing CI step needed no change. Evidence: `reports/progress_115_ograf_offline_schema_closure.md`.
- Item 8 (downstream folder QA automation): **approved and implemented** — the generator, the ZIP/folder comparison and the host-limited report live on `test/ograf-folder-qa-automation` and reuse the canonical compiler and path-safety authorities, with the QA root as an explicit required argument. Evidence: `reports/progress_116_ograf_folder_qa.md`.

## Milestone F — Interop design and its approved slices (roadmap items 10, 11, 12)

The deliverables are the study, the Lottie import mapping design and the editable-KCS-import plan; implementation runs slice by slice, each slice behind its own approval. The study is delivered (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`) and fixes each deliverable contract; **item 11 is implemented** (`perf/sceneBuilder.ts`, `perf/evaluator-profile.perf.ts`, `src/tests/evaluatorProfileScenes.test.ts`, `reports/progress_118_evaluator_profiling.md`) as measurement only — no caching, no threshold; **item 12’s first step (validated import boundary) is implemented** (`src/utils/importValidation.ts`, `reports/progress_119_kcs_import_boundary.md`), its **product half** (compatibility matrix, migration report, autosave through the boundary) on `feat/kcs-import-product-half` (`reports/progress_121_kcs_import_product_half.md`), and **item 10’s mapping design is delivered** (`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`, `reports/progress_120_lottie_mapping_design.md`) with its four open questions settled by the user, and its **first implementation slice (the import core)** is **merged into `main` at `ff32d6c`** (`reports/progress_123_lottie_import_core.md`): document timing, shape/solid/null layers, transforms, shapes and the segment-to-keyframe easing rules, with every unconverted construct reported; its **second slice (layer masks + track mattes)** is merged at `8670b2a` (`reports/progress_125_lottie_mask_matte_slice.md`) with the 8-mask limit restored, its **third slice (text, image and precomp layers)** is merged at `bda62cb` (`reports/progress_126_lottie_text_image_precomp_slice.md`), and its **import entry point with the report-before-replace UX** is merged at `3b30bff` (`reports/progress_127_lottie_import_entry_report_ux.md`), **item 12's unified import entry is merged** (`reports/progress_128_unified_import_entry.md`) — one control that classifies by content and keeps the existing `.kcs`, legacy and OGraf routing — and its **OGraf package/editable import** is merged into `main` at `419fc6a` (`reports/progress_129_ograf_editable_import.md`), with the handoff refresh at `a4f8642`; **no further implementation without a separate explicit approval**, and the design gate in §Approval gates applies before any code. The historical checkpoint `2026-09-18-after-lottie-core` records the state after the first slice only.

## Approval gates

- Package/lockfile/workflow/dependency changes: explicit user approval required before editing.
- Release/tag/draft-release/npm: explicit user approval required; unchanged by this run.
- Interchange work (Lottie, editable KCS import): design approval before code.
- Any milestone that grows into a broad refactor: stop and report.

## Handoff policy (unchanged)

`chatgpt_handoff/latest/` is a minimal, task-specific bundle: `README.md`, `manifest.txt`, the current report(s), `NEXT_SESSION.md`, `PROJECT_STATE.md`, and optionally the directly relevant contract/plan docs. Never source or test files — flattened copies named `src__*test*` matched Vitest's include glob and broke CI in runs `35094144225`/`35095655446`. Never copy the bundle into `C:\Users\ertugrul.ak\Desktop\KCS`.

## Recommended next prompt

"KCS RELEASE FINALIZATION (Milestone H, approval-gated — currently HELD). Milestone H is complete through H6, and the five approved post-hold maintenance tasks are merged with green CI through `37904fb`: dialog focus restoration, runtime SQLite repository hygiene, the exact API CORS allowlist, Oxlint 1.85, and TypeScript 7 / Vitest 5.

The release decision H7 remains a HOLD. `v1.1.0-rc.1`, the GitHub draft prerelease, and the private package metadata are unchanged at `46d2a3e59e065816d972dcd56951803951b577f6`; nothing was published. A future publish, finalization, or re-tag remains a separate explicit decision."

Historical notes: "KCS MILESTONE A COMPLETION …" was carried out (five items closed, READY, replayed and fast-forward merged at `077911b`); "KCS MILESTONE B — GRAPH + KEYBOARD ACCESSIBILITY …" was carried out (merged at `96e8f9d`); "KCS MILESTONE C — FIRST EXPORT / ONBOARDING FLOW …" was carried out: implemented on `feat/export-onboarding`, gate-reviewed (READY WITH WARNINGS) and fast-forward merged at `c2dcb22` (see `reports/progress_110_export_onboarding.md`).

---

## 8. Changelog

# Changelog

All notable changes to **Keyframe Character Studio** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- OGraf packages are importable: selecting the `.zip`/`.ograf` the exporter wrote opens a report and, on confirm, replaces the project with the scene the package carries. The archive is decoded in memory with entry-count, entry-size and package-path guards, prototype keys and unsafe, duplicate or reserved paths are refused, and a package without a scene is refused rather than half-imported.
- One import control in the header instead of several: the selected file is classified by what it **contains**, so a KCS project, a legacy project, an OGraf manifest and a Lottie animation all import through the same button, each with its existing behaviour (and the Lottie animation still showing its report before anything is replaced).
- A Lottie (bodymovin) import path: selecting a Lottie file parses it in memory and opens a report that lists the blockers and the losses with their source paths and next steps **before** anything is applied — Cancel leaves the project untouched, and only "Import and replace project" applies the scene through the same validated path the project import uses. Imported layers keep the shapes, text and images they had: a path, a rectangle, a rounded rectangle, an ellipse and a solid all become a freeform whose own path draws exactly the imported geometry, while text and images keep their existing KCS types — so an imported scene neither loses its curves nor risks an export refusal caused only by the layer type the importer picked.
- A state consistency check for the repository: `node scripts/check-state-consistency.mjs` fails when the live documents contradict the tag/`main` SHA, when the roadmap and the next action disagree, or when the handoff bundle carries a stale status, a superseded upload instruction, source/test copies, collapsed Windows paths or secret markers.
- A first-export path for new users: a labelled "First export help" panel next to Export lists the three steps, offers a readiness check that reports what would block an OGraf export (reusing the existing export diagnostics), and states that nothing is written until you export. The readiness answer is a pre-flight summary; a scene changed afterwards is recompiled when the export runs.
- The timeline keyframe diamonds are keyboard operable: each one is a named button in the tab order, `Enter`/`Space` selects the keyframe and moves the playhead (and selects the part on the parent lane), and `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order.
- The value graph's keyframe points are announced with their frame and value, and its decorative axes and curve stay out of the accessibility tree; the selected-keyframe panel is exposed as a group scoped to its frame.
- Bezier tangent handles can be authored directly on the stage: select a single freeform layer, click a vertex to reveal its handles, drag a handle to reshape the path live, and double-click a vertex to toggle corner ↔ smooth. Each drag is a single undo step and `Escape` cancels one without recording history.
- Track-matte source relationships are now visible in the outliner for both relationship models (`Mask → <source name>`), and unnamed layers fall back to their ids in the matte source pickers.
- The Track Matte V2 card's source select carries an accessible label.
- Actionable OGraf export diagnostics: every blocking diagnostic now reports a stable title, the failing layer or feature, the reason, and a concrete next step, and it never reports success while export is blocked.
- Non-blocking OGraf warnings are surfaced as a compact grouped notification instead of being silently dropped.
- Package materialization failures now carry stable failure codes; filesystem guidance states the trusted-directory requirement, the unsupported hostile-concurrency case, and avoids claiming perfect OS-level protection. Machine paths are reduced to a display-safe form.

### Changed
- The value and speed graphs are exposed as labelled groups instead of images, and focus rings were added for the timeline diamonds and the graph keyframe points.
- Freeform paths that only carry legacy `points` normalize a repeated closing vertex before the editing overlay materializes a canonical `path` on first edit; the legacy array itself is preserved.
- Matte relationship resolution went through one shared helper that mirrors the rendered result, so the outliner indicator and the stage agree for enabled, disabled, missing, and unusable sources.
- The project now declares the locked toolchain's supported Node runtime intersection (`^22.22.2 || ^24.15.0 || >=26.0.0`) and approves the `sqlite3` install step for npm 12 with a version-pinned entry, so a fresh install fetches that package's prebuilt native binding instead of silently leaving the API server without a database driver; the lockfile mirrors only the root engine metadata and its dependency graph is unchanged.
- `jsdom` moved 30.0.1 → 30.1.1, whose `Blob` no longer carries what Node's `URL.createObjectURL` follows; the test environment now defines the two object-URL functions itself instead of depending on that pairing, so a jsdom patch can no longer change test behaviour.
- Runtime and toolchain dependencies were refreshed within their current major versions (React 19.3, Vite 8.3, Vitest 4.1.11, lucide-react 1.47 and the test-library patches) on an isolated branch. `jsdom` was taken to 30.1.1 later with a test-environment object-URL shim, and Oxlint was subsequently adopted at 1.85 with narrow, documented suppressions only at deliberate React synchronization patterns.
- TypeScript moved from 6.0 to 7.0, and Vitest plus `@vitest/coverage-v8` moved from 4.1 to 5.0 as one aligned toolchain upgrade. Type checking, the 1,951-test suite, production build, release gate, browser smoke set, V6 QA, and CI all pass on the upgraded versions.
- The embedded SQLite fallback remains runtime-generated, but `server/db/keyframe_studio.sqlite` is no longer tracked; a clean checkout creates and seeds it on first API start.

### Fixed
- The CI step named "TypeScript Type Check" now checks the project: it ran `npx tsc --noEmit`, which builds no referenced project and therefore verified no project file, so a broken type could have merged behind a green tick. The step and the `check` script run `npx tsc -b --pretty false` (151 project files).
- The editor's global commands no longer reach project state while a blocking dialog is open: the shortcut handler now reads the dialog's own `aria-modal` contract, so `Delete`/`Backspace`, undo/redo, copy/paste, duplicate and the tool and zoom keys stay inert until the import report, the confirmation dialog or the naming dialog closes. Each dialog keeps `Escape` for itself, and the naming dialog now handles it at the dialog level (and declares the dialog contract it was missing) so it works from its buttons too.
- Confirmation and import-report dialogs now focus their initial action on open and restore focus to the connected opener after Cancel, Confirm, or `Escape`; removing the opener while the dialog is open remains safe.
- An imported scene is now checked against the values the renderers and the evaluator read, not only the fields the apply path touches: a scene version this build does not know, a frame rate or timeline length that is not a positive number, a canvas size that is not a positive number, a non-text `textValue`, a layer without a usable id or z-order, duplicate layer ids, a freeform path the geometry builder cannot walk, a mask without a path, a channel that is not a keyframe list and a keyframe value that is not a finite number are refused with a stable code and the offending path before any state is touched. The legacy `layerId` track shape and every documented default stay accepted.
- A track's `visible`, `editVisible` and `locked` flags and its sequence link are written on export and read back on import, so a muted, canvas-hidden or locked track no longer returns visible after a save/load round-trip. The generated track name, its colour and its expanded flag remain session state and are not persisted.
- Undoing an import now restores the whole document — frame rate, timeline length, canvas size, coordinate contract, scene title and active sequence — together with the layers, animation and sequences, instead of leaving the imported settings on top of the restored scene.
- A Lottie layer's parent is now resolved through the layer index it names (`ind`) rather than through the position of the layer in the array, so a document whose indexes are not sequential, or whose child precedes its parent, imports its hierarchy correctly. A reference no imported layer declares, a layer that names itself, and an index two layers share are reported instead of guessed.
- A Lottie layer that carries more than one geometry item is now reported instead of silently keeping only the last one: KCS draws one path per layer, so the import names what it cannot represent and still imports the layer.
- A layer with no animation track now inherits its parent transform. The hierarchy is resolved for every layer; only the keyframe evaluation is skipped, so a static child is no longer placed at its local position while the same child with an empty track was placed correctly.
- An inverted track matte in an exported OGraf graphic now actually inverts: it is expressed as a luminance mask with a white backdrop and the source painted black, the technique the editor's own matte authority documents, instead of an alpha mask whose black source stayed opaque and left the target unmatted. The inverted luminance matte had the same defect — it had no backdrop, so the mask was transparent everywhere outside the source — and both modes now share one construction. Text matte sources are painted black for the hole as well, instead of keeping their own colour and emitting a duplicate, ignored `fill` attribute. The generated runtime mirrors all of it.
- The REST API now binds `127.0.0.1` instead of every interface, so the unauthenticated project store is reachable from this machine only. Publishing it to a network is an explicit opt-in (`KCS_API_HOST`), and the server warns with what it published and how to undo it. `README.md` and `docs/API.md` state that the API has no authentication and that CORS is not access control.
- Browser access to the REST API now uses an exact local-origin allowlist by default. Additional origins require `KCS_CORS_ORIGINS`; wildcard, credential-bearing, path, query, fragment, `"null"`, and malformed entries fail startup instead of widening access.
- The evaluator profile harness now builds the workload it measures: its scenes carry a real `baseTransform` and real layer masks (the previous builder wrote `transform` and `layers`, which the evaluator never reads, behind a cast that hid both), and the harness verifies the built scene — layer, track, mask and parent counts, finite transforms and masks, and visible layers — before anything is timed. The report carries that verification, and `KCS_PROFILE_OUT` writes it to a file (Vitest rejects the `--out` flag the harness previously expected).
- The state consistency check now covers the live documents instead of four of them: `LIVE_DOCUMENTS` names the documents that describe the current state, a missing one fails the check, and two new rules catch a live document that claims the wrong checkout, puts `main` at another revision, or ties the release tag to another candidate. The closed-programme documents (`SESSION.md`, `docs/KCS_CURRENT_STATE.md`, `docs/KCS_OPEN_TASKS.md`, `docs/KCS_BRANCH_STATUS.md`) are marked as historical records and reconciled where they were live, the roadmap records milestone F as complete with the post-review follow-up as NEXT, and the release summary no longer repeats validation counts that go stale within a task.
- The post-review correctness follow-up is complete: every release-blocking finding from the full-project review is closed, one task at a time and one branch each, and the final correctness gate ran on `main` (`reports/progress_141_astra_correctness_followup_summary.md`).

### Release candidate `1.1.0-rc.1` (unreleased package metadata)
- Consolidates the accepted Public Controls, OGraf packaging, filesystem hardening, schema-validation, and release-smoke work.
- The Git tag and GitHub draft prerelease exist; this changelog entry remains under `[Unreleased]` because the package is private and was not published.

### Security
- Hardened prototype-sensitive imported OGraf keys, package paths, MIME lookups, and generated runtime maps.
- Hardened SVG input boundaries, source-path handling, output filesystem checks, hierarchy, broadcast state, and mask/matte parity.
- The `1.1.0-rc.1` candidate records accepted operational warnings for hostile-concurrency filesystem mutation and network-dependent schema validation.
- `npm audit` reports no known vulnerabilities: the six moderate advisories and the high `nanoid` advisory were resolved by a bounded `npm audit fix` (no `--force`) together with the refreshed dependency set.

---


## [1.0.0] - 2026-08-02

### Added
- **Motion Design Sequencer**:
  - Multi-track timeline hierarchy supporting track lock, eye visibility, and z-index ordering.
  - Precision keyframing engine for position (`x`, `y`), scale (`scaleX`, `scaleY`), rotation, and opacity at 60 FPS.
  - Interactive Cubic Bezier Easing editor with velocity curve presets and real-time canvas preview.
  - Sequence management tabs with inline double-click renaming and deletion safety.
- **Directional Transform Gizmo**:
  - 8-handle transform controls featuring 4 corner square handles for uniform scaling and 4 midpoint circle handles for single-edge directional stretching.
  - Trigonometric matrix math for directional single-edge resizing preserving fixed opposite edge world coordinates.
  - 360° interactive rotation handle.
- **Media & Shape Masking Engine**:
  - Dynamic vector geometric clipping masks supporting 6 geometries: Circle, Pill/Capsule, Star, Hexagon, Heart, and Rectangle.
  - Interactive crop positioning and custom text caption overlays.
- **Live Broadcast Director Panel (Reji Mode)**:
  - Zero-latency broadcast triggers for streaming tools (OBS Studio, vMix, NDI).
  - Individual and global `PLAY IN` / `PLAY OUT` transition animations.
  - Live broadcast stunts including Bounce, Pulse, Wobble, Spin 360, Shake, Float, and custom keyframe loops.
- **Dual Database Architecture**:
  - Production-ready PostgreSQL database with schema (`schema.sql`) and seed data (`seed.sql`).
  - Zero-config local embedded SQLite database fallback (`keyframe_studio.sqlite`).
  - Express 5 REST API backend providing `/api/projects`, `/api/presets`, and `/api/health` endpoints.
- **Testing & Quality Infrastructure**:
  - Vitest test suite featuring 21 unit and integration test files (62 tests).
  - Playwright end-to-end (E2E) workflow test suite (`e2e/workflow.spec.ts`).
  - TypeScript strict mode compilation and Oxlint linting integration.
  - Agent governance guidelines, project context specification, and domain-driven branch strategy (`.agents/`).
