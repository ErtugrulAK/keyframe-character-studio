# KCS Development Report — Compact Pro Inspector PASS 5 Effects and Mask / Track Matte Refinement

Metadata:
- Date: 2026-09-02
- Milestone: KCS V5.1 — Compact Pro Inspector PASS 5 Effects and Mask / Track Matte refinement
- Branch: `main`
- Starting HEAD: `2a005fef1ec996cd7f86d52240c14d9318f48777`
- Ending HEAD: `2a005fef1ec996cd7f86d52240c14d9318f48777`
- Commit status: Intentional uncommitted working-tree changes; commit prohibited by task scope
- Report number: `progress_020.md`

# 1. Executive Summary

PASS 5 refines only the Effects and Mask / Track Matte Inspector surfaces. PASS 4 Appearance/Color and the previously approved Inspector foundation remain frozen. Effects keeps its existing Shadow / Glow controls but now uses an explicit compact property grid and a narrow color-row fallback. Mask / Track Matte gives the existing Mask Source select a full-width flexible row, keeps compact Mode and Gradient Type selects readable, and preserves the existing control inventory.

PASS 5.1 also closes correctness gaps found during the focused audit. Clip + Inverted now uses the existing binary alpha evenodd-hole mask path instead of silently producing no clip. Broadcast rendering now passes the actual project resolution into StagePartLayers, so inverted region geometry uses the correct project center. Matte paths for rounded custom Rectangle and Box sources now reuse the authored corner radius already used by visible shape renderers. The gradient slider preserves a visible `360°` endpoint while the authored value remains normalized to `0`.

No new effect or Matte mode, data-model field, serializer field, history authority, animation system, or parallel rendering engine was introduced. PASS 6 was not started.

Implementation state: COMPLETE.
PASS 4 user-QA baseline: APPROVED and preserved.
PASS 5 user manual-QA state: READY for final user confirmation.

# 2. Original Objectives

## In scope

- Complete PASS 5 only; do not start PASS 6.
- Audit every exposed Effects control and classify it by semantic type.
- Reduce Effects dead space and keep Shadow / Glow values grouped.
- Preserve all Effects values, ranges, steps, callbacks, history, and renderer behavior.
- Make Mask Source a flexible full-width layer-name control.
- Preserve the PASS 4 unified header, dark input hierarchy, centered numeric values, default-closed disclosures, and Hue endpoint behavior.
- Verify the normal Inspector width and the existing narrow clamp.
- Correct only observed Matte rendering and endpoint-presentation gaps within the named Effects and Matte scope.
- Add focused stable tests, relevant browser coverage, full regression, and the next sequential report.

## Explicitly out of scope

- PASS 6 or later roadmap work.
- New effects, modes, blend modes, mask modes, animation features, context menus, or general opacity features.
- Changes to PASS 4 Appearance, Fill, Stroke, RGBA, Hue, Alpha, HEX, Transform, Control Points, Trim Path, Boolean, Outliner, Timeline, viewport, dock, or selection behavior.
- Matte source eligibility, source filtering, source IDs, serialization shape, history boundaries, or migration behavior.
- Commit, push, branch creation, merge, rebase, reset, clean, stash, revert, or discard operations.

# 3. Problems Discovered

## Effects density and narrow overflow

- Symptom: Existing Shadow / Glow controls used repeated inline wrappers; the color row could exceed the narrow Inspector shell.
- Root cause: The color row had a long fixed label and intrinsic control minimums; the numeric group had no explicit responsive layout class.
- Fix: Named local Effects classes, three columns at normal width, two columns below the existing `300px` container threshold, one column below `220px`, and a stacked color row in the narrow case.
- Status: PASS.

## Mask Source width

- Symptom: The source select shared a half-width Matte grid cell with Mode, constraining long layer names.
- Root cause: A long-value select was assigned the same track strategy as short enum and scalar controls.
- Fix: The existing source field spans the Matte grid and uses flexible overflow-safe select presentation. Mode and Gradient Type use the existing compact control variable.
- Status: PASS.

## Clip + Inverted no-op behavior

- Symptom: The Inspector exposed Inverted for Clip, but the renderer's Clip branch only emitted a clipPath. Inverted therefore had no effect.
- Root cause: SVG clipPath cannot represent a negative region; the renderer had no branch for this combination.
- Fix: Clip + Inverted uses the existing alpha mask builder with a binary evenodd hole and no feather, strength, or gradient parameters. Normal Clip remains clipPath-based.
- Status: PASS by unit, DOM, pixel, and existing Matte E2E coverage.

## Broadcast inverted-region origin

- Symptom: StagePartLayers accepted an optional project resolution but StageCanvas did not pass the active project resolution, so broadcast output could use the default resolution when building inverted regions.
- Root cause: A caller omitted an already-supported prop.
- Fix: StageCanvas passes `projectResolution={projectResolution}` to the existing StagePartLayers authority.
- Status: PASS by TypeScript and renderer-path review; existing edit-mode behavior is unchanged.

## Rounded Matte source contour

- Symptom: Visible rounded custom Rectangle and Box renderers used `borderRadius`, while Matte path generation used the unrounded base geometry.
- Root cause: Matte geometry derived from shape geometry without applying the authored renderer radius.
- Fix: `buildMattePath` clamps and applies the authored radius for `custom_rect` and `custom_box` before converting the same local geometry to world space.
- Status: PASS by focused geometry test and the existing shared renderer geometry contract.

## Gradient endpoint display

- Symptom: The authored gradient angle normalizer treats `360°` as `0°`; a controlled slider therefore immediately displayed `0°` after the user moved to the right endpoint.
- Root cause: Persisted normalized state and endpoint presentation were coupled.
- Fix: A transient component-local endpoint display keeps `360°` visible for the active edit while `matte.gradient.angle` remains the sole persisted authority and remains normalized. External part or angle changes clear the transient overlay.
- Status: PASS by focused UI test and browser E2E.

# 4. Files Created

- `reports/progress_020.md`
  - Purpose: Sequential PASS 5 engineering report.
  - Dependencies: Current source, tests, browser measurements, and reporting policy.
- `src/tests/styleEffectsSection.test.tsx`
  - Purpose: Effects disclosure, control inventory, ranges, callback payloads, color editing, and Clear behavior.

No production utility, domain hook, context, serializer, evaluator, or persistent state file was created.

# 5. Files Modified

- `src/components/Inspector/sections/style/StyleEffectsSection.tsx`
  - Replaced repeated inline layout wrappers with local Effects classes.
  - Preserved the native color input, HEX editor, Clear action, SmartNumberInput controls, defaults, ranges, and callbacks.

- `src/components/Inspector/PropertyInspector.css`
  - Added scoped Effects color/grid/narrow rules.
  - Added scoped Matte source full-span, compact-select, and ellipsis rules.
  - No approved shared numeric or Appearance styles were changed.

- `src/components/Inspector/sections/style/StyleMatteSection.tsx`
  - Made Mask Source full-span and Mode/Gradient Type selects use compact width.
  - Added transient endpoint presentation for `360°`; persisted Matte state remains authoritative.

- `src/components/Canvas/StagePartLayers.tsx`
  - Added explicit Clip + Inverted mapping to the existing binary alpha hole mask.
  - Normal Clip, Alpha, Luminance, feather, strength, gradients, source transforms, and target transforms retain their existing paths.

- `src/components/Canvas/StageCanvas.tsx`
  - Passes the active `projectResolution` to StagePartLayers.

- `src/utils/matte.ts`
  - Applies authored Rectangle/Box corner radius when deriving Matte source paths.

- `src/tests/styleMatteSection.test.tsx`
  - Added full-width source structure and `360°` endpoint display/normalization coverage.

- `src/tests/matte.test.ts`
  - Added rounded Rectangle Matte contour coverage.

- `src/tests/matteRender.test.tsx`
  - Added Clip + Inverted alpha-hole DOM coverage.

- `e2e/track-matte.spec.ts`
  - Added Clip + Inverted pixel coverage, transformed Text target/source-world geometry coverage, and active `360°` endpoint/autosave coverage.

# 6. Architecture Overview

```text
DetailsPanel
  -> StyleTab
       -> StyleEffectsSection
            -> existing SmartHexInput / SmartNumberInput
            -> existing onPartPropChange
       -> StyleMatteSection
            -> existing Matte eligibility and normalizers
            -> existing onPartPropChange

StageCanvas
  -> StagePartLayers
       -> existing source transform evaluation
       -> existing Matte path / clip / mask builders
       -> existing PartRenderer outer matte wrapper + inner target transform

PropertyInspector.css
  -> scoped Effects density
  -> scoped Matte source and compact-select presentation
```

Existing authorities remain authoritative: `DetailsPanel` and the existing context/history path mutate authored state; `SmartNumberInput` parses scalar controls; `SmartHexInput` validates HEX; `evaluateFrame` supplies evaluated values; `PartRenderer` renders effects; `StagePartLayers` composes SVG Matte output; `src/utils/matte.ts` owns Matte geometry and normalization helpers.

No parallel state, evaluator, renderer, clock, playback loop, serialization path, or clipboard path was added.

# 7. Data Model Changes

None.

- No `CharacterPart` field changed.
- No `PartMatte` field changed.
- No field was renamed, added, removed, or migrated.
- No localStorage, scene JSON, preset, animation channel, or history snapshot schema changed.
- Clip + Inverted reuses the existing alpha-mask representation; it does not introduce a new mode or serialized field.
- The `360°` overlay is transient React UI state only; the authored angle remains normalized through the existing helper.

# 8. Coordinate Space Model

The Matte correctness fixes preserve the existing world-space contract.

- Source geometry is converted from source-local geometry through the evaluated source transform and the active output origin.
- The target's Matte attribute remains on the transformless outer wrapper; the target's evaluated transform remains on the inner rendered group.
- Normal Clip uses the source world path in a clipPath.
- Alpha and Luminance use the source world path in masks.
- Clip + Inverted uses the same project-space binary evenodd-hole mask shape as inverted Alpha, without soft or gradient parameters.
- Broadcast now receives the actual project resolution so its output origin is derived from the active project instead of the default fallback.
- Rounded Rectangle/Box Matte contours use the same authored corner radius as the visible shape geometry before world conversion.

# 9. Component / Module Walkthrough

## Effects controls

| Control | Semantic type | Presentation | Preserved authority |
|---|---|---|---|
| Shadow / Glow Color swatch | Color | Compact color controls row | Existing `shadowColor` callback |
| Shadow / Glow HEX | Short text/value | Flexible color controls row | Existing `SmartHexInput` |
| Clear Shadow | Action | Non-growing compact button | Existing clear callback |
| Blur Radius | Scalar numeric | Related three-value grid | Existing `0..50`, default `8`, SmartNumberInput |
| Offset X | Scalar numeric | Related three-value grid | Existing `-50..50`, default `0` |
| Offset Y | Scalar numeric | Related three-value grid | Existing `-50..50`, default `4` |

## Matte controls

| Control | Semantic type | Presentation | Preserved authority |
|---|---|---|---|
| Mask Source | Long layer-name select | Full Matte-grid row, ellipsis-safe | Existing eligibility/filtering/source ID |
| Mode | Enum select | Compact half-width field | Existing Clip/Alpha/Luminance policy |
| Inverted | Boolean | Existing paired field | Existing Matte mutation callback |
| Feather | Scalar range | Existing paired field | Existing `0..100` policy; disabled for Clip |
| Strength | Scalar range | Existing paired field | Existing `0..100%` policy; disabled for Clip |
| Gradient | Boolean | Existing paired field | Existing enable policy |
| Gradient Type | Enum select | Compact half-width field | Existing Linear/Radial policy |
| Angle | Scalar range | Existing Matte field | Existing `0..360` input and normalized authored value |
| Stops | Repeated color/offset/opacity values | Existing full-width group | Existing stop add/remove/edit callbacks |
| Enabled | Boolean | Existing full-width field | Existing enabled semantics |
| Remove | Action | Existing action row | Existing Matte removal callback |

No control was invented, removed, reordered semantically, or renamed.

# 10. Important Code Changes

Effects grouping:

```tsx
<div className="effects-property-grid">
  <div className="effects-property-field">BLUR RADIUS ...</div>
  <div className="effects-property-field">OFFSET X ...</div>
  <div className="effects-property-field">OFFSET Y ...</div>
</div>
```

Matte source and compact selects:

```tsx
<div className="matte-field matte-source-field matte-span-full">
  <label className="form-label">MASK SOURCE</label>
  <select className="select-control" ... />
</div>
```

Clip + Inverted correctness:

```tsx
if (mode === 'clip' && layer.matte.inverted === true) {
  matteMasks.set(
    matteMaskId(source.id, 'alpha', true),
    buildMatteMaskFromPath(source.id, pathD, 'alpha', true, '#ffffff'),
  );
}
```

Rounded source geometry:

```ts
const resolvedGeo = isRoundedShape && geo.kind === 'rect'
  ? { ...geo, rx: clamp(sourcePart.borderRadius, 0, geo.width / 2, geo.height / 2) }
  : geo;
```

Endpoint presentation keeps persistence normalized:

```tsx
const normalizedAngle = normalizeGradientAngle(nextAngle) ?? 0;
setAngleDisplay(nextAngle);
setMatte({ ...matte, gradient: { ...matte.gradient, angle: normalizedAngle } });
```

# 11. Public Interfaces

No public application API changed.

- `StyleEffectsSection` props are unchanged.
- `StyleMatteSection` props are unchanged.
- `StagePartLayers` already accepted optional `projectResolution`; only its existing caller was corrected.
- No exported type, hook, callback, or domain interface was added.
- CSS class names are local implementation details.

# 12. Algorithms and Geometry

The requested PASS 5 presentation changes are CSS/markup only. The focused correctness audit also made two narrow geometry/rendering corrections within the named Matte scope:

- Clip + Inverted now selects the existing alpha evenodd-hole builder because clipPath cannot express an inverted region.
- Rounded custom Rectangle/Box source paths now apply the same authored radius used by visible renderers.

No new geometry engine or algorithm was introduced. Existing source-transform composition, target-transform composition, feather filter, strength opacity, gradient stops, luminance behavior, and animated source evaluation remain in their existing authorities.

# 13. Interaction / UX Behavior

## Effects

Before: Existing controls were correct but visually loose and could overflow internally at the narrow clamp.

After: The color row and three related Shadow values use an explicit compact layout. The normal target shows one three-value group; narrow containers use a readable fallback. Existing editing, Clear, renderer response, and Undo/Redo remain unchanged.

## Mask / Track Matte

Before: Mask Source shared a scalar-sized grid cell; Clip + Inverted was exposed but had no effective renderer branch.

After: Mask Source spans the full grid, compact enum selects remain readable, and Clip + Inverted produces a real binary hole. Existing source selection, None, Mode, toggles, sliders, gradients, stops, Enabled, Remove, and history routes remain available.

## Gradient endpoint

The right endpoint displays `360°` during the active slider edit while authored state remains `0`, preserving both user feedback and serialization compatibility. An external part or angle change clears only the transient display.

## Empty state

Effects and Matte retain their existing empty/disabled behavior. The previously removed Matte explanatory paragraph remains absent.

# 14. Design Decisions

## Named local density classes

Chosen over more inline styles, a generic property-row abstraction, or broad Inspector refactoring. This keeps layout ownership local and explicit.

## Semantic grouping

Blur Radius, Offset X, and Offset Y remain together because they are one existing Shadow parameter group. Mask Source receives flexibility because layer names are long semantic values, while enum and scalar controls remain compact.

## Reuse alpha mask for Clip + Inverted

Chosen because SVG clipPath cannot represent a negative area and the repository already has a tested binary evenodd-hole alpha-mask path. This avoids a new mask mode, new serializer field, or parallel geometry implementation. Feather, strength, and gradients remain intentionally unavailable in Clip mode.

## Preserve normalized angle authority

Chosen to keep existing `normalizeGradientAngle` and serialized state unchanged while preventing the controlled range from visually snapping away from its selected endpoint.

# 15. Invariants That Must Be Preserved

- PASS 4 unified neutral headers, right disclosure controls, `aria-expanded`, `aria-controls`, and default-closed behavior.
- Fixed Inspector width, centered numeric values, dark input hierarchy, focus styling, and approved Appearance/Color behavior.
- Effects control inventory, values, ranges, steps, defaults, callbacks, animation, renderer, and history.
- Matte source eligibility, filtering, IDs, None semantics, missing-source handling, and option accessibility.
- Normal Clip semantics and all existing Alpha/Luminance, inverted, feather, strength, gradient, stop, Enabled, Remove, animation, and serialization behavior.
- Clip + Inverted remains binary and does not acquire Clip-disabled feather/strength/gradient semantics.
- `360°` remains a display endpoint only; persisted Matte angle remains normalized.
- No new CENTER alignment option, effect, Matte mode, blend mode, animation feature, opacity feature, or Boolean feature.
- Transform, Control Points, selection, Outliner, Timeline, viewport, Reset View, playback, broadcast behavior outside the corrected resolution prop, serialization, migration, and dock behavior remain frozen.

# 16. Testing and Verification

## TypeScript

- `npx tsc --noEmit` — PASS.

## Focused Vitest / component tests

- `node ./node_modules/vitest/vitest.mjs run src/tests/styleEffectsSection.test.tsx src/tests/styleMatteSection.test.tsx src/tests/styleAppearanceSection.test.tsx src/tests/styleCard.test.tsx src/tests/colorPickerPopover.test.tsx src/tests/propertyInspector.test.tsx src/tests/transformControlPoints.test.tsx src/tests/trimPathSection.test.tsx` — PASS, 8 files / 137 tests.
- `node ./node_modules/vitest/vitest.mjs run src/tests/matte.test.ts src/tests/matteRender.test.tsx src/tests/styleMatteSection.test.tsx` — PASS, 3 files / 366 tests.

## Playwright / E2E

- `e2e/stroke-alignment-v2.spec.ts e2e/trim-path-v2.spec.ts e2e/shape-appearance-bounds.spec.ts --retries=0` — PASS, 9 tests after resolving the known local dev-server port ownership conflict.
- `npx playwright test e2e/track-matte.spec.ts --retries=0` — PASS, 79 tests in 5.1 minutes.
- `npx playwright test e2e/track-matte.spec.ts --grep "V-A2|V-B2|V-G13" --retries=0` — PASS, 3 tests in 4.8 seconds.
- Added browser contracts cover Clip + Inverted pixels, transformed Text target/source-world geometry, and UI `360°` display with autosaved normalized angle.

# 16.1 Full Regression Result Details

- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS with the existing `react(only-export-components)` warning at `src/context/AnimatorContext.tsx:630`.
- `npm test` — PASS, 89 files / 1,363 tests. Vitest emitted three existing `Not implemented: navigation to another Document` notices; no test failed.
- `npm run build` — PASS. Vite emitted the existing large JavaScript chunk warning; the current JavaScript bundle was 532.46 kB.
- `git diff --check` — PASS.

# 16.2 Manual Browser Evidence

- Chromium inspection covered the local app at `1440x1000` and `360x900`.
- At the normal target, the Inspector measured approximately `360px`; Effects used three approximately `103px` tracks and numeric inputs near `93px`; Mask Source measured approximately `325px`.
- At the narrow target, the Inspector measured approximately `250px`; Effects used two approximately `103.5px` tracks, numeric inputs near `94px`, and a stacked `215px` color row/control surface. Mask Source measured `215px`.
- Document and Inspector horizontal overflow were false at both inspected widths.
- Existing Effects UI editing changed color to `#336699`, Blur to `16`, Offset X to `-6`, and Offset Y to `11`; the existing SVG `feDropShadow` changed accordingly. Undo restored the prior value and Redo restored the edited value.
- Existing Matte source selection to None removed the relation; Undo restored the source, Clip mode, and Enabled state.
- A real narrow-width seeded scene showed the Matte source select at `215px`, Mode and Gradient Type selects at compact `88px`, and `360px` document width with no horizontal overflow.
- The real narrow-width UI changed Mode to Clip and enabled Inverted; the rendered DOM contained `kcs-mask-src-alpha-inv` with `mask-type="alpha"` and `fill-rule="evenodd"`, no `kcs-clip-src` clipPath, and no horizontal overflow.
- The Matte explanatory paragraph remained absent and the full-width source control remained readable.

## Full regression

- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS with the existing `react(only-export-components)` warning at `src/context/AnimatorContext.tsx:630`.
- `npm test` — PASS, 89 files / 1,363 tests. Vitest emitted three existing `Not implemented: navigation to another Document` notices; no test failed.
- `npm run build` — PASS with the existing Vite large JavaScript chunk warning; current bundle was 532.46 kB.
- `git diff --check` — PASS.

## Manual browser verification

- Chromium inspection covered the local app at `1440x1000` and `360x900`.
- At the normal target, the Inspector measured approximately `360px`; Effects used three approximately `103px` tracks and numeric inputs near `93px`; Mask Source measured approximately `325px`.
- At the narrow target, the Inspector measured approximately `250px`; Effects used two approximately `103.5px` tracks, numeric inputs near `94px`, and a stacked `215px` color row/control surface. Mask Source measured approximately `215px`.
- Document and Inspector horizontal overflow were false at both inspected widths.
- Existing Effects UI editing changed color to `#336699`, Blur to `16`, Offset X to `-6`, and Offset Y to `11`; the existing SVG `feDropShadow` changed accordingly. Undo restored the prior value and Redo restored the edited value.
- Existing Matte source selection to None removed the relation; Undo restored the source, Clip mode, and Enabled state.
- A seeded narrow scene showed the Matte source at `215px`, compact Matte enum selects at `88px`, no horizontal overflow, and real Clip + Inverted DOM output using the alpha evenodd-hole mask.
- The Matte explanatory paragraph remained absent and the full-width source control remained readable.


# 17. Manual QA Results

- PASS — PASS 4 approved Appearance/Color baseline and unified section-header system remain visually preserved.
- PASS — Effects exposes only the existing Shadow / Glow inventory.
- PASS — Effects color, HEX, Clear, Blur Radius, Offset X, and Offset Y remain available and connected to existing callbacks.
- PASS — Effects normal and narrow density layouts are readable without internal or document overflow.
- PASS — Existing Effects renderer response and Undo/Redo were observed in the browser.
- PASS — Mask Source full-width presentation is structurally covered and was observed at normal and narrow widths.
- PASS — Existing source selection, None behavior, and Undo restoration were observed.
- PASS — Clip + Inverted binary alpha-hole behavior is covered by focused DOM tests and browser pixel coverage.
- PASS — Rounded source geometry is covered by focused Matte geometry coverage.
- PASS — Transformed Text target/source-world path behavior is covered by browser DOM coverage.
- PASS — `360°` active endpoint display with normalized authored angle is covered by focused UI and browser persistence coverage.
- PASS — Existing Mode, Inverted, Feather, Strength, Gradient, Type, Angle, Stops, Enabled, and Remove controls remain present under existing conditions.
- PASS — PASS 5 focused tests, Matte tests, TypeScript, lint, full Vitest, build, diff check, and relevant Playwright coverage pass.
- NOT TESTED — Final subjective user acceptance of PASS 5 spacing and density.
- NOT TESTED — PASS 6; explicitly not started.

# 18. Regression Risk Assessment

Overall: LOW to MEDIUM, limited to the named Matte correctness cases and local Inspector presentation.

- LOW: Effects classes are scoped and preserve existing value/callback expressions.
- LOW: Matte source and compact-select CSS affects only named local selectors.
- MEDIUM: Clip + Inverted changes an exposed but previously ineffective combination to the intended binary hole behavior; the change is covered by unit, DOM, and pixel tests.
- LOW: Rounded source path now matches the visible renderer's authored corner radius.
- LOW: StageCanvas passes an already-supported resolution prop; no new coordinate system was added.
- LOW: Endpoint display state is transient and cleared on external part/angle changes.
- LOW: No schema, dependency, timer, event-listener, or hot-path architecture change was introduced.

# 19. Performance Considerations

- No new render loop, timer, subscription, or global event listener was added.
- Effects and Matte CSS uses ordinary grid/flex layout.
- Clip + Inverted reuses one existing mask path per source and does not add a new geometry pass.
- Rounded path resolution adds only a finite-number check and clamp during existing Matte path construction.
- Endpoint display adds small component-local state/ref work only while editing the existing slider.
- No benchmark was required or performed.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

- React props and callback signatures remain compatible.
- TypeScript and Vite build compatibility verified.
- Vitest compatibility verified by the focused and full suites.
- Chromium compatibility verified by relevant Playwright suites and browser inspection.
- Saved-project compatibility preserved: no authored or serialized fields changed.
- Edit and Broadcast rendering share the same StagePartLayers path; Broadcast now receives its active project resolution explicitly.
- Windows working-tree and local service workflow remained compatible.

# 22. Known Limitations

- Final subjective judgment of spacing, label balance, and density remains with user manual QA.
- Manual browser inspection used representative shapes and a valid Matte source; every object type and every Matte mode was not manually swept.
- Long-name behavior is covered structurally and by measured layout; a long name was not created through a full rename workflow in the browser.
- The full track-matte run was executed as a broad regression rather than a user-facing visual review of every scenario.
- Existing lint and build warnings remain because they predate this pass and do not fail validation.
- PASS 6 remains intentionally unstarted.

# 23. Technical Debt

- Historical Inspector CSS remains larger than the local PASS 5 additions; broad consolidation requires separate approval.
- Effects retains the existing native color input by design.
- Matte stop rows retain their existing control layout; this pass did not broaden presentation scope unnecessarily.
- The Matte renderer still has separate existing branches for text/image/video source eligibility; this pass preserves those contracts.
- Future work may add more browser-level Inspector interaction coverage, but no such expansion belongs to PASS 5.

# 24. Git Summary

- Branch: `main`.
- Starting and ending HEAD: `2a005fef1ec996cd7f86d52240c14d9318f48777`.
- `origin/main` at start: same SHA; ahead/behind `0/0`.
- Working tree was clean at start.
- Working tree changes are intentionally uncommitted and limited to the listed PASS 5 source, tests, and report.
- No staged changes are intended.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.
- No branch, merge, rebase, reset, clean, stash, revert, or discard operation was performed.

# 25. Updated Project Tree

Relevant PASS 5 files:

```text
reports/
  progress_020.md                              [new]
src/components/Canvas/
  StageCanvas.tsx                              [modified]
  StagePartLayers.tsx                          [modified]
src/components/Inspector/
  PropertyInspector.css                        [modified]
  sections/style/
    StyleEffectsSection.tsx                    [modified]
    StyleMatteSection.tsx                      [modified]
src/tests/
  matte.test.ts                                 [modified]
  matteRender.test.tsx                          [modified]
  styleEffectsSection.test.tsx                  [new]
  styleMatteSection.test.tsx                    [modified]
e2e/
  track-matte.spec.ts                           [modified]
```

No generated `dist`, screenshot, temporary artifact, or `.hermes/desktop-attachments` file was intentionally added.

# 26. Self Review

Good:

- Effects and Matte controls were inventoried before layout changes.
- Existing authorities were reused rather than duplicated.
- Narrow overflow was fixed with scoped layout rules rather than a global hiding rule.
- Clip + Inverted now has explicit observable behavior instead of silently doing nothing.
- Broadcast receives the already-supported active project resolution.
- Rounded Matte geometry matches visible rounded Rectangle/Box geometry.
- The normalized angle contract remains intact while the endpoint is visibly usable.
- Focused tests cover the newly observable contracts; browser tests cover DOM and pixel behavior.
- PASS 4 was not redesigned and PASS 6 was not started.

Could improve in a future approved pass:

- Add a dedicated browser workflow that creates a long layer name through the actual rename UI.
- Add a browser visual snapshot review for the final compact Inspector surface if the user requests it.

Uncertainty:

- User preference for the exact vertical trade-off of the full-width source row remains the final manual-QA decision.

Score: 9/10. Scope is narrow, correctness gaps are covered, and the remaining decision is user visual acceptance.

# 27. Next Recommended Task

Perform final user manual QA of PASS 5. Do not begin PASS 6 until the user explicitly approves the next scope.

# 28. Project Status

- Current milestone: KCS V5.1 Compact Pro Inspector PASS 5 implementation complete.
- PASS 4 baseline: user-QA approved and preserved.
- Completed: Effects inventory, compact grouping, narrow fallback, full-width Mask Source, Matte correctness audit fixes, focused tests, relevant E2E coverage, full regression, browser inspection, and sequential report.
- Remaining for PASS 5: final user visual confirmation.
- PASS 6: not started.
- QA stage: READY FOR USER MANUAL QA.

# 29. AI Development Notes

- Keep `StyleEffectsSection` and `StyleMatteSection` thin; mutation remains on the existing callback path.
- Keep `SmartNumberInput` and `SmartHexInput` as input authorities.
- Keep `PartRenderer` as effect rendering authority.
- Keep `StagePartLayers` and `src/utils/matte.ts` as Matte composition and geometry authorities.
- Do not create a second angle, Matte, playback, or serialization authority.
- Treat long selects as semantic long values and related scalar numbers as compact grouped values.
- Preserve the PASS 4 neutral header and approved Appearance/Color surfaces.
- Preserve the normalized authored-angle contract if the UI is changed later.

## DO NOT CHANGE CASUALLY

- Effect algorithms, SVG filters, effect order, authored values, effect animation, renderer inputs.
- Matte eligibility/filtering, source IDs, mode semantics, feather, strength, gradients, stops, serialization, and history boundaries.
- `DetailsPanel`, `AnimatorContext`, Smart inputs, section disclosure state, and Undo/Redo routing.
- Appearance Fill/Stroke, RGBA, Hue, Alpha, HEX, Hue endpoint, Stroke Width + Align, Trim Path, Transform, Control Points, Boolean, Outliner, timeline, viewport, selection, playback, and dock behavior.
- PASS 6 features or any Git state change before explicit approval.

# 30. Lessons Learned

- Semantic control inventory prevents arbitrary grouping and accidental new scope.
- Narrow-container checks must inspect both document overflow and internal flex/grid width.
- Long layer-name selects should be sized by content semantics rather than scalar-control conventions.
- Exposed UI combinations require renderer coverage; a control can be present while its combination is ineffective.
- Reusing a tested evenodd-hole mask is safer than inventing a negative clip geometry path.
- Renderer geometry and Matte geometry must share authored corner-radius inputs.
- A supported prop omitted at a caller can create mode-specific coordinate bugs without changing the callee contract.
- Persisted normalization and endpoint presentation can coexist when transient UI state is explicitly cleared on external changes.
- Browser DOM plus pixel assertions provide stronger evidence for SVG Matte behavior than component markup alone.
- Frozen approved surfaces are safest when new selectors stay scoped and existing authorities remain unchanged.
