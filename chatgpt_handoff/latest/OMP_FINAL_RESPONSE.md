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
