# KCS Development Report — V5.1 Manual QA Fix Pass A

Metadata:
- Date: 2026-08-29
- Milestone: KCS V5.1 — Manual QA Fix Pass A
- Branch: `main`
- Starting HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Ending HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Commit status: Uncommitted intentional QA changes; commit prohibited by the milestone scope
- Report number: `001`

# 1. Executive Summary

Pass A addressed the first manual QA batch for selection geometry and Boolean interaction/UX. The work replaced nominal symmetric selection bounds with canonical local geometry bounds, established Boolean operands as transform children of their Boolean parent, added transient operand editing mode, normalized closed polygon rings for vertex markers, made Boolean names distinguishable, moved Shape Operations into the Edit workflow, and added focused regression coverage.

The user-visible goals were tighter selection frames for asymmetric shapes, coherent parent movement, safe and explicit operand editing, reliable marquee cleanup, readable vertex labels, and a more professional Boolean Outliner/Inspector workflow. The architectural impact is concentrated in the existing SVG renderer, pure transform/bounds utilities, `useSelection`, `AnimatorContext`, and Inspector orchestration. No new animation clock, serializer, store, or rendering engine was introduced.

Completion state: implementation and focused verification completed; ready for User QA Pass A retest. Full regression and the remaining V5.1 QA categories were intentionally not run.

# 2. Original Objectives

Original task: fix manual QA failures from V5.1 tests 1–7 without reimplementing the milestone or starting the remaining QA batches.

In scope:

- Tight selection geometry for Triangle, Star, Rectangle/Square, Rhombus, and Parallelogram.
- Boolean naming, hierarchy movement, operand editing, operation switching, dissolve preservation, selection/marquee cleanup, vertex numbering, and focused Inspector/Outliner UX.
- Explicit coordinate-space audit across rendering, evaluation, bounds, dragging, Inspector edits, and marquee selection.
- Focused TypeScript, Vitest, E2E, and browser verification.

Out of scope:

- Mask/Track Matte QA or implementation.
- Color picker QA or implementation.
- Reset View, Rename, Export, timeline, responsive, and final visual QA.
- Full Vitest, full Playwright, production build, lint, commit, and push.

Explicit exclusions were preserved. No unrelated roadmap item was started.

# 3. Problems Discovered

## 3.1 Asymmetric polygon selection bounds

- Symptom: Triangle and Star selection frames contained visible empty space below the rendered geometry.
- Reproduction: Select Triangle or Star at editor zoom levels including 30%, 50%, 100%, and 150%+.
- Root cause: `getPartBounds` used `max(abs(point))`, forcing a symmetric box around the transform origin instead of using the geometry's local `min/max` extents and visual center offset.
- Affected subsystem: `bounds`, `TransformGizmo`, selection, marquee, and hit testing.
- Severity: HIGH for editor precision.
- Status: FIXED for static polygons; focused bounds and gizmo tests pass.

## 3.2 Boolean names were indistinguishable

- Symptom: Multiple Boolean nodes displayed as `Boolean · Union`.
- Root cause: Boolean creation always used a fixed operation-only name and operation changes replaced the name unconditionally.
- Affected subsystem: Details Inspector and Outliner.
- Severity: MEDIUM UX.
- Status: FIXED with deterministic `Boolean N · Operation` names, custom-name preservation, and an operation badge.

## 3.3 Boolean parent movement split result and operands

- Symptom: Moving a Boolean result moved the displayed result while authored operands remained rooted at their previous transforms.
- Root cause: `booleanGroupId` only represented an Outliner relationship. `evaluateTransform` ignored it, while `StagePartLayers` separately applied a group transform to world-space Boolean contours.
- Affected subsystem: transform evaluation, Boolean rendering, drag, Inspector editing, dissolve, and animation composition.
- Severity: HIGH; this violated the visible parent-child model.
- Status: FIXED through a parent-local operand model and single transform application.

## 3.4 Operand canvas editing was unavailable or ambiguous

- Symptom: An operand could be selected and edited numerically but could not be directly dragged in an intentional mode.
- Root cause: Operands were hidden from the renderer and no transient editor mode existed.
- Affected subsystem: `useSelection`, `AnimatorContext`, `StagePartLayers`, `StageCanvas`, and Details Inspector.
- Severity: HIGH UX.
- Status: FIXED with `Edit Operands` / `Lock Operands`, Escape exit, visible status, and live recomputation.

## 3.5 Boolean bounds and marquee corruption

- Symptom: After Boolean interaction, selection/marquee visuals could become a giant cyan rectangle or leave stale rectangles.
- Root cause: Boolean contour coordinates could be treated as local while containing world coordinates; group bounds also used only a stale first contour/nominal symmetric extent.
- Affected subsystem: Boolean contour storage, selection bounds, marquee intersection, and transient canvas overlay state.
- Severity: HIGH visual correctness.
- Status: FIXED in the focused path by using local Boolean contours and transformed world AABBs. Marquee state remains transient and clears on pointer-up.

## 3.6 Missing first vertex label

- Symptom: A polygon appeared to show labels `2, 3, 4, 5` while label `1` was absent.
- Root cause: Closed polygon rings can repeat their first point. The final overlapping marker obscured the first marker; the underlying vertex was not necessarily missing.
- Affected subsystem: Boolean ring flattening, freeform rendering, and canvas vertex marker rendering.
- Severity: MEDIUM UX.
- Status: FIXED by normalizing a repeated closing vertex before marker/path consumption.

# 4. Files Created

## `src/tests/containerMath.test.ts`

- Purpose: Focused regression coverage for world-to-parent-local transform inversion.
- Responsibilities: Verifies translation, rotation, and scale inversion against the evaluator's parent composition order.
- Why it exists: The prior `containerMath` implementation was a stub, and Boolean operand editing now depends on a real inverse boundary.
- Dependencies: Vitest and the existing `Transform` type.
- Important notes: Test-only file; no runtime dependency or persisted state.

# 5. Files Modified

Every file below was intentionally modified for Pass A. The reporting-policy files created by the later reporting-policy task are administrative and are not part of this retrospective implementation scope.

- `e2e/v51-manual-qa.spec.ts` — Updated the existing Boolean UI assertion from the old floating `BOOLEAN RESULT` heading to the new `BOOLEAN` Edit-workflow heading. Behavioral impact: keeps the existing focused Boolean E2E aligned with the approved Inspector hierarchy. Risk: LOW.
- `src/components/Canvas/SelectionGizmo.tsx` — Uses precise local bounds for matte hit areas, hides locked Boolean operand gizmos, and shows a transform frame for Boolean freeform results. Risk: HIGH because it owns selection visuals and interaction hit areas.
- `src/components/Canvas/StageCanvas.tsx` — Passes transient operand-editing state, treats `booleanGroupId` as a parent during drag conversion, normalizes freeform marker rings, and forwards the mode to rendering. Risk: HIGH because it owns pointer, drag, marquee, and viewport boundaries.
- `src/components/Canvas/StagePartLayers.tsx` — Computes Boolean contours from evaluated operand transforms, converts them back to Boolean-parent-local space, and renders operands only in active operand-edit mode. Risk: HIGH because it owns evaluated SVG composition.
- `src/components/Canvas/overlays/TransformGizmo.tsx` — Draws selection rectangles and handles from actual local `min/max` geometry, including asymmetric offsets and stroke-aware extents. Risk: HIGH for scale/rotate affordances.
- `src/components/Canvas/renderers/parts/ShapePartRenderers.tsx` — Normalizes closed freeform/Boolean rings before building SVG paths. Risk: MEDIUM for polygon rendering and trim-path perimeter input.
- `src/components/Inspector/DetailsPanel.tsx` — Creates deterministic Boolean names, preserves custom names, stores local contours, exposes operand mode controls, converts current transforms during dissolve, and moves Boolean controls into Edit. Risk: HIGH because it orchestrates scene mutation/history boundaries.
- `src/components/Inspector/OutlinerPanel.tsx` — Preserves the existing tree while adding operation badges and exiting operand mode when selection leaves the active Boolean structure. Risk: MEDIUM UX/state synchronization.
- `src/components/Inspector/PropertyInspector.css` — Adds focused styling for operand mode status and operation badges. Risk: LOW.
- `src/components/Inspector/sections/TransformTab.tsx` — Adds an Edit-workflow content slot and suppresses the generic freeform vertex editor for Boolean groups. Risk: MEDIUM Inspector composition.
- `src/context/AnimatorContext.tsx` — Exposes transient Boolean operand editing state through the existing context; wires Escape exit and Inspector character-part access. Risk: HIGH because it is the application orchestration boundary.
- `src/hooks/useInspector.ts` — Converts Inspector world-space edits for parented/Boolean children into local transform patches before existing channel/base mutation. Risk: HIGH because it touches canonical animation channel writes.
- `src/hooks/useKeyboardShortcuts.ts` — Keeps existing Escape shape-cancel behavior and adds transient Boolean operand-mode exit. Risk: MEDIUM global keyboard behavior.
- `src/hooks/useSelection.ts` — Owns `booleanOperandEditingGroupId` as transient selection/editor state and clears it on deselection. Risk: MEDIUM selection state semantics.
- `src/utils/booleanGeometry.ts` — Adds world-to-local contour inversion, deterministic display-name helpers, and repeated-ring normalization at Boolean result flattening. Risk: HIGH geometry correctness.
- `src/utils/bounds.ts` — Adds precise local and world bounds APIs while retaining the legacy symmetric `getPartBounds` contract for existing scaling/hit callers. Risk: HIGH because bounds feed selection, marquee, and scaling.
- `src/utils/containerMath.ts` — Replaces the previous identity stub with the evaluator-compatible world-to-parent-local inverse. Risk: HIGH for all parented drag/Inspector edits.
- `src/utils/evaluateTransform.ts` — Includes `booleanGroupId` in the existing parent-child transform composition. Risk: HIGH animation/hierarchy behavior.
- `src/utils/freeform.ts` — Adds `normalizeClosedPoints` for repeated closing vertices. Risk: MEDIUM freeform/Boolean path and marker behavior.
- `src/utils/viewportMath.ts` — Uses precise transformed world bounds for marquee intersection. Risk: HIGH selection behavior.
- `src/tests/booleanGeometry.test.ts` — Adds deterministic naming and contour transform round-trip coverage while retaining existing Boolean operation/dissolve tests. Risk: LOW test-only.
- `src/tests/bounds.test.ts` — Adds Triangle/Star asymmetric extents, all-contour Boolean bounds, and transformed world-bound coverage. Risk: LOW test-only.
- `src/tests/evaluateFrame.test.ts` — Adds Boolean operand parent-transform evaluation coverage. Risk: LOW test-only.
- `src/tests/freeform.test.ts` — Adds repeated closing-vertex normalization coverage. Risk: LOW test-only.
- `src/tests/selectionGizmo.test.tsx` — Adds tight Triangle selection-frame coverage and retains aggregate-box regression coverage. Risk: LOW test-only.
- `src/tests/useInspector.test.ts` — Adds Boolean operand world-to-local Inspector coverage. Risk: LOW test-only.
- `src/tests/useSelection.test.ts` — Adds transient operand-mode lifecycle coverage. Risk: LOW test-only.

# 6. Architecture Overview

The pass extended existing authorities rather than adding parallel engines:

```text
Canvas pointer / Inspector input
          |
          v
StageCanvas --------------------> useInspector
    |                                  |
    |                                  v
    |                           canonical channels/baseTransform
    v
StagePartLayers
    |
    +--> evaluateFrame
    |       |
    |       +--> evaluateTransform
    |                |
    |                +--> parentId OR booleanGroupId
    |
    +--> computeBooleanContours(world operand transforms)
    |       |
    |       +--> inverseTransformBooleanContours(group transform)
    |               |
    |               v
    |          Boolean-parent-local SVG contours
    |
    +--> PartRenderer (group transform applied once)

SelectionGizmo / viewportMath
    |
    +--> bounds.getPartLocalBounds / getPartWorldBounds
```

`AnimatorContext` remains a thin composition layer. `useSelection` owns transient selection/editor state. `evaluateTransform` remains the canonical animation/hierarchy authority. `StagePartLayers` remains the SVG composition authority. `booleanGeometry` remains the polygon-clipping boundary.

# 7. Data Model Changes

## Authored/serialized state

No new persisted Boolean field was introduced. Existing `CharacterPart.booleanGroupId`, `booleanOperation`, `booleanOperandIds`, `booleanContours`, and `points` remain the serialized compatibility fields. Boolean operands remain authored `CharacterPart` records; their transforms are parent-local when attached to a Boolean group.

`booleanGroupId` now has runtime transform meaning in addition to its existing Outliner relationship meaning. The existing serializer already passes the field through, so no serializer schema rewrite was required.

## Derived/evaluated state

- Operand world transforms are derived by `evaluateTransform` from operand local transforms and the Boolean parent's evaluated transform.
- Boolean geometry is recomputed from current evaluated operand transforms by `computeBooleanContours`.
- Render contours are derived by converting evaluated world contours into the Boolean parent's local space before the parent SVG transform is applied.
- Precise local/world bounds are derived from canonical shape geometry, freeform points, or all Boolean contours.

## Transient editor/UI state

`booleanOperandEditingGroupId` is owned by `useSelection` and exposed by `AnimatorContext`. It is not scene data, is not serialized, and is cleared on deselection or Escape.

# 8. Coordinate Space Model

- Object-local: canonical points from `shapeGeometry`, authored freeform points, and Boolean contours stored relative to the Boolean parent.
- Boolean-parent-local: operand `baseTransform` values while `booleanGroupId` is set; Boolean result contours consumed by the group's inner SVG renderer.
- World/canvas: evaluated transforms and the world-space polygons passed into `polygon-clipping`. The editor camera center is added when converting to SVG canvas coordinates.
- Viewport/screen: browser client coordinates converted by `StageCanvas.clientToSVG`, including camera zoom/pan and aspect-fit scaling.

Conversion boundaries:

1. Static shape geometry is generated in object-local space.
2. `evaluateTransform` composes operand parent-local transforms with the Boolean parent's world transform.
3. `computeBooleanContours` consumes world operand transforms and returns world contours.
4. `inverseTransformBooleanContours` converts world result contours into Boolean-parent-local space.
5. `PartRenderer` applies the evaluated Boolean parent transform exactly once.
6. `getPartWorldBounds` transforms local bounds corners to world/canvas coordinates for marquee intersection.
7. Canvas dragging starts with evaluated world transforms, then `worldToContainerLocal` writes local transform deltas for parented/Boolean children.
8. Inspector values display evaluated world transforms and are converted back to local values before existing base/channel mutation.

Invariants:

- Render geometry, selection bounds, marquee bounds, and hit testing use the same local geometry source.
- A Boolean parent transform must not be applied both to operands and to already-world result contours.
- Viewport zoom/pan is a screen interaction concern and never enters persisted geometry or matte/Boolean paths.
- Animation remains channel/track-owned; no Boolean-specific clock or keyframe model was added.

# 9. Component / Module Walkthrough

## `StageCanvas`

Owns pointer conversion, drag state, marquee state, and canvas overlays. It now recognizes Boolean parent relationships when converting drag results to local transforms. It passes `booleanOperandEditingGroupId` to both `StagePartLayers` and `SelectionGizmo`. Vertex markers consume normalized closed points.

## `StagePartLayers`

Consumes evaluated frame data. Boolean groups collect evaluated operand transforms, compute world polygon results, inverse-transform those results to group-local space, and render the parent with its normal transform. In operand-edit mode, children are rendered after the group so their direct pointer handlers are reachable; in locked mode, children remain hidden.

## `SelectionGizmo` and `TransformGizmo`

`TransformGizmo` renders local geometry bounds using `min/max` rather than a nominal symmetric box. `SelectionGizmo` uses the same precise local bounds for matte hit areas, suppresses locked operand gizmos, and displays Boolean parent frames.

## `DetailsPanel`

Remains the Boolean orchestration owner. It creates groups, switches operations, selects operands, toggles transient editing mode, dissolves groups, and exposes controls through the existing Edit tab rather than a separate top-level Inspector block.

## `OutlinerPanel`

Retains the existing recursive parent/child tree. Boolean parents use the existing group icon and children retain indentation/Operand labels. Operation badges make operation status discoverable even when a custom parent name is used.

## `AnimatorContext` and `useSelection`

Context composition exposes transient Boolean mode without persisting it. `useSelection` clears the mode on deselection. Global Escape handling exits the mode after shape-creation cancellation has had priority.

## Pure utilities

`bounds.ts`, `containerMath.ts`, `evaluateTransform.ts`, `freeform.ts`, `viewportMath.ts`, and `booleanGeometry.ts` hold deterministic geometry and transform logic. React components consume these authorities rather than duplicating formulas.

# 10. Important Code Changes

The transform hierarchy now recognizes the existing Boolean relationship:

```ts
const relationshipParentId = part?.parentId ?? part?.booleanGroupId;
```

Boolean rendering now computes world geometry and converts it to parent-local geometry before normal rendering applies the parent transform:

```ts
const contours = computeBooleanContours(group.booleanOperation, operands, transforms);
const groupTransform = evaluatedFrame.layers.find((layer) => layer.id === group.id)?.transform;
booleanContoursByGroup.set(
  group.id,
  groupTransform ? inverseTransformBooleanContours(contours, groupTransform) : contours,
);
```

Precise polygon bounds use actual local extrema:

```ts
offsetX: (minX + maxX) / 2,
offsetY: (minY + maxY) / 2,
```

A repeated closing ring point is removed before marker rendering:

```ts
if (Math.hypot(last.x - first.x, last.y - first.y) <= 1e-6) {
  return points.slice(0, -1);
}
```

# 11. Public Interfaces

- `PartLocalBounds`: exported local `min/max`, half extents, and geometry-center offset.
- `getPartLocalBounds(part, transform?)`: precise local geometry bounds with optional stroke-aware expansion.
- `PartWorldBounds`: exported world/canvas AABB shape.
- `getPartWorldBounds(part, transform, canvasCenterX, canvasCenterY)`: transforms local bounds corners into world/canvas coordinates.
- `inverseTransformBooleanContours(contours, transform)`: converts world Boolean contours into parent-local contours without mutation.
- `booleanOperationLabel(operation)`: stable human-readable operation label.
- `isGeneratedBooleanName(name)`: identifies generated Boolean display names.
- `createBooleanDisplayName(operation, existingParts, currentName?)`: deterministic display-name generator with custom-name preservation behavior.
- `worldToContainerLocal(world, parent)`: evaluator-compatible inverse transform conversion.
- `normalizeClosedPoints(points)`: removes a repeated closing point from a polygon ring.
- `useSelection` return value: adds `booleanOperandEditingGroupId` and `setBooleanOperandEditingGroupId` as transient editor state.
- `AnimatorContext`: exposes the same transient state and setter.
- `TransformTab`: adds optional `editWorkflowContent` composition content.
- `StagePartLayers`: adds optional `booleanOperandEditingGroupId` rendering control.
- `SelectionGizmo`: adds optional `booleanOperandEditingGroupId` visibility control.
- `useKeyboardShortcuts`: adds optional `exitBooleanOperandEditing` Escape callback.

These interfaces preserve existing callers through optional props/parameters where possible. They do not add persisted scene fields.

# 12. Algorithms and Geometry

## Precise bounds

Input: canonical static geometry, freeform points, or all Boolean contour points.

Steps:

1. Resolve geometry from `getShapeGeometry`, freeform points, or every Boolean contour.
2. Calculate local `minX`, `minY`, `maxX`, `maxY`.
3. Derive half extents and local visual-center offsets.
4. Expand only when a visible modern stroke requires it.
5. For world bounds, transform the four local corners using signed scale, rotation, and translation.

Complexity: O(n) in point count. Empty/invalid point arrays use the existing defensive fallback.

## Boolean transform model

Input: authored operand-local transforms, evaluated parent transform, Boolean operation.

Steps:

1. Evaluate operands through the canonical frame/transform pipeline.
2. Convert each operand to a world polygon.
3. Run `polygon-clipping` for Union, Subtract, Intersect, or Exclude.
4. Convert result contours from world to Boolean-parent-local coordinates.
5. Render with the parent transform once.

The model preserves operand relative offsets under parent movement. Operation order remains significant for Subtract and deterministic for the existing operand ID order.

## Marquee

Input: viewport-converted marquee rectangle and evaluated part transforms.

Steps:

1. Resolve precise local bounds.
2. Transform all four corners to world/canvas space.
3. Intersect the world AABB with the marquee rectangle.
4. Clear the transient rectangle during pointer-up.

This avoids treating world-valued Boolean points as local nominal geometry.

## Ring normalization

A ring is treated as closed by SVG/path semantics. If the final point equals the first within `1e-6`, the duplicate is removed. This prevents overlapping markers and misleading vertex counts without changing the visible closed path.

# 13. Interaction / UX Behavior

## Selection bounds

- BEFORE: Triangle and Star frames were nominal and visually loose.
- AFTER: Frames follow actual local extrema and preserve asymmetric offsets.
- EXPECTED WORKFLOW: Select Rectangle, Square, Triangle, Star, Rhombus, or Parallelogram at multiple zoom levels; the frame should track the visible geometry.

## Boolean parent

- BEFORE: Result moved independently from authored operand transforms.
- AFTER: Boolean parent movement propagates through evaluator hierarchy; relative operand offsets stay unchanged.
- EXPECTED WORKFLOW: Select Boolean parent, drag it, inspect the hierarchy, enter operand editing only when direct child movement is intended.

## Operand mode

- BEFORE: Operand canvas editing was not explicit.
- AFTER: Default `Edit Operands` control is locked; active mode exposes children and a visible status. Escape exits.
- EXPECTED WORKFLOW: Select Boolean → click `Edit Operands` → drag a child → observe live result → click `Lock Operands` or press Escape.

## Inspector workflow

- BEFORE: Shape Operations floated above Edit.
- AFTER: Boolean creation/editing controls live inside the Edit property workflow.
- EXPECTED WORKFLOW: Select two eligible shapes for creation, or select an existing Boolean/operand for operation, mode, operand, and dissolve controls.

## Outliner

- BEFORE: Generated Boolean names were repeated and operation status was embedded only in the name.
- AFTER: Names are deterministic and operation badges remain visible; existing parent/child hierarchy is preserved.

# 14. Design Decisions

## Parent-local operands

- Decision: Treat `booleanGroupId` as the Boolean parent relationship in transform evaluation.
- Reason: It matches the Outliner hierarchy and makes parent movement a normal existing transform composition.
- Alternatives: Visually offset only the rendered result; update every operand independently during drag; add a second Boolean transform engine.
- Trade-offs: Existing Boolean transforms become part of hierarchy evaluation and require careful renderer contour conversion.
- Future implications: Any nested Boolean or dissolve work must preserve this parent-local contract.

## Precise bounds API without removing legacy symmetric API

- Decision: Add `getPartLocalBounds` and `getPartWorldBounds`; retain `getPartBounds` for existing symmetric callers.
- Reason: Limits unrelated scaling/hit-test behavior changes while enabling tight selection/marquee geometry.
- Alternatives: Change the return shape of `getPartBounds` everywhere.
- Trade-offs: Two related APIs require documentation and future callers must choose deliberately.

## Transient operand mode

- Decision: Store mode in `useSelection`, not SceneData.
- Reason: It is an editor interaction mode, not document semantics.
- Alternatives: Persist a Boolean lock flag; place local component state in DetailsPanel.
- Trade-offs: Canvas and Inspector need context wiring, but mode remains correctly non-persistent.

## Operation badge plus custom-name preservation

- Decision: Keep user names stable and show operation separately.
- Reason: Custom names are user-authored identity; operation is derived Boolean status.
- Alternatives: Always rewrite names on operation changes or remove operation from display names.
- Trade-offs: Outliner rows contain one additional compact badge.

# 15. Invariants That Must Be Preserved

- `evaluateTransform` remains the canonical transform and hierarchy evaluator.
- `Track.channels` remains the canonical animation representation; no Boolean-specific animation representation exists.
- Boolean operations consume evaluated operand geometry and remain frame-aware.
- Boolean operands remain authored parts; the result is non-destructive.
- Boolean parent transforms are applied exactly once.
- Parent-local values must be converted explicitly at Canvas/Inspector world-to-local boundaries.
- `shapeGeometry` remains the static shape geometry authority.
- `buildFreeformPath`/freeform points remain the freeform geometry authority.
- Marquee state is transient and must clear on pointer-up/cancel/deselection.
- Operand editing mode is transient and must not enter serialized SceneData.
- Existing history batching remains the one-logical-action boundary.
- Existing serializer compatibility fields must remain pass-through compatible.
- No automatic snap/alignment behavior may be reintroduced.
- SVG remains the renderer/compositor; no Canvas/Pixi/Fabric parallel renderer.

# 16. Testing and Verification

## TypeScript

- Command: `npx tsc --noEmit`
- Result: PASS.

## Vitest/unit

- Final command:

```text
npx vitest run src/tests/booleanGeometry.test.ts src/tests/useSelection.test.ts src/tests/selectionGizmo.test.tsx src/tests/styleAppearanceSection.test.tsx src/tests/styleMatteSection.test.tsx src/tests/inlineRename.test.tsx src/tests/confirmationDialog.test.tsx src/tests/viewportMath.test.ts src/tests/bounds.test.ts src/tests/freeform.test.ts src/tests/containerMath.test.ts src/tests/evaluateFrame.test.ts src/tests/useInspector.test.ts src/tests/useKeyboardShortcuts.test.ts
```

- Result: 14 test files passed, 275 tests passed.
- Focus included Boolean geometry/naming, selection state, selection gizmo, precise bounds, freeform ring normalization, transform inversion, hierarchy evaluation, Inspector conversion, viewport marquee, and preserved appearance/matte/rename/modal/viewport tests.

## Playwright/E2E

- Initial attempt: `npx playwright test e2e/v51-manual-qa.spec.ts -g "supports Boolean creation"` did not start because the already-running frontend was considered in use by the configured web server while the environment had CI semantics enabled.
- Final command: `CI= npx playwright test e2e/v51-manual-qa.spec.ts -g "supports Boolean creation"`
- Result: PASS, 1 test passed.
- Scenario: Boolean creation, hierarchy, operand inspection, and dissolve preservation.

## Manual browser verification

Using the running Vite app at `http://localhost:5173`:

- Triangle selection frame inspected against rendered path geometry.
- Boolean parent dragged; result transform changed coherently.
- `Edit Operands` entered; operand layers became visible and direct operand drag recomputed the Boolean path.
- `Escape` exited operand mode and hid operand render layers.
- Marquee rectangle was present during drag and absent after pointer-up.
- Boolean parent naming and Outliner operation badge were inspected.
- Boolean controls were confirmed inside `.details-body` / Edit workflow.
- Boolean vertex labels showed `1`, `2`, `3`, `4` in the inspected result.
- Browser bootstrap and interaction error capture showed no remaining runtime errors after fixes.

## Git validation

- `git diff --check`: PASS.
- Final working tree: intentionally dirty with Pass A implementation/test changes; no staged changes, no commit, no push.
- Full Vitest, full Playwright, build, and lint were not run by scope.

# 17. Manual QA Results

- Selection geometry: PASS for Triangle in browser and static/pure bounds coverage; Star covered by focused geometry tests and implementation, direct browser retest remains for the user.
- Rectangle/Square regression: PASS in existing bounds/gizmo coverage.
- Rhombus/Parallelogram geometry path: PASS through shared canonical geometry path and existing selection coverage.
- Multi-selection behavior: PASS preserved by existing focused coverage; no permanent aggregate box remains.
- Boolean Union/Subtract/Intersect/Exclude: PASS preserved by existing Boolean coverage and focused E2E.
- Boolean operation switching: PASS in existing utility/UI path.
- Boolean parent movement: PASS in browser spot check; full user retest including undo/redo remains required.
- Operand edit mode: PASS in browser spot check.
- Locked operand mode: PASS by render/selection guard path; full user retest remains required.
- Marquee cleanup: PASS in browser spot check and transformed-bounds coverage.
- Vertex numbering: PASS in browser spot check and normalization test.
- Generated Boolean naming: PASS in browser spot check and deterministic naming test.
- Inspector Edit placement: PASS in browser spot check and focused E2E-compatible assertion update.
- Undo/redo after every Boolean movement/edit sequence: PARTIAL — existing batch history was preserved, but this exact manual sequence was not separately executed in Pass A browser verification.
- Dissolve after parent movement: PARTIAL — current-frame world-transform baking is implemented; the exact post-movement browser sequence was not separately executed.
- Mask, Color, Reset View, Rename, destructive modal, timeline, Export, responsive, and final visual QA: NOT TESTED by explicit scope.

# 18. Regression Risk Assessment

- Transform evaluation and Boolean rendering: HIGH. `booleanGroupId` now participates in hierarchy evaluation and must not be double-applied in any future renderer path.
- Animation channels and parent transforms: HIGH. Animated operands and animated Boolean parents must continue using the existing channel evaluator.
- Dissolve with animated operand tracks: HIGH/known limitation. Current dissolve baking preserves the evaluated current-frame world pose; future work must explicitly preserve animated trajectories when dissolving animated parent/operand combinations.
- Selection/marquee bounds: MEDIUM-HIGH. New precise bounds are safer for geometry but have two APIs; future callers must choose local vs world intentionally.
- Inspector parent-child editing: MEDIUM-HIGH. `useInspector` now converts world values for parent-local children while preserving root behavior.
- Serialization compatibility: MEDIUM. Existing fields remain unchanged, but persisted legacy Boolean contour data and dynamic operand edits require future reload/parity coverage.
- CSS/Outliner polish: LOW.

# 19. Performance Considerations

- Boolean contours are recomputed during `StagePartLayers` evaluation as before; the pass adds an O(n) world-to-local contour pass.
- Precise bounds are O(n) in geometry point count and world AABB conversion uses four corners.
- Marquee intersection now performs explicit corner transforms rather than only scalar extents.
- Operand mode renders additional child layers only while active.
- No new requestAnimationFrame loop, timer, cache, serializer, or React store was added.
- No benchmark was executed; no unsupported performance claim is made.

# 20. Dependencies

No dependency changes. Existing `polygon-clipping` remains the Boolean geometry dependency. No package was installed or version changed during Pass A.

# 21. Compatibility

- React: Existing Context/Hook/TSX architecture preserved.
- TypeScript: `npx tsc --noEmit` passed.
- Vite: Browser app loaded and HMR served the changed modules.
- Node: Focused tests ran under the existing local Node/npm environment.
- Browser: Chromium browser spot checks passed for the changed interactions.
- Windows: The frontend was served on the existing Windows development environment.
- Serialization: No new persisted fields; existing Boolean fields remain pass-through. Dynamic/local contour semantics require future import/reload parity coverage.
- Saved projects: Existing root-level parts remain unchanged; attached Boolean operands now evaluate through their existing `booleanGroupId` relationship.
- Warnings: Git emitted normal LF-to-CRLF working-copy warnings for several edited files; `git diff --check` still passed. The initial Playwright invocation encountered the configured existing-server/CI environment condition; the local `CI=` retry passed.

# 22. Known Limitations

- The user still needs to perform the complete Pass A manual retest at all requested zoom levels and interaction sequences.
- Full regression, build, and lint were intentionally not run.
- The exact post-parent-movement undo/redo and dissolve browser sequences were not separately captured.
- Dissolve currently bakes current evaluated operand world transforms; preserving a fully animated parent/operand trajectory through dissolve needs a dedicated approved design and regression suite.
- Nested/multiple Boolean groups were not introduced or comprehensively tested.
- Persisted legacy Boolean contour data and reload parity after operand edits need dedicated future coverage.
- The existing application has broader deferred matte, timeline, export, and responsive QA outside this pass.

# 23. Technical Debt

- Add a single dynamic Boolean local-contour/bounds authority for selection as well as rendering; avoid relying on stale persisted result contours for editor bounds after operand edits.
- Add focused component tests for `DetailsPanel`, `StagePartLayers`, and Boolean operand mode rather than relying primarily on pure utilities and one existing E2E.
- Define and test animated dissolve baking semantics before expanding dissolve support.
- Consider a shared relationship-parent helper to avoid repeating `parentId ?? booleanGroupId` at call sites.

# 24. Git Summary

- Branch: `main`
- Starting HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Ending HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- origin/main: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Ahead/behind: `0/0`
- Working tree: Intentionally dirty with Pass A changes; no staged changes; one new focused test file.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.
- Changed Pass A files: `e2e/v51-manual-qa.spec.ts`; `src/components/Canvas/SelectionGizmo.tsx`; `src/components/Canvas/StageCanvas.tsx`; `src/components/Canvas/StagePartLayers.tsx`; `src/components/Canvas/overlays/TransformGizmo.tsx`; `src/components/Canvas/renderers/parts/ShapePartRenderers.tsx`; `src/components/Inspector/DetailsPanel.tsx`; `src/components/Inspector/OutlinerPanel.tsx`; `src/components/Inspector/PropertyInspector.css`; `src/components/Inspector/sections/TransformTab.tsx`; `src/context/AnimatorContext.tsx`; `src/hooks/useInspector.ts`; `src/hooks/useKeyboardShortcuts.ts`; `src/hooks/useSelection.ts`; `src/tests/booleanGeometry.test.ts`; `src/tests/bounds.test.ts`; `src/tests/evaluateFrame.test.ts`; `src/tests/freeform.test.ts`; `src/tests/selectionGizmo.test.tsx`; `src/tests/useInspector.test.ts`; `src/tests/useSelection.test.ts`; `src/utils/booleanGeometry.ts`; `src/utils/bounds.ts`; `src/utils/containerMath.ts`; `src/utils/evaluateTransform.ts`; `src/utils/freeform.ts`; `src/utils/viewportMath.ts`; `src/tests/containerMath.test.ts`.

# 25. Updated Project Tree

Relevant Pass A tree:

```text
src/
├── components/
│   ├── Canvas/
│   │   ├── SelectionGizmo.tsx [changed]
│   │   ├── StageCanvas.tsx [changed]
│   │   ├── StagePartLayers.tsx [changed]
│   │   ├── overlays/TransformGizmo.tsx [changed]
│   │   └── renderers/parts/ShapePartRenderers.tsx [changed]
│   └── Inspector/
│       ├── DetailsPanel.tsx [changed]
│       ├── OutlinerPanel.tsx [changed]
│       ├── PropertyInspector.css [changed]
│       └── sections/TransformTab.tsx [changed]
├── context/AnimatorContext.tsx [changed]
├── hooks/
│   ├── useInspector.ts [changed]
│   ├── useKeyboardShortcuts.ts [changed]
│   └── useSelection.ts [changed]
├── tests/
│   ├── booleanGeometry.test.ts [changed]
│   ├── bounds.test.ts [changed]
│   ├── containerMath.test.ts [new]
│   ├── evaluateFrame.test.ts [changed]
│   ├── freeform.test.ts [changed]
│   ├── selectionGizmo.test.tsx [changed]
│   ├── useInspector.test.ts [changed]
│   └── useSelection.test.ts [changed]
└── utils/
    ├── booleanGeometry.ts [changed]
    ├── bounds.ts [changed]
    ├── containerMath.ts [changed]
    ├── evaluateTransform.ts [changed]
    ├── freeform.ts [changed]
    └── viewportMath.ts [changed]

e2e/
└── v51-manual-qa.spec.ts [changed]
```

# 26. Self Review

What is good:

- The critical Boolean movement issue was addressed at the transform authority instead of by a render-only offset.
- Geometry bounds now have an explicit local/world distinction.
- Operand edit mode is transient and user-visible rather than hidden developer state.
- Existing renderer, evaluator, history, serialization, and polygon-clipping authorities were reused.
- Focused verification is broad for the approved Pass A scope and includes browser evidence.

What could improve:

- More component-level tests should directly exercise `DetailsPanel` and `StagePartLayers` state/render transitions.
- Dynamic Boolean contours and selection bounds should share one derived contour authority to remove stale persisted-contour risk.
- Animated dissolve semantics need a deliberate design rather than current-frame baking.
- The implementation touched several high-risk files and should receive full regression before milestone approval.

Uncertainty:

- Full reload parity for Boolean operand edits and animated dissolve was not run.
- Star was covered by pure geometry tests but not separately selected in the browser spot check.

Score: 7/10. The critical coordinate-space and UX failures are addressed with passing focused checks, but high-risk hierarchy changes and unrun full regression/reload scenarios prevent a higher score.

# 27. Next Recommended Task

Perform the complete manual QA Pass A retest, including Star at all requested zoom levels and Boolean parent movement → undo/redo → dissolve/reload scenarios.

# 28. Project Status

- Current milestone: V5.1 Manual QA Fix Pass A.
- Completed work: Selection geometry correction, Boolean parent/local transform model, operand editing mode, Boolean selection/marquee fixes, vertex normalization, naming, Outliner/Inspector UX, and focused verification.
- Remaining milestone work: User manual Pass A retest; then separate Mask, Color, Reset View, Rename, destructive modal, timeline, Export, responsive, and final visual QA batches.
- QA stage: Ready for User QA Pass A retest; not final milestone approval.

# 29. AI Development Notes

- `booleanGroupId` is both the Outliner relationship and the runtime transform-parent relationship after Pass A.
- Operand authored transforms are parent-local; `getComputedTransform` returns world/canvas transforms.
- Boolean polygon clipping consumes evaluated world operand transforms.
- Boolean result contours must be converted back to parent-local space before normal SVG group transforms are applied.
- `worldToContainerLocal` is the explicit inverse boundary for Canvas/Inspector edits.
- `booleanOperandEditingGroupId` is transient editor state and must never be serialized.
- `shapeGeometry` and freeform points are geometry authorities; do not add per-shape offsets.
- Marquee rectangles are transient overlays and must disappear on pointer-up/cancel.
- `Track.channels` remains canonical for animation; no Boolean keyframe fields were added.
- Existing Boolean operation order and operand identity must remain stable.
- Useful tests: `src/tests/booleanGeometry.test.ts`, `bounds.test.ts`, `containerMath.test.ts`, `evaluateFrame.test.ts`, `selectionGizmo.test.tsx`, `useInspector.test.ts`, and `e2e/v51-manual-qa.spec.ts`.
- Useful browser reproduction: create two eligible shapes → additive select → Union → move parent → enter `Edit Operands` → drag one operand → Escape → marquee across empty canvas → inspect labels and Outliner operation badge.
- Do not run full regression or remaining QA categories as part of this Pass A report task.

## DO NOT CHANGE CASUALLY

- Do not apply a render-only offset to hide a Boolean parent/operand transform bug.
- Do not apply the Boolean parent transform twice.
- Do not treat world-space Boolean contours as parent-local points.
- Do not bypass `evaluateTransform`, `evaluateFrame`, or canonical channels with a new Boolean animation evaluator.
- Do not persist operand editing mode as document state without an approved product decision.
- Do not replace canonical shape/freeform geometry with nominal or per-shape selection offsets.
- Do not reintroduce automatic snap/alignment behavior or the removed Inspector alignment block.
- Do not make marquee state persistent or leave it rendered after pointer-up.
- Do not rewrite the existing renderer/compositor or add a Canvas/Pixi/Fabric parallel path.
- Do not remove legacy serialization fields or compatibility fallbacks without import/export evidence and approval.
- Do not broaden this milestone into Mask, Color, Reset View, Rename, Export, responsive, or final regression work.

# 30. Lessons Learned

- Coordinate-space bugs often appear simultaneously as rendering, selection, marquee, and Inspector failures; fixing each symptom independently would have created inconsistent behavior.
- The existing Outliner hierarchy was a strong signal for the correct Boolean transform model: relationship metadata should be reflected by the canonical evaluator when the product presents a parent-child structure.
- Asymmetric geometry needs min/max bounds and an explicit visual-center offset; symmetric half-extents are insufficient for selection UX.
- Closed polygon data must be normalized before drawing UI markers; duplicate closing points can look like missing indices even when geometry is correct.
- Transient editing modes belong in the selection/editor domain, not in serialized scene data.
- Operation status and user-authored identity are separate concerns; a compact Outliner badge avoids renaming custom objects.
- Focused tests should cover pure coordinate contracts first, then component state/render boundaries, then browser interaction. Full regression remains necessary after high-risk evaluator changes.
- Permanent development reports should capture these contracts before context is lost; future work should read this report and the canonical reporting policy before touching Boolean, selection, or transform code.
