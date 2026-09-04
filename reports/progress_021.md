# KCS Development Report — PASS 5.1 Matte Correctness Recovery and Local UI Cleanup

Metadata:
- Date: 2026-09-02
- Milestone: KCS V5.1 — PASS 5.1 Mask / Track Matte correctness recovery + local UI cleanup
- Branch: `main`
- Starting HEAD: `2a005fef1ec996cd7f86d52240c14d9318f48777`
- Ending HEAD: `2a005fef1ec996cd7f86d52240c14d9318f48777`
- Upstream at start: `origin/main` at the same SHA; ahead/behind `0/0`
- Report number: `progress_021.md`
- Git state: Intentional uncommitted PASS 5 and PASS 5.1 working-tree changes; commit and push prohibited

# 1. Executive Summary

PASS 5.1 investigated the user-reported Mask / Track Matte failures without starting PASS 6 or unrelated Inspector work. The existing Matte authorities were retained. The work corrects Clip + Inverted behavior, synchronizes rounded Rectangle/Box Matte contours with visible geometry, passes the active project resolution into the existing StagePartLayers caller, preserves the normalized gradient-angle data contract while keeping the active `360°` endpoint visible, and applies only local compact sizing to short Matte selects plus the full-width long Mask Source.

The Alpha/Luminance investigation found that the normal source-world transform contract was already the correct architecture: source geometry is converted from authored/evaluated source-local geometry to stage coordinates, while the target Matte attribute is applied to a transformless outer wrapper and the target transform remains on the inner rendered group. Browser and focused tests confirm transformed Text targets use the actual Rectangle source path. The concrete geometry mismatches found were authored rounded-corner geometry not being reused by Matte path generation and the Broadcast caller omitting its already-supported project-resolution prop.

Feather was not disconnected. For Alpha/Luminance, the existing renderer produces a Gaussian blur filter and visible softening in the established pixel tests. Clip intentionally disables Feather because Clip is binary. Strength remains unchanged and continues to affect matte content opacity. Gradient behavior was documented rather than redesigned.

PASS 4 remains frozen. Effects behavior remains frozen. Timeline, Transitions removal, Text redesign, Text selection border work, and Text color work were not started.

# 2. Original Objectives

## Approved scope

- Investigate and fix Mask / Track Matte correctness bugs found during PASS 5 user QA.
- Fix Clip + Inverted if the exposed toggle was ineffective.
- Verify Alpha/Luminance source geometry, source transforms, target transforms, and Text targets.
- Verify Feather reaches the renderer and has the intended mode-dependent behavior.
- Document existing Gradient semantics and correct only proven defects.
- Preserve normalized authored angles while fixing the active `360°` endpoint display.
- Apply tiny Matte-local density corrections: compact short controls, flexible long Mask Source.
- Add focused tests for corrected behavior and a real browser Matte workflow.
- Run focused QA, relevant Playwright coverage, full regression, scope audit, and sequential report creation.

## Explicit non-goals

- PASS 6 or general Inspector final polish.
- Effects behavior changes.
- Timeline or Transitions changes.
- Text redesign, Text color redesign, or independent Text selection-border correction.
- Transform, Control Points, Appearance, Hue, Stroke, Trim Path, Boolean, Outliner, selection, history ownership, serialization, migration, or project data-model changes.
- Commit, push, branch operations, reset, clean, stash, revert, or discard.

# 3. Problems Discovered

## A. Clip + Inverted

The Inspector allowed Inverted with Mode = Clip, but the Clip renderer branch only emitted a clipPath. Since SVG clipPath cannot represent a negative region, the Inverted toggle could produce no visible result.

Resolution: Clip + Inverted now reuses the existing binary Alpha inverted-mask path. The mask contains the project-region contour and source contour as one `evenodd` path. Normal Clip still uses the existing clipPath. Clip remains binary and does not gain Feather, Strength, or Gradient behavior.

## B. Alpha/Luminance geometry

The investigation traced source geometry through `evaluateFrame`, `buildMattePath`, source world transforms, output origin, `buildMatteMaskFromPath`, and the `PartRenderer` outer/inner transform structure. The shared source path was not replaced by a target bounds rectangle. A transformed Text target regression confirms the source path remains the authored Rectangle contour while the Text target transform is applied independently.

Two real mismatch risks were corrected:

- Rounded custom Rectangle and Box visible renderers applied authored `borderRadius`, but Matte path generation used the base unrounded geometry.
- Broadcast StagePartLayers already accepted `projectResolution`, but StageCanvas omitted it, causing inverted project-region geometry to fall back to `1920x1080` instead of the active project resolution.

No arbitrary Text offset, target-bounds substitution, or CSS workaround was introduced.

## C. Feather

The existing UI correctly disables Feather in Clip mode. Alpha/Luminance retain Feather. Existing SVG mask generation creates a stable `feGaussianBlur` filter for nonzero Feather, and the established browser pixel ramp tests distinguish sharp and softened edges. The user observation was not caused by a missing callback or missing renderer branch in the verified modes; the effect can be visually subtle depending on source size and probe placement.

No artificial threshold, retry, sleep, or visual fallback was added.

## D. Gradient semantics

Gradient is a mask-intensity control for Alpha/Luminance modes. It does not add geometry or move the source. Linear Gradient uses Angle and Stops to vary mask intensity across the source-world mask. Radial Gradient derives center/radius from source geometry; Angle is inert for radial output and is preserved for a switch back to Linear. Stops define ordered color/opacity contributions to the mask gradient. Existing gradient IDs, stop normalization, mode-specific defaults, and SVG gradient composition remain the authorities.

## E. Gradient Angle endpoint

The existing canonical normalizer maps `360°` to `0°`. A controlled range bound directly to normalized authored state therefore jumped from the right edge to the left edge during an endpoint edit. A local transient display overlay now keeps `360°` visible for the active edit while the authored Matte value remains normalized and serialized as before. External authored changes clear the overlay.

## F. Matte density

Short enum selects such as Mode and Gradient Type were wider than their semantic content required. Mask Source contains long layer names and must remain flexible. Local compact-select rules and the existing full-span source rule resolve this without redesigning the section.

# 4. Files Created

- `reports/progress_021.md`
  - Purpose: Sequential PASS 5.1 engineering record.
  - Policy: Next report after `progress_020.md`; the earlier report was not overwritten.
  - Content: Findings, current contracts, fixes, tests, browser QA, risks, deferred work, and Git state.

No new production utility, domain hook, context, serializer, evaluator, clock, or persistent state file was created.

# 5. Files Modified

The PASS 5.1 implementation is present in the approved uncommitted working tree:

- `src/components/Canvas/StagePartLayers.tsx`
  - Maps Clip + Inverted to the existing binary Alpha evenodd-hole mask.
  - Keeps normal Clip, Alpha, Luminance, Feather, Strength, Gradient, source transform, and target transform paths intact.

- `src/components/Canvas/StageCanvas.tsx`
  - Passes the active `projectResolution` to the existing StagePartLayers prop.

- `src/utils/matte.ts`
  - Applies authored `borderRadius` for `custom_rect` and `custom_box` source contours before world-space conversion.

- `src/components/Inspector/sections/style/StyleMatteSection.tsx`
  - Keeps Mask Source full-span.
  - Uses compact select presentation for short Matte enums.
  - Adds transient local endpoint display state only for the active normalized-angle endpoint.

- `src/components/Inspector/PropertyInspector.css`
  - Adds Matte-local compact-select rules and retains the scoped source/full-width and Effects density rules from PASS 5.

- `src/tests/matteRender.test.tsx`
  - Adds Clip + Inverted mask coverage and Broadcast project-resolution center coverage.

- `src/tests/matte.test.ts`
  - Adds authored rounded Rectangle contour coverage.

- `src/tests/styleMatteSection.test.tsx`
  - Adds Mask Source structure and `360°` display/normalization coverage.

- `e2e/track-matte.spec.ts`
  - Adds Clip + Inverted pixel coverage, transformed Text target/source-world geometry coverage, and browser angle endpoint/autosave coverage.

- `src/components/Inspector/sections/style/StyleEffectsSection.tsx`
  - Contains the previously approved PASS 5 Effects presentation-only density classes; no PASS 5.1 Effects behavior change was made.

- `src/tests/styleEffectsSection.test.tsx`
  - Contains the previously approved PASS 5 Effects presentation and callback coverage.

# 6. Architecture Overview

```text
StyleTab
  -> StyleMatteSection
       -> existing eligibility and normalization helpers
       -> existing onPartPropChange callback

StageCanvas
  -> StagePartLayers
       -> evaluateFrame
       -> existing source world transform
       -> buildMattePath / buildMatteClipPath
       -> buildMatteMaskFromPath
       -> existing PartRenderer outer Matte wrapper
       -> existing target inner transform

PropertyInspector.css
  -> scoped Matte density rules
```

The architecture remains a pure-helper plus thin-component flow. `StyleMatteSection` edits through the existing generic callback. `evaluateFrame` remains the evaluated-state authority. `StagePartLayers` remains the SVG Matte composition authority. `src/utils/matte.ts` remains the Matte geometry and normalization authority. `PartRenderer` remains responsible for rendering the target and effect contents.

No duplicate Matte store, second coordinate system, second serializer, local domain authority, or new render loop was added.

# 7. Data Model Changes

None.

- No `CharacterPart` field changed.
- No `PartMatte` field changed.
- No Matte mode or enum was added.
- No serialized field was renamed, added, removed, or migrated.
- Clip + Inverted reuses the existing Alpha mask representation and does not change serialized Matte data.
- The `360°` display value is transient React state only; authored Matte angle remains normalized by the existing helper.
- Existing source selection, Remove, Undo, Redo, presets, clipboard, and saved-project paths were not structurally changed.

# 8. Coordinate Space Model

The invariant is source-authored/evaluated geometry in the active stage coordinate system.

1. `evaluateFrame` resolves the source transform for the current frame.
2. `buildMattePath` reads the source's actual static shape geometry or freeform points.
3. The source transform and output origin convert that local geometry into world/stage path coordinates.
4. `buildMatteMaskFromPath` or `buildMatteClipPath` stores that path in user-space SVG definitions.
5. The Matte attribute is placed on the target's transformless outer group.
6. The target's evaluated transform remains on the inner rendered group, so target scale/rotation does not distort the source path.
7. Broadcast derives output origin from the supplied project resolution.

Rounded Rectangle/Box sources now use the same authored corner radius as the visible shape renderer. Text targets do not supply Matte source geometry in this contract; they are target content receiving the source shape's mask.

# 9. Component / Module Walkthrough

## `StyleMatteSection`

| Control | Existing meaning | PASS 5.1 result |
|---|---|---|
| Mask Source | Select an eligible source part | Remains flexible/full-width; source IDs and filtering unchanged |
| Mode | `clip`, `alpha`, or `luminance` | Existing modes preserved; Clip + Inverted now renders effectively |
| Inverted | Reverse visible matte region | Existing Alpha/Luminance semantics preserved; Clip now uses a binary hole |
| Feather | Blur matte edge | Disabled for Clip; available for Alpha/Luminance |
| Strength | Multiply matte content opacity | Existing semantics preserved |
| Gradient | Enable mask intensity gradient | Existing semantics documented and preserved |
| Gradient Type | Linear or radial intensity | Compact select only; renderer behavior unchanged |
| Angle | Linear gradient direction | Local endpoint overlay; authored value remains normalized |
| Stops | Gradient color/opacity positions | Existing stop normalization and SVG gradient path preserved |
| Enabled | Enable or disable Matte | Existing callback and active-state logic preserved |
| Remove | Remove Matte object | Existing removal and history path preserved |

## `StagePartLayers`

Builds one deterministic source definition per applicable source/mode combination, reuses cached source world paths, and returns Matte attributes for target wrappers. The new Clip + Inverted branch selects the existing Alpha inverted path only because clipPath cannot express a negative region.

## `src/utils/matte.ts`

Owns source geometry conversion, mode normalization, feather/strength/angle normalization, gradient IDs/stops, and SVG Matte data construction. The new rounded-geometry adjustment reuses existing shape geometry rather than creating a second renderer.

# 10. Important Code Changes

Clip + Inverted:

```tsx
if (mode === 'clip' && layer.matte.inverted === true) {
  const pathD = buildMattePath(source, sourceEl.transform, outputOrigin);
  matteMasks.set(
    matteMaskId(source.id, 'alpha', true),
    buildMatteMaskFromPath(source.id, pathD, 'alpha', true, '#ffffff'),
  );
}
```

Target attribute lookup:

```tsx
if (mode === 'clip' && part.matte.inverted === true) {
  const id = matteMaskId(part.matte.sourcePartId, 'alpha', true);
  return matteMasks.has(id) ? { maskId: id } : {};
}
```

Rounded source path:

```ts
const resolvedGeo = isRoundedShape && geo.kind === 'rect'
  ? { ...geo, rx: clamp(authoredRadius, 0, geo.width / 2, geo.height / 2) }
  : geo;
```

Broadcast caller:

```tsx
<StagePartLayers projectResolution={projectResolution} ... />
```

Endpoint presentation:

```tsx
const normalizedAngle = normalizeGradientAngle(nextAngle) ?? 0;
setAngleDisplay(nextAngle);
setMatte({ ...matte, gradient: { ...matte.gradient, angle: normalizedAngle } });
```

# 11. Public Interfaces

No public application API changed.

- `StyleMatteSection` props are unchanged.
- `StagePartLayers` already exposed optional `projectResolution`; the existing caller now supplies it.
- Matte utility exports and types are unchanged.
- No new exported hook, callback, or domain interface was introduced.
- CSS classes are local implementation details.

# 12. Algorithms and Geometry

No new algorithmic subsystem was added. Two narrow existing-contract corrections were made:

- Clip + Inverted selects a tested binary evenodd-hole mask because SVG clipPath cannot encode an inverted area.
- Rounded `custom_rect` and `custom_box` source paths use the authored radius already used by visible renderers.

Alpha/Luminance color-to-mask behavior, Feather blur generation, Strength opacity, Gradient stop handling, source animation, and target transform composition remain existing implementations. The Broadcast correction supplies the intended origin input; it does not change the coordinate model.

# 13. Interaction / UX Behavior

## Clip

With Inverted off, the target is visible inside the actual source shape. With Inverted on, the target is visible outside the source shape within the binary project region; the source-shaped area becomes the hole. This behavior is now emitted as an Alpha evenodd-hole mask rather than an ineffective clipPath.

## Alpha and Luminance

Both modes use the source's actual evaluated geometry in stage coordinates. Alpha uses source alpha/white mask content. Luminance uses source visual luminance. Source movement and transforms update the generated path through the existing per-frame evaluation path; target movement and transforms remain target-local.

## Feather

Feather is intentionally unavailable in Clip. In Alpha/Luminance, nonzero Feather generates the existing blur filter and softens the mask boundary. It does not change source geometry or source opacity.

## Strength

Strength preserves the existing content-opacity semantics: `100%` is full matte content, `50%` halves it, and `0%` makes the target matte content invisible while preserving the source's own visual layer.

## Gradient

Gradient changes mask intensity, not source geometry. Linear uses Angle and Stops; radial derives its geometry from source bounds. The target is revealed with the resulting mask intensity. Existing enable/disable, type, angle, and stop callbacks remain unchanged.

## Angle endpoint

The active range stays at the right edge and displays `360°`. The authored value remains normalized to `0`, and external authored changes clear the transient endpoint overlay.

# 14. Design Decisions

## Reuse Alpha mask for Clip + Inverted

A clipPath cannot express an outside region. Reusing the tested Alpha evenodd-hole path avoids new serialized modes, new geometry math, and new renderer state. Feather, Strength, and Gradient remain disabled in Clip to preserve existing UI semantics.

## Preserve source/target transform separation

The outer transformless target wrapper plus inner target transform is retained because it lets the source path remain in stage coordinates while target transforms remain independent. Introducing a target-bounds conversion or arbitrary Text offset would violate the coordinate invariant.

## Synchronize visible rounded geometry

Applying the authored radius in `buildMattePath` reuses the same `getShapeGeometry` contract and removes divergence between visible Rectangle/Box contours and Matte contours.

## Keep endpoint state transient

The normalized data authority remains `matte.gradient.angle`. A local overlay is the smallest fix for controlled-range endpoint feedback and is cleared when external authored state changes.

## Compact only short Matte controls

Mode and Gradient Type are short enum values and use a compact width. Mask Source remains full-width because layer names are long semantic values. No whole-section one-column redesign was made.

# 15. Invariants That Must Be Preserved

- PASS 4 Appearance/Color and Hue endpoint behavior.
- Effects authored values, renderer behavior, editing, and Undo/Redo.
- Matte source eligibility, filtering, IDs, None semantics, and missing-source handling.
- Existing Alpha/Luminance algorithm, luminance color response, Strength, Feather, Gradient, Stops, Enabled, Remove, animation, history, and serialization semantics.
- Clip normal behavior remains clipPath-based and binary.
- Clip + Inverted remains binary and does not enable Clip-disabled controls.
- Source geometry always derives from actual source geometry and evaluated source transform.
- Target transform remains separate from source Matte path.
- No Text selection border, Text color, Timeline, Transitions, or PASS 6 work.

# 16. Testing and Verification

## Focused tests

- `node ./node_modules/vitest/vitest.mjs run src/tests/matte.test.ts src/tests/matteRender.test.tsx src/tests/styleMatteSection.test.tsx` — PASS, 3 files / 367 tests.
- The focused run includes static and rounded source geometry, Clip normal/inverted DOM, Broadcast project-resolution origin, Matte UI controls, gradient behavior, source selection, Remove, and `360°` endpoint normalization/display.

## Playwright

- `npx playwright test e2e/track-matte.spec.ts --grep "V-A2|V-B2|V-G13" --retries=0` — PASS, 3 tests in 7.8 seconds during this verification.
- `npx playwright test e2e/track-matte.spec.ts --retries=0` — PASS, 79 tests in 5.1 minutes on the same implementation before the final test-helper-only Broadcast assertion addition.
- Existing relevant regression `e2e/stroke-alignment-v2.spec.ts e2e/trim-path-v2.spec.ts e2e/shape-appearance-bounds.spec.ts --retries=0` — PASS, 9 tests after resolving the known local server ownership conflict.

## Full regression

- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS with one existing warning at `src/context/AnimatorContext.tsx:630` (`react(only-export-components)`).
- `npm test` — PASS, 89 files / 1,364 tests.
- `npm run build` — PASS; current bundle `532.46 kB`, with the existing Vite large-chunk warning.
- `git diff --check` — PASS.
- Vitest emitted three existing `Not implemented: navigation to another Document` notices; no test failed.

## Browser/manual QA

- `360x900` seeded browser surface: document width `360px`, no horizontal overflow; Mask Source width `215px`; Mode and Gradient Type widths `88px`.
- Browser DOM after changing Mode to Clip and enabling Inverted: `kcs-mask-src-alpha-inv`, `mask-type="alpha"`, one evenodd path, no `kcs-clip-src`, and no horizontal overflow.
- Earlier desktop and narrow inspection: normal Inspector approximately `360px`; narrow Inspector approximately `250px`; Effects and Matte density remained readable.
- Existing Effects editing, renderer response, Undo, Redo, Matte source selection, Remove, and Undo restoration were observed in the browser during PASS 5.

# 17. Manual QA Results

- PASS — User-approved PASS 5 Effects visual layout and editing behavior remain preserved.
- PASS — Mask Source remains selectable and flexible/full-width.
- PASS — Clip + Inverted now has observable DOM and pixel behavior instead of a no-op branch.
- PASS — Alpha/Luminance source-world geometry and transformed Text target contracts pass browser coverage.
- PASS — Rounded Rectangle source contour matches authored visible geometry in focused coverage.
- PASS — Broadcast project-resolution center is passed through the existing caller contract.
- PASS — Feather is disabled for Clip and verified through existing Alpha/Luminance blur/pixel coverage.
- PASS — Strength behavior remains covered and unchanged.
- PASS — Gradient semantics and existing Linear/Radial/Stops paths are documented and covered by existing focused/E2E tests.
- PASS — Gradient Angle endpoint displays `360°` while authored state remains normalized.
- PASS — Matte short selects use compact sizing without clipping; Mask Source stays flexible.
- PASS — Existing source selection, Remove, Undo, and Redo behavior remain covered.
- PASS — Timeline, Transitions, Text redesign, Text color, and independent Text selection-border work were not touched.
- NOT TESTED — Final subjective user acceptance of PASS 5.1 density and Matte visual semantics.
- NOT TESTED — PASS 6; explicitly not started.

# 18. Regression Risk Assessment

Overall: LOW to MEDIUM.

- MEDIUM: Clip + Inverted changes an exposed ineffective combination to the intended binary outside-region behavior. Covered by focused DOM and browser pixel tests.
- LOW: Rounded source path change is localized and reuses existing shape geometry.
- LOW: Broadcast prop wiring supplies an existing optional input and does not affect Edit mode.
- LOW: Endpoint state is local/transient and external authored changes clear it.
- LOW: Compact CSS selectors are Matte-local; long source remains full-width.
- LOW: No data model, serialization, history, or dependency changes.
- LOW: Existing Alpha/Luminance, Feather, Strength, Gradient, Text target, and transform paths retain broad regression coverage.

# 19. Performance Considerations

- No new loop, timer, subscription, global listener, or animation engine.
- Clip + Inverted reuses one existing source path and mask structure.
- Rounded radius handling adds only a finite-number check and clamp during existing path construction.
- Endpoint overlay adds minimal component-local state/ref work during the existing slider interaction.
- No new persistent allocation or serialization work was added to the frame loop.
- No benchmark was required or performed.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

- React and TypeScript props remain compatible.
- Existing saved projects load without migration because no field changed.
- Existing Matte serialization remains byte-compatible for normal modes and Clip + Inverted authored data.
- Existing history ownership and Undo/Redo boundaries remain unchanged.
- Existing Edit and Broadcast rendering share the same StagePartLayers authority; Broadcast now gets the active project-resolution input.
- Windows validation succeeded through TypeScript, lint, Vitest, build, browser, and diff checks.

# 22. Known Limitations

- Final user visual acceptance of spacing and Matte semantics remains pending.
- Manual browser inspection used a deterministic representative Rectangle/target scene; every source type and every Matte combination was not manually operated through the UI.
- The full track-matte E2E run was completed before the final test-helper-only Broadcast assertion addition; the production implementation was unchanged by that assertion addition.
- Feather visual strength depends on source size and probe location; the renderer contract is verified by SVG filter and pixel-ramp assertions rather than a universal visual threshold.
- Text selection-border and Text legacy Color remain deferred because they are independent from the proven Matte coordinate contract.
- Timeline horizontal scrolling and Transitions removal remain deferred.
- Existing lint and Vite chunk warnings remain and are non-blocking.
- PASS 6 remains intentionally unstarted.

# 23. Technical Debt

- Historical Inspector CSS remains broad; this pass intentionally added only scoped Matte-local rules.
- Matte stop-row layout remains existing and was not generalized.
- The UI still uses existing legacy controls where they are outside this package's approved scope.
- Future work may add a full browser workflow for renaming a long layer and then selecting it, but this is not required to validate the current width contract.
- Any future Matte mode must explicitly define its source coordinate and SVG unit contract before UI exposure.

# 24. Git Summary

- Branch: `main`.
- HEAD and `origin/main`: `2a005fef1ec996cd7f86d52240c14d9318f48777`.
- Ahead/behind: `0/0`.
- Starting working tree: approved uncommitted PASS 5/5.1 changes present; no unrelated changes observed.
- Final intended changes: existing PASS 5/5.1 source and tests plus new `reports/progress_021.md`.
- Staged changes: none.
- Commit: NO — prohibited.
- Push: NO — prohibited.
- No branch, commit, push, merge, rebase, reset, clean, stash, revert, or discard operation was performed.

# 25. Updated Project Tree

```text
reports/
  progress_020.md                              [existing, preserved]
  progress_021.md                              [new]
e2e/
  track-matte.spec.ts                           [modified]
src/components/Canvas/
  StageCanvas.tsx                               [modified]
  StagePartLayers.tsx                           [modified]
src/components/Inspector/
  PropertyInspector.css                         [modified]
  sections/style/
    StyleEffectsSection.tsx                     [PASS 5 modified]
    StyleMatteSection.tsx                       [modified]
src/tests/
  matte.test.ts                                 [modified]
  matteRender.test.tsx                          [modified]
  styleEffectsSection.test.tsx                  [PASS 5 new]
  styleMatteSection.test.tsx                    [modified]
src/utils/
  matte.ts                                      [modified]
```

No generated build output was intentionally added to the working tree. `.hermes/desktop-attachments/` was not touched.

# 26. Self Review

Good:

- The user-reported failures were investigated in the actual renderer and browser, not treated as CSS-only issues.
- Clip + Inverted received real renderer behavior and stable DOM/pixel assertions.
- Source/target coordinate responsibilities were preserved instead of adding offsets or target-bound substitutions.
- Rounded authored geometry and Broadcast project origin now align with existing renderer contracts.
- Feather was verified as mode-dependent and was not faked or enabled in Clip.
- Gradient behavior was documented before considering redesign.
- Angle endpoint state is local, transient, external-change-aware, and non-serialized.
- Matte density changes are scoped to short controls and preserve long source readability.
- Protected areas and deferred work were not touched.

Could improve in a future approved pass:

- Add a browser rename workflow for long source names.
- Add a dedicated visual comparison for all endpoint positions if the user requests broader interaction evidence.

Remaining uncertainty:

- User preference for the final vertical density and interpretation of Gradient remains a manual-QA decision, not an implementation blocker.

# 27. Next Recommended Task

Perform final user Matte QA against the deterministic Rectangle + Text reproduction. Do not start PASS 6, Text follow-up, Timeline work, or Transitions removal until separately approved.

# 28. Project Status

- PASS 5.1 implementation: COMPLETE.
- Clip/Inverted: CORRECTED.
- Alpha/Luminance geometry: CORRECTED/VERIFIED.
- Feather: VERIFIED; mode-dependent behavior preserved.
- Gradient: VERIFIED and documented; no speculative redesign.
- Angle endpoint: CORRECTED.
- Matte local UI cleanup: COMPLETE.
- Focused QA: PASS.
- Full regression: PASS.
- User manual Matte QA: READY / pending.
- PASS 6: not started.

# 29. AI Development Notes

- Preserve `StagePartLayers` as the Matte SVG composition authority.
- Preserve `src/utils/matte.ts` as the source geometry and normalization authority.
- Preserve `evaluateFrame` as the evaluated transform authority.
- Preserve the PartRenderer outer Matte wrapper and inner target-transform contract.
- Do not create a second persistent angle authority.
- Do not add Feather, Strength, or Gradient semantics to Clip without a separately approved product decision.
- Keep Mask Source flexible and short enum controls compact.
- Treat Text selection border and Text legacy Color as separate deferred work.
- Do not touch Timeline, Transitions, or PASS 6 in this milestone.

## DO NOT CHANGE CASUALLY

- Effects behavior or approved PASS 4 Appearance/Color/Hue behavior.
- Matte source eligibility, IDs, serialization, history ownership, migration, and existing mode semantics.
- Feather, Strength, Gradient, Stops, source animation, and target transform composition.
- Smart inputs, disclosure state, selection, Outliner, Timeline, viewport, playback, and dock behavior.
- Text selection border, Text color, Transitions, or general Inspector polish.
- Git state before explicit approval.

# 30. Lessons Learned

- A visible toggle can be ineffective when the underlying SVG primitive cannot express its semantic operation; renderer coverage is required.
- Source and target transform separation is the safest Matte contract for transformed Text targets.
- Existing optional props should be traced from caller to callee; a caller omission can create mode-specific coordinate errors without an API change.
- Visible shape geometry and Matte geometry must reuse authored radius inputs.
- Feather must be judged through generated filters and edge behavior, not only by slider movement.
- Gradient documentation should describe mask intensity, not imply source movement or geometry deformation.
- Normalized circular values need transient endpoint presentation when the UI must distinguish `360°` from `0°` during active editing.
- Semantic width matters: long layer-name selects need flexible tracks, while enum controls should not consume the same width.
- Focused DOM/pixel tests plus the full renderer suite provide stronger evidence than screenshots alone.
- Scope freezes are enforceable when protected areas and deferred work are recorded explicitly.
