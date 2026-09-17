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

The script's first real run immediately caught a live instance of the drift it exists for: the merged handoff bundle still described `PROJECT_STATE.md` as implemented on the (then unmerged) feature branch with the merge pending. That line was corrected, the bundle re-synced and the one-file rebuilt, and the check now passes.

## Checks enforced

| # | Check | Failure it prevents |
|---|---|---|
| 1 | `HEAD`, `main`, `origin/main` and the `v1.1.0-rc.1` target resolve; the tag target equals `46d2a3e59e065816d972dcd56951803951b577f6`; **`main`** (not the checked-out HEAD, so feature branches stay usable) matches `origin/main` when both refs exist, with the branch position reported as information | a moved tag target, or an unsynchronized `main` |
| 2 | The Milestone A/B/C integration commits (`077911b`, `96e8f9d`, `c2dcb22`) are ancestors of `HEAD`, and each commit is reachable | docs claiming a merge that is not actually in the history |
| 3 | The roadmap table marks A/B/C as `MERGED`, exactly one milestone as `NEXT`, and **requires** E/F rows to exist as plan-only — checked in the root document **and** in its bundle copy, which must agree on the NEXT milestone | a roadmap that contradicts its own milestone state, or a bundled copy that drifted |
| 4 | The **first numbered** item of the "Next scoped work" section in `NEXT_SESSION.md` **and** in its bundle copy names the milestone the roadmap marks `NEXT` | a next action that points at finished work, or a bundle copy that still presents it as upcoming |
| 5 | No active stale phrasing in the root state documents, the one-file **and every document in the handoff bundle**: wording that reports a milestone as unmerged, a merge or decision as still pending, the retired Milestone C pre-merge sentence, a started milestone as not started, or the retired roadmap intro sentence | the exact drift class this project hit six times during Milestone C |
| 6 | The required bundle documents (`README.md`, `manifest.txt`, `OMP_FINAL_RESPONSE.md`) exist; the handoff carries an active "Upload only …" instruction naming the one-file, and no active instruction tells the reader to upload the whole `latest/` folder | the superseded upload instruction, or a bundle missing its own instructions |
| 7 | `chatgpt_handoff/latest/` contains no `src__*`, no `*.test.*`/`*.spec.*` and no binary/asset copies — checked **recursively**, so a nested copy cannot hide | the flattened-test-copy failure that broke CI twice |
| 8 | No collapsed Windows paths (a drive letter immediately followed by a path segment with no separator, and the two known Desktop-workspace variants) and no secret markers in the bundle or the one-file | the two documentation/security artefacts this project also hit |
| 10 | Every bundle copy of a root state document (`NEXT_SESSION.md`, `PROJECT_STATE.md`, the roadmap, `CHANGELOG.md`) equals its source, line endings normalised | the precise drift this task hit: the bundle still carried the previous milestone's status |
| 11 | An unexpected error anywhere in the run is reported as a FAIL instead of a stack trace | a crash that hides whether the state is consistent |
| 9 | Matches under a heading marked *historical* are tolerated, so the check does not block honest history | over-blocking |

## Files changed

| File | Change |
|---|---|
| `scripts/check-state-consistency.mjs` | **new** — the consistency check (Node built-ins only) |
| `src/tests/stateConsistencyCheck.test.ts` | **new** — 9 tests: consistent fixture passes, stale active claim fails, historical section tolerated, roadmap status enforced, next-action cross-check, upload instruction, bundle hygiene, collapsed path, secret marker, and the real repository passes |
| `reports/progress_110_export_onboarding.md` | the stale line the check caught (a file-change cell still described the merge as pending) now records the merged state |
| `chatgpt_handoff/latest/**`, `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` | the bundle documents re-synced/rewritten for item 6 and the one-file rebuilt, so the shipped artifact passes its own check (the bundle copies of the root documents must now match byte-for-byte) |

Docs/state after the merge (this branch): `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` (item 6 done, item 9 still gated), `PROJECT_STATE.md`, `NEXT_SESSION.md`, `CHANGELOG.md`.

## Tests added/updated

`src/tests/stateConsistencyCheck.test.ts` (23 tests) runs the real script against temporary fixture roots (`--root`), with each negative case isolating exactly one rule so deleting that rule fails the case: active stale claim vs historical heading vs a heading that merely contains "history", a merged milestone losing `MERGED`, missing/started E/F rows, two NEXT milestones, first-item-only next-action parsing, bundle/root roadmap disagreement, mirror drift, the forbidden whole-folder upload instruction, a missing required instruction, a missing bundle document, a binary copy, a nested spec copy, a flattened test copy, a collapsed Windows path, a secret marker, and a non-directory bundle path (reported, not crashed). The git rules run against a temporary repository created with plain git (`git init`, tag, `update-ref`): tag-target mismatch, a missing milestone commit, and `main` diverging from `origin/main`. Git checks report themselves as skipped in the text fixtures, which is stated rather than implied.

## Validation matrix

| Command | Result |
|---|---|
| `node scripts/check-state-consistency.mjs` | PASS — 35 checks |
| `npx vitest run src/tests/stateConsistencyCheck.test.ts` | PASS — 23 tests |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests |
| `npm test` | PASS — 113 files / 1,688 tests |
| `npm run build` | PASS |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (pre-existing `AnimatorContext` Fast Refresh warning only) |
| `git diff --check` | clean |

## Known warnings

- Pre-existing only: the `AnimatorContext` Fast Refresh warning and the Vite chunk-size advisory.
- The check deliberately reads only known paths and known phrases; a brand-new document is not scanned until it is listed or lands in `chatgpt_handoff/latest/`, and prose that paraphrases a stale claim without using a recognised phrase is not caught (the mirror-parity rule covers the bundle case).
- The mirror-parity rule compares the bundle copies with their root documents, so the bundle must be re-synced and the one-file rebuilt as part of any state change that touches a mirrored document.

## Protected invariants

- No `package.json`, lockfile, workflow, or dependency change; no network access; no mutation of the repository by default; no generated output committed.
- No application behaviour or UI change.
- Tag `v1.1.0-rc.1`, the draft release, npm metadata, `without-mask`, global OMP configuration, `C:\Users\ertugrul.ak\Desktop\KCS`, and `ograf-graphics` untouched.
- The handoff bundle still carries documentation only.

## Independent review result

**Round 1 — BLOCKED** (2 high, 4 medium, 1 low). All findings were real and inside this task's scope, and all were fixed:

| Finding | Severity | Resolution |
|---|---|---|
| The check required `HEAD == origin/main`, so it failed on any feature branch — and the reported PASS was impossible on the committed branch state | high | It now compares **`main`** with `origin/main` and reports the checked-out branch position as information; the direction of the ahead/behind hint was corrected too |
| The delivered bundle and one-file still presented item 6 as upcoming while the root documents said it was done — the check's own target failure class, missed | high | The bundle was re-synced/rebuilt, and the checker gained the **mirror-parity rule**: every bundle copy of a root state document must equal its source |
| Negative tests did not isolate single rules, and the git rules had no negative coverage | medium | Each negative case now violates exactly one rule; the git rules are exercised against a temporary repository (`git init`, tag, `update-ref`) |
| The historical-section exemption accepted any heading containing "history" and only looked at H2–H4 | medium | Only `historical`/`superseded` headings exempt a section, at any heading level, so "History and current next action" no longer hides active state |
| Roadmap/next-action parsing looser than documented (E/F not required, whole-section substring match) | medium | E/F rows are required to exist and stay plan-only; only the first numbered next-action item is inspected |
| Upload/bundle checks skipped missing required documents, missed equivalent upload phrasings and did not recurse | medium | Required bundle documents are enforced; the forbidden-instruction and target checks run on active (non-historical) lines; the bundle walk is recursive and case-insensitive |
| Crash paths on a missing bundle or a non-directory `latest` | low | The whole run is wrapped, and the failure is reported as a FAIL with a message instead of a stack trace |

Round 2 (review-fix commit) verdict: _recorded in the final handoff._

## Merge/push status

_Pending — recorded after the review gate._

## Next recommended task

Milestone D item 9 (dependency and warning maintenance) **requires explicit user approval** before any `package.json`, lockfile, or workflow edit; present the dependency deltas and the warning inventory first. Otherwise the roadmap moves to Milestone E (OGraf QA / schema hardening study, items 7 and 8), which needs a licensing/size decision before implementation.
