# KCS Development Report — V5.1 Manual QA Fix Pass A.2

Metadata:
- Date: 2026-08-29
- Milestone: KCS V5.1 — Manual QA Fix Pass A.2
- Branch: `main`
- Starting HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Ending HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Commit status: Uncommitted intentional Pass A, A.1, and A.2 changes; commit prohibited
- Report number: `003`

# 1. Executive Summary

Pass A.2 is a small follow-up to the V5.1 Boolean retest. It changes normal Boolean-result selection back to object semantics by removing generated contour vertex labels, preserves numbered markers for true editable Free Draw objects, and hardens selection bounds for multi-contour and hole-producing Boolean results.

The visible failure was not a missing polygon vertex. A Boolean result is generated topology, not an authored path-node editing surface. Showing labels from only the first `points` contour created misleading partial overlays and detached-looking markers after Union/Subtract/Intersect/Exclude changes. Normal Boolean selection now presents one transform object frame; direct geometry editing remains the explicit Edit Operands workflow.

The existing Pass A.1 `deriveBooleanGeometry` authority is reused. It derives the current-frame world result from evaluated operands and converts it into Boolean-parent-local contours. `SelectionGizmo` and marquee bounds consume all current derived contours, while rendering continues to preserve polygon/ring structure and `fillRule="evenodd"` semantics.

Completion state: implementation, focused verification, focused Chromium/E2E scenarios, and browser spot checks passed. Ready for User QA Pass A.2 retest. Remaining V5.1 QA categories and full regression were not run.

# 2. Original Objectives

Original task: fix Boolean multi-contour selection/vertex overlay confusion without broadening the V5.1 QA scope.

In scope:

- Hide generated Boolean vertex markers in normal object selection mode.
- Preserve true Free Draw/freeform vertex markers.
- Use every current-frame Boolean contour for selection bounds.
- Preserve holes and ring semantics during rendering.
- Remove stale selection frame behavior across operation switches and empty results.
- Add focused tests and focused Chromium/E2E/browser verification.
- Create the next sequential permanent development report.

Out of scope:

- Mask, Color, Reset View, Rename, Timeline, Export, responsive QA, final visual review, and full regression.
- A Boolean result path/node editing mode; no such approved mode currently exists.
- New SceneData fields, schema version changes, or generated-name metadata changes.
- Commit and push.

# 3. Problems Discovered

## 3.1 Boolean result exposed generated topology as path editing

- Symptom: A selected Boolean could show numeric labels on only some result vertices. Labels clustered on one contour and could appear detached from visible geometry.
- Reproduction: Create two eligible shapes, create a Boolean, switch operations, and select the parent. Multi-contour/ring output made the partial marker set visible.
- Root cause: `StageCanvas` treated every `custom_freeform` selected part as marker-eligible. Boolean results use `custom_freeform` as a renderer carrier, but their points are generated clipping contours rather than an authored editable path.
- Affected subsystem: StageCanvas vertex overlay, Boolean selection UX, operation switching.
- Severity: HIGH UX correctness.
- Status: FIXED. Boolean results are excluded from numbered marker rendering; true non-Boolean freeforms retain markers.

## 3.2 Selection bounds needed all current contours

- Symptom: Boolean object bounds could represent only one contour/ring or stale persisted result points, especially after operation changes.
- Reproduction: Use Exclude/XOR or another multi-contour result, then select the Boolean parent and compare its transform box with the complete visible result.
- Root cause: Bounds must consume the current derived contour set, not `points` or the first contour. Pass A.1 already introduced a shared derivation helper, but Pass A.2 adds explicit all-contour selection coverage and an empty-result guard.
- Affected subsystem: Boolean geometry, SelectionGizmo, `getPartLocalBounds`, marquee.
- Severity: HIGH visual correctness.
- Status: FIXED. Current derived local contours are flattened only for AABB calculation; rendering still receives separate rings.

## 3.3 Empty operation results could retain a fallback transform frame

- Symptom: Switching to an empty Intersect result could leave a small fallback transform box even though no visible Boolean result existed.
- Root cause: Generic bounds fallback was valid for ordinary missing geometry but not for a derived Boolean result with zero contours.
- Affected subsystem: SelectionGizmo and operation switching.
- Severity: MEDIUM stale-overlay UX.
- Status: FIXED. Empty current Boolean results render no transform gizmo until a non-empty operation is selected.

# 4. Files Created

No new production files were created.

`reports/progress_003.md` is the required permanent development report. `src/tests/containerMath.test.ts` remains a Pass A-created test file from the accumulated uncommitted baseline, not a Pass A.2 file.

# 5. Files Modified

Pass A.2 changes are limited to the following files; earlier Pass A/A.1 changes remain intentionally uncommitted and are documented by `progress_001.md` and `progress_002.md`.

- `src/components/Canvas/StageCanvas.tsx` — Adds the explicit `!selectedPart.booleanOperandIds?.length` guard to numbered marker rendering and gives markers a stable `freeform-vertex-marker` test ID. Boolean results remain object selections; true freeforms remain marker-eligible. Risk: MEDIUM canvas overlay behavior.
- `src/components/Canvas/SelectionGizmo.tsx` — Uses the shared current-frame Boolean derivation for selection geometry and suppresses transform frames for empty derived Boolean results. Risk: HIGH selection/render synchronization.
- `src/utils/booleanGeometry.ts` — Exposes/reuses `deriveBooleanGeometry` as the world/local contour pair authority and retains ring normalization without flattening topology for rendering. Risk: HIGH geometry contract.
- `src/utils/viewportMath.ts` — Derives current Boolean contours before marquee world-bound calculation, preserving all contours for selection intersection. Risk: HIGH marquee behavior.
- `src/tests/booleanGeometry.test.ts` — Adds current derived contour and disconnected Exclude coverage while retaining operation/order/transform tests. Risk: LOW test-only.
- `src/tests/selectionGizmo.test.tsx` — Changes the stale-contour test to a disconnected Exclude result and verifies the complete multi-contour selection width. Risk: LOW test-only.
- `src/tests/viewportMath.test.ts` — Retains the client conversion and transformed marquee coverage used by the Pass A.1 contract. Risk: LOW test-only.
- `src/tests/outlinerPanel.test.tsx` — Retains the Parallelogram render regression from Pass A.1. Risk: LOW test-only.
- `e2e/v51-manual-qa.spec.ts` — Adds an E2E assertion that a normal Boolean selection has zero generated freeform vertex markers. Risk: LOW test-only.

# 6. Architecture Overview

The normal Boolean path now has object selection semantics:

```text
Authored operand geometry
        + evaluated operand transforms
        + Boolean operation
        + parent transform
                    |
                    v
         deriveBooleanGeometry()
             |               |
             |               +--> localContours --> PartRenderer
             |                                         (rings preserved)
             +--> worldContours / localContours --> SelectionGizmo bounds
             |
             +--> world bounds --> getPartsInMarquee

Normal Boolean selection ------------------> object transform gizmo
Edit Operands -----------------------------> authored operand selection/gizmo
True Free Draw ----------------------------> numbered vertex markers
```

The existing layering remains intact:

- `evaluateFrame`/`evaluateTransform` own current-frame transform evaluation.
- `booleanGeometry` owns polygon-clipping and world/local result derivation.
- `StagePartLayers` owns SVG result rendering.
- `SelectionGizmo` owns object selection-frame rendering.
- `StageCanvas` owns transient vertex marker and marquee overlays.
- `viewportMath` owns pure marquee bounds/intersection math.

No second Boolean evaluator or path editing engine was introduced.

# 7. Data Model Changes

## Authored/serialized state

No SceneData field, version, or serialized Boolean shape was added or removed. Existing `booleanOperation`, `booleanOperandIds`, `booleanGroupId`, `booleanContours`, and `points` remain available for persistence/backward compatibility.

Persisted `booleanContours` and `points` are not live normal-selection authority when the Boolean has valid operands and operation. They remain compatibility/authored fields; current editor geometry is derived from evaluated operands.

## Derived/evaluated state

`DerivedBooleanGeometry` contains:

- `worldContours`: current operation result in world/canvas coordinates.
- `localContours`: the same contours inverse-transformed into the Boolean parent's local coordinates.

For bounds, all points from all local contours contribute to the AABB. For rendering, each contour remains a separate path segment and holes/ring winding continue through the existing `fillRule="evenodd"` path construction.

## Transient editor/UI state

No new transient state was required. Normal Boolean result selection is represented by existing selected IDs and the existing transform gizmo. Existing `booleanOperandEditingGroupId` remains transient and controls operand editing; it is not serialized.

# 8. Coordinate Space Model

- Object-local: static shape geometry and authored freeform points.
- Boolean-parent-local: derived Boolean result contours consumed inside the parent transform; attached operand transforms remain local to the Boolean parent.
- World/canvas: evaluated operand transforms and polygon-clipping input/output before inverse parent conversion.
- SVG viewBox: transform-gizmo and marquee overlay coordinates.
- Viewport/screen: browser client coordinates after layout, preserveAspectRatio, CSS zoom, and pan.

Pass A.2 does not change the Pass A/A.1 transform model:

```text
evaluateTransform(operand) -> world operand transform
computeBooleanContours(world operands) -> worldContours
inverseTransformBooleanContours(group transform) -> localContours
PartRenderer(parent transform + localContours) -> visible result
```

Selection bounds use the same `localContours` and the selected parent's evaluated transform. The AABB includes every contour point, including disconnected result islands and hole rings. The renderer never receives a flattened AABB in place of contour topology.

Normal Boolean result vertices are intentionally not projected into screen space because they are not an editable path surface. Operand mode continues to expose authored operand geometry and uses the existing world/local drag boundary.

# 9. Component / Module Walkthrough

## `StageCanvas`

The marker overlay remains attached to selected `custom_freeform` parts, but now explicitly excludes parts with `booleanOperandIds`. This distinguishes a Boolean result's renderer carrier type from a true editable Free Draw object. A stable test ID identifies retained freeform markers. Marquee state remains transient and is cleared on pointer-up.

## `SelectionGizmo`

`withCurrentBooleanGeometry` resolves current operands and evaluated transforms through `deriveBooleanGeometry`. The returned synthetic part carries all current local contours into `getPartLocalBounds` and `TransformGizmo`. If the derived Boolean result is empty, no transform frame is emitted, preventing fallback geometry from becoming a stale overlay.

## `StagePartLayers`

The existing Pass A.1 path already calls the shared derived geometry authority and passes local contours to `PartRenderer`. Pass A.2 preserves separate contour/ring rendering; no topology flattening was added.

## `viewportMath`

`getPartsInMarquee` derives current Boolean local contours before calling `getPartWorldBounds`. The resulting AABB is suitable for intersection selection while the actual SVG rendering still uses all separate rings.

## `booleanGeometry`

`deriveBooleanGeometry` remains a thin composition around canonical polygon clipping and inverse parent transform. It returns both coordinate-space representations so consumers do not repeat or subtly alter conversion formulas.

# 10. Important Code Changes

Normal marker eligibility now expresses the product contract directly:

```tsx
{selectedPart?.type === 'custom_freeform' &&
  !selectedPart.booleanOperandIds?.length &&
  selectedTransform &&
  ...}
```

Current Boolean geometry remains paired:

```ts
const worldContours = computeBooleanContours(operation, operands, operandTransforms);
return {
  worldContours,
  localContours: inverseTransformBooleanContours(worldContours, groupTransform),
};
```

Selection consumers derive all contours before bounds:

```ts
const selectionPart = withCurrentBooleanGeometry(
  selectedPart,
  characterParts,
  getComputedTransform,
  currentFrame,
);
if (selectionPart.booleanOperandIds?.length && selectionPart.booleanContours?.length === 0) {
  return null;
}
```

# 11. Public Interfaces

No new persisted public interface was added.

Existing Pass A.1 interfaces used by this pass:

- `DerivedBooleanGeometry` — derived world/local contour pair.
- `deriveBooleanGeometry(operation, operands, operandTransforms, groupTransform)` — returns current Boolean geometry without mutation.
- `getPartLocalBounds(part, transform?)` — calculates local min/max across every supplied contour.
- `getPartWorldBounds(part, transform, canvasCenterX, canvasCenterY)` — converts local bounds to world AABB.
- `StagePartLayers` optional `booleanOperandEditingGroupId` — transient render mode.
- `SelectionGizmo` optional `booleanOperandEditingGroupId` — operand selection guard.

`StageCanvas` marker DOM now includes `data-testid="freeform-vertex-marker"` for focused browser/test inspection. This is a test-facing DOM attribute, not persisted state.

# 12. Algorithms and Geometry

## Multi-contour bounds

Input: current Boolean operation, authored operands, evaluated world transforms, and evaluated Boolean-parent transform.

1. Polygon-clipping computes a `MultiPolygon` result.
2. Ring normalization removes only repeated closing points; separate rings remain separate.
3. The result is inverse-transformed to parent-local coordinates.
4. Bounds flatten all local contour points for min/max calculation only.
5. The renderer retains the contour array and uses separate path segments with existing fill-rule semantics.

Complexity: O(n) for contour flattening and bounds calculation after polygon clipping. Disconnected contours and holes contribute their points to the object AABB without being merged into one render ring.

## Empty results

An empty derived contour array is a valid Boolean state. It must not use the generic missing-geometry fallback for a transform selection frame. SelectionGizmo exits without emitting a Boolean transform gizmo; Inspector operation controls remain available for switching to a non-empty operation.

## Vertex overlay eligibility

The marker overlay is a product-level affordance, not a geometry traversal. True Free Draw parts remain eligible. Boolean result carrier parts are excluded regardless of the number of generated contours, avoiding partial or misleading labels.

# 13. Interaction / UX Behavior

## Boolean result selection

- BEFORE: Generated Boolean clipping vertices could display partial numeric labels.
- AFTER: A normal Boolean result shows object transform bounds and handles only.
- EXPECTED WORKFLOW: Select the Boolean parent to move/scale/rotate the object; use Edit Operands for direct authored geometry changes.

## Free Draw selection

- BEFORE: Freeform vertex markers were globally tied to `custom_freeform` type.
- AFTER: True non-Boolean freeforms retain numbered markers.
- EXPECTED WORKFLOW: Select a Free Draw object and continue using its existing numbered vertex affordance.

## Operation switching

- BEFORE: A prior operation's generated marker/bounds state could remain visually confusing.
- AFTER: Operation changes rederive current contours; no generated markers are rendered; empty results emit no object frame.
- EXPECTED WORKFLOW: Switch Union → Exclude → Intersect → Subtract → Union and observe only the current object frame and current visible topology.

## Multi-contour Exclude

- BEFORE: Selection could reflect only a first contour or stale result points.
- AFTER: All disconnected contours contribute to one complete object AABB.
- EXPECTED WORKFLOW: Select a disconnected Exclude result; one transform box encloses the complete visible result while holes/rings remain renderer semantics.

# 14. Design Decisions

## Boolean results are objects, not generated path editors

- Decision: Hide numbered Boolean result vertices in normal mode.
- Reason: No approved Boolean path/node editing mode exists, and generated clipping topology is not authored user-editable geometry.
- Alternatives: Number every point across every ring; expose a generated topology editor; show only the first ring.
- Trade-offs: Users cannot inspect generated vertices directly, but the UI no longer implies unsupported editing or displays partial topology.
- Future implication: A real Boolean path-edit mode would require an explicit data/editing design, not a marker-only toggle.

## All contours for bounds, separate contours for rendering

- Decision: Flatten only for AABB; preserve contour arrays for SVG.
- Reason: Bounds need the complete visible extent, while holes and ring semantics must not be lost.
- Alternatives: Use first contour; merge points into one polygon; derive bounds from persisted `points`.
- Trade-offs: Bounds are O(n) over all result points; topology remains correct.
- Future implication: Any new geometry consumer must state whether it needs a topology-preserving contour set or a bounds-only reduction.

## Reuse one current-frame authority

- Decision: SelectionGizmo, StagePartLayers, and marquee use `deriveBooleanGeometry`.
- Reason: Prevents stale persisted geometry and mixed parent/world conversion.
- Alternatives: Consumer-specific Boolean computations or mutating persisted contours on every frame.
- Trade-offs: Multiple consumers invoke the same deterministic derivation; memoization should be added only after measured need.
- Future implication: A selector/cache can be considered later, but must preserve the same inputs and coordinate contract.

# 15. Invariants That Must Be Preserved

- Normal Boolean result selection is an object transform surface, not a generated path-node editor.
- True Free Draw vertex markers remain available.
- `deriveBooleanGeometry` is the current-frame Boolean world/local authority.
- Bounds include every current derived contour point.
- Rendering preserves separate rings and holes; do not replace topology with an AABB polygon.
- `booleanGroupId` remains the transform-parent relationship introduced in Pass A.
- Parent transform is applied once.
- `Track.channels`/`evaluateFrame` remain animation authorities.
- Persisted `booleanContours`/`points` are compatibility data, not stale live-selection truth.
- Empty Boolean results must not acquire generic fallback selection geometry.
- Marquee is transient and its client-to-SVG conversion must not gain static offsets.
- Operand edit mode remains transient editor state.
- No automatic snap/alignment behavior may return.
- No full QA category outside Pass A.2 may be started in this pass.

# 16. Testing and Verification

## TypeScript

- Command: `npx tsc --noEmit`
- Result: PASS.

## Vitest

- Command:

```text
npx vitest run src/tests/booleanGeometry.test.ts src/tests/bounds.test.ts src/tests/selectionGizmo.test.tsx src/tests/viewportMath.test.ts src/tests/evaluateFrame.test.ts src/tests/useSelection.test.ts src/tests/useInspector.test.ts src/tests/freeform.test.ts src/tests/outlinerPanel.test.tsx src/tests/useKeyboardShortcuts.test.ts src/tests/styleAppearanceSection.test.tsx src/tests/styleMatteSection.test.tsx src/tests/inlineRename.test.tsx src/tests/confirmationDialog.test.tsx
```

- Result: PASS, 14 test files and 294 tests.
- Coverage: multi-contour Boolean derivation, selection bounds, empty/stale contour protection, normal selection overlay behavior, viewport conversion, transform hierarchy, operand editing, freeform normalization, Parallelogram Outliner stability, and preserved Pass A/A.1 focused contracts.

## Playwright/E2E

- Final command:

```text
CI= npx playwright test e2e/editor-interaction-regressions.spec.ts e2e/v51-manual-qa.spec.ts -g "Parallelogram|supports Boolean creation"
```

- Result: PASS, 3 tests.
- Coverage: Parallelogram mirror/selection, repeated Parallelogram drawing without page errors, Boolean hierarchy/dissolve, and normal Boolean selection with no generated vertex markers.

## Manual browser verification

- Seeded overlapping Triangle + Rhombus shapes.
- Verified Union, Exclude, Intersect, and Subtract operation switching.
- Measured rendered path bounds against transform-frame bounds; non-empty operations matched.
- Verified normal Boolean selection had zero `freeform-vertex-marker` elements.
- Verified Exclude output retained multiple path segments/rings while selection remained one complete object box.
- Verified empty/non-empty operation transitions did not retain stale generated markers.
- Entered Edit Operands and confirmed operand layers/mode controls remained available; Escape returned to normal object mode.
- Browser runtime error capture was empty during the final spot checks.

## Git validation

- Command: `git diff --check`
- Result: PASS. Git emitted normal LF-to-CRLF working-copy warnings only.
- Final branch/HEAD state: `main`, HEAD and origin/main both `fe543aa64d4079a2923eec60659e748cfc360d4c`, ahead/behind `0/0`.
- Working tree: intentionally dirty with accumulated Pass A/A.1/A.2/reporting changes.

## Not run by scope

- Full Vitest.
- Full Playwright.
- Production build.
- Lint.
- Mask, Color, Reset View, Rename, Timeline, Export, responsive, and final visual QA.

# 17. Manual QA Results

- Normal Boolean result has no generated vertex labels: PASS.
- True Free Draw marker behavior: PARTIAL — preservation is guarded by the explicit eligibility condition and existing freeform tests; a full new browser Free Draw workflow was not run in this small pass.
- Union selection bounds: PASS in browser measurement.
- Exclude multi-contour selection bounds: PASS in unit coverage and browser inspection.
- Intersect selection bounds: PASS for the overlapping Triangle/Rhombus browser scenario.
- Subtract selection bounds: PASS for the overlapping Triangle/Rhombus browser scenario.
- Operation switching cleanup: PASS in browser inspection; no generated markers remained.
- Empty operation result: PASS by selection-gizmo guard; no stale object frame remained in the focused path.
- Edit Operands workflow: PASS preserved in browser spot check and existing focused tests.
- Parent movement, undo/redo, Inspector X/Y, dissolve, vertex numbering, and Outliner hierarchy: PASS per user retest baseline; not comprehensively rerun in A.2.
- Mask, Color, Reset View, Rename, Timeline, Export, responsive, and final visual QA: NOT TESTED by explicit scope.

# 18. Regression Risk Assessment

- Boolean selection/render alignment: HIGH. The shared derivation removes the known split authority, but the code remains a high-risk geometry/evaluation boundary.
- Empty result behavior: MEDIUM. Suppressing the frame is correct for no visible result, but future UX may need an explicit empty-result selection affordance.
- Freeform marker preservation: MEDIUM. Eligibility now distinguishes Boolean carriers from true freeforms; future Boolean-like custom types must set the correct relationship fields.
- Multi-contour bounds: MEDIUM-HIGH. All points are included for bounds, while rendering preserves rings; future consumers must not reuse the flattened AABB as render geometry.
- Name-origin parsing: MEDIUM inherited from A.1. No new naming schema was introduced.
- Performance: MEDIUM. Multiple consumers derive current Boolean geometry; no benchmark was run.
- Serialization/reload: MEDIUM inherited from A.1. Persisted result fields remain compatibility data and need dedicated parity coverage.

# 19. Performance Considerations

- Boolean geometry is still derived from evaluated operands during StagePartLayers and selection/marquee consumers.
- Bounds flatten all result points linearly after clipping.
- Normal mode no longer renders generated vertex marker groups for Boolean results, reducing overlay DOM for that selection case.
- No new timer, animation loop, persistent cache, or independent evaluator was added.
- No performance benchmark or frame-time measurement was executed.

# 20. Dependencies

No dependency changes. Existing `polygon-clipping` remains the Boolean operation dependency.

# 21. Compatibility

- React/TypeScript: Existing React Context/Hook architecture preserved; `npx tsc --noEmit` passed.
- Vite/Chromium: Browser app loaded and focused E2E passed.
- Node/Windows: Focused commands ran in the existing Windows workspace.
- SVG: Separate contour/ring rendering and `fillRule="evenodd"` semantics remain intact.
- Saved projects: No SceneData version or field change. Persisted Boolean fields remain readable/pass-through.
- Freeform: True `custom_freeform` parts without Boolean operand IDs retain marker behavior.
- Warnings: Git reported standard line-ending conversion warnings. No product runtime errors were captured after the final fix.

# 22. Known Limitations

- The user must perform the complete Pass A.2 manual retest.
- A real Boolean generated-path editing mode does not exist and was intentionally not added.
- Free Draw browser workflow was not comprehensively rerun in A.2.
- Empty Boolean results have no transform frame; an explicit future empty-result UX is not designed.
- Generated/custom Boolean name distinction remains pattern-based from A.1.
- Full regression, build, and lint remain unrun.
- Nested/multiple Boolean editing and full animated operation-switch parity remain outside this pass.

# 23. Technical Debt

- Add a component-level test harness for full Boolean operation switching, frame changes, parent movement, operand editing, and selection-frame measurement.
- Add direct browser/E2E marquee corner pixel assertions at multiple zoom/pan values.
- Add import/reload pixel parity tests for legacy and current derived Boolean states.
- Revisit generated/custom name origin only through an approved compatibility/schema design.
- Consider memoized current-frame Boolean derivation only after profiling demonstrates a need.

# 24. Git Summary

- Branch: `main`
- Starting HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Ending HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- origin/main: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Ahead/behind: `0/0`
- Working tree: Intentionally dirty; accumulated Pass A/A.1/A.2 and reporting files present.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.
- A.2 production files: `src/components/Canvas/StageCanvas.tsx`, `src/components/Canvas/SelectionGizmo.tsx`, `src/utils/booleanGeometry.ts`, `src/utils/viewportMath.ts`.
- A.2 test/E2E files: `src/tests/booleanGeometry.test.ts`, `src/tests/selectionGizmo.test.tsx`, `src/tests/viewportMath.test.ts`, `src/tests/outlinerPanel.test.tsx`, `e2e/v51-manual-qa.spec.ts`, `e2e/editor-interaction-regressions.spec.ts`.
- Permanent report: `reports/progress_003.md`.

# 25. Updated Project Tree

```text
reports/
├── DEVELOPMENT_REPORTING_POLICY.md [canonical]
├── progress_001.md [Pass A]
├── progress_002.md [Pass A.1]
└── progress_003.md [new: Pass A.2]

src/components/Canvas/
├── SelectionGizmo.tsx [changed]
└── StageCanvas.tsx [changed]

src/utils/
├── booleanGeometry.ts [changed]
└── viewportMath.ts [changed]

src/tests/
├── booleanGeometry.test.ts [changed]
├── outlinerPanel.test.tsx [changed]
├── selectionGizmo.test.tsx [changed]
└── viewportMath.test.ts [changed]

e2e/
├── editor-interaction-regressions.spec.ts [changed]
└── v51-manual-qa.spec.ts [changed]
```

The tree intentionally omits `node_modules`, `dist`, generated test artifacts, and unrelated `.hermes/desktop-attachments/` content.

# 26. Self Review

What is good:

- The product contract now distinguishes Boolean object selection from authored path editing.
- Multi-contour bounds and ring-preserving rendering are explicitly separated.
- Current-frame derivation remains centralized and persisted result fields cannot win for live selection geometry.
- Empty operation results no longer receive a generic fallback frame.
- Focused unit, E2E, and browser evidence cover the requested failure class.

What could improve:

- Selection and rendering still invoke the shared derivation independently; a measured selector/cache could reduce repeated work later.
- A direct component-level test for StageCanvas's marker eligibility would make the no-marker contract less dependent on E2E.
- The user retest should include Free Draw, all requested operation/frame transitions, and reload parity.

Uncertainty:

- The original intermittent user sequence was not reproduced as a deterministic failing case after Pass A.1. The source-level split authority and current frame/path measurements provide evidence for the root cause and correction.
- Empty Intersect behavior was verified in the focused path, but broader empty-result UX is not designed.

Score: 8/10. The requested overlay contract is corrected with focused multi-contour and browser evidence, but high-risk geometry paths and full regression remain pending.

# 27. Next Recommended Task

Perform the complete manual QA Pass A.2 retest across Union, Subtract, Intersect, and Exclude, including disconnected contours, holes, operation switching, operand mode transitions, and empty-result behavior.

# 28. Project Status

- Current milestone: KCS V5.1 Manual QA Fix Pass A.2.
- Completed work: Boolean result object-selection semantics, generated vertex overlay removal, all-contour derived bounds, ring-preserving rendering, empty-result frame cleanup, focused tests, focused E2E, and browser spot checks.
- Remaining milestone work: User Pass A.2 retest; then Mask, Color, Reset View, Rename, Timeline, Export, responsive, final visual QA, and full regression batches.
- QA stage: Ready for User QA Pass A.2 retest; not final milestone approval.

# 29. AI Development Notes

- Boolean results use `custom_freeform` as a rendering carrier but are not true authored freeforms.
- `booleanOperandIds?.length` is the current marker eligibility boundary for normal Boolean result exclusion.
- `deriveBooleanGeometry` returns current world/local contours; do not read persisted `booleanContours` for live selection when operands are valid.
- Bounds may flatten all points, but render paths must retain separate contours/rings and even-odd fill semantics.
- Empty derived Boolean results should not use generic missing-geometry bounds for a transform frame.
- Operand editing remains the supported direct authored geometry workflow.
- `getScreenCTM().inverse()` remains the browser pointer conversion authority from A.1.
- `Track.channels`, `evaluateFrame`, and `evaluateTransform` remain the animation authorities.
- Useful tests: `booleanGeometry.test.ts`, `bounds.test.ts`, `selectionGizmo.test.tsx`, `viewportMath.test.ts`, `outlinerPanel.test.tsx`, and `e2e/v51-manual-qa.spec.ts`.
- Useful browser reproduction: seed overlapping Triangle + Rhombus → Union → select parent → switch Exclude/Intersect/Subtract/Union → compare path/frame bounds → assert zero marker nodes → enter/exit Edit Operands.

## DO NOT CHANGE CASUALLY

- Do not expose generated Boolean clipping vertices as if they were authored path nodes.
- Do not solve multi-contour bounds by selecting only `points` or the first contour.
- Do not flatten holes into render geometry.
- Do not use persisted Boolean result contours as current-frame selection truth.
- Do not add a second Boolean evaluator for selection or marquee.
- Do not apply the parent transform twice.
- Do not remove true Free Draw markers globally.
- Do not add a static selection/marquee offset.
- Do not convert transient operand editing into persisted SceneData.
- Do not hide runtime errors with broad fallbacks or `try/catch`.
- Do not broaden Pass A.2 into the deferred QA categories or full regression.

# 30. Lessons Learned

- A renderer carrier type is not automatically an editing affordance; Boolean results and authored freeforms can share `custom_freeform` while requiring different UX.
- Multi-contour geometry needs two explicit consumers: topology-preserving rendering and point-complete bounds.
- Current-frame derived geometry must be shared across render, selection, and marquee to prevent intermittent offset symptoms.
- Empty geometry is a valid operation result and should not silently fall through to a generic visible-object fallback.
- Focused E2E assertions should test overlay absence as well as result presence.
- User-friendly object selection is safer than exposing generated topology that the product cannot edit.
