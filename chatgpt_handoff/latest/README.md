# KCS Minimal ChatGPT Upload Bundle — Milestone F (Interop and Evaluator Study)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

Milestone F (roadmap items 10, 11 and 12) as **study and plan only** (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`, task record `reports/progress_117_interop_study.md`):

- **Item 10 (Lottie import mapping):** the deliverable contract — source construct → canonical field, mapping kind (lossless / lossy-with-report / unsupported-and-preserved), exact temporal and easing conversion rules, and one loss entry per construct in the existing diagnostics shape. Expressions, effects, 3D/cameras, text animators, audio and image sequences are preserved and reported, not converted.
- **Item 11 (evaluator profiling):** measurement before caching — deterministic parametric scenes, wall-clock per pass on the pure utilities and through the React path, a `scripts/` harness with warm-up and p50/p95, and a revision-pinned report that is evidence rather than a gate.
- **Item 12 (editable KCS import):** a product half (compatibility matrix, migration only through the existing authorities, round-trip guarantee, one reporting import entry point) and a security half (typed parse instead of `JSON.parse` into `any`, size/shape limits, existing path-safety authorities, report-don't-repair).

Nothing is implemented, and each item states the approval it needs before any code.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_117_interop_study.md` — the task record (scope, findings, validation, decisions)
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap with milestones A–E complete and F next
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md` are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source, test and script files are intentionally omitted (the study lives at `docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md` in the repository). Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports, design contracts, release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
