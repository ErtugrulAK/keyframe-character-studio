# KCS — OGraf runtime parity Phase A replay: clean branch, application-only delta, full validation, one replacement PR

## Latest action

The OGraf Runtime Parity Phase A work is synchronized with the new integrated `main` by a clean
replay. A new worktree and branch were cut from the current `origin/main` (`b7a0141`), and **only**
the single application/test commit `3f41400` was cherry-picked; it applied cleanly and kept its
authorship, message and author date. The old branch's two docs-only commits were deliberately not
replayed, so the six docs/handoff bookkeeping conflicts were avoided rather than hand-resolved — the
live docs and this bundle are regenerated from current truth instead. The branch was fully validated,
pushed, and offered as **one replacement PR (#8)**. PR #3 was **not rewritten, not closed and its
branch was not deleted**; it remains open. Nothing was merged, tagged, released or published to npm.

| Field | Value |
|---|---|
| Repository | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (stable checkout, branch `main`) |
| Base | `origin/main` = `b7a0141501a8057214065734b59915b10cec2e43` |
| Replay worktree | `keyframe-character-studio-omp-runtime-parity-replay` |
| Replay branch | `fix/ograf-runtime-parity-phase-a-replay` |
| Tested application head | `4e0eebb59d077f76e9b4fa446302699c7a877a9e` |
| Replacement PR | #8 — OPEN, `MERGEABLE`, base `main` |
| Old PR #3 | OPEN, unmerged, `CONFLICTING` — untouched |
| Live preview | `http://localhost:5173/` — pid 34956, not restarted |
| API | `127.0.0.1:5000` — pid 24896, unchanged |

## Diff boundary (proved read-only, before creating anything)

`git merge-base origin/main origin/fix/ograf-runtime-parity-phase-a` = `c46e698`; the old branch
carries exactly three commits. Classification of all 13 changed files:

- **(A) application/test** — `src/ograf/runtimeSnippets.ts`, `src/ograf/runtimeTemplate.ts`,
  `src/ograf/svgRenderer.ts`, `src/tests/ografRuntimeParity.test.ts` (all of `3f41400`).
- **(B) docs/handoff** — the nine bundle/report/index files of `e5a2b8a` and `f53398f`.
- **(C) unexpected** — **none**.

`git merge-tree --write-tree origin/main origin/fix/ograf-runtime-parity-phase-a` conflicts in
exactly six docs/handoff bookkeeping files; the application delta is conflict-free.

## Semantic audit against the new `main`

The Authoring-UX integration (`68fc28d` and the four fast-forward PRs) did not change
`src/utils/stackingOrder.ts`, `src/utils/matte.ts` or any file under `src/ograf/`, and
`src/ograf/evaluation.ts` still composes the `parentId` hierarchy through `evaluateFrame`.
**No shared runtime semantic moved, so no adaptation was needed** and the replay is the Phase A delta
verbatim: the generated runtime embeds the canonical `compareByStackingOrder` and
`resolveMatteSource` sources (no build step, no loader, no `eval`, no second definition), and the
static renderer calls the same shared matte resolver.

## Authoring-UX group compatibility

The new group model (`isGroup`, geometryless, `baseTransform.opacity: 0`, exported with
`visible: !p.isGroup`) is explicitly covered by five runtime/export parity cases that drive all three
paths (the editor authority `evaluateOGrafScene`, the static renderer `renderOGrafSvg` and the
generated `graphic.mjs`): grouped layers keep the parent transform in the generated runtime; the
geometryless container renders no invalid geometry; group children obey stacking order; a matte
between two group siblings resolves identically with the same deterministic mask id; and the runtime
result matches the editor/static authority, deterministically and without mutating the authored
layers.

## Validation (replay worktree only, isolated)

`tsc -b` clean, oxlint clean, vitest **146 files / 2,234 tests**, `vite build`, `validate:ograf`,
focused OGraf runtime-parity **15 passed**, focused stacking/matte **398 passed**, the existing
generated-runtime drift checks **20 passed**, `qa:release` **2 passed**, `qa:v6` **3 passed**,
`npm run check`, `check-state-consistency` **PASS**, `npm audit --audit-level=low`
**0 vulnerabilities**, `git diff --check` clean, and the FULL Chromium suite
`CI=1 PORT=5007 npx playwright test --retries=0`: **334 passed / 0 failed / 0 flaky**. No retry,
assertion or threshold was weakened and no parity contract test was skipped.

## CI

CI Pipeline run `38170238329` on the tested application head
`4e0eebb59d077f76e9b4fa446302699c7a877a9e`: **success** — `Build, Lint & Test Verification` passed
`npm ci`, the OGraf fixture validation, oxlint, `tsc -b`, the Vitest suite and the production build.

## Integration readiness

`git merge-base --is-ancestor origin/main origin/fix/ograf-runtime-parity-phase-a-replay` is TRUE, so
the replacement PR is fast-forward eligible. Nothing was merged and no release smoke was run because
`main` has not changed.

## Constraints honoured

No rebase, no force push, no `reset --hard`, no `git clean`, no branch deletion or rename, no
rewriting or auto-closing of PR #3, no merge to `main`, no tag create/move/delete, no GitHub release,
no npm publish, no deploy, no dependency/package/workflow change, no OMP global config change.
`C:\Users\ertugrul.ak\Desktop\KCS`, `C:\Users\ertugrul.ak\Desktop\ograf-graphics`,
`origin/without-mask`, the stable checkout, the old runtime-parity worktree, the other worktrees and
`.hermes/desktop-attachments/` were not touched.
