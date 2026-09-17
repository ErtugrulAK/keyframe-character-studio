# KCS Minimal ChatGPT Upload Bundle — Milestone C (First Export / Onboarding Flow) — MERGED

This is a minimal, task-specific ChatGPT upload bundle for Milestone C. It was clean-refreshed for this task and now records the merged state.

## What this bundle covers

Milestone C is merged into `main`: an opt-in "First export help" panel, a readiness check that reads the same OGraf diagnostics authority the export reads, and one shared compile path behind the readiness check and both export actions. The milestone took six review rounds; the final gate verdict was READY WITH WARNINGS. The next milestone is D (state / CI / warning hygiene), whose dependency/workflow part is approval-gated.

## Files

- `OMP_FINAL_RESPONSE.md` — the final task response (review verdict, status, validation, behaviour, release safety, next action)
- `progress_110_export_onboarding.md` — the Milestone C report (implementation, authorities reused, files changed, behaviour, tests, validation matrix, review rounds, residual risks, merged status)
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap plan: A, B and C merged, D next with its approval gate
- `CHANGELOG.md` — the repository changelog with the Milestone C entry under Unreleased
- `NEXT_SESSION.md` — repository state with Milestone D as the next scoped work
- `PROJECT_STATE.md` — project state, validation status, and the ChatGPT handoff policy
- `manifest.txt` — this bundle's inventory

## Deliberately not included

Source and test files are intentionally omitted. Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI, and the real files live under `src/` and `e2e/` in the repository. Also omitted: `package.json`, CI/release workflows, older reports, design contracts, release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
