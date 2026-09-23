# KCS Minimal ChatGPT Upload Bundle — final live-state reconciliation

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this checkpoint.

## What this bundle covers

The post-review correctness follow-up, complete and merged into `main`, with the live documents and
this handoff reconciled to the repository truth (`main == origin/main == 64291bc`):

- Every release-blocking finding from the full-project review is closed — **H-01…H-06 and M-01…M-05** —
  one task per finding group, each on its own branch with its own validation, a read-only self-review
  and an approval-gated fast-forward merge. Phase 0 closed Task 4 (`engines` + npm-12 `allowScripts`)
  at `1a12d79`. The finding map is in `progress_141_astra_correctness_followup_summary.md`.
- The Task G merge turned `main` red for one push: the new live-revision rule compared an "at or after"
  claim with `git merge-base --is-ancestor`, and CI's `--depth 1` checkout does not carry the older
  commits. The fix at `dcbf9f5` reports that limit as skipped, exactly as the tag and milestone checks
  already do, and keeps failing when a *full* checkout cannot resolve the commit at all.
- The final correctness gate ran on clean `main` at `dcbf9f5`: build, the full suite (126 files /
  1,934 tests), the focused regression suites from every task (389 tests), lint, `validate:ograf`,
  `qa:release`, the two browser specs (7 tests), the profiling harness, the state check (35 checks),
  `npm audit` (0) and `git diff --check` — all green. CI on `main` is green at `64291bc`
  (run `35880658380`).
- The summary also records the scope boundaries that were stated rather than hidden (the image matte
  source, the decision not to invent an authentication system, `SceneLayer.visible`, the legacy
  template registry) and the residual observations that need their own decision (the type-check step
  that verifies nothing, unrestricted CORS, the tracked SQLite file, and the rest).
- The release tag, draft prerelease and package metadata are unchanged. **Milestone H — release
  finalization** is NEXT: the approval-gated Option C majors, the two deferred minor bumps
  (`oxlint` 1.85, `jsdom` 30.1.x), and any publish/finalize instruction. Option C stays deferred and
  is **not** a blocker.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this checkpoint
- `progress_141_astra_correctness_followup_summary.md` — the finding map, the gate and the observations
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap, with milestones A–G complete and H as NEXT
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md`
are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after
CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source, test and design files are intentionally omitted (they live in the repository). Flattened
copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also
omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports,
release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination.
Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
