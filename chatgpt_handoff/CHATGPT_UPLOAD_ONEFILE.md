# KCS ChatGPT One-File Handoff

---

## 0. Upload Instructions

- This file is always the latest current handoff.
- It is overwritten/rebuilt for every task; the previous file is deleted before writing.
- It is not an archive, and old task sections are never appended or preserved.
- It is generated only from `chatgpt_handoff/latest/` plus `latest/OMP_FINAL_RESPONSE.md`.
- Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT; the files in `chatgpt_handoff\latest` are its sources.
- The repository root is `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user project/asset workspace, not a handoff destination; nothing was copied there.
- `C:\Users\ertugrul.ak\Desktop\ograf-graphics` is untouched by this workflow.

---

## 1. OMP Final Response

# KCS Milestone D Item 9 — Option A Final Response (Warning Maintenance + SQLite Repair)

This file is the OMP final response for the Option A warning-maintenance task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** the approved **Option A** is implemented on branch `chore/warning-maintenance` (base `main` = `bb3cac9f61a60048f1fe9f0ae6ec69eabe46e1e4`), together with the approved **local SQLite repair (D9-1)**. It awaits the independent review and the user's merge decision.
- **Report:** `reports/progress_113_warning_maintenance.md` (what changed, per-item evidence, before/after warning table, validation matrix, protected invariants).
- **Nothing outside Option A changed:** no dependency was updated, and `package.json`, `package-lock.json`, `.github/workflows/**` are byte-identical to `main`.

## 2) WHAT CHANGED

| Item | Change | Evidence |
|---|---|---|
| W1 | New `src/context/useAnimator.ts` owns the context object and hook; `AnimatorContext.tsx` exports only the provider; 24 files migrated (16 source — 15 hook consumers plus the provider's context import — and 8 test files, including the `vi.mock` factories); `ToastPortal` reads `ToastItem` from its canonical module | `npm run lint`: no warning (was one Fast Refresh export warning) |
| W2 | `vite.config.ts` splits stable third-party groups (`react-vendor`, `icons`, `geometry`) via `build.rolldownOptions.output.codeSplitting` — no lazy imports, same module order | single 621.99 kB chunk (gzip 182.39) → app 382.19 kB (gzip 104.53) + react-vendor 189.64 + geometry 36.09 + icons 14.30; build emits no chunk-size advisory |
| W3 | `src/tests/setup.ts` returns `null` from `HTMLCanvasElement.getContext` (jsdom's own outcome without the log); for download links the click event is still dispatched (listeners and `preventDefault` keep working) while the link temporarily points at a same-document fragment and its href is restored in a `finally` block | full-run `grep -c "Not implemented"`: **0** (was 6: 3 canvas, 3 navigation); `src/tests/setupStubs.test.ts` pins the semantics in 5 cases |
| W4 | The `[appMode]` viewport effect needs no suppression (refs + stable setters only); the mouse-move callback now reads the later-declared `handleMouseUp` through a latest-ref, so its dependency array is complete | `npm run lint` clean; `npx tsc --noEmit` PASS; pointer paths exercised in a real browser |
| W5 | New `.gitattributes` (`* text=auto eol=lf` + binary guards) | scripted git runs no longer print the per-file CRLF warning |
| D9-2 | `scripts/check-state-consistency.mjs` fails an active claim that a roadmap item has not started / has not yet begun / is not implemented yet; four focused cases added to `src/tests/stateConsistencyCheck.test.ts` (three negative — one per variant — and one truthful-state guard) | checker PASS; the new cases pass (file total 29 tests) |
| D9-1 | npm 12 blocks `sqlite3`'s install script ("not covered by allowScripts"), so the NAPI prebuild was never extracted; ran the package's own install command inside `node_modules/sqlite3` | `require('sqlite3')` loads; `node server/index.js` serves `GET /api/health` → **200** |

## 3) VALIDATION

| Check | Result |
|---|---|
| `npm test` | PASS — 114 files / 1,700 tests (1,691 baseline + 4 D9-2 + 5 setup-stub cases); 0 jsdom "Not implemented" lines |
| `npm run lint` / `npx tsc --noEmit` | clean / PASS |
| `npm run build` | PASS — no chunk-size advisory |
| `npm run validate:ograf` / `npm run qa:release` | PASS / PASS (2 Chromium tests) |
| `node scripts/check-state-consistency.mjs` | PASS |
| `node server/index.js` + `curl /api/health` | PASS — HTTP 200 |
| `vite preview` + real browser | PASS — editor from the split chunks, layer authored, gizmo, inspector, timeline lane |

## 4) REVIEW

The branch is a source change, so it goes through the same independent read-only review gate as every previous milestone; the verdict is recorded in this section before the merge request is put to the user.

## 5) RELEASE SAFETY

- Tag `v1.1.0-rc.1` target `46d2a3e59e065816d972dcd56951803951b577f6`: unchanged. No tag, draft-release, or npm change.
- `package.json`, `package-lock.json`, workflows: unchanged. The exploratory `npm install-scripts approve sqlite3 --dry-run` wrote an `allowScripts` entry despite the dry-run flag; it was reverted immediately and the file is byte-identical to `main`.
- Still open by decision, not by defect: Option B updates, Option C majors, the `engines` declaration, the npm-12 `allowScripts` pin (without it a fresh install blocks the sqlite3 script again), Milestones E–F.

## 6) HANDOFF

- Bundle `chatgpt_handoff/latest/` was clean-refreshed for this task; upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.
- `NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md` in the bundle are copies of their root documents, compared after CRLF→LF normalization and a whole-document `trim()` by `node scripts/check-state-consistency.mjs`.

## 7) NEXT

One decision: approve the fast-forward merge of `chore/warning-maintenance` into `main` once the review passes. If no decision is given, nothing merges and no further work starts.

---

## 2. Handoff Manifest

# KCS ChatGPT Upload Manifest — Milestone D Item 9, Option A (Warning Maintenance + SQLite Repair)

Clean refreshed: YES
Bundle purpose: Milestone D item 9, Option A warning maintenance plus the local SQLite binding repair
Bundle scope: minimal and task-specific; this folder is not an archive

Branch: chore/warning-maintenance — one commit on top of main bb3cac9f61a60048f1fe9f0ae6ec69eabe46e1e4; awaiting independent review and the user's merge decision
Implementation report: reports/progress_113_warning_maintenance.md
Items implemented: W1 Fast Refresh split, W2 chunk splitting, W3 jsdom stubs, W4 dependency arrays, W5 .gitattributes, D9-2 checker rule, D9-1 local binding repair
Dependencies updated: NO (package.json, package-lock.json and workflows are byte-identical to main)
Warning status: 7 catalogued warnings — W1–W5 removed at the root, W6 by design, W7 environment-only
Backend: node server/index.js starts again; GET /api/health returned 200 after the repair
D9-1 refined root cause: npm 12 blocks sqlite3's install script ("not covered by allowScripts"); the Node 24 ABI is not involved
Still approval-gated: Option B updates, Option C majors, the engines declaration, the npm-12 allowScripts pin (without it a fresh install blocks the script again), Milestones E–F
v1.1.0-rc.1 tag target: 46d2a3e59e065816d972dcd56951803951b577f6 (unchanged)
Tag/release/npm changed: NO
GitHub release: existing draft prerelease, not published/finalized
npm publish: NO

Copied files (8):
- README.md — bundle instructions
- manifest.txt — this inventory
- OMP_FINAL_RESPONSE.md — the Option A final response
- progress_113_warning_maintenance.md — the implementation report
- KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md — roadmap plan (copy of the root document)
- CHANGELOG.md — changelog (copy of the root document)
- NEXT_SESSION.md — current state and next action (copy of the root document)
- PROJECT_STATE.md — project state (copy of the root document)

Omitted categories:
- Source, test, package.json, package-lock.json, ci.yml, release-smoke.yml files (the version split, the chunk config and the checker rule live in the repository)
- Older reports, design contracts, current-state/release documents
- QA output, zip files, asset folders, screenshots, archives, dependencies, secrets, caches

Omitted files were not deleted from the repository. Not copied and never touched: .git, secrets/env/API keys, backups, binary caches, `C:\Users\ertugrul.ak\Desktop\KCS`, `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.

Validation at this revision (each command run separately):
- npm test: PASS — 114 files / 1,700 tests; 0 jsdom "Not implemented" lines (was 6)
- npm run lint: clean (the Fast Refresh export warning is gone); npx tsc --noEmit: PASS
- npm run build: PASS — no chunk-size advisory (app 382.19 kB, react-vendor 189.64 kB, geometry 36.09 kB, icons 14.30 kB)
- npm run validate:ograf: PASS; npm run qa:release: PASS (2 Chromium tests, candidate SHA bb3cac9)
- node scripts/check-state-consistency.mjs: PASS
- node server/index.js + curl /api/health: PASS — HTTP 200
- vite preview + real browser: PASS — editor loads from the split chunks, layer authored, gizmo, inspector, timeline lane

Next: the independent review of branch chore/warning-maintenance, then the user's merge decision. If no decision is given, nothing merges and no further work starts.

Upload only chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md to ChatGPT. The files listed above are the sources of that one-file artifact.

---

## 3. Bundle README

# KCS Minimal ChatGPT Upload Bundle — Milestone D Item 9, Option A (Warning Maintenance + SQLite Repair)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

The approved **Option A** of the item-9 audit plus the approved **local SQLite repair**: W1 Fast Refresh split (`src/context/useAnimator.ts`), W2 real chunk splitting (no chunk above 500 kB), W3 jsdom canvas/navigation stubs, W4 honest dependency arrays with a latest-ref, W5 `.gitattributes`, D9-2 checker rule for item-level stale claims, and the D9-1 repair (`node_modules/sqlite3` binding extracted with the package's own install command, `/api/health` → 200). The refined D9-1 root cause is npm 12 blocking the `sqlite3` install script ("not covered by allowScripts"), not the Node 24 ABI.

No dependency was updated and `package.json`, `package-lock.json` and the workflows are byte-identical to `main`. The change is on branch `chore/warning-maintenance` and awaits its independent review and the user's merge decision.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_113_warning_maintenance.md` — the implementation report (per-item changes, evidence, before/after warnings, validation, invariants)
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap plan with the item-9 status
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md` are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source and test files are intentionally omitted. Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports, design contracts, release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.

---

## 4. Implementation Report

# Progress 113 — Warning Maintenance (Option A) and Local SQLite Binding Repair

## 1. Scope

Implements **Option A** of the item-9 audit (`reports/progress_112_dependency_warning_audit.md` §7) plus the **approved local repair of the SQLite binding (D9-1)**. Every item was approved by the user before implementation.

In scope: W1, W2, W3, W4, W5, D9-2, and the local `node_modules` binding repair.
Out of scope (unchanged, still approval-gated): the dependency updates of Option B, the major upgrades of Option C, the `engines` declaration, any `package.json`/`package-lock.json`/workflow edit, and Milestone E.

## 2. Branch

- Branch: `chore/warning-maintenance`, based on `main` at `bb3cac9f61a60048f1fe9f0ae6ec69eabe46e1e4`
- This is a source change, so the branch is reviewed by an independent agent before the merge request.

## 3. What changed

### W1 — Fast Refresh warning removed at its root

- New `src/context/useAnimator.ts` owns the `AnimatorContext` object and the `useAnimator` hook.
- `src/context/AnimatorContext.tsx` now exports `AnimatorProvider` (and the `AnimatorContextType` type) only; it imports the context object from the new module. The type-only import direction keeps the dependency acyclic at runtime.
- 24 files were migrated to the new hook module (16 source files — 15 hook consumers plus the provider's own context import — and 8 test files), including the `vi.mock` factories: mocks that supply `useAnimator` now target `../context/useAnimator`, mocks that supply the provider keep targeting `../context/AnimatorContext`.
- `src/components/Toast/ToastPortal.tsx` reads `ToastItem` from its canonical source (`src/hooks/useToast.ts`), so the provider module no longer re-exports it.
- Evidence: `npm run lint` reports **no** warnings (previously one at `AnimatorContext.tsx:651`).

### W2 — chunk-size advisory removed by splitting, not by raising the limit

- `vite.config.ts` declares `build.rolldownOptions.output.codeSplitting.groups` for three stable third-party groups: `react-vendor` (react/react-dom/scheduler), `icons` (lucide-react), `geometry` (polygon-clipping/fflate).
- No import became lazy and no module order changed, so runtime behaviour is identical; only the chunk boundaries moved, which also improves caching across releases.
- Evidence (before → after): single `index-*.js` **621.99 kB (gzip 182.39)** → `index-*.js` **382.19 kB (gzip 104.53)** + `react-vendor` 189.64 kB (gzip 59.65) + `geometry` 36.09 kB (gzip 13.09) + `icons` 14.30 kB (gzip 5.13) + runtime 0.56 kB. No chunk now exceeds the 500 kB threshold and `npm run build` emits no chunk-size advisory.

### W3 — jsdom noise removed in the test setup

- `src/tests/setup.ts` now replaces `HTMLCanvasElement.prototype.getContext` with a function that returns `null` (jsdom's own outcome, minus the "Not implemented" log). For download links (`download` attribute or `blob:`/`data:` href) the click event is still dispatched so listeners and `preventDefault` keep working, but the link temporarily points at a same-document fragment while the event is in flight — jsdom cannot navigate to the unreachable target, which is what produced the log — and the original `href` is restored in a `finally` block, so the element's observable state is unchanged. Ordinary anchors stay entirely on jsdom's native path.
- Why the canvas stub is behaviour-identical: the production text-measurement helper (`src/utils/bounds.ts:61`) already falls back when `getContext` returns null.
- The stub semantics are pinned by `src/tests/setupStubs.test.ts` (5 cases: canvas returns null; a download-link click reaches listeners and restores the href; a listener can cancel the event; a blob href without the `download` attribute follows the same path; an ordinary anchor keeps the native path).
- Evidence: the full suite previously printed **6** "Not implemented" lines (3 canvas from `ografPackage` / `presetConversion`, 3 navigation from the download flows in `presetExportImportUi` / `firstExportFlow`); after the change `grep -c "Not implemented"` on a full run returns **0** (verified again after this correction).

### W4 — the two `react-hooks/exhaustive-deps` suppressions are gone

- `src/components/Canvas/StageCanvas.tsx`: the `[appMode]` viewport-sync effect needed no suppression at all — it only closes over refs and stable state setters, so the comment was removed and lint stays clean.
- The mouse-move callback read the later-declared `handleMouseUp` and carried a suppression for that declaration cycle. It now reads the handler through `handleMouseUpRef` (a latest-ref published in an effect), so the dependency array is honest and complete with no cycle.
- Evidence: `npm run lint` is clean; `npx tsc --noEmit` passes; the pointer paths were exercised in a real browser (draw + drag + select) and by the canvas unit specs.

### W5 — line-ending noise removed

- New `.gitattributes` with `* text=auto eol=lf` plus explicit binary guards, so scripted git runs stop printing "LF will be replaced by CRLF" for every text file.

### D9-2 — the state checker now catches item-level stale claims

- `scripts/check-state-consistency.mjs` gained two `STALE_ACTIVE_PATTERNS` entries that fail an active claim that a roadmap item has not started / is not implemented yet (the exact class that survived a PASS before).
- `src/tests/stateConsistencyCheck.test.ts` gained four focused cases: three negative — "is not started", "has not yet begun" (`begun` is part of the first pattern) and "is not implemented yet" (the second pattern, previously untested) — and one guard, a truthful item-level status that must pass.
- `reports/progress_112_dependency_warning_audit.md` §12 is now headed "Independent review history (superseded states are quoted verbatim)", which is what it is — quoting superseded states — and is therefore exempt from the stale-claim scan by the checker's own rule.

### D9-1 — local SQLite binding repaired (root cause refined)

- **Refined root cause:** the binding was missing because **npm 12 blocks `sqlite3`'s install script** — `npm install-scripts ls` reported `sqlite3@6.0.1 (install: prebuild-install -r napi || node-gyp rebuild)` as "blocked because they are not covered by allowScripts" — so `npm rebuild sqlite3` was a no-op and the prebuilt NAPI archive stayed unused in the npm cache. The Node 24 ABI is still **not** involved (`sqlite3@6.0.1` ships NAPI v3/v6 prebuilds).
- **Repair performed:** ran the package's own install command inside `node_modules/sqlite3` (`node ../../node_modules/prebuild-install/bin.js -r napi`), which extracted the cached prebuild to `node_modules/sqlite3/build/Release/node_sqlite3.node`.
- **Evidence:** `require('sqlite3')` now loads; `node server/index.js` starts and `GET http://127.0.0.1:5000/api/health` returned **200**.
- **`package.json` stayed unchanged.** The exploratory `npm install-scripts approve sqlite3 --dry-run` wrote an `allowScripts` entry despite the dry-run flag; that unintended edit was reverted immediately (`git checkout -- package.json`) and the file is byte-identical to `main`. Consequence to record: **a fresh `npm install` on npm 12 will block that script again**, so either the `allowScripts` pin or an explicit re-extraction step has to be approved as its own change.

## 4. Validation matrix (branch `chore/warning-maintenance`)

| Check | Command | Result |
|---|---|---|
| Full unit/integration suite | `npm test` | PASS — 114 files / **1,700** tests (the 1,691 baseline + 4 D9-2 cases + 5 setup-stub cases) |
| jsdom noise | `npm test 2>&1 \| grep -c "Not implemented"` | **0** (was 6) |
| Lint | `npm run lint` | **clean** (was one Fast Refresh warning) |
| TypeScript | `npx tsc --noEmit` | PASS |
| Build | `npm run build` | PASS — no chunk-size advisory; largest chunk 382.19 kB |
| OGraf fixture | `npm run validate:ograf` | PASS |
| Release gate | `npm run qa:release` | PASS — 2 Chromium tests |
| State consistency | `node scripts/check-state-consistency.mjs` | PASS |
| Backend probe | `node server/index.js` + `curl /api/health` | PASS — HTTP 200 (repair verified) |
| Built-app smoke | `vite preview` + real browser | PASS — editor loads from the split chunks, layer drawn, transform gizmo, inspector, timeline lane |

**Provenance:** every command above was run on this branch's working tree; the release gate prints the candidate SHA it saw, and §3 of the handoff records that value. Because this report is itself edited after those runs, the gate is re-run on the source revision and the printed SHA is recorded in the handoff manifest rather than inferred.

## 5. Warning status after this task

| # | Warning | Status |
|---|---|---|
| W1 | Fast Refresh export warning | **Removed** (root cause fixed) |
| W2 | Vite chunk-size advisory | **Removed** (real splitting) |
| W3 | jsdom canvas/navigation noise | **Removed** (test setup) |
| W4 | Two `exhaustive-deps` suppressions | **Removed** (honest dependency arrays) |
| W5 | git CRLF noise | **Removed** (`.gitattributes`) |
| W6 | `e2e/**` outside the Vitest glob | Unchanged by design (documented) |
| W7 | `NO_COLOR`/`FORCE_COLOR` env warning | Unchanged (environment, not the repository) |

## 5b. Recorded residual risks

- **W4 latest-ref window:** the mouse-move callback reads the handler through a ref published in a passive effect. In the normal path the listener is installed only for the `isDragging` render, and that effect runs before the listener effect, so the current handler is always published in time. A theoretical gap remains between commit and the passive effect, during which the ref briefly holds the previous callback. No concrete regression was observed; the semantics moved from a stale closure to "read the latest handler at call time".
- **W2 is a caching boundary, not a smaller download:** every chunk is still eagerly loaded, so the bytes shipped on first load are effectively unchanged (622.78 kB across chunks versus 621.99 kB before, i.e. +0.79 kB of chunk overhead). The gain is cacheable boundaries plus the removal of the per-chunk size advisory.
- **The SQLite repair is `node_modules`-local:** a fresh `npm install` on npm 12 blocks the install script again until the `allowScripts` pin is approved.
- **`.gitattributes` rewrites working-tree line endings** on the next checkout/touch of tracked text files; that is the intended W5 effect.
## 6. Protected invariants

- `package.json`, `package-lock.json`, `.github/workflows/**` and `node_modules` dependency versions: unchanged. (The `node_modules` change is the repaired native binding only; the accidental `allowScripts` edit was reverted.)
- No dependency was updated; the outdated list and the `npm audit` findings from `progress_112` are untouched and still open.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, global OMP configuration, `C:\Users\ertugrul.ak\Desktop\KCS` and `ograf-graphics`: untouched.
- Runtime behaviour: unchanged — the only production-code changes are the module split, the latest-ref indirection and the build-time chunk grouping, each verified by the existing suite plus a real-browser smoke.

---

## 5. Next Session

# Next Session Handoff

## Repository state

- Checkout: branch `chore/warning-maintenance` (the approved Option A warning maintenance) on top of `main` at `bb3cac9f61a60048f1fe9f0ae6ec69eabe46e1e4`, which matches `origin/main`. `git log --oneline` on the branch is the authority for the current tip. The feature branches `feat/export-onboarding` and `chore/state-hygiene-gate` are retained as review artefacts.
- Milestone A (canvas tangent handles) is integrated into `main` by approved replay + fast-forward; `main` is a strict superset of its previous state
- Task 105 (export diagnostics UX) and Task 107 (track-matte source selection) are integrated by fast-forward; both are retained
- Workflow-tested release code candidate (tag target): `46d2a3e59e065816d972dcd56951803951b577f6`
- Release tags: `v1.1.0-rc.1` (annotated) and `v1.1.0-public-controls`, both unchanged
- Branches kept: `feat/canvas-tangent-authoring` (Milestone A review artefact) and `feat/canvas-tangent-authoring-replay` (identical to `main`; deleting it needs approval)

## Current result

Milestones A, B and C are merged into `main`, and Milestone D is the active milestone:

- Milestone A — canvas tangent authoring (`077911b`): vertex selection shows Bezier handles on the stage, dragging reshapes the path live, one history entry per completed drag, `Escape` cancels.
- Milestone B — graph + keyboard accessibility (`96e8f9d`): named keyframe diamonds with a lane-local arrow walk, a labelled value graph with keyboard-editable points, decorative SVG hidden from assistive tech, focus rings.
- Milestone C — first export / onboarding (`c2dcb22`): opt-in "First export help" panel, readiness check reading the same OGraf diagnostics authority as the export, one shared compile path for readiness and both export actions.
- Milestone D item 6 — state consistency check (`b91e8b9`, CI follow-up `be76df9`): `node scripts/check-state-consistency.mjs`.
- Milestone D item 9 — dependency and warning maintenance: **audited on `chore/dependency-warning-audit`, report only** (`reports/progress_112_dependency_warning_audit.md`). Nothing was installed, updated, or rewritten: `package.json`, `package-lock.json`, `.github/workflows/**`, source and tests are untouched. Recorded findings: 20 outdated rows over 21 package names (7 patch / 12 minor / 1 no-wanted-update; across two toolchain groups / three package names a newer major is available — `typescript` 6→7 and the Vitest pair `vitest` + `@vitest/coverage-v8` 4→5), `npm audit` 7 findings (6 moderate, 1 high; only `qs` and `undici` moderate in the production tree), 7 catalogued warnings, plus D9-1 (the REST API cannot start in this working copy because the NAPI `sqlite3` binding is missing from `node_modules`; the editor is API-independent and was verified live), D9-2 (the state checker does not catch stale item-level status claims) and D9-3 (`@types/node`'s `latest` tag is behind the installed major).

The release stance is unchanged: annotated tag `v1.1.0-rc.1` and a GitHub draft prerelease exist at the workflow-tested code candidate; nothing was published, finalized, or pushed to npm.

## Validation

Full Vitest (114 files / 1,700 tests), `npm run validate:ograf`, `npm run qa:release` (2 Chromium tests, candidate SHA `bb3cac9`), `npm run build`, `npx tsc --noEmit`, `npm run lint` (clean), `git diff --check`, `node scripts/check-state-consistency.mjs` and a live browser smoke (built app from `vite preview`: layer authoring, transform gizmo, inspector, timeline lane) all pass on `chore/warning-maintenance`. The seven catalogued warnings from the item-9 audit are resolved except the two that are not repository defects (W6 `e2e/**` outside the Vitest glob by design; W7 the environment `NO_COLOR`/`FORCE_COLOR` notice) — see `reports/progress_113_warning_maintenance.md`.

## Next scoped work

1. **Milestone D (item 9, Option A) — merge decision for `chore/warning-maintenance`**: the approved warning maintenance (W1 Fast Refresh split, W2 real chunk splitting, W3 jsdom stubs, W4 honest dependency arrays, W5 `.gitattributes`, D9-2 checker rule) plus the local SQLite binding repair are implemented and validated there (`reports/progress_113_warning_maintenance.md`). It merges by fast-forward once the independent review passes and the user approves the merge. Still open afterwards: Option B (7 patch + 12 minor updates + bounded `npm audit fix`, needs `package.json`/lockfile approval), Option C (TypeScript 7 / Vitest 5 majors on their own branch), the `engines` declaration, and an npm-12 `allowScripts` decision (without it a fresh install blocks `sqlite3`'s install script again). Milestones E–F stay plan-only and Option D (Milestone E planning) needs its own explicit approval.
2. Milestones E–F stay plan-only, and **D's dependency/package part (item 9) requires explicit user approval** before any `package.json`/lockfile work; all release/tag/draft-release changes need explicit approval.
3. Preserve the tag and draft release, and run an independent review before every merge.
4. Publish/finalize the GitHub draft only with further explicit user instruction.

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
- Next roadmap milestone: **D — state / CI / warning hygiene (items 6 and 9)**; Milestone C is merged.

---

## 6. Project State

# KCS Project State

## Current position

The accepted product and security follow-up line is integrated into main, and the grouped post-RC roadmap has completed milestones A, B, C and Milestone D item 6.

Annotated tag `v1.1.0-rc.1` was created and pushed at workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`. The GitHub release exists as a draft prerelease; no npm publication occurred.

Current `main` / `origin/main` is at `bb3cac9f61a60048f1fe9f0ae6ec69eabe46e1e4` (milestones A, B, C, Milestone D item 6, and the item-9 audit). The approved **Option A warning maintenance** is implemented on branch `chore/warning-maintenance` — W1, W2, W3, W4, W5 and the D9-2 checker rule are fixed there, and the local SQLite binding (D9-1) is repaired in this working copy (`GET /api/health` returns 200). `package.json`, `package-lock.json` and the workflows are still unchanged; the branch awaits merge approval.

- Task 105 (export diagnostics remediation UX): blocking OGraf export diagnostics carry a stable title, the failing layer or feature, and a concrete next step; warnings are grouped into one non-blocking notification; user-authored values are formatted at every construction site so machine paths, URL credentials/query, embedded payloads, and raw OS messages never reach a diagnostic, a thrown error, or a toast.
- Task 107 (track-matte source selection affordance): the matte source relation, whichever model holds it, is resolved by one shared helper that mirrors the rendered relationship, so the outliner indicator shows what the stage actually applies; the Track Matte V2 card keeps its self-excluded source list, `None` clearing, and field preservation, and unnamed layers fall back to their ids in both source pickers.
- **Milestone A (canvas tangent handle authoring) — MERGED.** Selecting a single freeform layer in edit mode shows its vertices on the stage; clicking a vertex reveals its Bezier tangent handles; dragging a handle reshapes the rendered path live; double-clicking a vertex toggles corner ↔ smooth with neighbour-derived symmetric handles. One history entry per completed drag; `Escape` cancels a drag without recording one.
  - Integration path: the original branch `feat/canvas-tangent-authoring` was reviewed across six rounds (final verdict `READY`, all five findings closed) and replayed onto current `main` as `feat/canvas-tangent-authoring-replay`, then fast-forward merged. No rebase, no merge commit, no force push, no history rewrite.
  - Not covered: vertex add/remove, multi-vertex transforms, keyboard nudging, handle constraints, boolean or trim-enabled freeform layers, broadcast mode.

The release tag `v1.1.0-public-controls` remains unchanged. The `without-mask` branch remains a preserved archive candidate.

## Accepted baseline

Public Controls V1, OGraf Package Export V2, host compatibility work, Windows path hardening, parent/broadcast hardening, SourcePath/filesystem hardening, mask/matte parity, deterministic OGraf fixture validation, the isolated release smoke gate, the export diagnostics remediation UX, the track-matte source selection affordance, and Milestone A canvas tangent handle authoring are present in the accepted main line. OMP tooling remains separate.

## Validation status

| Area | Status | Evidence |
|---|---|---|
| Full Vitest | PASS | 114 files / 1,700 tests |
| OGraf fixture validation | PASS | `npm run validate:ograf`; committed minimal fixture |
| OGraf release smoke | PASS | `npm run qa:release`; 2 Playwright tests (latest run at `bb3cac9` on `main`) |
| Real-browser milestone smoke | PASS | `e2e/graph-accessibility.spec.ts` and the live editor smoke with port 5000 closed (layer authoring, readiness check, real export) |
| State consistency | PASS | `node scripts/check-state-consistency.mjs` — 33 checks on this branch with its bundle, 34 on the earlier `main` run (the total scales with the number of bundle documents scanned) |
| TypeScript | PASS | `npx tsc --noEmit` and build typecheck |
| Lint | PASS | clean — the Fast Refresh warning was removed in `reports/progress_113_warning_maintenance.md` |
| Production build | PASS | no chunk-size advisory — split into 382.19 kB app + react-vendor/icons/geometry chunks (see `reports/progress_113_warning_maintenance.md`) |
| Independent review | IN REVIEW | Milestone A `READY` in round 6 of six rounds; the item-9 audit itself closed `READY WITH WARNINGS` in round 6 of six (`reports/progress_112_dependency_warning_audit.md` §12); the Option A warning-maintenance change is under its own review before any merge |
| CI on `main` | PASS | runs `35206117254` (Milestone A merge) and `35207913453` (state reconciliation) |

## Remaining work

- Grouped roadmap execution plan: `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`; roadmap items 1 and 2 are completed, and **Milestone A is merged**.
- **Milestone B (graph + keyboard accessibility, item 4) — MERGED** at `96e8f9d`: the timeline keyframe diamonds are named keyboard buttons with a lane-local arrow walk, the value graph exposes a labelled group with keyboard-editable points, decorative SVG geometry is hidden from assistive tech, and focus rings were added. One review round returned BLOCKED (3 findings, 6 over-claims), all closed; the re-review returned READY WITH WARNINGS.
- **Milestone C (first export / onboarding flow, item 5) — MERGED** at `c2dcb22` (final gate verdict READY WITH WARNINGS): an opt-in "First export help" panel, a readiness check that reads the same OGraf diagnostics authority the export reads, and one shared compile path used by the readiness check and both export actions. **Next: Milestone D (state / CI / warning hygiene, items 6 and 9)** — item 6 is merged; item 9 is audited (report only, `reports/progress_112_dependency_warning_audit.md`) and its approved **Option A is implemented** on `chore/warning-maintenance` (`reports/progress_113_warning_maintenance.md`), awaiting the merge decision. Option B, Option C, the `engines` declaration, the npm-12 `allowScripts` pin and the Option A–D alternatives stay approval-gated before any `package.json`, lockfile, or workflow change; E–F otherwise stay plan-only.
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
- **Item 9 (dependency and warning maintenance) — AUDIT COMPLETE, report only** (`reports/progress_112_dependency_warning_audit.md`): 20 outdated rows over 21 package names (7 patch / 12 minor / 1 no-wanted-update; across two toolchain groups / three package names a newer major is available — `typescript` 6→7 and the Vitest pair `vitest` + `@vitest/coverage-v8` 4→5), `npm audit` 7 findings (6 moderate, 1 high; only `qs` and `undici` are moderate in the production tree), and 7 catalogued warnings (Fast Refresh export warning, Vite chunk-size advisory at 621.99 kB / 182.39 kB gzip, jsdom canvas/navigation noise, two `react-hooks/exhaustive-deps` suppressions, CRLF noise, `NO_COLOR`/`FORCE_COLOR` env noise). Recorded environment findings: **D9-1** — the REST API does not start in this working copy because the NAPI `sqlite3` binding is missing from `node_modules` (`node server/index.js` exits 1 at module load; "Auto-Fallback / In-Memory Mode" is only the PostgreSQL health log, not a database fallback); the editor is API-independent and was verified live in a browser. **D9-2** — the item-6 state checker does not catch stale item-level status claims. **D9-3** — `@types/node`'s `latest` tag sits behind the installed major. No `package.json`, lockfile, workflow, source, or test change was made; **the next decision is Option A (source/test/docs-only warning fixes), Option B (patch/minor updates plus a bounded `npm audit fix`), Option C (TypeScript 7 / Vitest 5 majors on their own branch), or Option D (defer and start Milestone E)**, with the local `npm rebuild sqlite3` repair as a separate approval-gated item.

---

## 7. Current Roadmap Plan and Changelog

# KCS Grouped Roadmap Execution Plan

Orchestrator close-out for the grouped post-RC roadmap run. Milestone A was later completed, re-reviewed, and fast-forward merged into `main` (see `reports/progress_108_canvas_tangent_authoring.md`); milestone B was completed, re-reviewed, and fast-forward merged into `main` (see `reports/progress_109_graph_accessibility.md`); milestone C was completed, re-reviewed (final gate verdict READY WITH WARNINGS), and fast-forward merged into `main` (see `reports/progress_110_export_onboarding.md`); milestone D item 6 (state consistency check) was completed, re-reviewed, and fast-forward merged into `main` while item 9 stays behind an explicit approval gate (see `reports/progress_111_state_hygiene_gate.md`); milestones E–F remain plan-only.

## Milestone map and status

| Milestone | Roadmap items | Branch | Status |
|---|---|---|---|
| A — Canvas path authoring UX (tangent handles) | 3 | `feat/canvas-tangent-authoring` (replayed as `feat/canvas-tangent-authoring-replay`) | **MERGED** — five review findings closed across six rounds (final verdict READY), fast-forward merged into `main` |
| B — Graph + keyboard accessibility | 4 | `feat/graph-accessibility` | **MERGED** — one review round returned BLOCKED (3 findings, 6 over-claims), all closed; re-review returned READY WITH WARNINGS; fast-forward merged at `96e8f9d` |
| C — First export / onboarding flow | 5 | `feat/export-onboarding` | **MERGED** — six review rounds; final gate verdict READY WITH WARNINGS; fast-forward merged into `main` at `c2dcb22` |
| D — State / CI / warning hygiene | 6, 9 | `chore/state-hygiene-gate`, `chore/dependency-warning-audit`, `chore/warning-maintenance` | **NEXT** — **item 6 MERGED** (`node scripts/check-state-consistency.mjs`); **item 9 AUDITED, report only** (`reports/progress_112_dependency_warning_audit.md`) and **Option A IMPLEMENTED on `chore/warning-maintenance`** (W1, W2, W3, W4, W5, D9-2 + the local SQLite repair; `reports/progress_113_warning_maintenance.md`) awaiting the merge decision; Option B needs `package.json`/lockfile approval, and Option D (Milestone E planning) needs its own explicit approval |
| E — OGraf QA / schema hardening study | 7, 8 | — | Plan only |
| F — Architecture exploration only | 10, 11, 12 | — | Plan only |

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
- Item 9 (dependency and warning maintenance) **requires explicit user approval for anything that touches `package.json`/`package-lock.json`**. The audit is complete (`reports/progress_112_dependency_warning_audit.md`), the approved **Option A** (warning fixes only, no package change) is implemented on `chore/warning-maintenance` (`reports/progress_113_warning_maintenance.md`) and is now subject to the user merge decision; Option B, Option C, the `engines` declaration and the npm-12 `allowScripts` pin stay approval-gated.

## Milestone E — OGraf QA / schema hardening study (roadmap items 7, 8)

- Item 7 (offline schema closure) needs a licensing/size decision before any implementation; deliverable is a study with a hash closure proposal, not a change to fail-closed behaviour.
- Item 8 (downstream folder QA automation) must preserve the evidence-backed folder import model and must not invent host contracts.

## Milestone F — Architecture exploration only (roadmap items 10, 11, 12)

Research/design deliverables only: Lottie import mapping design, evaluator profiling plan, editable KCS import plan. No implementation without a separate explicit approval.

## Approval gates

- Package/lockfile/workflow/dependency changes: explicit user approval required before editing.
- Release/tag/draft-release/npm: explicit user approval required; unchanged by this run.
- Interchange work (Lottie, editable KCS import): design approval before code.
- Any milestone that grows into a broad refactor: stop and report.

## Handoff policy (unchanged)

`chatgpt_handoff/latest/` is a minimal, task-specific bundle: `README.md`, `manifest.txt`, the current report(s), `NEXT_SESSION.md`, `PROJECT_STATE.md`, and optionally the directly relevant contract/plan docs. Never source or test files — flattened copies named `src__*test*` matched Vitest's include glob and broke CI in runs `35094144225`/`35095655446`. Never copy the bundle into `C:\Users\ertugrul.ak\Desktop\KCS`.

## Recommended next prompt

"KCS MILESTONE D ITEM 9 — MERGE DECISION (approval-gated). The audit (`reports/progress_112_dependency_warning_audit.md`) is complete and the approved Option A is implemented on `chore/warning-maintenance` (`reports/progress_113_warning_maintenance.md`): W1 Fast Refresh split, W2 chunk splitting, W3 jsdom stubs, W4 dependency arrays, W5 `.gitattributes`, D9-2 checker rule, plus the local SQLite repair. Decide whether to fast-forward merge it, and separately whether to do Option B (patch/minor updates plus a bounded `npm audit fix`; edits `package.json` + lockfile), Option C (TypeScript 7 / Vitest 5 majors on their own branch) — OGraf QA / schema hardening study, items 7 and 8; Option D also requires explicit user approval, and Milestone E stays plan-only until then). The local `npm rebuild sqlite3` repair (D9-1) is a separate approval-gated item."

Historical notes: "KCS MILESTONE A COMPLETION …" was carried out (five items closed, READY, replayed and fast-forward merged at `077911b`); "KCS MILESTONE B — GRAPH + KEYBOARD ACCESSIBILITY …" was carried out (merged at `96e8f9d`); "KCS MILESTONE C — FIRST EXPORT / ONBOARDING FLOW …" was carried out: implemented on `feat/export-onboarding`, gate-reviewed (READY WITH WARNINGS) and fast-forward merged at `c2dcb22` (see `reports/progress_110_export_onboarding.md`).

---

# Changelog

All notable changes to **Keyframe Character Studio** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

### Release candidate `1.1.0-rc.1` (unreleased package metadata)
- Consolidates the accepted Public Controls, OGraf packaging, filesystem hardening, schema-validation, and release-smoke work.
- The Git tag and GitHub draft prerelease exist; this changelog entry remains under `[Unreleased]` because the package is private and was not published.

### Security
- Hardened prototype-sensitive imported OGraf keys, package paths, MIME lookups, and generated runtime maps.
- Hardened SVG input boundaries, source-path handling, output filesystem checks, hierarchy, broadcast state, and mask/matte parity.
- The `1.1.0-rc.1` candidate records accepted operational warnings for hostile-concurrency filesystem mutation and network-dependent schema validation.

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

---

## 8. File Inventory

Every file present in `chatgpt_handoff/latest/` at generation time:

- `CHANGELOG.md` — 6149 bytes
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — 8448 bytes
- `NEXT_SESSION.md` — 8433 bytes
- `OMP_FINAL_RESPONSE.md` — 5297 bytes
- `PROJECT_STATE.md` — 11627 bytes
- `README.md` — 2620 bytes
- `manifest.txt` — 3537 bytes
- `progress_113_warning_maintenance.md` — 11196 bytes

- Source/test copies present: NO
- Test-glob matching files present: NO
- Desktop\KCS copied: NO

