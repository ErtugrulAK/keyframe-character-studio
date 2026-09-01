# KCS Development Report — Compact Pro Inspector PASS 3

Metadata:
- Date: 2026-08-31
- Milestone: KCS V5.1 — Compact Pro Inspector PASS 3
- Branch: `main`
- Starting HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Ending HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Commit status: Intentional uncommitted working-tree changes; commit prohibited by task scope
- Report number: `progress_016.md`

# 1. Executive Summary

PASS 3 implements the compact Transform and Control Points Inspector presentation while preserving the existing authored-data and mutation authorities. Transform now uses the existing local `StyleCard` disclosure shell, starts closed by default, and presents Position, Rotation, Scale, and Layer in compact property rows. Regular-shape Control Points now render as a single X/Y matrix for Edge and Corner modes instead of four independently framed cards.

The changes are presentation-only at the domain boundary. `updateCurrentTransform`, scale-lock state, z-index callbacks, point calculations, coordinate display conversion, history, serialization, renderer, selection, Boolean behavior, and animation behavior remain on their existing paths. PASS 1/PASS 2/PASS 2.x approved visual language and frozen Appearance work were preserved. PASS 4, PASS 5, and PASS 6 were not started.

Implementation state: COMPLETE.
User visual QA state: READY / pending user confirmation of Transform and Control Points visuals.

# 2. Original Objectives

## In scope

- Compact Transform section presentation.
- Consistent Position, Rotation, Scale, and Layer rows.
- Local closed-by-default Transform disclosure using the existing `StyleCard` shell.
- Compact regular-shape Control Points X/Y matrix.
- Edge and Corner mode labels, values, colors, callbacks, and calculations preserved.
- Responsive layout at the fixed 360px desktop Inspector width and the existing narrow clamp.
- Focused unit/component coverage and affected E2E selector updates.
- Sequential permanent development report.

## Explicitly out of scope

- Appearance structure, Fill/Stroke, Hue, Alpha, HEX, color utilities, and the Hue endpoint bug.
- Effects, Matte, Duplicate, Outliner, Geometry redesign, Trim Path, Text, Cloner, and Particles redesign.
- TransformVertexEditor redesign.
- Boolean geometry, hierarchy, dissolve, operation selection, or operand behavior.
- New animation, playback, renderer, serialization, or state authorities.
- Branch, commit, push, merge, rebase, reset, stash, or cleanup of unrelated working-tree changes.

# 3. Problems Discovered

## Transform shell inconsistency

- Symptom: Transform used an inline `panel-card` composition while other Inspector sections used `StyleCard` disclosure language.
- Reproduction: Select a part and compare the Transform property block with the collapsible Style sections.
- Root cause: `TransformTab` owned the composition directly and was not routed through `StyleCard`.
- Affected subsystem: Inspector presentation only.
- Severity: LOW.
- Status: PASS — a thin presentational `StyleCard` wrapper was added without moving ownership.

## Control Point vertical density

- Symptom: Edge and Corner modes each rendered four separately framed point groups with nested field groups.
- Reproduction: Open Control Points for a regular shape.
- Root cause: `TransformControlPoints` duplicated the same matrix information as eight nested editable groups.
- Affected subsystem: Inspector presentation and vertical scrolling only.
- Severity: MEDIUM visual regression risk.
- Status: PASS — one four-row matrix is now rendered for each mode; the callbacks and calculations were retained.

## Disclosure-aware affected tests

- Symptom: Existing coordinate and layer E2E selectors assumed Transform controls were always mounted.
- Root cause: PASS 3 makes the Transform section closed initially.
- Affected subsystem: E2E test setup, not product behavior.
- Severity: LOW.
- Status: PASS — affected tests explicitly open Transform through its public disclosure control.

# 4. Files Created

- `reports/progress_016.md`: Permanent PASS 3 engineering record. Contains current contract, architecture, verification evidence, Git state, limitations, and next task.
- `src/tests/transformPresentation.test.tsx`: Focused component coverage for closed-by-default Transform, disclosure non-mutation, Rotation reset, Layer callbacks, and matrix opening.

Pre-existing untracked reports, tests, and utility files from prior approved Inspector passes were preserved and not rewritten.

# 5. Files Modified

- `src/components/Inspector/sections/TransformTab.tsx`
  - Previous responsibility: Compose Transform controls, Boolean content, freeform editor, and Animation Data.
  - Change: Wrap the existing Transform property components in `StyleCard` with `collapsible` and `defaultOpen={false}`; wrap regular-shape Control Points in a separate closed `StyleCard`.
  - Behavioral impact: Disclosure is local UI state only. Existing callbacks remain passed directly to child components.
  - Risk: LOW; section lifecycle and callback ownership remain unchanged.
  - Note: The file already contained intentional PASS 2.x/Animation Data changes; those were preserved.

- `src/components/Inspector/sections/transform/TransformPositionRotationCard.tsx`
  - Previous responsibility: Position and Rotation inputs with existing coordinate conversion and reset callback.
  - Change: Replace nested inline card presentation with compact property groups and aligned fields; add accessible labels.
  - Behavioral impact: None to `displayScale`, Y sign conversion, SmartNumberInput, update callbacks, reset value, units, or history.
  - Risk: LOW visual/layout risk.

- `src/components/Inspector/sections/transform/TransformScaleCard.tsx`
  - Previous responsibility: Shared scale percentage input and AnimatorContext aspect-lock toggle.
  - Change: Compact Scale row and CSS-based locked/free visual state.
  - Behavioral impact: None to average scale calculation, min/max/precision, `scaleX`/`scaleY` update, or `setIsScaleLocked`.
  - Risk: LOW.

- `src/components/Inspector/sections/transform/TransformZIndexCard.tsx`
  - Previous responsibility: Layer Order card with Bring Forward and Send Backward callbacks.
  - Change: Compact Layer row integrated into Transform presentation; retained `Index <value>` text and both action buttons.
  - Behavioral impact: None to increment, lower bound, or callback semantics.
  - Risk: LOW.

- `src/components/Inspector/sections/transform/TransformControlPoints.tsx`
  - Previous responsibility: Edge/Corner point editor with four independently framed groups.
  - Change: Render mode-specific `ControlPointRow` data into one X/Y matrix with restrained point-color dots and accessible input labels.
  - Behavioral impact: None to `getPartBounds`, coordinate display scaling, opposite-anchor formulas, rounding, callback payloads, point mode state, or Boolean/freeform gating in the parent.
  - Risk: MEDIUM visual regression risk; focused tests and browser measurements pass.
  - Note: Existing intentional class additions from prior work were replaced by the requested matrix implementation.

- `src/components/Inspector/PropertyInspector.css`
  - Previous responsibility: Inspector dock, shared inputs, section shell, and existing style section rules.
  - Change: Add scoped Transform property-row, Layer, Control Point matrix, compact mode-switch, input alignment, and container-query rules. Add inline-size containment to the Inspector sidebar. Remove the obsolete Control Point group rule.
  - Behavioral impact: No domain or authored-data behavior; CSS only.
  - Risk: MEDIUM because shared Inspector CSS can affect visual surfaces. New rules are class-scoped to Transform/Control Points; existing Appearance rules were not structurally changed.
  - Note: The file already contained intentional PASS 1/PASS 2 Inspector and Appearance styling; those changes were preserved.

- `src/tests/transformControlPoints.test.tsx`
  - Previous responsibility: Assert four point groups and callback availability.
  - Change: Assert a single matrix, four rows, eight inputs, Edge/Corner values and labels, mode switching, and callback routing for all Corner fields.
  - Behavioral impact: Test contract updated to the approved matrix presentation.

- `e2e/coordinate-unit-v2.spec.ts`
  - Previous responsibility: Verify project-unit Inspector values and persistence.
  - Change: Open the closed Transform section and use stable Position X/Y accessible labels.
  - Behavioral impact: Test setup only; coordinate assertions remain unchanged.

- `e2e/layer-index-persistence.spec.ts`
  - Previous responsibility: Verify authored z-index ordering and persistence.
  - Change: Add an idempotent `openTransform` helper and open Transform after selection/reload where needed. Retain existing `Index <value>` assertions and persistence checks.
  - Behavioral impact: Test setup only; z-index assertions and persisted ordering remain unchanged.

No Appearance source structure, Hue endpoint, Effects, Matte, Duplicate, Outliner, renderer, or serialization files were intentionally modified for PASS 3.

# 6. Architecture Overview

```text
DetailsPanel
  -> TransformTab
       -> existing Boolean workflow content (unchanged position)
       -> StyleCard(title="TRANSFORM", local disclosure state)
            -> TransformPositionRotationCard
            -> TransformScaleCard -> existing AnimatorContext scale-lock state
            -> TransformZIndexCard -> existing z-index callback
       -> StyleCard(title="CONTROL POINTS", local disclosure state)
            -> TransformControlPoints
                 -> existing getPartBounds / coordinate conversion
                 -> existing onUpdate partial Transform path
       -> existing TransformVertexEditor path for eligible freeform parts
       -> StyleCard(title="ANIMATION DATA", existing closed disclosure)
  -> StyleTab (unchanged)
```

`StyleCard` remains the shared disclosure authority. No new Inspector state store, context field, animation engine, geometry engine, serializer, evaluator, or timing system was introduced.

# 7. Data Model Changes

None.

- Authored `CharacterPart` and `Transform` fields are unchanged.
- `zIndex`, scale values, point calculations, Boolean fields, animation channels, and serialized scene data are unchanged.
- Transform and Control Point disclosure state is transient local React UI state in `StyleCard`; it does not enter `AnimatorContext`, SceneData, history, localStorage, or project JSON.
- No migration, preset, clipboard, broadcast, playback, or renderer contract changed.

# 8. Coordinate Space Model

The milestone changes the Inspector presentation around existing coordinate contracts; it does not change coordinate math.

- Object/local geometry: `getPartBounds(selectedPart)` supplies the existing base half-width and half-height.
- Transform-authored space: `transform.x`, `transform.y`, `transform.scaleX`, and `transform.scaleY` remain the source values.
- Inspector display space: Position and Control Point X/Y use the existing coordinate-system rule. Project-unit scenes display raw units; legacy coordinate systems use the existing `0.01` display scale. Inspector Y remains positive-up while stored SVG-positive-down Y is written through the existing sign inversion.
- Control Point display positions: `cx = transform.x`, `cy = -transform.y`, with the existing scaled half-extents and rounding.
- Mutation boundary: every edit continues through the existing `onUpdate` / `updateCurrentTransform` path. No render-only matrix operation mutates geometry.
- Canvas/render/selection/marquee/viewport/history/serialization boundaries are unchanged.

# 9. Component / Module Walkthrough

## `TransformTab`

Remains a thin orchestrator. It decides eligibility and passes existing callbacks. `StyleCard` now supplies only presentation and local disclosure state. Boolean content remains before Transform. Freeform vertex editing remains outside the regular-shape matrix path. Animation Data remains a separate closed section.

## `TransformPositionRotationCard`

Uses compact `transform-property-group`, `transform-property-row`, and `transform-field` classes. Existing Position X/Y values, legacy display scale, positive-up Y display, Rotation value, and Reset 0° callback remain intact.

## `TransformScaleCard`

Uses the existing `useAnimator` scale-lock authority and existing SmartNumberInput. The visual Locked/Free state is represented by CSS classes; value and callback behavior are unchanged.

## `TransformZIndexCard`

Uses the existing z-index callback contract. The Layer value and action buttons are visually placed inside the main Transform section instead of a separate panel card.

## `TransformControlPoints`

Builds four mode-specific row descriptors. Edge rows are Left, Right, Top, Bottom. Corner rows are Top Left, Top Right, Bottom Left, Bottom Right with the existing directional/color identities. Each descriptor carries the same existing X/Y calculation and callback closure, then renders through the shared SmartNumberInput.

## `PropertyInspector.css`

Adds Inspector-local presentation rules only. The matrix grid uses `minmax` columns and `min-width: 0`; the sidebar is an inline-size container so a 300px container query can tighten gaps/label width without horizontal overflow.

# 10. Important Code Changes

Transform shell:

```tsx
<StyleCard title="TRANSFORM" collapsible defaultOpen={false}>
  <div className="transform-property-list">
    <TransformPositionRotationCard ... />
    <TransformScaleCard ... />
    <TransformZIndexCard ... />
  </div>
</StyleCard>
```

Control Point matrix:

```tsx
<div className="control-point-matrix" role="grid" aria-label="... control points">
  <div className="control-point-matrix-row control-point-matrix-header" role="row">
    <span role="columnheader" />
    <span role="columnheader">X</span>
    <span role="columnheader">Y</span>
  </div>
  {pointRows.map((row) => (
    <div className="control-point-matrix-row" role="row" key={row.key}>
      <span className="control-point-label">...</span>
      <SmartNumberInput ariaLabel={`${row.label} X`} onChange={row.onXChange} ... />
      <SmartNumberInput ariaLabel={`${row.label} Y`} onChange={row.onYChange} ... />
    </div>
  ))}
</div>
```

# 11. Public Interfaces

No exported public API changed.

- Existing component prop interfaces remain compatible.
- `StyleCard` props remain unchanged from the approved PASS 2 disclosure extension.
- `SmartNumberInput` props remain unchanged; only existing `ariaLabel` support is used.
- No new exported utility, hook, type, callback, or serialized field was added.

# 12. Algorithms and Geometry

No algorithm or geometry behavior changed.

The matrix refactor preserves the existing formulas:

- Left/Top-left/Bottom-left X edits keep the opposite right anchor fixed.
- Right/Top-right/Bottom-right X edits keep the opposite left anchor fixed.
- Top/Corner-top Y edits keep the opposite bottom anchor fixed.
- Bottom/Corner-bottom Y edits keep the opposite top anchor fixed.
- Width/height are converted back to `scaleX`/`scaleY` with the existing three-decimal rounding.
- Center positions use the existing rounded midpoint.
- Edge center X/Y edits retain the existing direct position updates.

The matrix rendering remains O(1) for four rows and does not alter canvas geometry computation.

# 13. Interaction / UX Behavior

## Transform disclosure

- Before: Transform controls were always visible in the Edit body.
- After: Transform presents a shared disclosure header and starts closed.
- Expected workflow: select a part, activate `Expand TRANSFORM`, then edit Position, Rotation, Scale, or Layer. Toggle does not invoke an authored callback.

## Property rows

- Before: Position/Rotation/Scale were nested inline card-like groups and Layer was a separate card.
- After: one compact Transform section with aligned property rows; Layer is visually integrated.
- Expected workflow: values and actions remain edited exactly as before.

## Control Point matrix

- Before: four separately framed groups per mode.
- After: one compact X/Y matrix with muted column headers, near-black editable inputs, and restrained colored point dots.
- Expected workflow: open `CONTROL POINTS`, choose Edge Points or Corners, edit any row's X/Y input.

## Narrow width

- At the 360px desktop Inspector width, the matrix fits without horizontal scroll.
- At the tested narrow 271px sidebar, the matrix reduced its first column/gaps using the container query and retained usable input cells without overflow.

# 14. Design Decisions

## Use `StyleCard` as a presentational Transform shell

- Decision: Reuse the existing disclosure-capable `StyleCard` around existing Transform children.
- Reason: It is the canonical Inspector section shell and keeps state local.
- Alternative rejected: Move Transform ownership or mutation logic into a new shared context/primitive.
- Trade-off: Transform and Control Points become separately disclosed sections rather than one always-visible block; this matches the approved closed-section direction.

## Keep Control Points as a dedicated component

- Decision: Change only the rendering structure inside `TransformControlPoints` and scope its styling.
- Reason: The component already owns the point mode and calculation closures.
- Alternative rejected: Move point calculations into a new utility or domain hook without a behavioral need.
- Trade-off: Row descriptors allocate small render-time objects; this is bounded to four rows and avoids duplicating JSX/callback logic.

## Preserve Layer action text and callback surface

- Decision: Show `Index <value>` and retain Bring Forward/Send Backward buttons in the compact Layer row.
- Reason: Existing z-index behavior and E2E assertions remain stable while grouping changes visually.
- Alternative rejected: Add a new direct z-index editing input, which would expand the approved behavior surface.
- Trade-off: Layer is compact but includes two existing actions beyond the illustrative value-only target.

# 15. Invariants That Must Be Preserved

- `StyleCard` disclosure state is local UI state only; never persist it or add it to scene history.
- `updateCurrentTransform` remains the Transform mutation authority.
- SmartNumberInput commit, focus, keyboard, rounding, and display-scale behavior remain unchanged.
- Position Y display/storage sign conversion remains unchanged.
- Scale lock remains owned by `AnimatorContext` and shared with canvas scaling.
- Layer order callbacks and lower bound remain unchanged.
- Edge/Corner point mode, labels, values, opposite-anchor semantics, and callback payloads remain unchanged.
- Freeform vertex editing remains structurally separate.
- Boolean results continue to suppress the freeform editor and preserve existing Boolean workflow placement.
- Animation Data remains separate and closed by default.
- Appearance, Hue, Effects, Matte, Duplicate, Outliner, renderer, viewport, history, serialization, and timeline remain frozen for this pass.

# 16. Testing and Verification

## TypeScript

- `npx tsc --noEmit` — PASS.
- `npm run build` (includes `tsc -b`) — PASS.

## Vitest / component tests

- `node ./node_modules/vitest/vitest.mjs run src/tests/transformControlPoints.test.tsx src/tests/transformPresentation.test.tsx src/tests/coordinateAuthoring.test.tsx` — PASS, 3 files / 9 tests.
- `node ./node_modules/vitest/vitest.mjs run src/tests/transformControlPoints.test.tsx src/tests/transformPresentation.test.tsx src/tests/coordinateAuthoring.test.tsx src/tests/transformInOutPreset.test.tsx` — PASS, 4 files / 42 tests.
- `npm test` — PASS, 85 files / 1,348 tests.
- Vitest emitted three existing `Not implemented: navigation to another Document` notices; no test failed.

## Playwright / E2E

- `npx playwright test e2e/coordinate-unit-v2.spec.ts -g "project-unit inspector"` — PASS, 1 test. Confirms the closed Transform section can be opened and raw project-unit Position values remain correct.
- `npx playwright test e2e/layer-index-persistence.spec.ts` — PASS, 1 test after the disclosure-aware setup update. Confirms z-index actions, undo/redo, autosave, reload, and ordering remain correct.
- `npx playwright test e2e/editor-interaction.spec.ts` — PASS, 7 tests.
- `npx playwright test e2e/coordinate-unit-v2.spec.ts --retries=0` — PARTIAL, 7 passed / 4 failed. The four failures are the existing output-origin assertions for 1280x720, 3840x2160, 1080x1920, and 1000x1000; they expected a resolution-dependent output transform but observed the baseline `translate(1260, 440) rotate(0) scale(1, 1)`. No Transform Inspector assertion failed. These are reported as unrelated baseline failures and were not changed.
- Initial combined command `npx playwright test e2e/coordinate-unit-v2.spec.ts e2e/layer-index-persistence.spec.ts e2e/editor-interaction.spec.ts` — FAIL, 14 passed / 5 failed. Four failures were the same coordinate output-origin baseline assertions; the layer test initially timed out because its new closed Transform section needed an idempotent disclosure-aware helper. The helper was corrected and the layer test was rerun successfully as recorded above.

## Manual browser verification

- Local app was opened at `http://localhost:5173/` in a real headless Chromium browser at 1440x1000 and 800x1000 viewports.
- Rectangle workflow: selected Rectangle, opened Transform and Control Points, edited Position X/Y, Rotation, Reset 0°, Scale, Locked/Free, Layer actions, edited all eight Edge fields, switched to Corner, edited all eight Corner fields, and clicked Undo/Redo. The surface remained responsive and the expected controls remained present.
- Matrix measurements at 1440 viewport: sidebar `359/359` client/scroll width; matrix `325/325`; four data rows.
- Matrix measurements at the narrow 800 viewport: sidebar `271px`; matrix `237/237` client/scroll width.
- Triangle, Star, Rhombus, and Parallelogram toolbar checks: each rendered four Control Point data rows with equal client/scroll matrix widths (`325/325`) and no horizontal overflow.
- Screenshots were inspected for Transform hierarchy, compact Layer grouping, matrix alignment, input hierarchy, and narrow-width behavior.

## Lint

- `npm run lint` — PASS with one existing warning at `src/context/AnimatorContext.tsx:630`: `react(only-export-components)`.

## Build

- `npm run build` — PASS. Vite reported the existing large-chunk warning for the 533.89 kB JavaScript bundle.

## Git validation

- `git diff --check` — PASS. Git emitted expected Windows LF-to-CRLF working-copy warnings; no whitespace error was reported.

# 17. Manual QA Results

- PASS — Transform section starts closed and opens through the shared disclosure control.
- PASS — Transform property rows visually compact at 360px desktop width.
- PASS — Control Point matrix has four rows, aligned X/Y headers, and no horizontal overflow at tested wide/narrow widths.
- PASS — Rectangle browser workflow exercised Transform, Edge, Corner, and Undo/Redo controls.
- PASS — Triangle, Star, Rhombus, and Parallelogram matrix row/overflow checks.
- PASS — Existing focused callback and coordinate conversion tests.
- PARTIAL — Full requested manual QA across every object type and every authored interaction was not performed end-to-end; automated coverage plus browser smoke coverage is recorded above.
- NOT TESTED — User visual acceptance of the final Transform and Control Points presentation.
- NOT TESTED — PASS 4 Appearance changes; explicitly deferred.

# 18. Regression Risk Assessment

Overall: LOW to MEDIUM.

- LOW: Domain callbacks, calculations, authored values, history, serialization, renderer, selection, Boolean, animation, and scale-lock authorities were not moved or rewritten.
- MEDIUM: Inspector CSS is shared infrastructure and Transform disclosure changes initial visibility. Scoped class rules, focused tests, browser screenshots, and narrow-width measurements reduce the risk.
- LOW: E2E selector risk is addressed for the affected coordinate and layer tests.
- Known separate risk: four existing coordinate output-origin E2E failures remain outside this presentation pass.

# 19. Performance Considerations

- No pointer, canvas, renderer, playback, evaluator, or geometry hot path changed.
- The matrix creates four bounded row descriptors during render; no unbounded iteration or new listener/timer/storage work was added.
- Closed sections avoid rendering their child controls through the existing `StyleCard` behavior.
- No benchmark was required or performed.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

- React component prop compatibility: preserved.
- TypeScript/build compatibility: verified by `npx tsc --noEmit` and `npm run build`.
- Browser compatibility: tested in Chromium at wide and narrow viewport sizes; no overflow observed.
- Saved-project and serialization compatibility: no authored or serialized fields changed.
- Animation, preset, clipboard, broadcast, renderer, and migration compatibility: no code paths changed.
- Windows line-ending warnings remain normal for this working tree and are not product errors.

# 22. Known Limitations

- Four coordinate-unit output-origin E2E assertions remain failing at 1280x720, 3840x2160, 1080x1920, and 1000x1000 with the existing baseline transform result. They are unrelated to the Transform/Control Point presentation and were not modified.
- Full manual browser QA for every requested shape edit sequence was not completed; shape coverage used matrix row/overflow browser checks plus focused component tests.
- User visual QA is still required before beginning the next approved visual pass.
- TransformVertexEditor was intentionally not redesigned.

# 23. Technical Debt

- Transform and Boolean workflow composition still use different ownership/presentation patterns. A broader shared shell extraction would require a separate architecture decision and is not part of PASS 3.
- Transform local disclosure state resets on remount/selection lifecycle according to the existing `StyleCard` policy; session persistence was intentionally not added.
- Existing coordinate output-origin E2E failures require a separate baseline investigation; do not conflate them with Inspector presentation changes.

# 24. Git Summary

- Branch: `main`
- Starting HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Ending HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- `origin/main`: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Ahead/behind: `0/0`
- Staged changes: `0`
- Unstaged changes at final audit: `26`
- Untracked files at final audit: `14`
- Working tree: existing intentional PASS 1/PASS 2/PASS 2.x Appearance/Inspector changes plus PASS 3 Transform/Control Point and test/report changes.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.

PASS 3 intentionally preserved all pre-existing unrelated working-tree files, including `.hermes/desktop-attachments/` artifacts if present; no such artifacts were modified.

# 25. Updated Project Tree

Relevant PASS 3 files:

```text
e2e/
  coordinate-unit-v2.spec.ts                    [modified]
  layer-index-persistence.spec.ts               [modified]
src/components/Inspector/
  PropertyInspector.css                         [modified]
  sections/
    TransformTab.tsx                            [modified]
    transform/
      TransformControlPoints.tsx                [modified]
      TransformPositionRotationCard.tsx         [modified]
      TransformScaleCard.tsx                    [modified]
      TransformZIndexCard.tsx                   [modified]
src/tests/
  transformControlPoints.test.tsx               [modified]
  transformPresentation.test.tsx                [new]
reports/
  progress_016.md                               [new]
```

Other modified/untracked Inspector, Appearance, report, test, and utility files remain prior intentional working-tree changes and were not part of the PASS 3 source scope.

# 26. Self Review

Good:

- Reused the existing `StyleCard`, `SmartNumberInput`, `AnimatorContext` scale-lock state, bounds utility, and Transform mutation path.
- Flattened the point editor without duplicating or changing geometry formulas.
- Added accessible labels and stable disclosure-aware E2E setup.
- Verified wide and narrow browser layout with actual matrix width measurements.
- Kept Appearance and later roadmap passes untouched.

Could improve:

- The manual browser sequence did not independently edit every requested shape's every point; the remaining evidence is automated/component and layout smoke coverage.
- Layer still includes the two existing action buttons because adding a new direct value editor would be an unnecessary behavior change.

Uncertainty:

- The final visual judgment of spacing, hierarchy, and label density remains with the user visual QA checkpoint.

Score: 8.5/10. The implementation is minimal and behavior-safe, but final visual acceptance and the separate coordinate E2E baseline failures remain open.

# 27. Next Recommended Task

Perform user visual QA of the PASS 3 Transform section and Control Points matrix, then decide whether to approve the next Appearance pass.

# 28. Project Status

- Current milestone: KCS V5.1 Compact Pro Inspector PASS 3 implementation complete.
- Completed: compact Transform shell/rows, closed Transform disclosure, integrated Layer presentation, compact Edge/Corner matrix, focused tests, browser smoke QA, and full Vitest/TypeScript/lint/build validation.
- Remaining for PASS 3: user visual confirmation.
- PASS 4 Appearance: not started.
- PASS 5/6 later sections: not started.
- QA stage: READY FOR USER VISUAL QA.

# 29. AI Development Notes

- The canonical Transform mutation boundary is `updateCurrentTransform`; keep presentation wrappers thin.
- `StyleCard` owns local disclosure state. Do not move collapse state into `AnimatorContext`, SceneData, localStorage, or serialization without explicit approval.
- `SmartNumberInput` owns edit buffering, parsing, clamping, rounding, and keyboard commit behavior. Do not replace it with ad hoc numeric inputs.
- Control Point values are derived from `getPartBounds`, transform scale, and the existing Cartesian Y convention. Keep formulas and opposite-anchor semantics intact.
- Scale lock is shared between Inspector and canvas corner-drag behavior through `AnimatorContext`.
- Boolean results and freeform parts have separate editor eligibility paths; do not route them through the regular-shape matrix accidentally.
- The fixed desktop Inspector target is 360px, with the existing narrow clamp. Verify `scrollWidth <= clientWidth` for matrix changes.
- Appearance and the Hue endpoint bug are explicitly frozen until the next approved pass.

## DO NOT CHANGE CASUALLY

- `updateCurrentTransform` and its history grouping.
- Position coordinate display scale and Y sign conversion.
- Scale lock context ownership and canvas scaling integration.
- Layer reorder callbacks and z-index persistence.
- Control Point opposite-anchor calculations, rounding, labels, and mode semantics.
- Boolean result suppression of freeform editing.
- TransformVertexEditor structure.
- Animation Data callbacks and closed disclosure behavior.
- StyleCard local disclosure state and accessibility contract.
- Appearance Fill/Stroke structure, Hue/Alpha/HEX behavior, and color utilities.
- Outliner, selection, marquee, renderer, viewport, playback, timeline, serialization, and migration paths.

# 30. Lessons Learned

- A thin presentational `StyleCard` wrapper is sufficient to bring non-Style Transform content into the shared disclosure language without moving behavior ownership.
- Matrix row descriptors make it easier to preserve eight existing callback paths while removing repeated card markup.
- Disclosure changes must be reflected in E2E setup through public accessible controls rather than hidden DOM assumptions.
- Narrow-width validation should measure both `clientWidth` and `scrollWidth`; visual inspection alone can miss overflow.
- Existing E2E baseline failures must remain separately classified instead of being “fixed” during a visual-only milestone.
