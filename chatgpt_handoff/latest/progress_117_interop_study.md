# Progress 117 — Milestone F Study: Lottie Mapping, Evaluator Profiling, Editable KCS Import

## 1. Scope

Milestone F (roadmap items 10, 11, 12) delivered as **research and design only**: `docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`. Nothing is implemented; each item states the approval it needs before any code is written.

## 2. Branch

- `docs/milestone-f-interop-study`, based on `main` at `22335a5dc899…` (Milestone E merged, CI run green).

## 3. What the study establishes

**Current state (verified at this revision).** The interop boundary already exists as a principle in `docs/interop/V6_LOTTIE_MAPPING.md` (KCS stays canonical; unsupported data is preserved, never silently reinterpreted). The channels-only export policy is already in force (`src/hooks/useSerialization.ts:114-116`). Channel evaluation is pure and uncached across `interpolateChannel` (`src/utils/defaults.ts:53`), `applyEasing` (`:141`), `evaluateFrame` (165 lines), `evaluateTransform` (174), `evaluateLayerMasks` (50) and `channelKeyframeGroups` (81), and there is no benchmark harness. Project import accepts a `.kcs` scene or the legacy `AnimationProject` shape, rejects OGraf manifests/packages with a toast, and parses through `JSON.parse` into `any` before `isSceneData` narrows it (`src/hooks/useSerialization.ts:443`).

**Item 10 — Lottie import mapping design.** The study fixes the deliverable's contract: for every canonical field, the source Lottie construct, a mapping kind (lossless / lossy-with-report / unsupported-and-preserved), the exact temporal and easing conversion rule, and one loss entry per construct in the existing Task 105 diagnostics shape. Expressions, effects, 3D/cameras, text animators, audio and image sequences are explicitly *preserved and reported*, not converted. Validation: round-trip fixtures with a loss manifest, per-construct golden tests, and a UI smoke that shows the loss report before the import is accepted.

**Item 11 — evaluator performance profiling plan.** Measurement before caching: deterministic parametric scenes built from the existing factories, wall-clock per evaluation pass on the pure utilities *and* through the React path so framework overhead is visible, a `scripts/` harness (not a Vitest test) with warm-up and p50/p95 plus a JSON/markdown report pinned to the revision and machine. The report is evidence, not a gate; no threshold is asserted before the first run, and caching/workers/semantic changes are out of scope.

**Item 12 — editable KCS import plan.** A product half (compatibility matrix per document kind, migration only through the existing authorities `detectSceneCoordinateSystem` / `migrateSceneCoordinates` / `convertLegacyKeyframesToChannels`, a round-trip guarantee with a fixture per kind, and one import entry point that reports before replacing the user's work) and a security half (typed parse at the boundary instead of `JSON.parse` into `any`, size/shape limits, existing path-safety authorities honoured, and report-don't-repair).

## 4. Validation of this deliverable

| Check | Result |
|---|---|
| Study covers items 10, 11, 12 | yes — mapping contract, measurement plan, product+security plan, each with its own approval gate |
| Claims cite real authorities | every referenced file and line exists at `main` = `22335a5` (verified while writing: `useSerialization.ts:114-116,443`, `defaults.ts:53,141`, `HeaderBar.tsx:267,283`, evaluator line counts, `docs/interop/V6_LOTTIE_MAPPING.md`) |
| Implementation | **none**, by design |
| Repository changes | documentation only (`docs/design/**`, `reports/**`, roadmap, state documents, handoff bundle) |
| State consistency | `node scripts/check-state-consistency.mjs` PASS after the updates |

## 5. Protected invariants

- No source, test, script, dependency, `package.json`, lockfile or workflow change.
- The canonical model, channel semantics, OGraf package format and existing export paths are untouched.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, global OMP configuration and the user's folders are unchanged.

## 6. Open decisions

1. Item 10: approve the Lottie mapping design scope (construct list + loss-report contract).
2. Item 11: approve the profiling harness only (no caching) and the first scene parameters.
3. Item 12: approve the product/security plan as the basis for implementation and name the document kinds that must be editable first.
