# KCS Minimal ChatGPT Upload Bundle — Milestone F (items 10, 11, 12 first step)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

Milestone F on one stacked branch:

- **Item 11 — evaluator profiling harness (measurement only).** `perf/sceneBuilder.ts` builds deterministic scenes; `perf/evaluator-profile.perf.ts` reports p50/p95/min/max for `evaluateFrame`, `evaluateTransform`, `interpolateChannel` and `applyEasing`; `perf/vitest.perf.config.ts` runs it on demand so CI keeps its cost. First baseline: a 100-layer frame costs about 1.2 ms p50, while `interpolateChannel` is sub-microsecond — evidence for a later caching proposal, not a threshold.
- **Item 12, first step — validated KCS import boundary.** `src/utils/importValidation.ts` refuses oversized, malformed, prototype-poisoned, unknown-shaped or over-limit documents with stable codes and the offending document path; `importProject` returns `ImportResult` and no longer parses into `any`; the refusal toast shows the message and the action. The scope is the current `.kcs` scene and the legacy project shape.
- **Item 10 — Lottie import mapping design (design only).** Three mapping kinds, per-construct tables, the temporal/easing conversion rules, first-cut limits, one diagnostics contract and a validation plan, with four open questions for the user.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this stack
- `progress_119_kcs_import_boundary.md` — the item-12 first-step task record
- `progress_120_lottie_mapping_design.md` — the item-10 design task record
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap with the Milestone F status
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md` are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source, test, script, perf and design files are intentionally omitted (they live in the repository, including `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`). Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports, design contracts, release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
