# Progress 139 — Task F: the evaluator profile harness measures the workload it claims

Branch: `fix/evaluator-profile-fixtures` (base `main` at `352d272`).
Finding: **M-04** — the performance harness did not construct or measure the workload it described.

## 1. What was open

`perf/sceneBuilder.ts` built its layers with two fields the evaluator never reads, and cast the
result with `as CharacterPart`, which hid both:

| Written | The canonical field | Consequence |
|---|---|---|
| `transform: {…}` | `baseTransform` | every layer was evaluated with the **default** transform — the profile measured zeros |
| `layers: [mask]` | `masks` | **no layer carried a mask**, so the "masked-heavy" scene measured no mask work at all |
| `type: 'custom'` | a member of the `BodyPartType` union | not a real type; only the cast accepted it |

Measured against the old builder: 0 layers with a `baseTransform`, 0 mask arrays (against a scenario
that declares 40), every evaluated opacity non-finite (`NaN`), and **0 visible layers** — the harness
was timing a scene that could not be rendered, and printing the numbers as a profile of a workload it
had not built.

## 2. Applied — the builder

- `baseTransform` and `pivot`, `type: 'custom_freeform'` with a real `path`, and the mask carried on
  `masks` as a `LayerMask` with canonical `BezierPath` geometry.
- The mask channel keys come from the production helpers (`layerMaskChannel`,
  `layerMaskPathChannel`), so the track cannot drift from what `evaluateLayerMasks` reads — and
  `maskPathChannels` now exists, which the scenario's own description ("animated mask scalars **and a
  mask path**") had claimed without providing.
- **No cast.** The layer is a `CharacterPart` literal, so the field names are the canonical ones.

## 3. Applied — the harness

`verifyScene(name, scene)` runs **before** anything is timed and asserts, per scene:

- the built layer and track counts equal the parameters;
- the layers carrying a mask equal `maskedLayers`, and the layers with a parent equal `parentedLayers`;
- every layer has a finite base transform, and every evaluated transform, opacity and mask value is
  finite with a path of at least two points;
- **every layer is visible** after evaluation (the old scene produced none).

The report now carries a **Scene verification** table with the counts it asserted, so a reader can see
what was measured rather than trusting the parameter line. A scene that is not the workload it claims
fails the harness instead of being timed and reported as one.

The report path also works now: Vitest rejects an unknown `--out`, so the harness reads
`KCS_PROFILE_OUT` from the environment. Without that, "re-run the baseline" could not produce a file
at all.

## 4. Evidence

| Check | Result |
|---|---|
| Reproduction | the new verification against the **old** builder fails: `TypeError: Cannot read properties of undefined (reading 'x')` at `layer.baseTransform` — the field was never there |
| After the fix | the harness passes and its verification table reports the real workload |
| Old builder, measured | 0/`maskedLayers` masks, 0 visible layers, non-finite opacity, default transforms |
| New builder, measured | masks, parents and visibility all match the parameters (table below) |

## 5. The re-run baseline (measured, `352d272`, Node v24.18.0 on win32/x64)

Scene verification, asserted before anything was timed:

| Scene | Layers | Tracks | Parented | Masked | Mask scalar kfs | Mask path kfs | Animated kfs | Evaluated | Visible |
|---|---|---|---|---|---|---|---|---|---|
| small | 5 | 5 | 0 | 0 | 0 | 0 | 100 | 5 | 5 |
| medium | 25 | 25 | 5 | 5 | 60 | 60 | 1500 | 25 | 25 |
| large | 100 | 100 | 20 | 20 | 480 | 480 | 12000 | 100 | 100 |
| masks | 40 | 40 | 0 | 40 | 480 | 480 | 2400 | 40 | 40 |

Measurements (milliseconds per operation, 60 iterations, p50 / p95):

| Scene | `evaluateFrame` @ frame 60 | `evaluateFrame` @ 4 frames | `evaluateTransform` (first layer) | `interpolateChannel` | `applyEasing` (1k) |
|---|---|---|---|---|---|
| small | 0.0218 / 0.0462 | 0.0466 / 0.0852 | 0.0022 / 0.0026 | 0.0005 / 0.0007 | 0.0811 / 0.1021 |
| medium | 0.1262 / 0.2255 | 0.4663 / 0.5815 | 0.0021 / 0.0025 | 0.0005 / 0.0005 | 0.0683 / 0.0687 |
| large | 1.2923 / 1.5192 | 5.5438 / 6.0446 | 0.0029 / 0.0036 | 0.0006 / 0.0007 | 0.0685 / 0.0702 |
| masks | 0.1457 / 0.2193 | 0.5580 / 0.6764 | 0.0021 / 0.0027 | 0.0005 / 0.0006 | 0.0685 / 0.0692 |

**These are numbers, not conclusions.** They are the first baseline produced on a scene whose masks,
parents and visibility were verified; no comparison to the previous (unverified) numbers is drawn,
because those measured a different scene, and no optimisation is proposed or implied. A caching
proposal may cite this table as its "before", on the same scenes and revision.

## 6. Validation

| Check | Result |
|---|---|
| `npx vitest run --config perf/vitest.perf.config.ts` | PASS — 1 test (it asserts every scene's verification) |
| Same harness against the pre-fix builder | FAIL — `TypeError` on `baseTransform` (the reproduction above) |
| `npm test` | PASS — 126 files / 1,926 tests (the harness stays out of the default suite) |
| `npm run build` (`tsc -b` + vite) | PASS |
| `npm run lint` | clean |
| `node scripts/check-state-consistency.mjs` | PASS |
| `git diff --check` | clean |

## 7. Self-review (read-only, same model)

- **Why the verification is runtime, not compile-time.** `perf/` is not part of any `tsconfig`
  (`tsconfig.app.json` includes `src` only), so removing the cast does not by itself restore type
  checking. The verification reads the canonical fields on every layer, so a renamed field now fails
  the harness loudly — which is what the cast had prevented. Adding `perf` to a project would drag the
  app's `lib`/`types` settings into it, and that is a build-config change of its own.
- **Determinism is unchanged.** No randomness, clock or generated id was introduced; the mask geometry
  steps through six sizes and repeats, so keyframes differ while every path stays valid and topologically
  identical (which is what the path interpolator needs).
- **No optimisation, no caching, nothing in `src/`.** The change is confined to `perf/`; the production
  evaluator is untouched.
- **The generated baseline is not committed.** It carries a revision and a timestamp and would go stale;
  the numbers are recorded here instead, with the command that produces them.

## 8. Not changed

- No production code, dependency, workflow, tag or release action.
- No threshold is asserted on any timing: the harness still treats a number as evidence, not a gate.
