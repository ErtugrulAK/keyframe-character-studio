# KCS Development Report — V3.3 Sidebar Symmetry + Visual Cleanup

Metadata:
- Date: 2026-09-09
- Milestone: KCS V3.3 SIDEBAR SYMMETRY + VISUAL CLEANUP + SAFE BRANCH CONSOLIDATION
- Branch: `feat/v6-ui-bold-v3`
- Starting HEAD: `52d33e2d5ef09292c544efd12cc9371fcee3485f`
- Ending HEAD: `52d33e2d5ef09292c544efd12cc9371fcee3485f`
- Report number: 041
- Commit status: Uncommitted; commit prohibited by task/session policy.

# 1. Executive Summary

V3.3 applies the approved sidebar symmetry and visual cleanup package on top of the verified V3.2 working state. Left and right panels now share a flat semantic surface language, matching reveal easing, restrained edge affordances, and focus-visible treatment. Inspector object actions no longer present a competing EDIT mode; object name/type is primary, Duplicate options are contextual, direct duplicate and delete callbacks remain unchanged. Edit/Broadcast and Canvas viewport controls use one clear boundary and one active indicator while preserving V3.2 state and WAAPI behavior.

TypeScript, lint, Vitest, build, V6 QA, focused Canvas Playwright, and the final full Vitest suite pass. Full Playwright remains non-green: the final run completed 244 passed and 8 failed after 10.3 minutes. Branch consolidation was not performed because the full-regression gate is red, the working tree is intentionally dirty, and branch operations are prohibited by the active session policy.

# 2. Original Objectives

In scope: left/right sidebar symmetry, fixed 56px left rail preservation, matched collapse/reveal language, nested rectangle cleanup, Media/Elements separator removal, Inspector header/action cleanup, Edit/Broadcast segmented rail cleanup, Canvas toolbar cleanup without removing WAAPI sliding, semantic dark-editor tokens, browser screenshots at 1366/1440/1920, focused/full validation, and branch topology audit.

Out of scope: main modification, merge, branch creation/deletion, commit, push, playback/evaluator/history/serialization changes, rendering/matte/geometry changes, timeline changes, routing changes, and unrelated roadmap work.

# 3. Problems Discovered

- Left selected buttons still had multiple visual boundaries and an obsolete CSS separator rule. Severity: MEDIUM. Status: addressed with one active rail indicator and spacing.
- Right Inspector used a separate centered toggle and different panel chrome. Severity: MEDIUM. Status: addressed with matched edge-handle styling and motion language.
- Details header exposed EDIT and DUPLICATE as competing mode controls. Severity: MEDIUM. Status: addressed; direct duplicate/delete callbacks remain domain-owned.
- Canvas E2E expected an `active` class that V3.2 source semantics did not provide. Severity: HIGH regression. Status: fixed by restoring active class while retaining `aria-pressed`.
- Canvas highlight used a 32px step after toolbar geometry changed to 26px controls with 3px gaps. Severity: MEDIUM. Status: fixed with shared 29px step constant and matching CSS.
- Curve P2 X2 wiring was accidentally disturbed during the package and caught by review. Severity: HIGH. Status: fixed and focused tests pass.
- Full Playwright still has unrelated or contract-conflicting failures. Status: PARTIAL/FAIL; details in section 16.

# 4. Files Created

- `docs/design/after/v33/` — V3.3 visual evidence set. Some captures were copied from verified V3.2 tabs when browser reload produced an empty React root; this limitation is recorded in section 17.
- `reports/progress_041.md` — this permanent milestone record.

# 5. Files Modified

- `src/components/Toolbar/LeftToolbar.css` — fixed rail visual language, one selected indicator, separator removal, flat drawer surface, matched easing.
- `src/components/Inspector/PropertyInspector.css` — right sidebar motion, edge handle, focus-visible states, single-boundary Inspector sections.
- `src/components/Inspector/DetailsPanel.tsx` — removed visible EDIT mode action, added object type, preserved direct duplicate/delete, made Duplicate options contextual.
- `src/components/Header/HeaderBar.css` — removed nested mode-control chrome, retained moving indicator and spring keyframes.
- `src/components/Canvas/StageCanvas.css` — flat viewport toolbar, semantic borders, active/focus layering, 29px highlight geometry.
- `src/components/Canvas/overlays/CanvasViewportToolbar.tsx` — active class restoration, shared 29px tool step, inline zoom style removal; WAAPI mechanism preserved.
- `src/index.css` — semantic V3.3 aliases mapped to existing palette authorities.
- `src/kcsEditorTheme.css` — affected surface gradient/glow reduction and flat preview/viewport treatment.
- `src/components/Inspector/InteractiveCubicBezierEditor.tsx` — corrected P2 wiring/step, reduced-motion Play no-op, stable modal callback ref, modal role/focus trap/restore, labelled coordinate inputs, modal guard.
- Existing V3.1/V3.2 modified files and tests remain intentionally uncommitted and were not reverted.

# 6. Architecture Overview

```text
appMode / visibility state
        |
        +-- HeaderBar ------------------ segmented indicator only
        +-- LeftToolbar ----------------- 56px rail + absolute contextual drawer
        +-- StageCanvas ----------------- fixed absolute viewport toolbar + WAAPI highlight
        +-- PropertyInspector ----------- right dock + edge handle + DetailsPanel
        +-- DetailsPanel ---------------- domain callbacks for duplicate/delete
```

All changes remain in presentation components and CSS. Domain authorities, evaluator functions, playback, history, and serialization are unchanged.

# 7. Data Model Changes

None. No authored SceneData, Track, Track.channels, mask, matte, keyframe, migration, import/export, or serialized state was changed. Transient UI-only state remains local to existing components.

# 8. Coordinate Space Model

Canvas coordinate authority is unchanged. The left rail remains a settled 56px flex basis. The drawer is absolute at the rail edge, so the settled rail origin remains fixed. Canvas viewport toolbar coordinates remain overlay-local; the active highlight now derives its movement from the same 29px control-step constant used by the 26px controls and 3px gaps. Object-local, parent-local, world/canvas, viewport, selection, gizmo, hit testing, and serialization conversions were not changed.

# 9. Component / Module Walkthrough

- `LeftToolbar`: owns only active category and collapse UI state; nav semantics and drawer authorities unchanged.
- `PropertyInspector`: continues to receive `isHidden`; no new width-resize authority; existing vertical Outliner/Details height divider remains.
- `DetailsPanel`: still owns only the presentation selection between edit content and duplicate options; domain operations remain `duplicateSelectedPart`, `deletePart`, and Boolean dissolve callbacks from `useAnimator`.
- `HeaderBar`: still consumes `appMode`/`setAppMode`; CSS owns indicator motion.
- `CanvasViewportToolbar`: still receives viewport callbacks; active state is represented by both existing ARIA semantics and the compatibility class required by E2E.
- `InteractiveCubicBezierEditor`: retains canonical `solveCubicBezier`, pointer capture, bounded preview, and adds modal accessibility without changing curve math.

# 10. Important Code Changes

Canvas movement now uses one geometry constant:

```ts
const VIEWPORT_TOOL_STEP = 29;
```

The same step feeds reduced-motion placement and all WAAPI transform keyframes. The highlight still uses the V3.2 width sequence `28px → 42px → 34px → 28px`.

# 11. Public Interfaces

No exported public API or domain interface changed. Component props remain backward-compatible. `CanvasViewportToolbar`, `PropertyInspector`, and `InteractiveCubicBezierEditor` keep their existing prop contracts.

# 12. Algorithms and Geometry

- Sidebar reveal remains CSS transform/opacity/width behavior; no resize handle or new layout state was introduced.
- Canvas highlight translation is `index × 29px`, matching 26px controls plus 3px gaps.
- Curve preview still samples 25 values through canonical `solveCubicBezier`, clamps output to `[0,1]`, and uses bounded CSS positions.
- Modal focus trap cycles through current focusable controls and restores the previously focused element on close.

# 13. Interaction / UX Behavior

## Sidebars

Before: left and right panels used different surface weights and handles. After: both use quiet borders, flat panels, restrained hover/focus, and `cubic-bezier(0,1.15,1,.93)` reveal language. Expected workflow: collapse either panel, continue using the visible edge affordance, reopen without changing domain state.

## Inspector

Before: EDIT and DUPLICATE appeared as mode tabs. After: object name/type is primary; compact Duplicate options opens the existing duplicate panel, direct duplicate still invokes the original callback, and Delete remains compact/destructive. Expected workflow: select an object, use the contextual duplicate icon or direct duplicate icon, or delete without entering an edit mode.

## Edit/Broadcast

Before: outer and inner rectangles competed. After: one segmented rail, one moving indicator, inactive options are transparent, and V3.2 squash/spring/reduced-motion behavior remains.

## Canvas

Before: viewport controls used excessive border/glass chrome and the highlight step could drift. After: flat toolbar, quiet separator, consistent zoom spacing, compatibility active class, and geometry-derived WAAPI movement.

# 14. Design Decisions

- **Decision:** Keep the right Inspector as a dock with a matched edge handle, not a new 56px right rail. **Reason:** user explicitly freezes the left rail but only requests a matched right affordance; this avoids extra stage/layout risk. **Alternative rejected:** duplicate the full left rail on the right.
- **Decision:** Keep duplicate options as a contextual action rather than removing the existing DuplicateTab. **Reason:** mirror duplicate behavior must remain available. **Trade-off:** one compact icon opens the existing option panel while a second compact icon performs direct duplicate.
- **Decision:** Map V3.3 aliases to existing semantic base tokens. **Reason:** avoid a second literal palette authority.
- **Decision:** Preserve `0.24s` right dock transition compatibility. **Reason:** existing V5.1 E2E asserts this observable contract; easing was aligned without changing the required duration.

# 15. Invariants That Must Be Preserved

- `appMode` and `setAppMode` remain the Header authority.
- `activeTool`, `showGrid`, zoom, pan, and reset callbacks remain Canvas authorities.
- Canvas highlight remains WAAPI stretch → slide → settle with cancellation and reduced-motion bypass.
- Left rail remains 56px and stage origin remains settled/fixed.
- Right Inspector has no horizontal resize authority.
- Duplicate/delete callbacks and Boolean dissolve semantics remain unchanged.
- Value Graph is editable; Speed Graph is derived/read-only.
- `solveCubicBezier` remains canonical.
- Pointer capture, external drag, history, serialization, playback, timeline, masks, mattes, and routing remain unchanged.
- Header height remains 79px.

# 16. Testing and Verification

## TypeScript / lint

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with the existing `AnimatorContext.tsx:655` Fast Refresh warning.

## Vitest

- `npm test`: PASS — 100 files / 1423 tests.
- Focused Canvas/Inspector tests: PASS — CanvasViewportToolbar, BezierPathEditor, appInspectorToggle, propertyInspector; 4 files / 9 tests in the final focused run.
- Earlier focused V3.2 interaction run: PASS — 3 files / 12 tests.

## Build / V6

- `npm run build`: PASS; existing >500kB chunk warning remains.
- `npm run qa:v6`: PASS — 3 tests.
- `git diff --check`: PASS with existing LF/CRLF advisory for TemporalGraphPanel and its test.

## Focused Playwright

- `CI=true npx playwright test e2e/canvas-interaction-v1.spec.ts --workers=1`: PASS — 4 tests.
- A focused editor/workflow/V5.1 batch timed out at 300s after additional failures; it was not weakened.

## Full Playwright

- Final `CI=true npm run test:e2e`: FAIL — 244 passed, 8 failed, 10.3 minutes.
- Classified failures:
  - Real fixed regression: Canvas `active` class omission; fixed and focused Canvas E2E is now green.
  - Real fixed compatibility issue: right Inspector transition duration; restored exact `0.24s` strings.
  - Real fixed selector compatibility: contextual Duplicate action now exposes accessible name `Duplicate` while retaining existing behavior.
  - Contract-conflicting/stale geometry assertion: left-collapse test expects canvas width to grow, while approved V3.3 freezes a 56px rail and settled stage origin with an absolute drawer.
  - Existing workflow interaction conflict: expanded absolute drawer intercepts stage clicks in free-draw tests.
  - Narrow Inspector overflow: Trim Path test remains failing and requires separate layout investigation.
  - Parallelogram creation/duplicate failures remain in the full suite and require separate reproduction; no domain fallback was added.

# 17. Manual QA Results

- Full editor screenshots: PARTIAL. Valid 1366x768 and 1920x1080 captures were made from existing verified browser tabs. New/reloaded 1440 tabs intermittently rendered an empty React root, so not every V3.3 screenshot proves the latest HMR bundle.
- Left collapsed: PASS for fixed rail visual state in captured 1440 evidence.
- Right collapsed: PARTIAL. Screenshot shows intermediate/faint inspector content during transition; source now adds `visibility:hidden` and `pointer-events:none` for the final hidden state. Recapture is still recommended.
- Edit/Broadcast: PASS for accessible pressed states and source-level single indicator structure.
- Canvas toolbar: PASS in source and focused E2E; WAAPI mechanism preserved.
- Curve Value/Speed: PASS through existing focused tests and source contracts.
- Focus-visible: PASS in source; explicit outlines restored for V3.3 sidebar/icon controls.
- Reduced motion: PASS in source for sidebar/toolbar/preview paths; reduced-motion Play does not enter playing state.
- No page overflow/text collision at tested valid surfaces: PASS after the responsive Trim Path two-column correction.

# 18. Regression Risk Assessment

- HIGH: Full Playwright remains red only because the legacy left-collapse E2E expects the canvas to widen and move left after collapse; the approved V3.3 contract intentionally keeps the 56px rail and fixed stage origin.
- MEDIUM: Right-side hidden-state visual evidence needs a fresh valid final-frame capture.
- LOW: CSS remains cumulative because V3.1/V3.2 working-tree changes are intentionally preserved; no unrelated cleanup was performed.

# 19. Performance Considerations

No new per-frame React state, evaluator, clock, store, or layout-resize loop was added. Sidebar and control motion use transform, opacity, width, and small isolated elements. Existing V3.2 animation cancellation remains in place.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

React/TypeScript/Vite compatibility is verified by TypeScript, Vitest, build, and V6 QA. Browser compatibility is improved for reduced motion and modal keyboard access. Saved-project, serialization, import/export, and migration compatibility are unchanged. The browser tab empty-root issue is a QA tooling/resource limitation observed during capture, not claimed as an application behavior.

- Full Playwright is not green only because of the legacy left-collapse geometry assertion; all V3.3 drawer interception and Trim Path overflow failures are resolved.
- Branch consolidation cannot proceed under the required green/clean gate and current no-Git-operation policy.
- Valid latest-bundle 1440 browser capture was not consistently possible because reload/new-tab sessions intermittently produced an empty root.
- The left-collapse test requires reconciliation with the approved fixed-rail/stage-origin contract.

# 22. Known Limitations

- Full Playwright remains technically red only because the legacy left-collapse geometry assertion conflicts with the approved fixed-rail/stage-origin contract.
- Branch consolidation cannot proceed under the required green/clean gate and current no-Git-operation policy.
- Valid latest-bundle 1440 browser capture was not consistently possible because reload/new-tab sessions intermittently produced an empty root.

# 23. Technical Debt

- Consolidate cumulative V3.1/V3.2/V3.3 CSS layers only in a separately approved cleanup package.
- Add dedicated regression tests for curve modal focus trap, reduced-motion preview, P1/P2 numeric wiring, and Canvas highlight rerender geometry.
- Reconcile the legacy left-collapse E2E expectation with the approved fixed-rail/stage-origin contract.

# 24. Git Summary

- Branch: `feat/v6-ui-bold-v3`.
- Starting/ending HEAD: `52d33e2d5ef09292c544efd12cc9371fcee3485f`.
- Upstream: `origin/feat/v6-ui-bold-v3`.
- Ahead/behind before edits: `0/0`.
- Main: not modified.
- Staged changes: 0.
- Unstaged changes: 13 modified files.
- Untracked files/groups: 11, including V3.1/V3.2/V3.3 evidence and reports.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.

# 25. Updated Project Tree

```text
docs/design/after/v33/                 [new evidence]
reports/progress_041.md                [new]
src/components/Canvas/                 [modified V3.3 visual layer]
src/components/Header/                 [modified V3.3 segmented rail]
src/components/Inspector/              [modified V3.3 header/modal/sidebar]
src/components/Toolbar/                [modified V3.3 rail/drawer]
src/index.css                          [modified semantic aliases]
src/kcsEditorTheme.css                 [modified surface overrides]
src/tests/                              [existing V3.2 tests preserved]
```

# 26. Self Review

Strengths: source-driven Canvas motion survived cleanup; functional authorities were preserved; reviewer-caught P2 and modal accessibility regressions were fixed; exact V5.1 transition compatibility was restored; drawer hit testing and narrow Trim Path layout were corrected; the final full regression narrowed to one legacy contract conflict. Weaknesses: browser evidence is partially constrained by empty-root reload behavior, and the full suite remains technically red on that conflict. Score: 8/10 because the visual package and all actionable V3.3 regressions are verified, but the required full-regression/clean-branch gate is not satisfied.

# 27. Next Recommended Task

Reconcile the legacy left-collapse E2E expectation with the approved fixed-rail/stage-origin contract, without changing the V3.3 geometry unless that product contract is explicitly revised.
# 28. Project Status

V3.3 implementation: completed. Focused QA: PASS. Full Vitest/build/V6 QA: PASS. Full Playwright: FAIL with 251 passed and 1 legacy left-collapse contract failure. Designer post-review: PASS with final hidden-state screenshot polish applied. Reviewer recheck: PASS for the final drawer and Trim Path blockers; full suite remains non-green only for the legacy geometry conflict. Branch consolidation: NOT RUN.


# 29. AI Development Notes

The V3.2 working tree was an intentional baseline and was not cleaned or reverted. Browser tabs can retain a prior bundle; verify current source with build/tests before treating screenshots as latest-bundle evidence. Do not introduce a second domain authority to solve drawer interception or duplicate actions. The right panel’s vertical Outliner/Details divider is not horizontal width-resize behavior and remains intentionally preserved.

## DO NOT CHANGE CASUALLY

- `appMode`, `activeTool`, `showGrid`, zoom, pan, reset, and right visibility authorities.
- `VIEWPORT_TOOL_STEP` and the Canvas highlight WAAPI width/transform grammar.
- 79px header and 56px left rail geometry.
- Absolute left drawer/stage origin contract.
- Duplicate/delete/Boolean dissolve callbacks.
- Value Graph editable and Speed Graph read-only semantics.
- `solveCubicBezier`, pointer capture, preview bounds, reduced-motion behavior.
- Track.channels, timeline evaluation, playback, history, serialization/import/export, masks, mattes, and routing.

# 30. Lessons Learned

A visual cleanup can break E2E contracts through a missing compatibility class even when ARIA semantics remain correct. Geometry constants must be shared between CSS and WAAPI rather than inferred independently. Removing an Inspector mode tab requires preserving every advanced duplicate path and its test-facing accessible name. Fixed-rail overlay designs must be evaluated against pointer hit testing, not only screenshots. Full-regression failures must be classified into real regressions, stale selectors, and contract conflicts before changing product behavior.

# Requested V3.3 Milestone Matrix

- Left/right sidebar visual system: PASS in source; browser evidence PARTIAL.
- Left sidebar animation: PASS.
- Right sidebar animation: PASS.
- Media/Elements separator removed: YES.
- Inspector Edit button removed: YES.
- Duplicate contextual action: PASS; direct and advanced duplicate paths preserved.
- Inspector scanability: PASS in designer review.
- Edit/Broadcast nested rectangles: FIXED.
- Canvas toolbar cleanup: PASS.
- Canvas sliding animation preserved: YES.
- Color system refinement: PASS in source; no dependency change.
- 79px header: PASS.
- 56px left rail: PASS.
- Stage origin: PASS by source contract.
- Branch consolidation: NOT RUN — full regression red, working tree dirty, Git operations prohibited.
- Integration branch `integration/v6-ui-stable`: NOT CREATED.
- Branches removed: none.
- Branches kept: all existing branches; protected and unique work preserved.
- Protected/unique branches preserved: YES.
- Integration branch pushed: NO.

# 31. Post-Report Corrections

After the initial report draft, reviewer findings were applied:

- Restored a single `active` compatibility class and shared 29px Canvas step.
- Restored exact right Inspector `0.24s` width/transform transition strings.
- Restored accessible `Duplicate` name while preserving direct and advanced duplicate paths.
- Added Curve Studio modal semantics, focus trap/restore, label associations, modal guard, reduced-motion Play no-op, and stable callback handling.
- Changed left drawer interaction so the expanded drawer shell does not block Canvas hit testing outside its actual controls; drawer controls remain pointer-enabled.
- Changed Trim Path to two columns by default with three columns only at `360px` container width, fixing the narrow card overflow reproduction.

Post-correction focused results:
- `CI=true npx playwright test e2e/canvas-interaction-v1.spec.ts --workers=1`: PASS, 4 tests.
- Parallelogram single test: PASS.
- Trim Path static authoring single test: PASS.
- Final full Playwright rerun after these corrections: FAIL, 251 passed and 1 failed; the sole failure is the legacy left-collapse expectation that collapsed Canvas width must exceed expanded width. Drawer interception and Trim Path failures are no longer present.
