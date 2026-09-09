# KCS Development Report — V3.2 Source-Driven Interaction Redesign

Metadata:
- Date: 2026-09-09
- Milestone: KCS V3.2 SOURCE-DRIVEN INTERACTION REDESIGN
- Branch: `feat/v6-ui-bold-v3`
- Starting HEAD: `52d33e2d5ef09292c544efd12cc9371fcee3485f`
- Ending HEAD: `52d33e2d5ef09292c544efd12cc9371fcee3485f`
- Report number: 040
- Commit status: Uncommitted; commit prohibited by repository session policy.

# 1. Executive Summary

V3.2 applies the approved source-driven interaction redesign while preserving V3.1 behavior. The Canvas viewport highlight now uses a source-level reAnimate-style Web Animations API sequence; Edit/Broadcast has a state-specific moving indicator with squash/spring settle; the left rail is a fixed 56px load-bearing surface with an adjacent absolute drawer; Curve Preview samples the canonical cubic evaluator and clamps progress to the safe mini-stage; and the Canvas toolbar has roving keyboard navigation.

No dependencies, Sass, jQuery, Octicons, duplicate state, duplicate evaluator, playback clock, serializer, or history authority were added.

# 2. User Feedback

The user required source-level, not merely visual, adaptation of the three supplied CodePens. This report separately verifies that supplemental requirement in section 16. The acceptance bar was raised: opacity/color/ARIA-only imitation is insufficient; before/after visual differences must be observable.

# 3. User-Supplied Source References

1. `Toolbars With Sliding Selection` — source inspected. `reAnimate(tool)` computes previous/next positions, stretched widths, and calls `animRef.current.animate` with 300ms `cubic-bezier(0.65,0,0.35,1)`; source also implements pressed-derived tab index and Arrow/Home/End navigation.
2. `Collapsable Icon Toolbar` — source inspected. JavaScript toggles one expanded class on toolbar and edge toggle; CSS uses a 54px rail, expanded drawer, title reveal, absolute edge toggle, separator, and `cubic-bezier(0,1.15,1,0.93)`.
3. `Squishy Toggle Switch` — source inspected. Semantic checkbox state plus modifier class triggers plain CSS transition/keyframe movement, shape/border-radius morph, and press scale.

# 4. Source Adaptation Matrix

Created `docs/design/KCS_UI_V32_SOURCE_ADAPTATION_MATRIX.md`. It records SOURCE MECHANISM, KCS TARGET, ADAPTED, REJECTED, IMPLEMENTATION MECHANISM, ACCESSIBILITY, PERFORMANCE, FUNCTIONAL INVARIANT, and TEST PLAN for all three references, plus source-level code observations.

# 5. Branch / Checkpoint

The existing V3/V3.1 work was already uncommitted on `feat/v6-ui-bold-v3` and matched the known session baseline. A Git checkpoint commit or dedicated branch was not created because branch and commit operations are prohibited by the active repository session policy. `main` was not modified.

# 6. Files Changed

Modified:
- `src/components/Canvas/overlays/CanvasViewportToolbar.tsx`
- `src/components/Canvas/StageCanvas.css`
- `src/components/Header/HeaderBar.tsx`
- `src/components/Header/HeaderBar.css`
- `src/components/Toolbar/LeftToolbar.tsx`
- `src/components/Toolbar/LeftToolbar.css`
- `src/components/Inspector/InteractiveCubicBezierEditor.tsx`
- `src/components/Inspector/TemporalGraphPanel.tsx`
- `src/components/Inspector/PropertyInspector.css`
- `src/kcsEditorTheme.css`
- `src/tests/TemporalGraphPanel.test.tsx`

New:
- `src/tests/CanvasViewportToolbar.test.tsx`
- `docs/design/KCS_UI_V32_SOURCE_ADAPTATION_MATRIX.md`
- `docs/design/baseline/v32/`
- `docs/design/after/v32/`
- `reports/progress_040.md`

# 7. Edit/Broadcast

`HeaderBar` retains `appMode` and `setAppMode` as the only state authority. The two native buttons keep `aria-pressed`. `.header-mode-indicator` is the single moving layer. `kcsModeIndicatorSettleEdit` and `kcsModeIndicatorSettleBroadcast` rerun on actual mode-class changes, with translate, scaleX squash/stretch, 300ms overshoot easing, and active press scale. Inline active backgrounds were removed so the indicator remains visible.

# 8. Canvas Sliding Toolbar

`CanvasViewportToolbar` keeps Select/Pan/Grid/Zoom/Reset semantics. Select/Pan use roving `tabIndex`, Arrow keys, Home, and End. The separate `.viewport-tools-highlight` is pointer-transparent and remains inside the existing absolute overlay. A Web Animations API call changes transform and width through four keyframes: rest, stretch, slide, settle. Previous animations are canceled and reduced-motion bypasses the animation.

# 9. Left Toolbar

`LeftToolbar` retains `activeCategory` and `isCollapsed`. CSS fixes the rail at 56px with `flex: 0 0 56px`; the drawer is adjacent and absolute, so drawer reveal does not change the rail/stage origin. Drawer reveal uses opacity/transform and `cubic-bezier(0,1.15,1,0.93)`. Collapse sets `aria-hidden` and `visibility:hidden`; family separation and selected-state motion remain subtle.

# 10. Right Inspector

V3.1 scanable grouping is preserved. Existing section, action, disclosure, tab, and chip transitions remain property-scoped. No aggressive panel slide, card-everywhere treatment, unit collision, or layout-jitter mechanism was introduced.

# 11. Curve Value/Speed

Value Graph remains editable and labeled `EDITABLE`. Speed Graph remains derived from the shared interpolation evaluator, visibly muted/dashed, and labeled `DERIVED · READ ONLY`; it renders no editable point controls. The value drag domain is frozen for each gesture. Direct P1/P2 numeric inputs enforce X `[0,1]` and Y `[-1,2]`.

# 12. Curve Drag Lifecycle

V3.1 pointer capture, outside-release safety, and backdrop-dismiss suppression remain intact. Focused graph tests cover Value/Speed semantics; browser QA previously verified external P1/P2 dragging outside the modal without dismissal.

# 13. Preview

Preview remains paused by default with explicit Play/Pause. `InteractiveCubicBezierEditor` imports canonical `solveCubicBezier`, samples 25 progress points, clamps each evaluated output to `[0,1]`, and feeds the safe positions to a WAAPI animation. The ball remains inside `clamp(14px, progress%, calc(100% - 40px))`. Reduced motion cancels/skips the WAAPI animation.

# 14. MCP / Tooling Decision

Browser tooling was used for real CodePen source inspection, application interaction, screenshots, accessibility tree inspection, WAAPI animation inspection, and safe-stage geometry measurement. No shadcn MCP, 21st/Magic MCP, plugin87 skill, or Chrome DevTools MCP mount was available in the active tool inventory; no dependency was installed to imitate them. No Sass, jQuery, or Octicons were added.

# 15. Accessibility

Native button semantics remain. Header and toolbar controls expose `aria-pressed`; Canvas Select/Pan has roving tab stops and Arrow/Home/End navigation; collapsed drawer is `aria-hidden`; tooltips remain available through titles/labels; focus-visible styling is retained.

# 16. Supplemental Source Instruction Verification

This section separately verifies the later source-level instruction. Status values are explicit and tied to actual files, mechanisms, and visual evidence.

## 16.1 Sliding Selection

**Status: IMPLEMENTED**

- **Mechanism:** `src/components/Canvas/overlays/CanvasViewportToolbar.tsx` uses `highlightRef.current.animate(...)` with transform keyframes and width keyframes `28px → 42px → 34px → 28px`, then settles at the target tool position. The duration is 300ms and easing is `cubic-bezier(0.65,0,0.35,1)`. Prior animations are canceled through `highlightAnimationRef`.
- **Component:** `CanvasViewportToolbar`.
- **Accessibility:** `aria-pressed`, roving `tabIndex`, Arrow/Home/End navigation, native buttons, title/aria labels.
- **Visual evidence:** `docs/design/after/v32/after-full-1440x900.webp`, `after-full-1366x768.webp`, and `after-full-1920x1080.webp` show the separated active rail; browser WAAPI inspection observed a 300ms animation with the four width/transform keyframes.

## 16.2 Collapsable Toolbar

**Status: IMPLEMENTED**

- **Rail:** `src/components/Toolbar/LeftToolbar.css` fixes `.left-toolbar-container` and `.left-sidebar-nav` to 56px; `flex: 0 0 56px` prevents drawer reveal from changing rail geometry.
- **Drawer/reveal:** `.left-drawer-panel` is absolute at `left:56px`, with opacity/transform reveal and `visibility:hidden` plus `aria-hidden` when collapsed.
- **Overshoot:** The drawer transition uses `cubic-bezier(0,1.15,1,.93)` over 300ms.
- **Component:** `src/components/Toolbar/LeftToolbar.tsx` retains existing `activeCategory`/`isCollapsed` authorities and separate edge toggle.
- **Visual evidence:** `after-full-1440x900.webp` and `after-left-toolbar-collapsed-1440x900.webp` show expanded and collapsed states; the rail remains visible and the drawer disappears without removing the rail.

## 16.3 Squishy Toggle

**Status: IMPLEMENTED**

- **Moving indicator:** `src/components/Header/HeaderBar.tsx` renders one `.header-mode-indicator`; `appMode` changes the parent class and therefore indicator target.
- **Squash/stretch:** `src/components/Header/HeaderBar.css` uses `scaleX(.86) → scaleX(1.08) → scaleX(.97) → scaleX(1)` in the Edit/Broadcast settle keyframes.
- **Spring/settle:** `kcsModeIndicatorSettleEdit` and `kcsModeIndicatorSettleBroadcast` use `cubic-bezier(0,1.15,1,.93)` and distinct travel paths. The button active state applies `scale(.97)`.
- **No forbidden technology:** No Sass, jQuery, or Octicons were added. Implementation uses existing React plus plain CSS.
- **Visual evidence:** `after-broadcast-1440x900.webp` and the browser animation inspection show a 300ms translate/scale indicator animation; baseline mode controls are in `docs/design/baseline/v32/`.

# 17. Reduced Motion

Canvas WAAPI animation, header indicator animation, drawer reveal, and CSS transitions are disabled or bypassed under `prefers-reduced-motion: reduce`. Preview WAAPI animation is canceled/skipped under the same preference.

# 18. Performance

All visual motion uses transform, width, opacity, border/background, or WAAPI on small isolated elements. Canvas highlight animation cancels previous animation instances. No per-frame React state update, evaluator duplication, layout-wide animation, or new dependency was introduced.

# 19. Focused Tests

- `npx tsc --noEmit`: PASS.
- `npx vitest run src/tests/CanvasViewportToolbar.test.tsx src/tests/leftToolbar.test.tsx src/tests/TemporalGraphPanel.test.tsx`: PASS, 3 files / 12 tests.
- `npm test`: PASS, 100 files / 1423 tests.
- `npm run lint`: PASS with one pre-existing `AnimatorContext.tsx:655` Fast Refresh warning.
- `npm run build`: PASS; existing large chunk warning only.
- `npm run qa:v6`: PASS, 3 tests.
- `git diff --check`: PASS with Git's existing LF/CRLF advisory only.

# 20. Playwright Stabilization

`CI=true npm run test:e2e` was rerun with a 900-second timeout. It did not reach a green completion: 252 tests started and the command timed out with many intermediate `×`, `F`, and `T` markers. No retries, sleeps, skipped tests, weakened assertions, or hidden failures were introduced. Full Playwright status is FAIL/PARTIAL, not PASS.

# 21. Browser QA

Real browser verification covered:
- Header pressed states and Broadcast indicator.
- Canvas Select/Pan pressed states, roving focus behavior, and a measured 300ms WAAPI highlight animation.
- Left expanded/collapsed rail and drawer screenshots.
- Inspector grouping and graph semantics from V3.1 plus V3.2 after surfaces.
- Curve preview paused/playing states, canonical WAAPI animation, and measured ball bounds inside stage bounds.
- Full editor at 1366x768, 1440x900, and 1920x1080.

# 22. Designer Review

Initial designer review: NEEDS POLISH because inline HeaderBar backgrounds obscured the indicator. Focused polish removed those inline styles and added state-specific indicator keyframes. Post-polish designer review: PASS, high confidence, no blockers.

# 23. Reviewer Findings

The independent reviewer initially identified mode-transition replay, missing valid 1366/1920 evidence, reverse-direction Canvas highlight geometry, animation accumulation, collapsed drawer accessibility, and three accessibility/input details. The implementation addressed these findings through state-specific Header keyframes, valid recaptured screenshots, centered highlight transform origin, animation cancellation/cleanup, `aria-hidden`/visibility handling, Header `aria-pressed`, SVG keyframe `role="button"` plus keyboard `preventDefault`, P2 Y `step={0.05}`, and a live reduced-motion media-query listener for Preview. Focused TypeScript, lint, and tests pass after the corrective patch. Full E2E timeout remains unresolved and is recorded honestly.

# 24. Before/After Evidence

Baseline: `docs/design/baseline/v32/` copied from the verified V3.1 surface before V3.2 edits.

After:
- `after-full-1366x768.webp`
- `after-full-1440x900.webp`
- `after-full-1920x1080.webp`
- `after-left-toolbar-collapsed-1440x900.webp`
- `after-broadcast-1440x900.webp`
- `after-curve-paused-1440x900.webp`
- `after-curve-playing-1440x900.webp`

All required after viewport captures are non-white and visually inspectable.

# 25. Known Limitations

- Full Playwright remains non-green and requires a separate failure-classification/stabilization milestone.
- The source-driven visuals are implemented with KCS geometry and icons, not copied source assets.
- Continuous drag history batching remains V3.1 technical debt and was not expanded into this interaction-visual package.

# 26. Git Summary

- Branch: `feat/v6-ui-bold-v3`.
- HEAD unchanged: `52d33e2d5ef09292c544efd12cc9371fcee3485f`.
- Upstream parity before edits: 0 ahead / 0 behind.
- `main`: not modified.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.
- Working tree: DOCUMENTED FILES — expected V3.1/V3.2 source, tests, docs, screenshots, and reports are uncommitted.

# 27. Manual QA

- Edit/Broadcast moving indicator: PASS.
- Squash/spring: PASS after focused polish.
- Canvas sliding highlight: PASS.
- Canvas keyboard navigation: PASS through focused tests and browser accessibility state.
- Left toolbar/drawer motion: PASS.
- Inspector readability: PASS.
- Value Graph: PASS.
- Speed Graph: PASS.
- P1/P2 external drag: PASS from V3.1 browser verification.
- Preview paused: PASS.
- Preview bounded: PASS; measured ball remained inside stage bounds.
- V-M1: NOT LOCATED as a repository label. The mapped Edit/Broadcast mode-transition checks pass through focused/browser verification.
- V-H2: NOT LOCATED as a repository label. The mapped Canvas/Left/Inspector state-ownership and accessibility checks pass through focused/browser verification.

# 28. Scope Audit

In scope: source-level reference analysis, Canvas WAAPI interaction, mode indicator, 56px rail/drawer reveal, accessibility, preview evaluator reuse, focused tests, screenshots, review, and regression attempts. Out of scope and unchanged: domain model, evaluator authority, playback, broadcast semantics, serialization, migration, history authority, dependencies, main branch, merge, commit, and push.

# 29. DO NOT CHANGE CASUALLY

- `appMode` / `setAppMode` authority in the broadcast context.
- `activeTool` / `setActiveTool`, `showGrid`, zoom, and pan callbacks.
- 56px left rail and absolute viewport overlay positioning.
- `interpolateChannel` and `solveCubicBezier` as canonical evaluators.
- Pointer capture and backdrop-dismiss suppression in curve editing.
- Value editable versus Speed derived/read-only semantics.
- Serialization, migration, timeline, playback, history, and broadcast state ownership.
- Reduced-motion bypasses and animation cancellation cleanup.

# 30. Lessons Learned

Source-level inspection exposed that the useful part of the sliding toolbar reference is not its color treatment but its computed movement/width keyframe grammar. Fixed rail geometry is a layout contract, not merely a visual preference. A separate indicator layer must remain visually unobstructed by button backgrounds. Screenshot validity must be checked by image content and file size, not only by command completion. Full Playwright timeouts must remain visible in the report even when focused unit, build, and browser checks pass.

# 31. Project Status

V3.2 source-driven interaction implementation is ready for user visual QA. Focused validation and V6 QA pass; designer post-polish review passes; full Playwright remains blocked by timeout/failures and is not claimed green. Main is untouched and no Git history operation was performed.
