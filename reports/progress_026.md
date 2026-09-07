# KCS Development Report — V6.0 Completion Gate

Metadata:
- Date: 2026-09-07
- Milestone: V6.0 Completion Gate — mask-path authoring and OGraf compositor parity
- Branch: `feat/v6-motion-core`
- Starting HEAD: `2b3229b5ed63c2b0f1b9fdb058a2b6678b1b94be`
- Ending HEAD: `2b3229b5ed63c2b0f1b9fdb058a2b6678b1b94be` (working-tree changes are uncommitted)
- Commit status: `Commit: NO — prohibited by task scope.`
- Push status: `Push: NO — prohibited by task scope.`
- Report number: `progress_026`

# 1. Executive Summary

This milestone closes the V6.0 completion-gate implementation for animated same-layer mask geometry and OGraf compositor parity. Mask paths now have canonical path keyframes with stable vertex topology, tangent handles, timeline authoring, Inspector authoring, frame evaluation, undo-compatible mutators, and serialization. OGraf now renders the same mask modes (`add`, `subtract`, `intersect`, `difference`, including inverted masks), feather/expansion, V2 alpha/luminance Track Mattes, inversion, source visibility, transforms, and animated path/scalar values in both canonical SVG and generated runtime output.

The V6-specific gate is `READY`: 1408 Vitest tests pass, TypeScript passes, production build passes, and the isolated V6 Chromium suite passes 3/3. The repository-wide Playwright suite still reports 16 failures and one flaky result in legacy/stale UI contracts outside the V6 gate; those failures are recorded in Sections 16, 17, and 22 rather than hidden.

# 2. Original Objectives

In scope:
- Author, move, edit, delete, evaluate, and serialize animated mask paths.
- Preserve stable path topology and tangent handles during interpolation.
- Expose mask-path controls through the existing Inspector, Timeline, and AnimatorContext authorities.
- Render V6 same-layer masks and Track Matte V2 modes in canonical OGraf SVG.
- Keep generated OGraf runtime behavior aligned with canonical evaluation.
- Expand the V6 fixture and deterministic Chromium acceptance command.
- Add focused domain, serialization, SVG, generated-runtime, and browser coverage.
- Produce the required permanent development report.

Out of scope:
- Speed Graph authoring; it remains the existing derived/read-only graph mode and is not a new V6 authoring contract.
- Rewriting unrelated legacy Playwright specifications.
- Git history changes, commits, pushes, branch changes, or changes to `.hermes/desktop-attachments/`.

# 3. Problems Discovered

1. Mask path geometry had no authoring channel. Symptom: scalar mask properties could be keyed but mask geometry remained static. Root cause: `AnimationTrackData` had no path channel and evaluation read only static `LayerMask.path`. Status: fixed.
2. Editor mask definitions were consuming an undeclared `definition` variable in the same-layer mask loop. Symptom: projects containing masks rendered a blank React root at runtime. Root cause: the loop did not call `buildLayerMaskDefinition`. Status: fixed and reproduced through a real browser fixture load.
3. OGraf SVG emitted multiple `mask` attributes on one `<g>`. Symptom: only the last SVG mask attribute is reliably effective in a browser. Root cause: independent mask URLs were concatenated as attributes instead of nested groups. Status: fixed by nested mask wrappers.
4. OGraf validation rejected alpha/luminance V2 mattes before rendering. Symptom: supported V6 compositor input was reported as unsupported. Root cause: validation encoded the previous V1 capability boundary. Status: fixed; missing/self/cyclic relationships remain errors.
5. `qa:v6` could reuse an unrelated process on the default Vite port. Symptom: Chromium could inspect a report or another service instead of KCS. Root cause: default port reuse. Status: fixed with a Windows-compatible launcher and dedicated port 5187.
6. The full legacy Playwright suite contains 16 failures and one flaky result. Representative failures are stale M22 matte-source selectors, M23–M25 preset Inspector selectors, M29 scale-lock selectors, named-sequence metadata, workflow transition selectors, and layer-index expectations. Status: not part of this V6 gate; preserved as a known repository-level QA limitation.

# 4. Files Created

- `scripts/run-v6-qa.mjs`: Windows-compatible Playwright launcher that sets `KCS_V6_QA=1` and invokes the V6 spec without shell-specific environment syntax.
- `src/tests/maskPathAnimation.test.ts`: canonical path interpolation and path-keyframe mutation coverage.
- `src/tests/ografV6Parity.test.ts`: canonical/generated OGraf V6 compositor and animated path parity coverage.
- `reports/progress_026.md`: this permanent milestone report.

# 5. Files Modified

- `src/types/animator.ts`: added `PathKeyframe`, `LayerMaskPathChannel`, path-channel factory, and `maskPathChannels`; this is the serialized/authored contract used by timeline and OGraf consumers. Risk: channel-key format must remain `<maskId>:path`.
- `src/utils/defaults.ts`: added path-channel interpolation using existing easing and canonical Bezier interpolation. Risk: incompatible topology intentionally holds the previous path.
- `src/utils/evaluateLayerMasks.ts`: evaluates path channels alongside opacity, feather, expansion, and offsets. Impact: all renderers receive frame-evaluated mask geometry.
- `src/utils/trackMutations.ts`: added path add/update/move/delete mutators and selected-keyframe deletion handling. Impact: existing history/state authorities remain in control.
- `src/hooks/useTimeline.ts`: exposed path authoring actions and static-versus-keyed authoring behavior. Risk: when keyed data exists, Inspector edits author the current frame rather than rewriting static geometry.
- `src/context/AnimatorContext.tsx`: exposed path actions and restored existing toolbar/clipboard/provider entries required by integration tests. Impact: public context remains complete.
- `src/components/Inspector/sections/style/StyleMatteSection.tsx`: added Mask Path keyframe control and frame-aware Bezier editor callback. Impact: user-facing labels remain English.
- `src/components/Inspector/sections/StyleTab.tsx`: passed path authoring callbacks to the style section.
- `src/components/Inspector/DetailsPanel.tsx`: evaluates displayed masks for the current frame, routes path edits to the timeline authority, preserves base path geometry during scalar edits, and wires existing copy/paste callbacks.
- `src/components/Timeline/TrackLane.tsx`: renders path-channel lanes as geometry keyframes and routes deletion through path mutators.
- `src/components/Timeline/SequencerTimeline.tsx`: routes path-keyframe frame drags and deletes through typed path actions.
- `src/utils/timelineMetrics.ts`: includes scalar and path mask channels in maximum-frame calculation.
- `src/hooks/useSerialization.ts`: exports and imports normalized mask path channels and preserves legacy transform/editor defaults.
- `src/components/Canvas/StagePartLayers.tsx`: renders evaluated mask paths and fixes same-layer mask definition construction.
- `src/ograf/svgRenderer.ts`: adds canonical same-layer mask definitions, nested mask application, alpha/luminance Track Matte V2, inversion, source visibility, feather, expansion, and transform handling.
- `src/ograf/runtimeTemplate.ts`: mirrors V6 evaluation/compositor behavior in generated standalone OGraf runtime output.
- `src/ograf/validation.ts`: accepts SceneData V1/V2 supported matte modes and diagnoses invalid Track Matte relationships deterministically.
- `src/ograf/types.ts`: adds `OGRAF_INVALID_TRACK_MATTE` diagnostic code.
- `src/tests/ografExport.test.ts`: updates matte validation expectations to the V6 supported-mode contract.
- `src/tests/useSerialization.test.ts`: covers V6 paths, tangent handles, masks, Track Matte V2, scalar channels, and path channels through export.
- `e2e/fixtures/v6-motion-core.scene.json`: expands the acceptance fixture to all same-layer mask modes plus alpha/luminance V2 mattes and animated path/scalar channels.
- `e2e/v6-motion-core.spec.ts`: asserts browser DOM definitions, nested mask/matte application, cubic geometry, and fixture persistence.
- `playwright.config.ts`: adds deterministic isolated QA ports; V6 uses 5187 and CI/full E2E uses 5188 instead of reusing an unrelated 5173 service.
- `package.json`: points `qa:v6` to the Windows-compatible launcher.

# 6. Architecture Overview

```text
Inspector BezierPathEditor
        |
        v
useTimeline -> trackMutations -> Track.maskPathChannels
        |                                  |
        v                                  v
DetailsPanel displayed evaluation     useSerialization
        |                                  |
        v                                  v
StagePartLayers -> evaluateFrame -> evaluateLayerMasks
        |                                  |
        +--------------------------+-------+
                                   v
                         canonical SVG / generated OGraf
```

The canonical path utility remains the geometry authority. Timeline mutators remain the state mutation authority. `evaluateLayerMasks` remains the frame-evaluation authority. Editor SVG and OGraf consume evaluated state rather than implementing independent authoring state.

# 7. Data Model Changes

Authored/serialized state:
- `PathKeyframe` stores stable keyframe id, frame, `BezierPath` value, easing metadata, optional temporal handles, and optional template id.
- `AnimationTrackData.maskPathChannels` stores `Record<`${string}:path`, PathKeyframe[]>` on the existing canonical track.
- The path value preserves vertex ids, order, closed state, coordinate space, and optional tangent handles.
- SceneData V2 Track Matte relationships remain on layers as `sourceLayerId`, `mode`, `inverted`, `enabled`, and `sourceVisible`.

Derived/evaluated state:
- `evaluateLayerMasks` resolves the path and scalar channels at the requested frame.
- `StagePartLayers` uses evaluated masks for editor rendering.
- OGraf evaluates the same frame state before producing SVG or generated-runtime output.

Transient editor/UI state:
- Selected keyframe ids, expanded timeline groups, current frame, and Inspector display state remain transient and are not serialized as mask path geometry.

Migration:
- Imported path keyframes are normalized to normalized coordinate space by the serialization boundary.
- Missing legacy track editor fields retain safe defaults.
- V1 SceneData and legacy `matte` data remain importable.

# 8. Coordinate Space Model

- Object-local path space: freeform and mask path points are authored relative to their object. Normalized mask paths use `[0,1]` coordinates and are mapped through the target part width/height.
- Parent-local space: hierarchy evaluation resolves parent transforms before render consumers use the world transform.
- World/canvas space: `buildLayerMaskPathD` maps normalized points to local dimensions, then applies evaluated translation, rotation, and scale around the shared editor/OGraf output origin.
- Viewport/screen space: pointer and Inspector values remain UI concerns and are not persisted as SVG coordinates.

The invariant is that the same evaluated world transform and normalized-to-local conversion feed editor SVG, canonical OGraf SVG, and generated OGraf runtime. Undo/redo mutates authored channel state only. Serialization stores authored normalized geometry, not viewport coordinates. Mask path interpolation occurs before world transformation.

# 9. Component / Module Walkthrough

- `StyleMatteSection`: presents the existing mask scalar controls and the new Mask Path keyframe button/editor.
- `DetailsPanel`: derives current-frame mask display values and protects authored base paths from scalar display writes.
- `TrackLane` / `SequencerTimeline`: expose path geometry keyframes as a typed timeline channel; dragging changes frame only, deletion removes only the selected path keyframe.
- `useTimeline` / `trackMutations`: provide all path authoring operations through the established history/state pipeline.
- `AnimatorContext`: publishes actions to existing consumers without adding a parallel state authority.
- `StagePartLayers`: consumes `EvaluatedFrame` masks and builds deterministic editor definitions.
- `svgRenderer`: produces nested, browser-valid mask groups and Track Matte definitions.
- `runtimeTemplate`: emits standalone runtime code with matching interpolation and compositor semantics.
- `useSerialization`: preserves path keyframes and normalizes imported path values.

# 10. Important Code Changes

Path authoring uses the canonical channel convention:

```ts
export type LayerMaskPathChannel = `${string}:path`;
export const layerMaskPathChannel = (maskId: string): LayerMaskPathChannel => `${maskId}:path`;
```

Path interpolation delegates to existing easing and topology rules:

```ts
return interpolateBezierPath(previous.value, next.value, eased) ?? previous.value;
```

Multiple SVG masks are now nested rather than emitted as duplicate attributes:

```ts
const maskedBody = allMaskIds.reduceRight(
  (content, id) => `<g mask="url(#${escapeXml(id)})">${content}</g>`,
  transformedBody,
);
```

# 11. Public Interfaces

New/changed exported interfaces and functions:
- `PathKeyframe`: authored path keyframe data contract.
- `LayerMaskPathChannel`: typed mask geometry channel id.
- `layerMaskPathChannel(maskId)`: deterministic path channel factory.
- `AnimationTrackData.maskPathChannels`: optional serialized channel map.
- `interpolatePathChannel(keyframes, frame, fallback)`: deterministic eased path evaluation.
- `addMaskPathKeyframeMutator`, `updateMaskPathKeyframeValueMutator`, `updateMaskPathKeyframeFrameMutator`, `deleteMaskPathKeyframeMutator`: pure track mutations.
- `useTimeline` path actions: add, update value, update frame, delete, and author current-frame mask path.
- `AnimatorContextType` path actions: context consumers use the same timeline authority.

Existing public APIs remain source-compatible; path fields are optional for legacy projects.

# 12. Algorithms and Geometry

Path evaluation:
1. Select the mask channel using the mask id.
2. Sort/select surrounding keyframes through the canonical interpolation helper.
3. Apply the existing easing contract.
4. Interpolate matching vertex ids, positions, and tangent handles.
5. If topology differs, return the previous compatible path rather than inventing correspondence.
6. Convert normalized path geometry to world-space SVG only after frame evaluation.

Mask composition:
- Consecutive non-inverted additive masks are combined into one definition.
- Subtract/difference masks use even-odd outer-region construction where needed.
- Intersect and inverted variants use deterministic mask structure and filters.
- Feather uses a deterministic morphology/blur filter; expansion uses dilation/erosion.
- Track Matte V2 uses source geometry in source world space, with alpha/luminance and inversion semantics, then hides the source when `sourceVisible` is false.

The per-layer work is linear in the number of masks and path points, excluding browser SVG rasterization.

# 13. Interaction / UX Behavior

Before: mask scalar properties could be keyed, but mask geometry edits changed only static `LayerMask.path`; the timeline had no geometry lane.

After: selecting a layer and opening `MASK / TRACK MATTE` exposes `MASK PATH`, an `Add Mask Path keyframe` action, and the existing Bezier editor. If the mask has path keys, edits author the current frame on the canonical path channel. The Timeline shows geometry keyframes, supports frame dragging, and deletes only the selected geometry keyframe.

Expected workflow:
1. Select a layer with a mask.
2. Open the style/mask section.
3. Add a Mask Path keyframe at frame A.
4. Move the playhead, edit vertices or tangent handles, and add/update frame B.
5. Scrub between frames; evaluated geometry interpolates when topology is compatible.
6. Use undo/redo through the existing history boundary.
7. Export/import; path ids, vertex ids, handles, and matte relationships remain present.

# 14. Design Decisions

1. Decision: store mask geometry on the existing canonical track using `<maskId>:path`.
   - Reason: avoids a parallel animation engine and preserves existing track ownership.
   - Alternative: separate mask animation objects; rejected because it duplicates timeline/evaluation authorities.
   - Trade-off: callers must distinguish scalar mask channels from path channels.
   - Future implication: future mask properties should extend the same channel family.

2. Decision: hold the previous path on incompatible topology.
   - Reason: stable vertex correspondence is required for deterministic geometry.
   - Alternative: index-based interpolation; rejected because ids/order/closed state can produce invalid shapes.
   - Trade-off: an author must preserve topology for smooth interpolation.
   - Future implication: explicit topology-conversion tooling would be a separate milestone.

3. Decision: nest SVG mask groups.
   - Reason: duplicate attributes are invalid/ambiguous browser behavior.
   - Alternative: merge all modes into one complex definition; rejected because it obscures per-mask semantics.
   - Trade-off: additional SVG group nodes.
   - Future implication: generated and canonical renderers must retain equivalent nesting order.

# 15. Invariants That Must Be Preserved

- `BezierPath` is the sole canonical path geometry authority.
- Path vertex ids, order, closed state, and coordinate space are topology invariants.
- `<maskId>:path` is the persistent channel key format.
- Evaluation is frame-based and must not mutate authored state.
- Inspector edits must not write current-frame derived paths into static base state when a path channel exists.
- Editor SVG and OGraf must use the same normalized-to-world transform rules.
- Alpha/luminance Track Matte source relationships must be deterministic and cycle-safe.
- Legacy V1 data remains importable.
- Undo/redo must remain on existing batch/history boundaries.
- `.omp` harness files and desktop attachments are never production data dependencies.

# 16. Testing and Verification

TypeScript:
- `npx tsc --noEmit` — PASS.
- `npm run build` — PASS; Vite emitted the existing chunk-size warning for the main bundle.

Vitest/unit:
- `npx vitest run src/tests/maskPathAnimation.test.ts` — PASS, 3 tests.
- `npx vitest run src/tests/ografV6Parity.test.ts src/tests/ografExport.test.ts` — PASS, 17 tests.
- `npx vitest run src/tests/useSerialization.test.ts` — PASS, 94 tests.
- `npx vitest run src/tests/ografV6Parity.test.ts src/tests/ografSvg.test.ts src/tests/ografGeneratedParity.test.ts` — PASS, 14 tests.
- `npx vitest run src/tests/layerMasks.test.ts src/tests/maskPathAnimation.test.ts` — PASS, 6 tests.
- `npm test` — PASS, 100 files and 1408 tests.

Lint:
- `npm run lint` — PASS with one existing React Fast Refresh warning at `src/context/AnimatorContext.tsx:654`; no V6 lint warnings remain.

Focused browser QA:
- `npm run qa:v6` — PASS, 3/3 Chromium tests.
- The command uses a dedicated 5187 server and does not reuse unrelated port content.
- V6 browser assertions covered all same-layer mask definitions, nested mask use, cubic geometry, alpha/luminance Track Matte definitions, source visibility, path-channel persistence, and both graph modes.

Full browser regression:
- `npm run test:e2e` — FAIL/PARTIAL: 252 tests executed, 235 passed, 16 failed, 1 flaky.
- Failures are concentrated in existing/stale legacy UI contracts (M22, M23, M24, M25, M29, named-sequence, real-user-verification, workflow, and layer-index specs), not in `e2e/v6-motion-core.spec.ts`.
- The full run used the isolated 5188 port under `CI=true`; it did not inspect the unrelated service on 5173.

Git validation:
- `git diff --check` — PASS; Git reported only expected LF/CRLF normalization warnings.
- `git status --short --branch` — branch is `feat/v6-motion-core`; only listed milestone files are modified/untracked; no attachment files were touched.

# 17. Manual QA Results

PASS — real browser surface at the local Vite server was inspected. Loading the expanded V6 fixture produced the KCS app, four same-layer mask definition ids, and two Track Matte source mask ids. The fixture persisted path-channel data and V2 matte fields through the browser localStorage boundary.

PASS — V6 Chromium suite verified the intended DOM surface end to end.

PARTIAL — repository-wide legacy Playwright suite remains red as recorded in Section 16. No V6-specific test failed.

# 18. Regression Risk Assessment

- V6 path evaluation: MEDIUM. New optional track data is isolated, but topology and coordinate-space invariants are load-bearing.
- Editor mask rendering: MEDIUM. The previous undeclared-definition bug was fixed and the V6 browser suite now exercises mask DOM output.
- OGraf compositor: MEDIUM. Canonical and generated parity tests cover the implemented V6 modes; browser pixel-level raster comparisons are not part of this suite.
- Legacy UI E2E suite: HIGH for repository QA confidence, because 16 stale failures remain outside this milestone.
- Serialization compatibility: LOW/MEDIUM. Path fields are optional and V1 import remains covered; malformed external data still requires defensive handling at import boundaries.

# 19. Performance Considerations

- Path interpolation is performed only for masks with path channels and only for the evaluated frame.
- Editor layer mask definitions are rebuilt from evaluated state each render; this is consistent with existing frame evaluation and prevents stale animated geometry.
- OGraf definitions are deterministic and per-layer; repeated target/source relationships can produce repeated target-specific definitions by design.
- Timeline path lanes add one DOM diamond per path keyframe; no new animation loop was introduced.
- No benchmark was added; no performance regression claim beyond architectural review is made.

# 20. Dependencies

No dependency changes. The implementation uses existing React, TypeScript, Vite, Vitest, Playwright, SVG, and project utilities.

# 21. Compatibility

- React 19 and strict TypeScript compile successfully.
- Vite production build succeeds.
- Chromium V6 acceptance succeeds on Windows using the dedicated port launcher.
- SceneData V1 and V2 remain accepted by OGraf validation.
- Legacy scalar channels and legacy keyframes remain importable.
- Saved projects without `maskPathChannels` continue to use static mask paths.
- New path channels serialize as optional data; old consumers that ignore the field retain static behavior.
- `Track Matte V2` alpha/luminance modes are now accepted and rendered; invalid source, self-reference, and cycles remain rejected.
- Lint still reports the pre-existing Fast Refresh warning in `AnimatorContext`.

# 22. Known Limitations

- Full repository Playwright is not green: 16 failures and one flaky result remain in legacy/stale UI specifications.
- Speed Graph remains derived/read-only; no independent authoring contract was introduced.
- Generated-runtime tests sample a controlled internal frame for parity; no browser pixel-diff suite was added.
- Incompatible path topology holds the previous path rather than interpolating or converting vertices.
- The existing main JavaScript bundle remains above Vite's advisory 500 kB warning threshold.

# 23. Technical Debt

- Migrate or retire stale legacy Playwright selectors and workflows that no longer match current Inspector/outliner UI contracts.
- Add a dedicated generated-runtime frame-setting test API or a stable test-only frame sampler if future parity coverage requires arbitrary public frame control.
- Consider explicit topology conversion tooling only if product requirements need interpolation across differing path structures.
- Resolve the existing Fast Refresh warning by separating non-component exports only in a separately approved cleanup milestone.

# 24. Git Summary

- Branch: `feat/v6-motion-core`
- Starting/ending HEAD: `2b3229b5ed63c2b0f1b9fdb058a2b6678b1b94be`
- `origin/main`: `8024d4f29e17623bdc0efda31e9e4332b92460b1`
- Feature branch was already published at the starting HEAD; this task did not push.
- Working tree: intentional uncommitted V6 source, test, configuration, fixture, and report changes only.
- `Commit: NO — prohibited by task scope.`
- `Push: NO — prohibited by task scope.`

# 25. Updated Project Tree

```text
reports/
  progress_026.md                                      [new]
scripts/
  run-v6-qa.mjs                                        [new]
e2e/
  fixtures/v6-motion-core.scene.json                   [changed]
  v6-motion-core.spec.ts                                [changed]
playwright.config.ts                                   [changed]
package.json                                            [changed]
src/
  components/Canvas/StagePartLayers.tsx                [changed]
  components/Inspector/DetailsPanel.tsx               [changed]
  components/Inspector/sections/StyleTab.tsx          [changed]
  components/Inspector/sections/style/StyleMatteSection.tsx [changed]
  components/Timeline/SequencerTimeline.tsx            [changed]
  components/Timeline/TrackLane.tsx                    [changed]
  context/AnimatorContext.tsx                           [changed]
  hooks/useSerialization.ts                             [changed]
  hooks/useTimeline.ts                                  [changed]
  ograf/runtimeTemplate.ts                              [changed]
  ograf/svgRenderer.ts                                  [changed]
  ograf/types.ts                                        [changed]
  ograf/validation.ts                                   [changed]
  tests/maskPathAnimation.test.ts                       [new]
  tests/ografV6Parity.test.ts                           [new]
  tests/ografExport.test.ts                             [changed]
  tests/useSerialization.test.ts                        [changed]
  types/animator.ts                                     [changed]
  utils/defaults.ts                                     [changed]
  utils/evaluateLayerMasks.ts                           [changed]
  utils/timelineMetrics.ts                              [changed]
  utils/trackMutations.ts                               [changed]
```

# 26. Self Review

What is good: the implementation extends existing canonical authorities instead of adding a second animation or compositor state engine; path topology is deterministic; the editor and OGraf paths are exercised by both unit and browser tests; the V6 QA port is isolated and reproducible.

What could improve: generated-runtime parity would be stronger with a stable arbitrary-frame test hook, and the repository-wide legacy browser suite should be repaired in a separate scope.

Uncertainty: browser assertions verify DOM semantics and deterministic generated output, not full raster pixel equality for every compositor mode.

Score: 8/10. The V6 gate is implemented and verified, but the broader Playwright baseline remains noisy and pixel-level generated-runtime coverage is not complete.

# 27. Next Recommended Task

Repair and rebaseline the 16 failing legacy Playwright UI contracts without changing V6 compositor behavior.

# 28. Project Status

- Current milestone: V6.0 mask-path authoring and OGraf compositor completion gate.
- Completed: canonical path channels, Inspector/Timeline authoring, evaluated editor rendering, serialization, all requested OGraf mask/matte modes, generated runtime parity, deterministic V6 fixture and QA launcher.
- Remaining milestone work: none within the V6-specific approved scope.
- QA stage: V6-specific gate READY; repository-wide legacy browser regression PARTIAL due recorded unrelated/stale failures.

# 29. AI Development Notes

- The canonical path implementation is in `src/utils/bezierPath.ts`; do not introduce another path representation.
- `maskPathChannels` keys are mask ids plus `:path`, not layer id plus mask id.
- `evaluateLayerMasks` is the only frame resolver for mask geometry and scalar values.
- `StagePartLayers` must consume evaluated masks; using static `part.masks` breaks animated editor rendering.
- OGraf SVG must nest multiple mask URLs as groups; duplicate `mask` attributes are not safe browser semantics.
- Track Matte V2 source visibility is evaluated at the target relationship boundary; source geometry still needs to be available to the target definition.
- `scripts/run-v6-qa.mjs` exists because Windows shell environment syntax and default-port reuse were not deterministic enough for this gate.
- The full E2E suite currently includes older UI expectations; do not weaken V6 assertions to make those unrelated tests pass.

## DO NOT CHANGE CASUALLY

- Path topology hold behavior on incompatible vertex ids/order/closed state.
- `<maskId>:path` serialized channel format.
- Normalized mask path to object-local/world transform mapping.
- Nested SVG mask application order.
- Alpha/luminance/inverted Track Matte V2 semantics and source visibility.
- Existing V1 import and legacy matte fallback behavior.
- Existing undo/redo batch/history authority.
- Dedicated V6 QA port and launcher behavior.

# 30. Lessons Learned

- Runtime blank screens can originate from render-definition construction errors that strict checks do not expose when an undeclared symbol is supplied by ambient types; direct fixture loading in a real browser is necessary.
- SVG mask semantics require structural nesting, not repeated attributes, even when serialized markup appears superficially correct.
- Persistent geometry channels must use the same track authority as scalar channels to keep evaluation, timeline, history, and serialization coherent.
- Dedicated test ports are necessary when another local process can return valid HTTP while serving the wrong application.
- Full regression output must distinguish V6-specific evidence from stale legacy UI failures instead of collapsing all failures into a single unsupported completion claim.
