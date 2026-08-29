# KCS Development Report — V5.1 Manual QA Fix Pass A.1

Metadata:
- Date: 2026-08-29
- Milestone: KCS V5.1 — Manual QA Fix Pass A.1
- Branch: `main`
- Starting HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Ending HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Commit status: Uncommitted intentional Pass A and Pass A.1 changes; commit prohibited
- Report number: `002`

# 1. Executive Summary

Pass A.1 is a focused remediation pass after the V5.1 Manual QA Pass A retest. It fixes the real Parallelogram creation crash, removes zoom-dependent marquee pointer drift, makes live Boolean selection bounds use the same current-frame derived geometry as rendering, and replaces arbitrary numeric Boolean names with compact operand-derived names.

The crash was reproduced in Chromium with the exact exception `ReferenceError: ParallelogramIcon is not defined`. The root cause was an accidentally missing import in `OutlinerPanel.tsx`; the Parallelogram branch referenced the existing exported icon without importing it. The fix restores that import and adds a focused E2E draw regression.

The marquee issue was a coordinate-space bug in the manual fallback conversion: pan was divided by aspect scale but not by zoom. The primary browser path now uses `SVGSVGElement.getScreenCTM().inverse()` so browser client coordinates map through the actual SVG/CSS transform, aspect-fit, zoom, and pan matrix. The pure fallback was corrected to the same order and is unit tested.

The intermittent Boolean frame offset was traced to stale persisted `booleanContours` being used by selection/marquee bounds while `StagePartLayers` recomputed current-frame geometry for rendering. A shared `deriveBooleanGeometry` authority now produces world and parent-local contours. Renderer, selection gizmo, and marquee derive current geometry from evaluated operands instead of treating persisted result contours as live editor state.

Completion state: focused implementation, unit tests, focused Chromium/E2E, and browser spot checks passed. The user must perform the requested Pass A.1 manual retest. Mask, Color, Reset View, Rename, Timeline, Export, responsive QA, and full regression remain out of scope.

# 2. Original Objectives

Original task: remediate only the remaining Pass A retest failures.

In scope:

- Reproduce and fix Parallelogram creation crash.
- Correct exact marquee pointer alignment across zoom, pan, and aspect-fit.
- Unify current-frame Boolean derived geometry for rendering, selection, and marquee.
- Replace arbitrary numeric Boolean names with deterministic operand-derived names.
- Preserve all Pass A transform, operand editing, animation, hierarchy, dissolve, and Inspector behavior.
- Add focused tests, focused browser/E2E verification, and `reports/progress_002.md`.

Out of scope:

- Mask, Color, Reset View, Rename, Timeline, Export, responsive QA, final visual polish, and final full regression.
- SceneData version changes or new persisted generated/custom-name flags.
- Commit, push, reset, restore, clean, stash, branch, merge, or rebase.

# 3. Problems Discovered

## 3.1 Parallelogram creation crash

- Symptom: Selecting or drawing a Parallelogram could unmount the React app; F5 restored it.
- Minimal reproduction: Open the Elements drawer, choose Parallelogram, or render a Parallelogram row after drawing one.
- Exact browser exception: `ReferenceError: ParallelogramIcon is not defined`.
- Stack location: `OutlinerPanel.tsx`, `getActorIcon`, the `custom_parallelogram` branch; the stack continued through `renderPartRows` and `OutlinerPanel`.
- Root cause: `OutlinerPanel.tsx` referenced `ParallelogramIcon` but the import from `../Toolbar/drawers/ElementsDrawer` had been lost during Pass A editing. `ElementsDrawer.tsx` still exported the icon.
- Affected subsystem: Outliner rendering and any Parallelogram scene mutation that caused the Outliner to rerender.
- Severity: P0 runtime crash.
- Status: FIXED. The existing export is imported; no hiding `try/catch` was added.

## 3.2 Marquee pointer offset

- Symptom: At zoom and pan values, the active marquee rectangle did not begin exactly under the pointer.
- Reproduction: Start a marquee at a known client point after zooming and panning; inspect `getBoundingClientRect()` while dragging.
- Root cause: The fallback formula applied `pan / scale` after dividing the coordinate delta by zoom. The CSS transform's pan must be removed before the zoom inverse, so the pan contribution is also divided by zoom. More importantly, hand-maintaining the CSS/SVG transform matrix duplicated browser layout knowledge.
- Affected subsystem: StageCanvas client-to-SVG conversion and marquee overlay.
- Severity: P0 interaction precision.
- Status: FIXED. `getScreenCTM().inverse()` is used in browsers; the corrected pure fallback is unit tested.

## 3.3 Intermittent Boolean selection frame offset

- Symptom: The visible Boolean result and cyan selection frame could appear in different canvas locations after operand edits, parent movement, operation changes, or selection transitions.
- Reproduction class: Rendered Boolean geometry was current-frame derived, while `SelectionGizmo` and `getPartsInMarquee` could read stored `booleanContours`/`points` from an earlier frame or operand arrangement.
- Root cause: Two live geometry authorities existed: `StagePartLayers` recomputed world contours, but bounds consumed persisted result contours. Parent-local/world conversion also occurred in separate consumers.
- Affected subsystem: Boolean rendering, selection bounds, marquee, operation switching, and operand-edit transitions.
- Severity: P0 visual correctness.
- Status: FIXED in the focused path with one `deriveBooleanGeometry` world/local derivation authority.

## 3.4 Numeric generated names

- Symptom: `Boolean 1 · Union` and `Boolean 2 · Union` were distinguishable but semantically opaque.
- Root cause: Naming used a generated counter rather than operand display names.
- Affected subsystem: Details Inspector and Outliner.
- Severity: MEDIUM UX.
- Status: FIXED with names such as `Team Shape + Logo Mask · Union`; operation badges remain visible.

# 4. Files Created

No new Pass A.1 production files were created.

`reports/progress_002.md` is the required permanent development report, not a runtime module. The focused regression test file `src/tests/containerMath.test.ts` was created during Pass A and remains part of the intentionally uncommitted baseline.

# 5. Files Modified

The following files received intentional Pass A.1 changes or were required to keep the accumulated Pass A behavior testable. Existing Pass A modifications remain preserved.

- `.omp/commands/milestone.md` — Existing workflow now references the canonical reporting policy and requires a sequential report at scope audit. Administrative only; no application behavior.
- `e2e/editor-interaction-regressions.spec.ts` — Adds a Chromium regression that draws a Parallelogram and asserts the app remains mounted with no page errors; updates the existing parallelogram selection assertion from a polygon frame to the current rect frame. Risk: LOW test-only.
- `e2e/v51-manual-qa.spec.ts` — Narrows Boolean operand tree assertions to nested rows after operand-derived parent names make parent and child labels both match. Risk: LOW test-only.
- `src/components/Canvas/SelectionGizmo.tsx` — Derives current Boolean local contours from evaluated operands before calculating selection bounds. Risk: HIGH selection/render consistency.
- `src/components/Canvas/StageCanvas.tsx` — Uses actual SVG screen CTM conversion, restores the camera `outputOrigin` binding required by the renderer, and prevents locked Boolean parents/operands from conflicting in marquee selection. Risk: HIGH pointer and viewport behavior.
- `src/components/Canvas/StagePartLayers.tsx` — Reuses `deriveBooleanGeometry` rather than maintaining separate world-to-local Boolean conversion logic. Risk: HIGH SVG composition.
- `src/components/Inspector/DetailsPanel.tsx` — Uses operand names when creating/updating generated Boolean names and reuses the shared derived-geometry authority during operation edits. Risk: HIGH scene/history orchestration.
- `src/components/Inspector/OutlinerPanel.tsx` — Restores the missing `ParallelogramIcon` import and retains operation badge/mode transition behavior. Risk: MEDIUM UI runtime.
- `src/utils/booleanGeometry.ts` — Adds `DerivedBooleanGeometry`, `deriveBooleanGeometry`, operand-derived naming, and generated-name detection for the new convention. Risk: HIGH geometry/name semantics.
- `src/utils/viewportMath.ts` — Adds pure `clientToSVGPoint`, corrects fallback pan/zoom order, and derives live Boolean contours for marquee bounds. Risk: HIGH coordinate/selection behavior.
- `src/tests/booleanGeometry.test.ts` — Covers operand-derived names, custom-name preservation, legacy numeric fallback, and world/local current geometry derivation.
- `src/tests/outlinerPanel.test.tsx` — Adds the missing Boolean icon context fields and a Parallelogram row render regression.
- `src/tests/selectionGizmo.test.tsx` — Covers selection bounds derived from current operands instead of stale persisted contours.
- `src/tests/viewportMath.test.ts` — Covers aspect-fit, zoom, and pan client-to-SVG inversion.

Earlier Pass A files remain intentionally modified and are documented in `reports/progress_001.md`.

# 6. Architecture Overview

The remediation removes the split live-geometry path:

```text
Authored operands + evaluated transforms + operation + parent transform
                               |
                               v
                    deriveBooleanGeometry()
                         /             \
            worldContours             localContours
                 |                         |
          world diagnostics       SVG renderer / bounds
                                         |
                  +----------------------+------------------+
                  |                      |                  |
             StagePartLayers       SelectionGizmo      getPartsInMarquee
```

Pointer conversion follows the browser's actual transform matrix:

```text
clientX/Y
   |
   v
stage-svg.getScreenCTM().inverse()
   |
   v
SVG viewBox coordinates
   |
   +--> marquee rectangle
   +--> shape creation / drag coordinates
```

Fallback environments without `getScreenCTM` use `clientToSVGPoint`, which applies aspect-fit letterboxing, pan inverse, and zoom inverse in the same order.

# 7. Data Model Changes

## Authored/serialized state

No new SceneData version or persisted field was introduced. Existing `booleanGroupId`, `booleanOperation`, `booleanOperandIds`, `booleanContours`, and `points` remain available for compatibility/export. Existing generated Boolean names may continue to be read through the legacy numeric recognition path.

The persisted `booleanContours` field is no longer treated as authoritative live editor geometry when operands and operation are available. It remains authored/serialized compatibility data and may be refreshed by an explicit operation mutation, but render/selection/marquee derive current geometry.

## Derived/evaluated state

`DerivedBooleanGeometry` contains:

- `worldContours`: current Boolean result from evaluated operand world transforms.
- `localContours`: the same result inverse-transformed into Boolean-parent-local space.

This object is derived per consumer invocation from existing canonical inputs. It is not persisted.

## Transient editor/UI state

`booleanOperandEditingGroupId` remains transient `useSelection` state. No generated/custom-name flag was added to SceneData. Generated-vs-custom classification remains minimally name-based because a schema change was not approved.

# 8. Coordinate Space Model

- Object-local: static shape geometry and operand-local point geometry.
- Boolean-parent-local: attached operand transforms and Boolean result contours consumed inside the parent's SVG transform.
- World/canvas: evaluated transforms and `worldContours` passed to polygon clipping.
- SVG viewBox: the user-coordinate space returned by inverse screen CTM; marquee rectangles are authored here.
- Viewport/screen: browser client coordinates, including CSS layout, preserveAspectRatio letterboxing, zoom, and pan.

The browser path now uses the actual `getScreenCTM()` matrix. This avoids assuming how the browser composes the SVG's `transform: translate(...) scale(...)`, transform origin, aspect-fit, and device-pixel layout.

The pure fallback computes:

```text
viewBox coordinate = aspect-fit inverse(client)
SVG coordinate = ((viewBox - center) - pan / aspectScale) / zoom + center
```

The pan term is inside the zoom inverse. This is the correction that removed the measured zoom-dependent marquee offset.

Boolean invariants:

1. `evaluateTransform` composes `parentId ?? booleanGroupId` and returns world transforms.
2. `computeBooleanContours` consumes evaluated world operand transforms.
3. `deriveBooleanGeometry` converts the result to parent-local space once.
4. `PartRenderer` applies the parent transform once.
5. Selection and marquee derive from the same current-frame result rather than persisted stale contours.
6. Viewport/screen conversion never enters persisted geometry or Boolean math.

# 9. Component / Module Walkthrough

## `OutlinerPanel`

`getActorIcon` already had a `custom_parallelogram` branch using the shared `ParallelogramIcon`. Pass A.1 restores its import from `ElementsDrawer`, eliminating the ReferenceError during Outliner rerender.

## `StageCanvas`

`clientToSVG` first queries the actual stage SVG's screen CTM and applies its inverse. The previous mathematical fallback remains for test/non-browser environments, now centralized in `clientToSVGPoint`. Marquee selection additionally filters hidden Boolean operands in locked mode and avoids selecting the Boolean parent while operand edit mode is active.

## `StagePartLayers`

For each Boolean group, it collects evaluated operand transforms and calls `deriveBooleanGeometry`. Only `localContours` are passed into the normal `PartRenderer` transform path.

## `SelectionGizmo`

`withCurrentBooleanGeometry` resolves the current operands and transforms, calls the shared authority, and supplies a synthetic part carrying current local contours to `getPartLocalBounds` and `TransformGizmo`. This prevents stored result geometry from moving the frame independently of the visible result.

## `DetailsPanel`

Boolean creation uses current operand display names. Operation changes keep custom names unchanged; generated names are rebuilt from current operand names and the new operation. Geometry mutation uses `deriveBooleanGeometry` for the same world/local contract used by rendering.

## `booleanGeometry`

The module remains the polygon-clipping authority. `deriveBooleanGeometry` is a thin composition around the existing `computeBooleanContours` and inverse transform, not a second evaluator.

## `viewportMath`

The new pure client conversion documents and tests fallback behavior. Marquee bounds derive current Boolean geometry before using `getPartWorldBounds`.

# 10. Important Code Changes

Current-frame Boolean geometry is now explicitly paired:

```ts
export interface DerivedBooleanGeometry {
  worldContours: BooleanContours;
  localContours: BooleanContours;
}

export const deriveBooleanGeometry = (
  operation: BooleanOperation,
  operands: CharacterPart[],
  operandTransforms: Record<string, Transform>,
  groupTransform: Transform,
): DerivedBooleanGeometry => {
  const worldContours = computeBooleanContours(operation, operands, operandTransforms);
  return {
    worldContours,
    localContours: inverseTransformBooleanContours(worldContours, groupTransform),
  };
};
```

Browser pointer conversion now respects actual browser layout:

```ts
const screenMatrix = svg?.getScreenCTM?.();
if (screenMatrix && typeof DOMPoint !== 'undefined') {
  const point = new DOMPoint(clientX, clientY).matrixTransform(screenMatrix.inverse());
  return { svgX: point.x, svgY: point.y };
}
```

Generated names now use operands:

```text
Team Shape + Logo Mask · Union
```

The operation remains separately visible as an Outliner badge, and a non-generated custom name is returned unchanged.

# 11. Public Interfaces

- `DerivedBooleanGeometry`: derived world/local contour pair; no side effects.
- `deriveBooleanGeometry(operation, operands, operandTransforms, groupTransform)`: returns current Boolean world and parent-local contours.
- `ClientToSVGPointInput`: pure fallback conversion input containing layout rect, client point, zoom, pan, and viewBox.
- `clientToSVGPoint(input)`: returns SVG viewBox coordinates; no side effects.
- `createBooleanDisplayName(operation, existingParts, currentName?, operandNames?)`: returns operand-derived generated name when names are supplied, preserves custom names, and retains legacy numeric fallback when needed.
- `isGeneratedBooleanName(name)`: recognizes legacy numeric and operand-derived generated forms.
- Existing `StagePartLayers`, `SelectionGizmo`, and `StageCanvas` props were extended only through existing transient/editor controls; no SceneData interface was expanded.

# 12. Algorithms and Geometry

## Derived Boolean geometry

Input: operation, eligible authored operands, evaluated world transforms, evaluated group transform.

1. Convert each operand's canonical local geometry to a world polygon.
2. Execute the existing polygon-clipping operation.
3. Keep the world result for diagnostics/consumers that need world geometry.
4. Inverse-transform each result point to group-local space.

Complexity remains O(n) around the polygon-clipping operation for contour conversion; polygon clipping complexity depends on input geometry and the library algorithm.

## Precise marquee bounds

Input: current-frame part and transform.

- For a Boolean group, derive current local contours from operands.
- Resolve all local bounds, including all contours.
- Transform four local bound corners into world/canvas AABB.
- Intersect with the SVG-space marquee rectangle.

Locked Boolean operands are excluded from normal marquee selection because they are not rendered as selectable canvas children. Active operand mode permits child selection through its group filter.

## Client conversion

Primary browsers use the inverse screen CTM, which includes preserveAspectRatio and CSS transform effects. The fallback is deterministic and tested for non-unit zoom, non-zero pan, and aspect-fit letterboxing.

# 13. Interaction / UX Behavior

## Parallelogram

- BEFORE: Choosing/drawing a Parallelogram could crash the application.
- AFTER: The existing shared icon renders correctly; repeated draw/re-render remains mounted.
- EXPECTED WORKFLOW: Elements → Parallelogram → draw repeatedly → select/resize/rotate without refresh.

## Marquee

- BEFORE: Active rectangle could begin offset from the pointer after zoom/pan.
- AFTER: Start and end corners follow the pointer through the actual SVG transform.
- EXPECTED WORKFLOW: Set zoom/pan → drag marquee → both visible corners meet the pointer; release clears the overlay.

## Boolean selection

- BEFORE: Render and selection could use different generations of Boolean geometry.
- AFTER: Renderer, selection, and marquee derive from current evaluated operands and group transform.
- EXPECTED WORKFLOW: Move parent, edit operand, switch operation, change frame, lock/unlock, and reselect; the frame remains around the visible result.

## Boolean names

- BEFORE: Numeric identity only: `Boolean 1 · Union`.
- AFTER: Operand identity plus operation: `Team Shape + Logo Mask · Union`; operation badge remains visible.
- EXPECTED WORKFLOW: Rename operands while generated, switch operation, then explicitly rename the Boolean; generated names follow the chosen contract and custom names remain stable.

# 14. Design Decisions

## Use screen CTM as browser authority

- Decision: Prefer `getScreenCTM().inverse()` over maintaining a second CSS/SVG transform formula.
- Reason: The browser owns preserveAspectRatio, transform origin, CSS transforms, layout, and device-pixel mapping.
- Alternatives: Add constant offsets; use element offsets; continue tuning manual zoom/pan math.
- Trade-off: Requires SVG/DOM support; a pure fallback remains for non-browser/test contexts.
- Future implication: Do not replace this with client-rect arithmetic without reproducing the complete transform matrix.

## One derived Boolean authority

- Decision: `deriveBooleanGeometry` returns world and parent-local contours.
- Reason: Selection and rendering must consume the same current-frame result.
- Alternatives: Mutate persisted contours on every interaction; duplicate selection-only Boolean evaluation; render-only compensation.
- Trade-off: Selection consumers perform current derivation during render; correctness wins over stale cache complexity.
- Future implication: Add memoization only with measured evidence and stable current-frame inputs.

## Operand-derived names without schema change

- Decision: Use `operand A + operand B · Operation` and retain minimal name-pattern detection.
- Reason: Gives semantic identity without random counters and avoids an unapproved SceneData version/flag.
- Alternatives: Persist `nameOrigin`; always recompute names; retain numeric names.
- Trade-off: A user-custom name that intentionally matches the generated pattern remains difficult to distinguish after reload.
- Future implication: If exact generated/custom identity becomes required, design a versioned or explicitly persisted authority rather than adding another parser.

# 15. Invariants That Must Be Preserved

- `booleanGroupId` remains a transform-parent relationship and Outliner relationship.
- Operand authored transforms remain Boolean-parent-local.
- `computeBooleanContours` consumes evaluated world transforms.
- `deriveBooleanGeometry` is the shared world/local contour authority.
- Boolean parent transform is applied exactly once.
- `worldToContainerLocal` is the direct-child inverse boundary.
- `Track.channels` and `evaluateFrame` remain animation authorities.
- Persisted Boolean contours are compatibility data, not a stale live selection authority.
- `getScreenCTM` mapping returns SVG user coordinates; do not add constant offsets.
- Marquee state clears on pointer-up/cancel.
- Operand edit mode remains transient and non-serialized.
- Canonical `shapeGeometry` and freeform geometry remain the geometry sources.
- No automatic snapping or removed alignment UI may return.
- SVG remains the renderer/compositor.

# 16. Testing and Verification

## TypeScript

- Command: `npx tsc --noEmit`
- Result: PASS.

## Vitest

- Command:

```text
npx vitest run src/tests/booleanGeometry.test.ts src/tests/bounds.test.ts src/tests/viewportMath.test.ts src/tests/selectionGizmo.test.tsx src/tests/outlinerPanel.test.tsx src/tests/useInspector.test.ts src/tests/evaluateFrame.test.ts src/tests/useSelection.test.ts src/tests/freeform.test.ts src/tests/containerMath.test.ts src/tests/useKeyboardShortcuts.test.ts src/tests/styleAppearanceSection.test.tsx src/tests/styleMatteSection.test.tsx src/tests/inlineRename.test.tsx src/tests/confirmationDialog.test.tsx
```

- Result: PASS, 15 files and 294 tests.
- Coverage: Boolean derived geometry and naming, bounds, viewport conversion, selection gizmo, Outliner icon/rendering, Inspector conversion, hierarchy evaluation, selection state, ring normalization, container inversion, keyboard behavior, and preserved focused appearance/matte/rename/modal tests.

## Playwright/E2E

- Command:

```text
CI= npx playwright test e2e/editor-interaction-regressions.spec.ts e2e/v51-manual-qa.spec.ts e2e/canvas-interaction-v1.spec.ts -g "Parallelogram|Boolean creation|marquee"
```

- Result: PASS, 4 tests.
- Scenarios: Parallelogram mirror/selection regression, Parallelogram drawing without page errors, Boolean hierarchy/dissolve, ordinary marquee selection.
- The E2E command used `CI=` because the existing local server and CI web-server behavior otherwise prevented reuse; this is an environment invocation detail, not a product workaround.

## Manual browser verification

- Parallelogram crash was reproduced before the import fix with the exact `ParallelogramIcon is not defined` stack and then reproduced after the fix with two draws, no page errors, and three Parallelogram rows present.
- Marquee was measured at zoom/pan values. Before the conversion correction, a test showed pointer drift; after the screen-CTM path, the active rectangle's rendered start/end corners matched the test pointer coordinates, and the rectangle disappeared on pointer-up.
- Boolean names were verified with `Team Shape` and `Logo Mask`, producing `Team Shape + Logo Mask · Union` and a separate `Union` operation badge.
- Boolean selection frame was measured against the rendered path before and during operand mode; frame and visible path shared the same browser bounds.
- Operand edit mode and Escape behavior remained functional during the Boolean checks.
- Browser bootstrap/runtime error capture was empty after the final fixes.

## Git validation

- Command: `git diff --check`
- Result: PASS. Git emitted normal LF-to-CRLF working-copy warnings for edited files; no whitespace error remained.
- Final Git inspection: branch `main`; HEAD and origin/main both `fe543aa64d4079a2923eec60659e748cfc360d4c`; ahead/behind `0/0`; intentional uncommitted Pass A/Pass A.1/reporting changes remain.

## Not run by scope

- Full Vitest.
- Full Playwright.
- Production build.
- Lint.
- Mask, Color, Reset View, Rename, Timeline, Export, responsive, and final visual QA.

# 17. Manual QA Results

- Parallelogram repeated draw/no crash: PASS in browser spot check and focused E2E.
- Parallelogram selection/resize path: PARTIAL — existing selection regression passed; full requested manual resize/rotate sequence remains for user retest.
- Marquee pointer at unit zoom: PASS.
- Marquee pointer after zoom/pan: PASS by measured browser bounds.
- Ordinary marquee selection semantics: PASS in focused E2E.
- Boolean current-frame selection alignment: PASS in browser measurement and shared-derivation test.
- Boolean parent movement and operand editing: PASS preserved from Pass A and rechecked during browser spot checks.
- Boolean operation switching: PASS by shared derivation path and existing focused coverage; full user sequence remains required.
- Operand-derived names: PASS in browser and unit tests.
- Custom Boolean name preservation: PASS in unit contract; full UI rename retest remains outside this batch.
- Multi-Boolean switching: PARTIAL — deterministic utility/current-derivation coverage exists; the full user-created multi-group browser sequence remains for retest.
- Undo/redo after all new transitions: PARTIAL — Pass A behavior was reported passing; Pass A.1 did not rerun every manual undo/redo sequence.
- Mask, Color, Reset View, Rename, modal, Timeline, Export, responsive, and final visual QA: NOT TESTED by explicit scope.

# 18. Regression Risk Assessment

- Parallelogram Outliner import: LOW after focused E2E; the fix restores an existing exported symbol.
- Client/SVG conversion: HIGH because Canvas creation, drag, marquee, and viewport interactions share this boundary. CTM browser coverage and fallback unit coverage reduce risk.
- Boolean derived geometry: HIGH because renderer, selection, marquee, animation frame, operation switching, and parent transforms converge here.
- Selection performance: MEDIUM because live Boolean derivation can run for selection consumers; no benchmark was executed.
- Generated/custom names: MEDIUM because name-origin identity remains pattern-based without a persisted flag.
- Saved-project compatibility: MEDIUM because legacy persisted contours remain readable but must not become live bounds authority.
- Existing Pass A animation/history: HIGH inherited risk; no alternate evaluator or history system was added, but full regression remains unrun.

# 19. Performance Considerations

- `StagePartLayers`, `SelectionGizmo`, and marquee bounds may derive current Boolean geometry during renders or interactions. This is proportional to operand contour complexity.
- The browser pointer path uses a matrix inverse per pointer conversion; this is a small constant operation and avoids repeated manual layout calculations.
- No new animation loop, timer, global store, serializer, or persistent cache was added.
- Operand layers render only in active operand-edit mode as established by Pass A.
- No performance benchmark or frame-time measurement was executed.

# 20. Dependencies

No dependency changes. Existing `polygon-clipping` remains the Boolean geometry dependency.

# 21. Compatibility

- React/TypeScript: Existing architecture preserved; `npx tsc --noEmit` passed.
- Vite/Chromium: Browser app loaded after fixes and focused E2E passed.
- Node/Windows: Commands ran in the existing Windows workspace.
- SVG: `getScreenCTM` is used only at the browser boundary; pure fallback remains available for tests/non-browser environments.
- Serialization: No version or field changes. Existing Boolean fields remain pass-through; derived geometry is runtime-only.
- Saved projects: Legacy numeric Boolean names remain recognized; operand-derived names are additive.
- Warnings: Git line-ending warnings and the `CI=` E2E invocation detail were observed and recorded. No product runtime error remained after the final browser check.

# 22. Known Limitations

- Full manual Pass A.1 retest is still required from the user at 30%, 50%, 100%, and 150%+ zoom, with pan and all requested Boolean transitions.
- Full regression/build/lint were not run.
- Generated/custom Boolean name distinction remains minimally pattern-based because a persisted name-origin field was not approved.
- Dynamic derived Boolean bounds are recomputed by multiple consumers through one shared function, but no memoization was added.
- Animated dissolve trajectory preservation remains a Pass A limitation.
- Nested/multiple Boolean editing remains outside the validated contract.

# 23. Technical Debt

- Introduce a stronger generated/custom name-origin authority only through an approved compatibility/schema design.
- Consider a memoized derived Boolean geometry selector if profiling demonstrates repeated expensive clipping.
- Add a component-level test that exercises operation switching, current frame changes, operand editing, and selection frame measurement in one harness.
- Add direct E2E coverage for marquee corner-to-pointer pixel measurement at multiple zoom/pan states.
- Add import/reload pixel parity coverage for legacy and operand-derived Boolean data.

# 24. Git Summary

- Branch: `main`
- Starting HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Ending HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- origin/main: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Ahead/behind: `0/0`
- Working tree: Intentionally dirty; Pass A, Pass A.1, reporting policy, workflow reference, and reports are uncommitted.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.
- Pass A.1 changed files include: `e2e/editor-interaction-regressions.spec.ts`, `e2e/v51-manual-qa.spec.ts`, `src/components/Canvas/SelectionGizmo.tsx`, `src/components/Canvas/StageCanvas.tsx`, `src/components/Canvas/StagePartLayers.tsx`, `src/components/Inspector/DetailsPanel.tsx`, `src/components/Inspector/OutlinerPanel.tsx`, `src/utils/booleanGeometry.ts`, `src/utils/viewportMath.ts`, and their focused tests.

# 25. Updated Project Tree

Relevant Pass A.1 additions/changes:

```text
reports/
├── DEVELOPMENT_REPORTING_POLICY.md [existing canonical policy]
├── progress_001.md [existing Pass A report]
└── progress_002.md [new]

.omp/commands/
└── milestone.md [changed: reporting-policy reference]

e2e/
├── editor-interaction-regressions.spec.ts [changed: Parallelogram draw regression]
└── v51-manual-qa.spec.ts [changed: Boolean nested-row selectors]

src/components/Canvas/
├── SelectionGizmo.tsx [changed: current derived Boolean bounds]
├── StageCanvas.tsx [changed: CTM pointer conversion and marquee filtering]
└── StagePartLayers.tsx [changed: shared Boolean derivation]

src/components/Inspector/
├── DetailsPanel.tsx [changed: operand-derived naming and geometry authority]
└── OutlinerPanel.tsx [changed: ParallelogramIcon import]

src/utils/
├── booleanGeometry.ts [changed: derived world/local geometry and naming]
└── viewportMath.ts [changed: client conversion and live marquee bounds]

src/tests/
├── booleanGeometry.test.ts [changed]
├── outlinerPanel.test.tsx [changed]
├── selectionGizmo.test.tsx [changed]
└── viewportMath.test.ts [changed]
```

`node_modules`, `dist`, test artifacts, and `.hermes/desktop-attachments/` are intentionally omitted.

# 26. Self Review

What is good:

- The crash was reproduced with an exact stack rather than guessed around.
- The marquee fix uses the browser's actual transform matrix and retains a tested pure fallback.
- The intermittent Boolean frame issue is addressed at the shared derived-geometry boundary, not with a static offset.
- Naming improves semantic identity without a SceneData version change.
- Focused E2E and browser measurements cover the changed surfaces.

What could improve:

- The live derivation function is shared, but selection and rendering still invoke it independently; profiling and a carefully keyed memoized selector may be useful later.
- Generated/custom name identity is not formally persisted.
- More direct component/E2E coverage is needed for combined operation/frame/operand transition sequences.

Uncertainty:

- The exact user-reported intermittent sequence was not reproduced as a deterministic failure after instrumentation; the stale-contour authority mismatch is proven by source flow and the corrected frame/path browser measurement.
- Full reload parity and full regression remain unrun.

Score: 8/10. The P0 crash and pointer drift have direct reproductions and focused proof, and the Boolean stale-authority class is corrected coherently. High-risk evaluator changes and the remaining manual/full regression gates prevent a higher score.

# 27. Next Recommended Task

Perform the complete manual QA Pass A.1 retest, including all zoom/pan marquee measurements and Boolean parent/operand/operation/frame selection transitions.

# 28. Project Status

- Current milestone: KCS V5.1 Manual QA Fix Pass A.1.
- Completed work: Parallelogram crash fix, screen-CTM marquee conversion, shared current-frame Boolean geometry, operand-derived naming, focused tests, focused E2E, and browser spot checks.
- Remaining milestone work: User Pass A.1 retest, then the separately deferred Mask, Color, Reset View, Rename, Timeline, Export, responsive, and final regression/visual review batches.
- QA stage: Ready for User QA Pass A.1 retest; not final milestone approval.

# 29. AI Development Notes

- The exact Parallelogram crash was a missing import, not a geometry or bounds algorithm failure.
- `ElementsDrawer.tsx` exports `ParallelogramIcon`; `OutlinerPanel.tsx` must import it if the icon branch remains.
- `StageCanvas.clientToSVG` should prefer `stage-svg.getScreenCTM().inverse()`.
- `clientToSVGPoint` is only the deterministic fallback; its pan inverse must be divided by zoom.
- `deriveBooleanGeometry` is the one current-frame world/local Boolean result authority.
- `booleanContours`/`points` in persisted parts are not live selection truth when operands and transforms are available.
- `StagePartLayers`, `SelectionGizmo`, and `getPartsInMarquee` must keep consuming the same derived result semantics.
- Boolean parent transform remains applied once; operands remain parent-local.
- `booleanOperandEditingGroupId` remains transient editor state.
- Operation badges make operation discoverable independently from user-authored names.
- Useful tests: `src/tests/booleanGeometry.test.ts`, `bounds.test.ts`, `viewportMath.test.ts`, `selectionGizmo.test.tsx`, `outlinerPanel.test.tsx`, and `e2e/editor-interaction-regressions.spec.ts`.
- Browser reproduction for future debugging: capture page errors before navigation, draw Parallelogram twice, measure marquee `getBoundingClientRect()` during drag, then compare rendered Boolean path/frame bounds after parent and operand transitions.

## DO NOT CHANGE CASUALLY

- Do not add static x/y offsets to marquee or Boolean selection frames.
- Do not bypass `getScreenCTM` with a second approximate viewport transform.
- Do not use persisted `booleanContours` as live current-frame bounds authority.
- Do not add a second Boolean evaluator for selection or marquee.
- Do not apply Boolean parent transform twice.
- Do not detach `booleanGroupId` from evaluator hierarchy without redesigning parent-local operand semantics.
- Do not convert transient operand edit mode into SceneData without approval.
- Do not add a generated/custom name field or version migration casually.
- Do not hide runtime errors behind broad `try/catch`.
- Do not reintroduce snap/alignment behavior.
- Do not broaden Pass A.1 into Mask, Color, Reset View, Rename, Timeline, Export, responsive, or full regression work.

# 30. Lessons Learned

- Browser-owned transform matrices are safer than duplicating CSS/SVG layout math in application code.
- A runtime crash in one shape path can originate in a shared Outliner rerender rather than shape geometry itself; stack capture prevents misdirected geometry changes.
- Persisted derived fields require an explicit authority rule. If current inputs can derive the value, editor consumers must not silently prefer stale persisted data.
- A world/local pair is clearer and safer than repeatedly converting contours in separate consumers.
- Semantic generated names improve UX, but exact generated/custom identity is a data-model concern if it must survive arbitrary renames and reloads.
- Focused E2E should assert page stability and visible geometry, not only selection outcomes.
- Pass A.1 remains safer because it preserved the Pass A transform model and addressed only the proven crash, coordinate boundary, derived geometry authority, and naming contract.
