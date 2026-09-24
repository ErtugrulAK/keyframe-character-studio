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

---

# KCS Milestone H Release Readiness — Final Response (the held state)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** Milestone H is **complete** (H1–H6 merged) and its release decision (H7) is **HELD** by user decision. The final handoff refresh for that state is done, and the last stale `jsdom` sentences are corrected.
- **Gate verdict:** **RELEASE READY WITH DOCUMENTED DEFERRALS** — `reports/progress_146_final_release_gate.md`.
- **Reports:** the audit (`progress_142_release_readiness_audit.md`), the fix (`progress_143_ci_typecheck_step.md`), the two triages (`progress_144_oxlint_1_85_triage.md`, `progress_145_jsdom_30_1_triage.md`), the gate (`progress_146_final_release_gate.md`), the reconciliation (`progress_147_milestone_h_docs_handoff.md`), the held-state refresh (`progress_148_final_handoff_after_hold.md`) and the jsdom cleanup (`progress_149_final_jsdom_state_cleanup.md`).
- **Nothing was released:** no tag, release or npm action. The artefacts are unchanged, and that is the recorded decision rather than an open question.

## 2) HOW IT RAN

| Task | Work | Merged at |
|---|---|---|
| H1 | release-readiness audit — 7 findings, 1 of them required | `cc1ce8e` |
| H2 | the required fix: the CI type-check step now checks the project | `b4bf3c0` |
| H3 | `oxlint` 1.85 triage → **deferred** | `cc1ce8e` |
| H4 | `jsdom` 30.1.x triage → **taken**, with a test-only shim | `c1431db` |
| H5 | the final release gate on clean merged `main` | `3b5a2f3` |
| H6 | live documents and the handoff reconciled | `5b68543` |
| H7 | the release decision → **HELD** | no action taken |
| final refresh | the held state recorded, and the last stale `jsdom` sentences cleared | `5ad9e04` and the cleanup patch |

No rebase, no force push, no merge commit, no history rewrite. Every package/lockfile change and every
merge had explicit approval.

## 3) THE GATE (clean `main` at `c1431db`)

| Check | Result |
|---|---|
| `npm run build` (`tsc -b` + vite) | PASS |
| `npx tsc -b --pretty false` | exit 0 — 151 project files |
| `npm test` | PASS — 126 files / 1,934 tests |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests, candidate `c1431db` |
| export, Lottie and matte browser specs | PASS — 8 tests |
| `npm run qa:v6` | PASS — 3 tests |
| `npm run check` | PASS |
| `node scripts/check-state-consistency.mjs` | PASS — 35 checks at that commit; the total scales with the number of live and bundle documents scanned |
| `npm audit` | 0 vulnerabilities |
| API health + `sqlite3` binding on this machine | 200 `online` / in-memory table created |
| `git diff --check` and the working tree | clean |

CI is green on `main` at `5ad9e04` (run `36014071780`); the gate commit's own run is `35988804952`.

## 4) THE AUDIT'S ONE REQUIRED FINDING, AND HOW IT WAS CLOSED

The CI step named "TypeScript Type Check" ran `npx tsc --noEmit`. The root `tsconfig.json` is a solution
file, so that command builds no referenced project and checked **no project file**: a broken type could
have merged behind a green tick. The step and the `check` script now run `npx tsc -b --pretty false`,
which checks all 151 project files, committed at `b4bf3c0`. This is closed, not pending.

## 5) DECISIONS AND DEFERRALS

- **H7 — the release decision: HELD.** The tag `v1.1.0-rc.1` still points at `46d2a3e59e065816d972dcd56951803951b577f6`, the GitHub release is still a draft prerelease, the package is private at `1.1.0-rc.1`, and nothing was published. Publishing, finalizing or re-tagging still needs explicit user instruction.
- **Option C** (`typescript` 6→7, `vitest` + `@vitest/coverage-v8` 4→5): **deferred by decision**, not a blocker.
- **`oxlint` 1.85:** **deferred** — 34 new warnings, 31 of which flag patterns this codebase uses deliberately.
- **`jsdom` 30.1.x:** **closed** — the bump is taken at `c1431db`, with one test-only shim in `src/tests/setup.ts`. The final cleanup patch (`reports/progress_149_final_jsdom_state_cleanup.md`) makes every live document state that, and the repository's stale-claim searches now come back empty.
- **`engines` + npm-12 `allowScripts`:** **closed** — merged at `1a12d79`.
- **Carried follow-ups that need their own task:** unrestricted CORS, the tracked `server/db/keyframe_studio.sqlite`, and focus restoration for two dialogs. **Accepted and documented:** the constant `SceneLayer.visible`, `vite --host` publishing the dev frontend, and one unreproduced full-suite failure during an earlier task.
- **Stated limits of the gate:** CI runs no browser test (the 2-spec `release-smoke.yml` is manual), CI is `ubuntu-latest` only so the Windows run above is the local evidence, and `qa:release` is the only automated package round-trip.

## 6) RELEASE VIEW

There is no open release question left in this milestone. The decision was taken as a hold, the artefacts
were verified unchanged, and the repository states no default for a future release: finalizing the draft,
re-tagging at a newer `main`, or holding again all need a new explicit instruction.

---

## 2. Handoff Manifest

---

# KCS ChatGPT Upload Manifest — final handoff, Milestone H held

Clean refreshed: YES
Bundle purpose: the final handoff for the held state — the Milestone H release-readiness evidence (audit, fix, triages, gate), the documents/handoff reconciliation, the hold decision, and the final jsdom cleanup
Bundle scope: minimal and task-specific; this folder is not an archive

Branch: main at or after 5ad9e04; H1-H6 are merged and pushed, and the jsdom cleanup patch is the branch docs/final-jsdom-state-cleanup, to be fast-forward merged on approval
Task record: reports/progress_142_release_readiness_audit.md ... reports/progress_149_final_jsdom_state_cleanup.md
H1 audit: 7 items, 1 REQUIRED (the CI type-check step checked no project file); the required one fixed. reports/progress_142_release_readiness_audit.md
H2 fix: MERGED at b4bf3c0 — .github/workflows/ci.yml and the check script now run npx tsc -b --pretty false, which checks 151 project files instead of none. CLOSED. reports/progress_143_ci_typecheck_step.md
H3 oxlint 1.85: DEFERRED. 34 new warnings, 31 flagging patterns this codebase uses deliberately; the three genuine ones would not make the run clean. reports/progress_144_oxlint_1_85_triage.md
H4 jsdom 30.1.x: TAKEN at c1431db. CLOSED. jsdom implements neither createObjectURL nor revokeObjectURL, so the environment pairs Node's URL with jsdom's Blob, and 30.1.1's Blob no longer carries what that implementation follows; one test was affected and src/tests/setup.ts now defines the two functions. reports/progress_145_jsdom_30_1_triage.md
H5 final gate on clean main at c1431db: npm run build PASS; npx tsc -b --pretty false exit 0 (151 files); npm test PASS (126 files / 1,934 tests); npm run lint clean; npm run validate:ograf PASS; npm run qa:release PASS (candidate c1431db, 2 Chromium tests); e2e/export-onboarding + e2e/lottie-import-report + e2e/ograf-matte-visual PASS (8 tests); npm run qa:v6 PASS (3 tests); npm run check PASS; npm audit 0; git diff --check clean; API health 200 (sqlite) and the sqlite3 in-memory binding on this Windows machine. reports/progress_146_final_release_gate.md
Gate verdict: RELEASE READY WITH DOCUMENTED DEFERRALS
H6: live documents and handoff reconciled, MERGED at 5b68543. That merge changed documents only: the code delta between the gated c1431db and 5b68543 is empty. reports/progress_147_milestone_h_docs_handoff.md
H7: HOLD by user decision — no tag, release or npm action. reports/progress_148_final_handoff_after_hold.md
Final cleanup: every live sentence now states jsdom 30.1.1 is CLOSED at c1431db. reports/progress_149_final_jsdom_state_cleanup.md
oxlint 1.85 stays DEFERRED. Option C stays DEFERRED.
CI: main is green at 5ad9e04 (run 36014071780); the gate commit's own run is 35988804952
State check: PASS 35 checks at the gate commit; the total scales with the number of live and bundle documents scanned and with whether the checked-out branch is ahead of origin/main
Option C (typescript 6->7, vitest + @vitest/coverage-v8 4->5): DEFERRED BY DECISION, not a release blocker
engines + npm-12 allowScripts: CLOSED, merged at 1a12d79
Gate limits stated, not hidden: CI runs no browser test (the 2-spec release-smoke.yml is manual); CI is ubuntu-latest only, so the Windows run above is the local evidence; qa:release is the only automated package round-trip
Carried follow-ups (need their own task): unrestricted CORS; the tracked server/db/keyframe_studio.sqlite; focus restoration on two dialogs
Accepted and documented: constant SceneLayer.visible; vite --host publishing the dev frontend; one unreproduced full-suite failure during an earlier task
Roadmap: A-G merged; Milestone H is complete through H6 and its row keeps the plan's single NEXT marker because the state checker requires exactly one and the only item the plan still holds is the held release decision. reports/README.md still stops at progress_129 for 130+, recorded as a separate task, not changed here
Release state: tag v1.1.0-rc.1 target unchanged at 46d2a3e59e065816d972dcd56951803951b577f6; GitHub draft prerelease unchanged; package private at 1.1.0-rc.1; npm publish NO
Tag/release/npm changed: NO

Copied files (15): CHANGELOG.md, KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md, NEXT_SESSION.md, OMP_FINAL_RESPONSE.md, PROJECT_STATE.md, README.md, manifest.txt, progress_142_release_readiness_audit.md, progress_143_ci_typecheck_step.md, progress_144_oxlint_1_85_triage.md, progress_145_jsdom_30_1_triage.md, progress_146_final_release_gate.md, progress_147_milestone_h_docs_handoff.md, progress_148_final_handoff_after_hold.md, progress_149_final_jsdom_state_cleanup.md

Omitted categories: source, test and design files; package/lock files; older reports and current-state documents; QA output, assets, archives, caches.
Omitted files were not deleted from the repository. Not copied and never touched: .git, secrets, backups, caches, `C:\Users\ertugrul.ak\Desktop\KCS`, `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.

Upload only chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md to ChatGPT. The files listed above are the sources of that one-file artifact.

---

## 3. Bundle README

---

# KCS Minimal ChatGPT Upload Bundle — final handoff, Milestone H held

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for the final handoff of
the Milestone H hold state.

## What this bundle covers

Milestone H is complete through H6 and its release decision (H7) is **held**, with the live documents and
this handoff reconciled to the repository truth (`main` at or after `5ad9e04`):

- **The audit** (`progress_142_release_readiness_audit.md`) found 7 items, **one of them required**: the
  CI step named "TypeScript Type Check" ran `npx tsc --noEmit`, which builds no referenced project and so
  checked no project file — a broken type could have merged behind a green tick.
- **The fix** (`progress_143_ci_typecheck_step.md`) is merged at `b4bf3c0`: the CI step and the `check`
  script now run `npx tsc -b --pretty false`, which checks all 151 project files. Closed, not pending.
- **Two dependency decisions.** `oxlint` 1.85 is **deferred** (`progress_144_oxlint_1_85_triage.md`: 34
  new warnings, 31 flagging deliberate patterns). `jsdom` 30.1.x is **taken** at `c1431db`
  (`progress_145_jsdom_30_1_triage.md`): jsdom implements neither object-URL function, so the test
  environment now defines them itself instead of depending on which Blob shape a jsdom patch ships.
  Option C (TypeScript 6→7, Vitest 4→5) is **deferred by decision** and is not a blocker. The
  `engines`/npm-12 `allowScripts` answer is **closed** — merged at `1a12d79`. A final cleanup patch
  (`progress_149_final_jsdom_state_cleanup.md`) made every live sentence agree on the dependency states.
  `jsdom` is closed at `c1431db`. The `oxlint` 1.85 bump stays deferred. Option C stays deferred.
- **The final gate** (`progress_146_final_release_gate.md`) ran on clean `main` at `c1431db` and reports
  **RELEASE READY WITH DOCUMENTED DEFERRALS**: build, type check, 126 files / 1,934 tests, lint,
  `validate:ograf`, `qa:release` (2 Chromium), the export/Lottie/matte browser specs (8), `qa:v6` (3),
  `npm run check`, the state check, `npm audit` (0), `git diff --check`, plus the API health and the
  `sqlite3` binding on the Windows machine. CI is green on `main` at `5ad9e04` (run `36014071780`).
- **The reconciliation** (`progress_147_milestone_h_docs_handoff.md`) moved the live documents to the
  `c1431db` baseline, and **the held-state refresh** (`progress_148_final_handoff_after_hold.md`) records
  the hold and cleared the claims that predated it. Those merges changed documents only: the code delta
  between the gated `c1431db` and today's `main` is empty.
- **H7 — the release decision: HELD.** `v1.1.0-rc.1` still points at
  `46d2a3e59e065816d972dcd56951803951b577f6`, the GitHub release is still a draft prerelease, the package
  is private at `1.1.0-rc.1`, and nothing was published. Finalizing, re-tagging or holding again needs a
  new explicit instruction.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this checkpoint
- `progress_142_release_readiness_audit.md` … `progress_149_final_jsdom_state_cleanup.md` — the milestone's records, which are also the release evidence
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap: A–G merged, H complete through H6 with its release decision held
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md`
are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after
CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source, test and design files are intentionally omitted (they live in the repository). Flattened
copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also
omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports,
release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination.
Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.

---

## 4. Task Record

---

# Progress 142 — H1 release readiness audit (read-only)

Milestone H, task H1. **No repository change was made by this audit**; this report is its deliverable.
Audited at `main == origin/main == a9c78e7`, newest `main` CI run `35977973099` (success), working tree
clean, `npm audit` 0 vulnerabilities, `node scripts/check-state-consistency.mjs` PASS.

## 1. Current truth

| Fact | Value |
|---|---|
| `main` / `origin/main` | `a9c78e78b863cc04931a9979bb33d43e63f8048c` (equal) |
| Newest `main` CI | `35977973099` — success (1m48s) |
| Milestones | A–G **COMPLETE**; H (release finalization) **NEXT** |
| Review findings | 11/11 CLOSED (H-01…H-06, M-01…M-05) |
| Task 4 (`engines` + npm-12 `allowScripts`) | MERGED at `1a12d79` |
| Final correctness gate | re-run after the shallow-checkout fix `dcbf9f5` |
| Full suite | 126 files / 1,934 tests |
| Focused A–G regression suites | 389 tests / 10 files |

## 2. Release artefacts

| Artefact | State |
|---|---|
| `v1.1.0-rc.1` | **annotated tag** (object `81d5149`), target commit `46d2a3e59e065816d972dcd56951803951b577f6` — unchanged |
| `v1.1.0-public-controls` | annotated tag → `0a71bd8` — unchanged |
| GitHub release | `v1.1.0-rc.1 — Public Controls / OGraf hardening release candidate`, **Draft**, created 2026-09-15, unchanged |
| `package.json` | `private: true`, `version: 1.1.0-rc.1` — not published to npm |
| npm publish | **NO** |

The tag target is 40 commits behind `main` by design: `main` carries documentation and follow-up work
after the workflow-tested candidate. Nothing in this milestone moves either tag.

## 3. Toolchain and install policy

| Item | Value |
|---|---|
| `engines.node` | `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` (the locked toolchain's supported intersection) |
| CI Node | `22` on `ubuntu-latest` |
| Local Node / npm | `v24.18.0` / **npm 12.0.2** |
| `allowScripts` | `{"sqlite3@6.0.1": true}` — a version-pinned approval for npm 12 |
| `npm install-scripts ls` | `{"allowScripts": []}` — nothing blocked or pending |
| `sqlite3` binding | **OK** — a fresh `require` opens an in-memory database and creates a table |

The npm-12 policy is doing what it was added for: the local npm is 12, the install script is approved
by exact version, and the native binding loads.

## 4. What the gates actually cover

| Gate | Runs | Covers |
|---|---|---|
| `.github/workflows/ci.yml` (push to `main`, PRs, manual) | `npm ci`, `validate:ograf`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` | unit/integration tests, lint, the production build, the OGraf fixture gate |
| `.github/workflows/release-smoke.yml` (manual, needs a full candidate SHA) | verifies the resolved checkout, Node 22, `npm ci`, installs Chromium, `npm run qa:release` | the OGraf import/export/runtime smoke in a real browser |
| `npm run qa:release` | 2 Chromium specs: `e2e/ograf-phase2d-interoperability`, `e2e/ograf-editor-export` | OGraf package round-trip and editor export |
| On demand only | `e2e/*.spec.ts` (38 files), `perf` harness, `qa:v6` | Lottie import report, matte pixels, canvas/timeline interaction, profiling |

**Coverage gaps found:**

1. **CI runs no browser test at all.** Every E2E spec — including the Lottie import report and the
   OGraf matte pixel proof added in this follow-up — runs only when someone invokes Playwright. The
   single automated browser gate is the *manual* `release-smoke.yml`, and it runs two of the 38 specs.
2. **No Windows job.** CI is Linux-only (`ubuntu-latest`) while the project is developed on Windows;
   the `engines` range and `.gitattributes` line-ending work are the only guards for that platform.
   Node 24 is covered by the declared range but never executed in CI.
3. **`npx tsc --noEmit` in CI checks no project file** (see §5.1), so the type gate is effectively the
   `npm run build` step that follows it.

## 5. The residual observations, classified

### 5.1 `npx tsc --noEmit` checks zero project files — **SHOULD FIX BEFORE RELEASE**
The CI step named "Run TypeScript Type Check" runs `npx tsc --noEmit`, and the root `tsconfig.json` is
a solution file (`files: []` with references), which that command does not build: `tsc -b --listFiles`
reports 151 source files, `npx tsc --noEmit --listFiles` reports none. **Type coverage is not lost** —
`npm run build` runs `tsc -b` in the same job, so a type error still fails CI — but the step as written
verifies nothing and its green tick is misleading in exactly the evidence a release audit reads. The
fix is a one-line workflow change (`npx tsc -b --pretty false`), which is a workflow edit and therefore
needs approval rather than being applied by this audit.

### 5.2 `SceneLayer.visible` is a constant `true` — **ACCEPTED-DOCUMENTED**
`toSceneData` writes `visible: true` for every layer, and the OGraf evaluation reads it. The editor's
two mutes are different controls: `editVisible` is a canvas-only authoring aid, and `visible` is the
"Broadcast Live Eye" that drives live-director playback — neither is a statement that the layer is
absent from the graphic. The exported document's layer visibility is therefore its own flag, and no
specification says an export must honour the live mute. Recorded as a product question, not a defect.

### 5.3 Unrestricted CORS — **DEFERRED FOLLOW-UP**
`cors()` allows any origin. H-06 closed the *network* exposure by binding loopback by default, and
`docs/API.md` now states that CORS is not access control. The residual vector — a page in a browser on
this machine reaching the loopback API — needs a product decision (an origin allowlist changes
behaviour for any other frontend origin), and the editor itself never calls the API.

### 5.4 `server/db/keyframe_studio.sqlite` is tracked in git — **DEFERRED FOLLOW-UP**
A binary database is part of the repository, so a clone starts from whatever state it holds. It is
outside every release artefact (the package is private and the OGraf exports do not include it), and
removing it needs approval plus an ignore rule.

### 5.5 `vite --host` publishes the dev frontend — **ACCEPTED-DOCUMENTED**
The `dev` script exposes the Vite dev server on the network. It serves a static editor with no data and
is not the API; it is a deliberate development convenience.

### 5.6 No focus restoration when two dialogs close — **DEFERRED FOLLOW-UP**
`ImportReportDialog` and `ConfirmationDialog` do not restore focus to the control that opened them
(only the cubic-bezier editor captures and restores it). An accessibility improvement that was recorded
in Task A and needs its own task; no functional impact.

### 5.7 One unreproduced suite failure during Task B — **ACCEPTED-DOCUMENTED (monitored)**
One full-suite run reported a single failure whose name was lost to a truncated tail; six further full
runs, ten runs of the new integration case and six runs of the state-check suite are clean. No defect
is evidenced. If it recurs, the failure name must be captured before the output is trimmed.

## 6. Verdict

**READY WITH REQUIRED FIXES** — one required item, and it is a clarity fix rather than a product risk:

| # | Item | Why it is required | Type |
|---|---|---|---|
| 1 | The CI "TypeScript Type Check" step verifies nothing | The release evidence contains a green tick that means nothing; the real type gate is the build step | Workflow edit (needs approval) |

**There is no product-correctness or security blocker.** The toolchain installs and runs, the native
binding loads, the OGraf fixture gate and the release smoke pass, the full suite is green, and every
severity-1 finding from the full-project review is closed. H2 may proceed.

The three coverage gaps in §4 are stated so they are not mistaken for coverage: no browser test in CI,
no Windows job, and a manual-only release smoke. They are not required fixes for this release; they are
what the release is *not* proven by.

---

# Progress 143 — the CI type-check step (H1's required fix)

Branch: `chore/ci-typecheck-step` (base `main` at `951bbf5`).
Origin: the one required item from `reports/progress_142_release_readiness_audit.md` §5.1, approved by the user.

## 1. What was wrong

`.github/workflows/ci.yml` carried a step named **"Run TypeScript Type Check"** that ran
`npx tsc --noEmit`. The root `tsconfig.json` is a solution file (`files: []` with two project
references), and `--noEmit` does not build references, so that command type-checks **no project file**:

```
npx tsc -b --listFiles        → 151 files under src/
npx tsc --noEmit --listFiles  → 0
```

Type coverage was never lost — the step below it, `npm run build`, runs `tsc -b` and would fail on a
type error — but the release evidence contained a green tick that meant nothing, and `package.json`'s
`check` script had the same flaw.

## 2. Applied

| File | Before | After |
|---|---|---|
| `.github/workflows/ci.yml` | `run: npx tsc --noEmit` | `run: npx tsc -b --pretty false` |
| `package.json` (`check` script) | `npm run lint && npx tsc --noEmit && …` | `npm run lint && npx tsc -b --pretty false && …` |

No dependency, version or lockfile change: `package-lock.json` is untouched, and the only manifest edit
is one script string.

## 3. Evidence

| Check | Result |
|---|---|
| The new command actually checks the project | `npx tsc -b --listFiles` → **151** files under `src/` |
| The new command passes | `npx tsc -b --pretty false` → exit 0 |
| The old command, for contrast | `npx tsc --noEmit --listFiles` → **0** files |
| The changed script end to end | `npm run check` (lint → `tsc -b` → test → build) → PASS |
| `npm test` | PASS — 126 files / 1,934 tests |
| `npm run build` | PASS |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `node scripts/check-state-consistency.mjs` | PASS — 35 checks |
| `git diff --check` | clean |

## 4. Self-review (read-only, same model)

- **The CI job's outcome cannot change for the worse.** `tsc -b` is what `npm run build` already runs
  in the same job, so a type error that fails the new step already failed the build step; the step now
  reports what it claims.
- **`tsc -b` writes build info** to `node_modules/.tmp/` (the path the tsconfigs already declare) and
  emits nothing else (`noEmit: true` in both projects), so it leaves no artefact in the tree.
- **`--pretty false`** keeps CI logs free of terminal colour codes.
- **One string in `package.json`** and one line in the workflow: no other script, dependency, engine
  or lockfile entry is touched.

## 5. Not changed

- No dependency version, `engines` range, `allowScripts` entry or lockfile content.
- No test, source or `src/` file.
- No tag, release, draft or npm action.

---

# Progress 144 — H3 oxlint 1.85 triage (audit only, no change)

Milestone H, task H3. **No repository change**: the audit ran the candidate linter from the npx cache,
which installs nothing into the project. The installed linter stays `oxlint` 1.74.0 (specifier
`^1.71.0`, lockfile 1.74.0) and the lint run stays clean.

## 1. How the warnings were obtained

```
npx oxlint --version                    → 1.74.0 (installed, the version CI and the release use)
npx -y oxlint@1.85.0 src                → the candidate linter, run read-only from the npx cache
```

`package.json`, `package-lock.json` and `.oxlintrc.json` are untouched: the audit needed the warning
list, not the upgrade. The prior measurement (`reports/progress_130_dependency_maintenance_option_b.md`
§limits) reported "33 new rule warnings" from three rule families; this audit re-measured the exact
sites and classified them.

## 2. The warnings, by rule

| Rule | Count | What it flags |
|---|---|---|
| `react(refs)` | 17 | accessing `ref.current` during render |
| `react(set-state-in-effect)` | 14 | calling `setState` synchronously inside an effect |
| `react(purity)` | 2 | calling an impure function (`performance.now`) during render |
| `typescript(no-non-null-asserted-optional-chain)` | 1 | `?.…!` — asserting non-null on a value that may be undefined by design |

## 3. Classification

### 3.1 `react(refs)` — 17 sites — **B (rule/style churn against a deliberate pattern)**
Sixteen of the seventeen are the codebase's documented **latest-ref mirror**:

- `src/hooks/useHistory.ts:75,76,81` — `historyRef.current = history`, with the source comment
  *"Mirrors of the latest committed history/index (safe to read in callbacks)"*;
- `src/hooks/useProjectState.ts:10,13` (`tracksRef`/`characterPartsRef`), `src/hooks/usePlayback.ts:21`
  (`fpsRef`), `src/hooks/usePresets.ts:44`, `src/components/Canvas/StageCanvas.tsx:70,71`, and two in
  `src/tests/freeformTangentHistory.test.tsx`.

The pattern exists so callbacks and effects can read the newest value without re-subscribing; the rule
targets exactly it. The seventeenth, `src/components/Inspector/TemporalGraphPanel.tsx:61-63`, reads
`dragDomainRef.current?.min/max` during render to clamp a drag domain — a render-time ref read that only
changes while a drag is in progress (and each change also sets state).

Converting any of these is a refactor across hooks, context and canvas components with real behaviour
risk in the animation core. The task's own rule for that case is to stop and ask, not to do it here.

### 3.2 `react(set-state-in-effect)` — 14 sites — **B (performance advice, not correctness)**
The sites are synchronisation with things outside React: the playback loop
(`usePlayback.ts:34`), the broadcast loop (`useBroadcast.ts:41,80`), the freeform draw overlay
(`useFreeformDraw.ts:156`, `FreeformTangentOverlay.tsx:145`), the autosave restore
(`useSerialization.ts:441`), the dialog's focus/select timing (`NewItemModal.tsx:31`), the bezier
editor (`InteractiveCubicBezierEditor.tsx:64`) and prop→local-state sync in the small input controls
(`SmartHexInput.tsx:27`, `SmartNumberInput.tsx:36`, `TransformInOutPresetCard.tsx:208,268`),
plus `StageCanvas.tsx:75,155`.

The rule's own guidance allows an effect when synchronising with an external system, which is what
these are. Restructuring them (deriving during render, keying components, moving the state to its
cause) is a per-site design change in the animation core, not a dependency task.

### 3.3 `react(purity)` — 2 sites — **C (small bounded fix)**
`usePlayback.ts:24` and `useBroadcast.ts:196`: `useRef<number>(performance.now())`. The argument is
evaluated on **every** render even though only the first value is kept, so an impure clock call runs
during render. The impact is invisible (the value is discarded), but the rule is correct. Bounded fix:
initialise the timestamp inside the effect that starts the loop.

### 3.4 `typescript(no-non-null-asserted-optional-chain)` — 1 site — **C (small bounded fix)**
`src/tests/trackMutations.test.ts:46`: `next[0].channels?.opacity?.[0].id!`. The `?.` can be
`undefined` by design and the `!` asserts it away; in a test the honest form is to assert the value
first. One line in one test file.

## 4. Verdict: **DEFER** — no change in this milestone

- **31 of 34 warnings are class B**: they flag patterns this codebase uses on purpose, or give
  performance advice for synchronisation effects. Clearing them is a refactor of the hooks, the canvas
  and the inspector — not a lint bump.
- **3 are class C**, but fixing them would **not** make the run clean: 31 class-B warnings would
  remain. A lint run with 31 warnings is not the project's standard, and the only ways to a clean run
  would be a broad refactor or silencing the new rules — which the task explicitly forbids
  ("Do not suppress warnings wholesale. Do not disable broad rules just to get green").
- **Nothing here is a release blocker.** The release is being finalized on a toolchain whose lint run
  is clean, and the 1.85 rules report no user-visible defect: the two purity sites call a clock whose
  value is thrown away, and the one optional-chain assertion is in a test.
- Adopting 1.85 while keeping the rules enabled would *lower* the project's lint floor. Keeping 1.74.0
  keeps it at zero warnings while the new rules get the triage they need.

**Recommended follow-up (its own task, not this milestone):** take the three rule families one at a
time — `react(purity)` first (2 sites, mechanical), then decide per family whether the codebase's
latest-ref mirror is a pattern to keep (with a documented `allow` for those specific call sites) or to
replace, and only then consider the linter bump. That decision needs approval because it either
changes the animation core or narrows a rule.

## 5. State left behind

- `.oxlintrc.json`, `package.json` and `package-lock.json`: **untouched**.
- `chore/oxlint-1-85` was created at `main` (`b4bf3c0`) before the audit concluded; it holds **no
  commits** and can be deleted with approval.
- The lint run on the installed linter remains clean (`npm run lint` → no output).

---

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

---

# Progress 146 — H5 final release gate

Milestone H, task H5. Run on **clean merged `main`** only.

## 1. What it ran on

| Fact | Value |
|---|---|
| `git rev-parse HEAD` | `c1431dba88238063ce49e97d611e69313cf3f42b` |
| `git rev-parse origin/main` | `c1431dba88238063ce49e97d611e69313cf3f42b` (equal) |
| `git status --short --branch` | `## main...origin/main` — clean before and after every command below |
| CI on this commit | `35988804952` — **success** (Node 22, `npm ci`) |
| Local platform | Windows 11, Node `v24.18.0`, npm `12.0.2` |

Milestone H changed three things before this gate, so the release evidence is traceable:

| Commit | Change |
|---|---|
| `b4bf3c0` | the CI type-check step and the `check` script now run `npx tsc -b --pretty false` (the old `--noEmit` checked no project file) |
| `cc1ce8e` | the H3/H4 triage reports |
| `c1431db` | `jsdom` 30.0.1 → 30.1.1 with the test-environment object-URL shim |

## 2. The gate

| Check | Command | Result |
|---|---|---|
| Production build | `npm run build` (`tsc -b` + vite) | **PASS** |
| Type gate | `npx tsc -b --pretty false` | **exit 0** (151 project files) |
| Full suite | `npm test` | **PASS — 126 files / 1,934 tests** |
| Lint | `npm run lint` | **clean** (0 warnings) |
| OGraf fixture gate | `npm run validate:ograf` | **PASS** |
| Release smoke | `npm run qa:release` | **PASS — 2 Chromium tests**, candidate `c1431db` |
| Lottie import + OGraf matte pixels | `npx playwright test e2e/lottie-import-report.spec.ts e2e/ograf-matte-visual.spec.ts` | **PASS — 7 tests** |
| Export download path | `npx playwright test e2e/export-onboarding.spec.ts` | **PASS — 1 test** |
| V6 QA | `npm run qa:v6` | **PASS — 3 tests** |
| Developer gate | `npm run check` (lint → type check → test → build) | **PASS** |
| State consistency | `node scripts/check-state-consistency.mjs` | **PASS — 35 checks** |
| Dependency audit | `npm audit` | **0 vulnerabilities** |
| Whitespace / conflict check | `git diff --check` | **clean** |
| API health | `node server/index.js`, then `GET /api/health` | **200** — `status: online`, `SQLite (Embedded Local DB)` |
| API project route | `GET /api/projects` | `success: true`, `source: sqlite` |
| Native binding | fresh `require('sqlite3')` + in-memory `CREATE TABLE` | **OK** |
| Working tree after the gate | `git status --short` | **clean** (the tracked database file was not written) |

## 3. What this gate does *not* prove

Stated so the verdict is not read as more than it is:

1. **CI runs no browser test.** The 38 Playwright specs run here on Windows; in CI the only automated
   browser gate is the *manual* `release-smoke.yml` (2 specs).
2. **No Windows job.** CI is `ubuntu-latest` only; this run is the Windows/local evidence.
3. **`qa:release` is the only automated package round-trip.** The full E2E set is on demand.

These are the coverage gaps the H1 audit recorded (§4). They are unchanged by this milestone.

## 4. Deferrals carried into the release

| Item | Status | Evidence |
|---|---|---|
| **Option C** (`typescript` 6→7, `vitest` + `@vitest/coverage-v8` 4→5) | **Deferred by user decision** in this milestone; not a blocker | H2 audit: the config surface is vanilla and the peer engines are satisfied, but the breakage surface is unmeasurable without installing, and the current toolchain is clean |
| **`oxlint` 1.85** | **Deferred**, with a corrected triage | `reports/progress_144_oxlint_1_85_triage.md`: 34 new warnings, 31 of them flagging patterns this codebase uses deliberately; the three genuine ones would not make the run clean |
| **jsdom 30.1.x** | **Closed** — the bump was taken at `c1431db` | `reports/progress_145_jsdom_30_1_triage.md`: one test needed a test-only shim; 1,934/1,934 green and CI green after the merge |
| Residual: unrestricted CORS | **Deferred follow-up** | H1 §5.3 |
| Residual: tracked `server/db/keyframe_studio.sqlite` | **Deferred follow-up** | H1 §5.4 |
| Residual: no focus restoration on two dialogs | **Deferred follow-up** | H1 §5.6 |
| Residual: constant `SceneLayer.visible` | **Accepted, documented** | H1 §5.2 |
| Residual: `vite --host` publishes the dev frontend | **Accepted, documented** | H1 §5.5 |
| Residual: one unreproduced Task B suite failure | **Accepted, monitored** | H1 §5.7; six clean full runs since |
| Residual: the CI type-check step verified nothing | **FIXED** at `b4bf3c0` | `reports/progress_143_ci_typecheck_step.md` |

## 5. Verdict

# READY WITH DOCUMENTED DEFERRALS

Every gate above is green on clean, merged `main` at `c1431db`, whose CI run is also green, and the one
required fix from the H1 audit is applied. Nothing outstanding is a product-correctness or security
blocker: the deferrals are two dependency decisions the user owns (Option C, `oxlint` 1.85), three
follow-ups that need their own task, and three documented behaviours.

**No release/tag/npm action was taken.** `v1.1.0-rc.1` still points at
`46d2a3e59e065816d972dcd56951803951b577f6`, the GitHub release is still a draft, the package is still
private at `1.1.0-rc.1`, and nothing was published. Whether to finalize, re-tag or publish is H7's
question and the user's decision.

---

# Progress 147 — Milestone H docs and handoff reconciliation

Milestone H, task H6. Every number and revision below comes from the repository or from git on the
machine that ran it.

## 1. What was reconciled

| Document | Change |
|---|---|
| `PROJECT_STATE.md` | the `main` baseline moves from `64291bc` to `c1431db`; the TypeScript row states the fixed type gate and links `progress_143`; a new **Milestone H** section records the audit verdict, the one required fix, both dependency decisions, the jsdom bump and the final gate verdict, and states that the release artefacts did not move |
| `NEXT_SESSION.md` | checkout baseline `c1431db`; the validation line now points at the final gate run; item 1 names **Milestone H** as the open item (the release decision) and Milestone G as complete; item 2 records Option C as deferred by decision, `oxlint` 1.85 as deferred and `jsdom` 30.1.1 as closed |
| `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` | row H keeps **NEXT** and now names the three Milestone H branches, the five records, the fix at `b4bf3c0`, the bump at `c1431db`, the gate verdict and the two deferred decisions |
| `CHANGELOG.md` | two entries under `[Unreleased]`: the CI type-check fix (the step checked no project file) and the `jsdom` 30.1.1 bump with the reason the test environment now defines the object-URL functions |
| `docs/KCS_RELEASE_CANDIDATE_SUMMARY.md` | the release boundary and the release decision name the audit and the final gate, restate that the tag and draft still point at `46d2a3e`, and list the documented deferrals with the jsdom deferral marked closed |
| `chatgpt_handoff/` | rebuilt per its own standing rules: the four mirrored documents re-copied, the task record replaced with this task's reports, the manifest and bundle README rewritten, the final response replaced, and the one-file regenerated from `latest/` |

## 2. Why the wording is what it is

- **`main` is at or after `c1431db`** — the live documents are allowed to say "at or after" because the
  state check fails a claim about a revision `main` has not reached, and a document written on a branch
  must still be true after the branch merges.
- **The release decision is stated as open.** The audit, the fixes and the gate are complete; nothing in
  this task touched the tag, the draft release, the package metadata or npm. A document that implied the
  release was authorized would be false.
- **The deferrals are named with their reasons.** "Deferred" without a reason reads as an omission; each
  entry points at the triage that measured it.

## 3. What was deliberately not touched

- **`reports/README.md`** is described in its own header as a chronological historical audit trail. Its
  "latest relevant reports" list stops at `progress_129`; entries for `progress_130`–`progress_147` are
  missing. Extending that historical index is a separate documentation task with its own review, not a
  live-state claim, so it is recorded here instead of changed in passing.
- **Every earlier report and current-state document** is unchanged.
- **No release artefact**: the tag still points at `46d2a3e59e065816d972dcd56951803951b577f6`, the GitHub
  release is still a draft, the package is still private at `1.1.0-rc.1`, and nothing was published.

## 4. Validation

| Check | Result |
|---|---|
| `node scripts/check-state-consistency.mjs` | **PASS — 35 checks**, including the bundle mirrors, the live documents, the roadmap status rows and the one-file staleness/secret scans |
| `git diff --check` | clean |
| The live documents' git claims | branch `docs/milestone-h-release-readiness`, `main` at `c1431db` — both true of the repository at the time of writing |

**Stop point:** the reconciliation is complete and awaits the approval gate for merging
`docs/milestone-h-release-readiness` into `main` (fast-forward only). No merge was performed.

---

# Progress 148 — final handoff refresh after the Milestone H hold

Documentation and handoff reconciliation only. No source, test, package, lockfile or workflow file was
touched, and no release, tag or npm action was taken.

## 1. Precheck (read-only)

| Fact | Value |
|---|---|
| `git status --short --branch` | `## main...origin/main` — clean |
| `git rev-parse HEAD` / `main` / `origin/main` | `5b68543` — all three equal |
| Latest `main` CI | `35996899896` — success (the run for `5b68543`) |
| `node scripts/check-state-consistency.mjs` | PASS — 45 checks |
| `git diff --check` | clean |

## 2. Stale claims found, and what each now says

The handoff was generated before the H6 merge and the H7 hold, so it carried the state of that moment.

| Stale claim | Where | Now |
|---|---|---|
| `main` at `c1431db` as the current truth | `PROJECT_STATE.md`, `NEXT_SESSION.md`, the bundle manifest, the final response | `main` at or after `5b68543` |
| "the release decision is the open item" | `NEXT_SESSION.md`, `PROJECT_STATE.md`'s Milestone H heading | **H7 = HELD by user decision**; the decision is no longer open |
| "H6 … awaiting the fast-forward merge gate" | the bundle manifest and the final response | H6 merged at `5b68543` |
| "the roadmap, with milestones A–G complete and H as NEXT" | the bundle README | milestones A–G complete; Milestone H complete through H6 with its release decision held |
| run `35988804952` presented as the latest CI | the bundle README, manifest and final response | `35996899896` is the run for the current `main`; the earlier run is named as the gate-commit run |
| "the state check (35)" as the current total | the final response's gate table, `PROJECT_STATE.md` | 45 now — 35 at the gate commit, before the documents and the bundle grew |
| "`engines`/`allowScripts` … awaiting its merge decision" | the roadmap's close-out paragraph | merged into `main` at `1a12d79` |
| "the two deferred minor bumps (`oxlint` 1.85, `jsdom` 30.1.x)" as one open pair | the roadmap's recommended next prompt | `jsdom` 30.1.1 taken at `c1431db`; only `oxlint` 1.85 stays deferred, with Option C deferred by decision |
| "the remaining work is a decision, not a fix … then any publish/finalize instruction" | the roadmap's recommended next prompt | rewritten for the held state: H1–H6 merged, H7 held, nothing actionable without a new instruction |

**Not changed, deliberately:** `reports/README.md` still stops at `progress_129` for its "latest relevant
reports" list (a separate documentation task, recorded in `progress_147`), and every earlier report keeps
its intermediate facts — a report is a historical record, and rewriting one would falsify it.

## 3. The roadmap's NEXT marker, and why Milestone H keeps it

The attachment asked for Milestone H to stop being NEXT. The repository's own gate makes that
impossible to state literally: `checkRoadmapStatus` parses the milestone table, accepts only the letters
`A`–`H`, and fails unless **exactly one** row's status contains `NEXT`
(`scripts/check-state-consistency.mjs`, "expected exactly one NEXT milestone"). Every row is taken —
`A`/`B`/`C` must read MERGED, `E`/`F` must stay plan-only — so the single NEXT marker can only sit on
`D`, `G` or `H`, and only `H` has anything left in the plan.

The row therefore keeps the marker and states the truth in its text: **H1–H6 COMPLETE and merged,
H7 HELD**, with the marker explained as "the only item the plan still holds is that future release
decision". The alternative — dropping the marker or editing the checker — would either break the gate or
weaken it, and neither is a documentation change. This is recorded here rather than hidden.

## 4. Handoff rebuild

`chatgpt_handoff/latest/` was cleaned and rebuilt for this state: the four mirrored documents re-copied,
the Milestone H record set (the audit, the fix, the two triages, the gate, the reconciliation) kept as the
release evidence, this report added, and `OMP_FINAL_RESPONSE.md`, `manifest.txt` and `README.md`
rewritten. `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` was regenerated from `latest/` — no section was
appended to the previous file. The upload instruction still names
`chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.

## 5. Validation

| Check | Result |
|---|---|
| `node scripts/check-state-consistency.mjs` | **PASS** — 45 checks at precheck and 48 on the committed tree (the total scales with the number of live and bundle documents scanned, which is why no live document states a current total) |
| `git diff --check` | clean |
| Changed paths | documents only — no `src/`, `server/`, `perf/`, `e2e/`, `scripts/`, `package.json`, `package-lock.json` or `.github/workflows/` |

**Stop point:** the refresh awaits the approval gate for merging `docs/final-handoff-after-hold` into
`main` (fast-forward only). No merge was performed, and H7 was not reopened.

---

# Progress 149 — final cleanup of the stale jsdom claims

Documentation and handoff only. No source, test, package, lockfile or workflow file was touched, no
release action was taken, and Milestone H was not reopened.

## 1. Precheck (read-only)

| Fact | Value |
|---|---|
| `git status --short --branch` | `## main...origin/main` — clean |
| `git rev-parse HEAD` / `main` / `origin/main` | `5ad9e04` — all three equal |
| Latest `main` CI | `36014071780` — success |
| `node scripts/check-state-consistency.mjs` | PASS — 47 checks |
| `git diff --check` | clean |

## 2. The stale sentences, and what each now says

Four live documents still carried the Option B-era conclusion, which the jsdom bump later overturned:
that `jsdom` had been applied, measured and reverted and therefore remained deferred alongside
`oxlint` 1.85.

| File | Stale text | Now |
|---|---|---|
| `CHANGELOG.md` | "the linter and jsdom keep their previously verified versions because the newer ones need work of their own (33 new lint rules; with jsdom 30.1 any `URL.createObjectURL` call on a Blob throws, which fails the export-download test)" | the linter kept its version in that refresh and `jsdom` stayed at 30.0.1 **in that refresh**; `jsdom` was taken to 30.1.1 later, with the test-environment object-URL shim described in the entry above it, and the `oxlint` 1.85 bump remains deferred |
| `NEXT_SESSION.md` (Milestone D item 9) | "the two minor bumps that were applied, measured and reverted (`oxlint` 1.85 …, `jsdom` 30.1 whose `URL.createObjectURL` throws for a Blob)" | the `oxlint` bump was applied, measured and reverted and **stays deferred**; the `jsdom` bump was reverted at that time too and **was taken later at `c1431db`** |
| `PROJECT_STATE.md` (approval gate) | "Option C and the two deferred minor bumps (`oxlint` 1.85, `jsdom` 30.1.x)" | Option C, deferred by decision, and the deferred `oxlint` 1.85 bump; `jsdom` 30.1.1 is closed at `c1431db` |
| `PROJECT_STATE.md` (item 9) | "the `engines` declaration, the npm-12 `allowScripts` pin, and the two minor bumps that were applied, measured and reverted (… `jsdom` 30.1 …)" | `engines`/`allowScripts` answered and merged at `1a12d79`; `oxlint` 1.85 deferred; `jsdom` 30.1 bump reverted then, taken later at `c1431db` |
| `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` (item 9) | "Option C and the two deferred minor bumps (`oxlint` 1.85, `jsdom` 30.1.x) stay approval-gated" | Option C and the deferred `oxlint` 1.85 bump stay approval-gated; `jsdom` 30.1.1 is closed at `c1431db` |

A second pass tightened one more sentence (`PROJECT_STATE.md`: "`jsdom` 30.1 was later taken" → "`jsdom`
30.1.1 was taken") so the version in the claim matches the version in the lockfile.

**Not changed:** every historical report keeps its intermediate facts — `progress_130` and the other
Option B records are the audit trail of a decision that was correct when it was made, and rewriting them
would falsify the record. The stale text was only in *live* documents, which is where it mattered.

## 3. Targeted audit after the patch

| Search | Result |
|---|---|
| `two deferred minor` / `two minor bumps` | no match in any live document |
| `jsdom.*defer`, `jsdom.*revert`, `jsdom.*keep.*version` | only the corrected sentences, which now state the bump was taken at `c1431db` |
| `oxlint` + `jsdom` on one line | only lines that state `oxlint` deferred **and** `jsdom` closed |
| `jsdom` 30.1.x | `PROJECT_STATE.md`'s "**`jsdom` 30.1.x: closed**" bullet and the roadmap's held-state prompt, both correct |

The truth set the audit confirms: `jsdom` 30.1.1 **taken/closed** at `c1431db`; `oxlint` 1.85 **deferred**;
Option C **deferred by decision**; `engines`/`allowScripts` **closed** at `1a12d79`; **H7 = HOLD**; and the
release artefacts unchanged.

## 4. Handoff rebuild

`chatgpt_handoff/latest/` was cleaned and rebuilt for this state: the four mirrored documents re-copied,
this report added to the Milestone H record set, and `OMP_FINAL_RESPONSE.md`, `manifest.txt` and
`README.md` updated. `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` was regenerated from `latest/` — no
section was appended to the previous file.

## 5. Validation

| Check | Result |
|---|---|
| `node scripts/check-state-consistency.mjs` | **PASS** (bundle mirrors, live documents, roadmap rows, the tag/revision rule, the one-file staleness and secret scans) |
| `git diff --check` | clean |
| Changed paths | documents only — no `src/`, `server/`, `perf/`, `e2e/`, `scripts/`, `package.json`, `package-lock.json` or `.github/workflows/` |

**Stop point:** the patch awaits the approval gate for merging `docs/final-jsdom-state-cleanup` into
`main` (fast-forward only). No merge was performed, H7 was not reopened, and nothing was released.

---

## 5. Next Session

---

# Next Session Handoff

## Repository state

- Checkout: `main` at or after `5b68543` (the Milestone H final handoff), matching `origin/main`. **Milestone F item 10 is complete**: the import core (`ff32d6c`), the mask/track-matte slice (`8670b2a`), the text/image/precomp slice (`bda62cb`) and the import entry point with the report-before-replace UX (`3b30bff`) are merged; the checkpoint `docs/checkpoints/2026-09-18-after-lottie-core/` records the earlier base and stays historical. Milestones A–E, the Milestone F study, the item-11 harness, item 12's first step and product half, the CI hotfix and **all four Milestone F item 10 slices (merged at `ff32d6c`, `8670b2a`, `bda62cb` and `3b30bff`)** are in `main`. The feature branches `feat/export-onboarding`, `chore/state-hygiene-gate`, `chore/dependency-warning-audit`, `chore/warning-maintenance`, `docs/milestone-e-ograf-qa-study` and `feat/lottie-import-core` are retained as review artefacts.
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
- Milestone D item 9 — dependency and warning maintenance: **the audit is complete** (`reports/progress_112_dependency_warning_audit.md`, review closed READY WITH WARNINGS in round 6 of six) and **the approved Option A is implemented on `chore/warning-maintenance`** (`reports/progress_113_warning_maintenance.md`): W1 Fast Refresh split, W2 chunk splitting, W3 jsdom stubs, W4 honest dependency arrays, W5 `.gitattributes`, the D9-2 checker rule, plus the local SQLite binding repair — the API starts again and `GET /api/health` returns 200 in this working copy. `package.json`, `package-lock.json`, `.github/workflows/**` and every dependency version were left unchanged by that maintenance work. The audit's open items were then taken up one by one: **Option B was applied and merged into `main` at `73426e5`** (`reports/progress_130_dependency_maintenance_option_b.md`) — 16 patch/minor packages refreshed (React 19.3, Vite 8.3, Vitest 4.1.11, testing-library patches, `lucide-react`, `pg`, `concurrently`, `@types`) and a bounded `npm audit fix` took `npm audit` from 1 high + 6 moderate to **0**. The `engines` declaration and the npm-12 `allowScripts` pin were answered afterwards on `chore/engines-allow-scripts` (`reports/progress_131_engines_allow_scripts.md`) and are **merged into `main` at `1a12d79`**. Still open by decision: Option C (the `typescript` 6→7 major and the `vitest` + `@vitest/coverage-v8` 4→5 pair). The `oxlint` 1.85 bump was applied, measured and reverted (33 new rule warnings) and stays deferred; the `jsdom` 30.1 bump was reverted at that time too and was taken later at `c1431db`, where the test environment defines the object-URL functions itself.

The release stance is unchanged: annotated tag `v1.1.0-rc.1` and a GitHub draft prerelease exist at the workflow-tested code candidate; nothing was published, finalized, or pushed to npm.

## Validation

On `main` at `5b68543` (the Milestone H final handoff): full Vitest (126 files / 1,934 tests), `npx playwright test e2e/ograf-matte-visual.spec.ts` (4 pixel cases) and `e2e/lottie-import-report.spec.ts` (3 real-browser tests), `npm run validate:ograf`, `npm run qa:release` (2 Chromium tests), `npm run build` (`tsc -b` + vite — and the CI type-check step and the `check` script now run `tsc -b` too, so all 151 project files are checked), `npm run lint` (clean), `git diff --check` and `node scripts/check-state-consistency.mjs` all pass, `npm audit` reports 0 vulnerabilities, and the API serves `GET /api/health` with 200 on `127.0.0.1` (its default bind).

## Next scoped work

1. **Milestone H — release readiness is COMPLETE (H1–H6) and its release decision (H7) is HELD.** The audit (`reports/progress_142_release_readiness_audit.md`), the one required fix (the CI type-check step and the `check` script now run `npx tsc -b --pretty false`; `reports/progress_143_ci_typecheck_step.md`), the two dependency triages (`reports/progress_144_oxlint_1_85_triage.md`, `reports/progress_145_jsdom_30_1_triage.md`) and the final release gate (`reports/progress_146_final_release_gate.md`) are all done and merged, `jsdom` 30.1.1 was taken at `c1431db`, and the live documents and the handoff were reconciled at `5b68543` (`reports/progress_147_milestone_h_docs_handoff.md`, `reports/progress_148_final_handoff_after_hold.md`). The gate verdict is **RELEASE READY WITH DOCUMENTED DEFERRALS**. H7 was decided as a **hold**: no tag, release or npm action, and the artefacts stay at `46d2a3e`. Nothing in the plan is actionable without a new explicit instruction. **Milestone G — the post-review correctness follow-up — is complete.**
2. Approval-gated follow-ups that remain open: **Option C** (the `typescript` 6→7 major and the `vitest` + `@vitest/coverage-v8` 4→5 pair), **deferred by decision** in Milestone H, and the `oxlint` 1.85 bump, **deferred** with its triage recorded. **`jsdom` 30.1.1 is closed** — the bump was taken at `c1431db`. The `engines`/`allowScripts` follow-up is answered on `chore/engines-allow-scripts` (`reports/progress_131_engines_allow_scripts.md`) and is **merged** at `1a12d79`. Every release/tag/draft-release change still needs explicit approval.
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
- Roadmap status when this milestone landed: D was next (items 6 and 9) and C was merged. Current status: milestones A–G are complete, and Milestone H is complete through H6 with its release decision held (H7), see "Current result" above.

---

## 6. Project State

---

# KCS Project State

## Current position

The accepted product and security follow-up line is integrated into main, the grouped post-RC roadmap has completed milestones A–G, and `main` is at or after `5b68543` (the Milestone H final handoff). Milestone F is complete (its item 10 slices — the Lottie import core `ff32d6c`, the mask/track-matte slice `8670b2a`, the text/image/precomp slice `bda62cb` and the import entry point `3b30bff` — item 11 and item 12 are all merged), milestone G (the post-review correctness follow-up) is complete, and **milestone H (release finalization) is complete through H6 with its release decision held (H7)**.

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
| Full Vitest | PASS | 126 files / 1,934 tests |
| OGraf fixture validation | PASS | `npm run validate:ograf` — offline against the vendored closure, every document pin-verified (`reports/progress_115_ograf_offline_schema_closure.md`) |
| OGraf release smoke | PASS | `npm run qa:release`; 2 Chromium tests on `main` |
| Real-browser milestone smoke | PASS | `e2e/graph-accessibility.spec.ts` and the live editor smoke with port 5000 closed (layer authoring, readiness check, real export) |
| State consistency | PASS | `node scripts/check-state-consistency.mjs` — the total scales with the number of live and bundle documents scanned |
| TypeScript | PASS | `npm run build` (`tsc -b && vite build`), and the CI step and the `check` script now run `npx tsc -b --pretty false` themselves — the previous `npx tsc --noEmit` built no referenced project and checked no project file (`reports/progress_143_ci_typecheck_step.md`) |
| Lint | PASS | clean — the Fast Refresh warning was removed in `reports/progress_113_warning_maintenance.md` |
| Production build | PASS | no chunk-size advisory — split into 382.19 kB app + react-vendor/icons/geometry chunks (see `reports/progress_113_warning_maintenance.md`) |
| Independent review | PASS | Milestone A `READY` in round 6 of six; the item-9 audit closed `READY WITH WARNINGS` in round 6 of six (`reports/progress_112_dependency_warning_audit.md` §12); the Option A change closed with `READY WITH WARNINGS` from the read-only `scout` round (the reviewer model hit a provider usage limit) after `reviewer-agent` rounds 1–3 closed every finding (`reports/progress_113_warning_maintenance.md` §2) |
| CI on `main` | PASS | the newest `main` push run is green at the time of this reconciliation (`gh run list --branch main`) |

## Post-review correctness follow-up (complete)

The full-project review's release-blocking findings are closed, one task at a time and one branch each: **H-01** at `0c19751`, **H-03/H-04/M-03** at `fc672f2`, **M-01/M-02/H-05** at `85c3929`, **H-02** at `ac3bda1`, **H-06** at `352d272`, **M-04** at `16e1610`, **M-05** at `2b0bba0`. The Task G merge then turned `main` red for one push — the new live-revision rule compared an "at or after" claim with `git merge-base --is-ancestor`, and CI's `--depth 1` checkout does not carry the older commits — and the fix at `dcbf9f5` reports that limit as skipped, exactly as the tag and milestone checks already do. Every fix carries a reproduction that fails before it and passes after it, at the level a user observes. The final correctness gate and the finding map are in `reports/progress_141_astra_correctness_followup_summary.md`; the residual observations it records (the type-check step that verified nothing — since fixed, see the Milestone H section — the tracked SQLite file, CORS, and the rest) each need their own decision.

## Milestone H — release readiness (COMPLETE — H1–H6 merged; H7 held)

The controlled release-readiness pass ran end to end and its evidence is `reports/progress_142_release_readiness_audit.md` (audit), `reports/progress_144_oxlint_1_85_triage.md` and `reports/progress_145_jsdom_30_1_triage.md` (the two dependency triages), `reports/progress_143_ci_typecheck_step.md` (the audit's one required fix) and `reports/progress_146_final_release_gate.md` (the gate).

- **Audit verdict:** READY WITH REQUIRED FIXES — one required item, and it was fixed: the CI step named "TypeScript Type Check" ran `npx tsc --noEmit`, which builds no referenced project and therefore checked no project file, so its green tick meant nothing. The step and the `check` script now run `npx tsc -b --pretty false` (151 project files), committed at `b4bf3c0`.
- **Option C (TypeScript 6→7, Vitest 4→5): deferred by user decision** — not a blocker; the current toolchain builds, tests and lints cleanly, and the majors' breakage surface cannot be established without installing them.
- **`oxlint` 1.85: deferred** — 34 new warnings, 31 of which flag patterns this codebase uses deliberately (the documented latest-ref mirror, and synchronisation effects the rule's own guidance allows); the three genuine ones would not make the run clean.
- **`jsdom` 30.1.x: closed** — the bump was taken at `c1431db` with one test-only object-URL shim in `src/tests/setup.ts`; jsdom implements neither `createObjectURL` nor `revokeObjectURL`, and 30.1.1's Blob no longer carries what Node's implementation follows.
- **Final release gate: RELEASE READY WITH DOCUMENTED DEFERRALS** on clean `main` at `c1431db` — build, type check, 126 files / 1,934 tests, lint, `validate:ograf`, `qa:release` (2 Chromium), the Lottie/matte/export browser specs (8), `qa:v6` (3), `npm run check`, the state check (35 checks at that commit — the total scales with the number of live and bundle documents scanned, so a later count is not comparable), `npm audit` (0), `git diff --check`, and the API health plus the sqlite3 binding on this machine.
- **H6 — the live documents and the handoff are reconciled** at `5b68543` (`reports/progress_147_milestone_h_docs_handoff.md`), and the final handoff refresh for the held state followed it (`reports/progress_148_final_handoff_after_hold.md`). That merge changed documents only: the code delta between the gated `c1431db` and `5b68543` is empty.
- **H7 — the release decision: HELD by user decision.** No tag, release or npm action was taken. `v1.1.0-rc.1` still points at `46d2a3e59e065816d972dcd56951803951b577f6`, the GitHub release is still a draft prerelease, the package is private at `1.1.0-rc.1`, and nothing was published. The decision is no longer open — it is a hold — and a future release still needs explicit user instruction.

## Remaining work

- Grouped roadmap execution plan: `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`; roadmap items 1 and 2 are completed, and **Milestone A is merged**.
- **Milestone B (graph + keyboard accessibility, item 4) — MERGED** at `96e8f9d`: the timeline keyframe diamonds are named keyboard buttons with a lane-local arrow walk, the value graph exposes a labelled group with keyboard-editable points, decorative SVG geometry is hidden from assistive tech, and focus rings were added. One review round returned BLOCKED (3 findings, 6 over-claims), all closed; the re-review returned READY WITH WARNINGS.
- **Milestone C (first export / onboarding flow, item 5) — MERGED** at `c2dcb22` (final gate verdict READY WITH WARNINGS): an opt-in "First export help" panel, a readiness check that reads the same OGraf diagnostics authority the export reads, and one shared compile path used by the readiness check and both export actions. **Milestone D is complete** — item 6 and item 9 (audit, the approved Option A and the local SQLite repair) are merged at `3923141` (`reports/progress_112_dependency_warning_audit.md`, `reports/progress_113_warning_maintenance.md`). Milestone E (study plus items 7 and 8) is complete, and Milestone F is complete too: its study is delivered (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`), item 11 is merged as measurement only, item 12's first step and product half are merged, item 10's mapping design is delivered (`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`) and **item 10's implementation slices are merged**, the first at `ff32d6c` (`reports/progress_123_lottie_import_core.md`). Milestone F item 10 is complete: its four slices are merged (`ff32d6c`, `8670b2a`, `bda62cb`, `3b30bff`), and **item 12's unified import entry is merged** (`reports/progress_128_unified_import_entry.md`): one header control classifies a selected file by its content and routes it to the KCS/legacy boundary, the Lottie importer with its report dialog, or the OGraf package reader — merged into `main` with its handoff refresh at `a4f8642`. Its **OGraf package/editable import** is merged at `419fc6a` (`reports/progress_129_ograf_editable_import.md`): a `.zip`/`.ograf` package is decoded in memory under entry-count, entry-size and path-safety guards, its `scene.kcs` goes through the same validated path as a project import, and a bare `.ograf.json` manifest still points the user at the package. After it landed: Option B was taken up and merged into `main` at `73426e5`; `engines`/`allowScripts` is answered on `chore/engines-allow-scripts` and merged into `main` at `1a12d79`, while Option C is deferred by decision. The state-consistency checker does not yet detect a stale sentence inside a current section, so these documents are still reviewed by hand after every task. The branch declares the locked toolchain's supported Node intersection (`^22.22.2 || ^24.15.0 || >=26.0.0`), approves `sqlite3@6.0.1`'s prebuilt-binding install step, and synchronizes only the lockfile root engine metadata; the dependency graph is unchanged. Any further `package.json`, lockfile or workflow change stays approval-gated: Option C, deferred by decision, and the deferred `oxlint` 1.85 bump. `jsdom` 30.1.1 is closed — the bump was taken at `c1431db`.
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
- **Item 9 (dependency and warning maintenance) — Option A MERGED at `3923141`; Option B merged into `main` at `73426e5`** (`reports/progress_130_dependency_maintenance_option_b.md`): 16 patch/minor packages refreshed and a bounded `npm audit fix` took `npm audit` from 1 high + 6 moderate to **0**; `oxlint` 1.85 is deferred with evidence, and `jsdom` 30.1.1 was taken at `c1431db`. The paragraph below records the merged Option A.
- **Item 9 (dependency and warning maintenance) — MERGED at `3923141`** (audit, Option A warning maintenance and the local SQLite repair). The audit is complete (`reports/progress_112_dependency_warning_audit.md`, review closed READY WITH WARNINGS in round 6 of six) and the approved **Option A is implemented** on `chore/warning-maintenance` (`reports/progress_113_warning_maintenance.md`): W1 Fast Refresh split, W2 chunk splitting, W3 jsdom stubs, W4 honest dependency arrays, W5 `.gitattributes`, the D9-2 checker rule and the repair of **D9-1** (the local `sqlite3` NAPI binding is extracted; `node server/index.js` starts and `GET /api/health` returns 200 in this working copy). No dependency was updated and `package.json`, `package-lock.json` and the workflows were left unchanged by that maintenance work; its approval-gated follow-ups were taken up separately, starting with Option B. The 7 catalogued warnings are resolved except W6 (`e2e/**` outside the Vitest glob by design) and W7 (environment `NO_COLOR`/`FORCE_COLOR`). The audit's open items were then taken up one by one: **Option B was applied and merged into `main` at `73426e5`** (`reports/progress_130_dependency_maintenance_option_b.md`) — 16 patch/minor packages refreshed (React 19.3, Vite 8.3, Vitest 4.1.11, testing-library patches, `lucide-react`, `pg`, `concurrently`, `@types`) and a bounded `npm audit fix` took `npm audit` from 1 high + 6 moderate to **0**. Still open by decision: Option C (the `typescript` 6→7 major and the `vitest` + `@vitest/coverage-v8` 4→5 pair). The `engines` declaration and the npm-12 `allowScripts` pin were answered and merged at `1a12d79`; the `oxlint` 1.85 bump was applied, measured and reverted (33 new rule warnings) and stays deferred; the `jsdom` 30.1 bump was reverted then and taken later at `c1431db`, where the test environment defines the object-URL functions itself.

---

## 7. Current Roadmap Plan and Changelog

---

# KCS Grouped Roadmap Execution Plan

Orchestrator close-out for the grouped post-RC roadmap run. Milestone A was later completed, re-reviewed, and fast-forward merged into `main` (see `reports/progress_108_canvas_tangent_authoring.md`); milestone B was completed, re-reviewed, and fast-forward merged into `main` (see `reports/progress_109_graph_accessibility.md`); milestone C was completed, re-reviewed (final gate verdict READY WITH WARNINGS), and fast-forward merged into `main` (see `reports/progress_110_export_onboarding.md`); milestone D item 6 (state consistency check) was completed, re-reviewed, and fast-forward merged into `main` while item 9's audit and its approved Option A are merged and only its follow-ups stay behind an explicit approval gate — Option B is now merged into `main` at `73426e5`, while Option C stays deferred by decision and the `oxlint` 1.85 bump stays deferred, `jsdom` 30.1.1 having been taken at `c1431db` (the `engines`/`allowScripts` answer is merged into `main` at `1a12d79`) (see `reports/progress_111_state_hygiene_gate.md`); milestone E items 7 and 8 are implemented and merged at `22335a5`, and Milestone F's study is delivered while its implementation proceeds slice by slice under separate approvals: item 10 is complete (all four slices merged), item 11 is implemented, and item 12 is complete: the unified import entry and the OGraf package import are merged.

## Milestone map and status

| Milestone | Roadmap items | Branch | Status |
|---|---|---|---|
| A — Canvas path authoring UX (tangent handles) | 3 | `feat/canvas-tangent-authoring` (replayed as `feat/canvas-tangent-authoring-replay`) | **MERGED** — five review findings closed across six rounds (final verdict READY), fast-forward merged into `main` |
| B — Graph + keyboard accessibility | 4 | `feat/graph-accessibility` | **MERGED** — one review round returned BLOCKED (3 findings, 6 over-claims), all closed; re-review returned READY WITH WARNINGS; fast-forward merged at `96e8f9d` |
| C — First export / onboarding flow | 5 | `feat/export-onboarding` | **MERGED** — six review rounds; final gate verdict READY WITH WARNINGS; fast-forward merged into `main` at `c2dcb22` |
| D — State / CI / warning hygiene | 6, 9 | `chore/state-hygiene-gate`, `chore/dependency-warning-audit`, `chore/warning-maintenance` | **COMPLETE** — **item 6 MERGED** (`node scripts/check-state-consistency.mjs`); **item 9 MERGED** at `3923141` (`reports/progress_112_dependency_warning_audit.md`, `reports/progress_113_warning_maintenance.md`): the audit, then the approved Option A (W1, W2, W3, W4, W5, D9-2) and the local SQLite repair, fast-forward merged with green CI run `35322372675`. **Option B is merged into `main` at `73426e5`** (`reports/progress_130_dependency_maintenance_option_b.md`): 16 patch/minor packages refreshed and a bounded `npm audit fix` brought `npm audit` to zero, with `oxlint` 1.85 deferred for documented reasons and `jsdom` 30.1.1 later taken at `c1431db`. The `engines` declaration and npm-12 `allowScripts` policy are answered on `chore/engines-allow-scripts` and are **merged into `main` at `1a12d79`**. Still approval-gated: Option C (TypeScript 7 / Vitest 5, deferred by decision) and the `oxlint` 1.85 bump |
| E — OGraf QA / schema hardening study | 7, 8 | `docs/milestone-e-ograf-qa-study`, `chore/ograf-offline-schema-closure`, `test/ograf-folder-qa-automation` | **COMPLETE** — study and plan delivered (`docs/design/KCS_MILESTONE_E_OGRAF_QA_STUDY.md`, `reports/progress_114_ograf_qa_study.md`); **item 7 (7-A) implemented and merged** on `chore/ograf-offline-schema-closure` (`reports/progress_115_ograf_offline_schema_closure.md`) and **item 8 implemented and merged** on `test/ograf-folder-qa-automation` (`reports/progress_116_ograf_folder_qa.md`), integrated at `22335a5` with green CI. **Plan only** for anything beyond those two approved scopes |
| F — Interop design and its approved slices | 10, 11, 12 | `docs/milestone-f-interop-study` | **COMPLETE** — the study is delivered (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`, `reports/progress_117_interop_study.md`): item 10 Lottie mapping contract, item 11 evaluator profiling plan, item 12 editable-KCS-import product/security plan. **Plan only** for every slice that has not been approved yet. **Item 11 approved and implemented** on `chore/evaluator-profiling-harness` (`reports/progress_118_evaluator_profiling.md`): deterministic scenes, an on-demand harness and a first baseline; measurement only, no caching. **Item 12 first step implemented** on `fix/kcs-import-boundary-hardening` (`reports/progress_119_kcs_import_boundary.md`): a validated import boundary with stable refusal codes and limits; item 10 is designed in `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`, and **item 10's first implementation slice (the Lottie import core) is merged at `ff32d6c`** (`reports/progress_123_lottie_import_core.md`); its **second slice (layer masks + track mattes) is merged at `8670b2a`** (`reports/progress_125_lottie_mask_matte_slice.md`), its **third slice (text, image and precomp layers) is merged at `bda62cb`** (`reports/progress_126_lottie_text_image_precomp_slice.md`), and its **final slice (the import entry point with the report-before-replace UX) is merged at `3b30bff`** (`reports/progress_127_lottie_import_entry_report_ux.md`) — **item 10 is complete**; **item 12 is complete and merged** (the unified import entry with its handoff refresh at `a4f8642`, the OGraf package/editable import at `419fc6a`); and **item 9 Option B** (dependency maintenance) is merged into `main` at `73426e5`. Checkpoint `2026-09-18-after-lottie-core` |
| G — Post-review correctness follow-up | review findings H-01…M-05 | one branch per task (`fix/modal-shortcut-isolation`, `fix/import-serialization-transaction-integrity`, `fix/lottie-structure-correctness`, `fix/ograf-inverse-alpha-matte`, `fix/api-network-trust-boundary`, `fix/evaluator-profile-fixtures`, `fix/state-consistency-live-docs`) | **COMPLETE** — the full-project review's release-blocking findings, taken one at a time: each gets its own branch, its own validation, a read-only self-review and an approval-gated fast-forward merge. H-01 (blocking dialogs left the editor's global commands live) is merged at `0c19751`; H-03/H-04/M-03 (import boundary validation, the track authoring-state round-trip and the document transaction) at `fc672f2`; M-01/M-02/H-05 (Lottie parent resolution, static hierarchy and multi-geometry loss) at `85c3929`; H-02 (the OGraf inverted track matte) at `ac3bda1`; H-06 (the unauthenticated API bound to every interface) at `352d272`; M-04 (the evaluator profile fixtures) at `16e1610`. **M-05** (the live-document reconciliation) is merged at `2b0bba0`, and the shallow-checkout CI regression it caused was fixed at `dcbf9f5`, and the final correctness gate ran on `main` after that fix (`reports/progress_141_astra_correctness_followup_summary.md`): every finding is closed. |
| H — Release finalization and the approval-gated toolchain majors | review follow-up decisions | `chore/ci-typecheck-step`, `chore/jsdom-30-1`, `docs/milestone-h-audit`, `docs/milestone-h-triage`, `docs/milestone-h-release-readiness`, `docs/final-handoff-after-hold` | **NEXT (held)** — **H1–H6 are COMPLETE and merged**: the audit `cc1ce8e`, the required CI type-check fix `b4bf3c0`, the `oxlint` 1.85 triage (deferred), the `jsdom` 30.1.1 bump `c1431db`, the final gate `3b5a2f3` (**RELEASE READY WITH DOCUMENTED DEFERRALS**) and the docs/handoff reconciliation `5b68543`. **H7 = HOLD** by user decision: no tag, release or npm action, and the artefacts stay at `46d2a3e`. This row carries the plan's single NEXT marker because the state checker requires exactly one and the only item the plan still holds is that future release decision — every change to it stays approval-gated. |

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
- Item 9 (dependency and warning maintenance) **requires explicit user approval for anything that touches `package.json`/`package-lock.json`**. The audit is complete (`reports/progress_112_dependency_warning_audit.md`), the approved **Option A** (warning fixes only, no package change) is implemented and **merged** at `3923141` (`reports/progress_113_warning_maintenance.md`); **Option B is merged into `main` at `73426e5`** (`reports/progress_130_dependency_maintenance_option_b.md`); **The `engines` declaration and the npm-12 `allowScripts` question are answered** on `chore/engines-allow-scripts` (`reports/progress_131_engines_allow_scripts.md`) and are **merged into `main` at `1a12d79`**; Option C, deferred by decision, and the deferred `oxlint` 1.85 bump stay approval-gated; `jsdom` 30.1.1 is closed — the bump was taken at `c1431db`.

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

"KCS RELEASE FINALIZATION (Milestone H, approval-gated — currently HELD). Milestone H's work is complete: the release-readiness audit, the CI type-check fix at `b4bf3c0`, the `oxlint` 1.85 and `jsdom` 30.1.x triages (`jsdom` 30.1.1 was taken at `c1431db`) and the final gate (RELEASE READY WITH DOCUMENTED DEFERRALS) are merged, and the live documents and handoff are reconciled at `5b68543`.

The release decision (H7) was taken as a HOLD: the tag `v1.1.0-rc.1`, the GitHub draft prerelease and the package metadata are unchanged at `46d2a3e59e065816d972dcd56951803951b577f6`, and nothing was published. What a future session may take up is a decision, not a fix: **Option C** (the `typescript` 6→7 major and the `vitest` + `@vitest/coverage-v8` 4→5 pair) and the deferred `oxlint` 1.85 bump, each on its own branch with its own validation, or a publish/finalize instruction for the draft. Every package/lockfile/workflow change and every release action needs explicit approval."

Historical notes: "KCS MILESTONE A COMPLETION …" was carried out (five items closed, READY, replayed and fast-forward merged at `077911b`); "KCS MILESTONE B — GRAPH + KEYBOARD ACCESSIBILITY …" was carried out (merged at `96e8f9d`); "KCS MILESTONE C — FIRST EXPORT / ONBOARDING FLOW …" was carried out: implemented on `feat/export-onboarding`, gate-reviewed (READY WITH WARNINGS) and fast-forward merged at `c2dcb22` (see `reports/progress_110_export_onboarding.md`).

---

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
- Runtime and toolchain dependencies were refreshed within their current major versions (React 19.3, Vite 8.3, Vitest 4.1.11, lucide-react 1.47 and the test-library patches) on an isolated branch; the linter kept its previously verified version because the newer one needs work of its own (33 new lint rules), and `jsdom` stayed at 30.0.1 in that refresh. `jsdom` was taken to 30.1.1 later, with the test-environment object-URL shim described above; the `oxlint` 1.85 bump remains deferred.

### Fixed
- The CI step named "TypeScript Type Check" now checks the project: it ran `npx tsc --noEmit`, which builds no referenced project and therefore verified no project file, so a broken type could have merged behind a green tick. The step and the `check` script run `npx tsc -b --pretty false` (151 project files).
- The editor's global commands no longer reach project state while a blocking dialog is open: the shortcut handler now reads the dialog's own `aria-modal` contract, so `Delete`/`Backspace`, undo/redo, copy/paste, duplicate and the tool and zoom keys stay inert until the import report, the confirmation dialog or the naming dialog closes. Each dialog keeps `Escape` for itself, and the naming dialog now handles it at the dialog level (and declares the dialog contract it was missing) so it works from its buttons too.
- An imported scene is now checked against the values the renderers and the evaluator read, not only the fields the apply path touches: a scene version this build does not know, a frame rate or timeline length that is not a positive number, a canvas size that is not a positive number, a non-text `textValue`, a layer without a usable id or z-order, duplicate layer ids, a freeform path the geometry builder cannot walk, a mask without a path, a channel that is not a keyframe list and a keyframe value that is not a finite number are refused with a stable code and the offending path before any state is touched. The legacy `layerId` track shape and every documented default stay accepted.
- A track's `visible`, `editVisible` and `locked` flags and its sequence link are written on export and read back on import, so a muted, canvas-hidden or locked track no longer returns visible after a save/load round-trip. The generated track name, its colour and its expanded flag remain session state and are not persisted.
- Undoing an import now restores the whole document — frame rate, timeline length, canvas size, coordinate contract, scene title and active sequence — together with the layers, animation and sequences, instead of leaving the imported settings on top of the restored scene.
- A Lottie layer's parent is now resolved through the layer index it names (`ind`) rather than through the position of the layer in the array, so a document whose indexes are not sequential, or whose child precedes its parent, imports its hierarchy correctly. A reference no imported layer declares, a layer that names itself, and an index two layers share are reported instead of guessed.
- A Lottie layer that carries more than one geometry item is now reported instead of silently keeping only the last one: KCS draws one path per layer, so the import names what it cannot represent and still imports the layer.
- A layer with no animation track now inherits its parent transform. The hierarchy is resolved for every layer; only the keyframe evaluation is skipped, so a static child is no longer placed at its local position while the same child with an empty track was placed correctly.
- An inverted track matte in an exported OGraf graphic now actually inverts: it is expressed as a luminance mask with a white backdrop and the source painted black, the technique the editor's own matte authority documents, instead of an alpha mask whose black source stayed opaque and left the target unmatted. The inverted luminance matte had the same defect — it had no backdrop, so the mask was transparent everywhere outside the source — and both modes now share one construction. Text matte sources are painted black for the hole as well, instead of keeping their own colour and emitting a duplicate, ignored `fill` attribute. The generated runtime mirrors all of it.
- The REST API now binds `127.0.0.1` instead of every interface, so the unauthenticated project store is reachable from this machine only. Publishing it to a network is an explicit opt-in (`KCS_API_HOST`), and the server warns with what it published and how to undo it. `README.md` and `docs/API.md` state that the API has no authentication and that CORS is not access control.
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

---

## 8. File Inventory

---

Every file present in `chatgpt_handoff/latest/` at generation time:

---

- `CHANGELOG.md` — 14575 bytes
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — 17052 bytes
- `NEXT_SESSION.md` — 11840 bytes
- `OMP_FINAL_RESPONSE.md` — 5242 bytes
- `PROJECT_STATE.md` — 20695 bytes
- `README.md` — 4543 bytes
- `manifest.txt` — 5109 bytes
- `progress_142_release_readiness_audit.md` — 7928 bytes
- `progress_143_ci_typecheck_step.md` — 2791 bytes
- `progress_144_oxlint_1_85_triage.md` — 6194 bytes
- `progress_145_jsdom_30_1_triage.md` — 6486 bytes
- `progress_146_final_release_gate.md` — 5200 bytes
- `progress_147_milestone_h_docs_handoff.md` — 3877 bytes
- `progress_148_final_handoff_after_hold.md` — 4914 bytes
- `progress_149_final_jsdom_state_cleanup.md` — 4781 bytes

---

- Source/test copies present: NO
- Test-glob matching files present: NO
- Desktop\KCS copied: NO
