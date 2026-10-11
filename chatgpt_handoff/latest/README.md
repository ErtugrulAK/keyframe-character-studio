# KCS Minimal ChatGPT Upload Bundle — OGraf runtime parity Phase A replay

Task-specific handoff for replaying the OGraf Runtime Parity Phase A application delta onto the
current integrated `main` (2026-10-11). This is not an archive.

## Current truth

`main` is at or after `a56ed01` (the Authoring-UX integration docs tip is `b7a0141`), matching
`origin/main`. The Phase A application delta was replayed from a clean branch cut from
`origin/main`:

| Field | Value |
|---|---|
| Replay worktree | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-runtime-parity-replay` |
| Replay branch | `fix/ograf-runtime-parity-phase-a-replay` |
| Base | `origin/main` = `b7a0141` |
| Replayed commit | `3f41400` (`fix: derive ograf runtime parity rules from shared authorities`), cherry-picked cleanly with its authorship preserved |
| Tested application head | `4e0eebb59d077f76e9b4fa446302699c7a877a9e` |
| Branch diff vs `origin/main` | exactly `src/ograf/runtimeSnippets.ts`, `src/ograf/runtimeTemplate.ts`, `src/ograf/svgRenderer.ts`, `src/tests/ografRuntimeParity.test.ts` |
| Replacement PR | **#8**, base `main`, head `fix/ograf-runtime-parity-phase-a-replay` — OPEN, `MERGEABLE` |
| Old PR #3 | OPEN, unmerged, `CONFLICTING`, **not rewritten, not closed, branch not deleted** |

The two old docs-only commits (`e5a2b8a`, `f53398f`) were **intentionally not replayed**, so the six
docs/handoff bookkeeping conflicts were avoided rather than hand-resolved; these live docs and this
bundle are regenerated from current truth instead.

## Compatibility finding

The Authoring-UX integration (`68fc28d` and the four fast-forward PRs) did not change
`src/utils/stackingOrder.ts`, `src/utils/matte.ts` or any file under `src/ograf/`, so no shared
runtime semantic moved and the replay is the Phase A delta verbatim. The new group model
(`isGroup`, geometryless, `visible: !p.isGroup`) is explicitly covered by five runtime/export parity
cases: the parent transform composes into the child in the generated runtime, the container renders
no invalid geometry, group children obey stacking order, a matte between group siblings resolves
identically (same deterministic mask id), and the runtime result matches the editor/static
authority — deterministic and without mutating the authored layers.

## Validation (isolated `CI=1 PORT=5007` → UI 5188 / API 5007)

`tsc -b` clean, oxlint clean, vitest **146 files / 2,234 tests**, `vite build`, `validate:ograf`,
focused OGraf runtime-parity **15 passed**, focused stacking/matte **398 passed**, existing
generated-runtime drift checks **20 passed**, `qa:release` **2 passed**, `qa:v6` **3 passed**,
`npm run check`, `check-state-consistency` **PASS**, `npm audit --audit-level=low`
**0 vulnerabilities**, `git diff --check` clean, and the FULL Chromium suite with `--retries=0`:
**334 passed / 0 failed / 0 flaky**.

## CI

CI Pipeline run `38170238329` on `4e0eebb59d077f76e9b4fa446302699c7a877a9e`: **success**
(`Build, Lint & Test Verification` — `npm ci`, OGraf fixture validation, oxlint, `tsc -b`, Vitest and
the production build). The documentation commit is newer than the tested application head and is
docs-only.

## Live surfaces

- UI `http://localhost:5173/` — pid 34956, never stopped or restarted.
- API `http://127.0.0.1:5000` — pid 24896, never stopped or restarted.
- The stable checkout (`main` @ `b7a0141`) and the old runtime-parity worktree
  (`fix/ograf-runtime-parity-phase-a` @ `f53398f`) are unmodified and clean.

## PR #3 audit (read-only)

`fix/ograf-runtime-parity-phase-a` (PR #3, head `f53398f`) remains OPEN and unmerged with
`mergeable: CONFLICTING`. Its application delta is conflict-free; only the six docs/handoff
bookkeeping files conflict. The recommendation (B) — a controlled sync/replay — was carried out as
this task: the application delta was replayed onto current `main` and offered as replacement PR #8.
PR #3 was not rewritten, not closed and its branch was not deleted; closing it stays a separate
explicit user decision.

## Next step

Review replacement PR #8 and decide whether to merge it. Merging is a separate explicit decision;
nothing was merged, tagged, released or published to npm, and no release smoke was run because
`main` has not changed.

## Evidence and files

- `reports/progress_163_ograf_runtime_parity_phase_a_replay.md` — the full record (diff-boundary
  proof, semantic audit, group coverage, validation counts, PR and CI).

## Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. No other file in this bundle needs to be
uploaded.
