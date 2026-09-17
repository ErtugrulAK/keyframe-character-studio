# KCS Minimal ChatGPT Upload Bundle — Milestone D Item 6 (State Consistency Check)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

Milestone D item 6: `scripts/check-state-consistency.mjs`, a check that fails when the live documents and the handoff bundle drift away from the real repository state (tag target, milestone commits, roadmap status, next action, upload instruction, bundle hygiene, collapsed paths, secret markers). Item 9 stays approval-gated and untouched.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_111_state_hygiene_gate.md` — the item-6 report (scope, checks, files, tests, validation, review, merge status)
- `progress_110_export_onboarding.md` — the Milestone C report (kept as the current milestone record)
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap plan with the item-6/item-9 status
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status, and the ChatGPT handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md` are byte-for-byte copies of their root documents, and `node scripts/check-state-consistency.mjs` fails when a copy drifts.

## Deliberately not included

Source and test files are intentionally omitted (the check itself lives at `scripts/check-state-consistency.mjs` in the repository). Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also omitted: `package.json`, CI/release workflows, older reports, design contracts, release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
