# KCS Minimal ChatGPT Upload Bundle — Milestone C (First Export / Onboarding Flow)

This is a minimal, task-specific ChatGPT upload bundle for Milestone C. It was clean-refreshed for this task.

## What this bundle covers

Milestone C adds an opt-in first-export path: a compact "First export help" panel behind a labelled header button, a readiness check that reads the same OGraf diagnostics authority the export reads, and guidance that never claims a package was written. The milestone is implemented, validated, and functionally reviewed; the merge is awaiting the user's decision (see `OMP_FINAL_RESPONSE.md` §7).

## Files

- `OMP_FINAL_RESPONSE.md` — the final task response (result, behaviour, validation, review rounds, release safety, the merge decision, next action)
- `progress_110_export_onboarding.md` — the Milestone C report: scope, implementation, authorities reused, files changed, behaviour, tests, validation matrix, review rounds, residual risks, merge status
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap plan (Milestones A and B merged; C implemented on a branch and awaiting the merge decision)
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state with the Milestone C merge decision as the current action
- `PROJECT_STATE.md` — project state, validation status, and the ChatGPT handoff policy
- `manifest.txt` — this bundle's inventory

## Deliberately not included

Source and test files are intentionally omitted. Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI, and the real files live under `src/` and `e2e/` in the repository. Also omitted: `package.json`, CI/release workflows, older reports, design contracts, release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
