# KCS V6 Pre-Merge Review

## Executive Summary

**Verdict: NOT READY TO MERGE.** The branch is clean and the reported baseline suites are green, but the V6 delta contains merge-blocking regressions across canonical sequence evaluation, mask compositing, OGraf export parity, timeline editing, serialization, and accessibility. The largest architectural risk is duplicated behavior: the editor, static OGraf renderer, and standalone generated runtime do not share one executable compositing/easing implementation and already disagree on supported semantics.

The review was read-only. No source files, tests, configuration, or Git state were changed. The requested report is the only new file.

Reported baseline evidence from the completed QA pass: Playwright 252/252, V6 QA 3/3, Vitest 1409/1409, TypeScript clean, ESLint clean with warning, and production build successful. A focused `useSerialization` run was also 94/94. These results establish regression-suite health, not V6 semantic correctness; the added tests leave several incorrect outputs observable only by structural assertions.

## Review Scope

- Branch: `feat/v6-motion-core`
- Reviewed commit: `4d21ace0a85fdbeecbe20290deca8991405a3b3`
- Comparison: `main...feat/v6-motion-core`
- Delta: 77 files, approximately +5287/-633 lines
- Areas: Bezier authority, interpolation, mask channels, Track Matte V2, OGraf static export, generated runtime, serialization, sequence lifecycle, undo/redo, timeline/editor UX, accessibility, testing, performance, documentation, and Git delivery state
- Review mode: read-only; no implementation changes authorized or performed

## Recovered Previous Reviewer Evidence

- **Previous interrupted review evidence recovered: YES.**
- The initial 16-agent review fan-out was interrupted by usage limits before producing a complete aggregate result.
- Usable partial evidence was recovered from the interrupted Bezier and history/undo reviewers.
- A reduced five-reviewer fan-out was then completed for documentation/Git, compositing/export, editor/UX, testing, and cleanup/performance.
- No reviewer was permitted to edit files, run formatters, commit, push, or alter Git state.

## Architecture Findings

### A1. Canonical mask sequence selection is missing in the evaluator

- **Severity:** HIGH
- **File/module:** `src/utils/evaluateLayerMasks.ts:5-40`; `src/utils/evaluateFrame.ts`
- **Evidence:** `evaluateLayerMasks` resolves `maskChannels` and `maskPathChannels` without receiving or filtering by the active sequence/template ID. Transform and trim-path evaluation receive an explicit sequence ID, but mask evaluation does not.
- **Impact:** Keyframes from another named sequence can affect the currently active mask, while valid active-sequence mask keyframes can be ignored or combined with unrelated sequence data.
- **Merge blocker:** YES
- **Recommended action:** Pass the active sequence ID through `evaluateFrame` into `evaluateLayerMasks`; apply the same `(templateId || 'Sequence') === sequenceId` authority used by transform and trim-path evaluation.
- **Disposition:** BEFORE MERGE

### A2. Standalone runtime hardcodes the `Sequence` template

- **Severity:** HIGH
- **File/module:** `src/ograf/runtimeTemplate.ts:49-50,68-70`; `src/types/composition.ts:46-48`
- **Evidence:** Generated `channelValue` and `pathChannelValue` filter every keyframe to the literal `Sequence`, while `SceneData` serializes an `activeTemplateId` field. The generated runtime has no equivalent active-template selection path.
- **Impact:** Exported scenes with named sequences can render base/legacy `Sequence` animation rather than the selected canonical sequence. Editor preview and materialized runtime can diverge even when both consume the same SceneData.
- **Merge blocker:** YES
- **Recommended action:** Define the standalone runtime’s sequence contract explicitly, pass the serialized active template into generated evaluation, and parity-test named-sequence transform, mask scalar, mask path, and trim-path channels.
- **Disposition:** BEFORE MERGE

### A3. Bezier topology compatibility ignores coordinate space

- **Severity:** HIGH
- **File/module:** `src/utils/bezierPath.ts:148-157`
- **Evidence:** `areBezierPathsTopologyCompatible` checks closure, point count, and point IDs but does not compare `coordinateSpace`. `interpolateBezierPath` then directly interpolates coordinates and retains the previous coordinate space.
- **Impact:** A local path and a normalized path with identical IDs can be interpolated as if their coordinates share units, producing malformed or displaced mask geometry.
- **Merge blocker:** YES
- **Recommended action:** Include `coordinateSpace` in the compatibility contract, or normalize both endpoints through one explicit canonical conversion before interpolation.
- **Disposition:** BEFORE MERGE

### A4. Bezier interpolation invents handles at a straight endpoint

- **Severity:** MEDIUM
- **File/module:** `src/utils/bezierPath.ts:167-184`; equivalent generated logic in `src/ograf/runtimeTemplate.ts:64-66`
- **Evidence:** When one endpoint lacks a handle, `interpolateHandle` substitutes the other endpoint’s handle for both sides. At `t = 0` or `t = 1`, the result can therefore contain a handle that did not exist at that endpoint.
- **Impact:** A segment can become curved when one authored keyframe is straight, and editor/runtime path shapes can diverge at interpolation boundaries.
- **Merge blocker:** YES
- **Recommended action:** Interpolate a missing handle against its owning anchor point, or preserve absence until a documented interpolation threshold; add endpoint and midpoint tests for one-sided handles.
- **Disposition:** BEFORE MERGE

## Compositing and OGraf Findings

### C1. Disabled Track Matte V2 relationships are still applied by OGraf

- **Severity:** HIGH
- **File/module:** `src/ograf/svgRenderer.ts:200-208`; `src/ograf/runtimeTemplate.ts:114`
- **Evidence:** The editor’s effective-matte path requires `trackMatte.enabled !== false`, while `getMatteRelationship` and generated `matteRelationship` return any `trackMatte` object without checking `enabled`.
- **Impact:** A saved `enabled: false` matte remains active in static OGraf output and generated runtime. `sourceVisible: false` can also hide the source unexpectedly.
- **Merge blocker:** YES
- **Recommended action:** Match the editor’s disabled-V2 and legacy fallback rules in both OGraf consumers; add static and generated-runtime disabled-matte regression coverage.
- **Disposition:** BEFORE MERGE

### C2. Inverted alpha mattes do not produce an alpha hole

- **Severity:** HIGH
- **File/module:** `src/ograf/svgRenderer.ts` matte definitions; `src/ograf/runtimeTemplate.ts:115`
- **Evidence:** The alpha-mask implementation composes a white full-frame region with a black source shape. In an SVG alpha mask, that leaves the outside opaque instead of making the source area transparent as the editor’s inverted matte semantics require.
- **Impact:** Inverted alpha matte output reveals the wrong region and can make the target appear fully or incorrectly visible.
- **Merge blocker:** YES
- **Recommended action:** Use an alpha-mask construction with correct black/white polarity and fill-rule semantics, then verify inverted and non-inverted alpha mattes with deterministic pixel probes.
- **Disposition:** BEFORE MERGE

### C3. Legacy matte controls are accepted although OGraf discards them

- **Severity:** HIGH
- **File/module:** `src/ograf/validation.ts:190-197`; `src/ograf/svgRenderer.ts`; `src/ograf/runtimeTemplate.ts`
- **Evidence:** Validation no longer rejects or clearly diagnoses legacy alpha/luminance/inversion/feather/gradient combinations that the current OGraf renderers do not preserve. The render path carries only a subset of those controls.
- **Impact:** `canCompile` can report success while output silently loses matte behavior, creating a compatibility failure rather than an explicit unsupported-feature diagnostic.
- **Merge blocker:** YES
- **Recommended action:** Either implement full legacy control parity in every OGraf renderer or restore validation diagnostics for controls that cannot be emitted faithfully.
- **Disposition:** BEFORE MERGE

### C4. Generated runtime drops mask feather, expansion, and subtract residual opacity

- **Severity:** HIGH
- **File/module:** `src/ograf/runtimeTemplate.ts:108-113`
- **Evidence:** `evaluateScene` calculates animated mask `feather` and `expansion`, but `maskDefs` emits only path geometry, opacity, and fill-rule. No morphology/blur filter is emitted. The subtract/difference branch also does not preserve residual opacity semantics.
- **Impact:** Materialized runtime output differs from editor and static OGraf output for animated or static feather, expansion, and partial subtract masks.
- **Merge blocker:** YES
- **Recommended action:** Carry the same morphology/blur order, filter bounds, opacity, and Boolean semantics into generated runtime; add positive/negative expansion, feather, and partial subtract parity tests.
- **Disposition:** BEFORE MERGE

### C5. Ordered add, subtract, intersect, and difference masks are reduced to nested intersections

- **Severity:** HIGH
- **File/module:** `src/components/Canvas/StagePartLayers.tsx:195-225`; `src/components/Canvas/renderers/parts/PartRenderer.tsx:123-126`; OGraf mask assembly
- **Evidence:** The editor unions only contiguous non-inverted add paths and applies emitted masks as nested `<g mask>` wrappers. Difference is handled like subtract in the emitted mask logic, and mixed sequences such as `add A, subtract B, add C` are not represented as `(A-B)∪C`.
- **Impact:** Boolean mask order and mode semantics are wrong for mixed stacks; output can be over-intersected, reveal the wrong region, or become empty.
- **Merge blocker:** YES
- **Recommended action:** Implement one ordered mask compositor that preserves add/subtract/intersect/difference semantics across editor, static OGraf, and generated runtime, or explicitly constrain and validate unsupported combinations.
- **Disposition:** BEFORE MERGE

### C6. Distinct adjacent add masks lose their own render parameters

- **Severity:** HIGH
- **File/module:** `src/components/Canvas/StagePartLayers.tsx:202-219`; `src/ograf/svgRenderer.ts:156-181`; generated runtime mask grouping
- **Evidence:** Contiguous add paths are merged into one definition using the first mask’s opacity, feather, and expansion. Later add masks with different values do not retain their own parameters.
- **Impact:** Per-mask opacity, feather, or expansion is silently replaced by the first mask’s settings; animated differences vary incorrectly over time.
- **Merge blocker:** YES
- **Recommended action:** Group only masks with identical render parameters, or preserve each mask’s contribution independently in the compositor; add a two-add-mask parity case with deliberately different animated properties.
- **Disposition:** BEFORE MERGE

### C7. Packaged image references are missing from matte definitions

- **Severity:** MEDIUM
- **File/module:** `src/ograf/svgRenderer.ts` matte/clip definition helpers
- **Evidence:** Normal layer rendering receives `imageReferences`, but matte and clip source definitions call content rendering without consistently passing the packaged image-reference map.
- **Impact:** Image-backed matte sources can resolve to an unavailable original URL or empty source in packaged output even when ordinary image layers work.
- **Merge blocker:** YES
- **Recommended action:** Thread `imageReferences` through every matte/clip source render path and add a packaged image matte fixture.
- **Disposition:** BEFORE MERGE

### C8. Generated SVG identifiers are interpolated without complete escaping

- **Severity:** HIGH
- **File/module:** `src/ograf/svgRenderer.ts`; `src/ograf/runtimeTemplate.ts:112-128,136`
- **Evidence:** Persisted layer and mask IDs are concatenated into SVG `id`, `url(#...)`, and innerHTML strings. Only selected geometry/text attributes are escaped; validation does not impose a safe identifier grammar.
- **Impact:** Malicious or malformed persisted IDs can break SVG references or inject SVG markup/event-handler content into the generated runtime.
- **Merge blocker:** YES
- **Recommended action:** Sanitize every generated identifier through one safe-ID function and use the sanitized value consistently in definitions and references; add hostile-ID output tests.
- **Disposition:** BEFORE MERGE

### C9. Generated runtime uses hardcoded fallback mask bounds

- **Severity:** HIGH
- **File/module:** `src/ograf/runtimeTemplate.ts:87-90`
- **Evidence:** `maskPathD` falls back to width `120` and height `80` when a layer has no explicit dimensions. The editor’s canonical `getPartBounds` derives dimensions from the actual part type/geometry.
- **Impact:** Normalized masks on standard shapes are transformed with incorrect bounds in exported runtime, producing displaced or incorrectly scaled masks.
- **Merge blocker:** YES
- **Recommended action:** Port the canonical part-bounds authority or serialize resolved bounds; add shape-specific normalized-mask parity tests without explicit width/height.
- **Disposition:** BEFORE MERGE

## Serialization, Migration, and Sequence Lifecycle Findings

### S1. Scene export omits `parentId`

- **Severity:** HIGH
- **File/module:** `src/hooks/useSerialization.ts:58-110,164-181`
- **Evidence:** `fromSceneData` reads `l.parentId` into the imported `CharacterPart`, but `toSceneData` does not include `p.parentId` in the exported `SceneLayer` object.
- **Impact:** Export/import of parented layers loses hierarchy. Child transforms, inherited transforms, and parent-dependent output can change after reopening a saved project.
- **Merge blocker:** YES
- **Recommended action:** Serialize `parentId` and add a real export→import round-trip assertion for hierarchy and evaluated child transforms.
- **Disposition:** BEFORE MERGE

### S2. Scalar mask keyframes collide across named sequences

- **Severity:** HIGH
- **File/module:** `src/utils/trackMutations.ts:44-71`
- **Evidence:** `addPropertyKeyframeMutator` locates and updates scalar mask keyframes by `frame` only. The path mutator immediately below correctly includes `(templateId || 'Sequence') === templateId`, so the inconsistency is specific and concrete.
- **Impact:** Authoring the same scalar mask property at the same frame in a second sequence overwrites the first sequence’s value and leaves its original template ID.
- **Merge blocker:** YES
- **Recommended action:** Match path-keyframe identity: locate by frame and normalized template ID, preserve the existing ID only for that sequence, and add a two-sequence same-frame regression test.
- **Disposition:** BEFORE MERGE

### S3. Sequence deletion leaves mask channel data orphaned

- **Severity:** HIGH
- **File/module:** `src/hooks/useTemplates`; `src/components/Inspector/DetailsPanel.tsx:426-430`
- **Evidence:** Sequence deletion filters legacy keyframes and ordinary `track.channels`, but does not remove entries from `maskChannels` or `maskPathChannels`, although new authoring callbacks store the active sequence template ID there.
- **Impact:** Deleted sequence data remains serialized, can affect unscoped evaluation, inflates timeline state, and can reconnect if an identifier is reused.
- **Merge blocker:** YES
- **Recommended action:** Filter scalar and path mask channels in the same atomic sequence-deletion update as ordinary channels.
- **Disposition:** BEFORE MERGE

### S4. Sequence tab changes do not synchronize playback duration

- **Severity:** HIGH
- **File/module:** `src/components/Timeline/SequencerTimeline.tsx:114`; sequence-selection/playback authority
- **Evidence:** Duration edits update the selected template and global `totalFrames`, but changing the selected template only calls `setActiveTemplateId`; the ruler, playback clamp, and end condition can retain the previous sequence’s duration.
- **Impact:** The displayed duration and actual playback/scrubbing bounds disagree after switching sequence tabs.
- **Merge blocker:** YES
- **Recommended action:** Route edit-mode sequence selection through one canonical authority that synchronizes `totalFrames` from the selected template while preserving broadcast-mode isolation.
- **Disposition:** BEFORE MERGE

## History and Undo/Redo Findings

### H1. Frame-group history operations ignore mask channels

- **Severity:** HIGH
- **File/module:** `src/components/Timeline/TrackLane.tsx:168-183,309-310`; `copyKeyframeGroupData`; `duplicateKeyframeGroup`; `SequencerTimeline`
- **Evidence:** New mask diamonds call whole-frame Copy/Duplicate actions, but the consuming group utilities enumerate only `TRACK_CHANNELS` and `track.channels`. Parent grouping, movement, and deletion likewise use transform-only channels.
- **Impact:** Mask-only frame groups copy nothing and duplicate as no-ops; mixed groups move/delete transform keyframes while leaving mask keyframes behind. Undo/redo then records an incomplete state transition.
- **Merge blocker:** YES
- **Recommended action:** Extend the canonical frame-group model and every copy, duplicate, collision, paste, move, delete, and history dispatch to scalar and path mask channels under the active template.
- **Disposition:** BEFORE MERGE

## Editor and Timeline UX Findings

### E1. Scale lanes were removed and left/right timeline rows are no longer paired

- **Severity:** HIGH
- **File/module:** `src/components/Timeline/TrackLane.tsx:283-312`; paired `TrackOutlinerRow`
- **Evidence:** The delta removes `isScaleExpanded` and `scaleX`/`scaleY` lane rendering while the outliner still renders a Scale header and optional scale rows. Mask rows are inserted without a matching ordered row model on the left.
- **Impact:** Existing scale keyframes become invisible and unavailable for selection/editing; opacity, scale, mask, and trim rows can align against the wrong labels.
- **Merge blocker:** YES
- **Recommended action:** Restore scale disclosure and lanes, then define one shared ordered row model for outliner and keyframe grid including mask rows.
- **Disposition:** BEFORE MERGE

### E2. Graph channel selection is not scoped before choosing a channel

- **Severity:** HIGH
- **File/module:** `src/components/Timeline/SequencerTimeline.tsx:99-113`
- **Evidence:** `graphChannel` selects the first channel with any keyframe and only later filters by active template at the modal callsite. A channel containing only another sequence can therefore win and display an empty graph while a valid active-sequence channel exists.
- **Impact:** Motion Curves becomes unavailable or edits the wrong channel in multi-sequence tracks.
- **Merge blocker:** YES
- **Recommended action:** Filter candidates by active template before channel selection and keep the selected channel valid as sequence and track state change.
- **Disposition:** BEFORE MERGE

### E3. Evaluated scalar mask edits are written to base masks

- **Severity:** HIGH
- **File/module:** `src/components/Inspector/DetailsPanel.tsx:191-201`; `StyleMatteSection`; `handleDisplayedPartPropChange`
- **Evidence:** The visible inspector receives evaluated masks, rebuilds the full mask array on scalar change, and writes evaluated opacity/feather/expansion values into base `CharacterPart.masks`. Existing active-sequence scalar channels continue to override those base values.
- **Impact:** Editing an animated scalar can snap back immediately and can bake unrelated animated values into fallback data.
- **Merge blocker:** YES
- **Recommended action:** Route scalar edits through active-sequence/current-frame keyframe authoring and update only the addressed property; write base values only when no active-sequence channel exists.
- **Disposition:** BEFORE MERGE

### E4. Bezier vertex IDs can collide after delete then add

- **Severity:** MEDIUM
- **File/module:** `src/components/Inspector/BezierPathEditor.tsx:56-65`
- **Evidence:** `addVertex` uses `vertex-${path.points.length}`. Deleting an interior vertex leaves a higher ID in the path, so the next add can reuse that existing ID.
- **Impact:** Duplicate React keys and ambiguous topology correspondence can corrupt selection, reconciliation, and animated path interpolation.
- **Merge blocker:** YES
- **Recommended action:** Use the repository ID generator or probe for an unused deterministic ID; add a delete-then-add uniqueness regression test.
- **Disposition:** BEFORE MERGE

### E5. Responsive Value Graph coordinate conversion is incorrect

- **Severity:** MEDIUM
- **File/module:** `src/components/Inspector/TemporalGraphPanel.tsx:62-65`; `src/tests/TemporalGraphPanel.test.tsx:21-29`
- **Evidence:** The graph uses a fixed 520x190 viewBox but CSS scales its width. `toValue` applies CSS `clientY` directly against fixed viewBox padding and height instead of converting through `getBoundingClientRect()`.
- **Impact:** The same visible pointer position writes different values as the inspector width changes; the current test asserts only that a number was emitted.
- **Merge blocker:** YES
- **Recommended action:** Convert client coordinates into viewBox coordinates using the actual SVG rect and add concrete max/mid/min assertions at multiple scale factors.
- **Disposition:** BEFORE MERGE

### E6. Bezier controls are pointer-only

- **Severity:** MEDIUM
- **File/module:** `src/components/Inspector/BezierPathEditor.tsx:126-134`
- **Evidence:** Vertices and handles are SVG circles controlled by `onMouseDown`; they are not focusable, keyboard-operable, or backed by equivalent numeric inputs. Handle circles also lack labels.
- **Impact:** Keyboard-only and assistive-technology users cannot author or adjust Bezier paths.
- **Merge blocker:** YES
- **Recommended action:** Expose focusable labelled controls with arrow-key movement or equivalent labelled numeric coordinate inputs.
- **Disposition:** BEFORE MERGE

### E7. Value Graph keyframes are not keyboard-editable

- **Severity:** MEDIUM
- **File/module:** `src/components/Inspector/TemporalGraphPanel.tsx:113-121`
- **Evidence:** Keyframe circles are descendants of an SVG with `role="img"` and are controlled only by pointer events; there is no tab stop, interactive role, keyboard handler, or numeric editing path.
- **Impact:** Keyboard and screen-reader users can discover the graph image but cannot focus or change its keyframes.
- **Merge blocker:** YES
- **Recommended action:** Separate descriptive graph semantics from focusable keyframe controls and provide keyboard adjustment or labelled numeric inputs.
- **Disposition:** BEFORE MERGE

## Runtime and Interpolation Findings

### R1. Generated runtime does not preserve supported easing behavior

- **Severity:** HIGH
- **File/module:** `src/ograf/runtimeTemplate.ts:39-47`
- **Evidence:** The generated `applyEasing` no longer contains the supported `bounce`, `elastic`, `anticipate`, and `overshoot` branches. `autoBezier` falls through to a fixed ease-in-out curve instead of using the editor’s neighbor-derived controls.
- **Impact:** The same serialized animation produces different motion in the editor, static OGraf preview, and materialized runtime.
- **Merge blocker:** YES
- **Recommended action:** Port the complete shared easing contract, including auto-Bezier neighbor derivation, or generate runtime code from the canonical evaluator contract; add per-easing parity tests.
- **Disposition:** BEFORE MERGE

### R2. Auto-Bezier uses the oldest prior keyframe instead of the nearest prior neighbor

- **Severity:** MEDIUM
- **File/module:** `src/utils/defaults.ts:57,75-80,96`
- **Evidence:** `previousPrevious = sorted.find(candidate => candidate.frame < prev.frame)` returns the first/oldest matching keyframe rather than the immediately preceding sorted entry. With frames 0, 20, 30, 40, the 30→40 segment uses frame 0 instead of frame 20.
- **Impact:** Adding distant history changes the tangent and visible motion of later auto-Bezier segments.
- **Merge blocker:** YES
- **Recommended action:** Select the preceding array index symmetrically with the following index and add a regression test with at least five keyframes and deliberately different distant values.
- **Disposition:** BEFORE MERGE

## Testing Findings

### T1. Multi-mask tests verify IDs, not composited output

- **Severity:** HIGH
- **File/module:** `e2e/v6-motion-core.spec.ts:22-33`; `e2e/fixtures/v6-motion-core.scene.json:67-153`; `src/tests/ografV6Parity.test.ts:96-110`
- **Evidence:** Added checks assert mask IDs and one mask reference, but do not verify nested order, Boolean semantics, or pixels. The fixture contains add/subtract/intersect/difference combinations that can be wrong while all structural assertions pass.
- **Impact:** The primary V6 compositing acceptance path can remain green with visibly incorrect or empty output.
- **Merge blocker:** YES
- **Recommended action:** Use distinguishable geometry/colors and deterministic Chromium pixel probes or approved screenshot comparison for each Boolean region; also assert the ordered reference chain.
- **Disposition:** BEFORE MERGE

### T2. V6 persistence tests do not exercise a real export→import round trip

- **Severity:** MEDIUM
- **File/module:** `e2e/v6-motion-core.spec.ts:35-46`; `src/tests/useSerialization.test.ts:2167-2240`
- **Evidence:** The browser test preloads localStorage through `addInitScript` and reloads the same payload without a product save/mutation path. The unit test inspects `exportProject()` JSON but does not import it into a clean state authority.
- **Impact:** Import-side loss of `maskPathChannels`, scalar mask channels, `trackMatte.sourceVisible`, canonical paths, or hierarchy can pass the suite.
- **Merge blocker:** YES
- **Recommended action:** Execute the real save/autosave authority after an observable mutation, then import exported JSON into a clean hook instance and compare all V6 fields and evaluated state.
- **Disposition:** BEFORE MERGE

## Performance Findings

### P1. Mask evaluation repeatedly copies and sorts channel arrays

- **Severity:** MEDIUM
- **File/module:** `src/utils/evaluateLayerMasks.ts:30-38`; `src/utils/defaults.ts:57,96`
- **Evidence:** Each mask resolves path plus three scalar properties, and each interpolation call spreads and sorts its keyframe array again for every frame.
- **Impact:** Playback allocations and sorting grow with mask count and keyframe count, increasing GC pressure in complex scenes.
- **Merge blocker:** NO
- **Recommended action:** Keep channel arrays sorted at mutation/import boundaries and use a non-copying segment search or per-frame sorted-channel cache.
- **Disposition:** V6.1

### P2. Mask SVG definitions are rebuilt during selection-only renders

- **Severity:** MEDIUM
- **File/module:** `src/components/Canvas/StagePartLayers.tsx:195-225`
- **Evidence:** Each render repeats layer lookup, normalized path generation, and mask definition construction; selection-only prop changes can trigger the same work even when evaluated geometry is unchanged.
- **Impact:** Mask-heavy scenes can incur avoidable O(layer²)-style lookup and SVG allocation work during ordinary selection interaction.
- **Merge blocker:** NO
- **Recommended action:** Build an ID-to-layer map, memoize definitions by evaluated scene/mask inputs, and keep selection decoration outside the geometry derivation.
- **Disposition:** V6.1

## Documentation and Delivery Findings

### D1. CI isolation recognizes only `CI === 'true'`

- **Severity:** MEDIUM
- **File/module:** `playwright.config.ts`
- **Evidence:** `isIsolatedQaRun` checks exactly `process.env.CI === 'true'`, while retries, workers, and `forbidOnly` use the truthiness of `process.env.CI`. Values such as `CI=1` therefore receive CI worker behavior while retaining local port reuse.
- **Impact:** A nonstandard CI truthy value can run against a reused dev server or otherwise use inconsistent isolation settings.
- **Merge blocker:** NO
- **Recommended action:** Normalize CI truthiness once and use the normalized value for all Playwright isolation decisions.
- **Disposition:** BEFORE MERGE

### D2. V6.1 roadmap still lists delivered mask-path keyframes

- **Severity:** MEDIUM
- **File/module:** `docs/V6_PLUS_ANIMATION_ROADMAP.md:21`
- **Evidence:** The roadmap lists “Add mask path keyframes” under V6.1 while the V6 progress evidence and fixture describe mask path keyframes as delivered in V6.0.
- **Impact:** Planning and release communication misstate the delivered boundary.
- **Merge blocker:** NO
- **Recommended action:** Move the item out of V6.1 or replace it with the remaining parity work.
- **Disposition:** BEFORE MERGE

### D3. OGraf interop documentation is behind the delivered compositor boundary

- **Severity:** MEDIUM
- **File/module:** `docs/interop/V6_LOTTIE_MAPPING.md`; `skills/animation-review/SKILL.md`
- **Evidence:** These documents describe masks/mattes/animated properties as deferred, while the current V6 progress evidence presents them as implemented.
- **Impact:** Reviewers and integrators receive contradictory support claims and may rely on unsupported or incorrectly documented behavior.
- **Merge blocker:** NO
- **Recommended action:** Synchronize the mapping and skill documentation with the actual supported subset and explicit unsupported diagnostics.
- **Disposition:** BEFORE MERGE

### D4. Historical progress report contains contradictory push status

- **Severity:** LOW
- **File/module:** `reports/progress_025.md`
- **Evidence:** The report states both that push was not yet completed and later that the branch was pushed/current.
- **Impact:** Historical delivery evidence is ambiguous.
- **Merge blocker:** NO
- **Recommended action:** Correct the historical status or annotate it as superseded.
- **Disposition:** CLEANUP PASS

## Cleanup Candidates

### K1. Remove unused V6 helper surfaces and duplicate handle allocations

- **Severity:** LOW
- **File/module:** `src/utils/bezierPath.ts:18-32,164-190,202-228`; `src/types/animator.ts:73-75`; unused `onUpdateMaskPathKeyframeFrame` prop path
- **Evidence:** `sampleBezierPath` and `LayerMaskStack` have no repository consumers. `sanitizeVertex` and `interpolateBezierPath` calculate the same sanitized/interpolated handle more than once, discarding the first object.
- **Impact:** Unused API surface increases maintenance cost and duplicate temporary objects add avoidable allocation during path operations.
- **Merge blocker:** NO
- **Recommended action:** Remove genuinely unused surfaces after confirming no external contract, and cache each handle result in a local variable before reuse.
- **Disposition:** CLEANUP PASS

## Accessibility Findings

No additional material accessibility finding was identified outside E6 and E7. Those two newly added SVG authoring surfaces are merge blockers because pointer-only operation is not an equivalent accessible interaction contract.

## Git and Delivery Findings

- Working tree was clean at review start.
- HEAD and `origin/feat/v6-motion-core` were aligned at `4d21ace0a85fdbeecbe20290deca8991405a3b3`.
- `main` and `origin/main` remained at `8024d4f` during the review.
- No branch was created or switched.
- No source, test, configuration, or existing report was edited.
- No commit was created.
- No push was performed.
- Main was not modified.

## Merge Blockers

1. Canonical mask sequence filtering and cross-sequence scalar-keyframe identity are incomplete.
2. Named-sequence standalone runtime evaluation is hardcoded to `Sequence`.
3. Bezier coordinate-space and one-sided-handle interpolation are unsafe.
4. Editor and OGraf Boolean mask ordering/semantics diverge.
5. Disabled, inverted, feathered, expanded, and partial-opacity matte/mask behavior is not preserved across output surfaces.
6. Generated SVG identifiers are not consistently safe for innerHTML output.
7. Normalized runtime mask bounds are hardcoded instead of using canonical part bounds.
8. Parent hierarchy is lost on export.
9. Timeline scale rows, mask frame-group actions, sequence deletion, sequence duration switching, graph selection, and animated scalar mask editing regress existing editor contracts.
10. Bezier and Value Graph authoring surfaces are not keyboard-accessible.
11. Added tests do not verify multi-mask pixels or a real persistence round trip.

## Non-Blocking Improvements

- Normalize CI environment truthiness in Playwright configuration.
- Synchronize V6 roadmap and OGraf interop documentation before release communication.
- Correct contradictory historical push-status wording.
- Add explicit test coverage for graph scaling, duplicate vertex IDs, sequence deletion, disabled mattes, easing parity, packaged image mattes, hostile IDs, and runtime filter effects after the blockers are fixed.

## Cleanup-Pass Candidates

- Correct `reports/progress_025.md` delivery-status contradiction.
- Remove unused `sampleBezierPath`, `LayerMaskStack`, and dead mask-path frame callback surfaces after external-contract confirmation; avoid unrelated refactoring.

## V6.1 Candidates

- Remove per-frame mask channel copy/sort allocations through sorted-channel invariants or a bounded evaluator cache.
- Memoize mask SVG definition derivation and replace repeated linear layer lookup with an ID map.

## Final Merge Verdict

**NOT READY TO MERGE.**

The green baseline suites are insufficient evidence for this delta because the highest-risk paths are either structurally asserted or implemented by parallel renderers with known parity gaps. Merge requires correction and targeted verification of all YES blockers above, followed by the relevant focused tests and the required project validation commands. No cleanup-only disposition can make the current branch merge-ready.
