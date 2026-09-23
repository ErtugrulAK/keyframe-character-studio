# KCS Minimal ChatGPT Upload Bundle — final correctness checkpoint

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this checkpoint.

## What this bundle covers

The post-review correctness follow-up, complete and merged into `main` at `2b0bba0`:

- Every release-blocking finding from the full-project review is closed — **H-01…H-06 and M-01…M-05** —
  one task per finding group, each on its own branch with its own validation, a read-only self-review
  and an approval-gated fast-forward merge. The finding map is in
  `progress_141_astra_correctness_followup_summary.md`.
- The final correctness gate ran on clean `main` at `2b0bba0`: build, the full suite (126 files /
  1,932 tests), the focused regression suites from every task (387 tests), lint, `validate:ograf`,
  `qa:release`, the two browser specs, the profiling harness, the state check (35 checks), `npm audit`
  (0) and `git diff --check` — all green.
- The summary also records the scope boundaries that were stated rather than hidden (the image matte
  source, the decision not to invent an authentication system, `SceneLayer.visible`, the legacy
  template registry) and the residual observations that need their own decision (the type-check step
  that verifies nothing, unrestricted CORS, the tracked SQLite file, and the rest).
- The release tag, draft prerelease and package metadata are unchanged. What remains is the
  approval-gated **Milestone H — release finalization** (the Option C majors, the two deferred minor
  bumps, and any publish/finalize instruction).

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this checkpoint
- `progress_141_astra_correctness_followup_summary.md` — the finding map, the gate and the observations
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap, with milestone G complete and H as NEXT
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
