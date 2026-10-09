# Progress 159 — OGraf runtime parity Phase A (validation / closeout)

Date: 2026-10-09. Worktree: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-runtime-parity` (branch `fix/ograf-runtime-parity-phase-a`). The stable QA checkout at `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` was not modified.

This is the bounded validation/closeout of the Phase A branch. No implementation was redone.

## Baseline

| Field | Value |
|---|---|
| Stable repo | `main` == `origin/main` == `c46e698bb8cfe82d8d75886281f602c9c89c1020`, clean, untouched |
| Previous branch SHA | `3f41400ee79f69cf489f3acf67166c7bd0a98f51` |
| Final branch SHA | unchanged (`3f41400`) — this closeout adds documentation only |
| Branch diff vs `origin/main` | 4 files: `runtimeSnippets.ts`, `runtimeTemplate.ts`, `svgRenderer.ts`, `ografRuntimeParity.test.ts` |

## Port isolation

The user's QA session ran throughout: UI `0.0.0.0:5173` (pid 52024) and API `127.0.0.1:5000` (pid 40780) kept the **same PIDs** before and after every command, so neither was killed, restarted or rebound.

`playwright.config.ts` only isolates its ports when `CI`, `KCS_RELEASE_GATE=1` or `KCS_V6_QA=1` is set; a bare `npx playwright test` would have used **5173 with `reuseExistingServer: true`** and tested the user's stable server instead of the worktree. Every run below therefore carried an explicit isolated environment, and `server/index.js` reads `PORT || 5000`, so `PORT=5001` kept the task's API off the user's port.

| Command | UI port | API port | Isolation proof |
|---|---|---|---|
| `PORT=5001 npm run qa:release` | 5189 (`KCS_RELEASE_GATE=1`) | 5001 | `Release gate passed for candidate SHA: 3f41400…` — the worktree HEAD |
| `PORT=5001 npm run qa:v6` | 5187 (`KCS_V6_QA=1`) | 5001 | 3 passed |
| `CI=1 PORT=5001 npx playwright test --project=chromium --retries=0` | 5188 (`CI`) | 5001 | `reuseExistingServer: false`; 265 passed |

Ports 5187/5188/5189/5001 were free before the runs; only the user's 5173/5000 were listening.

## Browser validation

| Suite | Result |
|---|---|
| `npm run qa:release` | **2 passed** — candidate SHA reported as the worktree HEAD |
| `npm run qa:v6` | **3 passed** |
| `npx playwright test --project=chromium --retries=0` | **265 passed** |

No assertion, retry, threshold or test was weakened, and nothing was skipped.

## `sourceVisible` decision — **stays local (option B)**

`sourceVisible: v2.sourceVisible !== false` remains in `svgRenderer.getMatteRelationship` and in the runtime's `matteRelationship`.

Why it is not a duplicated rule:

- It is a **default-value normalisation of one field** (`absent → visible`), not a branching policy. There is no decision tree that can disagree — unlike the painted order (which sorted the wrong collection) or the matte precedence (which had a branch the editor and the export answered differently).
- Both sites read the same model field with the same default, so there is no second authority to drift from.
- Centralising it would mean widening `resolveMatteSource`'s contract, which deliberately answers only "which source does this layer use", or building an embedding path for a one-token default. The task explicitly forbids forcing centralisation to reduce line count, and widening the resolver is out of Phase A scope.
- The behaviour is already protected: `ografRuntimeParity.test.ts` asserts `sourceVisible` in **both** the static and the runtime path, so a drift would fail the suite.

## Drift gate — no tracked generated artifact exists

Re-verified from the current repo: **no tracked file carries a generated/do-not-edit marker**, and no generator writes a tracked artifact.

- `fixtures/ograf/schema/*` is **vendored and SHA-256 pinned**; `npm run validate:ograf` fails closed on a pin mismatch or an unpinned reference, so vendored-contract drift is already guaranteed.
- The two `scripts/generate-*` scripts write QA output, not tracked source.
- This branch's own drift risk — a hand-copied runtime rule — is guarded by `ografRuntimeParity.test.ts` (the embedded text must equal the canonical helper source, and the generated module must contain no hand-written comparator or precedence chain).

No fake `generate`/`check` script was added, and no dependency was introduced.

## Full validation (worktree, isolated)

| Command | Result |
|---|---|
| `npx tsc -b --pretty false` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS — **138 files / 2,102 tests** |
| `npm run build` | PASS |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` / `qa:v6` | PASS — 2 / 3 Chromium |
| `npm run check` | PASS |
| `npx playwright test --project=chromium --retries=0` | PASS — 265 |
| `node scripts/check-state-consistency.mjs` | PASS — 38 checks |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| `git diff --check` | clean |

## CI

Pull request **#3** (https://github.com/ErtugrulAK/keyframe-character-studio/pull/3) was opened from `fix/ograf-runtime-parity-phase-a` into `main` at head `e5a2b8a1de5c47902559305eb63d5312d6e1e701`. `ci.yml` triggers on `pull_request`, so the PR produced the branch's first remote run:

| Run | Workflow | Event | Head SHA | Conclusion |
|---|---|---|---|---|
| `37938283542` | CI Pipeline | `pull_request` | `e5a2b8a` | **success** |

Both runner annotations are the pre-existing non-blocking ones (Node 20 deprecation, the `ubuntu-latest` → Ubuntu 26 notice). The PR is `MERGEABLE` and open.

No earlier remote CI existed for this branch. `ci.yml` triggers on `main` pushes and pull requests only; a branch push does not start a run, and opening a PR is an external action that needs separate approval. **LOCAL GATES GREEN — REMOTE CI PENDING PR/APPROVAL.**

## Exact-SHA smoke

Not run, and deliberately out of scope for this continuation. `runtimeTemplate.ts` (the generated runtime) changed, so a fresh exact-SHA Release Smoke Gate is required on the final candidate SHA. That must be a separate zero-modification task that edits nothing, reports the exact tested SHA, and performs no tag, release or npm action. If a later commit lands on this branch, the smoke target becomes that newer SHA.

## Merge state

Merge withheld. `main` remains `c46e698`, the user's QA session is preserved, and the branch is pushed and ready for approval.
