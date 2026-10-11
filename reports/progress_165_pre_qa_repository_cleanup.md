# Progress 165 — Final pre-QA repository housekeeping

Date: 2026-10-11
Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (canonical stable checkout, branch `main`)

## Scope

Final pre-QA repository housekeeping: close the superseded PR #3 **without merging**, delete only the
branches proven obsolete, reconcile the live documents and the handoff, and leave **MANUAL QA** as the
only remaining task. No product change, no release, no tag, no npm publication, no force push, no
rebase, no history rewrite.

## Phase 1 — Live PR audit (read-only, before any action)

| PR | State | mergedAt | Head branch | Head OID |
|---|---|---|---|---|
| #3 | **OPEN** → audited | null | `fix/ograf-runtime-parity-phase-a` | `f53398f227569188a5ec663c23acd439caf8415b` |
| #4 | MERGED | 2026-10-11T18:59:10Z | `fix/authoring-ux-transform-toolbar` | `7d7ebe29fa43b9221ba377941904522aa4be3a75` |
| #5 | MERGED | 2026-10-11T19:00:26Z | `fix/authoring-ux-camera-invariance` | `55a4ab2503a4e8f59c4030e40258ee682627b8fc` |
| #6 | MERGED | 2026-10-11T19:01:37Z | `fix/authoring-ux-corner-anchor` | `b453ba12ad60e079975884d893dd73280bd91c29` |
| #7 | MERGED | 2026-10-11T19:02:39Z | `fix/authoring-ux-final-slices` | `a56ed017e1df804e255842ca81ef1108b9b48ebc` |
| #8 | MERGED | 2026-10-11T20:16:03Z | `fix/ograf-runtime-parity-phase-a-replay` | `7712deeb12221a4262f4de9c4ce4d820d1231777` |

Proof that the closed PR #3 carried no unique required application behaviour:

- Head is `fix/ograf-runtime-parity-phase-a` at `f53398f227569188a5ec663c23acd439caf8415b`, fully pushed
  (`origin/fix/ograf-runtime-parity-phase-a` = `f53398f`).
- Merge base with `main`: `c46e698bb8cfe82d8d75886281f602c9c89c1020`.
- The three application source files are **byte-identical** to `main`:
  `git diff main fix/ograf-runtime-parity-phase-a -- src/ograf/runtimeSnippets.ts src/ograf/runtimeTemplate.ts src/ograf/svgRenderer.ts`
  is empty, and each file's `merge-base → branch` delta equals its `merge-base → main` delta
  (`+40/0`, `+10/-2`, `+24/-14`).
- `main`'s `src/tests/ografRuntimeParity.test.ts` is a **strict superset**: every test name on the
  closed branch is present in `main` (branch-only tests = none; `main` adds five more).
- `git log main..fix/ograf-runtime-parity-phase-a` is exactly three commits: `3f41400` (the shared-
  authorities application fix, already in `main` through PR #8) and the docs-only `e5a2b8a` and
  `f53398f`. `3f41400` is not itself an ancestor of `main` because PR #8 replayed the content as a
  new commit — the content, not the object identity, is what `main` carries.
- Conclusion: the branch's only real difference from `main` is stale docs/handoff bookkeeping, so
  closing PR #3 was safe.

## Phase 2 — PR #3 closed as superseded (not merged)

`gh pr close 3 --comment "Superseded by #8. The validated OGraf Runtime Parity Phase A application
delta was replayed onto the current main, revalidated, and merged through PR #8. This PR is being
closed without merge; its historical branch remains available until branch cleanup completes."`

Post-close state: **PR #3 = CLOSED, mergedAt = null** (closed 2026-10-11T20:58:45Z); **PR #8 = MERGED**
(2026-10-11T20:16:03Z). No merge, no rewrite, no force push, no edit of its historical commits.

## Phase 3 — Six-candidate safety proof

| Branch | SHA | Remote | PR | Ancestor of `main`? | Unique commits | `main...branch` diff | Verdict |
|---|---|---|---|---|---|---|---|
| `fix/authoring-ux-transform-toolbar` | `7d7ebe2` | yes | #4 MERGED | YES | 0 | empty | obsolete |
| `fix/authoring-ux-camera-invariance` | `55a4ab2` | yes | #5 MERGED | YES | 0 | empty | obsolete |
| `fix/authoring-ux-corner-anchor` | `b453ba1` | yes | #6 MERGED | YES | 0 | empty | obsolete |
| `fix/authoring-ux-final-slices` | `a56ed01` | yes | #7 MERGED | YES | 0 | empty | obsolete |
| `fix/ograf-runtime-parity-phase-a-replay` | `7712dee` | yes | #8 MERGED | YES | 0 | empty | obsolete |
| `fix/ograf-runtime-parity-phase-a` | `f53398f` | yes | #3 CLOSED (not merged) | NO | 3 | docs + already-in-main src/test | obsolete (superseded) |

No open PR depended on any of the six. Every meaningful application commit is in `main`.

## Phase 4 — Deletion

- Local: `git branch -d` deleted the five ancestor-proven branches. For the sixth,
  `git branch -d fix/ograf-runtime-parity-phase-a` **succeeded** with only the informational warning
  that it is merged to its own upstream but not to HEAD — git treats a branch merged into its
  upstream as safe, so **no `-D` was needed and no force flag was used**. All Phase 1/3 proofs held
  (PR #3 closed; not an ancestor; application delta in `main`; remote present; only historical
  docs/handoff differ), so deletion was justified.
- Remote: `git push origin --delete` removed all six from `origin`.
- After deleting: `git fetch --all --prune`; `main` unchanged; no unexpected PR change (open PR list
  empty).

## Phase 5 — Post-cleanup audit

- `main` = `origin/main` = `c5ff4b783c7ed52a15ddf9bb3b0010e8382ffb9e`; working tree clean.
- All six candidates are GONE locally and on `origin`.
- Protected branches intact: `main`, `feat/canvas-tangent-authoring` (`f15ac93`),
  `feat/canvas-tangent-authoring-replay` (`077911b`), `origin/without-mask`.
- Only the six approved branches were removed; no source, test, package, workflow or asset file changed.
- Live surfaces: UI 5173 = HTTP 200 (canonical repo); API 5000 = pid 24896 unchanged, `/api/health` 200.
- PR #3 CLOSED (not merged); PR #8 MERGED.

## Phase 6 — Docs / handoff reconciliation

Updated the live documents to the final pre-QA truth (PR #3 CLOSED as superseded; PR #8 MERGED; runtime
parity in `main`; six obsolete branches deleted; protected branches retained; 5173/5000 unchanged; no
release/tag/npm action; **NEXT = MANUAL QA ONLY**): `PROJECT_STATE.md`, `NEXT_SESSION.md`,
`docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`, `docs/KCS_RELEASE_CANDIDATE_SUMMARY.md`,
`docs/README_INDEX.md`, and the handoff bundle and one-file.

The docs commit changes no source, test, workflow, package or asset byte. Since only docs/handoff
changed, the **TESTED CODE SHA remains `7abee1783039c606b6fbe6f2263bc09b09640885`** and exact-SHA
Release Smoke Gate run `38172157643` remains the relevant tested-code smoke; the docs tip above it is
docs-only and needs no new smoke.

## Constraints honoured

No rebase, no force push, no `reset --hard`, no `git clean`, no product/source/test/package/workflow
change, no tag create/move/delete, no GitHub release, no npm publication, no deploy, no deletion of any
protected branch, and nothing touching `origin/without-mask`, `C:\Users\ertugrul.ak\Desktop\KCS` or the
OMP global configuration.
