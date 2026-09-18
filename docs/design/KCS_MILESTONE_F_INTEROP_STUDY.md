# KCS Interop and Evaluator Study — Milestone F (items 10, 11, 12)

Milestone F of `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`. This is a **research and design deliverable**: it defines the mapping, the measurement plan and the product/security plan for three deferred items. **Nothing here is implemented**, and each item states the approval it needs before any code is written.

## 1. What already exists (verified at `main` = `22335a5`)

| Area | Authority | State |
|---|---|---|
| Canonical animation model | `PropertyKeyframe.bezierIn/bezierOut`, `hold` easing through `applyEasing` (`src/utils/defaults.ts:141`), `BezierPath` (`version: 1`, `src/utils/bezierPath.ts`), `LayerMask[]` (`src/utils/layerMasks.ts`), `TrackMatteV2`, `maskChannels` | The channels-only export policy is already in force: `keyframes[]` is migrated to canonical channels at export time (`src/hooks/useSerialization.ts:114-116`) so no animation data is lost |
| Channel evaluation | `interpolateChannel` (`src/utils/defaults.ts:53`), `evaluateFrame.ts` (165 lines), `evaluateTransform.ts` (174), `evaluateLayerMasks.ts` (50), `channelKeyframeGroups.ts` (81) | Pure utilities, no caching layer, no benchmark harness in `scripts/` |
| Interop boundary | `docs/interop/V6_LOTTIE_MAPPING.md` | Already fixes the principle: *KCS remains canonical; importers and exporters preserve unsupported data rather than silently reinterpreting it* |
| Project import | `importProject` (`src/hooks/useSerialization.ts:441`) reached from the header Import button; accepts a `.kcs` scene or the legacy `AnimationProject` shape; migration helpers `detectSceneCoordinateSystem` / `migrateSceneCoordinates` (`src/utils/coordinateMigration.ts`) and `convertLegacyKeyframesToChannels` (`src/utils/legacyKeyframeConversion.ts`) | OGraf manifests and packages are **explicitly rejected** today with a toast telling the user to add Import OGraf Package support (`src/components/Header/HeaderBar.tsx:267,283`); the parse runs through `JSON.parse` into `any` (line 443) before `isSceneData` narrows it |
| Security precedents | prototype-key hardening (`reports/progress_075.md`, `076`), SourcePath trust review (`088`, `089`), Windows path hardening (`068`) | Untrusted-input boundaries already have established patterns to reuse |

## 2. Item 10 — Lottie import mapping design

**Problem.** KCS can export an OGraf package and a legacy single file, but it cannot ingest a Lottie (`bodymovin`) document. Doing that safely needs a mapping design that separates *lossless* from *lossy* transformations and reports the loss instead of guessing.

**Deliverable (design only).** A mapping document that, for every canonical KCS field, states:

1. **Source construct** — the Lottie property that feeds it (`ks` transform, `sh`/`el`/`rc` shapes, `fl`/`st`, `mm`/`tt`/`td` mattes, `masksProperties`, `ip`/`op`/`st` timing, `e`/`i`/`o`/`to`/`ti` easing, `t` keyframe types, parenting via `parent`, precomps via `refId`).
2. **Mapping kind** — *lossless* (direct), *lossy-with-report* (converted with a deterministic note), or *unsupported* (preserved as-is and listed in the loss report, never reinterpreted).
3. **Conversion rule** — the exact temporal mapping (Lottie frames at `fr` fps → KCS frames, including `st` offset and `ip`/`op` in/out points) and the easing mapping (`i`/`o` Bezier handles → `bezierIn`/`bezierOut`; `h` hold → the `hold` easing; unsupported expression-driven easing → report).
4. **Diagnostics** — one loss entry per construct with code, path, feature and a user-actionable message, reusing the Task 105 diagnostics shape (`src/ograf/diagnostics.ts`) so the import UI needs no second reporting model.

**Explicitly out of scope for the design's first cut:** expressions, effects (`ef`), 3D layers and cameras, text animators beyond static text, audio, and image-sequence assets. Each is *preserved and reported*, not converted.

**Validation plan once approved:** round-trip fixtures (Lottie → KCS → Lottie) with a documented loss manifest; per-construct golden tests; a fixture set covering each mapping kind; and a UI smoke that shows the loss report before the user accepts the import.

**Approval gate:** design approval before any code (roadmap §F gate). The design must also confirm that `docs/interop/V6_LOTTIE_MAPPING.md` needs no change, or update it in the same change.

## 3. Item 11 — Evaluator performance profiling plan

**Problem.** Channel evaluation is pure and uncached; there is no reproducible measurement, so any future caching decision would be guesswork. The roadmap requires *measurement before caching* and *no behaviour change initially*.

**Deliverable (plan + harness design only).**

1. **Deterministic scenes** — synthetic scenes built from the existing factories (`partFactory`, `trackMutations`) with parametric size: layer count, channels per layer, keyframes per channel, masks per layer, graph-Bezier keyframes, and nesting depth.
2. **Measured units** — wall-clock per evaluation pass on the pure utilities (`interpolateChannel`, `evaluateFrame`, `evaluateTransform`, `evaluateLayerMasks`, `channelGroup` grouping) and the same work through the React-facing path, so the framework overhead is visible rather than assumed.
3. **Method** — a `scripts/` harness (not a Vitest test, so CI stays fast) that runs each scene N times after warm-up, reports p50/p95 and allocations where observable, and writes a JSON/markdown report with the exact revision and machine. Node's own `--cpu-prof` remains available for the one-off deep dives.
4. **Output contract** — a profile report is *evidence*, not a gate: it records the numbers, the scene parameters and the revision so a later caching proposal can cite a before/after. No threshold is asserted until the first run exists.
5. **Explicitly not in scope:** changing evaluation order, memoising results, moving work into workers, or altering `applyEasing`/`interpolateChannel` semantics.

**Validation plan once approved:** the harness must be reproducible (same scene in, same evaluation count out) and its numbers must match a hand-checked spot sample on a tiny scene.

**Approval gate:** implementation approval for any caching/optimisation is separate and comes only after a profile exists.

## 4. Item 12 — Editable KCS import plan

**Problem.** Today an imported `.kcs` file is either a current scene or the legacy `AnimationProject` shape, and the legacy branch is a bespoke mapping; OGraf manifests/packages are rejected with a toast. A **product** plan is needed for making imports editable and round-trippable, and a **security** plan for treating every imported document as untrusted input.

**Deliverable (plan only), split into two halves.**

**Product half — compatibility and round-trip:**
1. **Compatibility matrix** — supported document kinds (current scene, legacy `AnimationProject`, OGraf single-file legacy, OGraf package), the schema version of each, and what "editable" means for each (full edit / edit-after-migration / read-only-with-report).
2. **Migration path** — every import goes through the existing migration authorities (`detectSceneCoordinateSystem`, `migrateSceneCoordinates`, `convertLegacyKeyframesToChannels`), never through a new bespoke branch; the plan states which authority owns each version hop and what happens when a hop is missing.
3. **Round-trip guarantee** — export → import must preserve the canonical fields listed in §1; a fixture per document kind proves it, and anything the import cannot represent is reported instead of dropped.
4. **UX** — one import entry point that detects the kind and shows the migration/loss report (same diagnostics shape as item 10) before replacing the user's work.

**Security half — untrusted document handling:**
1. **Typed parse at the boundary** — replace `JSON.parse` into `any` (`src/hooks/useSerialization.ts:443`) with a validated parse that produces a typed value (schema parse or type guards) and fails with a diagnostic, reusing the prototype-key hardening rules from `reports/progress_075.md`/`076`.
2. **Size and shape limits** — bound document size, keyframe counts, path length and nesting depth before any allocation-heavy work.
3. **No implicit trust** — imported asset paths stay subject to the existing path-safety authorities (`src/utils/pathSafety.ts`, `src/ograf/packageWriter.ts` guards); a document may not name a file outside the allowed roots.
4. **Report, don't repair silently** — every rejected or downgraded construct appears in the same loss/migration report the product half defines.

**Validation plan once approved:** the compatibility matrix executed as fixtures, a full import/export validation run per document kind, negative fixtures for oversized/prototype-polluted/unsafe-path documents, and one browser smoke per entry point.

**Approval gate:** item 12 is explicitly deferred in the roadmap and needs its own product/security approval; this section is the plan that approval would be given against.

## 5. Out of scope for this study

- No implementation of any kind; no new dependency (a Lottie parser, a benchmarking library, or a validation library would each need their own approval).
- No change to the canonical model, the channel semantics, the OGraf package format, or the existing export paths.
- No host contract work (that stays with the Milestone E folder QA tool) and no release/tag/npm action.

## 6. Open decisions this study asks for

1. **Item 10:** approve the Lottie mapping design scope (the construct list and the loss-report contract) as the next design deliverable.
2. **Item 11:** approve building the profiling harness only (no caching), and the scene parameters to profile first.
3. **Item 12:** approve the product/security plan as the basis for implementation, and confirm which document kinds must be editable in the first cut.
