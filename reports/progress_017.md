# KCS Development Report — Compact Pro Inspector PASS 3.1

Metadata:
- Date: 2026-08-31
- Milestone: KCS V5.1 — Compact Pro Inspector PASS 3.1 density refinement
- Branch: `main`
- Starting HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Ending HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Commit status: Intentional uncommitted working-tree changes; commit prohibited by task scope
- Report number: `progress_017.md`

# 1. Executive Summary

PASS 3.1 refines the approved Compact Pro Inspector presentation without changing the approved Transform, Control Point, Appearance, Hue, Effects, Matte, or geometry behavior. Control Point labels now use one neutral Inspector label treatment with muted dots instead of per-point inline colors. Inspector numeric inputs are centered and common scalar fields use bounded compact widths. Trim Path Start, End, and Offset now occupy one compact three-column row at the desktop Inspector width and wrap predictably at narrow widths.

The existing `StyleCard`, `SmartNumberInput`, Transform mutation path, Trim Path normalization, renderer, history, serialization, and selection authorities remain in place. No new state, animation, evaluation, geometry, or timing authority was introduced. PASS 4 was not started.

Implementation state: COMPLETE.
User visual QA state: READY / pending user confirmation of PASS 3.1 density and hierarchy.

# 2. Original Objectives

## In scope

- Neutral Control Point labels and restrained point markers.
- Center numeric Inspector values without changing parsing or callbacks.
- Compact Trim Path Start / End / Offset presentation.
- Targeted compact sizing for obvious scalar Inspector controls.
- Focused component contract coverage and disclosure-aware Trim Path E2E setup.
- Sequential permanent development report.

## Explicitly out of scope

- Appearance structure, Fill/Stroke behavior, Hue, Alpha, HEX, and color utilities.
- Effects or Mask/Track Matte redesign.
- Transform geometry formulas, coordinate units, layer behavior, Boolean behavior, or freeform editing.
- New animation, playback, renderer, evaluator, serialization, or state authorities.
- Branch, commit, push, merge, rebase, reset, stash, or cleanup of unrelated working-tree changes.
- PASS 4 or any later roadmap pass.

# 3. Problems Discovered

## Control Point label color noise

- Symptom: Control Point row labels inherited distinct per-point inline colors, increasing visual noise in a dense matrix.
- Root cause: Row descriptors carried color values into inline label and dot styles.
- Status: PASS — label text now uses the existing neutral text token and dots use one muted CSS color; row names, mode semantics, values, and callbacks remain unchanged.

## Numeric alignment inconsistency

- Symptom: Inspector numeric values were right-aligned while the compact matrix and short scalar controls benefit from centered values.
- Root cause: The Inspector-specific number rule overrode the base centered number presentation with `text-align: right`.
- Status: PASS — the scoped Inspector number rule now centers values and retains tabular numerals.

## Trim Path vertical density

- Symptom: Trim Path Start and End occupied one row while Offset occupied a separate row.
- Root cause: Offset was rendered outside the existing two-column inline field group.
- Status: PASS — the three existing fields render through one compact grid at desktop width and use a two-column fallback at narrow container widths.

# 4. Files Created

- `reports/progress_017.md`: Permanent PASS 3.1 engineering record.
- `src/tests/trimPathSection.test.tsx`: Focused coverage for disclosure, compact field structure, displayed values, and callback payloads.

Pre-existing untracked reports, tests, and utility files were preserved and not rewritten.

# 5. Files Modified

- `src/components/Inspector/sections/transform/TransformControlPoints.tsx`
  - Removed per-row color data and inline label/dot colors.
  - Preserved the matrix rows, accessible labels, point calculations, mode switching, and update callbacks.

- `src/components/Inspector/PropertyInspector.css`
  - Added scoped compact control width tokens.
  - Centered Inspector numeric input values.
  - Bounded direct scalar number inputs to the compact control width.
  - Added a two-column `.input-grid` for existing scalar groups with a narrow single-column fallback.
  - Added the three-column Trim Path grid and narrow two-column container-query fallback.
  - Added the neutral Control Point dot color.
  - No Appearance markup or behavior was changed.

- `src/components/Inspector/sections/style/TrimPathSection.tsx`
  - Moved the existing Start, End, and Offset fields into one `.trim-path-fields` grid.
  - Preserved labels, defaults, display scale, min/max/precision, normalization, and `onPartPropChange` keys.

- `src/tests/transformControlPoints.test.tsx`
  - Added a contract assertion that Control Point labels no longer carry inline color styles and that four marker dots remain.

- `e2e/trim-path-v2.spec.ts`
  - Opens the closed Trim Path disclosure through its public accessible button before asserting fields and persistence.

Other modified files in the working tree predate this PASS 3.1 change and were preserved.

# 6. Architecture Overview

```text
PropertyInspector
  -> existing Inspector section shells and local StyleCard disclosure state
       -> TransformTab -> TransformControlPoints
       -> TrimPathSection -> existing SmartNumberInput controls
       -> existing scalar sections -> scoped PropertyInspector.css density rules
```

`StyleCard` remains the disclosure authority. `SmartNumberInput` remains the input parsing and commit authority. Trim Path updates continue through the existing `onPartPropChange` boundary. No parallel state or presentation engine was introduced.

# 7. Data Model Changes

None.

- No `CharacterPart`, `Transform`, animation channel, serialized field, or migration changed.
- Disclosure state remains transient local UI state.
- Trim Path Start, End, Offset, and Enabled values use the existing authored fields.

# 8. Coordinate Space Model

Unchanged.

- Control Point values continue to use the existing bounds, scale, coordinate-system, rounding, and Y-sign conversion logic.
- Trim Path percentages continue to use the existing display scale and authored normalized values.
- Offset continues to use the existing normalization function.
- No canvas, SVG, viewport, selection, or project-unit coordinate path changed.

# 9. Component / Module Walkthrough

## `TransformControlPoints`

The component still builds the existing Edge and Corner row descriptors and renders them through the compact X/Y matrix. Only visual color ownership changed: row labels use the neutral label token and marker dots use the muted CSS token.

## `TrimPathSection`

The section remains closed by default through `StyleCard`. Its three existing numeric fields now share a grid container. Enable behavior, accessible labels, displayed values, and callback payloads remain unchanged.

## `PropertyInspector.css`

New rules are scoped to the right Inspector sidebar and use existing spacing and color tokens. Container queries provide graceful wrapping below the desktop width. No global form or domain styles were changed.

# 10. Important Code Changes

Neutral Control Point presentation:

```tsx
<span className="control-point-label" role="rowheader">
  <span className="control-point-dot" aria-hidden="true" />
  {row.label}
</span>
```

Compact Trim Path presentation:

```tsx
<div className="trim-path-fields">
  <div className="appearance-field">Start ...</div>
  <div className="appearance-field">End ...</div>
  <div className="appearance-field">Offset ...</div>
</div>
```

The snippets are presentational only; the existing input props and mutation callbacks are retained.

# 11. Public Interfaces

No exported public API changed.

- Existing component prop interfaces remain compatible.
- `StyleCard` and `SmartNumberInput` interfaces remain unchanged.
- No new exported hook, utility, type, callback, or serialized field was added.

# 12. Algorithms and Geometry

No algorithm or geometry behavior changed.

- Control Point opposite-anchor calculations and rounding remain unchanged.
- Position and point coordinate conversion remain unchanged.
- Trim Path normalization remains unchanged.
- Renderer dash-array generation and fill behavior remain unchanged.

# 13. Interaction / UX Behavior

## Control Points

- Before: Labels and dots used per-point colors.
- After: Labels use one neutral text treatment and dots use one muted marker treatment.
- Expected workflow: open Control Points, select Edge Points or Corners, edit the same accessible X/Y fields.

## Numeric controls

- Before: Inspector numbers were right-aligned and some direct scalar controls used unconstrained available width.
- After: Inspector numbers are centered with tabular numerals and direct scalar controls use a compact bounded width.
- Expected workflow: parsing, keyboard commit, clamping, rounding, and callbacks remain unchanged.

## Trim Path

- Before: Offset was on a second row.
- After: Start, End, and Offset share one row at desktop width; the layout wraps to two columns in a narrow Inspector container without horizontal overflow.

# 14. Design Decisions

## Neutralize labels, preserve identity

- Decision: Keep directional text labels and use a shared muted dot instead of eight distinct inline colors.
- Reason: The matrix remains scannable while matching the compact Inspector hierarchy.
- Alternative rejected: Remove markers or rename labels, which would reduce orientation or change the established semantic contract.

## Center numeric values

- Decision: Center scoped Inspector number inputs and retain tabular numerals.
- Reason: Short numeric values are easier to scan in compact, repeated controls.
- Alternative rejected: Add per-component alignment props, which would duplicate presentation authority without a behavioral need.

## Use a bounded compact width

- Decision: Add small Inspector-local width tokens and apply them to direct scalar number controls.
- Reason: Prevent oversized numeric controls while allowing flex shrink and narrow-container fallback.
- Alternative rejected: Hard-code widths in each component, which would spread density policy across the Inspector.

## Keep Trim Path behavior authoritative

- Decision: Change only the field container structure.
- Reason: `SmartNumberInput` and existing callbacks already own the correct semantics.
- Alternative rejected: Replace inputs or introduce a new Trim Path hook.

# 15. Invariants That Must Be Preserved

- `StyleCard` disclosure state remains local UI state only.
- `SmartNumberInput` owns parsing, clamping, rounding, display scale, focus, and keyboard behavior.
- Control Point labels, row identity, mode semantics, formulas, and callbacks remain intact.
- Trim Path Enabled, Start, End, and Offset callback keys remain intact.
- Trim Path offset normalization remains intact.
- Appearance, Hue, Effects, Matte, renderer, timeline, history, serialization, and migration remain frozen for this pass.

# 16. Testing and Verification

## Focused component tests

- `node ./node_modules/vitest/vitest.mjs run src/tests/transformControlPoints.test.tsx src/tests/trimPathSection.test.tsx src/tests/transformPresentation.test.tsx src/tests/coordinateAuthoring.test.tsx src/tests/trimPath.test.ts src/tests/trimPathEvaluation.test.ts src/tests/trimPathRender.test.tsx src/tests/propertyInspector.test.tsx` — PASS, 8 files / 29 tests.
- Earlier focused run including Style Geometry and Appearance section contracts — PASS, 10 files / 46 tests.

## Full regression

- `npm test` — PASS, 86 files / 1,350 tests. Vitest emitted three existing `Not implemented: navigation to another Document` notices; no test failed.
- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS with one existing `react(only-export-components)` warning at `src/context/AnimatorContext.tsx:630`.
- `npm run build` — PASS. Vite emitted the existing large JavaScript chunk warning; the generated bundle was 533.67 kB.
- `git diff --check` — PASS. Git emitted expected Windows LF-to-CRLF working-copy warnings; no whitespace error was reported.

## Playwright / E2E

- `npx playwright test e2e/trim-path-v2.spec.ts --retries=0` — PASS, 2 tests. The static authoring test now opens Trim Path through the public disclosure button and confirms persistence; the Broadcast test remains green.

# 17. Manual QA Results

- PASS — At 1440x1000, Trim Path rendered three fields with computed grid columns `103px 103px 103px`, centered numeric inputs, and no document overflow.
- PASS — At 1440x1000, Control Point labels had no inline color style; all four dots used the same computed muted background; numeric inputs computed as centered.
- PASS — At 800x1000, the Inspector measured 272px wide with no document overflow; Trim Path used two columns at `114.5px 114.5px` and wrapped the third field predictably.
- PASS — Screenshot inspected for the compact Inspector hierarchy and Control Point matrix at the wide viewport.
- PASS — Existing local development service was restored and left ready after E2E verification.
- NOT TESTED — User visual acceptance of final PASS 3.1 spacing and hierarchy.
- NOT TESTED — PASS 4 Appearance work; explicitly deferred.

# 18. Regression Risk Assessment

Overall: LOW to MEDIUM.

- LOW: Domain callbacks, calculations, authored values, history, serialization, renderer, and Trim Path evaluation were not rewritten.
- MEDIUM: `PropertyInspector.css` is shared Inspector infrastructure; the new selectors are sidebar-scoped and browser measurements cover wide and narrow layouts.
- LOW: E2E disclosure setup now follows the public accessible control.
- Known separate risk: prior coordinate output-origin E2E baseline failures remain outside this pass and were not changed.

# 19. Performance Considerations

- No canvas, renderer, playback, evaluator, or geometry hot path changed.
- The CSS-only density rules add no runtime listeners or timers.
- The Trim Path grid adds no new computation and still renders the same three bounded controls.
- No benchmark was required or performed.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

- React component prop compatibility: preserved.
- TypeScript/build compatibility: verified.
- Chromium compatibility: verified at wide and narrow viewports with no overflow.
- Saved-project and serialization compatibility: no authored fields changed.
- Animation, preset, clipboard, broadcast, renderer, and migration compatibility: no related authority changed.
- Windows line-ending warnings remain normal for this working tree.

# 22. Known Limitations

- User visual QA is still required for final acceptance of density, hierarchy, and spacing.
- Full manual editing of every shape and every Control Point row was not repeated in PASS 3.1; existing focused contracts and the prior PASS 3 browser workflow remain the behavioral evidence.
- Prior coordinate output-origin E2E baseline failures remain separate and are not part of this presentation refinement.
- TransformVertexEditor was intentionally not redesigned.

# 23. Technical Debt

- The Inspector still contains historical presentation styles outside the targeted density scope; broad consolidation would require a separate approved pass.
- Trim Path wraps to two columns below the narrow container threshold rather than forcing three unusably narrow fields.
- Existing coordinate output-origin E2E failures require a separate baseline investigation.

# 24. Git Summary

- Branch: `main`
- Starting HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Ending HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- `origin/main`: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Ahead/behind: `0/0`
- Staged changes: `0`
- Unstaged changes at final audit: `27`
- Untracked files at final audit: `16`
- Working tree: prior intentional PASS 1/PASS 2/PASS 2.x/PASS 3 Inspector and Appearance changes plus PASS 3.1 source, test, and report changes.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.

No unrelated working-tree files were reverted, staged, deleted, moved, or committed.

# 25. Updated Project Tree

Relevant PASS 3.1 files:

```text
e2e/
  trim-path-v2.spec.ts                         [modified]
src/components/Inspector/
  PropertyInspector.css                       [modified]
  sections/style/
    TrimPathSection.tsx                        [modified]
  sections/transform/
    TransformControlPoints.tsx                 [modified]
src/tests/
  transformControlPoints.test.tsx              [modified]
  trimPathSection.test.tsx                     [new]
reports/
  progress_017.md                              [new]
```

Other modified and untracked Inspector, Appearance, report, test, and utility files remain prior intentional working-tree changes and were not part of the PASS 3.1 source scope.

# 26. Self Review

Good:

- Reused `StyleCard`, `SmartNumberInput`, existing Trim Path callbacks, existing normalization, and existing Control Point calculations.
- Kept label identity and all numeric semantics intact while removing inline color noise.
- Centralized compact numeric sizing in scoped Inspector CSS instead of duplicating widths in components.
- Added focused component coverage and corrected the disclosure-aware E2E setup.
- Verified wide and narrow browser layout with computed measurements and screenshot inspection.

Could improve:

- A full shape-by-shape manual editing sweep was not repeated because PASS 3.1 is presentation-only and prior PASS 3 evidence covers the unchanged matrix interaction paths.
- The narrow two-column Trim Path fallback is intentionally less dense than the desktop row but preserves usable field width and overflow safety.

Uncertainty:

- Final visual judgment of neutral marker contrast and exact density remains with the user visual QA checkpoint.

Score: 9/10. The change is narrow, behavior-safe, and verified; final user visual acceptance remains open.

# 27. Next Recommended Task

Perform user visual QA of PASS 3.1 density, neutral Control Point labels, centered numeric values, and compact Trim Path. Do not begin PASS 4 until explicitly approved.

# 28. Project Status

- Current milestone: KCS V5.1 Compact Pro Inspector PASS 3.1 implementation complete.
- Completed: neutral Control Point labels, centered numeric values, bounded scalar sizing, compact Trim Path row, focused tests, browser QA, E2E, and full regression validation.
- Remaining for PASS 3.1: user visual confirmation.
- PASS 4 Appearance: not started.
- PASS 5/6 later sections: not started.
- QA stage: READY FOR USER VISUAL QA.

# 29. AI Development Notes

- Keep `StyleCard` as the local disclosure authority.
- Keep `SmartNumberInput` as the input parsing and commit authority.
- Keep `onPartPropChange` as the Trim Path mutation boundary.
- Prefer scoped Inspector CSS tokens for future density refinements.
- Verify both `clientWidth` and `scrollWidth` for every compact grid.
- Appearance, Hue, Effects, and Matte are explicitly frozen until a separately approved pass.

## DO NOT CHANGE CASUALLY

- Control Point formulas, opposite-anchor semantics, rounding, labels, and mode behavior.
- Trim Path normalization, display scale, callback keys, and renderer dash semantics.
- `SmartNumberInput` parsing, clamping, focus, keyboard, and commit behavior.
- `StyleCard` local disclosure state and accessibility contract.
- Position coordinate scale and Y-sign conversion.
- Scale lock ownership, layer callbacks, Boolean gating, and TransformVertexEditor structure.
- Appearance Fill/Stroke structure, Hue/Alpha/HEX behavior, and color utilities.
- Outliner, selection, marquee, renderer, viewport, playback, timeline, serialization, and migration paths.

# 30. Lessons Learned

- Neutral marker styling reduces matrix noise without removing directional affordances.
- Center alignment is most predictable when applied at the scoped Inspector input authority rather than per component.
- Container-query fallbacks keep compact rows dense at desktop width without forcing overflow at narrow widths.
- Disclosure-aware E2E tests must open closed sections through their public accessible controls before querying child fields.
- Presentation-only refinements are safest when existing input and domain authorities remain untouched.
