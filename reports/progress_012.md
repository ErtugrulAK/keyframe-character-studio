# KCS Development Report — Compact Pro Inspector PASS 2.1

Metadata:
- Date: 2026-08-31
- Milestone: Compact Pro Inspector visual surface correction, fixed dock, hide/show
- Branch: `main`
- Starting HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Ending HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Commit status: Intentional uncommitted working-tree changes
- Report number: `progress_012.md`

# 1. Executive Summary

Implemented the approved PASS 2.1 only. Inspector containers now use panel surfaces while editable inputs retain the darkest Inspector surface. The right Inspector is fixed to a 360px desktop dock with a narrow viewport clamp, the user-facing width drag handle and width-resize logic are removed, and a dock-level hide/show control slides the entire Inspector while reclaiming horizontal workspace width. Outliner/Details vertical resizing remains intact.

PASS 3 Control Points matrix conversion, PASS 4 Appearance flattening and hue endpoint correction, PASS 5 remaining Style redesign, and PASS 6 Duplicate redesign were not started.

# 2. Original Objectives

The user-reported gaps were surface hierarchy confusion, unwanted horizontal Inspector resizing, and lack of a professional whole-dock hide/show affordance. Scope was limited to visual surfaces, fixed layout, transient visibility state, accessibility, and regression verification. Authored data and all frozen editor behavior were excluded.

# 3. Problems Discovered

Existing point groups, legacy color cards, and the inline RGBA editor used dark backgrounds close to editable fields. `PropertyInspector` also owned mutable width state and a horizontal drag handle. Conditional unmounting would have lost dock-local Outliner/Details state, so hide/show keeps the dock mounted and collapses its flex width instead.

# 4. Files Created

- `reports/progress_012.md`: permanent implementation record.
- `src/tests/propertyInspector.test.tsx`: focused Inspector shell visibility and fixed-resizer coverage.

# 5. Files Modified

- `src/App.tsx`: owns transient `isInspectorVisible`, renders hide/show wiring, and keeps the Inspector mounted while hidden.
- `src/components/Inspector/PropertyInspector.tsx`: removes width state/resizer logic, accepts visibility props, and adds accessible dock-level Hide Inspector button.
- `src/components/Inspector/PropertyInspector.css`: adds fixed 360px dock sizing with narrow clamp, hidden-state transition, show/hide affordance, and panel-vs-input surface hierarchy.
- `src/components/Inspector/sections/style/StyleCard.tsx`: existing PASS 2 disclosure shell remains the shared section surface used by this pass.
- `src/components/Inspector/sections/style/StyleGeometrySection.tsx`, `TrimPathSection.tsx`, `StyleAppearanceSection.tsx`, `StyleColorSection.tsx`, `StyleTextFields.tsx`, `StyleEffectsSection.tsx`, `StyleMatteSection.tsx`, `StyleClonerSection.tsx`, `StyleParticleSection.tsx`, `src/components/Inspector/sections/TransformTab.tsx`: preserved prior PASS 2 disclosure changes; no new section behavior introduced in PASS 2.1.
- `src/tests/styleAppearanceSection.test.tsx`, `src/tests/styleMatteSection.test.tsx`, `src/tests/transformInOutPreset.test.tsx`: preserved prior PASS 2 test adaptations.

Earlier intentional Appearance/color work and progress reports were preserved.

# 6. Architecture Overview

```text
MainAppContent (transient isInspectorVisible)
  ├── StageCanvas
  ├── PropertyInspector(isHidden, onHide)
  │   ├── OutlinerPanel
  │   ├── vertical Outliner/Details divider
  │   └── DetailsPanel
  └── edge Show Inspector button when hidden
```

The Inspector remains a sibling flex item of StageCanvas. Hidden state sets its width/flex basis to zero, so the canvas receives released space without changing authored coordinates. The component remains mounted, preserving Outliner/Details local UI state and selection context.

# 7. Data Model Changes

None. Visibility is local React UI state in `MainAppContent`. It is not in SceneData, templates, sequences, tracks, JSON, localStorage, history, or undo/redo.

# 8. Coordinate Space Model

No coordinate conversion changed. StageCanvas naturally receives a different DOM width when the sibling dock collapses; authored object coordinates, transform state, selection state, and renderer contracts are untouched.

# 9. Component / Module Walkthrough

`App.tsx` controls whole-dock visibility because it owns the flex boundary where workspace width is reclaimed. `PropertyInspector.tsx` remains responsible for Outliner/Details composition and the vertical divider, while its former horizontal width state and width mouse listeners are removed. CSS provides 180ms dock transition, zero-width hidden state, reduced-motion override, fixed desktop width, and edge affordance styling.

# 10. Important Code Changes

Desktop width contract:

```css
--right-inspector-width: 360px;
width: min(var(--right-inspector-width), max(250px, 34vw));
flex: 0 0 min(var(--right-inspector-width), max(250px, 34vw));
```

Hidden state collapses the flex item rather than reserving a blank gutter:

```css
.motion-design-right-sidebar.is-hidden {
  width: 0;
  min-width: 0;
  flex-basis: 0;
  opacity: 0;
  transform: translateX(100%);
  pointer-events: none;
}
```

# 11. Public Interfaces

`PropertyInspector` now requires two UI-only props: `onHide` and `isHidden`. No application-level public API or domain interface changed. The existing vertical divider callback and Outliner/Details children remain unchanged.

# 12. Algorithms and Geometry

No geometry algorithm changed. Dock width is a CSS/flex layout concern. The only state transition is boolean visibility; no authored transform or viewport math is written.

# 13. Interaction / UX Behavior

- Visible dock: 360px desktop Inspector with top-level Hide Inspector icon.
- Hidden dock: zero-width flex item translated toward the right; StageCanvas expands into the released area; small Show Inspector edge button remains in the main layout.
- Reopen: same mounted PropertyInspector returns, preserving Outliner/Details state.
- Width dragging: removed; no horizontal resizer DOM or width listeners remain.
- Vertical Outliner/Details divider: preserved and remains `ns-resize`.
- Surface hierarchy: panel/group wrappers use panel surfaces; editable number/text/select/HEX controls remain dark `bg-input`; specialized hue/alpha controls remain specialized surfaces.

# 14. Design Decisions

- Chosen fixed width: 360px, within the approved 340–380px range and aligned with the prior 400px Inspector contract while reducing excess width.
- Visibility owner: `MainAppContent`, the smallest existing layout owner capable of reclaiming flex space.
- Hidden implementation: mounted zero-width dock, not `display:none` or a removed component, to preserve local Outliner/Details state and permit a restrained transition.
- Icon vocabulary: existing `lucide-react` `PanelRightClose` and `PanelRightOpen`; no dependency change.
- Transition: 180ms ease with reduced-motion override; no spring or blur.

# 15. Invariants That Must Be Preserved

- No authored property callback is called by hide/show.
- No visibility state enters project data or history.
- Outliner and Details hide/show together.
- Outliner/Details vertical divider remains functional.
- Selection, Boolean, transform, control-point, Appearance, matte, animation, renderer, serialization, and timeline behavior remain unchanged.
- PASS 3/4 work remains deferred.

# 16. Testing and Verification

- Focused tests: `node ./node_modules/vitest/vitest.mjs run src/tests/propertyInspector.test.tsx src/tests/styleAppearanceSection.test.tsx src/tests/styleMatteSection.test.tsx src/tests/transformInOutPreset.test.tsx` — PASS, 4 files / 155 tests.
- Full Vitest: `npm test` — PASS, 82 files / 1,342 tests.
- Relevant browser regressions: `cmd /d /s /c "set CI=&& node ./node_modules/@playwright/test/cli.js test e2e/shape-appearance-bounds.spec.ts e2e/editor-interaction.spec.ts e2e/left-toolbar-collapse.spec.ts"` — PASS, 12 tests.
- TypeScript: `npx tsc --noEmit` — PASS.
- Lint: `npm run lint` — PASS with one pre-existing `react(only-export-components)` warning.
- Production build: `npm run build` — PASS; existing Vite large-chunk warning.
- `git diff --check` — PASS; expected Windows line-ending warnings only.
- Full E2E: not rerun for PASS 2.1; prior run had known unrelated baseline failures and was not claimed as a PASS.

# 17. Manual QA Results

- PASS — live browser Inspector width measured 360px with vertical Outliner/Details divider present.
- PASS — clicking Hide Inspector produced `.is-hidden`, width 0, and Show Inspector affordance; workspace sibling remained available.
- PASS — clicking Show Inspector restored width 360px, hide affordance, and vertical divider.
- NOT TESTED — full user visual assessment at normal/narrow/wide widths; reserved for user QA.
- NOT TESTED — full Fill/Stroke editing sequence; unchanged and reserved for user QA.

# 18. Regression Risk Assessment

Overall risk: MEDIUM. The layout boundary changed and the Inspector remains mounted at zero width when hidden. Existing focused tests pass, and no domain mutation path changed. The primary remaining risk is visual/interaction quality of the dock transition and narrow-width clamp.

# 19. Performance Considerations

Visibility uses one local boolean and CSS transitions for width/flex/transform/opacity. No rendering loop, listener, geometry calculation, or storage operation was added. Removing width drag listeners reduces shell interaction overhead.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

No SceneData, serialized project, track, renderer, coordinate, or public domain contract changed. Existing Outliner/Details local state stays mounted through visibility transitions. Existing global KCS tokens and lucide-react dependency are reused.

# 22. Known Limitations

- Fixed-width visual proportion and hide/show animation require user visual approval.
- The hidden Inspector remains in the DOM with `aria-hidden=true`; the hide button is removed from tab order while hidden, and the external Show button is the active affordance.
- Full E2E was not rerun in this pass; known baseline failures remain outside the changed contract.
- Control Points matrix, Appearance flattening, and hue endpoint correction remain deferred.

# 23. Technical Debt

PropertyInspector width is now CSS-driven, but the global `--inspector-width` token remains available elsewhere and was not globally migrated. Future responsive work should be separately approved rather than adding ad hoc breakpoints.

# 24. Git Summary

- Branch: `main`
- HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- origin/main: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Ahead/behind: `0/0`
- Working tree: prior intentional Appearance/PASS 2 files plus PASS 2.1 App, Inspector shell/CSS, tests, and this report.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.

# 25. Updated Project Tree

```text
reports/progress_012.md                              [new]
src/App.tsx                                           [modified]
src/components/Inspector/PropertyInspector.tsx       [modified]
src/components/Inspector/PropertyInspector.css       [modified]
src/tests/propertyInspector.test.tsx                 [new]
```

# 26. Self Review

Good: visibility is owned at the correct flex boundary, the dock remains mounted, horizontal resize code is removed, and fixed-width/surface contracts have focused coverage. Improvement needed: live visual hide/show review remains intentionally deferred to the user checkpoint. Score: 8/10.

# 27. Next Recommended Task

Perform user visual QA of the fixed 360px Inspector, surface hierarchy, hide/show transition, and preserved selection/Outliner/Details state.

# 28. Project Status

PASS 2.1 implementation: COMPLETE pending user visual QA. PASS 3, PASS 4, PASS 5, and PASS 6: NOT STARTED.

# 29. AI Development Notes

Keep visibility in `MainAppContent`; do not move it into SceneData or AnimatorContext. Keep `PropertyInspector` mounted during hidden state so local Outliner/Details state survives. The vertical divider is distinct from the removed horizontal width resizer. Do not touch Appearance color math or hue endpoint behavior in this pass.

## DO NOT CHANGE CASUALLY

- StageCanvas coordinate/viewport authority.
- DetailsPanel mutation/history flow.
- Outliner selection/visibility/reorder behavior.
- Boolean geometry/lifecycle/operand behavior.
- Existing Appearance editor and color utilities.
- StyleCard disclosure state semantics.

# 30. Lessons Learned

The correct hide/show seam is the flex sibling boundary, not an internal Details section. Keeping the dock mounted preserves local UI state while zeroing flex basis reclaims workspace width. Surface hierarchy is best corrected through scoped container/input roles instead of globally lightening every dark element.
