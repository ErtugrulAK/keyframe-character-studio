# KCS Minimal ChatGPT Upload Bundle — Milestone F Item 11 (Evaluator Profiling Harness)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

The approved item-11 plan of the Milestone F study: **measurement only** for the channel evaluator.

- `perf/sceneBuilder.ts` builds deterministic scenes (no randomness, clocks or generated ids; channels come from the production `makeEmptyChannels` factory) with parameters for layers, channels per layer, keyframes per channel, masked layers and parented layers.
- `perf/evaluator-profile.perf.ts` is the harness: warm-up, then 60 sampled iterations per target reporting p50/p95/min/max for `evaluateFrame`, `evaluateTransform`, `interpolateChannel` and `applyEasing`, with a report pinned to the revision, Node version, platform and scene parameters.
- `perf/vitest.perf.config.ts` runs it on demand; the root config only includes `*.test.*`, so CI keeps its current cost.
- `src/tests/evaluatorProfileScenes.test.ts` pins the builder contract in 5 fast cases.

First baseline (Node `v24.18.0`, p50 per operation): `evaluateFrame` @ frame 60 is 0.0254 ms (5 layers), 0.1103 ms (25 layers), **1.2258 ms (100 layers)**; `interpolateChannel` is 0.0004–0.0009 ms. No threshold is asserted — the numbers exist so a later caching proposal can cite a before/after.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_118_evaluator_profiling.md` — the task record with the baseline table
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap with the Milestone F status
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md` are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source, test, script and perf files are intentionally omitted (the harness lives at `perf/` in the repository). Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports, design contracts, release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
