# KCS Development Report — Compact Pro Inspector PASS 3.2 Micro Layout Cleanup

Metadata:
- Date: 2026-08-31
- Milestone: KCS V5.1 — Compact Pro Inspector PASS 3.2 micro layout cleanup
- Branch: `main`
- Starting HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Ending HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Commit status: Intentional uncommitted working-tree changes; commit prohibited by task scope
- Report number: `progress_018.md`

# 1. Executive Summary

PASS 3.2 applies the three approved micro layout corrections from the PASS 3.1 user visual review. Corner Control Point display labels now read `TOP LEFT`, `TOP RIGHT`, `BOTTOM LEFT`, and `BOTTOM RIGHT` without arrows, hyphens, or abbreviation suffixes. The Mask / Track Matte explanatory paragraph is removed while the Mask Source control remains. Stroke Width and Align now share one responsive row at the normal 360px Inspector width, with a stacked fallback at the narrow Inspector clamp.

This is presentation-only. Control Point keys, calculations, accessible field names derived from the display labels, Mask Source behavior, Matte behavior, Stroke Width and alignment callbacks, legacy alignment mapping, renderer, geometry, history, serialization, animation, color editor, and selection authorities remain unchanged. PASS 4 was not started.

Implementation state: COMPLETE.
User visual QA state: READY / pending final user confirmation of PASS 3.2.

# 2. Original Objectives

## In scope

- Remove Corner Control Point display abbreviation suffixes and presentation hyphens.
- Preserve Edge labels and the neutral PASS 3.1 Control Point matrix.
- Remove the Mask / Track Matte explanatory paragraph only.
- Place Stroke Width and Align on one compact row at 360px.
- Provide a narrow responsive fallback without clipping or horizontal overflow.
- Preserve centered numeric values, compact Trim Path, disclosure behavior, and color editor presentation.
- Update focused tests, relevant E2E setup/assertions, and create the next numbered report.

## Explicitly out of scope

- PASS 4 Appearance work and the deferred Hue endpoint issue.
- Fill/Stroke color controls, RGBA layout, hue/alpha bars, HEX, swatches, color math, and color callbacks.
- Stroke geometry, renderer, `INSIDE`/`OUTSIDE` semantics, legacy compatibility, history, serialization, animation, or callbacks.
- Mask/Matte source options, Matte behavior, Boolean behavior, selection, renderer, and serialization.
- Control Point identifiers, keys, formulas, calculations, or mutation ownership.
- Branch, commit, push, merge, rebase, reset, stash, or cleanup of unrelated working-tree changes.

# 3. Problems Discovered

## Corner label redundancy

- Symptom: Corner rows displayed directional arrows, hyphenated names, and `(TL)`, `(TR)`, `(BL)`, `(BR)` suffixes.
- Reproduction: Open Control Points, select Corners, inspect the four matrix row labels.
- Root cause: Display labels in `TransformControlPoints` combined visual direction, hyphenated text, and internal abbreviations.
- Affected subsystem: Inspector presentation and accessible input names.
- Severity: LOW.
- Status: PASS — labels are now plain `TOP LEFT`, `TOP RIGHT`, `BOTTOM LEFT`, and `BOTTOM RIGHT`; internal row keys and formulas remain intact.

## Mask / Track Matte copy density

- Symptom: A prose paragraph appeared above the Mask Source field.
- Reproduction: Open Mask / Track Matte for a selected part.
- Root cause: `StyleMatteSection` rendered an explanatory `<p>` before the existing control grid.
- Affected subsystem: Inspector presentation only.
- Severity: LOW.
- Status: PASS — the paragraph and its unused presentation rule were removed; Mask Source and all Matte controls remain.

## Stroke field stacking

- Symptom: Stroke Width and Align occupied separate vertical rows.
- Reproduction: Open Appearance for a modern shape at the normal Inspector width.
- Root cause: Width was inside a one-field inline grid while Align was rendered as a sibling field.
- Affected subsystem: Appearance Inspector layout only.
- Severity: LOW to MEDIUM visual regression risk.
- Status: PASS — the existing controls now share `.stroke-inline-fields` with a compact/flexible column ratio and a narrow stacked fallback.

# 4. Files Created

- `reports/progress_018.md`: Permanent PASS 3.2 engineering record covering scope, contracts, implementation, verification, risks, and Git state.

No production utility, domain hook, context, renderer, serializer, or new state file was created.

# 5. Files Modified

- `src/components/Inspector/sections/transform/TransformControlPoints.tsx`
  - Previous responsibility: Render the Edge/Corner X/Y matrix and preserve point calculations.
  - Change: Replace only the four Corner display labels with plain spaced names without arrows or suffixes.
  - Reason: Remove redundant visual abbreviations from the approved compact matrix.
  - Behavioral impact: No authored-data or geometry impact; accessible X/Y names follow the new visible wording.
  - Affected consumers: Focused Control Point component tests and any user-facing matrix inspection.
  - Regression risk: LOW; row keys, values, callbacks, and formulas are unchanged.

- `src/components/Inspector/sections/style/StyleMatteSection.tsx`
  - Previous responsibility: Render the Mask / Track Matte disclosure and controls.
  - Change: Remove only the explanatory paragraph.
  - Reason: Reduce vertical density after user review.
  - Behavioral impact: None; Mask Source, options, Matte controls, and callbacks remain in the same existing grid.
  - Affected consumers: Matte component tests now assert copy absence and source presence.
  - Regression risk: LOW.

- `src/components/Inspector/sections/style/StyleAppearanceSection.tsx`
  - Previous responsibility: Render Fill/Stroke controls, Stroke Width, and alignment selection.
  - Change: Put the existing Width and Align fields inside one `.stroke-inline-fields` container.
  - Reason: Meet the approved single-row Stroke layout at 360px.
  - Behavioral impact: None; existing `SmartNumberInput`, alignment conversion, labels, options, and callbacks are unchanged.
  - Affected consumers: Appearance component tests and Stroke alignment E2E setup.
  - Regression risk: LOW to MEDIUM visual layout risk.

- `src/components/Inspector/PropertyInspector.css`
  - Previous responsibility: Provide scoped Inspector, Appearance, Matte, and compact control styles.
  - Change: Add Width/Align grid columns `minmax(88px, 0.75fr) minmax(132px, 1.25fr)` and stack them below the existing 300px container threshold; remove the now-unused `.matte-description` rule.
  - Reason: Give Align more space while retaining a readable Width control and narrow fallback.
  - Behavioral impact: CSS only; no global color or authored behavior change.
  - Affected consumers: Appearance and Mask/Matte Inspector surfaces.
  - Regression risk: MEDIUM because this is shared Inspector CSS; selectors are local and browser measurements pass.

- `src/tests/transformControlPoints.test.tsx`
  - Previous responsibility: Assert matrix values, modes, and callback routing.
  - Change: Assert exact plain Corner labels, absence of all four abbreviation suffixes, preserved values, and unchanged Edge labels.
  - Reason: Lock the requested display contract without weakening behavior assertions.
  - Behavioral impact: Test contract only.
  - Regression risk: LOW.

- `src/tests/styleMatteSection.test.tsx`
  - Previous responsibility: Assert Mask/Track Matte source, mode, toggle, and removal behavior.
  - Change: Assert the explanatory paragraph is absent while Mask Source remains visible.
  - Reason: Lock the compact UI contract and preserve behavior coverage.
  - Behavioral impact: Test contract only.
  - Regression risk: LOW.

- `src/tests/styleAppearanceSection.test.tsx`
  - Previous responsibility: Assert Appearance color and Stroke alignment behavior.
  - Change: Assert Width and Align share one row and preserve Width/alignment callback payloads.
  - Reason: Lock the requested presentation seam while retaining behavior assertions.
  - Behavioral impact: Test contract only.
  - Regression risk: LOW.

- `e2e/stroke-alignment-v2.spec.ts`
  - Previous responsibility: Verify alignment rendering and persistence.
  - Change: Open the now-closed Appearance disclosure before querying the controls. Update the stale outside-control assertions to the existing canonical legacy mapping: the user-facing OUTSIDE control maps to authored `center`, while `inside` remains the masked path.
  - Reason: Make E2E setup disclosure-aware and align assertions with the current approved `toAuthoringStrokeAlignment` contract without changing production behavior.
  - Behavioral impact: Test setup/assertions only.
  - Regression risk: LOW.

Other modified and untracked files in the working tree predate PASS 3.2 and were preserved.

# 6. Architecture Overview

```text
DetailsPanel
  -> StyleAppearanceSection -> existing SmartNumberInput / alignment conversion
  -> StyleMatteSection      -> existing Mask Source and Matte callbacks
  -> TransformTab
       -> TransformControlPoints -> existing point descriptors and update path

PropertyInspector.css
  -> scoped presentation grid rules only
```

`StyleCard` remains the disclosure authority. `SmartNumberInput` remains the numeric parsing and commit authority. `toAuthoringStrokeAlignment` remains the alignment compatibility authority. Mask and Matte state continue through the existing `onPartPropChange` path. No duplicate store, serializer, renderer, evaluator, or timing engine was added.

# 7. Data Model Changes

None.

- No authored `CharacterPart` field changed.
- No serialized scene field, migration, animation channel, Matte relation, Stroke alignment value, or Control Point key changed.
- Only transient presentation DOM and CSS changed.

# 8. Coordinate Space Model

Not applicable to this presentation-only milestone.

The changed Control Point labels do not change the existing coordinate model. Control Point values continue to derive from the existing bounds, transform scale, coordinate-system display conversion, rounding, and Y-sign convention. Stroke layout does not change geometry or renderer coordinates. Mask copy removal does not change Matte coordinate or clip paths.

# 9. Component / Module Walkthrough

## `TransformControlPoints`

Builds the same Edge and Corner row descriptors, including the same internal keys and X/Y update closures. Only Corner `label` strings changed. The matrix, headers, neutral dots, centered number inputs, mode buttons, and accessible input construction remain intact.

## `StyleMatteSection`

Still renders the same `StyleCard`, Mask Source select, eligible source options, mode, toggles, gradient, feather, strength, angle, stop, and remove controls. The prose description is no longer mounted.

## `StyleAppearanceSection`

Still renders Fill and Stroke color controls through `ColorPickerPopover`, Width through `SmartNumberInput`, and Align through the existing select and conversion helpers. Width and Align now share a parent grid only.

## `PropertyInspector.css`

Adds a local two-column Stroke grid with an existing container-query strategy. The first column is compact and the second is flexible enough for alignment text. Below the narrow threshold both fields stack. The obsolete Matte description style is removed.

# 10. Important Code Changes

Corner display labels:

```tsx
{
  key: 'top-left',
  label: 'TOP LEFT',
  // existing x/y values and callbacks remain unchanged
}
```

Stroke layout:

```tsx
<div className="stroke-inline-fields">
  <div className="appearance-field">WIDTH ...</div>
  <div className="appearance-field">ALIGN ...</div>
</div>
```

Responsive rule:

```css
.stroke-inline-fields {
  grid-template-columns: minmax(88px, 0.75fr) minmax(132px, 1.25fr);
}

@container (max-width: 300px) {
  .stroke-inline-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

# 11. Public Interfaces

No exported public API changed.

- `TransformControlPoints` props remain unchanged.
- `StyleMatteSection` props remain unchanged.
- `StyleAppearanceSection` props remain unchanged.
- `SmartNumberInput`, `StyleCard`, `toStrokeAlignmentControlValue`, and `toAuthoringStrokeAlignment` remain unchanged.
- No new exported type, hook, utility, callback, or serialized field was added.

# 12. Algorithms and Geometry

No algorithm or geometry behavior changed.

- Control Point opposite-anchor formulas, rounding, bounds, and update payloads are unchanged.
- Stroke Width and alignment values use the same existing input/select event flow.
- `toAuthoringStrokeAlignment` still maps the user-facing OUTSIDE control to the existing centered legacy authoring value, while INSIDE remains INSIDE.
- Mask Source selection and Matte rendering paths are untouched.
- Renderer, SVG masks, Trim Path dash calculations, hit testing, and bounds remain untouched.

# 13. Interaction / UX Behavior

## Corner Control Points

- Before: `↖ TOP-LEFT (TL)`, `↗ TOP-RIGHT (TR)`, `↙ BOTTOM-LEFT (BL)`, and `↘ BOTTOM-RIGHT (BR)`.
- After: `TOP LEFT`, `TOP RIGHT`, `BOTTOM LEFT`, and `BOTTOM RIGHT`.
- Expected workflow: open Control Points, choose Corners, read or edit the same X/Y controls. Edge mode remains `LEFT POINT`, `RIGHT POINT`, `TOP POINT`, and `BOTTOM POINT`.

## Mask / Track Matte

- Before: The Mask Source grid was preceded by explanatory prose.
- After: The disclosure opens directly into the Mask Source grid.
- Expected workflow: open the section, choose the same source or None, and use the same Matte controls.

## Stroke Width and Align

- Before: Width and Align were vertically separated.
- After: At the normal 360px Inspector width they share one two-column row; at the narrow clamp they stack cleanly.
- Expected workflow: edit Width or select INSIDE/OUTSIDE with the same parsing, compatibility mapping, and callback behavior.

# 14. Design Decisions

## Plain Corner display labels

- Decision: Use exactly the requested spaced words without arrows, hyphens, or suffixes.
- Reason: The visible row identity is already clear from the words and the matrix position; internal keys preserve implementation identity.
- Alternatives rejected: Keep arrows, keep abbreviations in `aria-label`s, or rename internal keys. Each would either violate the requested display cleanup or expand behavioral scope.
- Trade-off: Directional arrow glyphs are no longer displayed; the explicit words remain unambiguous.
- Future implication: Any future label change must update focused accessible-name tests with the visible contract.

## Remove only Mask explanatory copy

- Decision: Delete the paragraph and its unused CSS rule, not the control grid or related Matte content.
- Reason: The user requested a compact UI and explicitly froze Mask behavior.
- Alternatives rejected: Shorten the prose or move it to a tooltip, which would preserve unwanted UI copy and add scope.
- Trade-off: The section gives less inline explanation; source controls remain self-describing.
- Future implication: Product guidance should use a separately approved help surface if needed.

## Use a weighted Stroke grid

- Decision: Give Width a compact minimum and Align a larger flexible column, then stack below 300px.
- Reason: Align option text needs more room while Width is a short scalar.
- Alternatives rejected: Equal columns, fixed pixel widths, or shrinking both controls to fit narrow layouts.
- Trade-off: The narrow fallback uses more vertical space, preserving readability and overflow safety.
- Future implication: Reuse the existing container-query strategy for future Inspector micro-layout rows.

# 15. Invariants That Must Be Preserved

- Corner row keys, values, formulas, opposite-anchor semantics, rounding, and update callbacks remain unchanged.
- Edge labels and Edge mode behavior remain unchanged.
- Neutral/muted Control Point markers, compact X/Y matrix, and centered numeric values remain unchanged.
- Mask Source options, selection, Matte fields, Boolean behavior, renderer, serialization, and callbacks remain unchanged.
- Stroke Width parsing and callback payloads remain unchanged.
- Alignment options remain exactly INSIDE and OUTSIDE in the UI; CENTER is not reintroduced as a user-facing option.
- Existing legacy alignment mapping remains owned by `toAuthoringStrokeAlignment`.
- `StyleCard` local disclosure state and accessibility contract remain unchanged.
- Fill/Stroke color editor, RGBA, hue, alpha, HEX, swatches, color math, and callbacks remain frozen.
- Trim Path compact layout, Transform presentation, dock behavior, history, animation, playback, renderer, and serialization remain frozen.

# 16. Testing and Verification

## Focused component tests

- `node ./node_modules/vitest/vitest.mjs run src/tests/transformControlPoints.test.tsx src/tests/styleAppearanceSection.test.tsx src/tests/styleMatteSection.test.tsx src/tests/propertyInspector.test.tsx src/tests/trimPathSection.test.tsx src/tests/transformPresentation.test.tsx` — PASS, 6 files / 130 tests.

## Full regression

- `npm test` — PASS, 86 files / 1,351 tests. Vitest emitted three existing `Not implemented: navigation to another Document` notices; no test failed.
- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS with one existing `react(only-export-components)` warning at `src/context/AnimatorContext.tsx:630`.
- `npm run build` — PASS. Vite emitted the existing large JavaScript chunk warning; the generated bundle was 533.46 kB.
- `git diff --check` — PASS. Git emitted expected Windows LF-to-CRLF working-copy warnings; no whitespace error was reported.

## Playwright / E2E

- `npx playwright test e2e/stroke-alignment-v2.spec.ts e2e/trim-path-v2.spec.ts --retries=0` — PASS, 5 tests after the disclosure-aware setup and canonical legacy alignment assertion update.

## Manual browser verification

- Local app was inspected in Chromium at `1440x1000` and `800x1000`.
- At `1440x1000`, the Inspector measured exactly `360px` wide with no sidebar or document overflow.
- Corner labels were exactly `TOP LEFT`, `TOP RIGHT`, `BOTTOM LEFT`, and `BOTTOM RIGHT`; no `(TL)`, `(TR)`, `(BL)`, or `(BR)` text was present.
- Stroke Width and Align computed as one row with columns `118.875px 198.125px`; field widths were approximately `119px` and `198px`; no overflow was present.
- Mask description was absent and Mask Source remained present.
- PASS 3.1 surfaces remained present: Trim Path used `103px 103px 103px`, all Inspector numeric inputs computed as centered, the Control Point matrix remained mounted, Fill/Stroke Hue controls remained present, and alignment options remained INSIDE/OUTSIDE.
- At `800x1000`, the Inspector measured `272px`; Stroke Width and Align stacked into one `237px` column each with no overflow.
- A screenshot of the wide Inspector was inspected for label hierarchy, matrix density, Mask compactness, Stroke row alignment, and unchanged color-editor presence.

# 17. Manual QA Results

- PASS — Corner labels display as exactly TOP LEFT, TOP RIGHT, BOTTOM LEFT, and BOTTOM RIGHT.
- PASS — No Corner abbreviation suffixes, arrows, or hyphenated presentation remain.
- PASS — Edge mode remains available with LEFT POINT, RIGHT POINT, TOP POINT, and BOTTOM POINT labels.
- PASS — Mask / Track Matte has no explanatory paragraph and retains Mask Source.
- PASS — Stroke Width and Align share one row at the 360px Inspector width.
- PASS — Narrow Stroke fallback stacks without clipping or horizontal overflow.
- PASS — Centered numeric values, neutral Control Point styling, compact Trim Path, disclosure behavior, and fixed 360px Inspector remain intact.
- PASS — Fill/Stroke color editor controls and INSIDE/OUTSIDE options remain present.
- PASS — Focused component tests and relevant E2E scenarios pass.
- NOT TESTED — Final user visual acceptance of PASS 3.2.
- NOT TESTED — PASS 4 Appearance changes; explicitly deferred.

# 18. Regression Risk Assessment

Overall: LOW to MEDIUM.

- LOW: No domain state, renderer, geometry, Matte, serialization, animation, or history code was changed.
- LOW: Control Point row keys and formulas were untouched; only display strings changed.
- MEDIUM: Shared Inspector CSS controls a new weighted row, but browser measurements cover both normal and narrow widths.
- LOW: Existing E2E disclosure setup is explicit and the legacy alignment test now matches the current canonical conversion helper.
- LOW: Color-editor presence was checked manually and no color source file was modified.

# 19. Performance Considerations

- No canvas, renderer, playback, evaluator, geometry, Matte, or pointer hot path changed.
- CSS grid changes add no listeners, timers, storage, or render computation.
- Removing one paragraph reduces mounted DOM content in the Matte section.
- No benchmark was required or performed.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

- React component prop compatibility: preserved.
- TypeScript/build compatibility: verified by the required commands.
- Chromium compatibility: verified at 360px Inspector width and narrow 272px Inspector width.
- Saved-project and serialization compatibility: no authored or serialized fields changed.
- Stroke legacy compatibility: preserved and verified by focused tests plus the Stroke Alignment E2E suite.
- Mask/Matte compatibility: source and behavior paths were not changed.
- Windows LF-to-CRLF warnings remain normal working-copy warnings, not product errors.

# 22. Known Limitations

- Final visual judgment of exact spacing and label contrast remains with the user QA checkpoint.
- Manual QA inspected representative selected-shape Inspector surfaces rather than every object type and every Matte mode.
- The existing broader Inspector working tree contains prior intentional changes outside this milestone; they were not re-audited or reverted.
- TransformVertexEditor and later roadmap sections were intentionally not changed.

# 23. Technical Debt

- Historical Inspector CSS remains broader than the targeted micro-layout rules; consolidation requires a separately approved architecture or styling pass.
- The Stroke row intentionally stacks at the narrow container threshold rather than forcing unreadable controls.
- Existing E2E and compatibility expectations around the legacy OUTSIDE control should remain documented by `shapeAppearance` tests and the Stroke Alignment suite.

# 24. Git Summary

- Branch: `main`
- Starting HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Ending HEAD: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- `origin/main`: `494d65957ab2cc5eaeb691429c794751ba12d88a`
- Ahead/behind: `0/0`
- Staged changes: `0`
- Unstaged changes at final audit: `28`
- Untracked files at final audit: `18`
- Working tree: prior intentional PASS 1/PASS 2/PASS 2.x/PASS 3/PASS 3.1 Inspector and Appearance changes plus PASS 3.2 source, test, E2E, and report changes.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.

No unrelated working-tree file was reverted, staged, deleted, moved, stashed, committed, or pushed.

# 25. Updated Project Tree

Relevant PASS 3.2 files:

```text
e2e/
  stroke-alignment-v2.spec.ts                  [modified]
src/components/Inspector/
  PropertyInspector.css                        [modified]
  sections/style/
    StyleAppearanceSection.tsx                 [modified]
    StyleMatteSection.tsx                      [modified]
  sections/transform/
    TransformControlPoints.tsx                 [modified]
src/tests/
  styleAppearanceSection.test.tsx              [modified]
  styleMatteSection.test.tsx                   [modified]
  transformControlPoints.test.tsx              [modified]
reports/
  progress_018.md                              [new]
```

Other modified and untracked Inspector, Appearance, report, test, and utility files remain prior intentional working-tree changes and were not part of PASS 3.2.

# 26. Self Review

Good:

- Kept the three corrections narrowly presentational.
- Reused existing labels, `StyleCard`, `SmartNumberInput`, alignment conversion, Mask grid, and Inspector container-query strategy.
- Preserved the neutral PASS 3.1 matrix and centered values.
- Added stable assertions for visible labels, copy absence, row structure, callbacks, and narrow layout evidence.
- Updated the affected disclosure-aware E2E setup without changing production behavior.
- Verified actual 360px and narrow Inspector measurements plus screenshot evidence.

Could improve:

- A larger shape-by-shape manual sweep would provide broader visual evidence, but it is not required to validate these local presentation seams.
- The existing historical Inspector CSS could eventually be consolidated, but that would exceed the approved micro-cleanup scope.

Uncertainty:

- The exact subjective balance between the compact Width column and flexible Align column remains a user visual decision.

Score: 9/10. The package is narrow and well-covered; final visual acceptance is the remaining checkpoint.

# 27. Next Recommended Task

Perform the final user visual QA of PASS 3.2, then decide whether to approve PASS 4 Appearance work.

# 28. Project Status

- Current milestone: KCS V5.1 Compact Pro Inspector PASS 3.2 implementation complete.
- Completed: Corner label cleanup, Mask copy removal, Stroke Width/Align compact row, narrow fallback, focused tests, E2E, browser measurements, and full regression validation.
- Remaining for PASS 3.2: final user visual confirmation.
- PASS 4 Appearance: not started.
- QA stage: READY FOR USER VISUAL QA.

# 29. AI Development Notes

- `StyleCard` owns Inspector disclosure state; do not move it into authored or context state casually.
- `SmartNumberInput` owns numeric parsing, clamping, rounding, display scale, focus, and commit behavior.
- `toAuthoringStrokeAlignment` is the canonical UI-to-authoring compatibility mapping; do not alter it during layout work.
- Control Point internal keys and formulas are load-bearing even when visible labels change.
- Mask Source and Matte behavior remain owned by `StyleMatteSection` and existing callbacks.
- Verify both Inspector `clientWidth`/`scrollWidth` and document overflow for future compact rows.
- Appearance color editor, Hue, Effects, Matte behavior, geometry, renderer, serialization, and animation are frozen until explicitly approved.

## DO NOT CHANGE CASUALLY

- Control Point keys, formulas, opposite-anchor calculations, rounding, Edge labels, and mode semantics.
- `SmartNumberInput` parsing, display scaling, callbacks, focus, and keyboard behavior.
- `toStrokeAlignmentControlValue` and `toAuthoringStrokeAlignment` compatibility mapping.
- Stroke INSIDE/OUTSIDE option set and renderer semantics.
- Mask Source eligibility, Matte state shape, mode, toggles, gradient, and renderer paths.
- `StyleCard` disclosure state and accessibility contract.
- Fill/Stroke color editor, RGBA, hue, alpha, HEX, swatches, color math, and callbacks.
- Trim Path behavior, Transform matrix formulas, history, animation, playback, renderer, serialization, and migration.
- Outliner, selection, marquee, viewport, Boolean, and TransformVertexEditor paths.

# 30. Lessons Learned

- Display-label cleanup is safest when visible strings change while stable row keys and formulas remain untouched.
- Removing explanatory copy should also remove its now-unused scoped CSS rule, avoiding dead presentation code.
- Weighted grid columns are more readable than equal columns when one control contains longer option text.
- Disclosure-aware E2E setup is required whenever a prior pass changes default section visibility.
- Presentation-only milestones should use browser measurements to prove both the intended row and its narrow fallback without touching domain authorities.
