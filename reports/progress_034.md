# Progress Report 034 — V6 UI Polish and Pre-Manual-QA Gate

## Executive Summary

Completed the approved V6 UI polish scope on `feat/v6-ui-polish`. The Inspector no longer exposes a separate GEOMETRY section; Corner Radius is authored in APPEARANCE with an explicit `PX` unit. Inspector object actions are consolidated into an Edit/Duplicate action row. The cubic Bézier editor received scoped visual hierarchy and responsive layout styling. Header density was improved without changing the established 79px shell coordinate contract. A defensive scene-import default prevents malformed SVG transforms when legacy or hand-authored scene layers omit rotation or scale fields.

## Objectives

- Remove the redundant Geometry Inspector section.
- Move Corner Radius into Appearance for radius-capable shapes.
- Improve unit/value spacing and action-row hierarchy.
- Polish Curve Editor modal chrome without changing graph semantics.
- Improve header density while preserving shell geometry.
- Add compact visual workflow diagrams to the GitHub presentation README.
- Preserve canonical evaluation, animation, matte, serialization, history, and clipboard authorities.

## Branch and checkpoint strategy

- Protected baseline: `main` remained untouched.
- Product branch: `feat/v6-ui-polish`.
- Empty checkpoint before implementation: `ff3c265 chore: checkpoint before UI polish`.
- Product implementation commit: `4b390cb fix: polish V6 inspector and editor chrome`.
- Documentation branch remained separate: `docs/github-presentation`.
- Documentation commit: `8540165 docs: add KCS workflow diagrams`.
- No unrelated files were staged. The pre-existing untracked `reports/model_routing_analysis.md` was preserved and not modified.

## User-reported UI issues addressed

- Geometry section was redundant and visually displaced Corner Radius from the Appearance controls.
- Corner Radius lacked a clear unit/value relationship.
- Inspector action controls were visually fragmented.
- Curve Editor modal hierarchy and responsive behavior needed stronger grouping.
- Header controls were dense and unevenly aligned.
- GitHub presentation README was text-heavy and needed visual navigation.

## Files changed

### Product branch

- `src/components/Inspector/DetailsPanel.tsx`
- `src/components/Inspector/InteractiveCubicBezierEditor.tsx`
- `src/components/Inspector/sections/StyleTab.tsx`
- `src/components/Inspector/sections/style/StyleAppearanceSection.tsx`
- `src/components/Inspector/sections/style/StyleGeometrySection.tsx` — deleted
- `src/hooks/useSerialization.ts`
- `src/kcsEditorTheme.css`
- `src/tests/styleAppearanceSection.test.tsx`
- `src/tests/styleGeometrySection.test.tsx` — deleted
- `reports/progress_034.md`

### Documentation branch

- `README.md`

## Geometry to Appearance migration

Removed the standalone `StyleGeometrySection` and its dedicated test file. `StyleTab` now renders Corner Radius from `StyleAppearanceSection` for `custom_rect`, `custom_box`, `custom_card`, and `custom_banner`. Other shape types do not expose the control. The radius slider remains connected to the existing `onPartPropChange` mutation authority.

## Inspector action-row redesign

Replaced the separate visual tab bar with a compact action row containing Edit and Duplicate modes, followed by the existing duplicate-instance and delete/dissolve icon actions. Duplicate mode still renders the existing `DuplicateTab` behavior; no duplication or deletion logic was rewritten.

## Curve Editor polish

Added scoped class hooks and CSS for modal shell, graph surface, handle cards, value graph card, preview card, presets, CSS output, and Apply action. Added a single-column responsive layout below 820px. Existing Bézier math, Value/Speed graph state, presets, preview, clipboard, and Apply behavior were preserved.

## Header density changes

Improved internal header alignment, gaps, and narrow-layout wrapping rules. The established header height remains 79px and the left navigation width remains unchanged, preserving shell coordinate contracts used by V-M1 and V-H2.

## Defensive import correction

Scene import now defaults missing layer transform fields to `x=0`, `y=0`, `rotation=0`, `scaleX=1`, `scaleY=1`, and `opacity=1`. This prevents invalid `rotate(NaN)` SVG attributes for scenes that omit optional transform fields. Existing keyframe import defaults remain unchanged.

## MCP and UI tooling audit

- Browser automation was available and used through the isolated Chromium browser surface.
- Repository LSP, AST editing, and standard file/search tools were available.
- Chrome DevTools MCP was not mounted.
- shadcn MCP and 21st/Magic MCP were not installed or mounted.
- No external UI library was added.

## Libraries and dependency decision

No dependencies added. Existing React, TypeScript, Vite, CSS, and browser automation infrastructure were sufficient for the requested polish. Adding a component library would introduce unnecessary visual and dependency drift for scoped CSS changes.

## GitHub visual enhancements

The separate `docs/github-presentation` branch now includes two compact Mermaid diagrams:

1. Authoring loop: selection → Inspector → timeline → Value Graph → SVG preview → save/broadcast.
2. Runtime boundaries: React UI → orchestration → domain hooks → canonical evaluators → SVG/matte and serialization/OGraf outputs.

Existing Code of Conduct, Contributing, Security, License, issue, and pull-request guidance was preserved.

## Browser QA

Isolated Chromium smoke checks on the running product surface:

- Clean fixture import produced no console errors and no SVG attributes containing `NaN`.
- Luminance Target selected successfully.
- GEOMETRY text was absent.
- Corner Radius control rendered with `0 PX`.
- Slider edit changed the displayed value to `12 PX`.
- Duplicate action switched to the existing Mirror Y/Mirror X/Mirror Origin panel.
- Viewports checked: 1920×1080, 1440×900, and 1366×768.
- All checked viewports reported document scroll width equal to viewport width and scroll height equal to viewport height.
- Header measured 79px at all checked viewports.
- Curve Editor modal fit within the 1366×768 viewport; graph surface and responsive grid classes were present.

## Smoke tests and regression results

- Focused Vitest: 4 files, 29 tests passed.
- Full Vitest: 99 files, 1,421 tests passed.
- Focused Playwright: 105 tests passed.
- V6 QA (`npm run qa:v6`): 3 tests passed.
- Full Playwright (`CI=true npm run test:e2e`): 252 tests passed.
- TypeScript: `npx tsc --noEmit` passed.
- Lint: `npm run lint` passed with the existing `react(only-export-components)` warning in `src/context/AnimatorContext.tsx`.
- Build: `npm run build` passed with the existing large-chunk warning.
- Whitespace check: `git diff --check HEAD~1..HEAD` passed.

## Manual QA checklist

1. At 1920×1080, import `e2e/fixtures/v6-motion-core.scene.json`, select `Luminance Target`, open Appearance, and capture a screenshot showing Corner Radius with `0 PX`.
2. Change Corner Radius to 12 and capture the Appearance section showing `12 PX`; confirm the canvas corner geometry updates.
3. Capture the selected Inspector header showing the Edit/Duplicate action row and the existing duplicate/delete icon actions.
4. Click Duplicate, capture the Mirror Y/Mirror X/Mirror Origin panel, then click Edit and capture the normal Inspector sections.
5. Open Motion Curves, capture the full modal showing graph surface, handle cards, preview, presets, CSS output, and Apply action.
6. Repeat the Inspector and modal screenshots at 1440×900; confirm no horizontal or vertical page scrollbar appears.
7. Repeat at 1366×768; confirm the 79px header, action row, and Curve Editor remain visible without clipping.
8. In the Curve Editor, drag a Bézier handle, switch Value/Speed display, and capture the final graph state; verify Apply remains enabled and behavior is unchanged.
9. Open the GitHub README and verify both Mermaid diagrams render while the existing screenshot sections and repository policy links remain present.

## Known limitations

- Browser verification was Chromium-focused; Firefox and Safari were not exercised.
- The existing lint Fast Refresh warning and build chunk-size warning remain outside this scoped UI change.
- The untracked `reports/model_routing_analysis.md` file was intentionally preserved and is not part of this milestone.

## Git summary

- Product implementation: `4b390cb`.
- Documentation diagrams: `8540165`.
- Product branch still requires its explicit remote push after final report creation.
- Documentation branch was pushed successfully to `origin/docs/github-presentation`.
- `main` was not modified.

## Self-review

The change is limited to Inspector presentation, Curve Editor presentation, header alignment, import-boundary defaults, matching tests, and README visual navigation. No new animation, graph, playback, matte, broadcast, serialization, history, or clipboard authority was introduced. The imported-fixture console error was reproduced, traced to missing optional layer transform fields, and eliminated with boundary defaults rather than renderer-specific suppression.

## Next task

Manual QA gate: run the checklist above on the three required desktop viewports and capture the requested evidence before consolidating the V6 UI branch.

## DO NOT CHANGE CASUALLY

- `src/utils/evaluateTransform.ts` and `src/utils/evaluateFrame.ts` are canonical evaluation authorities.
- `Track.channels` is the canonical animation representation.
- `src/kcsEditorTheme.css` header height and left navigation geometry are coordinate-sensitive.
- V-M1 and V-H2 Playwright pixel contracts.
- `src/hooks/useSerialization.ts` migration and import compatibility behavior.
- Existing matte, broadcast, history, clipboard, and renderer pathways.

## Lessons learned

- Fixture imports are an important browser smoke boundary: missing optional transform fields can surface as invalid SVG even when TypeScript models are stricter.
- Presentation changes are safest when the existing domain mutation and evaluator authorities remain untouched.
- Compact visual diagrams communicate the product flow more effectively than adding another dense README narrative block.
