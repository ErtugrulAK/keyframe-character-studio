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
