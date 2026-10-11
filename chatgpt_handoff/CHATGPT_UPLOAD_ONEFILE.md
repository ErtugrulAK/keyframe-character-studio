# KCS ChatGPT One-File Handoff

## 0. Upload Instructions

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. No other file in the
`chatgpt_handoff\latest\` bundle needs to be uploaded.

Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (canonical stable checkout, branch `main`).
Task (2026-10-11): integrate replacement PR #8 into `main` by **fast-forward only**, fully validate the
integrated `main`, run a fresh exact-SHA release smoke, switch the live 5173 QA surface to the canonical
stable repo, and then remove the redundant Desktop Git worktrees **through `git worktree remove` only**.

- Old `main`: `b7a0141501a8057214065734b59915b10cec2e43`
- Integrated `main`: `7712deeb12221a4262f4de9c4ce4d820d1231777` (three commits added, **no merge commit created**)
- Replacement PR: **#8 — MERGED**; old PR #3 remains OPEN, unmerged and superseded — not closed, rewritten or deleted
- Test-only vacuous-assertion fix commit `7abee1783039c606b6fbe6f2263bc09b09640885` — the **TESTED CODE SHA**
- Full validation on integrated `main`: 146 files / 2,234 vitest tests; FULL Chromium suite **334 passed / 0 failed / 0 flaky** with `--retries=0`
- Exact-SHA Release Smoke Gate run `38172157643` on `7abee17`: **success**
- Live preview: UI 5173 switched to the canonical stable repo (vite listener pid 4412, `npx vite` wrapper pid 34504); API 5000 (pid 24896) was never stopped
- Six redundant Desktop worktrees removed with `git worktree remove` only; no branch was deleted
- No tag, no release, no npm publication, no dependency/package/workflow change

The sections below carry the response this task produced, the one-screen manifest, the bundle
README, the live documents at this tip, and the progress record.

---

## 1. OMP Final Response

# KCS — PR #8 integrated by fast-forward, fully validated, exact-SHA smoke passed, 5173 on canonical main, redundant worktrees removed

## Latest action

Replacement **PR #8 was integrated into `main` by fast-forward only**. `git merge --ff-only
origin/fix/ograf-runtime-parity-phase-a-replay` moved `main` from `b7a0141` to `7712dee`, adding three
commits (`023d4d0` application/test, `4e0eebb` group parity test, `7712dee` docs) and creating **no
merge commit** — `git log --merges b7a0141..HEAD` is empty, and GitHub records the fast-forward tip
itself as PR #8's merge commit. The push was a normal fast-forward (`b7a0141..7712dee main -> main`)
and PR #8 is **MERGED**. No branch was deleted and PR #3 was not rewritten, closed or deleted.

One **vacuous assertion** was corrected as a test-only fix: `src/tests/ografExport.test.ts` asserted
`not.toContain('data-layer="g"')`, an attribute no renderer emits because the layer wrapper is
`data-layer-id="<id>"`. A throwaway probe (written, run, deleted) rendered a hidden container and a
painting container: the hidden one emitted no `data-layer-id="g"` but did emit `data-layer-id="a"`
for the child, and the painting one emitted `data-layer-id="g"` while the old form never appeared.
The assertion now targets the real attribute; commit `7abee17` is the final **TESTED CODE SHA** and
no product behaviour changed.

After the smoke passed, live **5173 was switched to the canonical stable repo** and all six
redundant Desktop worktrees were removed with **`git worktree remove` only**.

| Field | Value |
|---|---|
| Repository | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (canonical stable checkout, branch `main`) |
| Old `main` | `b7a0141501a8057214065734b59915b10cec2e43` |
| Integrated `main` | `7712deeb12221a4262f4de9c4ce4d820d1231777` (fast-forward, no merge commit) |
| Tested code SHA | `7abee1783039c606b6fbe6f2263bc09b09640885` |
| PR #8 | **MERGED** (base `main`, head `fix/ograf-runtime-parity-phase-a-replay`) |
| PR #3 | OPEN, unmerged, superseded — untouched, recommended for later closure |
| Smoke run | `38172157643` — SUCCESS on `7abee17` |
| Live preview | `http://localhost:5173/` — vite listener pid 4412 (`npx vite` wrapper pid 34504), canonical repo, `main` application code (tested code SHA `7abee17`) |
| API | `127.0.0.1:5000` — pid 24896, never restarted, `/api/health` 200 |

## Integration record

- FF eligibility was re-proven immediately before merging (`git merge-base --is-ancestor origin/main
  origin/fix/ograf-runtime-parity-phase-a-replay` exits 0; `--left-right --count` = `0 3`).
- Commits added: `023d4d0` `fix: derive ograf runtime parity rules from shared authorities`,
  `4e0eebb` `test: prove the layer-group model in runtime/export parity`, `7712dee` `docs: reconcile
  the live docs and handoff for the runtime parity replay`.
- `git log --merges b7a0141..HEAD` is **empty** — this integration created no merge commit, rewrote
  no history and force-pushed nothing.

## Validation on the integrated `main` (isolated `CI=1 PORT=5008` → UI 5188 / API 5008)

`npx tsc -b --pretty false` clean; `npm run lint` clean; `npm test` **146 files / 2,234 tests**;
`npm run build`; `npm run validate:ograf`; the focused runtime-parity/stacking/matte/generated-parity/
export/grouping set **10 files / 508 tests**; `qa:release` **2 passed**; `qa:v6` **3 passed**;
`npm run check`; `node scripts/check-state-consistency.mjs` **PASS (47 checks)**;
`npm audit --audit-level=low` **0 vulnerabilities**; `git diff --check` clean; and the FULL Chromium
suite with `--retries=0`: **334 passed / 0 failed / 0 flaky**. `npm run dev` was never used.

The gates affected by the test-only commit were re-run at the final code SHA `7abee17`: `npm run
check` (2,234 tests), the focused set (508), both QA gates, the full Chromium suite (334 passed) and
the state checker — all green again.

## Self-review of the integrated diff

- `src/ograf/runtimeSnippets.ts` embeds KCS's own helpers via `Function.prototype.toString`, so the
  runtime carries `compareByStackingOrder` (`src/utils/stackingOrder.ts`) and `resolveMatteSource`
  (`src/utils/matte.ts`) as their single definitions — no build step, no loader, no `eval`, no
  second copy.
- `src/ograf/svgRenderer.ts` delegates matte precedence to the same shared resolver and keeps only
  the SVG-mechanism choice local; the static renderer and the generated runtime agree.
- Ascending-`zIndex` paint order is stable for equal `zIndex` (native stable sort); input arrays are
  copied before sorting and never mutated.
- A disabled Track Matte V2 still falls back to the legacy matte, and a V2 record naming no usable
  source still suppresses the legacy matte — unchanged behaviour. Inverse matte is untouched.
- Group containers: a geometryless container emits no layer element, its children keep the composed
  parent transform and the shared stacking order, and a matte between group siblings resolves
  identically with the same deterministic mask id in both paths.
- No package, schema, public-controls, prototype-key or unrelated UX source change; the diff is the
  four Phase A files plus docs/handoff.

## Exact-SHA release smoke

Release Smoke Gate run **`38172157643`** (`.github/workflows/release-smoke.yml`, verification only,
`permissions: contents: read`), candidate SHA `7abee1783039c606b6fbe6f2263bc09b09640885`,
conclusion **success**: the run checked out the exact requested SHA, passed the expected-SHA
assertion, `npm ci`, the Chromium setup, the OGraf fixture validation and `qa:release`. `7abee17` is
the TESTED CODE SHA; the docs/handoff tip above it is docs-only and was deliberately not
smoke-tested. No tag was created or moved, no release was published or finalized and nothing was
published to npm.

## Live surfaces and worktree cleanup

- 5173: the old final-UX worktree vite process (pid 34956, from
  `keyframe-character-studio-omp-authoring-ux-final`) was stopped; `npx vite --host --port 5173` now
  runs from the canonical stable repo (vite listener pid 4412, `npx vite` wrapper pid 34504), answers 200, and serves `main`'s application code (the tested code SHA `7abee17`)
  including the runtime-parity modules — proved by reading the process working directory and fetching
  the served `src/ograf/runtimeSnippets.ts` and `src/ograf/runtimeTemplate.ts`.
- API 5000: pid **24896**, never stopped or restarted, `/api/health` and `/api/projects` answer 200.
- Removed with `git worktree remove` only, each after proving a clean tree, zero untracked files, a
  branch reachable from `main` or fully pushed to origin, no user data and no dependent process:
  `keyframe-character-studio-omp-authoring-ux` (`7d7ebe2`), `-omp-authoring-ux-final` (`a56ed01`),
  `-omp-camera-invariance` (`55a4ab2`), `-omp-corner-anchor` (`b453ba1`),
  `-omp-runtime-parity-replay` (`7712dee`) and `-omp-runtime-parity` (`f53398f`, PR #3's branch, all
  three commits already on origin).
- The only ignored content was `node_modules/`, `dist/`, `playwright-report/`, `test-results/` and
  `server/db/keyframe_studio.sqlite`; every worktree copy of that SQLite file held exactly the
  seeded row (`sample_sequencer_project`), and the live API uses the canonical database, so nothing
  user-authored was lost.
- `git worktree prune` then listed only the canonical checkout; the Desktop now holds
  `keyframe-character-studio` alone.

## Branches and PRs

Six branches were **retained**: `fix/authoring-ux-transform-toolbar`, `fix/authoring-ux-camera-invariance`,
`fix/authoring-ux-corner-anchor`, `fix/authoring-ux-final-slices`,
`fix/ograf-runtime-parity-phase-a-replay` (all ancestors of `main`) and the superseded
`fix/ograf-runtime-parity-phase-a`. They could be deleted later, but **only with explicit user
approval**; no branch was deleted in this task, and `origin/without-mask` was not touched.

**PR #3** remains OPEN and is now superseded by the merged PR #8 — its application delta is in `main`
and only its docs/handoff bookkeeping is stale. It is **recommended for closure as superseded**, but
it was not closed, rewritten or deleted here; closing it is a separate explicit user decision.

## Constraints honoured

No rebase, no force push, no `reset --hard`, no `git clean`, no manual deletion of a registered
worktree, no branch deletion or rename, no tag create/move/delete, no GitHub release, no npm publish,
no deploy, no dependency/package/workflow change, no OMP global config change, and nothing touching
`origin/without-mask`, `C:\Users\ertugrul.ak\Desktop\KCS` or the canonical stable checkout.

---



## 2. Upload Manifest


# KCS ChatGPT Upload Manifest — PR #8 runtime-parity integration and QA worktree cleanup

Scope: integrate replacement PR #8 into `main` by fast-forward only, fully validate the integrated `main`, run a fresh exact-SHA release smoke, switch live 5173 to the canonical stable repo, and remove the redundant Desktop Git worktrees through `git worktree remove` only. No release, no tag, no npm, no branch deletion, no force push, no rebase, no history rewrite
Repository: C:\Users\ertugrul.ak\Desktop\keyframe-character-studio (canonical stable checkout, branch main)
Integration: git merge --ff-only origin/fix/ograf-runtime-parity-phase-a-replay moved main from b7a0141501a8057214065734b59915b10cec2e43 to 7712deeb12221a4262f4de9c4ce4d820d1231777 (three commits: 023d4d0, 4e0eebb, 7712dee); git log --merges b7a0141..HEAD is empty, so no merge commit was created; normal push b7a0141..7712dee
PR #8: MERGED at 2026-10-11T20:16:03Z with the fast-forward tip recorded as its merge commit; PR #3 (head f53398f) remains OPEN, unmerged and untouched, and no branch was deleted
Integrity: FF eligibility re-proven immediately before the merge (git merge-base --is-ancestor origin/main origin/fix/ograf-runtime-parity-phase-a-replay exits 0; rev-list --left-right --count = "0 3")
Test-only fix: the vacuous assertion not.toContain('data-layer="g"') in src/tests/ografExport.test.ts (no renderer emits data-layer="; the layer wrapper is data-layer-id="<id>") was corrected to not.toContain('data-layer-id="g"'); commit 7abee1783039c606b6fbe6f2263bc09b09640885 is the final TESTED CODE SHA; a throwaway probe proved the old form was unsatisfiable and the real attribute appears as soon as a container paints; no product behaviour changed
Self-review: the generated runtime embeds the canonical compareByStackingOrder (src/utils/stackingOrder.ts) and resolveMatteSource (src/utils/matte.ts); svgRenderer and the generated runtime agree; ascending-zIndex order is stable for equal zIndex; input arrays are not mutated; a disabled Track Matte V2 still falls back to the legacy matte; inverse-matte behaviour is unchanged; group containers emit no layer element while children keep the composed parent transform, the shared stacking order and sibling-matte parity; no package, schema, public-controls, prototype-key or unrelated UX change
Validation (integrated main, isolated CI=1 PORT=5008 -> UI 5188 / API 5008; npm run dev never used): tsc -b clean; oxlint clean; vitest 146 files / 2234 tests; vite build; validate:ograf; focused runtime-parity/stacking/matte/export/grouping 10 files / 508 tests; qa:release 2 passed; qa:v6 3 passed; npm run check; check-state-consistency PASS (47 checks); npm audit --audit-level=low 0 vulnerabilities; git diff --check clean; FULL Chromium npx playwright test --retries=0 = 334 passed / 0 failed / 0 flaky
Validation at the final code SHA 7abee17: npm run check green (2234 tests), focused set 508 passed, qa:release 2 passed, qa:v6 3 passed, FULL Chromium 334 passed / 0 failed, check-state-consistency PASS
Smoke: Release Smoke Gate run 38172157643, candidate_sha 7abee1783039c606b6fbe6f2263bc09b09640885, conclusion success (exact-SHA checkout asserted, npm ci, Chromium setup, OGraf fixture validation and qa:release all passed); verification-only workflow; no tag, release or npm action
Live surfaces: UI 5173 switched from the final-UX worktree (pid 34956) to the canonical stable repo via npx vite --host --port 5173 (vite listener pid 4412, npx wrapper pid 34504), answers 200 and serves main's application code (tested code SHA 7abee17) including the runtime-parity changes; API 5000 (pid 24896) was never stopped and /api/health answers 200
Worktrees removed with git worktree remove only (each clean, zero untracked files, branch reachable from main or fully pushed, no user data, no dependent process): keyframe-character-studio-omp-authoring-ux, -omp-authoring-ux-final, -omp-camera-invariance, -omp-corner-anchor, -omp-runtime-parity-replay, -omp-runtime-parity; git worktree prune then listed only the canonical checkout; the only ignored content was node_modules, dist, playwright-report, test-results and the seeded SQLite file
Branches: none deleted; fix/authoring-ux-transform-toolbar, fix/authoring-ux-camera-invariance, fix/authoring-ux-corner-anchor, fix/authoring-ux-final-slices, fix/ograf-runtime-parity-phase-a-replay and fix/ograf-runtime-parity-phase-a all remain locally and on origin; the merged/superseded set is recommended for later deletion only with explicit approval
PR #3: OPEN and superseded by the merged PR #8 (its application delta is now in main); recommended for closure as superseded, but it was NOT closed, rewritten or deleted in this task
Tested code SHA vs docs tip: the smoke tested 7abee1783039c606b6fbe6f2263bc09b09640885; the docs/handoff reconciliation commit above it changes no source, test, workflow, package or asset byte and was deliberately not smoke-tested
Desktop: C:\Users\ertugrul.ak\Desktop\keyframe-character-studio is now the only keyframe-character-studio folder; C:\Users\ertugrul.ak\Desktop\KCS still exists and was untouched; the guarded path ograf-graphics does not exist on this machine
Release state: no tag was created, moved or deleted; no release was published or finalized; nothing was published to npm; no dependency, package, workflow or OMP configuration change; v1.1.0-rc.2 remains the published prerelease at its historical candidate, and v1.1.0-rc.1 (46d2a3e59e065816d972dcd56951803951b577f6) plus v1.1.0-public-controls are unchanged
Protected: origin/without-mask, .hermes/desktop-attachments/, release artefacts, OMP configuration and every denied path were not touched

Bundle source files (9):
- CHANGELOG.md
- KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md
- KCS_RELEASE_CANDIDATE_SUMMARY.md
- NEXT_SESSION.md
- OMP_FINAL_RESPONSE.md
- PROJECT_STATE.md
- README.md
- manifest.txt
- progress_164_ograf_runtime_parity_integration.md

Upload only chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md. No other file in the latest bundle needs to be uploaded.

---



## 3. Bundle README


# KCS Minimal ChatGPT Upload Bundle — PR #8 runtime-parity integration and QA worktree cleanup

Task-specific handoff for integrating replacement PR #8 into `main` by fast-forward only, fully
validating the integrated `main`, running a fresh exact-SHA release smoke, switching live 5173 to the
canonical stable repo, and safely removing the redundant Desktop Git worktrees (2026-10-11). This is
not an archive.

## Current truth

`main` is at or after `7abee17`, matching `origin/main`.

| Field | Value |
|---|---|
| Repository | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (canonical stable checkout, branch `main`) |
| Old `main` | `b7a0141501a8057214065734b59915b10cec2e43` |
| Integration | `git merge --ff-only origin/fix/ograf-runtime-parity-phase-a-replay` → `main` = `7712deeb12221a4262f4de9c4ce4d820d1231777`, **no merge commit created** |
| Commits added | `023d4d0`, `4e0eebb`, `7712dee` |
| Replacement PR | **#8 — MERGED** (GitHub records the fast-forward tip as its merge commit) |
| Test-only fix commit | `7abee1783039c606b6fbe6f2263bc09b09640885` — the **TESTED CODE SHA** |
| Old PR #3 | **OPEN**, unmerged, superseded — not rewritten, not closed, branch not deleted |
| Live preview | `http://localhost:5173/` — vite listener pid 4412 (`npx vite` wrapper pid 34504), started from the canonical repo |
| API | `127.0.0.1:5000` — pid 24896, unchanged |

## What changed

- The integrated diff is exactly the four Phase A files (`src/ograf/runtimeSnippets.ts`,
  `src/ograf/runtimeTemplate.ts`, `src/ograf/svgRenderer.ts`, `src/tests/ografRuntimeParity.test.ts`)
  plus docs/handoff. The generated runtime embeds KCS's canonical `compareByStackingOrder` and
  `resolveMatteSource`; the static renderer and the runtime agree; a disabled Track Matte V2 still
  falls back to the legacy matte; group containers render nothing while their children keep the
  composed parent transform and the shared stacking order.
- One vacuous assertion in `src/tests/ografExport.test.ts` (`not.toContain('data-layer="g"')`, an
  attribute no renderer emits — the wrapper is `data-layer-id="<id>"`) was corrected to
  `not.toContain('data-layer-id="g"')` as a test-only fix. A throwaway probe proved the old form could
  never fail while the real attribute appears as soon as a container paints.

## Validation (isolated `CI=1 PORT=5008` → UI 5188 / API 5008)

`tsc -b` clean, oxlint clean, vitest **146 files / 2,234 tests**, `vite build`, `validate:ograf`,
the focused runtime-parity/stacking/matte/export/grouping set **10 files / 508 tests**,
`qa:release` **2 passed**, `qa:v6` **3 passed**, `npm run check`, `check-state-consistency`
**PASS (47 checks)**, `npm audit --audit-level=low` **0 vulnerabilities**, `git diff --check` clean,
and the FULL Chromium suite `npx playwright test --retries=0`: **334 passed / 0 failed / 0 flaky**.
The gates affected by the test-only commit were re-run at the final code SHA `7abee17` and were green
again.

## Exact-SHA release smoke

Release Smoke Gate run **`38172157643`**, candidate SHA `7abee1783039c606b6fbe6f2263bc09b09640885`,
conclusion **success** — exact-SHA checkout asserted, `npm ci`, Chromium setup, OGraf fixture
validation and `qa:release` all passed. No tag, release or npm action was taken.

## Live surfaces and worktree cleanup

- 5173 was switched to the canonical stable repo: the old worktree vite process (pid 34956) was
  stopped and `npx vite --host --port 5173` was started from
  `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (vite listener pid 4412, `npx vite` wrapper
  pid 34504). API 5000 (pid 24896) was never
  stopped.
- All six redundant Desktop worktrees were removed with **`git worktree remove` only**, after each
  passed every safety check (clean tree, zero untracked files, branch reachable from `main` or fully
  pushed, no user data, no dependent process): `keyframe-character-studio-omp-authoring-ux`,
  `-omp-authoring-ux-final`, `-omp-camera-invariance`, `-omp-corner-anchor`,
  `-omp-runtime-parity-replay`, `-omp-runtime-parity`. `git worktree prune` then listed only the
  canonical checkout.
- No branch was deleted. PR #3 remains OPEN and is recommended for closure as superseded by the
  merged PR #8 — a separate explicit user decision.

## Next step

Continue QA against 5173, which now serves the canonical `main`. Any further release or stable
decision requires a new explicit user instruction and a fresh exact-SHA smoke on any later code
change; no tag was created or moved, no release was published or finalized, and nothing was published
to npm.

## Evidence and files

- `reports/progress_164_ograf_runtime_parity_integration.md` — the full record (integration, validation
  counts, self-review, smoke, 5173 switch, per-worktree inventory and removals, branch/PR audit).

## Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. No other file in this bundle needs to be
uploaded.

---



## 4. PROJECT_STATE.md (live)


# KCS Project State

## Current position

The accepted product and security follow-up line is integrated into `main`, the grouped post-RC roadmap has completed milestones A–G, and `main` is at or after `37904fb`. Milestone F and the post-review correctness follow-up are complete. Milestone H is complete through H6 with its release decision held (H7). The completed Authoring UX stacked PR chain (PRs #4–#7) is integrated into `main` by four fast-forward-only merges, and the OGraf runtime-parity replacement PR #8 was then integrated the same way: `main` is at or after `7abee17`, matching `origin/main`. The subsequent five-task maintenance run is also integrated: dialog focus restoration (`5cb8a45`), runtime SQLite repository hygiene (`b3f3c6c`), the exact API CORS allowlist (`2a313d7`), Oxlint 1.85 adoption (`feca773`), and TypeScript 7 / Vitest 5 (`37904fb`). The post-hold Astra remediation is integrated as well: findings F-01…F-10 are closed through `8a4ca22`, one branch and one focused regression per finding (`reports/progress_151_astra_remediation.md`). The post-compaction Astra review of the uncommitted authoring work then closed all 16 of its findings (A-01…A-05, B-01…B-04, C-01…C-03, D-01…D-03, DOC-01) and published them as six commits on `main` on 2026-10-07; see the section below and `reports/progress_152_post_astra_focused_remediation.md`.

Annotated tag `v1.1.0-rc.1` was created and pushed at workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`. The GitHub release exists as a draft prerelease; no npm publication occurred.

**Checkpoint `2026-09-18-after-lottie-core`** (`docs/checkpoints/2026-09-18-after-lottie-core/`) records the state it was written from: `main` stood at `47d3368a2b54…` then, the Lottie import core (Milestone F item 10, first slice) was merged with `--no-ff` at `ff32d6c` and pushed, and its branch `feat/lottie-import-core` is kept at `f76ae6a` as the review artefact. The checkpoint folder carries the summary (`README.md`), the tasklist (`TASKLIST.md`), a copy-paste next-session prompt (`RESUME_PROMPT.md`) and a machine-readable summary (`STATE.json`); the task record is `reports/progress_124_checkpoint_after_lottie_core.md`. The Milestone F study is merged (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`); **item 11 (evaluator profiling) is implemented** on `chore/evaluator-profiling-harness` as measurement only (`reports/progress_118_evaluator_profiling.md`), **item 12’s first step (validated import boundary)** is merged at `44218a6` (`reports/progress_119_kcs_import_boundary.md`), its **product half** (compatibility matrix executed as fixtures, the legacy migration report, and the autosave restore routed through the same boundary) is implemented on `feat/kcs-import-product-half` (`reports/progress_121_kcs_import_product_half.md`), and **item 10’s mapping design** is delivered in `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`; item 10’s **first implementation slice (the import core)** is **merged into `main`** at `ff32d6c` (`reports/progress_123_lottie_import_core.md`), its **second slice — layer masks + track mattes — is merged at `8670b2a`** (`reports/progress_125_lottie_mask_matte_slice.md`), its **third slice — text, image and precomp layers — is merged at `bda62cb`** (`reports/progress_126_lottie_text_image_precomp_slice.md`), and its **final slice — the import entry point with the report-before-replace UX — is merged at `3b30bff`** (`reports/progress_127_lottie_import_entry_report_ux.md`): the entry point that slice added was later folded into the single `Import` control in the header, which classifies the chosen file by its content — a Lottie document parses in memory, shows blockers and losses before anything is applied, cancels as a true no-op, applies only on an explicit confirm through the existing project authority, and reconciles imported layer types onto existing KCS types the OGraf export accepts; item 10 is therefore complete. Milestone F item 10 is then complete apart from the follow-ups listed below.

- Task 105 (export diagnostics remediation UX): blocking OGraf export diagnostics carry a stable title, the failing layer or feature, and a concrete next step; warnings are grouped into one non-blocking notification; user-authored values are formatted at every construction site so machine paths, URL credentials/query, embedded payloads, and raw OS messages never reach a diagnostic, a thrown error, or a toast.
- Task 107 (track-matte source selection affordance): the matte source relation, whichever model holds it, is resolved by one shared helper that mirrors the rendered relationship, so the outliner indicator shows what the stage actually applies; the Track Matte V2 card keeps its self-excluded source list, `None` clearing, and field preservation, and unnamed layers fall back to their ids in both source pickers.
- **Milestone A (canvas tangent handle authoring) — MERGED.** Selecting a single freeform layer in edit mode shows its vertices on the stage; clicking a vertex reveals its Bezier tangent handles; dragging a handle reshapes the rendered path live; double-clicking a vertex toggles corner ↔ smooth with neighbour-derived symmetric handles. One history entry per completed drag; `Escape` cancels a drag without recording one.
  - Integration path: the original branch `feat/canvas-tangent-authoring` was reviewed across six rounds (final verdict `READY`, all five findings closed) and replayed onto current `main` as `feat/canvas-tangent-authoring-replay`, then fast-forward merged. No rebase, no merge commit, no force push, no history rewrite.
  - Not covered: vertex add/remove, multi-vertex transforms, keyboard nudging, handle constraints, boolean or trim-enabled freeform layers, broadcast mode.

The release tag `v1.1.0-public-controls` remains unchanged. The `without-mask` branch remains a preserved archive candidate.

## Authoring UX stacked PR integration — 2026-10-11

- The completed Authoring UX stacked PR chain was integrated into `main` in order by four **fast-forward-only** merges that created no merge commit and rewrote no history: PR #4 `fix/authoring-ux-transform-toolbar` (`c46e698` → `7d7ebe2`), PR #5 `fix/authoring-ux-camera-invariance` (`7d7ebe2` → `55a4ab2`), PR #6 `fix/authoring-ux-corner-anchor` (`55a4ab2` → `b453ba1`), and PR #7 `fix/authoring-ux-final-slices` (`b453ba1` → `a56ed01`). Each step proved `git merge-base --is-ancestor main origin/<head>` first and used `git merge --ff-only`; PRs #4–#7 are **MERGED** and no branch was deleted.
- The integrated code tip is `a56ed017e1df804e255842ca81ef1108b9b48ebc` and `main` at or after `a56ed01`, matching `origin/main`.
- Full post-merge validation on that exact checkout was green: `npx tsc -b --pretty false`, `npm run lint`, `npm test` (145 files / 2,219 tests), `npm run build`, `npm run validate:ograf`, both QA gates (`qa:release` 2 tests, `qa:v6` 3 tests), `npm run check`, `node scripts/check-state-consistency.mjs` (43 checks), `npm audit --audit-level=low` (0 vulnerabilities) and `git diff --check`. The FULL Chromium suite ran with `--retries=0`: **334 passed, 0 failed, 0 flaky**. No assertion was weakened and no new contract test was skipped.
- A fresh verification-only exact-SHA Release Smoke Gate ran on the integrated tip: run `38166764216`, candidate SHA `a56ed017e1df804e255842ca81ef1108b9b48ebc`, conclusion **success** (2026-10-11T19:08:41Z → 19:09:24Z). It resolved the checkout to that SHA, passed the expected-SHA assertion, `npm ci`, the Chromium setup, the OGraf fixture validation and `qa:release`.
- The live QA preview was switched to the canonical stable repo on 2026-10-11: UI 5173 now serves `keyframe-character-studio` from `main`, whose application code is the tested code SHA `7abee17` (started as `npx vite --host --port 5173`), so it is the current QA surface; API 5000 (pid 24896) was never stopped or restarted.
- `fix/ograf-runtime-parity-phase-a` (PR #3) stays **OPEN** and unmerged, and is now **superseded by the merged PR #8**: its application delta (`src/ograf/runtimeSnippets.ts`, `src/ograf/runtimeTemplate.ts`, `src/ograf/svgRenderer.ts`, `src/tests/ografRuntimeParity.test.ts`) is in `main`, and only its docs/handoff bookkeeping is stale. Closing it is a separate explicit user decision. The audit recommendation (B) — a controlled sync/replay — was carried out and integrated; see the section below.
- No tag was created or moved, no release was published or finalized, and nothing was published to npm. The published `v1.1.0-rc.2` prerelease remains tied to its historical smoke-tested candidate, and `v1.1.0-rc.1` plus `v1.1.0-public-controls` are unchanged. Any future stable or RC decision requires a new explicit user instruction and a new exact-SHA smoke on any later code change.

## OGraf runtime parity integrated into `main` (PR #8) + QA worktree cleanup — 2026-10-11

- Replacement **PR #8 was integrated into `main` by fast-forward only**: `git merge --ff-only origin/fix/ograf-runtime-parity-phase-a-replay` moved `main` from `b7a0141501a8057214065734b59915b10cec2e43` to `7712deeb12221a4262f4de9c4ce4d820d1231777`, adding three commits (`023d4d0`, `4e0eebb`, `7712dee`) and creating **no merge commit** (`git log --merges b7a0141..HEAD` is empty). PR #8 is MERGED; GitHub records the fast-forward tip as its merge commit. No branch was deleted and PR #3 was not rewritten or closed.
- The integrated diff is exactly the four Phase A files (`src/ograf/runtimeSnippets.ts`, `src/ograf/runtimeTemplate.ts`, `src/ograf/svgRenderer.ts`, `src/tests/ografRuntimeParity.test.ts`) plus docs/handoff. No package, dependency, workflow, script or unrelated source change.
- Self-review confirmed the generated runtime embeds the canonical `compareByStackingOrder` (`src/utils/stackingOrder.ts`) and `resolveMatteSource` (`src/utils/matte.ts`); the static renderer and the runtime agree; the ascending-`zIndex` order is stable for equal `zIndex`; input arrays are never mutated; a disabled Track Matte V2 still falls back to the legacy matte; inverse-matte behaviour is unchanged; group containers render no element while their children keep the composed parent transform and the shared stacking order, and a matte between group siblings resolves identically.
- One vacuous assertion in `src/tests/ografExport.test.ts` (`not.toContain('data-layer="g"')` — an attribute no renderer emits, since the layer wrapper is `data-layer-id="<id>"`) was corrected to `not.toContain('data-layer-id="g"')` as a test-only fix, commit `7abee1783039c606b6fbe6f2263bc09b09640885`. A throwaway probe showed the old form is unsatisfiable while the real attribute appears as soon as a container paints.
- Full post-merge validation on the integrated `main` was green: `npx tsc -b --pretty false`, `npm run lint`, `npm test` (146 files / 2,234 tests), `npm run build`, `npm run validate:ograf`, the focused runtime-parity/stacking/matte/export/grouping set (10 files / 508 tests), `qa:release` (2), `qa:v6` (3), `npm run check`, `node scripts/check-state-consistency.mjs` (47 checks), `npm audit --audit-level=low` (0 vulnerabilities), `git diff --check`, and the FULL Chromium suite with `--retries=0`: **334 passed, 0 failed, 0 flaky**. All E2E ran isolated (`CI=1 PORT=5008` → UI 5188 / API 5008); `npm run dev` was never used. The gates affected by the test-only commit were re-run at the final code SHA `7abee17` and were green again.
- **Exact-SHA Release Smoke Gate** on the final code SHA: run `38172157643`, candidate SHA `7abee1783039c606b6fbe6f2263bc09b09640885`, conclusion **success** — exact-SHA checkout asserted, `npm ci`, Chromium setup, OGraf fixture validation and `qa:release` all passed. `7abee17` is the TESTED CODE SHA; the docs tip above it is docs-only and was deliberately not smoke-tested.
- All six redundant Desktop worktrees were removed **with `git worktree remove` only** after every safety check (clean tree, zero untracked files, branch reachable from `main` or fully pushed, no user data, no dependent process): `keyframe-character-studio-omp-authoring-ux`, `-omp-authoring-ux-final`, `-omp-camera-invariance`, `-omp-corner-anchor`, `-omp-runtime-parity-replay` and `-omp-runtime-parity`. `git worktree prune` then listed only the canonical checkout. The only ignored content was build/test output and the seeded SQLite file, and the live API uses the canonical database.
- The six branches were **not deleted**; PR #3 stays OPEN and superseded by the merged PR #8. No tag was created or moved, no release was published, nothing was published to npm.
- Record: `reports/progress_164_ograf_runtime_parity_integration.md`.

## Post-Astra focused remediation publication — 2026-10-07

The Astra post-compaction review found 16 concrete defects in the authoring work that was sitting uncommitted on `main` (3 HIGH, 12 MEDIUM, 1 LOW; no BLOCKER). All 16 are closed, published as six commits on `main`, and covered by focused regressions.

- Commit groups: text Boolean geometry `a3f5b09`; bonded layer movement `78450f5`; timeline curve targeting `0a20dd6`; Playfair OGraf portability `aa392a9`; the pre-existing visual-only editor refresh `fb8ed96`; this documentation reconciliation.
- HIGH: a quoted or fallback-list font family traced no Boolean geometry; a parented bonded layer dragged by a local-space delta (buddy 300 -> 210 instead of 310); the Motion Curves modal wrote a curve into the wrong layer when the selected layer had no canonical channel data.
- MEDIUM: the text-outline cache kept a pre-load raster; a failed operand was silently dropped so a three-operand Subtract ran as a two-box Subtract; a closed freeform ring closed on the wrong vertex; SVG/Canvas whitespace disagreed; a multi-selection propagated only the primary bond; a moving ancestor applied its delta twice; an X-only bond edit rewrote the partner's Y animation; mask curve edits never reached persisted mask state; a zero-duration segment was offered as editable; a fallback-list family produced an invalid `@font-face` identity; the legacy single-file export dropped its packaged font and license; a 4-byte sfnt signature was accepted as a valid owned font.
- LOW: live documents listed the no-op root `npx tsc --noEmit` as project type-check evidence.
- The Playfair Display correction and the visual-only editor refresh from the previous working tree are now committed unchanged in substance; the three owned Playfair files (normal TTF, italic TTF, OFL.txt) are tracked.
- Real Chromium proof: family matrix and whitespace parity for the text trace, the font load -> settled retrace, an untraceable operand refusing the Boolean, a parented bonded drag against a calibration group, and the legacy single-file export refusing an asset-dependent graphic while an asset-free graphic still exports.
- This publication added no dependency, workflow, package, tag, release, or npm change; at that point the release artefacts were still at `46d2a3e`.
- The dependency advisories recorded here were then resolved in a separate bounded maintenance run: `proxy-addr`, `source-map-js` and `fast-uri` by lock refreshes inside their parents' declared ranges, and `shell-quote` by a scoped `overrides` entry under `concurrently` (which pins the exact vulnerable version and has no newer release). `npm audit --audit-level=low` now reports 0 vulnerabilities; see `reports/progress_153_dependency_advisory_maintenance.md`.

## Authoring publication — 2026-10-05

- The pending authoring work adds position-only layer bonds, text/freeform Boolean operands, text stroke parity between canvas and OGraf, and an opacity keyframe control. Timeline segment editing, transport layout, media/text drawers, and sidebar transitions are reconciled with the existing authorities.
- Same-frame property edits now match the sequence identity. Edit-mode stage rendering evaluates the active sequence instead of hardcoding `Sequence`; the selection gizmo and painted geometry follow the same authored pose. Broadcast retains its runtime sequence selection.
- Browser proof: a keyframed circle in the second sequence moves 100 screen pixels right and 40 down; the first sequence's x value remains -100. A bonded circle/text pair moves by the same -60/+20 screen-pixel delta.
- Six meaningful publication groups use owner-approved retrospective author dates: 2026-08-29, 2026-09-05, 2026-09-12, 2026-09-19, 2026-09-26, and 2026-10-05. Committer dates record actual creation; these dates do not claim uploads or development occurred on those earlier days. No empty commits, old-branch replay, shared-history rewrite, or force push is part of this publication.
- The old tangent and presentation review branches remain historical artefacts. The pre-architecture mask-gizmo patch is not replayed. Release tags, the held draft release, package publication, external QA folders, and OMP configuration remain unchanged.
- Dependency warning at that time: one moderate `fast-uri` advisory (GHSA-hrr3-gc8f-f4qj), subsequently resolved with the other advisories in `reports/progress_153_dependency_advisory_maintenance.md`. No `npm audit fix` was run in this publication.

## Accepted baseline

Public Controls V1, OGraf Package Export V2, host compatibility work, Windows path hardening, parent/broadcast hardening, SourcePath/filesystem hardening, mask/matte parity, deterministic OGraf fixture validation, the isolated release smoke gate, the export diagnostics remediation UX, the track-matte source selection affordance, and Milestone A canvas tangent handle authoring are present in the accepted main line. OMP tooling remains separate.

## v1.1.0-rc.2 PUBLIC PRERELEASE published — 2026-10-08

- The existing `v1.1.0-rc.2` draft was published as a **public prerelease**: release id `RE_kwDOTexJrc4YPnCt`, `isDraft: false`, `isPrerelease: true`, `publishedAt` 2026-10-08T13:11:16Z, public at https://github.com/ErtugrulAK/keyframe-character-studio/releases/tag/v1.1.0-rc.2. The same release object was transitioned; no release was recreated, no tag was created or moved, and nothing was marked latest-stable.
- The candidate is the exact smoke-tested code commit `6c27ef35d48d61a5e1163d2c91734c864fcafa01` (Release Smoke Gate run `37752015020`). Its annotated release still dereferences to that commit, with the same tag object.
- `v1.1.0-rc.1` is unchanged at `46d2a3e59e065816d972dcd56951803951b577f6` and its draft prerelease is untouched. The package remains private at metadata version `1.1.0-rc.1`; npm returns 404.
- **This is NOT a stable release.** The next input is the user QA pass against this prerelease. A stable release, a further candidate, or any code-affecting commit remains a separate explicit decision, and any code-affecting commit requires a new exact-SHA smoke run.
- Record: `reports/progress_156_rc2_prerelease_publish.md` (publication + post-publish verification + the QA checklist).

## H7 GO — v1.1.0-rc.2 release candidate — 2026-10-08

- The approved H7 GO decision was executed: a NEW release candidate was cut from the exact smoke-tested code commit. The candidate commit is `6c27ef35d48d61a5e1163d2c91734c864fcafa01`, verified by Release Smoke Gate run `37752015020`.
- The annotated candidate `v1.1.0-rc.2` dereferences to exactly that commit. Its GitHub release entry was created as a draft prerelease with `targetCommitish` pinned to the same commit, and was then PUBLISHED AS A PUBLIC PRERELEASE on 2026-10-08 (release id `RE_kwDOTexJrc4YPnCt`, `publishedAt` 2026-10-08T13:11:16Z, still `prerelease: true`, never a stable release).
- The earlier candidate is untouched: `v1.1.0-rc.1` still dereferences to `46d2a3e59e065816d972dcd56951803951b577f6` and its draft prerelease is unmodified.
- Package metadata decision (PATH A): the package stays private at the metadata version `1.1.0-rc.1`. The candidate is the exact smoke-tested commit, and no untested metadata commit was introduced; npm remains unpublished.
- The documentation tip `c650da18c731dfac85d31ba00d059a8430c40b43` is newer than the candidate and is docs-only — no source, test, workflow, package, lock or asset byte differs — so the candidate identity is unchanged and the docs tip is NOT itself smoke-tested.
- Record: `reports/progress_155_h7_rc2_release.md`. The state checker still pins `v1.1.0-rc.1` to `46d2a3e` (that candidate must never move); adding rc.2 to the checker is a separate tooling change requiring approval.

## Exact-SHA release smoke gate — 2026-10-08

- The manual `Release Smoke Gate` workflow was dispatched against the exact candidate and passed: run `37752015020`, **TESTED CODE SHA `6c27ef35d48d61a5e1163d2c91734c864fcafa01`**, 46 s, every step `success`.
- The workflow is verification-only (`permissions: contents: read`, checks out the `candidate_sha` input, asserts `git rev-parse HEAD == EXPECTED_SHA`, then `npm ci` + Chromium + `npm run qa:release`). It cannot tag, release or publish.
- Independently read from the run log: the runner's `EXPECTED_SHA` was the candidate, the gate printed `Release gate candidate SHA: 6c27ef3…`, the OGraf fixture validated, both Chromium specs passed (`2 passed`), and the gate printed `Release gate passed for candidate SHA: 6c27ef3…`.
- What it proves: the candidate installs from its own lockfile on a fresh runner, the OGraf fixture validates offline, a materialized KCS OGraf package interoperates with Chromium, and the editor exports an OGraf ZIP through the UI. What it does not prove: the Vitest suite, the full Chromium suite, the API/SQLite/CORS posture, or any other SHA — including this documentation tip.
- **Candidate identity:** `6c27ef3` is the tested CODE sha. This documentation commit moves the tip forward without changing a source, test, workflow, package or asset byte, and is not itself smoke-tested. A later release decision must treat `6c27ef3` as the tested candidate and re-run the gate on any later SHA that changes code.
- Record: `reports/progress_154_exact_sha_release_smoke.md`. That run changed no tag, release, package version or npm state.

## Dependency advisory maintenance — 2026-10-08

- A fresh `npm audit --audit-level=low` reported five advisories (3 critical, 1 high, 1 moderate). All are resolved without a direct dependency, script, engine, workflow or source change: `proxy-addr` 2.0.7 -> 2.0.8, `source-map-js` 1.2.1 -> 1.2.2 and `fast-uri` 3.1.7 -> 3.1.8 are lock refreshes inside their parents' declared ranges, and `shell-quote` 1.9.0 -> 1.12.0 uses a scoped `overrides` entry under `concurrently` (exact pin, no newer release).
- Reachability was proven from code, not assumed: Express only evaluates the proxy chain through `req.ip`/`req.ips` and KCS never sets `trust proxy`, and concurrently's only `quote()` consumer requires additional CLI arguments the `dev` script never passes.
- The runtime checks after the install confirm the security posture is unchanged: the API still binds `127.0.0.1` by default, the exact CORS allowlist is unchanged, `/api/health` answers on loopback, and the `sqlite3` native binding round-trips.
- The full gate is green: 135 Vitest files / 2,055 tests, 268 Chromium tests with `--retries=0`, `npm run check`, OGraf validation, both QA gates, the state consistency check, and `git diff --check`.
- The `overrides` entry is a temporary bridge and should be removed once `concurrently` declares `shell-quote >= 1.11.0`. That task took no tag, release or npm action.

## Validation status — post-Astra focused remediation, 2026-10-07

| Area | Status | Evidence |
|---|---|---|
| Full Vitest | PASS | 135 files / 2,055 tests; `npm test` |
| OGraf fixture validation | PASS | `npm run validate:ograf` — offline against the vendored closure |
| OGraf release smoke | PASS | `npm run qa:release`; 2 Chromium tests |
| Full Chromium | PASS | 268 tests; `npx playwright test --retries=0`; V6 QA also passes its 3 tests |
| State consistency | PASS | `node scripts/check-state-consistency.mjs` — 35 checks |
| TypeScript | PASS | TypeScript 7.0.2; `npx tsc -b --pretty false` and the build/check paths pass |
| Lint | PASS | Oxlint 1.85.0 clean, including unused-disable reporting at error severity |
| Production build | PASS | Vite 8.3.0 production bundle |
| Dependency audit | PASS | `npm audit --audit-level=low`: 0 vulnerabilities after the bounded remediation in `reports/progress_153_dependency_advisory_maintenance.md` |
| Publication CI | SEPARATE REMOTE GATE | Checked after normal push; inspect the publication tip's GitHub Actions run rather than treating earlier Astra/maintenance CI as current evidence |

## Post-review correctness follow-up (complete)

The full-project review's release-blocking findings are closed, one task at a time and one branch each: **H-01** at `0c19751`, **H-03/H-04/M-03** at `fc672f2`, **M-01/M-02/H-05** at `85c3929`, **H-02** at `ac3bda1`, **H-06** at `352d272`, **M-04** at `16e1610`, **M-05** at `2b0bba0`. The final correctness gate and finding map are in `reports/progress_141_astra_correctness_followup_summary.md`. Its later maintenance observations are now closed: the tracked runtime SQLite file at `b3f3c6c`, unrestricted browser CORS at `2a313d7`, and dialog opener focus restoration at `5cb8a45`.

## Post-hold Astra remediation (complete)

The Astra audit's findings are closed, one branch and one focused regression each: **F-01** mixed legacy/channel round trip at `2c6e013`; **F-02** legacy import validation at `b8718d2`; **F-03** Lottie numeric property forms at `e19b5fe`; **F-04** OGraf procedural animation at `8002659`; **F-05** archive size accounting at `3fa71ff`; **F-06** dropped-media persistence at `645927a`; **F-07** preset storage boundaries at `c12d773`; **F-08** naming-dialog focus lifecycle at `4cd276b`; **F-09** React `act` warnings at `8a4ca22`; **F-10** the stale live-document claims this reconciliation closes. The record, the reproduction evidence and the remaining limitations are in `reports/progress_151_astra_remediation.md`. An OGraf export now refuses a scene whose layer carries an in/out motion preset (`OGRAF_UNSUPPORTED_PROCEDURAL`) because the generated runtime renders the timeline only — that is a deliberate capability boundary, not a defect.

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
- Milestones A–G and H1–H6 are complete, and the H7 release decision has since been executed (the `v1.1.0-rc.2` candidate is a published prerelease awaiting the user QA pass). The maintenance follow-ups previously listed as deferred or open are closed through `37904fb`: dialog focus restoration, SQLite repository hygiene, the API CORS allowlist, Oxlint 1.85, and TypeScript 7 / Vitest 5. No further package, workflow, tag, release, or npm action is implicit; each requires explicit approval.
- Publish/finalize the GitHub draft only with further explicit user instruction.
- No npm publication occurred; package remains private at `1.1.0-rc.1`.
- Branch cleanup needs approval: `feat/canvas-tangent-authoring-replay` was replayed into `main` at `077911b` and is now behind it (the branch is kept only as an artefact); `feat/canvas-tangent-authoring` is kept as the Milestone A review artefact.

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
- What it adds: timeline keyframe diamonds are named, focusable buttons (`Enter`/`Space` selects the keyframe and moves the playhead, `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order and are consumed at the ends); the value graph is a labelled group whose keyframe points are Tab-reachable and announced with frame and value, editable with the arrow keys; decorative SVG geometry is hidden from assistive technology; focus rings were added for the diamonds and the graph points.
- Review: one focused round returned BLOCKED (3 findings, 6 documentation over-claims) — all closed; the re-review returned READY WITH WARNINGS.
- Validation: 109 files / 1,652 Vitest tests, `validate:ograf`, `qa:release`, build, TypeScript, lint, `git diff --check`, plus the real-browser spec `e2e/graph-accessibility.spec.ts`.
- Out of scope (unchanged): graph engine or evaluator changes, new shortcut registry, keyframe model or drag redesign, new dependencies, release/package/workflow changes.
- **Milestone D item 6 — state consistency check — MERGED** at `b91e8b9` (follow-up `be76df9`): `node scripts/check-state-consistency.mjs` fails when the live docs contradict the tag/`main` SHA, when the roadmap and the next action disagree, when the handoff upload instruction is superseded, or when the bundle carries source/test/binary copies, collapsed Windows paths or secret markers (see `reports/progress_111_state_hygiene_gate.md`).
- **Item 9 (dependency and warning maintenance) — COMPLETE.** Option A merged at `3923141`; Option B merged at `73426e5` and brought `npm audit` to zero; `engines`/npm-12 `allowScripts` merged at `1a12d79`; `jsdom` 30.1.1 was taken at `c1431db`; Oxlint 1.85 was adopted at `feca773`; and TypeScript 7 plus Vitest and `@vitest/coverage-v8` 5 merged at `37904fb`.
- The original Option A preserved dependency versions while fixing the warning catalogue and local sqlite3 binding. Its approval-gated follow-ups were then handled on isolated branches with their own validation. The runtime database is now ignored rather than tracked, and the API starts from a clean checkout by creating and seeding it through the existing SQLite authority.

---



## 5. NEXT_SESSION.md (live)


# Next Session Handoff

## Repository state

- Checkout: `main` at or after `7abee17`, matching `origin/main` after the Authoring UX stacked PR integration (2026-10-11; PRs #4–#7) and the OGraf runtime-parity integration (2026-10-11; PR #8), all **fast-forward-only** merges that created no merge commit. The earlier Astra remediation run closed the audit's findings F-01…F-10, one branch and one focused regression each (mixed legacy/channel round trips, legacy import validation, Lottie numeric property forms, the OGraf procedural-animation mismatch, archive size accounting, dropped-media persistence, preset storage boundaries, the naming dialog's focus lifecycle, the React `act` warnings, and the stale live-document claims) — see `reports/progress_151_astra_remediation.md`. Before it, the five-task maintenance run closed dialog focus restoration (`5cb8a45`), runtime SQLite repository hygiene (`b3f3c6c`), the exact API CORS allowlist (`2a313d7`), Oxlint 1.85 adoption (`feca773`), and the aligned TypeScript 7 / Vitest 5 upgrade (`37904fb`). Milestones A–G remain complete, Milestone H remains complete through H6, and its release decision remains held (H7). The historical checkpoint `docs/checkpoints/2026-09-18-after-lottie-core/` remains unchanged.
- Milestone A (canvas tangent handles) is integrated into `main` by approved replay + fast-forward; `main` is a strict superset of its previous state
- Task 105 (export diagnostics UX) and Task 107 (track-matte source selection) are integrated by fast-forward; both are retained
- Checkout after the item 12 merge: `main` at or after `a4f8642` (the OGraf package import and its handoff refresh), matching `origin/main`
- Milestone D item 9 **Option B is merged into `main` at `73426e5`** (`reports/progress_130_dependency_maintenance_option_b.md`) and `main` matches `origin/main`
- The **`engines` declaration and the npm-12 `allowScripts` question are answered on `chore/engines-allow-scripts`** (`reports/progress_131_engines_allow_scripts.md`): `engines.node: "^22.22.2 || ^24.15.0 || >=26.0.0"` (the locked toolchain's supported intersection) plus a version-pinned `allowScripts` approval for `sqlite3@6.0.1`; `package-lock.json` mirrors only the root engine metadata and its dependency graph is unchanged (**merged into `main` at `1a12d79`**)
- Workflow-tested release code candidate (tag target): `46d2a3e59e065816d972dcd56951803951b577f6`
- Release tags: `v1.1.0-rc.1` (annotated) and `v1.1.0-public-controls`, both unchanged
- Branches kept: `feat/canvas-tangent-authoring` (Milestone A review artefact) and `feat/canvas-tangent-authoring-replay` (its replayed integration branch, now behind `main`; deleting it needs approval)

## Authoring UX stacked PR integration — 2026-10-11

- The completed Authoring UX stacked PR chain was integrated into `main` in order by four **fast-forward-only** merges, creating no merge commit and rewriting no history: PR #4 `fix/authoring-ux-transform-toolbar` (`c46e698` → `7d7ebe2`), PR #5 `fix/authoring-ux-camera-invariance` (`7d7ebe2` → `55a4ab2`), PR #6 `fix/authoring-ux-corner-anchor` (`55a4ab2` → `b453ba1`), PR #7 `fix/authoring-ux-final-slices` (`b453ba1` → `a56ed01`). Each step proved `git merge-base --is-ancestor main origin/<head>` first; PRs #4–#7 are MERGED and no branch was deleted.
- The integrated code tip is `a56ed017e1df804e255842ca81ef1108b9b48ebc` and `main` at or after `a56ed01`, matching `origin/main`.
- Full post-merge validation on that exact checkout: TypeScript, lint, `npm test` (145 files / 2,219 tests), build, `validate:ograf`, `qa:release` (2) and `qa:v6` (3), `npm run check`, the state-consistency check (43 checks), `npm audit --audit-level=low` (0 vulnerabilities), `git diff --check`, and the FULL Chromium suite with `--retries=0` — **334 passed, 0 failed, 0 flaky**.
- Exact-SHA Release Smoke Gate on the integrated tip: run `38166764216`, candidate SHA `a56ed017e1df804e255842ca81ef1108b9b48ebc`, **success** (2026-10-11T19:08:41Z → 19:09:24Z). No tag was created or moved, no release was published, and npm was not published.
- The live QA preview was switched to the canonical stable repo on 2026-10-11 (see the integration section below): UI 5173 now serves `keyframe-character-studio` on `main`, and API 5000 (pid 24896) was never stopped. The four authoring-UX branches are kept (deleting them needs approval).
- `fix/ograf-runtime-parity-phase-a` (PR #3) stays **OPEN** and unmerged; its application delta is now in `main` through the merged PR #8. Only the docs/handoff bookkeeping files differ, while its application delta is conflict-free. The audit recommendation (B) — a controlled sync/replay — was carried out and integrated; see the section below.
- The release decision is unchanged: `v1.1.0-rc.2` remains the published prerelease at its historical smoke-tested candidate, and any future stable or RC decision requires a new explicit user instruction plus a new exact-SHA smoke on any later code change.

## OGraf runtime parity integrated into `main` (PR #8) + QA worktree cleanup — 2026-10-11

- Replacement **PR #8 was integrated into `main` by fast-forward only**: `git merge --ff-only origin/fix/ograf-runtime-parity-phase-a-replay` moved `main` from `b7a0141501a8057214065734b59915b10cec2e43` to `7712deeb12221a4262f4de9c4ce4d820d1231777`, adding three commits (`023d4d0`, `4e0eebb`, `7712dee`) and creating **no merge commit** (`git log --merges b7a0141..HEAD` is empty). PR #8 is MERGED; GitHub records the fast-forward tip as its merge commit. No branch was deleted and PR #3 was not rewritten or closed.
- The integrated diff is exactly the four Phase A files (`src/ograf/runtimeSnippets.ts`, `src/ograf/runtimeTemplate.ts`, `src/ograf/svgRenderer.ts`, `src/tests/ografRuntimeParity.test.ts`) plus docs/handoff.
- Self-review confirmed the generated runtime embeds the canonical `compareByStackingOrder` and `resolveMatteSource` from `src/utils/stackingOrder.ts` and `src/utils/matte.ts`; the static renderer and the runtime agree; the ascending-`zIndex` order is stable for equal `zIndex`; input arrays are not mutated; a disabled Track Matte V2 still falls back to the legacy matte; inverse-matte behaviour is unchanged; group containers render no element while their children keep the composed parent transform and the shared stacking order.
- One vacuous assertion in `src/tests/ografExport.test.ts` (`not.toContain('data-layer="g"')`, an attribute no renderer emits — the wrapper is `data-layer-id="<id>"`) was corrected to `not.toContain('data-layer-id="g"')` as a test-only fix, commit `7abee1783039c606b6fbe6f2263bc09b09640885`. A throwaway probe proved the old form is unsatisfiable and the real attribute appears as soon as a container paints.
- Full post-merge validation on the integrated `main` was green: `npx tsc -b --pretty false`, `npm run lint`, `npm test` (146 files / 2,234 tests), `npm run build`, `npm run validate:ograf`, the focused runtime-parity/stacking/matte/export/grouping set (10 files / 508 tests), `qa:release` (2) and `qa:v6` (3), `npm run check`, `node scripts/check-state-consistency.mjs` (47 checks), `npm audit --audit-level=low` (0 vulnerabilities), `git diff --check`, and the FULL Chromium suite with `--retries=0`: **334 passed, 0 failed, 0 flaky**. All E2E ran isolated (`CI=1 PORT=5008` → UI 5188 / API 5008); `npm run dev` was never used. The affected gates were re-run at the final code SHA `7abee17` (check, focused set, both QA gates, full Chromium, state consistency) and were green again.
- **Exact-SHA Release Smoke Gate** on the final code SHA: run `38172157643`, candidate SHA `7abee1783039c606b6fbe6f2263bc09b09640885`, conclusion **success** — the run checked out the exact requested SHA, passed the expected-SHA assertion, `npm ci`, the Chromium setup, the OGraf fixture validation and `qa:release`. `7abee17` is the TESTED CODE SHA; the docs tip above it is docs-only and was deliberately not smoke-tested.
- The live 5173 QA surface was switched to the canonical stable repo: the old final-UX worktree vite process (pid 34956) was stopped and `npx vite --host --port 5173` was started from `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (vite listener pid 4412, spawned by the `npx vite` service wrapper pid 34504). 5173 answers 200 and serves the integrated `main` application code (the tested code SHA `7abee17`) including the runtime-parity changes, verified by reading the process working directory and fetching the served modules. API 5000 (pid 24896) was never stopped and `/api/health` still answers 200.
- All six redundant Desktop worktrees were removed **with `git worktree remove` only** after passing every safety check (clean tree, zero untracked files, branch reachable from `main` or fully pushed, no user data, no dependent process): `keyframe-character-studio-omp-authoring-ux`, `-omp-authoring-ux-final`, `-omp-camera-invariance`, `-omp-corner-anchor`, `-omp-runtime-parity-replay` and `-omp-runtime-parity`. `git worktree prune` then listed only the canonical checkout. Only denied content was build/test artifacts and the seeded SQLite file; the live API uses the canonical database.
- The six branches were **not deleted**; `feat/canvas-tangent-authoring(-replay)` remain kept as before. PR #3 stays OPEN and is now superseded by the merged PR #8 — closing it is a separate explicit user decision.
- No tag was created or moved, no release was published or finalized, nothing was published to npm, and no dependency/package/workflow/OMP change was made. Record: `reports/progress_164_ograf_runtime_parity_integration.md`.

## Post-Astra focused remediation — committed, 2026-10-07

- The Astra post-compaction review of the uncommitted authoring work found 16 defects (3 HIGH, 12 MEDIUM, 1 LOW; no BLOCKER). All 16 are closed and published as six commits on `main`: text Boolean geometry `a3f5b09`, bonded layer movement `78450f5`, timeline curve targeting `0a20dd6`, Playfair OGraf portability `aa392a9`, the pre-existing visual-only editor refresh `fb8ed96`, and this documentation reconciliation.
- The Playfair Display correction and the UI refresh are now committed unchanged in substance; the three owned Playfair files (normal TTF, italic TTF, OFL.txt) are tracked. No dependency, workflow, package, tag, release, or npm change is part of this publication.
- Focused regressions were added for every finding, and the real-browser proofs cover the family matrix, the whitespace parity, the font load -> settled retrace, the untraceable-operand refusal, the parented bonded drag, and the legacy single-file refusal. Retries, assertions and thresholds are unchanged.
- The dependency advisories recorded here were resolved on 2026-10-08 in a bounded maintenance run: `proxy-addr`, `source-map-js` and `fast-uri` by lock refreshes inside their parents' declared ranges, and `shell-quote` by a scoped `overrides` entry under `concurrently`. `npm audit --audit-level=low` now reports 0 vulnerabilities; see `reports/progress_153_dependency_advisory_maintenance.md`.
- At that point the release artefacts were still at `46d2a3e`; publishing, finalizing or re-tagging required — and still requires — a new explicit user instruction.

## v1.1.0-rc.2 PUBLIC PRERELEASE published — 2026-10-08

- The `v1.1.0-rc.2` release is now a **PUBLISHED PRERELEASE** (`isDraft: false`, `isPrerelease: true`, release id `RE_kwDOTexJrc4YPnCt`, `publishedAt` 2026-10-08T13:11:16Z). It is RC.2 READY FOR USER QA — not a stable release.
- No tag was created or moved, no release was recreated or retargeted, rc.1 is unchanged, and npm remains unpublished (404; package private at `1.1.0-rc.1`).
- The candidate is the exact smoke-tested code commit `6c27ef35d48d61a5e1163d2c91734c864fcafa01`; the documentation tip is newer and docs-only, and is not itself smoke-tested.
- Next input: the user QA checklist in `reports/progress_156_rc2_prerelease_publish.md`. A BLOCKER or MAJOR code defect, or any code change, requires a new commit and a new exact-SHA smoke run before any further RC or stable decision.

## H7 GO — v1.1.0-rc.2 release candidate — 2026-10-08

- H7 GO was executed. A NEW release candidate was cut from the exact smoke-tested commit `6c27ef35d48d61a5e1163d2c91734c864fcafa01` (Release Smoke Gate run `37752015020`). The annotated candidate `v1.1.0-rc.2` dereferences to that commit, and its GitHub release entry was then published as a PUBLIC PRERELEASE on 2026-10-08 (id `RE_kwDOTexJrc4YPnCt`, still `prerelease: true`, never stable).
- The earlier candidate is untouched at `46d2a3e59e065816d972dcd56951803951b577f6`; its draft prerelease is unmodified.
- Package metadata stays private at `1.1.0-rc.1` (PATH A): the candidate is the exact smoke-tested commit, and npm remains unpublished.
- The documentation tip is newer than the candidate and docs-only; it is NOT itself smoke-tested. Any commit that touches source, tests, workflows, packages or assets invalidates the result for the new commit, so re-run the gate before a further release decision.
- The rc.2 prerelease was published on 2026-10-08; publishing it created no new tag and published nothing to npm. Record: `reports/progress_155_h7_rc2_release.md` and `reports/progress_156_rc2_prerelease_publish.md`.

## Exact-SHA release smoke gate — passed, 2026-10-08

- The manual `Release Smoke Gate` passed on the exact candidate: run `37752015020`, **TESTED CODE SHA `6c27ef35d48d61a5e1163d2c91734c864fcafa01`**. Verdict: EXACT-SHA RELEASE SMOKE PASSED — READY FOR H7 RELEASE DECISION.
- The workflow is verification-only; it checked out the `candidate_sha` input, verified `git rev-parse HEAD`, and ran `npm ci` + Chromium + `npm run qa:release` (OGraf fixture validation plus two Chromium OGraf specs). It cannot tag, release or publish.
- **Candidate identity:** `6c27ef3` is the tested CODE sha. The documentation commit that records this run is not smoke-tested. Re-run the gate on any later SHA that changes code before making a release decision.
- The smoke gate is not the full suite: the Vitest suite (135 files / 2,055 tests), the full Chromium suite (268 tests), the API/SQLite checks and the CORS posture were validated locally on the same code line and are recorded in PROJECT_STATE.md.
- Creating or moving a tag, publishing a stable release, and npm publication each require a new explicit user instruction; the earlier candidate and the package metadata were unchanged by that task.

## Dependency advisory maintenance — committed, 2026-10-08

- A fresh audit reported five advisories (3 critical, 1 high, 1 moderate). All are resolved by `chore: remediate dependency advisories` (`7f1e679`): three lock refreshes inside the parents' declared ranges and one scoped `overrides` entry under `concurrently` for `shell-quote`.
- No direct dependency, script, engine, workflow or application source change. Reachability was proven from code for `proxy-addr` (Express defaults `trust proxy` to `false`; KCS never sets it or reads `req.ip`/`req.ips`) and for `shell-quote` (concurrently's only `quote()` consumer requires additional CLI arguments the `dev` script never passes).
- `npm audit --audit-level=low` reports 0 vulnerabilities. The full gate is green: 135 Vitest files / 2,055 tests, 268 Chromium tests with `--retries=0`, `npm run check`, OGraf validation, both QA gates, the state consistency check, the API health endpoint on the loopback bind, and the `sqlite3` binding.
- The `overrides` entry is a temporary bridge; remove it once `concurrently` declares `shell-quote >= 1.11.0`.

## Authoring publication — 2026-10-05

- The approved pending work is grouped into six commits: text appearance, layer authoring (bonds, Boolean text/freeform operands, opacity), timeline segment editing and transport, sidebar/media/text presentation, sequence write/render isolation, and documentation reconciliation.
- The circle/selection-border split is fixed at the stage evaluation boundary: Edit uses the selected sequence, while Broadcast keeps its runtime selection. Same-frame property keyframes remain isolated across sequences.
- Owner-approved author dates are retrospective metadata distributed across 2026-08-29, 2026-09-05, 2026-09-12, 2026-09-19, 2026-09-26, and 2026-10-05. Committer dates remain real. Do not interpret this as earlier uploads or proof of work on those dates; do not manufacture empty commits to fill the remaining days.
- Preserve historical local branches; do not replay the old tangent/presentation work or the obsolete mask-gizmo patch. Normal fast-forward publication only; no force push, rebase, tag change, draft release publication, or npm publication.

## Current result

Milestones A–E are complete, and Milestone F item 10 is complete (all four slices merged):

- Milestone F item 10, first slice — **the Lottie import core is merged into `main`** at `ff32d6c` (base `06a5dfcf`, `--no-ff`, pushed; branch `feat/lottie-import-core` kept at `f76ae6a`): `importLottieDocument(text)` maps document timing, shape/solid/null layers, transforms, paths, primitives and fill/stroke/trim, applies the segment-to-keyframe easing rules, and reports every construct it does not convert through the loss-report contract. 37 contract cases; five independent read-only review rounds (BLOCKED, BLOCKED, BLOCKED, READY WITH WARNINGS, READY WITH WARNINGS) plus a merge-eligibility review of the last delta. The importer has a user-facing entry point (`3b30bff`), which the unified import control later folded into the single `Import` button in the header: one control classifies the chosen file by its **content** (KCS project, legacy project, Lottie document, OGraf manifest/package), and a Lottie document still opens its report before anything is applied and applies only on an explicit confirm.

- Milestone A — canvas tangent authoring (`077911b`): vertex selection shows Bezier handles on the stage, dragging reshapes the path live, one history entry per completed drag, `Escape` cancels.
- Milestone B — graph + keyboard accessibility (`96e8f9d`): named keyframe diamonds with a lane-local arrow walk, a labelled value graph with keyboard-editable points, decorative SVG hidden from assistive tech, focus rings.
- Milestone C — first export / onboarding (`c2dcb22`): opt-in "First export help" panel, readiness check reading the same OGraf diagnostics authority as the export, one shared compile path for readiness and both export actions.
- Milestone D item 6 — state consistency check (`b91e8b9`, CI follow-up `be76df9`): `node scripts/check-state-consistency.mjs`.
- Milestone D item 9 and its maintenance follow-ups are closed. Option A is merged at `3923141`, Option B at `73426e5`, `engines`/npm-12 `allowScripts` at `1a12d79`, `jsdom` 30.1.1 at `c1431db`, Oxlint 1.85 at `feca773`, and Option C (TypeScript 7 plus Vitest and `@vitest/coverage-v8` 5) at `37904fb`. The runtime SQLite file is ignored rather than tracked, API browser origins are exact by default, and the two remaining dialogs restore opener focus.

The release stance is unchanged: annotated tag `v1.1.0-rc.1` and a GitHub draft prerelease exist at the workflow-tested code candidate; nothing was published, finalized, or pushed to npm.

## Validation

Post-Astra remediation local gate on October 7, 2026: `npx tsc -b --pretty false`, `npm run lint`, `npm test` (135 files / 2,055 tests), `npm run build`, `npm run validate:ograf`, `npm run qa:release` (2 Chromium tests), `npm run qa:v6` (3 Chromium tests), and the full Chromium suite (268 tests with `--retries=0`) all passed. State consistency passed 35 checks; `npm audit --audit-level=low` reported the dependency warnings recorded in PROJECT_STATE.md. One incidental sidebar visual-dimension test was deleted; actual collapse/reopen geometry, hidden controls, and compact-viewport reachability remain covered. The dependency audit at that time reported one moderate `fast-uri` advisory (GHSA-hrr3-gc8f-f4qj), resolved later with the other advisories. Remote CI is checked after the normal push; earlier remediation CI is historical evidence, not proof for this publication.

## Next scoped work

1. **Milestone H: H7 GO executed, `v1.1.0-rc.2` PUBLIC PRERELEASE published.** H1–H6 are complete and the new candidate was cut from and verified against the exact smoke-tested commit `6c27ef3`; its GitHub release is a published prerelease awaiting the user QA pass. The earlier candidate remains at `46d2a3e`, and npm publication plus any stable release stay separate explicit decisions. Re-run the exact-SHA smoke gate on any later commit that changes code before a further RC or stable decision.
2. The Astra remediation findings F-01…F-10 are closed and merged with green CI, one branch per finding; `reports/progress_151_astra_remediation.md` records the reproduction evidence and the remaining limitations.
3. The post-compaction Astra findings A-01…A-05, B-01…B-04, C-01…C-03, D-01…D-03 and DOC-01 are closed and published on `main` in six commits; `reports/progress_152_post_astra_focused_remediation.md` records the per-finding reproduction, fix, test and result.
4. The five maintenance tasks that preceded the remediation are complete: focus restoration, SQLite repository hygiene, the API CORS allowlist, Oxlint 1.85, and TypeScript 7 / Vitest 5.
5. Preserve the tag and draft prerelease. Publishing, finalizing, or re-tagging requires a new explicit user instruction.
6. The GitHub Actions Node 20 deprecation annotation and the announced `ubuntu-latest` migration to Ubuntu 26 are non-blocking workflow-maintenance warnings; they do not change the held release decision.

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
- What it adds: timeline keyframe diamonds are named, focusable buttons (`Enter`/`Space` selects the keyframe and moves the playhead, `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order and are consumed at the ends); the value graph is a labelled group whose keyframe points are Tab-reachable and announced with frame and value, editable with the arrow keys; decorative SVG geometry is hidden from assistive technology; focus rings were added for the diamonds and the graph points.
- Review: one focused round returned BLOCKED (3 findings, 6 documentation over-claims) — all closed; the re-review returned READY WITH WARNINGS.
- Validation: 109 files / 1,652 Vitest tests, `validate:ograf`, `qa:release`, build, TypeScript, lint, `git diff --check`, plus the real-browser spec `e2e/graph-accessibility.spec.ts`.
- Out of scope (unchanged): graph engine or evaluator changes, new shortcut registry, keyframe model or drag redesign, new dependencies, release/package/workflow changes.
- Roadmap status when this milestone landed: D was next (items 6 and 9) and C was merged. Current status: milestones A–G are complete, and Milestone H is complete through H6 with its release decision held (H7), see "Current result" above.

---



## 6. KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md (live)


# KCS Grouped Roadmap Execution Plan

Orchestrator close-out for the grouped post-RC roadmap run. Milestones A–G are complete. Milestone H is complete through H6, and its H7 release decision has since been executed: the `v1.1.0-rc.2` candidate was cut from the exact smoke-tested commit and is now a published prerelease awaiting the user QA pass (no stable release, no npm publication). The later approved maintenance run closed dialog focus restoration (`5cb8a45`), runtime SQLite repository hygiene (`b3f3c6c`), the API CORS allowlist (`2a313d7`), Oxlint 1.85 (`feca773`), and TypeScript 7 / Vitest 5 (`37904fb`) without moving any release artefact. The post-hold Astra remediation then closed findings F-01…F-10 through `8a4ca22` (see `reports/progress_151_astra_remediation.md`), also without moving any release artefact. The later post-compaction Astra review of the uncommitted authoring work closed all 16 of its findings (A-01…A-05, B-01…B-04, C-01…C-03, D-01…D-03, DOC-01) in six commits on `main` on 2026-10-07 (see `reports/progress_152_post_astra_focused_remediation.md`), likewise without a dependency, workflow, package, tag, release or npm change.

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
| H — Release finalization and approval-gated maintenance | review follow-up decisions | Milestone H branches plus the five maintenance branches plus the nine remediation branches | **NEXT (user QA)** — **H1–H6 are COMPLETE**, the post-hold maintenance tasks are merged through `37904fb`, the Astra remediation findings F-01…F-10 are closed through `8a4ca22`, and the post-compaction Astra findings A-01…A-05, B-01…B-04, C-01…C-03, D-01…D-03 and DOC-01 are closed in six commits on `main` (2026-10-07). **H7 = GO (executed)** — the `v1.1.0-rc.2` candidate was cut from the exact smoke-tested commit and its GitHub release is now a PUBLISHED PRERELEASE (not stable); the earlier candidate stays at `46d2a3e` and npm was not published. This row keeps the plan's single NEXT marker because the remaining plan decision is the user QA pass and a future explicitly authorized stable release. |

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

The older candidate and its GitHub draft prerelease, together with the private package metadata, are unchanged at `46d2a3e59e065816d972dcd56951803951b577f6`.
The H7 GO decision was then executed: the newer `v1.1.0-rc.2` candidate was cut from the exact smoke-tested commit `6c27ef35d48d61a5e1163d2c91734c864fcafa01`, verified by Release Smoke Gate run `37752015020`, and its GitHub release is now a PUBLISHED PRERELEASE (never a stable release). npm was not published.
The user QA pass against that prerelease is the next input; a stable release, a further candidate, or any code-affecting commit (which would require a new exact-SHA smoke run) remains a separate explicit decision."

Historical notes: "KCS MILESTONE A COMPLETION …" was carried out (five items closed, READY, replayed and fast-forward merged at `077911b`); "KCS MILESTONE B — GRAPH + KEYBOARD ACCESSIBILITY …" was carried out (merged at `96e8f9d`); "KCS MILESTONE C — FIRST EXPORT / ONBOARDING FLOW …" was carried out: implemented on `feat/export-onboarding`, gate-reviewed (READY WITH WARNINGS) and fast-forward merged at `c2dcb22` (see `reports/progress_110_export_onboarding.md`).

---



## 7. KCS_RELEASE_CANDIDATE_SUMMARY.md (live)


# KCS Release Candidate Summary

## Release boundary

The release-readiness blocker work is integrated into `main`. Annotated tag `v1.1.0-rc.1` and a GitHub draft prerelease remain at workflow-tested candidate `46d2a3e59e065816d972dcd56951803951b577f6`; that candidate is historical and must not move.
The H7 GO decision then cut a NEW release candidate on 2026-10-08: the annotated `v1.1.0-rc.2` release candidate dereferences to the exact smoke-tested commit `6c27ef35d48d61a5e1163d2c91734c864fcafa01`, verified by Release Smoke Gate run `37752015020`. Its GitHub release entry was published as a PUBLIC PRERELEASE on 2026-10-08 (release id `RE_kwDOTexJrc4YPnCt`, `publishedAt` 2026-10-08T13:11:16Z, `prerelease: true`, `targetCommitish` pinned to the same commit). `reports/progress_155_h7_rc2_release.md` records the cut and `reports/progress_156_rc2_prerelease_publish.md` records the publication.
The later maintenance line through `37904fb` closed dialog focus restoration, runtime SQLite repository hygiene, the API CORS allowlist, Oxlint 1.85, and TypeScript 7 / Vitest 5 without moving the tag, publishing the draft, or publishing npm.
The post-hold Astra remediation then closed the correctness/security findings F-01…F-10 through `8a4ca22` (`reports/progress_151_astra_remediation.md`): mixed legacy/channel round trips, legacy import validation, Lottie numeric property forms, the OGraf procedural-animation mismatch, archive size accounting, dropped-media persistence, preset storage boundaries, the naming dialog's focus lifecycle, the suite's React `act` warnings, and the stale live-document claims. It added no dependency, workflow or package change. The post-compaction Astra review of the uncommitted authoring work then closed all 16 of its findings in six commits on `main` on 2026-10-07 (`reports/progress_152_post_astra_focused_remediation.md`), again with no dependency, workflow, package, tag, release or npm change; the release decision remains HOLD.

## Accepted milestones

- Public Controls V1 and OGraf Package Export V2.
- Windows path, parent-cycle/broadcast, SourcePath/filesystem, and mask/matte parity hardening.
- Deterministic OGraf fixture/schema validation gate.
- Isolated full OGraf release smoke gate.

## Validation status

The release gate is the method, not a stored count: type check, full Vitest, lint, production build, OGraf validation, release QA, focused browser specs, V6 QA, the combined check, state consistency, dependency audit, and diff hygiene. The latest maintenance baseline and command evidence are recorded in `NEXT_SESSION.md` and `reports/progress_150_final_maintenance_reconciliation.md`.

- `validate:ograf`: PASS — offline and deterministic by default against the vendored closure, every pin verified; `--online` is the refresh path that fetches the pinned bytes.
- `qa:release`: PASS — 2 Chromium tests. `.github/workflows/release-smoke.yml` is the manual gate and requires an explicit candidate SHA.
- **Exact-SHA release smoke: PASSED on 2026-10-08** — run `37752015020` against **TESTED CODE SHA `6c27ef35d48d61a5e1163d2c91734c864fcafa01`** (`reports/progress_154_exact_sha_release_smoke.md`). The workflow is verification-only (`contents: read`), pins the `candidate_sha` input, verifies `git rev-parse HEAD`, and runs `npm ci` + Chromium + `npm run qa:release`. It proves the candidate installs from its own lockfile, the OGraf fixture validates offline, a materialized package interoperates with Chromium, and the editor exports an OGraf ZIP; it is not the full Vitest or Chromium suite. The documentation commit that records this run is not itself smoke-tested — re-run the gate on any later code SHA.

## Accepted blocker constraints

1. **SourcePath/output TOCTOU:** Existing source and output protections remain. Two residual hostile-concurrency races are explicitly accepted: `lstat → open` on the source pathname and output preflight → pathname write. These are not claimed as complete OS-level no-follow protection. Release materialization requires trusted, dedicated source ownership and output directories; hostile multi-tenant filesystem mutation is outside the supported threat model.
2. **OGraf schema validation:** The complete schema graph is SHA-256 pinned and fails closed on mismatch or unpinned references. The eight pinned documents are vendored under `fixtures/ograf/schema/`, so `npm run validate:ograf` validates offline and deterministically; `--online` re-fetches the pinned bytes and needs network access.
3. **Playwright browser gate:** `.github/workflows/release-smoke.yml` provides a manual, checked-in Ubuntu Chromium gate. It requires a full candidate SHA, verifies the resolved checkout, installs Chromium, and runs `npm run qa:release`.
4. **Release metadata:** `package.json` and `package-lock.json` use private version `1.1.0-rc.1`, and the rc.2 candidate deliberately keeps that state (PATH A): the candidate is the exact smoke-tested commit, so no metadata commit was introduced. `CHANGELOG.md` retains `[Unreleased]` for package metadata; npm publication was not performed.

## Release decision

**READY WITH WARNINGS** remains the technical release stance. The original final gate at `c1431db` reported **RELEASE READY WITH DOCUMENTED DEFERRALS**; the maintenance run subsequently closed every deferral and follow-up named there, and the exact-SHA Release Smoke Gate then passed on the new candidate.

The H7 GO decision has been executed: the `v1.1.0-rc.2` candidate exists as an annotated release and a **publicly published prerelease**, and the earlier rc.1 candidate remains historical and unchanged. The package remains private at metadata version `1.1.0-rc.1` and no npm publication occurred. This is a prerelease for user QA — not a stable release.

Publishing the rc.2 draft prerelease, running the user QA pass, publishing to npm, or cutting a stable release each require a new explicit user instruction. Publishing the draft does not create a tag (it already exists) and does not publish to npm.

The prior maintenance deferrals are closed: Oxlint 1.85 at `feca773`, TypeScript 7 / Vitest 5 at `37904fb`, runtime SQLite repository hygiene at `b3f3c6c`, the API CORS allowlist at `2a313d7`, and dialog focus restoration at `5cb8a45`. GitHub Actions currently emits non-blocking annotations for Node 20-based action runtimes being forced onto Node 24 and for the announced `ubuntu-latest` migration to Ubuntu 26.

---



## 8. CHANGELOG.md (live)


# Changelog

All notable changes to **Keyframe Character Studio** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- A layer **OPACITY** field in the Transform section, shown as a percentage next to an **Add/Remove Keyframe** button. The field writes through the same `opacity` channel the timeline already animates: while the channel has no keyframe it sets the layer's static opacity, and once it has one, the edit lands on the current frame (adding a keyframe there when the frame is empty) — so an entrance fade is authored by setting 0% on one frame and 100% on another, and each keyframe keeps its own value. It works for every layer kind: shapes, text, images, freeform and cloners.
- Stroke controls for text: a text layer now owns the same fill/stroke paint as shapes, so the Appearance card and the Text card both expose its stroke colour, alpha, width and enable switch, and the canvas paints the authored outline instead of a fixed one. The outline defaults to the canonical 0.5 width text always had, the alignment control stays hidden for text (its renderer cannot split a centered stroke), and the OGraf export writes the authored stroke width, opacity and enabled state for text instead of a hardcoded 0.5.
- Layers can be bonded to each other: select two (or more) layers and press **Bind** in the Inspector, and a position change on either one — a stage drag, the Inspector's position fields, or a multiple selection — moves the others by the same world-space delta. Rotation, scale and opacity stay independent, so a bond is not a parent-child transform; **Unbind** releases it. A copy, a mirrored duplicate and a Boolean group never inherit a bond, and an ancestor/descendant pair is refused with an explanation instead of being moved twice. The bond is saved with the document.
- Boolean operations now accept more than the closed vector shapes: a freeform layer contributes its canonical path, and a text layer contributes its own traced outline — the letters themselves, counters included — so a text and a shape can be unioned, subtracted, intersected or excluded. A text the renderer draws differently (a staggered text animates per character) or an empty text is not offered as an operand, and an environment without a canvas reports the empty result instead of substituting a bounding box. The Inspector's Boolean hint and its section description name the operand kinds they now accept.
- OGraf packages are importable: selecting the `.zip`/`.ograf` the exporter wrote opens a report and, on confirm, replaces the project with the scene the package carries. The archive is decoded in memory with entry-count, entry-size and package-path guards, prototype keys and unsafe, duplicate or reserved paths are refused, and a package without a scene is refused rather than half-imported.
- One import control in the header instead of several: the selected file is classified by what it **contains**, so a KCS project, a legacy project, an OGraf manifest and a Lottie animation all import through the same button, each with its existing behaviour (and the Lottie animation still showing its report before anything is replaced).
- A Lottie (bodymovin) import path: selecting a Lottie file parses it in memory and opens a report that lists the blockers and the losses with their source paths and next steps **before** anything is applied — Cancel leaves the project untouched, and only "Import and replace project" applies the scene through the same validated path the project import uses. Imported layers keep the shapes, text and images they had: a path, a rectangle, a rounded rectangle, an ellipse and a solid all become a freeform whose own path draws exactly the imported geometry, while text and images keep their existing KCS types — so an imported scene neither loses its curves nor risks an export refusal caused only by the layer type the importer picked.
- A state consistency check for the repository: `node scripts/check-state-consistency.mjs` fails when the live documents contradict the tag/`main` SHA, when the roadmap and the next action disagree, or when the handoff bundle carries a stale status, a superseded upload instruction, source/test copies, collapsed Windows paths or secret markers.
- A first-export path for new users: a labelled "First export help" panel next to Export lists the three steps, offers a readiness check that reports what would block an OGraf export (reusing the existing export diagnostics), and states that nothing is written until you export. The readiness answer is a pre-flight summary; a scene changed afterwards is recompiled when the export runs.
- The timeline keyframe diamonds are keyboard operable: each one is a named button in the tab order, `Enter`/`Space` selects the keyframe and moves the playhead (and selects the part on the parent lane), and `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order.
- The value graph's keyframe points are announced with their frame and value, and its decorative axes and curve stay out of the accessibility tree.
- Bezier tangent handles can be authored directly on the stage: select a single freeform layer, click a vertex to reveal its handles, drag a handle to reshape the path live, and double-click a vertex to toggle corner ↔ smooth. Each drag is a single undo step and `Escape` cancels one without recording history.
- Track-matte source relationships are now visible in the outliner for both relationship models (`Mask → <source name>`), and unnamed layers fall back to their ids in the matte source pickers.
- The Track Matte V2 card's source select carries an accessible label.
- Actionable OGraf export diagnostics: every blocking diagnostic now reports a stable title, the failing layer or feature, the reason, and a concrete next step, and it never reports success while export is blocked.
- Non-blocking OGraf warnings are surfaced as a compact grouped notification instead of being silently dropped.
- Package materialization failures now carry stable failure codes; filesystem guidance states the trusted-directory requirement, the unsupported hostile-concurrency case, and avoids claiming perfect OS-level protection. Machine paths are reduced to a display-safe form.

### Changed
- The editor now shares the Media upload card's visual language: soft dark surfaces, rounded Inspector and drawer cards, restrained teal feature washes, pill-shaped primary actions, and consistent focus states. Header controls, Layers, timeline transport, Motion Curves, naming/confirmation/import dialogs, and notifications use the existing semantic theme tokens. Dense timeline geometry and all authoring/import/export behavior are unchanged; reduced-motion preferences also suppress drawer-card hover motion and the naming dialog entrance.
- Inspector disclosures now form one flat list: Transform, Control Points, Animation Data, Appearance, Text and matte sections no longer sit inside two separately painted parent cards. Boolean and binding workflow separators keep an 8px gap before the next card instead of touching its rounded border; each disclosure retains its own expand/collapse state.
- The timeline's transport row uses a consistent compact control height, token-based rounded corners, muted secondary actions, a segmented duration control, and tabular timecode figures. Its duration field and `1s…10s` presets, transport buttons, Crop, Motion Curves and support controls retain their existing authoring behavior.
- The Texts drawer's presets are laid out as designed rows instead of uneven cards: each one carries a tinted icon badge in its own accent tone, previews its label in the font it will create (Bebas Neue, Playfair Display, Outfit, Inter, Montserrat), states the family and size underneath, and lifts on hover with a grab cursor because it is draggable. The inline presentation styles and the utility colour classes that did not exist are gone, so one stylesheet owns the look, and clicking or dragging a preset still adds the same text layer with the same font and size.
- The Motion Curves editor shapes exactly one segment, and says which one: it edits the curve that leads **into** the keyframe you picked from the keyframe before it, so with five keyframes the fourth opens `F60 → F90`. The header names the property and the two frames, each handle names the keyframe it belongs to (`P1 · leaves F60`, `P2 · arrives at F90`), and the curve is stored where the evaluator reads it — the segment's **start** keyframe — leaving the keyframe's own outgoing segment untouched. A keyframe with nothing before it (the first one, or the only one) and a playhead that sits between keyframes no longer fall back to some other keyframe's curve: the editor explains that there is no segment instead of editing one silently, and it no longer creates a keyframe as a side effect of opening or applying a curve.
- The Media drawer's upload card reads as a real drop target again: a rounded dashed card with a soft accent glow, a circular upload badge, the same title and hint, and a pill-shaped **Browse files** control, with a stronger (solid accent border + ring) feedback while a file is dragged over it. The recently added media tiles are square, keyboard-focusable previews that lift and reveal an add affordance on hover. The stylesheet override that had flattened the card into plain left-aligned text is gone, so one file owns the card's look, and clicking either the card or the button still opens the picker exactly once.
- The Appearance card reads tidier: the WIDTH and ALIGN controls share one equal-column row (previously a narrow field beside a wide one), a lone WIDTH field — text, which offers no alignment — no longer stretches across the panel, and a switched-off FILL or STROKE group keeps its authored values but is dimmed instead of looking active.
- Text no longer repaints its outline when it is selected: the canvas keeps the authored stroke colour and width and uses the selection highlight only while the outline itself is switched off, which is what shapes already did.
- The left toolbar and the right inspector collapse and expand as one motion: the panel's width, its 12px slide, its opacity and the handle that rides its edge all run over the same 240ms with the same `ease`, so the handle stays glued to the edge for the whole animation instead of racing ahead of it (the right handle used to leave the edge by more than 100px on the first frames and snap back, which read as a jump), the canvas gains and returns the space at the same pace, and the panel content fades over that same 240ms instead of vanishing on the first frame. The overshoot curve those layout transitions used is gone, and `prefers-reduced-motion` still makes both instant.
- An OGraf export now refuses a layer whose animation the exported graphic cannot reproduce: a layer carrying an in/out motion preset resolves to a different frame in the editor than in the generated runtime, which renders the timeline only, so the export reports `OGRAF_UNSUPPORTED_PROCEDURAL` and stops instead of shipping a graphic that plays a different animation. `none` and `custom_timeline` resolve to no delta in the evaluated mode and stay exportable, and the export's existing `OGRAF_UNSUPPORTED_NONDETERMINISTIC_PROCEDURAL` rule for shake/random presets is unchanged.
- The dialog focus lifecycle lives in one authority: the naming dialog uses the shared opener restoration and the shared focus trap, so Tab and Shift+Tab wrap the dialog's own stops (a disabled action is not a stop) and Escape dismisses through the dialog's own handler; its close control has an accessible name. The confirmation and import-report dialogs use the same trap instead of their own two-stop copies.
- The test environment declares React's act environment for the whole run, so a state update outside `act` is reported on every machine instead of only on a slower one, and the serialization and import-atomicity tests make their document calls inside `act`. The suite went from 101 warnings reported by CI to none.
- The preset library treats `localStorage` as the external boundary it is: a blocked or full store no longer fails the mount or the edit that triggered the write, and the library keeps working in memory for the session.
- The value and speed graphs are exposed as labelled groups instead of images, and focus rings were added for the timeline diamonds and the graph keyframe points.
- Freeform paths that only carry legacy `points` normalize a repeated closing vertex before the editing overlay materializes a canonical `path` on first edit; the legacy array itself is preserved.
- Matte relationship resolution went through one shared helper that mirrors the rendered result, so the outliner indicator and the stage agree for enabled, disabled, missing, and unusable sources.
- The project now declares the locked toolchain's supported Node runtime intersection (`^22.22.2 || ^24.15.0 || >=26.0.0`) and approves the `sqlite3` install step for npm 12 with a version-pinned entry, so a fresh install fetches that package's prebuilt native binding instead of silently leaving the API server without a database driver; the lockfile mirrors only the root engine metadata and its dependency graph is unchanged.
- `jsdom` moved 30.0.1 → 30.1.1, whose `Blob` no longer carries what Node's `URL.createObjectURL` follows; the test environment now defines the two object-URL functions itself instead of depending on that pairing, so a jsdom patch can no longer change test behaviour.
- Runtime and toolchain dependencies were refreshed within their current major versions (React 19.3, Vite 8.3, Vitest 4.1.11, lucide-react 1.47 and the test-library patches) on an isolated branch. `jsdom` was taken to 30.1.1 later with a test-environment object-URL shim, and Oxlint was subsequently adopted at 1.85 with narrow, documented suppressions only at deliberate React synchronization patterns.
- TypeScript moved from 6.0 to 7.0, and Vitest plus `@vitest/coverage-v8` moved from 4.1 to 5.0 as one aligned toolchain upgrade. Type checking, the 1,951-test suite, production build, release gate, browser smoke set, V6 QA, and CI all pass on the upgraded versions.
- The embedded SQLite fallback remains runtime-generated, but `server/db/keyframe_studio.sqlite` is no longer tracked; a clean checkout creates and seeds it on first API start.

### Removed
- The timeline's "Selected Keyframe" property panel: selecting a keyframe in the timeline no longer opens it. The selection itself is unchanged — the diamond still highlights, `Delete`/`Backspace` still remove the selected frame group and undo restores it — and keyframe values stay editable through the Inspector's transform section and the timeline's own drag/duplicate/copy-paste actions.
- The header's `?` (First export help) button and the **OGraf Single File (Legacy)** export entry. The export menu now offers exactly **JSON** and **OGraf Package**; the legacy single-file `.mjs` export is gone, so its fail-closed guard went with it, and the first-export guidance component is no longer reachable from the header.

### Fixed
- Changing editor chrome no longer pans or zooms the authored world. The stage camera was never an authority: the edit SVG mapped its 600×480 viewBox into whatever box the stage happened to occupy (`preserveAspectRatio="xMidYMid meet"`) and the pan/zoom transform was expressed against that box's centre, so opening or closing a sidebar moved the world by half the panel width (+180 px for the inspector, −168 px for the left dock) and every timeline height change also rescaled it, because the aspect-fit factor is derived from the stage size (resizing the timeline from 320 px to 560 px took the magnification from 0.67 px/unit to 0.17 px/unit and slid a world point by up to 60 px × 90 px). The camera is now its own state — a view centre in client pixels plus the px-per-unit scale it was anchored with (`StageCameraView` and `getStageCameraTransform`) — and the rendered transform divides the layout fit back out, so a panel, a disclosure or a timeline drag only changes the visible crop: a world point keeps its screen position and magnification (measured drift 0.00 px across sidebar toggles, timeline collapse/expand/resize and ten repeated toggle cycles), while explicit pan, zoom, `Reset View Position`, the initial centring and the broadcast fit are untouched. A window resize still re-anchors the camera with its pan offset and re-derives the scale, which is the fit behaviour it always had.
- Trim Path authoring is frame-specific again. The Inspector's Start/End/Offset fields wrote and displayed the layer's **static** field and never looked at the channel, so a keyed Trim Path read as a global edit: the same number appeared at every frame, and editing a later frame looked like it rewrote the earlier keyframe. The fields now show the value `evaluateTrimPath` resolves for the current frame and write through `updateCurrentPropertyChannel` — the existing authority that edits the static field while a channel is unkeyed and the current frame's keyframe once it is keyed, never another frame's. Each field also carries an Add/Remove keyframe control that mirrors the opacity card and captures the evaluated value, and a same-frame keyframe in another sequence is left alone.
- A disabled Track Matte V2 relation no longer suppresses the layer's legacy matte in an export. The editor authority (`resolveMatteSource`) treats `trackMatte` as the *preferred* relationship and falls back to the legacy `matte` when the V2 record is disabled, but both export paths stopped at the disabled record and emitted no matte at all — so a layer with `trackMatte.enabled === false` plus a legacy alpha/luminance matte rendered the legacy matte in the editor and nothing in the exported graphic. The static SVG renderer and the generated runtime now follow the same fallback. The Inspector also says so: the legacy card states that an enabled Track Matte V2 relation is active and that its settings are not applied.
- An OGraf export now paints in the editor's stacking order. The generated runtime walked the authored `scene.layers` array, but that array is NOT the paint order — the outliner keeps index 0 on top, `addCustomPart` prepends with `max + 1` and `reorderParts` assigns `zIndex = total - index` — so a host loading `graphic.mjs` drew the scene upside down and showed the background over the foreground. `stackingOrder` is now the one authority (ascending `zIndex` paints first, stable for a shared `zIndex`, never mutating the input) and the stage, the frame evaluator, the static SVG renderer and the generated runtime all use it. `evaluateFrame` already sorted, which is why only the runtime diverged.
- An imported image layer's bounds now describe the visible art instead of the whole bitmap. The drawn box is sized from `naturalWidth`/`naturalHeight`, so a PNG with transparent padding left every bounds consumer — the Inspector's edge control points, the selection gizmo, the resize handles, marquee hit-testing — out on the padding, and a padded file showed empty space beside the letters. The non-transparent content rectangle is measured once at import (an alpha scan, `VISIBLE_ALPHA_THRESHOLD`) and kept on the layer in local units, so a 100x100 PNG whose art covers x 20..79 and y 30..69 now reports edge points at +/-45 and +/-30 inside its 150x150 box instead of +/-75 and +/-75. The rectangle survives save/load and the OGraf package; a layer without one — every layer imported before this change, and every video — keeps exactly the previous whole-box bounds.
- Cinematic Title can now export as editable OGraf text: KCS owns the original Playfair Display variable font, loads its normal/italic faces locally in the editor, and packages the normal face with its full SIL Open Font License. The existing asset preparation and validation authorities handle the bytes; unavailable fonts still block export, explicitly supplied font sources retain precedence, and quoted Inspector family names resolve to the same packaged face. The ZIP retains `scene.kcs` and its public text field; no text rasterization or general package-asset import change is introduced.
- Edit-mode stage rendering now evaluates the selected sequence, matching the selection gizmo and Inspector. Dragging a keyframed circle or another layer in a named sequence moves its painted geometry instead of only its selection border; Broadcast keeps its existing runtime sequence selection.
- Adding a property keyframe now matches both frame and sequence identity. Authoring another sequence at the same frame no longer overwrites the first sequence's position, opacity, or other channel values; existing untagged keyframes still belong to the default sequence.
- An OGraf package's per-entry and total size budgets are taken from what the archive reader will actually materialise rather than from one declared field: a stored member is measured by the bytes it is copied from and must declare a single size, a deflated member is measured by the buffer it is inflated into, and a compression method whose output cannot be bounded is refused. A member can no longer be admitted by under-declaring its size.
- Dropped media is stored in the document as a self-contained source (the same durable form the Media drawer writes) instead of a `blob:` URL that dies with the page, so an image dropped on the stage survives a reload.
- A split Lottie position (`p: { s: true, x: …, y: … }`) is read as the two scalar properties it is, and a keyframe easing handle written per dimension (`o: { x: [0.25, 0.3], y: [0.1, 0.2] }`) resolves the component its channel maps. A handle with no readable value keeps its segment linear and is reported instead of becoming a fabricated zero curve.
- Legacy project documents are validated before they are applied: a part that is not an object, has no usable id or type, has no finite z-order, or carries a base transform the evaluator cannot multiply is refused with a stable code and the offending path, instead of importing "successfully" and failing on the stage. Valid legacy documents — including `sequencer-project.json` and the server's seed project — still import.
- A track whose canonical channels cover only part of its animation no longer loses the rest on a save/load round trip: the channels the evaluator would still resolve from the legacy composite keyframes are written with those values, so the animation a document produced before saving is the animation it produces after loading.
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
- A text Boolean operand now traces the family it was given: the accepted family is read from the canvas's serialized `font` string instead of matching the caller's raw text against it, so a quoted name and a CSS fallback list (`"'Playfair Display', serif"`) produce geometry instead of being refused. The outline cache retraces once when the faces settle, so a trace taken while a webfont was still loading no longer keeps the fallback face's geometry forever.
- A Boolean operation now refuses atomically when one of its operands has no geometry. A three-operand Subtract whose first operand was an untraceable text used to drop that operand and run as a two-box Subtract, silently producing a different shape; the operation is refused instead and the Inspector names the layer it could not trace.
- A closed freeform path's ring now closes on its first point instead of its last authored vertex, so a curved closing edge is represented and the ring's area matches the SVG fill instead of collapsing onto the straight triangle through the vertices.
- The text trace now follows the renderer's SVG whitespace semantics, so `"A A"` and `"A  A"` — which the stage draws identically — produce the same Boolean geometry.
- A parented bonded layer now drags by the world delta the pointer asked for: the stage drag passed container-local coordinates into a helper that converts world coordinates to local space, so the layer landed in the wrong place and pushed its bonded partner the wrong way. Every caller now passes world x/y and one helper converts each written part to its own container-local space.
- Every selected layer now propagates its own bond exactly once, a partner parented to a layer that moves in the same gesture no longer receives the delta twice, and a bond edit on one axis no longer writes the partner's other axis — which used to add a keyframe to an untouched animation and change its evaluation.
- The Motion Curves editor now targets the selected layer's own channel. When the selected layer carried legacy keyframes instead of canonical channel data, the modal fell back to another layer's track and wrote the curve there, so shaping one layer's segment changed a different layer's animation. The target is resolved inside the selected track only, and a segment must have a strictly positive duration — two keyframes on the same frame are no longer offered as an editable segment.
- A mask scalar curve edit now reaches persisted mask state: the dual bezier mutator wrote legacy and canonical channels but not `maskChannels`, so a mask segment resolved in the modal changed nothing and the evaluator's value stayed the same.
- A packaged font's `@font-face` identity is now the primary family of the layer's CSS family list, so `"'Playfair Display', serif"` registers `Playfair Display` (the full list stays on the element) instead of an unregisterable family-list descriptor that made the text fall back to serif even though the font shipped.
- The legacy single-file OGraf export now fails closed when the graphic depends on packaged assets: it writes one `.mjs` file, so a font or license it cannot carry would have been silently dropped. The export explains that and points at the ZIP package; an asset-free graphic still exports.
- The project-owned Playfair Display font is now verified against its pinned SHA-256 instead of its 4-byte sfnt signature alone, so a truncated or mutated file is refused instead of shipping as ready and failing in the decoder. A caller-supplied catalog font is never checked against that hash.
- The live documents no longer list the root `npx tsc --noEmit` as project type-check evidence; the root `tsconfig.json` only references the app and node projects, so that command checks no project file. The effective gate is `npx tsc -b --pretty false`, and the contributing guide, the pull-request checklist and the CI status document now name it.
- The dependency audit is clean again. `proxy-addr` 2.0.7 -> 2.0.8, `source-map-js` 1.2.1 -> 1.2.2 and `fast-uri` 3.1.7 -> 3.1.8 are lock refreshes inside the ranges their parents already declare, so no direct dependency moved. `shell-quote` needed a scoped `overrides` entry under `concurrently`: concurrently pins the exact vulnerable version `1.9.0` and has no newer release, so no range-based or parent-bump fix exists, and the alternative npm proposes is a semver-major downgrade of concurrently. The override cannot change this repository's behaviour — concurrently's only `quote()` consumer requires additional CLI arguments the `dev` script never passes, and 1.11.0+ exports the same `quote`/`parse` API with no dependencies. The Express `proxy-addr` advisory was already unreachable (KCS never sets `trust proxy`, and Express defaults it to `false`), and is fixed anyway. No script, engine, workflow or application source change; the API still binds loopback only and the CORS allowlist is unchanged.

### Release candidate `1.1.0-rc.2` (unreleased package metadata)
- Cut on 2026-10-08 from the exact smoke-tested code commit `6c27ef35d48d61a5e1163d2c91734c864fcafa01`; the annotated candidate and its draft prerelease exist, and the earlier candidate remains historical and unchanged.
- The Release Smoke Gate passed on that exact commit: run 37752015020, every step success. The gate is verification-only and is not the full Vitest or Chromium suite.
- The package is private and was not published. Its metadata still reads the private version `1.1.0-rc.1`, because the candidate is the exact smoke-tested commit and no untested metadata commit was introduced.
- `npm audit --audit-level=low` reports 0 vulnerabilities; the shipped changes are listed above under `[Unreleased]`.
- This candidate was then PUBLISHED AS A PUBLIC PRERELEASE on 2026-10-08 (release id `RE_kwDOTexJrc4YPnCt`, `prerelease: true`, never a stable release), ready for user QA. No tag was created or moved and npm was not published.

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



## 9. progress_164_ograf_runtime_parity_integration.md


# Progress 164 — OGraf runtime-parity integration (PR #8) and QA worktree cleanup

Date: 2026-10-11
Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (canonical stable checkout, branch `main`)

## Scope

Integrate replacement PR #8 into `main` by **fast-forward only**, fully validate the integrated
`main`, run a fresh exact-SHA Release Smoke Gate, switch the live 5173 QA surface from the redundant
Desktop worktree to the canonical stable repo, and then remove the redundant
`keyframe-character-studio-omp-*` Desktop Git worktrees **through `git worktree remove` only**.
No release, no tag, no npm publication, no branch deletion, no force push, no rebase, no history
rewrite.

## Phase 2 — Integration record (fast-forward only)

| Field | Value |
|---|---|
| Old `main` | `b7a0141501a8057214065734b59915b10cec2e43` |
| Merged branch | `origin/fix/ograf-runtime-parity-phase-a-replay`, tip `7712deeb12221a4262f4de9c4ce4d820d1231777` |
| New `main` | `7712deeb12221a4262f4de9c4ce4d820d1231777` |
| Commits added | 3 — `023d4d0` `fix: derive ograf runtime parity rules from shared authorities`, `4e0eebb` `test: prove the layer-group model in runtime/export parity`, `7712dee` `docs: reconcile the live docs and handoff for the runtime parity replay` |
| Merge commits created by this integration | **none** — `git log --merges b7a0141..HEAD` is empty |
| Push | `b7a0141..7712dee main -> main` (normal fast-forward push) |
| PR #8 | **MERGED** at 2026-10-11T20:16:03Z; GitHub records `mergeCommit.oid = 7712dee…`, i.e. the fast-forward tip itself, so no merge commit exists |
| PR #3 | untouched — still **OPEN**, head `f53398f227569188a5ec663c23acd439caf8415b` |
| Branches deleted | none |

FF eligibility was re-proven immediately before the merge: `git merge-base --is-ancestor origin/main
origin/fix/ograf-runtime-parity-phase-a-replay` exited 0 and `git rev-list --left-right --count
origin/main...origin/fix/ograf-runtime-parity-phase-a-replay` was `0 3`.

## Test-only correctness fix (the final tested code SHA)

Phase 4's bounded decision on the vacuous assertion in `src/tests/ografExport.test.ts`:

- The grouped-export test asserted `expect(svg).not.toContain('data-layer="g"')`, but **no renderer
  ever emits `data-layer="`**: both `src/ograf/svgRenderer.ts` and the generated runtime emit
  `data-layer-id="<id>"`. The expectation therefore could never fail while reading as a guard on the
  geometryless group container.
- **Option A was taken.** A throwaway probe (written, run, deleted; never committed) rendered a
  container that is hidden and one that paints. The hidden case emitted no `data-layer-id="g"` but
  did emit `data-layer-id="a"` for the child; the *visible* geometryless container emitted
  `data-layer-id="g"`, while even then the old form `data-layer="g"` never appeared. That proves the
  old form was unsatisfiable and the real attribute is meaningful.
- The assertion now targets `data-layer-id="g"`. Test-only: no product behaviour changed.
- Commit `7abee1783039c606b6fbe6f2263bc09b09640885` — `test: assert the real layer wrapper attribute
  in the OGraf group export test` (pushed `7712dee..7abee17`). This is the **TESTED CODE SHA** and
  the SHA the Release Smoke Gate ran against.
- Consequence: every gate affected by the test-only change was re-run at `7abee17` (see below), and
  the smoke was dispatched with `candidate_sha=7abee17…`.

## Phase 3 — Full post-merge validation on the integrated `main`

All E2E ran isolated (`CI=1 PORT=5008` → UI 5188 / API 5008). `npm run dev` was never used.

On the integrated `main` `7712dee` (the exact fast-forward result of PR #8):

| Command | Result |
|---|---|
| `npx tsc -b --pretty false` | exit 0, no diagnostics |
| `npm run lint` | exit 0 (oxlint clean) |
| `npm test` | **146 files / 2,234 tests passed** |
| `npm run build` | exit 0 (2,050 modules, vite 8.3.0) |
| `npm run validate:ograf` | exit 0 — `fixtures\ograf\minimal.ograf.json: valid OGraf v1 manifest` |
| focused `src/tests/ografRuntimeParity.test.ts` + stacking/matte/generated-parity/export/grouping set | **10 files / 508 tests passed** |
| `PORT=5008 npm run qa:release` | **2 passed** |
| `PORT=5008 npm run qa:v6` | **3 passed** |
| `CI=1 PORT=5008 npx playwright test --retries=0` | **334 passed, 0 failed, 0 flaky** |
| `npm run check` | exit 0 |
| `node scripts/check-state-consistency.mjs` | PASS (47 checks) |
| `npm audit --audit-level=low` | **0 vulnerabilities** |
| `git diff --check` | clean |

Re-run at the final code SHA `7abee17` after the test-only commit:

| Command | Result |
|---|---|
| `npm run check` (lint + `tsc -b` + Vitest + build) | exit 0 — **2,234 tests passed** |
| focused set (same 10 files) | **508 passed** |
| `PORT=5008 npm run qa:release` | **2 passed** (candidate SHA printed as `7abee17…`) |
| `PORT=5008 npm run qa:v6` | **3 passed** |
| `CI=1 PORT=5008 npx playwright test --retries=0` | **334 passed, 0 failed, 0 flaky** |
| `node scripts/check-state-consistency.mjs` | PASS (47 checks) |
| `git diff --check` | clean |

No assertion was weakened, no retry was hidden, no parity contract was skipped.

One intermediate `check-state-consistency` failure was observed before the test-fix commit was
pushed (`main and origin/main differ: 7abee17 vs 7712dee — main is ahead; push it`). That is the
gate working as designed; it cleared on the push and is not a defect.

## Phase 4 — Self-review of the integrated diff

- `src/ograf/runtimeSnippets.ts` (new) embeds the **canonical** helpers with
  `Function.prototype.toString`: `compareByStackingOrder` from `src/utils/stackingOrder.ts` and
  `resolveMatteSource` from `src/utils/matte.ts`. There is one definition of each rule.
- `src/ograf/runtimeTemplate.ts` now emits `const compareByStackingOrder = <canonical source>` and
  `const resolveMatteSource = <canonical source>`; the hand-written comparator and the hand-written
  matte precedence chain are gone. Only the array wrapper (`items.slice().sort(...)`) and the
  clip-exclusion stay local plumbing.
- `src/ograf/svgRenderer.ts::getMatteRelationship` now delegates precedence to the shared
  `resolveMatteSource` and keeps only the SVG-mechanism decision local.
- `svgRenderer` and the generated runtime agree: both sort by ascending `zIndex` through the same
  comparator, and `Array.prototype.sort` is stable, so equal-`zIndex` layers keep their authored
  order in both paths.
- Input arrays are not mutated: both wrappers copy first (`[...items]` / `items.slice()`); the
  parity test asserts the authored layer ids are unchanged after generation.
- A **disabled Track Matte V2 still falls back to the legacy matte** in the runtime exactly as in
  the editor; a Track Matte V2 that names no usable source still suppresses the legacy matte
  (the resolver returns `kind: 'track'` and the render sites apply nothing), unchanged from before.
- Inverse-matte behaviour is untouched: the diff moved only *source resolution*, never the inverse
  mechanism.
- Authoring-UX group containers: a real container is `isGroup`, geometryless, no paint, saved
  `visible: false`; children compose the container transform through the ordinary `parentId` chain.
  The runtime and the static renderer both paint only the child, at the same composed world pose,
  and both omit a layer element for the container.
- Grouped children retain the parent transform and obey the shared stacking order (not the authored
  array order); a matte between group siblings resolves identically and produces the same
  deterministic mask id (`kcs-ograf-track-matte-target-source-luminance`) in both paths.
- No package, schema, public-controls, prototype-key or unrelated UX source change: the integrated
  diff is exactly the four Phase A files plus docs/handoff.

## Phase 5 — Fresh exact-SHA Release Smoke Gate

| Field | Value |
|---|---|
| Workflow | `Release Smoke Gate` (`.github/workflows/release-smoke.yml`, verification only, `permissions: contents: read`) |
| Dispatch | `gh workflow run release-smoke.yml -f candidate_sha=7abee1783039c606b6fbe6f2263bc09b09640885` |
| Run id | **38172157643** |
| Candidate SHA | `7abee1783039c606b6fbe6f2263bc09b09640885` (dispatched, and asserted to equal `origin/main`) |
| Checked-out SHA | the exact requested SHA (the `Verify candidate SHA` step passed) |
| Conclusion | **success** — every step green: Checkout candidate, Verify candidate SHA, Setup Node.js, Install Dependencies (`npm ci`), Install Chromium for Playwright, Run Release Smoke Gate (`validate:ograf` + `qa:release`) |
| Tag / release / npm action | none |

## Phase 6 — Live 5173 switched to the canonical stable repo

| Surface | Before | After |
|---|---|---|
| UI 5173 | pid **34956**, `...-omp-authoring-ux-final\node_modules\vite\bin\vite.js --host --port 5173` | pid **4412** (the `npx vite` service wrapper is pid 34504), started from `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` |
| UI 5173 HTTP | 200 | 200 |
| Server working directory | the final-UX worktree | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (verified by reading the process's PEB `CurrentDirectory`) |
| Branch / HEAD served | `fix/authoring-ux-final-slices` @ `a56ed01` | `main` @ `7abee17` |
| Application tree contains PR #8 | no | yes — `/src/ograf/runtimeSnippets.ts` serves 200 and `/src/ograf/runtimeTemplate.ts` serves the embedded `compareByStackingOrder` |
| API 5000 | pid **24896** | pid **24896** (never stopped), `/api/health` 200, `/api/projects` 200 |

Only the 5173 vite process was stopped (`taskkill /PID 34956 /T /F`); the API server was untouched.

## Phases 7–9 — Worktree inventory and removal

Every candidate was clean (`git status --short` empty), had **zero** untracked non-ignored files,
held no stash, and its branch was either fully reachable from `main` or fully pushed. The only
ignored content was `node_modules/`, `dist/`, `playwright-report/`, `test-results/` and
`server/db/keyframe_studio.sqlite`, and every copy of that SQLite file held exactly the seeded row
(`sample_sequencer_project` / "Unreal 2D Character Sequence") — the canonical DB is the one the live
API uses, so no user data lived in any worktree.

| Worktree | Branch | HEAD | Merged into `main` | Remote branch | Process | PR | Removed |
|---|---|---|---|---|---|---|---|
| `-omp-authoring-ux` | `fix/authoring-ux-transform-toolbar` | `7d7ebe2` | yes (0 unique) | `origin/…` @ `7d7ebe2` | none | #4 MERGED | yes |
| `-omp-authoring-ux-final` | `fix/authoring-ux-final-slices` | `a56ed01` | yes (0 unique) | `origin/…` @ `a56ed01` | was 5173 (stopped in Phase 6) | #7 MERGED | yes |
| `-omp-camera-invariance` | `fix/authoring-ux-camera-invariance` | `55a4ab2` | yes (0 unique) | `origin/…` @ `55a4ab2` | none | #5 MERGED | yes |
| `-omp-corner-anchor` | `fix/authoring-ux-corner-anchor` | `b453ba1` | yes (0 unique) | `origin/…` @ `b453ba1` | none | #6 MERGED | yes |
| `-omp-runtime-parity-replay` | `fix/ograf-runtime-parity-phase-a-replay` | `7712dee` | yes (0 unique, now an ancestor of `main`) | `origin/…` @ `7712dee` | none | #8 MERGED | yes |
| `-omp-runtime-parity` | `fix/ograf-runtime-parity-phase-a` | `f53398f` | no (3 unique, **all pushed**) | `origin/…` @ `f53398f` | none | #3 OPEN | yes |

`-omp-runtime-parity` was removed only after proving: clean tree, zero untracked files, all three
commits already on `origin/fix/ograf-runtime-parity-phase-a`, the remote branch still present, PR #3
still open, and no process using the folder.

All six removals used `git worktree remove "<exact-path>"` and all six succeeded. No folder was
deleted by hand. `git worktree prune` (verbose, no output) left a single worktree:

```
worktree C:/Users/ertugrul.ak/Desktop/keyframe-character-studio
HEAD 7abee1783039c606b6fbe6f2263bc09b09640885
branch refs/heads/main
```

## Phase 10 — Branch / PR audit (no deletion)

Branches fully merged or superseded and therefore deletable later **only with explicit user
approval**: `fix/authoring-ux-transform-toolbar`, `fix/authoring-ux-camera-invariance`,
`fix/authoring-ux-corner-anchor`, `fix/authoring-ux-final-slices`,
`fix/ograf-runtime-parity-phase-a-replay` (all are ancestors of `main`), and the superseded
`fix/ograf-runtime-parity-phase-a` (PR #3's branch, whose application delta is now in `main` via
PR #8). **No branch was deleted in this task.**

PR #3 recommendation: it should now be **closed as superseded by the merged PR #8** — its
application delta is in `main` and only its docs/handoff bookkeeping is stale. It was **not**
closed, rewritten or deleted here; closing it remains a separate explicit user decision.

## Phase 11/13 — Docs and handoff reconciliation

- `NEXT_SESSION.md` and `PROJECT_STATE.md` were rewritten in place (stale sections replaced, not
  appended to): the checkout claim now reads `main` at or after `7abee17`, the Phase A replay
  section became the PR #8 integration record, and the stale "5173 still serves the final UX
  worktree" / "replacement PR is open" / "nothing was merged" claims are gone.
- `reports/README.md` and `docs/README_INDEX.md` list this report.
- `chatgpt_handoff/latest/` was refreshed: `NEXT_SESSION.md`, `PROJECT_STATE.md`,
  `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md` are byte-identical mirrors of their
  root documents, `README.md` / `manifest.txt` / `OMP_FINAL_RESPONSE.md` were regenerated, and this
  report is the single task-specific addition.
- `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` was regenerated from scratch for this task.

### TESTED CODE SHA vs DOCS TIP

The tested code SHA is `7abee1783039c606b6fbe6f2263bc09b09640885` (smoke run `38172157643`). The
docs/handoff reconciliation commit sits above it and changes no source, test, workflow, package or
asset byte, so it is **not** smoke-tested and the smoke was deliberately not re-run for it.

## Desktop result

`C:\Users\ertugrul.ak\Desktop\keyframe-character-studio*` now lists exactly the canonical stable
repo. `C:\Users\ertugrul.ak\Desktop\KCS` still exists and was not touched. The brief's protected path
`C:\Users\ertugrul.ak\Desktop\ograf-graphics` does not exist on this machine (nothing of that name
was present before or after this task); the similarly named `ograf-studio-stable` folder was not
touched.

## Release state

No tag was created, moved or deleted; no GitHub release was created, published or finalized; nothing
was published to npm; no dependency, package, workflow or OMP configuration change was made.
`v1.1.0-rc.2` remains the published prerelease at its historical smoke-tested candidate, and
`v1.1.0-rc.1` (target `46d2a3e59e065816d972dcd56951803951b577f6`) plus `v1.1.0-public-controls` are
unchanged. `origin/without-mask` was not touched.

