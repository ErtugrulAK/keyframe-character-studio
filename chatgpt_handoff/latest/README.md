# KCS Minimal ChatGPT Upload Bundle — Pre-Milestone-B State

This is a minimal, task-specific ChatGPT upload bundle for the pre-Milestone-B state: Milestone A is merged and verified, and Milestone B (graph + keyboard accessibility) is the next scoped milestone. It was clean-refreshed for this task.

## What this bundle covers

Milestone A is complete and merged (direct Bezier tangent-handle authoring on the stage canvas, six review rounds, verification matrix, legacy points normalization, selection model, Escape/batch lifecycle, smooth-handle and extreme-coordinate guards). This bundle also carries the Milestone B start note: scope, boundaries, authorities to reuse, and the validation gate.

## Files

- `progress_108_canvas_tangent_authoring.md` — the Milestone A report: orchestration record, blocker-closing pass, verification matrix, validation table, review rounds, deviations
- `progress_109_graph_accessibility_start.md` — the Milestone B start note: scope, hard boundaries, authorities to reuse, validation gate
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the grouped roadmap plan; Milestone A is MERGED and Milestone B is the next milestone
- `NEXT_SESSION.md` — repository state with Milestone B as the first next scoped work
- `PROJECT_STATE.md` — project state, validation status, and the ChatGPT handoff policy

## Deliberately not included

Source and test files are intentionally omitted. Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI, and the real files live under `src/` and `e2e/` in the repository. Also omitted: `package.json`, CI/release workflows, older reports, release/current-state documents, the Milestone A design contract (it lives at `docs/KCS_CANVAS_TANGENT_AUTHORING_CONTRACT.md` in the repository), `CHANGELOG.md` (its Unreleased entry for Milestone A is recorded in the repository), QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources; uploading the whole folder is no longer the default.
