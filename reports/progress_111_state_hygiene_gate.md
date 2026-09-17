# Progress 111 — Milestone D, Item 6: State Consistency Check

## Scope

Roadmap item 6 (Milestone D of `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`): a small docs/tooling check that fails when the live/current-state documents drift away from the actual repository state.

Item 9 (dependency and warning maintenance) is **not** in scope: it touches `package.json`, the lockfile, and the workflows and requires explicit user approval.

## Branch

- Branch: `chore/state-hygiene-gate`
- Feature commit: `chore: add state consistency check`
- Baseline `main`: `ec3fa5c09aa945618022dcd1e6f06734b9e5960b` (Milestones A, B and C merged; `main == origin/main`)
- `v1.1.0-rc.1` tag target (unchanged): `46d2a3e59e065816d972dcd56951803951b577f6`

## Implementation summary

One Node script, `scripts/check-state-consistency.mjs`, using only Node built-ins (`node:child_process`, `node:fs`, `node:path`, `node:url`), with a `--root <dir>` flag for fixture testing and `--quiet` for CI-style output. It reads git facts and documents, prints `PASS`/`FAIL` per check, and exits non-zero on any failure. It never writes, never calls the network, and never installs anything.

Why a script and not a test: the check must be runnable from a plain terminal (`node scripts/check-state-consistency.mjs`) without touching `package.json` or the workflows, which this task forbids. The behaviour is still unit-tested from Vitest through the same script with `--root`.

The script's first real run immediately caught a live instance of the drift it exists for: the merged handoff bundle still described `PROJECT_STATE.md` as "implemented on this branch and awaiting merge". That line was corrected, the bundle re-synced and the one-file rebuilt, and the check now passes.

## Checks enforced

| # | Check | Failure it prevents |
|---|---|---|
| 1 | `HEAD`, `origin/main` and the `v1.1.0-rc.1` target resolve; tag target equals `46d2a3e59e065816d972dcd56951803951b577f6`; `HEAD` matches `origin/main` when the ref exists | a moved tag target or an unsynchronized checkout |
| 2 | The Milestone A/B/C integration commits (`077911b`, `96e8f9d`, `c2dcb22`) are ancestors of `HEAD` | docs claiming a merge that is not actually in the history |
| 3 | The roadmap table marks A/B/C as `MERGED`, exactly one milestone as `NEXT`, and E/F as plan-only | a roadmap that contradicts its own milestone state |
| 4 | The first item of `NEXT_SESSION.md`'s "Next scoped work" names the milestone the roadmap marks `NEXT` | a next action that points at finished or unstarted work |
| 5 | No active stale phrasing in the root state documents, the one-file **and every document in the handoff bundle**: "NOT MERGED", "awaiting the user's decision", "awaiting … merge", the stale Milestone C pre-merge line, "plan-only, not started", the stale roadmap intro sentence | the exact drift class this project hit six times during Milestone C |
| 6 | The handoff instructs "Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`" and never tells the reader to upload the whole `latest/` folder as an active instruction | the superseded upload instruction |
| 7 | `chatgpt_handoff/latest/` contains no `src__*`, no `*.test.*`/`*.spec.*` and no binary/asset copies | the flattened-test-copy failure that broke CI twice |
| 8 | No collapsed Windows paths (`C:Users…`, `DesktopKCS…) and no secret markers in the bundle or the one-file | the two documentation/security artefacts this project also hit |
| 9 | Matches under a heading marked *historical* are tolerated, so the check does not block honest history | over-blocking |

## Files changed

| File | Change |
|---|---|
| `scripts/check-state-consistency.mjs` | **new** — the consistency check (Node built-ins only) |
| `src/tests/stateConsistencyCheck.test.ts` | **new** — 9 tests: consistent fixture passes, stale active claim fails, historical section tolerated, roadmap status enforced, next-action cross-check, upload instruction, bundle hygiene, collapsed path, secret marker, and the real repository passes |
| `reports/progress_110_export_onboarding.md` | the stale line the check caught (a file-change cell still said "awaiting merge") now records the merged state |
| `chatgpt_handoff/latest/progress_110_export_onboarding.md`, `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` | bundle copy re-synced and the one-file rebuilt so the shipped artifact passes its own check |

Docs/state after the merge (this branch): `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` (item 6 done, item 9 still gated), `PROJECT_STATE.md`, `NEXT_SESSION.md`, `CHANGELOG.md`.

## Tests added/updated

`src/tests/stateConsistencyCheck.test.ts` (9 tests) runs the real script against temporary fixture roots (`--root`) so the text/bundle/instruction/hygiene rules are exercised hermetically; git-dependent checks report themselves as skipped outside a repository, and one test runs the checker against the real repository.

## Validation matrix

| Command | Result |
|---|---|
| `node scripts/check-state-consistency.mjs` | PASS — 29 checks |
| `npx vitest run src/tests/stateConsistencyCheck.test.ts` | PASS — 9 tests |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests |
| `npm test` | PASS — 113 files / 1,674 tests |
| `npm run build` | PASS |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (pre-existing `AnimatorContext` Fast Refresh warning only) |
| `git diff --check` | clean |

## Known warnings

- Pre-existing only: the `AnimatorContext` Fast Refresh warning and the Vite chunk-size advisory.
- The check deliberately reads only known paths; a brand-new document is not scanned until it is listed or lands in `chatgpt_handoff/latest/`.

## Protected invariants

- No `package.json`, lockfile, workflow, or dependency change; no network access; no mutation of the repository by default; no generated output committed.
- No application behaviour or UI change.
- Tag `v1.1.0-rc.1`, the draft release, npm metadata, `without-mask`, global OMP configuration, `C:\Users\ertugrul.ak\Desktop\KCS`, and `ograf-graphics` untouched.
- The handoff bundle still carries documentation only.

## Independent review result

_Pending — recorded after the review round below._

## Merge/push status

_Pending — recorded after the review gate._

## Next recommended task

Milestone D item 9 (dependency and warning maintenance) **requires explicit user approval** before any `package.json`, lockfile, or workflow edit; present the dependency deltas and the warning inventory first. Otherwise the roadmap moves to Milestone E (OGraf QA / schema hardening study, items 7 and 8), which needs a licensing/size decision before implementation.
