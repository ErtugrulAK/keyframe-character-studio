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
