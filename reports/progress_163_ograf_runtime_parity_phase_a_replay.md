# Progress 163 — OGraf runtime parity Phase A replayed onto the current `main`

Task (2026-10-11): synchronize the OGraf Runtime Parity Phase A work with the new integrated
`main`. Create a clean replacement branch from the current `origin/main`, replay **only** the
validated application delta, regenerate the docs/handoff from current truth, fully validate, push,
and open **one** replacement PR. The old PR #3 branch must not be rewritten, closed or deleted.

Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (stable checkout, `main`).
Replay worktree: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-runtime-parity-replay`.
Replay branch: `fix/ograf-runtime-parity-phase-a-replay`.

## 1. Preflight

| Field | Value |
|---|---|
| Stable checkout | clean, on `main`, `main` == `origin/main` == `b7a0141` (Authoring-UX integration docs tip; tested integrated code tip `a56ed01`) |
| Old worktree | `keyframe-character-studio-omp-runtime-parity`, clean, `fix/ograf-runtime-parity-phase-a` @ `f53398f` == origin — never edited |
| Old PR #3 | #3 `fix: unify OGraf runtime parity authorities`, OPEN, head `fix/ograf-runtime-parity-phase-a`, base `main`, `mergeable: CONFLICTING` |
| Live surfaces | UI `http://localhost:5173` (pid 34956) and API `http://127.0.0.1:5000` (pid 24896) — never stopped, restarted or rebound |

## 2. Diff boundary (read-only proof, before creating anything)

| Command | Result |
|---|---|
| `git merge-base origin/main origin/fix/ograf-runtime-parity-phase-a` | `c46e698bb8cfe82d8d75886281f602c9c89c1020` |
| `git log --oneline c46e698..origin/fix/ograf-runtime-parity-phase-a` | exactly three commits: `3f41400`, `e5a2b8a`, `f53398f` |
| `git show --stat 3f41400` | 4 files: `src/ograf/runtimeSnippets.ts` (A), `src/ograf/runtimeTemplate.ts` (M), `src/ograf/svgRenderer.ts` (M), `src/tests/ografRuntimeParity.test.ts` (A) |
| `git diff --name-status c46e698..origin/fix/ograf-runtime-parity-phase-a` | 13 files (4 application/test + 9 docs/handoff) |
| `git diff --name-status origin/main...origin/fix/ograf-runtime-parity-phase-a` | the same 13 files |
| `git merge-tree --write-tree origin/main origin/fix/ograf-runtime-parity-phase-a` | exit 1; conflicts in exactly six docs/handoff files |

Classification of every changed file:

- **(A) application/test** — `src/ograf/runtimeSnippets.ts`, `src/ograf/runtimeTemplate.ts`,
  `src/ograf/svgRenderer.ts`, `src/tests/ografRuntimeParity.test.ts`. These are `3f41400`, the only
  application/test commit.
- **(B) docs/handoff** — `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`,
  `chatgpt_handoff/latest/OMP_FINAL_RESPONSE.md`, `chatgpt_handoff/latest/README.md`,
  `chatgpt_handoff/latest/manifest.txt`,
  `chatgpt_handoff/latest/progress_158_trim_path_keyframe_authoring.md` (deleted),
  `chatgpt_handoff/latest/progress_159_ograf_runtime_parity_phase_a_closeout.md` (added),
  `docs/README_INDEX.md`, `reports/README.md`,
  `reports/progress_159_ograf_runtime_parity_phase_a_closeout.md` (added). These are `e5a2b8a` and
  `f53398f`.
- **(C) unexpected** — **none**. No package, dependency, workflow, script or unrelated source change
  exists in the branch.

The six conflicted files are exactly the docs/handoff bookkeeping files; the application delta is
conflict-free. Method: replay **only** `3f41400` with a cherry-pick; do not replay the two docs-only
commits and do not hand-resolve the old doc conflicts — regenerate the docs/handoff from current
truth instead.

## 3. Replay worktree and branch

- `git fetch --all --prune`; `git worktree list` inspected (six worktrees, none unexpectedly dirty).
- `git worktree add -b fix/ograf-runtime-parity-phase-a-replay <desktop>\keyframe-character-studio-omp-runtime-parity-replay origin/main`
  → HEAD `b7a0141`, clean tree. The old branch was never checked out in it.
- `npm ci` in the new worktree (298 packages; `node_modules` was absent).

## 4. Replayed application delta

- `git cherry-pick 3f41400` applied **cleanly** (no conflict, no auto-resolution). The commit keeps
  its message, its author `ErtugrulAK <102478080+ErtugrulAK@users.noreply.github.com>` and its author
  date `2026-10-09 14:20:57 +0300`; only the committer is the replay run. `e5a2b8a` and `f53398f`
  were deliberately not replayed.
- `git diff --name-status origin/main...HEAD` after the replay: exactly
  `src/ograf/runtimeSnippets.ts` (A), `src/ograf/runtimeTemplate.ts` (M), `src/ograf/svgRenderer.ts`
  (M), `src/tests/ografRuntimeParity.test.ts` (A).

Semantics preserved from `3f41400`:

- the generated runtime's comparator is KCS's own `compareByStackingOrder` source, embedded with
  `Function.prototype.toString` — no build step, no loader, no `eval`, no second definition;
- the generated runtime's matte precedence is KCS's own `resolveMatteSource` source, with only the
  clip exclusion kept local (naming the source and choosing the SVG mechanism are different
  decisions);
- `svgRenderer` calls the same shared resolver instead of carrying a third copy of the precedence.

## 5. Semantic audit against the new `main`

The Authoring-UX integration (`68fc28d feat: add true layer grouping` and the four fast-forward PRs)
touched shared code, so the audit was done against the actual new base rather than assumed:

- `git log --oneline c46e698..origin/main -- src/utils/stackingOrder.ts src/utils/matte.ts
  src/ograf/runtimeTemplate.ts src/ograf/svgRenderer.ts src/ograf/evaluation.ts src/types/composition.ts`
  returns only `68fc28d`.
- `68fc28d` changed `src/types/composition.ts` (+2: the optional `isGroup` field), `src/types/animator.ts`
  (+13: `CharacterPart.isGroup`), `src/hooks/useSerialization.ts`, the grouping utilities/hooks and
  their tests — it did **not** change `src/utils/stackingOrder.ts`, `src/utils/matte.ts` or any file
  under `src/ograf/`.
- `resolveMatteSource` and `compareByStackingOrder` are byte-identical to the old base; `evaluateFrame`
  still composes the `parentId` hierarchy; `src/ograf/evaluation.ts` still maps `SceneData` through
  `evaluateFrame`.

Contract re-confirmed on the new base:

1. the generated OGraf runtime and the static SVG renderer reuse the same canonical stacking-order
   behaviour as KCS — proven by the parity tests;
2. matte precedence/fallback matches the editor authority (`resolveMatteSource`) — proven;
3. the generated runtime does not hand-copy logic that can drift when a safe serialization path
   exists — the comparator and resolver are embedded from their single definition;
4. the parity tests prove generated-runtime behaviour matches canonical KCS behaviour for stacking
   order, matte precedence/fallback and the relevant snippets/helpers;
5. no unrelated authoring-UX behaviour change (the branch's diff is the four files only);
6. no package format change;
7. no OGraf schema contract invention.

**Finding: no shared runtime semantic changed on `main`, so no adaptation was needed.** The replay is
the Phase A delta verbatim.

## 6. Group-model compatibility evidence (explicitly required)

Authoring UX added real group containers (`isGroup`, geometryless, `baseTransform.opacity: 0`,
exported with `visible: !p.isGroup`). Phase A predates that model, so a second commit,
`test: prove the layer-group model in runtime/export parity`, adds five focused cases to
`src/tests/ografRuntimeParity.test.ts`. Every case drives **all three paths** — the editor authority
`evaluateOGrafScene`, the static renderer `renderOGrafSvg` and the generated `graphic.mjs`
instantiated in jsdom:

| Case | Assertion | Result |
|---|---|---|
| Grouped layers preserve the parent transform in the generated runtime | the child's composed world pose is `x = -60` in `evaluateOGrafScene` (container `+40`, child local `-100`) and `translate(140 150)` in both renderers | PASS |
| The geometryless container renders no invalid geometry | neither path emits a `data-layer-id="group"` element; the container is skipped by `visible: false` in both | PASS |
| Group children obey stacking order | `lower` (zIndex 1) paints before `upper` (zIndex 3), matching `stackingOrder` | PASS |
| Group children with matte relations preserve parity | a Track Matte V2 between two group siblings resolves identically: same `mask-type="luminance"`, same deterministic `kcs-ograf-track-matte-target-source-luminance` id | PASS |
| Save/export runtime result matches the editor/static authority | a rotated/scaled container still composes (`x = 140` from `+40` and `50 × 2`), the generated module is deterministic for identical input, and the authored layer array is not mutated | PASS |

The first draft of the scale case expected `x = 100` and failed against the real value `140`; the
expectation was corrected to the composed value, not the code. No assertion was weakened.

Note (recorded, not fixed here because it is `main`'s own integration test and outside the parity
scope): the Authoring-UX test in `src/tests/ografExport.test.ts` asserts
`not.toContain('data-layer="g"')`, which cannot match the real attribute `data-layer-id="g"` and is
therefore vacuous; the parity cases above assert the correct attribute instead.

## 7. Focused validation

| Command | Result |
|---|---|
| `npx vitest run src/tests/ografRuntimeParity.test.ts` | 15 passed (1 file) |
| `npx vitest run src/tests/ografLayerStacking.test.ts src/tests/matte.test.ts src/tests/matteRender.test.tsx src/tests/styleMatteSection.test.tsx` | 398 passed (4 files) |
| `npx vitest run src/tests/ografExport.test.ts src/tests/layerGrouping.test.ts` | 78 passed (2 files) |
| `npx vitest run src/tests/ografGeneratedParity.test.ts src/tests/ografV6Parity.test.ts src/tests/ografSchemaClosure.test.ts` | 20 passed (3 files) |
| `npm run validate:ograf` | `fixtures/ograf/minimal.ograf.json: valid OGraf v1 manifest` |
| `PORT=5007 npm run qa:release` | 2 passed (candidate SHA `023d4d0`) |
| `PORT=5007 npm run qa:v6` | 3 passed |

## 8. Generated artifact / drift audit

- The generated module carries the canonical embedded behaviour and **no stale duplicate remains**:
  `grep -rn "a.zIndex - b.zIndex"` finds the comparator exactly once in the application, in
  `src/utils/stackingOrder.ts`, and the generated module asserts exactly one occurrence of the
  embedded text.
- No remaining hand-copied matte precedence: the only other `trackMatte && … enabled !== false`
  occurrence is a display notice in `StyleMatteSection.tsx`, not a precedence decision.
- Static SVG and the generated runtime agree on stacking order and on matte precedence/fallback
  (proven by the parity tests, including the shared deterministic mask id).
- Stable z-index tie behaviour preserved: `Array.prototype.sort` is stable per spec, and both paths
  sort a copy with the same comparator, so equal `zIndex` keeps the authored order.
- Input arrays are not mutated: `stackingOrder` copies (`[...items]` / `items.slice()`), asserted for
  the group scene.
- A disabled Track Matte V2 falls back to the legacy matte in every path; inverse matte and the
  `sourceVisible` behaviour are unchanged from current `main`.
- The generated runtime is deterministic for identical input (asserted).
- The repo's existing generated-runtime drift checks (`ografGeneratedParity.test.ts`,
  `ografV6Parity.test.ts`, `ografSchemaClosure.test.ts`) all pass. No new generator architecture was
  invented.

## 9. Full validation (replay worktree only)

| Command | Result |
|---|---|
| `npx tsc -b --pretty false` | clean (exit 0) |
| `npm run lint` (`oxlint`) | clean |
| `npm test` | 146 files / 2,234 tests passed |
| `npm run build` | `tsc -b && vite build` — built, 2050 modules |
| `npm run validate:ograf` | valid OGraf v1 manifest |
| focused OGraf runtime-parity tests | 15 passed |
| focused stacking/matte tests | 398 passed |
| `PORT=5007 npm run qa:release` | 2 passed |
| `PORT=5007 npm run qa:v6` | 3 passed |
| `npm run check` | pass (lint + tsc + test + build) |
| `node scripts/check-state-consistency.mjs` | PASS (46 checks before the docs refresh; re-run after) |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| `git diff --check` | clean |
| `CI=1 PORT=5007 npx playwright test --retries=0` | **334 passed / 0 failed / 0 flaky** |

No retry, assertion or threshold was weakened and no parity contract test was skipped. All E2E ran
isolated (`CI=1 PORT=5007` → UI 5188 / API 5007); `npm run dev` was never run and ports 5173/5000 were
never bound by the tooling.

State after validation: UI 5173 healthy and unchanged (pid 34956), API 5000 healthy and unchanged
(pid 24896), the stable checkout unmodified (`b7a0141`, clean), the old runtime-parity worktree
unmodified (`f53398f`, clean).

## 10. Commit structure

| # | Commit | Content |
|---|---|---|
| 1 | `fix: derive ograf runtime parity rules from shared authorities` (cherry-pick of `3f41400`, identity preserved) | the Phase A application/test delta |
| 2 | `test: prove the layer-group model in runtime/export parity` | the five group cases required by this replay |
| 3 | docs/handoff reconciliation | this report, the indexes, the live docs and the handoff bundle |

No empty commits.

## 11. Push, replacement PR and CI

- Pushed normally: `git push -u origin HEAD:refs/heads/fix/ograf-runtime-parity-phase-a-replay`. No
  force push, no rebase, no branch deletion or rename.
- One replacement PR opened: **#8**, `https://github.com/ErtugrulAK/keyframe-character-studio/pull/8`,
  base `main`, head `fix/ograf-runtime-parity-phase-a-replay`, title
  `fix: replay ograf runtime parity on current main`. `mergeable: MERGEABLE` at the pushed head
  `4e0eebb59d077f76e9b4fa446302699c7a877a9e`.
- The PR body states: it supersedes PR #3 for integration purposes only; PR #3 was **not** rewritten;
  PR #3 remains open unless the user later approves closing it; the old doc conflicts were
  intentionally not replayed; the application delta was replayed onto current main; the full
  validation results; and the Authoring-UX group compatibility evidence.
- CI Pipeline run `38170238329` on the tested application head
  `4e0eebb59d077f76e9b4fa446302699c7a877a9e`: **success** — `Build, Lint & Test Verification`
  passed every step (`npm ci`, the OGraf fixture validation, oxlint, `tsc -b`, the Vitest suite and
  the production build).
- PR #3 was not closed and the old branch was not deleted.

## 12. Integration readiness

- `git merge-base --is-ancestor origin/main origin/fix/ograf-runtime-parity-phase-a-replay` is TRUE,
  so the replacement PR is fast-forward eligible.
- Nothing was merged. No release smoke was run (`main` has not changed).

## 13. Constraints honoured

No rebase, no force push, no `reset --hard`, no `git clean`, no branch deletion or rename, no
rewriting or auto-closing of PR #3, no merge to `main`, no tag create/move/delete, no GitHub release,
no npm publish, no deploy, no dependency/package/workflow change, no OMP global config change.
`C:\Users\ertugrul.ak\Desktop\KCS`, `C:\Users\ertugrul.ak\Desktop\ograf-graphics`,
`origin/without-mask`, the stable checkout, the old runtime-parity worktree, the other worktrees and
`.hermes/desktop-attachments/` were not touched. No release, no tag, no npm publication.
