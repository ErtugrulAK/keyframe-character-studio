# KCS Development Report — V6 Motion Core and Compositing Upgrade

Metadata:
- Date: 2026-09-07
- Milestone: KCS V6 Motion Core and Compositing Upgrade
- Branch: `feat/v6-motion-core`
- Starting HEAD: `8024d4f` — clean pre-V6 checkpoint
- Ending HEAD: `ef900c6 feat: deliver v6 motion core and compositing`
- Origin: Feature branch work; no merge or main-branch mutation
- Commit status: `Commit: YES — ef900c6`
- Push status: `Push: NOT YET — feature-branch push is the next release action.`
- Report number: `progress_025`

# 1. Executive Summary

Implemented the approved V6 Motion Core and Compositing package. KCS now has one canonical cubic Bezier path authority, same-layer ordered masks, V2 alpha/luminance track mattes, shared temporal interpolation, Value Graph and derived Speed Graph views, additive SceneData migration, focused fixtures, OGraf path parity, and browser proof for the V6 fixture.

User impact: freeform paths can carry cubic handles; masks and track mattes have explicit relationships and modes; mask scalar channels appear in the timeline; graph editing uses the same interpolation evaluator as playback; legacy freeform and matte projects remain importable.

Completion state: implementation, focused tests, full Vitest, TypeScript, lint, production build, focused Chromium proof, manual browser proof, documentation, and one feature-branch checkpoint are complete. The feature branch has not been pushed yet. The final repeated `npm run qa:v6` attempt was blocked by an existing port-5173 process serving a Playwright report instead of the app; an earlier post-fix Chromium run passed both tests, and direct browser verification on the live V6 frontend passed the path/mask/matte/graph checks.

# 2. Original Objectives

In scope:

- Establish the V6 canonical Bezier path contract and migrate legacy freeform rendering.
- Add reusable path authoring controls and explicit topology compatibility behavior.
- Add ordered same-layer Layer Masks with SVG-native compositing semantics.
- Add Track Matte V2 source relationships, alpha/luminance modes, inversion, source visibility, and cycle validation.
- Add temporal handles, hold and auto-Bezier interpolation, Value Graph, and scoped derived Speed Graph.
- Preserve legacy serialization and add SceneData version 2 migration coverage.
- Audit OGraf behavior and document Lottie/OGraf mapping and V6+ roadmap.
- Add deterministic V6 fixture and focused Chromium QA command.
- Validate with project tests, TypeScript, lint, build, browser checks, and permanent reporting.

Out of scope:

- A second animation or playback engine.
- Silent topology correspondence inference.
- Silent conversion of alpha/luminance mattes to clip paths.
- Editable speed-graph controls without a defined inverse mapping to temporal handles.
- New runtime dependencies.
- Merge, main-branch mutation, or automatic remote push.

# 3. Problems Discovered

## Missing V6 migration imports — FIXED/PASS

The first serialization test run exposed missing runtime imports for `normalizeMotionTemplates` and `migrateSceneLayerV6`; imports returned `false` through the defensive boundary. The imports were restored and the complete 94-test serialization suite passed.

## Existing fields dropped by additive mapping — FIXED/PASS

Build and serialization coverage exposed `strokeWidth`, `shadowColor`, and related evaluated content fields missing from one migration/evaluation boundary. The fields were restored without changing their public names. Existing `useSerialization` and `evaluateFrame` tests passed.

## Graph modal runtime error — FIXED/PASS

Chromium reproduced `TRACK_CHANNELS is not defined` when opening Motion Curves. The missing value import was added to `SequencerTimeline`. The focused Chromium graph test then passed and manual browser inspection confirmed Value Graph and Speed Graph controls plus the `speed-graph-panel`.

## TypeScript strictness gaps in V6 extensions — FIXED/PASS

The production build exposed missing context exports, channel-union indexing gaps, missing `matteMaskId`, incomplete `LayerContent` fields, and optional mask-path normalization issues. These were corrected at their existing ownership boundaries. `npx tsc --noEmit` and `npm run build` passed.

## Port-5173 QA process interference — PARTIAL/ENVIRONMENTAL

A later repeated `npm run qa:v6` run timed out because the reused port-5173 process served `playwright-report/index.html`; a separate Vite process was available on port 5174. No source failure was observed in that run. The post-fix Chromium run before the process interference passed 2/2 tests, and direct browser verification on port 5174 passed the live V6 surface.

# 4. Files Created

- `docs/V6_PLUS_ANIMATION_ROADMAP.md` — V6 delivered boundary, V6.1–V6.3 roadmap, and non-goals.
- `docs/adr/ADR-001-v6-unified-bezier-paths.md` — canonical path authority and topology policy.
- `docs/adr/ADR-002-v6-mask-and-matte-compositing.md` — mask and Track Matte V2 semantics.
- `docs/adr/ADR-003-v6-temporal-interpolation-and-graphs.md` — interpolation authority and graph scope.
- `docs/interop/V6_LOTTIE_MAPPING.md` — Lottie/OGraf field mapping and deferred-capability boundary.
- `docs/research/V6_MOTION_COMPOSITING_RESEARCH.md` — standards, reference products, licensing, and maintenance research.
- `e2e/fixtures/v6-motion-core.scene.json` — deterministic V6 path, mask, matte, and animated-channel fixture.
- `e2e/v6-motion-core.spec.ts` — focused Chromium rendering and graph-studio suite.
- `src/components/Inspector/BezierPathEditor.tsx` — reusable SVG path editor with vertex, tangent, topology, and ordering controls.
- `src/components/Inspector/TemporalGraphPanel.tsx` — shared-evaluator Value Graph and derived Speed Graph panel.
- `src/tests/BezierPathEditor.test.tsx` — path editor interaction coverage.
- `src/tests/TemporalGraphPanel.test.tsx` — graph rendering, drag, speed, and temporal-handle coverage.
- `src/tests/bezierPath.test.ts` — canonical path geometry coverage.
- `src/tests/interpolationV6.test.ts` — hold, temporal-handle, and auto-Bezier coverage.
- `src/tests/layerMaskAnimation.test.ts` — mask channel mutation coverage.
- `src/tests/layerMasks.test.ts` — mask geometry and definition coverage.
- `src/tests/v6Migration.test.ts` — additive path and mask import normalization coverage.
- `src/utils/bezierPath.ts` — canonical pure Bezier path authority.
- `src/utils/evaluateLayerMasks.ts` — evaluated layer-mask scalar resolution.
- `src/utils/layerMasks.ts` — mask path mapping and SVG definition authority.
- `src/utils/v6Migration.ts` — additive SceneLayer V6 migration.

# 5. Files Modified

- `package.json` — added the `qa:v6` Chromium script; no dependency changes.
- `skills/keyframe-studio/kcs-track-matte/SKILL.md` — documented V6 path, mask, matte, channel, OGraf, and QA boundaries; version 18.1.0.
- `src/types/animator.ts` — added path, temporal handle, Layer Mask, Track Matte V2, and mask-channel types/constants while retaining legacy fields.
- `src/types/composition.ts` — added SceneData version 2 and canonical V6 layer/content fields.
- `src/utils/bounds.ts` — included canonical path geometry in freeform bounds handling.
- `src/utils/freeform.ts` — delegated legacy freeform SVG construction to the canonical path builder.
- `src/utils/shapeOutlineHelper.tsx` — used canonical path data for freeform outlines.
- `src/utils/defaults.ts` — extended shared interpolation with hold, temporal handles, auto-Bezier controls, and topology-safe path interpolation.
- `src/utils/evaluateFrame.ts` — evaluated trim and masks and passed canonical content fields through the existing frame authority.
- `src/utils/matte.ts` — used canonical path geometry for freeform matte output.
- `src/utils/trackMutations.ts` — widened existing property mutators to mask channels and added value/temporal-handle updates.
- `src/utils/validateScene.ts` — added V2 missing-source and cycle diagnostics while preserving legacy validation.
- `src/components/Canvas/renderers/parts/ShapePartRenderers.tsx` — rendered canonical freeform paths with legacy fallback.
- `src/components/Canvas/renderers/PartRenderer.tsx` — applied ordered V6 layer-mask references and preserved matte attributes.
- `src/components/Canvas/StagePartLayers.tsx` — built mask definitions, nested compositor operations, and V2 matte visibility behavior.
- `src/components/Inspector/DetailsPanel.tsx` — connected mask scalar keyframe actions to canonical channel mutators.
- `src/components/Inspector/InteractiveCubicBezierEditor.tsx` — embedded Value/Speed Graph controls and temporal-handle callbacks.
- `src/components/Inspector/sections/StyleTab.tsx` — passed V6 part/frame context to the style/matte inspector.
- `src/components/Inspector/sections/style/StyleMatteSection.tsx` — added Layer Mask and Track Matte V2 authoring UI.
- `src/components/Timeline/SequencerTimeline.tsx` — added mask-channel lanes, graph data selection, and safe mask scalar defaults.
- `src/components/Timeline/TrackLane.tsx` — rendered dynamic mask-channel lanes through existing timeline interactions.
- `src/context/AnimatorContext.tsx` — exposed canonical mask-channel and graph mutation actions.
- `src/hooks/useSerialization.ts` — emitted SceneData v2 and restored canonical paths, masks, mattes, and mask channels.
- `src/hooks/useTimeline.ts` — exposed widened frame/value/temporal property mutators.
- `src/ograf/evaluation.ts` — carried canonical paths and V6 relationship fields into evaluated OGraf content.
- `src/ograf/svgRenderer.ts` — preferred canonical Bezier paths with legacy point fallback.
- `src/tests/matteRender.test.tsx` — added V2 matte and source-visibility regression coverage.
- `src/tests/ografSvg.test.ts` — added canonical Bezier SVG output coverage.
- `src/tests/styleMatteSection.test.tsx` — added V6 inspector and keyframe callback coverage.
- `src/tests/useSerialization.test.ts` — updated SceneData v2 expectations and added V6 round-trip coverage.
- `src/tests/validateScene.test.ts` — added V2 source and cycle diagnostics coverage.

# 6. Architecture Overview

```text
SceneData v2 / AnimatorContext
        │
        ├── v6Migration ── bezierPath ── freeform/path geometry
        │                         └── topology-safe interpolation
        │
        ├── evaluateFrame ── evaluateLayerMasks ── interpolateChannel
        │       │                       └── maskChannels
        │       └── LayerContent (path, masks, trackMatte)
        │
        ├── StagePartLayers ── SVG defs ── PartRenderer
        │       ├── same-layer masks
        │       └── legacy + V2 matte adapter
        │
        ├── Inspector / Timeline
        │       ├── BezierPathEditor
        │       ├── StyleMatteSection
        │       ├── TrackLane mask channels
        │       └── TemporalGraphPanel
        │
        └── OGraf adapter
                ├── canonical freeform SVG path
                └── explicit deferred diagnostics for unsupported V6 compositing
```

Authored state remains owned by `AnimatorContext`. `bezierPath.ts` is the geometry authority. `defaults.ts` is the interpolation authority. `StagePartLayers` is the existing SVG compositor owner. `useSerialization` is the persistence boundary. OGraf remains an adapter and does not become a second scene authority.

# 7. Data Model Changes

## Authored/serialized state

- `BezierPath` stores version, coordinate space, closed state, stable vertex IDs, vertex coordinates, corner/smooth kind, and optional in/out handles.
- `CharacterPart` and `SceneLayer` retain legacy `points` and add optional canonical `path`, `masks`, and `trackMatte`.
- `LayerMask` stores ordered path geometry, mode, inversion, enabled state, feather, opacity, expansion, and lock state.
- `TrackMatteV2` stores source layer ID, alpha/luminance mode, inversion, enabled state, and source visibility.
- `Track.maskChannels` stores `maskId:opacity`, `maskId:feather`, and `maskId:expansion` keyframe lists.
- `SceneData.version` is now `1 | 2`; export emits version 2.

## Derived/evaluated state

- `evaluateFrame` resolves transform, trim, mask scalar channels, visibility, and renderer-ready content.
- Mask paths become SVG definitions and references; they are not persisted as derived world coordinates.
- Speed Graph values are finite differences of shared interpolation samples.

## Transient editor/UI state

- Path editor selection, dragged vertex/handle, graph mode, and modal state are transient.
- No playback engine or second timing authority was added.

# 8. Coordinate Space Model

- Path local space: ordinary freeform vertices and handles are object-local and remain centered on the part.
- Path normalized space: mask coordinates in `[0, 1]` map through the authored part width/height before world transformation.
- Parent/world space: existing `evaluateFrame` hierarchy and transform composition remain authoritative.
- SVG output space: `StagePartLayers` maps local/normalized geometry through evaluated world transform and output origin; nested mask groups preserve the target's existing transform boundary.
- OGraf space: `evaluateOGrafScene` uses the project-unit center convention and `svgRenderer` emits the canonical path inside the existing layer transform.
- Serialization space: canonical paths retain authored coordinates and coordinate-space labels; legacy points remain additive compatibility data.

Invariant: selection, canvas rendering, matte definitions, evaluation, Inspector values, timeline values, undo/redo, and serialization do not invent a second coordinate system or move the existing project origin.

# 9. Component / Module Walkthrough

- `bezierPath.ts`: sanitizes path data, constructs SVG `M/L/C/Z` output, converts legacy points, checks topology, interpolates compatible paths, and samples geometry.
- `BezierPathEditor.tsx`: edits vertices and handles via SVG pointer events; supports add/delete/reorder, corner/smooth, and open/close operations with accessible labels.
- `layerMasks.ts`: converts mask paths to world output, normalizes scalar properties, and creates deterministic IDs/filters.
- `StagePartLayers.tsx`: composes add masks and nested non-add operations; uses the existing legacy matte pipeline through an explicit V2 adapter.
- `StyleMatteSection.tsx`: owns V6 mask/matte authoring controls without duplicating geometry logic.
- `trackMutations.ts` / `useTimeline.ts`: route base and mask channels through one mutation family.
- `TemporalGraphPanel.tsx`: samples `interpolateChannel`; Value Graph points are draggable, temporal handle fields are editable, Speed Graph is derived/read-only.
- `useSerialization.ts`: exports version 2 and calls `migrateSceneLayerV6` during SceneData import.
- `ograf/evaluation.ts` / `svgRenderer.ts`: preserve canonical freeform paths in the standalone SVG adapter while leaving unsupported compositing explicit.

# 10. Important Code Changes

Topology-safe path interpolation:

```ts
if (!areBezierPathsTopologyCompatible(previous, next)) return previous;
return interpolateBezierPath(previous, next, progress);
```

Shared temporal interpolation:

```ts
const handles = previous.bezierOut || next.bezierIn
  ? solveTemporalBezier(previous.bezierOut, next.bezierIn)
  : undefined;
return applyEasing(progress, easing, handles);
```

V6 additive migration:

```ts
const path = layer.path
  ? normalizeBezierPath(layer.path, layer.path.coordinateSpace)
  : legacyFreeformPointsToPath(layer.points);
```

# 11. Public Interfaces

- `BezierPath` and related `BezierVertex`, `PathHandle`, `PathCoordinateSpace`, and `PathVertexKind` types define the canonical path contract.
- `LayerMask`, `LayerMaskStack`, `TrackMatteV2`, `AnimationChannel`, `LayerMaskChannel`, and `layerMaskChannel` define V6 compositing/timeline contracts.
- `createBezierPath`, `normalizeBezierPath`, `buildBezierPathD`, `interpolateBezierPath`, `areBezierPathsTopologyCompatible`, and legacy conversion helpers are pure utilities.
- `migrateSceneLayerV6(layer)` returns an additive normalized `SceneLayer`.
- `BezierPathEditor` accepts `path`, selection, change callback, and optional SVG authoring controls.
- `TemporalGraphPanel` accepts `keyframes`, `mode`, value-change callback, and temporal-handle callback.
- `useTimeline` and `AnimatorContext` expose existing base-channel actions plus mask-channel-compatible value, frame, easing, deletion, and temporal-handle mutations.

# 12. Algorithms and Geometry

- SVG path construction is linear in vertex count, with cubic segments emitted when handles exist.
- Path normalization filters non-finite vertices/handles and assigns deterministic IDs to missing IDs.
- Topology compatibility requires equal closed state, equal count, and identical IDs in order. Incompatible paths hold the previous path instead of guessing correspondence.
- Normalized mask points map from `[0,1]` to part dimensions, then through evaluated scale/rotation/translation.
- Add masks are combined when consecutive and compatible; subtract, intersect, difference, and inverted operations remain explicit nested SVG masks.
- Feather uses `feGaussianBlur`; expansion uses `feMorphology`; filters use user-space regions.
- Speed Graph samples shared interpolation and derives finite differences; it does not introduce a second easing formula.

# 13. Interaction / UX Behavior

Before: freeform geometry used point lists; mask/matte authoring was legacy-oriented; Motion Curves showed the cubic editor only.

After: freeform paths expose canonical vertices/handles; Style Inspector exposes Layer Masks and Track Matte V2; mask scalar keyframes appear in timeline lanes; Motion Curves exposes Value Graph and Speed Graph; temporal handles can be edited through labeled numeric controls.

Expected workflow: choose a freeform/mask path, edit vertices or tangents, choose mask/matte relationship and mode, add scalar keyframes through existing timeline actions, open Motion Curves, switch graph mode, and drag Value Graph points or edit temporal handles.

# 14. Design Decisions

- One canonical path authority: avoids divergent render, bounds, matte, and export geometry.
- Explicit topology hold: safer than an unverified correspondence heuristic.
- Nested SVG mask composition: preserves operation semantics and avoids flattening boolean intent.
- V2 matte adapter over legacy compositor: preserves existing public rendering behavior.
- Derived Speed Graph: delivers useful diagnostics without inventing an inverse speed-to-time algorithm.
- Additive SceneData migration: preserves old fields and avoids destructive rewrites.
- OGraf deferred diagnostics: unsupported V6 semantics remain in `scene.kcs` and are not silently approximated.

# 15. Invariants That Must Be Preserved

- `src/utils/bezierPath.ts` is the only canonical path geometry authority.
- `src/utils/defaults.ts` remains the shared interpolation authority.
- Incompatible path topology holds previous geometry.
- Legacy `points`, `PartMatte`, and old SceneData remain importable.
- Alpha/luminance matte semantics must not be silently converted to clip paths.
- Track matte source cycles remain recoverable diagnostics, not recursive rendering.
- Mask and matte IDs remain deterministic and relationship-based.
- Authored coordinates remain distinct from world/output coordinates.
- No `.omp` file or harness artifact participates in production behavior.
- No `.hermes/desktop-attachments/`, `test-results/`, or `playwright-report/` files were modified or staged.

# 16. Testing and Verification

- Focused V6 phase gate: `npx vitest run ...` across 13 files — PASS, 13 files / 415 tests.
- Serialization regression: `npx vitest run src/tests/useSerialization.test.ts` — PASS, 94 tests.
- OGraf and TypeScript: `npx vitest run src/tests/ografSvg.test.ts && npx tsc --noEmit` — PASS, 9 tests and TypeScript clean.
- Final focused repair gate: 5 Vitest files — PASS, 175 tests.
- Full Vitest: `npm test` — PASS, 98 files / 1,403 tests.
- TypeScript/build: `npx tsc --noEmit && npm run build` — PASS; Vite emitted production assets.
- Lint: `npm run lint` — PASS with existing Fast Refresh warning in `AnimatorContext.tsx`; no lint errors. Test selector warning was fixed.
- Focused Chromium: `npm run qa:v6` — PASS on the post-`TRACK_CHANNELS` repair run, 2 tests / 2 passed.
- Later repeated Chromium attempts — FAIL/PARTIAL because reused port 5173 served the Playwright report and `.app-container` never appeared; no source failure established.
- Manual browser on live Vite port 5174 — PASS: V6 fixture loaded; canonical cubic path, mask/matte definitions, Motion Curves, Value Graph, Speed Graph, and `speed-graph-panel` observed.
- Git validation: `git diff --check` — PASS; final checkpoint status clean after commit.

# 17. Manual QA Results

- PASS — live V6 fixture rendering on Chromium: canonical cubic path, Layer Mask definition/filter/reference, V2 alpha matte definition/reference.
- PASS — Motion Curves modal: Value Graph and Speed Graph controls rendered.
- PASS — Speed Graph: `speed-graph-panel` rendered after switching modes.
- PARTIAL — automated final rerun: port-5173 process served the report page; direct port-5174 browser verification passed the same surface.
- NOT TESTED — Lottie import/export implementation; this milestone documents the mapping boundary only.

# 18. Regression Risk Assessment

- Path geometry: MEDIUM. Canonical path is shared by several render paths; focused path, freeform, OGraf, serialization, and browser coverage passed.
- SVG mask composition: MEDIUM. Operation order and filter behavior are renderer-sensitive; focused mask/matte tests and browser fixture passed.
- Legacy serialization: LOW/MEDIUM. Additive fields and 94 serialization tests passed; old fields remain intentionally retained.
- Timeline channel unions: MEDIUM. Base and mask channels share mutators; full Vitest and TypeScript passed.
- OGraf V6 capability boundary: MEDIUM. Canonical freeform parity is implemented; advanced V6 compositing remains explicitly deferred.

# 19. Performance Considerations

- Path building and mask definition generation are linear in path/mask vertex count per evaluated render.
- Graph sampling is bounded to at most 96 samples per panel render.
- No new pointer-loop timer or animation engine was introduced.
- No caching was added without a measured invalidation contract.
- Observed representative test timings: focused 13-file gate 3.45s Vitest duration; full 98-file suite 13.67s Vitest duration; post-fix Chromium V6 suite 1.6s test duration. These are command timings, not production-frame benchmarks.

# 20. Dependencies

No dependency changes. `qa:v6` uses the existing Playwright installation. No new runtime library was added.

# 21. Compatibility

- React/TypeScript: strict TypeScript and production build passed.
- Vite/Node: Vite production build passed; Vite development port conflict affected only one reused-server E2E attempt.
- Browser: Chromium focused fixture and direct browser checks passed.
- Saved projects: legacy point lists, legacy mattes, and version 1 SceneData remain accepted; version 2 is emitted for new SceneData exports.
- OGraf: canonical freeform paths are supported; advanced V6 compositing remains diagnosed/deferred.
- Windows: commands executed in the Windows workspace and passed except the environmental port-5173 rerun.

# 22. Known Limitations

- Speed Graph is derived/read-only; editable speed controls require a future inverse mapping design.
- Mask path geometry keyframes are not yet authored as topology-animated path channels; scalar mask channels are supported.
- OGraf Export V1 does not render V6 same-layer masks or alpha/luminance Track Matte V2; the scene is preserved and diagnostics are explicit.
- Lottie mapping is documented, not implemented.
- The reused port-5173 process can serve `playwright-report/index.html`, making `npm run qa:v6` environment-sensitive when `CI` is empty.

# 23. Technical Debt

- Add selected-channel graph focus instead of first-available channel fallback.
- Add mask path keyframe authoring after the scalar channel contract is stable.
- Add Lottie round-trip fixtures before enabling interchange writes.
- Add an explicit Vite/Playwright isolated-port workflow if the project process policy permits it.
- Consider removing the Fast Refresh warning only as a separate architecture cleanup; it is unrelated to V6 behavior.

# 24. Git Summary

- Branch: `feat/v6-motion-core`
- Starting HEAD: `8024d4f` pre-V6 checkpoint
- Ending HEAD: `ef900c6 feat: deliver v6 motion core and compositing`
- Commit: `YES — ef900c6`
- Push: `NOT YET — feature branch only is the next approved release action.`
- Working tree after checkpoint: clean (`git status --short --branch` returned only the branch header).
- Main branch: not modified, merged, rebased, reset, or pushed.
- Changed file count: 52 files in the V6 checkpoint.

# 25. Updated Project Tree

```text
docs/
  V6_PLUS_ANIMATION_ROADMAP.md [new]
  adr/ [new]
  interop/V6_LOTTIE_MAPPING.md [new]
  research/V6_MOTION_COMPOSITING_RESEARCH.md [new]
e2e/
  fixtures/v6-motion-core.scene.json [new]
  v6-motion-core.spec.ts [new]
package.json [modified]
reports/
  progress_025.md [new]
skills/keyframe-studio/kcs-track-matte/SKILL.md [modified]
src/
  components/Canvas/{StagePartLayers,renderers/PartRenderer,renderers/parts/ShapePartRenderers}.tsx [modified]
  components/Inspector/{BezierPathEditor,TemporalGraphPanel}.tsx [new]
  components/Inspector/{DetailsPanel,InteractiveCubicBezierEditor}.tsx [modified]
  components/Inspector/sections/{StyleTab,style/StyleMatteSection}.tsx [modified]
  components/Timeline/{SequencerTimeline,TrackLane}.tsx [modified]
  context/AnimatorContext.tsx [modified]
  hooks/{useSerialization,useTimeline}.ts [modified]
  ograf/{evaluation,svgRenderer}.ts [modified]
  tests/{BezierPathEditor,TemporalGraphPanel,bezierPath,interpolationV6,layerMaskAnimation,layerMasks,v6Migration}.test.* [new]
  tests/{matteRender,ografSvg,styleMatteSection,useSerialization,validateScene}.test.* [modified]
  types/{animator,composition}.ts [modified]
  utils/{bezierPath,evaluateLayerMasks,layerMasks,v6Migration}.ts [new]
  utils/{bounds,defaults,evaluateFrame,freeform,matte,shapeOutlineHelper,trackMutations,validateScene}.ts* [modified]
```

# 26. Self Review

What is good: V6 has explicit authorities, additive migration, focused regression coverage, deterministic fixture data, and a documented interoperability boundary. The runtime error found by Chromium was fixed rather than hidden.

What could improve: the automated E2E command still depends on a reused port-5173 process; OGraf advanced compositing and Lottie interchange remain future work; graph selection fallback is intentionally basic.

Uncertainty: production performance at very large path/mask counts was not benchmarked; only command-level representative timings were observed.

Score: 8/10. The core milestone is coherent and verified, but the deferred interchange/compositor work and environment-sensitive E2E port remain material limitations.

# 27. Next Recommended Task

Push `feat/v6-motion-core` to the approved remote without merging it into `main`.

# 28. Project Status

Current milestone: V6 Motion Core and Compositing implementation checkpoint complete on `feat/v6-motion-core`.

Completed: path core, Layer Masks, Track Matte V2, interpolation/graphs, serialization migration, OGraf audit, fixtures, focused tests, browser proof, build/lint, documentation, and checkpoint commit.

Remaining release action: push the feature branch only, then report the final milestone status.

QA stage: implementation and validation complete; release handoff pending feature-branch push.

# 29. AI Development Notes

- `AnimatorContext` owns authored state and action wiring; do not add parallel state authorities.
- `bezierPath.ts` owns path normalization, SVG output, conversion, topology comparison, and interpolation.
- `defaults.ts` owns interpolation; graph panels must keep using it.
- `StagePartLayers` owns SVG compositor ordering and legacy matte adaptation.
- `useSerialization` must keep SceneData migration additive and preserve legacy fields.
- Normalized masks map through part dimensions before world transforms; do not persist derived world geometry.
- OGraf is an adapter; unsupported V6 semantics must stay visible in `scene.kcs` and diagnostics.
- Reproduce browser rendering with `e2e/fixtures/v6-motion-core.scene.json` and `npm run qa:v6`; if port 5173 serves the report, inspect the running Vite process before treating the result as a source regression.

## DO NOT CHANGE CASUALLY

- Do not create a second path, evaluation, playback, graph, or serialization authority.
- Do not guess path vertex correspondence when IDs/topology differ.
- Do not convert alpha/luminance Track Matte V2 into clip-path semantics.
- Do not remove legacy `points`, `PartMatte`, or SceneData v1 import handling.
- Do not move mask normalized coordinates into serialized world coordinates.
- Do not bypass `validateScene` cycle detection or OGraf deferred diagnostics.
- Do not modify `.hermes/desktop-attachments/`, `test-results/`, or `playwright-report/` artifacts.
- Do not merge or push `main`; release push target is the feature branch only.

# 30. Lessons Learned

- Browser coverage exposed a missing runtime import that static focused unit tests did not exercise; every new UI branch needs a real interaction path.
- Additive migration is safer when legacy fields remain visible in the serialized object and canonical fields are normalized only at the import boundary.
- A shared evaluator makes Value Graph and playback semantics consistent, but derived Speed Graph must remain clearly scoped until inverse mathematics are specified.
- Port ownership is part of browser-test reliability; reused development servers need explicit inspection when the rendered document is unexpectedly a report page.
