# KCS Post-Review Correctness Fix — Task F Final Response (evaluator profile fixtures)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** implemented on `fix/evaluator-profile-fixtures` (base `main` at `352d272`); the merge decision is with the user.
- **Report:** `reports/progress_139_evaluator_profile_fixture_fix.md`.
- **Finding closed:** M-04 — the harness did not construct or measure the workload it described.

## 2) WHAT WAS WRONG

`perf/sceneBuilder.ts` wrote two fields the evaluator never reads, behind an `as CharacterPart` cast that hid both: `transform` instead of `baseTransform`, and `layers` instead of `masks` (plus a `type: 'custom'` that is not a member of the type union). Measured against the old builder: 0 layers with a `baseTransform`, 0 mask arrays against a scenario declaring 40, every evaluated opacity non-finite, and **0 visible layers** — the harness timed a scene that could not be rendered and printed the numbers as its profile.

## 3) WHAT CHANGED

- **Builder:** `baseTransform` + `pivot`, `type: 'custom_freeform'` with a real `path`, masks on `masks` as `LayerMask` with canonical `BezierPath` geometry, mask channel keys from the production helpers (`layerMaskChannel`, `layerMaskPathChannel`), and `maskPathChannels` — which the scenario's own description claimed and never provided. **No cast.**
- **Harness:** `verifyScene(name, scene)` runs **before** anything is timed and asserts the built layer/track/mask/parent counts, finite base transforms, finite evaluated transforms, opacity and mask values, and that every layer is visible. The report carries a Scene verification table, so a reader sees what was measured.
- **Report path:** Vitest rejects an unknown `--out`, so the harness reads `KCS_PROFILE_OUT`; without it, "re-run the baseline" could not produce a file at all.

## 4) EVIDENCE

- **Reproduction:** the new verification against the **old** builder fails with `TypeError: Cannot read properties of undefined (reading 'x')` at `layer.baseTransform` — the field was never there.
- **After the fix:** the harness passes and its verification table reports the real workload (masks, parents and visibility matching the parameters).
- **Baseline (measured, `352d272`, Node v24.18.0 on win32/x64, 60 iterations, p50/p95 ms):**

| Scene | `evaluateFrame` @ 60 | `evaluateFrame` @ 4 frames | `evaluateTransform` | `interpolateChannel` |
|---|---|---|---|---|
| small | 0.0218 / 0.0462 | 0.0466 / 0.0852 | 0.0022 / 0.0026 | 0.0005 / 0.0007 |
| medium | 0.1262 / 0.2255 | 0.4663 / 0.5815 | 0.0021 / 0.0025 | 0.0005 / 0.0005 |
| large | 1.2923 / 1.5192 | 5.5438 / 6.0446 | 0.0029 / 0.0036 | 0.0006 / 0.0007 |
| masks | 0.1457 / 0.2193 | 0.5580 / 0.6764 | 0.0021 / 0.0027 | 0.0005 / 0.0006 |

**These are numbers, not conclusions:** no comparison is drawn to the previous (unverified) numbers, because those measured a different scene, and no optimisation is proposed or implied.

## 5) VALIDATION

| Check | Result |
|---|---|
| `npx vitest run --config perf/vitest.perf.config.ts` | PASS — 1 test, asserting every scene's verification |
| Same harness against the pre-fix builder | FAIL — the reproduction above |
| `npm test` | PASS — 126 files / 1,926 tests (the harness stays out of the default suite) |
| `npm run build` (`tsc -b` + vite) | PASS |
| `npm run lint` | clean |
| `node scripts/check-state-consistency.mjs` | PASS |
| `git diff --check` | clean |

## 6) SELF-REVIEW NOTES

- **Why the verification is runtime, not compile-time:** `perf/` is in no `tsconfig` (`tsconfig.app.json` includes `src` only), so removing the cast does not by itself restore type checking. The verification reads the canonical fields on every layer, so a renamed field now fails the harness loudly — which is exactly what the cast had prevented. Adding `perf` to a project would drag the app's `lib`/`types` settings into it: a build-config change of its own.
- **Determinism preserved:** no randomness, clock or generated id; mask geometry steps through six sizes and repeats, so keyframes differ while every path stays valid and topologically identical.
- **Nothing in `src/`:** the change is confined to `perf/`; no optimisation, no caching, no threshold on any timing.
- **The generated baseline is not committed** (it carries a revision and a timestamp and would go stale); the numbers are recorded in the report with the command that produces them.

## 7) NEXT

- Task G (live docs and the state checker: M-05), then the final correctness gate and the summary that maps every review finding.
