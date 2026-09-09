# KCS Development Report — V3.1 Manual QA Correction + Reference-Driven Interaction Upgrade

Metadata:
- Date: 2026-02-16
- Milestone: KCS V3.1 Manual QA Correction + Reference-Driven Interaction Upgrade
- Branch: feat/v6-ui-bold-v3
- Starting HEAD: 52d33e2 docs: finalize KCS V3 delivery report
- Ending HEAD: 52d33e2 docs: finalize KCS V3 delivery report
- Commit status: Uncommitted working-tree changes; commit prohibited by task scope.
- Report number: 039

# 1. Executive Summary

Implemented the approved V3.1 manual-QA correction package. The Inspector now communicates Value Graph editability versus Speed Graph derivation, the curve editor opens paused with a bounded preview stage, pointer drags use pointer capture, and header/left/canvas controls expose explicit pressed state and restrained state transitions. Inspector grouping was restored with subtle scanable regions rather than heavy nested cards. Three CodePen references were inspected and translated into concepts only; no external code was copied.

The implementation is source-complete and browser-verified on the main 1440px surface plus 1366px and 1920px captures. TypeScript, lint, build, Vitest, and qa:v6 pass. The full Playwright run was started but timed out after 300 seconds with intermediate failures/timeouts; it is recorded as PARTIAL, not PASS.

# 2. Original Objectives

- Correct the manual QA findings from the V3 surface.
- Preserve animation evaluation, timeline behavior, state ownership, serialization, history, and public component contracts.
- Make Value and Speed Graph semantics visually and behaviorally distinct.
- Prevent curve-handle drags from breaking when the pointer leaves the SVG/modal.
- Make preview state explicit and keep the preview ball inside a bounded mini-stage.
- Adapt interaction ideas from three inspected CodePens without copying implementation code.
- Produce durable research, correction specification, screenshots, and QA handoff.
- Out of scope: new domain features, dependency changes, Git history changes, branch operations, commits, and pushes.

# 3. Problems Discovered

- Inspector sections were visually too flat and difficult to scan. Root cause: V3 flattening removed too much grouping contrast. Status: corrected with restrained borders, spacing, and section rhythm.
- Value and Speed Graphs looked too similar. Root cause: shared presentation without semantic badges or derived/read-only treatment. Status: corrected.
- Curve-handle dragging depended on window-level mouse lifecycle and could interact with backdrop dismissal. Status: corrected with pointer capture and drag-dismiss suppression.
- Curve preview auto-played and used an unbounded-feeling stage. Status: corrected to paused by default with a bounded, clipped mini-stage and explicit Play/Pause control.
- Header and toolbar states lacked explicit pressed-state semantics and reference-driven state rails. Status: corrected.
- Full E2E validation did not settle within the 300-second command timeout. Status: PARTIAL; no claim of full E2E pass.

# 4. Files Created

- `docs/research/KCS_UI_V31_CODEPEN_REFERENCE_ANALYSIS.md`: source-verified observations for three CodePen references, licensing caveats, and KCS adaptation decisions.
- `docs/design/KCS_UI_V31_MANUAL_QA_CORRECTION_SPEC.md`: correction contract for Inspector grouping, graph semantics, pointer lifecycle, preview, and toolbar surfaces.
- `docs/design/baseline/v31/*`: baseline screenshots captured before V3.1 corrections.
- `docs/design/after/v31/*`: after screenshots at 1440x900, 1366x768, and 1920x1080 plus curve modal and Speed Graph evidence.
- `reports/progress_039.md`: this permanent milestone record.

# 5. Files Modified

- `src/components/Inspector/InteractiveCubicBezierEditor.tsx`: paused preview, pointer capture drag lifecycle, Escape close, backdrop safety, status copy, bounded mini-stage markup.
- `src/components/Inspector/TemporalGraphPanel.tsx`: semantic graph classes, editable/derived badges, helper copy, muted dashed Speed Graph treatment.
- `src/components/Inspector/PropertyInspector.css`: restored subtle Inspector grouping and explicit action/section transitions.
- `src/kcsEditorTheme.css`: graph semantics and bounded preview styling/keyframes.
- `src/components/Header/HeaderBar.tsx`: mode button `aria-pressed` state and semantic switch class.
- `src/components/Header/HeaderBar.css`: animated mode indicator with explicit transitions and reduced-motion handling.
- `src/components/Canvas/overlays/CanvasViewportToolbar.tsx`: tool/grid pressed state and active highlight rail.
- `src/components/Canvas/StageCanvas.css`: anchored viewport highlight and explicit transitions; original absolute overlay positioning preserved.
- `src/components/Toolbar/LeftToolbar.tsx`: category `aria-pressed` state.
- `src/components/Toolbar/LeftToolbar.css`: explicit category/drawer transitions and reduced-motion handling.
- `src/tests/TemporalGraphPanel.test.tsx`: assertions for Value Graph editable and Speed Graph derived/read-only semantics.

# 6. Architecture Overview

```text
HeaderBar / LeftToolbar / CanvasViewportToolbar
        -> existing state authorities and callbacks
        -> explicit visual state + accessibility attributes

InteractiveCubicBezierEditor
        -> existing control-point state and onChange contract
        -> pointer-capture lifecycle
        -> TemporalGraphPanel(value|speed)
        -> bounded visual preview only

TemporalGraphPanel
        -> shared interpolateChannel evaluator
        -> Value Graph editable points
        -> Speed Graph derived path, no editable point controls
```

No parallel evaluator, playback engine, serialization path, or history authority was introduced.

# 7. Data Model Changes

No authored or serialized data-model changes. Curve points, PropertyKeyframe values, TemporalHandle values, Track channels, and easing contracts remain unchanged. New state is transient UI state: preview playing/paused, active graph mode, pointer ID, dragged point, and backdrop suppression.

# 8. Coordinate Space Model

The curve editor continues to map screen client coordinates into the modal SVG coordinate space using the SVG bounding rectangle, fixed graph padding, and the existing x range `[0,1]` / y range `[-1,2]`. Pointer capture preserves this conversion when the pointer leaves the graph. The bounded mini-stage is a visual preview surface only; it does not write scene coordinates, keyframes, transforms, or serialized values.

Canvas viewport tools retain their existing viewport/screen overlay placement. The correction explicitly preserves `.viewport-tools-overlay { position: absolute; top: 14px; right: 18px; }`; the active rail is positioned inside that existing overlay.

# 9. Component / Module Walkthrough

`InteractiveCubicBezierEditor` owns modal-local curve point state and now owns pointer lifecycle refs. `handlePointerDown` sets the point and pointer ID, then calls `setPointerCapture`; SVG pointer move/up/lost-capture handlers update or finish the drag. Escape closes the modal through the existing close callback. Preview controls only affect transient preview state.

`TemporalGraphPanel` remains the graph presentation and editing surface. Value mode renders keyframe points and handle inputs. Speed mode renders the derived interpolation path without point/input controls and labels itself `DERIVED · READ ONLY`.

`HeaderBar`, `LeftToolbar`, and `CanvasViewportToolbar` keep existing callbacks/state ownership. They add accessibility state attributes and visual indicators only.

# 10. Important Code Changes

```tsx
const handlePointerDown = (pointNum: 1 | 2, event: React.PointerEvent<SVGGElement>) => {
  event.stopPropagation();
  event.preventDefault();
  draggingPointRef.current = pointNum;
  draggingPointerIdRef.current = event.pointerId;
  setDraggingPoint(pointNum);
  event.currentTarget.setPointerCapture(event.pointerId);
};
```

The preview defaults to paused and uses a bounded CSS mini-stage with an explicit Play/Pause button. Header and toolbar state changes use `aria-pressed` and explicit, property-scoped transitions.

# 11. Public Interfaces

No exported prop, callback, type, or public API was removed or renamed. `InteractiveCubicBezierEditorProps` remains compatible. Existing `TemporalGraphPanel` props remain compatible. Added DOM accessibility attributes are additive.

# 12. Algorithms and Geometry

Graph interpolation continues to use `interpolateChannel`. Speed samples are derived from adjacent sampled values and frame deltas. Curve-handle screen-to-graph conversion retains the existing clamped x/y mapping. Preview movement is deliberately presentation-only and uses safe stage endpoints; it does not replace the canonical easing evaluator.

# 13. Interaction / UX Behavior

- Inspector: BEFORE flat/low-contrast grouping; AFTER subtle grouped regions with scanable headers and spacing; EXPECTED workflow is faster section recognition without nested-card bulk.
- Graphs: BEFORE Value and Speed visually similar; AFTER Value is cyan/editable and Speed is muted/dashed/derived/read-only; EXPECTED workflow makes editing authority obvious.
- Curve drag: BEFORE window mouse lifecycle could lose or dismiss; AFTER pointer capture retains the drag and backdrop dismissal is suppressed during the gesture; EXPECTED workflow supports external pointer movement.
- Preview: BEFORE auto-playing; AFTER paused by default, bounded, status-labeled, and manually playable; EXPECTED workflow requires explicit preview start.
- Modes/toolbars: BEFORE visual state only; AFTER pressed-state semantics and animated active indicators; EXPECTED workflow preserves existing callbacks and keyboard/accessibility interpretation.

# 14. Design Decisions

- Use CodePen concepts, not copied code: avoids licensing and dependency risk while retaining the useful interaction grammar.
- Keep Speed Graph derived/read-only: preserves a single evaluator authority and prevents misleading edits.
- Use pointer capture rather than global mouse listeners: makes ownership explicit and robust across modal boundaries.
- Use subtle grouping rather than restoring heavy cards: fixes scanability without reintroducing visual weight.
- Preserve existing layout anchors: reviewer evidence caught the risk of overriding the viewport overlay to `position: relative`; the correction preserves its absolute placement.

# 15. Invariants That Must Be Preserved

- `Track.channels` and PropertyKeyframe identity remain canonical.
- `interpolateChannel` remains the evaluator authority.
- Curve edits continue through existing `onChange` callbacks.
- Value Graph is the only editable graph mode; Speed Graph is derived.
- Preview does not mutate authored scene or timeline state.
- Existing header, toolbar, canvas, serialization, and history contracts remain intact.
- SVG pointer coordinate mapping remains in the curve graph's local screen/SVG boundary.
- Reduced-motion users receive no new mandatory motion.

# 16. Testing and Verification

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with one pre-existing warning in `src/context/AnimatorContext.tsx:655` (`react(only-export-components)`).
- `npm run build`: PASS; Vite emitted only the existing large-chunk warning.
- `npx vitest run src/tests/TemporalGraphPanel.test.tsx`: PASS, 1 file / 4 tests.
- `npm test`: PASS, 99 files / 1421 tests.
- `npm run qa:v6`: PASS, 3 tests.
- `CI=true npm run test:e2e`: PARTIAL; 252 tests started, command timed out at 300 seconds with intermediate failures/timeouts. No full E2E pass is claimed.
- Real browser at `http://localhost:5173/`: PASS for observed mode pressed states, paused curve modal, Value/Speed switching, bounded preview stage, and pointer drag from a curve handle to an external coordinate. The external drag changed P1 from `0.42,0` to `1,2` without modal dismissal.
- Git validation: branch/HEAD inspected; no commit or push performed.

# 17. Manual QA Results

- Inspector grouping: PASS — inspected in 1440x900 modal and full surface screenshots.
- Value Graph semantics: PASS — `EDITABLE` badge and editable point/handle controls visible.
- Speed Graph semantics: PASS — `DERIVED · READ ONLY`, muted dashed path, no editable keyframe points.
- External curve drag: PASS — real browser pointer drag outside modal graph updated the handle and kept the modal open.
- Preview initial state: PASS — real browser showed `Play Preview` and `Preview paused` on modal open.
- Preview bounds: PASS — mini-stage clipped and ball endpoints remained within safe travel rail in captured view.
- Header mode state: PASS — observed `pressed=true/false` values for Edit/Broadcast.
- Canvas toolbar state: PASS — observed pressed state for Select/Pan/Grid.
- Left toolbar state: PASS — observed pressed state for category buttons.
- Full E2E suite: PARTIAL — command timeout; unresolved pre-existing/intermediate E2E failures require a separate stabilization pass.

# 18. Regression Risk Assessment

- Inspector/CSS: MEDIUM. CSS-only changes touch shared selectors; build and browser screenshots pass, but full E2E did not settle.
- Curve pointer lifecycle: MEDIUM. Pointer capture and synthetic backdrop ordering are improved; no dedicated component test was added.
- Preview: LOW. Presentation-only state and bounded CSS stage do not mutate domain state.
- Graph semantics: LOW. Existing focused and full Vitest suites pass.
- Toolbar accessibility: LOW. Attributes are additive and observed through the real browser accessibility tree.

# 19. Performance Considerations

Graph sampling remains memoized by mode and sorted keyframes. Pointer updates still call the existing curve callback per move; no new evaluator or animation loop was introduced. CSS transitions are property-scoped and reduced-motion aware. No benchmark was added.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

Verified with the repository TypeScript/Vite toolchain on Windows and the existing React 19 stack. No serialized format changes, migration changes, or API removals. Browser verification used the existing local Vite/API servers. Runtime model metadata was not exposed by the application and is therefore `NOT EXPOSED`, not inferred.

# 22. Known Limitations

- Full Playwright regression did not finish within 300 seconds and showed intermediate failures/timeouts; this milestone does not claim E2E green.
- A dedicated component test for pointer capture/backdrop ordering is not present; behavior was verified manually in the real browser.
- Graph drag history batching remains a follow-up concern. The drag-domain instability was corrected after review by freezing the value domain for each gesture.
- Final designer review was initially NEEDS POLISH; the identified viewport positioning and explicit Inspector transition issues were corrected afterward, but a fresh final designer artifact was not returned before report closure.

# 23. Technical Debt

Recommend a focused follow-up for graph gesture history batching and drag-domain freezing. Revisit only if undo granularity or endpoint drag behavior is observed as a user-facing defect. Do not replace the shared evaluator with a second preview/evaluation engine.

# 24. Git Summary

- Branch: `feat/v6-ui-bold-v3` (existing branch; branch creation/switch prohibited by task scope).
- Starting HEAD: `52d33e2 docs: finalize KCS V3 delivery report`.
- Ending HEAD: `52d33e2 docs: finalize KCS V3 delivery report`.
- Working tree: modified source/tests plus new research/spec/screenshot/report files.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.
- Changed files are listed in sections 4 and 5.

# 25. Updated Project Tree

```text
src/
  components/
    Canvas/
      StageCanvas.css [modified]
      overlays/CanvasViewportToolbar.tsx [modified]
    Header/
      HeaderBar.css [modified]
      HeaderBar.tsx [modified]
    Inspector/
      InteractiveCubicBezierEditor.tsx [modified]
      PropertyInspector.css [modified]
      TemporalGraphPanel.tsx [modified]
    Toolbar/
      LeftToolbar.css [modified]
      LeftToolbar.tsx [modified]
  tests/TemporalGraphPanel.test.tsx [modified]
  kcsEditorTheme.css [modified]
docs/
  design/KCS_UI_V31_MANUAL_QA_CORRECTION_SPEC.md [new]
  design/baseline/v31/ [new screenshots]
  design/after/v31/ [new screenshots]
  research/KCS_UI_V31_CODEPEN_REFERENCE_ANALYSIS.md [new]
reports/progress_039.md [new]
```

# 26. Self Review

Good: the correction stays inside existing state authorities, has real browser evidence, preserves public APIs, and records the incomplete E2E run instead of hiding it. Improvement: add focused pointer/history tests and obtain a fresh post-polish designer artifact. Score: 8/10 because the implementation and core verification are strong, but full E2E did not settle and two gesture-quality concerns remain intentionally deferred.

# 27. Next Recommended Task

Stabilize and isolate the failing/timing-out Playwright E2E cases, then add focused undo/history coverage for one logical graph/curve drag.

# 28. Project Status

Current milestone: V3.1 correction package implemented and manually verified. Completed: reference research, correction specification, Inspector/graph/pointer/preview/toolbar corrections, screenshots, TypeScript/lint/build/Vitest/qa:v6. Remaining: full E2E stabilization and deferred graph gesture quality work. QA stage: PARTIAL because full Playwright regression timed out.

# 29. AI Development Notes

Assumptions: the existing V3 branch and current source are authoritative; CodePen references are concept references only; no reusable license was established from the inspected pages. State ownership remains in existing React components/hooks. The curve preview is not an evaluator authority. Useful reproduction: open Motion Curves, drag P1/P2 outside the modal graph, switch Value Graph/Speed Graph, and inspect pressed states through the browser accessibility tree.

Runtime model metadata: NOT EXPOSED.

## DO NOT CHANGE CASUALLY

- Do not replace `interpolateChannel` or introduce a second easing evaluator.
- Do not make Speed Graph editable or add independent speed-authored state.
- Do not move viewport toolbar out of its absolute overlay positioning.
- Do not route curve edits around existing `onChange`/timeline state authorities.
- Do not change `Track.channels`, serialization, or history ownership for a visual-only correction.
- Do not remove reduced-motion overrides or pointer-capture cleanup.

# 30. Lessons Learned

Manual screenshots exposed semantic ambiguity that automated tests did not: editable versus derived surfaces need explicit visual language. Reference inspection was most useful when reduced to interaction grammar rather than copied code. Absolute overlay positioning is a load-bearing layout contract and must be preserved when adding internal active-state indicators. Full regression timeouts must remain visible in the permanent record; they are not evidence of a green suite.
