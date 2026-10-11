# KCS — final pre-QA repository housekeeping: PR #3 closed as superseded, six obsolete branches deleted, MANUAL QA is the only task left

## Latest action

The final pre-QA repository housekeeping is complete on the canonical checkout
(`C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`, branch `main`). The superseded **PR #3 was
closed without merging**; six branches proven obsolete were deleted locally and on `origin`; the live
documents and the handoff were reconciled; and the only remaining task is **MANUAL QA**.

| Field | Value |
|---|---|
| Repository | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (canonical stable checkout, branch `main`) |
| `main` | `c5ff4b783c7ed52a15ddf9bb3b0010e8382ffb9e`, matching `origin/main` (before this docs commit) |
| PR #3 | **CLOSED as superseded (not merged)** — closed 2026-10-11T20:58:45Z, head `f53398f` |
| PR #8 | **MERGED** (2026-10-11T20:16:03Z) — OGraf Runtime Parity Phase A is in `main` |
| Tested code SHA | `7abee1783039c606b6fbe6f2263bc09b09640885` (`7abee17`) — unchanged |
| Tested-code smoke | Release Smoke Gate run `38172157643` — **success** |
| Live preview | `http://localhost:5173/` — HTTP 200, canonical repo, `main` application code |
| API | `127.0.0.1:5000` — pid 24896, never restarted, `/api/health` 200 |
| Next task | **MANUAL QA ONLY** |

## PR #3 — closed as superseded (proof)

PR #3 (`fix/ograf-runtime-parity-phase-a`, head `f53398f227569188a5ec663c23acd439caf8415b`, fully
pushed to `origin`) carried no unique required application behaviour:

- `git diff main fix/ograf-runtime-parity-phase-a -- src/ograf/runtimeSnippets.ts
  src/ograf/runtimeTemplate.ts src/ograf/svgRenderer.ts` is **empty** — the three application source
  files are byte-identical to `main`, with identical `merge-base → branch` and `merge-base → main`
  deltas (`+40/0`, `+10/-2`, `+24/-14`).
- `main`'s `src/tests/ografRuntimeParity.test.ts` is a **strict superset**: every test name on the
  closed branch is present in `main` (branch-only tests = none).
- `git log main..fix/ograf-runtime-parity-phase-a` is exactly `3f41400` (the shared-authorities fix,
  already in `main` through the merged PR #8) plus the docs-only `e5a2b8a` and `f53398f`.

It was closed with a comment naming PR #8 and was not merged, rewritten, force-pushed or edited.

## Branch cleanup — deleted vs retained

Deleted locally (via `git branch -d`) and on `origin` (via `git push origin --delete`):

- `fix/authoring-ux-transform-toolbar` (`7d7ebe2`, PR #4 MERGED, ancestor of `main`, 0 unique)
- `fix/authoring-ux-camera-invariance` (`55a4ab2`, PR #5 MERGED, ancestor, 0 unique)
- `fix/authoring-ux-corner-anchor` (`b453ba1`, PR #6 MERGED, ancestor, 0 unique)
- `fix/authoring-ux-final-slices` (`a56ed01`, PR #7 MERGED, ancestor, 0 unique)
- `fix/ograf-runtime-parity-phase-a-replay` (`7712dee`, PR #8 MERGED, ancestor, 0 unique)
- `fix/ograf-runtime-parity-phase-a` (`f53398f`, PR #3 CLOSED not merged, not an ancestor, 3 unique =
  the already-integrated fix plus two docs commits)

For the sixth, `git branch -d` **succeeded** with only the informational warning that the branch is
merged to its own upstream but not to HEAD; **no `-D` and no force flag was used**, and every proof
held. Retained: `feat/canvas-tangent-authoring` (Milestone A review artefact),
`feat/canvas-tangent-authoring-replay` (its replayed integration branch), `origin/without-mask`
(ARCHIVE), and every branch outside the six candidates. `main` and `origin/main` are
`c5ff4b783c7ed52a15ddf9bb3b0010e8382ffb9e`; the working tree is clean.

## Docs tip vs tested code

This housekeeping changed **docs/handoff only** — no source, test, workflow, package, lockfile or asset
byte — so the tested code SHA stays `7abee17` (smoke run `38172157643`), the smoke was not re-run, and
the docs tip above `7abee17` is docs-only.

## Release state

No tag was created, moved or deleted; no GitHub release was published or finalized; nothing was
published to npm. `v1.1.0-rc.2` remains the published prerelease at its historical candidate, and
`v1.1.0-rc.1` (target `46d2a3e59e065816d972dcd56951803951b577f6`) plus `v1.1.0-public-controls` are
unchanged.

## Next step

**MANUAL QA ONLY.** The user QA pass against 5173 is the next input; a stable release, a further
candidate, or any code-affecting commit (which would require a new exact-SHA smoke run) remains a
separate explicit decision.

## Evidence

- `reports/progress_165_pre_qa_repository_cleanup.md` — the full record: the PR #3 audit proof and its
  post-close state, the per-candidate safety table, the deletions, the post-cleanup audit, and the
  docs/handoff reconciliation.
