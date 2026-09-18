# KCS Milestone F Item 11 — Final Response (Evaluator Profiling Harness)

This file is the OMP final response for the item-11 task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** measurement only, implemented on branch `chore/evaluator-profiling-harness` (base `main` = `af0288de…`); awaiting the review and the user merge decision.
- **Report:** `reports/progress_118_evaluator_profiling.md` (includes the first baseline table).

## 2) WHAT CHANGED

| Item | Change |
|---|---|
| Deterministic scenes | `perf/sceneBuilder.ts` — no randomness, clocks or generated ids; channels come from the production `makeEmptyChannels` factory; parameters cover layers, channels per layer, keyframes per channel, masked layers and parented layers; four default scenes (small, medium, large, masks) |
| Harness | `perf/evaluator-profile.perf.ts` — warm-up then 60 sampled iterations per target, p50/p95/min/max for `evaluateFrame` (1 and 4 frames), `evaluateTransform`, `interpolateChannel` and `applyEasing`; the report is pinned to revision, Node version, platform and scene parameters and states that the numbers are evidence, not a gate |
| On-demand run | `perf/vitest.perf.config.ts` — the root config only includes `*.test.*`, so the harness never runs in CI; run it with `npx vitest run --config perf/vitest.perf.config.ts` |
| Builder contract | `src/tests/evaluatorProfileScenes.test.ts` — 5 fast cases: counts and id alignment, exact channels/keyframes, byte-identical rebuilds, mask channels only on masked layers, parent links never on the first layer |

## 3) FIRST BASELINE (excerpt)

Node `v24.18.0`, win32/x64, 60 sampled iterations after warm-up, milliseconds per operation:

| Scene | Target | p50 | p95 |
|---|---|---|---|
| small (5 layers) | evaluateFrame @ frame 60 | 0.0254 | 0.0404 |
| medium (25 layers, 5 masked, 5 parented) | evaluateFrame @ frame 60 | 0.1103 | 0.1365 |
| large (100 layers, 20 masked, 20 parented) | evaluateFrame @ frame 60 | 1.2258 | 1.4602 |
| masks (40 layers, all masked) | evaluateFrame @ frame 60 | 0.0965 | 0.1126 |
| any scene | interpolateChannel (first channel) | 0.0004–0.0009 | ≤ 0.0015 |

Reading it: a 100-layer frame costs about **1.2 ms**, scaling roughly linearly with layer count, while keyframe interpolation itself is sub-microsecond — the per-frame cost sits in the pipeline around it. That is the evidence a caching proposal would have to build on.

## 4) VALIDATION

| Check | Result |
|---|---|
| Harness | `npx vitest run --config perf/vitest.perf.config.ts` — PASS, report printed |
| CI cost | unchanged: the root config includes only `*.test.*` |
| Builder contract | PASS — 5 cases |
| Full suite | PASS — 117 files / 1,721 tests |
| Lint / TypeScript | clean / clean |

## 5) SAFETY

- No `src/` production behaviour change, no caching, no worker, no evaluation-order change, no threshold; no dependency, `package.json`, lockfile or workflow change.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, OMP configuration and user folders are unchanged.

## 6) NEXT

One decision: merge `chore/evaluator-profiling-harness` after the review passes. Items 10 and 12 of Milestone F proceed on their own branches.
