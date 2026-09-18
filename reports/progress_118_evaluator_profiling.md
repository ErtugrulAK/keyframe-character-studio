# Progress 118 — Evaluator Profiling Harness (Milestone F, item 11)

## 1. Scope

Implements the approved item-11 plan from `docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`: **measurement only**. The harness builds deterministic scenes and profiles the existing evaluation utilities; it changes nothing in `src/`, adds no caching, and asserts no performance threshold.

## 2. Branch

- `chore/evaluator-profiling-harness`, based on `main` at `af0288de…` (Milestone F study merged).

## 3. What changed

- **`perf/sceneBuilder.ts`** — deterministic scene builder. Nothing uses randomness, clocks or generated ids: layer ids derive from the index and keyframe values follow a fixed pattern, so the same parameters always produce the same scene. Channels come from the production factory (`makeEmptyChannels`), so the track shape cannot drift from what the evaluator reads. Parameters: layers, channels per layer, keyframes per channel, masked layers, parented layers. Four default scenes: `small`, `medium`, `large`, `masks`.
- **`perf/evaluator-profile.perf.ts`** — the harness. Warm-up pass, then N sampled iterations per target, reporting p50/p95/min/max for `evaluateFrame` (single frame and four frames), `evaluateTransform`, `interpolateChannel` and `applyEasing`. The report is pinned to the revision, the Node version, the platform and the scene parameters, and states explicitly that the numbers are evidence, not a gate.
- **`perf/vitest.perf.config.ts`** — a dedicated config so the harness runs through the repository's own TS/Vite resolution on demand. The root config only includes `*.test.*`, so the harness never runs in the default suite and CI keeps its current cost.
- **`src/tests/evaluatorProfileScenes.test.ts`** — 5 fast cases pinning the builder's contract: layer/track counts and id alignment, exactly the requested channels and keyframe counts, byte-identical rebuilds (determinism), mask channels on masked layers only, and parent links on the parented tail (never the first layer).

Run it with:

```
npx vitest run --config perf/vitest.perf.config.ts
```

## 4. First baseline (the point of the harness)

Measured on this branch, Node `v24.18.0`, win32/x64. Milliseconds per operation, 60 sampled iterations after warm-up; `applyEasing` measures 1,000 calls.

| Scene | Target | p50 | p95 |
|---|---|---|---|
| small (5 layers, 5 channels, 4 keyframes) | evaluateFrame @ frame 60 | 0.0254 | 0.0404 |
| small | evaluateFrame @ 4 frames | 0.0438 | 0.1180 |
| small | interpolateChannel (first channel) | 0.0006 | 0.0009 |
| medium (25 layers, 5 channels, 12 keyframes, 5 masked, 5 parented) | evaluateFrame @ frame 60 | 0.1103 | 0.1365 |
| medium | evaluateFrame @ 4 frames | 0.4180 | 0.5508 |
| large (100 layers, 5 channels, 24 keyframes, 20 masked, 20 parented) | evaluateFrame @ frame 60 | 1.2258 | 1.4602 |
| large | evaluateFrame @ 4 frames | 4.7582 | 5.6087 |
| masks (40 layers, all masked) | evaluateFrame @ frame 60 | 0.0965 | 0.1126 |
| masks | evaluateFrame @ 4 frames | 0.3387 | 0.4351 |

Reading it: one frame of a 100-layer scene costs about **1.2 ms** on this machine, and evaluation scales roughly linearly with layer count. `interpolateChannel` alone is in the sub-microsecond range, so the per-frame cost sits in the pipeline around it (hierarchy, procedural deltas, masks, sorting), not in keyframe interpolation — which is exactly the kind of question a caching proposal must answer before it is written.

## 5. Validation

| Check | Command | Result |
|---|---|---|
| Harness runs | `npx vitest run --config perf/vitest.perf.config.ts` | PASS — 1 case, report printed |
| Harness stays out of CI | root config include is `*.test.*`; harness is `*.perf.ts` | confirmed — `npm test` sees no perf file |
| Builder contract | `npx vitest run src/tests/evaluatorProfileScenes.test.ts` | PASS — 5 cases |
| Full suite | `npm test` | PASS — 117 files / 1,721 tests |
| Lint / TypeScript | `npm run lint`, `npx tsc --noEmit` | clean / clean |

## 6. Protected invariants

- No change to `src/**` production behaviour: the harness only calls existing pure utilities, and the only added source file is a test.
- No dependency, `package.json`, `package-lock.json` or workflow change.
- No caching, no worker, no evaluation-order change, no threshold: those remain a separate, approval-gated proposal that must cite this baseline.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, OMP configuration and user folders are unchanged.

## 7. Residual risks

- **Wall-clock only.** The numbers include engine and machine noise; the report says to compare on the same machine and prefer p50. Allocation-level or CPU-profile attribution still needs a one-off `--cpu-prof` run.
- **Synthetic scenes.** They exercise the real evaluator but not real projects; a project with unusual structures (deep hierarchy, broadcast runtimes) could profile differently, and the builder can be extended per case when a specific question arises.
