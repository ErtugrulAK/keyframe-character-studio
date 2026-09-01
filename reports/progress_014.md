# KCS Development Report — Compact Pro Inspector PASS 2.3

Metadata:
- Date: 2026-08-31
- Milestone: Dock toggle edge-affordance refinement
- Branch: `main`
- Starting HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Ending HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Commit status: Intentional uncommitted working-tree changes
- Report number: `progress_014.md`

# 1. Executive Summary

PASS 2.3 refines the PASS 2.2 Inspector toggle placement after user QA. The single mounted toggle now follows the logical dock seam: when visible it half-overlaps the Inspector's left edge; when hidden it half-overlaps the application's right workspace edge. It remains vertically centered and changes only icon, label, and title. Control Point surfaces remain unchanged and continue to pass the previous user QA result.

# 2. Original Objectives

In scope: improve dock-toggle discoverability while preserving one mounted toggle, 360px visible width, zero-width hidden dock, workspace reclaim, selection/state preservation, and all prior surface corrections. Out of scope: Control Point matrix conversion, Appearance, hue endpoint, disclosure behavior, Outliner, Boolean, and authored behavior.

# 3. Problems Discovered

PASS 2.2's stable parent-right-edge anchor solved jumping but placed the visible control at the far-right side of the Inspector, reducing its visual association with the dock's left boundary. User QA requested state-dependent logical seam placement instead: visible at Inspector left edge, hidden at workspace right edge.

# 4. Files Created

- `reports/progress_014.md`: this permanent report.

# 5. Files Modified

- `src/components/Inspector/PropertyInspector.css`: changed one toggle positioning rule to use the responsive visible dock width at the Inspector left edge and a right-edge rule while hidden.
- `src/tests/appInspectorToggle.test.tsx`: strengthened the one-toggle/main-layout anchor contract assertions.

All prior intentional Appearance, PASS 1, PASS 2, PASS 2.1, and PASS 2.2 changes were preserved. No Control Point, Appearance, color, or authored behavior code changed in this pass.

# 6. Architecture Overview

```text
MainAppContent
  ├── StageCanvas
  ├── one persistent .inspector-dock-toggle
  │   ├── visible: right = responsive Inspector width
  │   └── hidden: right = 0
  └── PropertyInspector(isHidden)
```

The toggle remains a single sibling of the Inspector and StageCanvas inside `main-layout`. The dock stays mounted and collapses its flex basis as before.

# 7. Data Model Changes

None. Visibility remains transient `MainAppContent` state and does not enter SceneData, tracks, serialization, localStorage, history, or undo/redo.

# 8. Coordinate Space Model

No canvas coordinate or transform model changed. Toggle positioning uses CSS layout coordinates only. The workspace still reclaims the Inspector's width when hidden.

# 9. Component / Module Walkthrough

`App.tsx` remains the owner of `isInspectorVisible` and renders exactly one toggle. `PropertyInspector.tsx` remains a mounted dock shell with Outliner, Details, and the vertical divider; it has no width resizer and no duplicate toggle. `PropertyInspector.css` differentiates the visible and hidden logical seam anchors while preserving vertical centering and 180ms dock motion.

# 10. Important Code Changes

```css
.main-layout:not(.inspector-hidden) .inspector-dock-toggle {
  right: min(var(--right-inspector-width), max(250px, 34vw));
  transform: translate(50%, -50%);
}

.main-layout.inspector-hidden .inspector-dock-toggle {
  right: 0;
  transform: translate(50%, -50%);
}
```

The visible button center aligns with the Inspector left edge. The hidden button center aligns with the workspace/application right edge. The same element remains mounted in both states.

# 11. Public Interfaces

No application-level public API changed. The internal `PropertyInspector` visibility prop remains `isHidden`; no new state or callback interface was introduced.

# 12. Algorithms and Geometry

No algorithms or geometry changed. The responsive `right` value mirrors the existing fixed dock width expression and does not alter StageCanvas coordinate conversion.

# 13. Interaction / UX Behavior

Visible state:

- one compact square dock toggle;
- `Hide Inspector` accessible label/title;
- half-overlap at the Inspector left border;
- vertically centered in `main-layout`.

Hidden state:

- same DOM element and dimensions;
- `Show Inspector` accessible label/title;
- half-overlap at the application/workspace right edge;
- Inspector width remains zero and workspace remains expanded.

Clicking toggles only visibility. Selection, Outliner/Details state, vertical divider, fixed width, and authored properties remain intact.

# 14. Design Decisions

- Use one persistent mounted toggle rather than two independent controls.
- Allow the anchor X position to change with the logical seam, as explicitly requested by user QA.
- Use the existing responsive dock-width expression for visible anchoring so narrow clamped widths remain aligned.
- Keep the existing 180ms transition, icons, dimensions, and accessibility labels.

# 15. Invariants That Must Be Preserved

- Control Point wrapper surface fix remains unchanged.
- Exactly one `.inspector-dock-toggle` exists in the main layout.
- Visible dock width is 360px on normal desktop and zero while hidden.
- No horizontal width resizer or width drag listener returns.
- Outliner/Details vertical divider remains available after reopen.
- Hide/show does not mutate authored state or history.
- Selection, Appearance, Boolean, transform, renderer, serialization, and timeline behavior remain unchanged.
- PASS 3 and PASS 4 remain deferred.

# 16. Testing and Verification

- Focused command: `node ./node_modules/vitest/vitest.mjs run src/tests/appInspectorToggle.test.tsx src/tests/propertyInspector.test.tsx src/tests/transformControlPoints.test.tsx src/tests/styleAppearanceSection.test.tsx` — PASS, 4 files / 12 tests.
- Full Vitest: `npm test` — PASS, 84 files / 1,344 tests.
- Relevant browser E2E: `cmd /d /s /c "set CI=&& node ./node_modules/@playwright/test/cli.js test e2e/shape-appearance-bounds.spec.ts e2e/editor-interaction.spec.ts"` — PASS, 11 tests.
- TypeScript: `npx tsc --noEmit` — PASS.
- Lint: `npm run lint` — PASS with one pre-existing `react(only-export-components)` warning.
- Production build: `npm run build` — PASS; existing Vite large-chunk warning.
- `git diff --check` — PASS with expected Windows line-ending warnings.
- Live Chromium smoke: PASS — one toggle remained mounted; visible center aligned to Inspector left seam, hidden center aligned to workspace right edge, Y coordinate remained centered, labels switched, width changed 360px → 0px → 360px, and vertical divider remained present.

# 17. Manual QA Results

- PASS — prior PASS 2.2 Control Point surface result remains preserved.
- PASS — live visible toggle uses the Inspector-left edge seam.
- PASS — live hidden toggle uses the workspace-right edge seam.
- PASS — icon/label changes coherently without duplicate controls.
- NOT TESTED — final user visual approval at all intended desktop widths; next checkpoint.

# 18. Regression Risk Assessment

Overall risk: LOW. The change is limited to CSS anchor selection and existing App-owned toggle tests. No domain, renderer, selection, persistence, or history paths changed.

# 19. Performance Considerations

No new runtime listeners or state. The existing CSS transition remains bounded at 180ms. One mounted toggle avoids duplicate render/state paths.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

No saved-project, serialization, renderer, coordinate, or public domain compatibility change. Existing lucide icons and fixed-width dock contract are preserved.

# 22. Known Limitations

- The visible and hidden toggle X coordinates intentionally differ because they represent different logical seams.
- User visual approval remains required for perceived discoverability and half-overlap placement.
- PASS 3 Control Point matrix and PASS 4 Appearance/hue work remain deferred.

# 23. Technical Debt

The dock-width expression is duplicated between Inspector sizing and toggle positioning. It is intentionally kept local and identical for this narrow pass; a shared layout token may be considered only in a future approved cleanup.

# 24. Git Summary

- Branch: `main`
- HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- origin/main: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Ahead/behind: `0/0`
- Working tree: prior intentional Appearance/Compact Pro changes plus PASS 2.3 CSS/test/report changes.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.

# 25. Updated Project Tree

```text
reports/progress_014.md                                  [new]
src/components/Inspector/PropertyInspector.css            [modified]
src/tests/appInspectorToggle.test.tsx                     [modified]
```

# 26. Self Review

Good: one toggle remains authoritative, visible and hidden states map to their requested seams, and live measurements confirm the intended geometry. Improvement needed: final visual QA remains with the user. Score: 9/10.

# 27. Next Recommended Task

Perform user visual QA of the edge-attached toggle at normal, narrow, and wide Inspector widths before approving PASS 3.

# 28. Project Status

PASS 2.3 implementation: COMPLETE pending user visual QA. PASS 3 and PASS 4: NOT STARTED.

# 29. AI Development Notes

The user intentionally changed the requirement from PASS 2.2 stable absolute position to stable logical anchor behavior. Keep the button mounted once in `main-layout`; visible state follows the Inspector left seam, hidden state follows the workspace right edge. Do not move the state owner or reintroduce a second control.

## DO NOT CHANGE CASUALLY

- `MainAppContent` visibility ownership.
- 360px/zero-width dock behavior.
- Control Point calculations and wrapper-only surface class.
- Appearance and hue endpoint behavior.
- Outliner/Details vertical divider.
- Selection, Boolean, renderer, history, and serialization authorities.

# 30. Lessons Learned

A single stable screen coordinate and a single stable logical anchor are different contracts. The user preferred discoverability attached to the active dock seam, so one mounted control with state-dependent CSS anchoring is the least invasive solution.
