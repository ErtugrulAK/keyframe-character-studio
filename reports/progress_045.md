# Progress Report 045 — KCS V3.5 UX Corrections

## Executive Summary

Implemented the approved KCS V3.5 UX correction milestone on `feat/v6-ui-v35-ux-corrections`. The editor now preserves zoom during Reset View, centers only the pan offset, collapses the left drawer as an in-flow flex item, finalizes Free Draw with Enter, presents vertices as a normal collapsible inspector card, consolidates text color controls, relocates Effects, normalizes Outliner icons, removes mode-switch separators, applies semantic dark-editor tokens, and uses a compact Trim Path layout.

## User feedback

Applied the complete V3.5 correction list without changing the functional freeze: no new animation, playback, evaluation, serialization, or timing authority was introduced.

## Subagent orchestration

- `ResetAuthorityScout` — inspected Reset View authority and affected regression coverage.
- `SidebarCollapseScout` — inspected left/right dock geometry and collapse constraints.
- `FreeDrawScout` — inspected transient drawing and Enter/Escape lifecycle.
- `TextEffectsScout` — inspected StyleTab, text color, and Effects ownership.
- `OutlinerIconsScout` — inspected shape icon authority and Outliner fallback paths.
- `DesignerPreV35` — provided pre-implementation UI critique.
- `ResetFreeDrawImpl` — implemented pan-only reset and Free Draw keyboard finalization.
- `SidebarCollapseImpl` — implemented in-flow left drawer collapse and targeted E2E coverage.
- `InspectorUxImpl` — implemented vertices, text cleanup, and Effects relocation.
- `OutlinerIconImpl` — implemented canonical shape icon usage and neutral Outliner styling.
- `HeaderTrimPaletteImpl` — implemented header, palette, and Trim Path corrections.
- `V35DesignerReview` — final design review; initial drawer/header findings were corrected before regression.
- `V35CodeReview` — final read-only review; identified and resolved Effects test drift, Card/Banner Corner Radius routing, Free Draw event isolation, and Capsule icon coverage.

## Reset View contract

- Reset View preserves the current zoom level.
- Reset View resets only the pan offset to the default center.
- Grid visibility and active tool remain unchanged.
- Repeated reset remains idempotent.

## Left sidebar collapse

- Expanded state occupies the rail plus the drawer in the main flex layout.
- Collapsed state retains the 56px rail and releases the 280px drawer footprint.
- The stage width grows and its left edge moves when the drawer collapses.
- The left handle remains reachable at the rail/drawer edge.
- Left and right handles share the narrow 26px × 48px visual contract.

## Free Draw Enter fix

- Enter commits a valid in-progress drawing and returns to Select.
- Escape cancels and exits the active drawing tool.
- Enter is ignored for idle Free Draw and for editable form targets.
- The focused workflow covers three-point drawing, Enter finalization, Outliner creation, and Select activation.

## Free Draw Vertices section

- `FREE DRAW VERTICES (N)` is rendered as a normal collapsed `StyleCard`.
- It remains available only for eligible non-boolean custom freeform parts.
- Existing vertex editing and serialized geometry remain unchanged.

## Text cleanup

- Text stagger controls were removed from the inspector surface.
- Separate primary Text Fill and Text Stroke controls were removed.
- Text, Card, and Banner text-bearing surfaces use the consolidated TEXT section.

## Text Color simplification

- Text uses one `COLOR` control backed by the canonical RGBA picker.
- The control continues writing the existing `fillColor` and `fillOpacity` fields.
- Native color inputs and the legacy quick-palette surface are absent from Text.

## Effects removal/relocation

- The standalone Effects surface was removed from StyleTab composition.
- Shadow/Glow controls are embedded below Appearance for shape and other non-text color-bearing parts.
- Shadow/Glow controls are embedded below the Text surface for text-bearing parts.
- Existing `shadowColor`, `shadowBlur`, `shadowOffsetX`, and `shadowOffsetY` serialization fields remain authoritative.

## Outliner icon normalization

- Shape/freeform icons are defined by `src/utils/shapeIconMap.ts`.
- The custom parallelogram renderer remains in `src/utils/shapeIcons.tsx`.
- Outliner and Elements Drawer consume the same map, size, and stroke authority.
- Circle, Square, Rectangle, Capsule, and Free Draw use their actual neutral icons.
- Arbitrary shape icons no longer use the blue fallback styling.

## Header separator cleanup

- Mode-switch top, bottom, left, and right borders were removed.
- The animated mode indicator and keyboard focus treatment remain intact.
- Unrelated FPS/import separators were preserved.

## Color-system refinement

- Editor surfaces use semantic dark-editor tokens for shell, rail, drawer, inspector, timeline, graph, elevated surfaces, hover, selected, focus, text, and borders.
- Canvas and toolbar surfaces use the flat dark-editor treatment.
- Existing accent colors remain available for active, warning, and focus states.

## Trim Path layout

- Start and End controls use a compact paired layout.
- Offset remains compact where space permits and retains a full-width fallback.
- Existing Trim Path field names and values remain unchanged.

## Files changed

- 32 tracked files changed by the V3.5 implementation and regression updates.
- Added `src/utils/shapeIconMap.ts` and `src/utils/shapeIcons.tsx` as the shared icon authority.
- Added 13 V3.5 browser QA captures under `docs/design/after/v35/`.
- Added focused Free Draw Enter coverage and updated stale V51/style Effects contracts.

## Accessibility

- Existing ARIA labels and pressed states were preserved for tool and dock handles.
- Left and right handles retain keyboard focus outlines and mirrored dimensions.
- Color controls use labeled RGBA channels, sliders, and HEX input.
- Final review noted minor pre-existing click-only semantics in broader Outliner/header surfaces; no V3.5 blocker remains.

## Backward compatibility

- Public component contracts remain compatible.
- Existing serialized color, opacity, shadow, glow, border-radius, and freeform geometry fields remain in use.
- No migration or fallback removal was introduced.

## Focused tests

- `npx vitest run src/tests/viewportToolbar.test.tsx src/tests/outlinerPanel.test.tsx src/tests/styleAppearanceSection.test.tsx` — 43 passed.
- `npx vitest run src/tests/styleEffectsSection.test.tsx src/tests/outlinerPanel.test.tsx` — 25 passed.
- `CI=true npx playwright test e2e/workflow.spec.ts -g "Finalize a freeform shape with Enter"` — 1 passed.
- `CI=true npx playwright test e2e/left-toolbar-collapse.spec.ts` — 2 passed.
- `CI=true npx playwright test e2e/v51-recovery.spec.ts -g "text selection bounds"` — 1 passed.

## Browser QA

Browser QA was performed against the running editor at 1440 × 900. Captures were written to `docs/design/after/v35/` for the requested expanded/collapsed drawer, handle edge, right-sidebar, inspector, Outliner, palette, text, Effects, vertices, broadcast, and Trim Path surfaces.

## Designer review

`V35DesignerReview` initially found the drawer footprint still overlaying the canvas and the mode switch retaining top/bottom borders. Both findings were corrected: expanded left layout now consumes rail plus drawer width in-flow, and `.header-mode-switch` now has no border.

## Reviewer findings

`V35CodeReview` initially found stale Effects test assumptions, inaccessible Card/Banner Corner Radius, broad Free Draw keyboard capture, and missing Capsule icon coverage. All four actionable findings were resolved. No blocker remains.

## Full regression

- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with the existing `AnimatorContext.tsx` Fast Refresh warning only.
- `npm test` — 100 files, 1,431 tests passed.
- `npm run build` — passed.
- `git diff --check` — passed; only Git line-ending normalization warnings were reported.
- `npm run qa:v6` — 3 passed.
- `CI=true npm run test:e2e` — 254 passed.

## Git summary

- Branch: `feat/v6-ui-v35-ux-corrections`.
- Main was not modified.
- Commit and push are performed after this report and final working-tree verification.

## Manual QA

- Reset View preserves zoom/grid/tool and centers pan.
- Left drawer expands in-flow and fully releases its footprint when collapsed.
- Handles remain visible, keyboard reachable, mirrored, and narrow.
- Free Draw Enter commits and returns to Select.
- Vertices, Text, Appearance, Effects, Outliner, Header, palette, and Trim Path surfaces match the requested V3.5 structure.

## DO NOT CHANGE CASUALLY

- Reset View must remain pan-only; do not reintroduce zoom reset.
- Left drawer must remain an in-flow flex child; do not restore absolute overlay behavior.
- `SHAPE_ICON_MAP` is the shared icon authority for Elements Drawer and Outliner.
- Text color writes legacy `fillColor`/`fillOpacity`; Effects writes legacy shadow fields.
- Mode indicator animation and focus treatment are intentional; remove only the surrounding separator chrome.
- Functional freeze remains in force.

## Lessons learned

- UI contract tests must exercise the production composition seam, not only leaf components.
- Replacing native color inputs requires updating tests to use the canonical RGBA/HEX interaction path.
- In-flow geometry must be asserted through adjacent stage dimensions, not only drawer width.
- Shared visual authorities belong in non-component utility modules to avoid duplicate maps and Fast Refresh warnings.
