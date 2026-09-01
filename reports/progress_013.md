# KCS Development Report — Compact Pro Inspector PASS 2.2

Metadata:
- Date: 2026-08-31
- Milestone: Control Point surface correction and stable Inspector toggle placement
- Branch: `main`
- Starting HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Ending HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Commit status: Intentional uncommitted working-tree changes
- Report number: `progress_013.md`

# 1. Executive Summary

PASS 2.2 corrected the two user-identified PASS 2.1 visual issues without changing editor behavior. Control Point group wrappers now have an explicit panel-surface class that overrides the previous near-black inline wrapper fill; their X/Y inputs remain Inspector editable fields. The Inspector hide/show action is now one persistent button mounted at the `main-layout` right edge, vertically centered, with only its icon and accessible label changing between states.

# 2. Original Objectives

In scope: Control Point wrapper surface hierarchy, one stable dock-toggle anchor, focused tests, and regression verification. Out of scope: Control Point matrix conversion, Transform flattening, Appearance redesign, hue endpoint behavior, Effects/Matte redesign, disclosure changes, Outliner redesign, fixed-width changes, and all authored behavior changes.

# 3. Problems Discovered

PASS 2.1 left Control Point wrappers with inline `#0e1118`, making the wrapper visually indistinguishable from its nested inputs. PASS 2.1 used separate visible/hidden toggle positions: visible state was anchored relative to the dock width and hidden state was anchored at the workspace edge, so the button moved horizontally when the dock collapsed. Live verification measured the movement as X `1068 → 1428`.

# 4. Files Created

- `reports/progress_013.md`: this permanent report.
- `src/tests/appInspectorToggle.test.tsx`: new focused test for one-toggle state behavior.

# 5. Files Modified

- `src/components/Inspector/sections/transform/TransformControlPoints.tsx`: added `control-point-group` class to all Edge and Corner point wrappers; values, labels, inline geometry logic, and callbacks unchanged.
- `src/components/Inspector/PropertyInspector.css`: added the panel-surface override for `.control-point-group`; replaced state-dependent toggle positioning with one fixed `right: 0` main-layout anchor.
- `src/App.tsx`: retained one mounted dock toggle and switched its icon/label from Hide to Show based on visibility; PropertyInspector remains mounted with `isHidden`.
- `src/components/Inspector/PropertyInspector.tsx`: removed the duplicate internal hide button and retained only dock composition/vertical divider responsibilities.
- `src/tests/propertyInspector.test.tsx`: updated shell expectations for the single App-owned toggle architecture.

All prior intentional Appearance, PASS 1, and PASS 2 changes were preserved.

# 6. Architecture Overview

```text
App/MainAppContent
  ├── StageCanvas
  ├── one persistent .inspector-dock-toggle (right: 0, top: 50%)
  └── PropertyInspector(isHidden)
      ├── OutlinerPanel
      ├── vertical Outliner/Details divider
      └── DetailsPanel
```

The toggle is a layout-boundary affordance, not part of Outliner, Details, Appearance, or Transform. `PropertyInspector` stays mounted while hidden, so the existing local Outliner/Details state survives.

# 7. Data Model Changes

None. No CharacterPart, SceneData, track, serialization, history, or authored property changed. Visibility remains transient local React state in `MainAppContent`.

# 8. Coordinate Space Model

Not applicable to the Control Point styling or dock control. StageCanvas receives natural flex-layout width changes only; no coordinate conversion or authored transform update was introduced.

# 9. Component / Module Walkthrough

`TransformControlPoints` now labels each existing Edge and Corner wrapper with `control-point-group`. CSS makes the wrapper `var(--bg-panel)` and keeps the nested `SmartNumberInput` inputs dark. `App.tsx` renders exactly one toggle sibling at the main-layout boundary. `PropertyInspector` accepts only `isHidden`, and its vertical divider remains unchanged.

# 10. Important Code Changes

```css
.control-point-group {
  background: var(--bg-panel) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: var(--radius-xs) !important;
}

.main-layout .inspector-dock-toggle {
  top: 50%;
  right: 0;
  transform: translate(50%, -50%);
}
```

The same mounted button changes only `PanelRightClose`/`PanelRightOpen`, `aria-label`, and `title` as visibility changes.

# 11. Public Interfaces

No domain/public API changed. The internal `PropertyInspector` prop surface was simplified from `{ isHidden, onHide }` to `{ isHidden }`; App is the sole visibility owner.

# 12. Algorithms and Geometry

No algorithms changed. Existing Control Point calculations and callbacks are byte-for-byte behavior-preserved; only wrapper class names and CSS are different.

# 13. Interaction / UX Behavior

- Control Point group surfaces read as panel/group containers; nested X/Y fields remain editable dark controls.
- Visible Inspector: one centered right-edge button labeled Hide Inspector.
- Hidden Inspector: the same DOM button remains at the same right-edge anchor, labeled Show Inspector.
- Dock width remains 360px when visible and 0px when hidden.
- Outliner/Details divider remains present inside the mounted Inspector.

# 14. Design Decisions

- Added a semantic class to existing wrappers rather than changing the future Control Point layout.
- Chose `main-layout` right edge as the single persistent anchor because it exists in both dock states and does not move with the collapsing flex item.
- Removed duplicate hide/show buttons; one mounted control is the authority for the interaction.
- Kept the existing 180ms dock transition and no new motion behavior.

# 15. Invariants That Must Be Preserved

- Edge/Corner modes, point values, labels, calculations, callbacks, keyboard editing, selection, geometry, and history remain unchanged.
- Exactly one dock toggle is mounted in Edit mode.
- Hide/show does not mutate authored project state.
- Fixed 360px visible width and zero-width hidden workspace reclaim remain unchanged.
- Outliner, Details, vertical divider, selection, Appearance, Boolean, transform, renderer, serialization, and timeline behavior remain unchanged.
- PASS 3 and PASS 4 remain deferred.

# 16. Testing and Verification

- Focused command: `node ./node_modules/vitest/vitest.mjs run src/tests/appInspectorToggle.test.tsx src/tests/propertyInspector.test.tsx src/tests/styleAppearanceSection.test.tsx src/tests/shapeAppearance.test.ts` — PASS, 4 files / 38 tests.
- Full Vitest: `npm test` — PASS, 83 files / 1,342 tests.
- Relevant browser E2E: `cmd /d /s /c "set CI=&& node ./node_modules/@playwright/test/cli.js test e2e/shape-appearance-bounds.spec.ts e2e/editor-interaction.spec.ts"` — PASS, 11 tests.
- TypeScript: `npx tsc --noEmit` — PASS.
- Lint: `npm run lint` — PASS with one pre-existing `react(only-export-components)` warning.
- Production build: `npm run build` — PASS; existing large-chunk warning.
- `git diff --check` — PASS with expected Windows line-ending warnings.
- Live Chromium smoke: PASS — one toggle, visible width 360px, hidden width 0px, stable X/Y position, Show/Hide labels switched, vertical divider restored.

# 17. Manual QA Results

- PASS — Control Point wrapper CSS hierarchy is represented by a dedicated class; visual user confirmation remains pending.
- PASS — one stable toggle anchor measured before/hidden/after at identical X/Y coordinates.
- PASS — hidden state exposed Show Inspector and visible state exposed Hide Inspector.
- NOT TESTED — full user visual review at normal/narrow/wide widths; next checkpoint.
- NOT TESTED — full Edge/Corner visual review; next checkpoint.

# 18. Regression Risk Assessment

Overall risk: LOW to MEDIUM. Control Point changes are wrapper-class/CSS-only. Toggle changes touch the layout boundary but preserve mounted children and existing visibility state. Focused, full Vitest, relevant E2E, typecheck, lint, build, diff check, and live toggle smoke all pass.

# 19. Performance Considerations

No new loop or global listener. One CSS transition remains on the dock; one local boolean controls visibility. The persistent toggle avoids mounting duplicate controls.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

No serialized, renderer, geometry, animation, selection, or saved-project compatibility change. Existing lucide-react icons are reused.

# 22. Known Limitations

- Full E2E was not rerun; earlier repository baseline had unrelated failures and no new full-suite claim is made here.
- User visual QA remains required for Control Point contrast and final toggle placement feel.
- PASS 3 Control Point matrix and PASS 4 Appearance/hue work remain deferred.

# 23. Technical Debt

Control Point wrappers still use inline style objects for non-visual layout values; only the visual surface override was added to keep this correction narrow. Future PASS 3 may replace the layout, but must preserve all current math and callbacks.

# 24. Git Summary

- Branch: `main`
- HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- origin/main: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Ahead/behind: `0/0`
- Working tree: prior intentional Appearance/Compact Pro changes plus PASS 2.2 App, Inspector, Control Point, CSS, test, and report changes.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.

# 25. Updated Project Tree

```text
reports/progress_013.md                                  [new]
src/App.tsx                                               [modified]
src/components/Inspector/PropertyInspector.tsx            [modified]
src/components/Inspector/PropertyInspector.css            [modified]
src/components/Inspector/sections/transform/
  TransformControlPoints.tsx                              [modified]
src/tests/appInspectorToggle.test.tsx                     [modified]
src/tests/propertyInspector.test.tsx                      [modified]
```

# 26. Self Review

Good: the toggle is now genuinely one persistent control at a stable layout anchor, and Control Point wrapper styling is isolated from behavior. Improvement needed: final visual QA at all supported widths remains with the user. Score: 8/10.

# 27. Next Recommended Task

Perform user visual QA of Control Point surface contrast and the single centered right-edge toggle before approving PASS 3.

# 28. Project Status

PASS 2.2 implementation: COMPLETE pending user visual QA. PASS 3 and PASS 4: NOT STARTED.

# 29. AI Development Notes

The stable anchor is the `main-layout` right edge, not the collapsing Inspector seam. Keep one toggle mounted. The dock remains mounted hidden to preserve Outliner/Details state. Do not touch Control Point calculations or the Appearance/hue implementation in this pass.

## DO NOT CHANGE CASUALLY

- Control Point values, Edge/Corner modes, and callbacks.
- `MainAppContent` visibility ownership.
- 360px fixed dock and vertical divider.
- Appearance color math and hue endpoint behavior.
- Boolean, selection, renderer, history, and serialization authorities.

# 30. Lessons Learned

A seam-based button can still move when the flex item it references collapses. Anchoring the single control to the persistent parent boundary satisfies both stable placement and workspace reclaim. Explicit wrapper classes are safer than broad dark-surface overrides when only one visual hierarchy needs correction.
