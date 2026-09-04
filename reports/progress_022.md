# KCS Development Report — PASS 5.1 Matte Coverage Recovery

Metadata:
- Date: 2026-09-02
- Milestone: KCS V5.1 — PASS 5.1 Mask / Track Matte shared coverage recovery
- Branch: `main`
- Starting HEAD: `2a005fef1ec996cd7f86d52240c14d9318f48777`
- Ending HEAD: `2a005fef1ec996cd7f86d52240c14d9318f48777`
- Upstream at start: `origin/main` at the same SHA; ahead/behind `0/0`
- Report number: `progress_022.md`
- Git state: Intentional uncommitted PASS 5 and PASS 5.1 working-tree changes; commit and push prohibited

# 1. Executive Summary

This recovery continues the current KCS V5.1 PASS 5.1 Matte work after user retest found a shared rectangular cutoff across Clip + Inverted, Alpha, and Luminance. The actual generated SVG showed that every user-space mask omitted explicit `x`, `y`, `width`, and `height`. SVG then applied its implicit percentage mask region, which could clip target content with a viewport-relative rectangle unrelated to source geometry or target selection bounds.

The fix gives every user-space Matte mask an explicit project/stage coverage region derived from the active output origin and project resolution. The same region is used for nested image-content masks. Source paths remain actual authored/evaluated source geometry, and target transforms remain on the existing inner target group. Clip + Inverted continues to use the existing binary evenodd-hole mask; Alpha and Luminance now share the same explicit coverage contract.

A deterministic Rectangle + `NEW TEXT` browser reproduction now verifies an off-target inverted source leaves both sides of the Text visible, partial Clip inversion preserves both outside regions, and Alpha/Luminance use the explicit project coverage with partial source overlap. Existing Feather, Strength, Gradient, and 360° endpoint behavior remains covered.

Implementation: COMPLETE.
User retest acceptance: NOT TESTED after this recovery; user-reported pre-fix state was FAIL/PARTIAL.
PASS 6: NOT STARTED.

# 2. Original Objectives

## Approved scope

- Continue the current PASS 5.1 Matte correctness recovery.
- Reproduce the user's Text target plus Rectangle source scenario.
- Identify the shared rectangular cutoff across Clip + Inverted, Alpha, and Luminance.
- Inspect actual SVG masks, paths, rectangles, filters, transforms, and coverage attributes.
- Distinguish source geometry from Matte evaluation region.
- Fix the shared coverage contract using active project/stage dimensions rather than arbitrary giant constants.
- Add an exact off-target Clip + Inverted Text regression and partial-overlap assertions.
- Add equivalent Alpha/Luminance coverage assertions where practical.
- Regress Feather, Strength, Gradient, and the 360° endpoint.
- Update the next sequential permanent report.

## Explicit non-goals

- PASS 6.
- General Inspector polish, Effects, Appearance, Transform, Control Points, Stroke, Hue, Trim Path, Boolean, Outliner, selection, Timeline, Transitions, Text redesign, Text Color, or Text selection-border work.
- New Matte modes, new serialized fields, arbitrary offsets, target-bounds substitutes, giant constants, or a parallel SVG/rendering engine.
- Commit, push, branch operations, reset, clean, stash, revert, or discard.

# 3. Problems Discovered

## Shared rectangular cutoff

- Symptom: After Clip + Inverted was made effective, moving the Rectangle source away from `NEW TEXT` still left the Text cut by another rectangle. Alpha and Luminance showed the same pattern.
- Reproduction: Seed a `custom_text` target containing `NEW TEXT`, a `custom_rect` source positioned away from the target, and inspect the real Chromium SVG DOM and pixels.
- Before-fix DOM: `<mask id="kcs-mask-src-alpha-inv" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">` had no explicit mask region attributes. Alpha and Luminance masks had the same omission.
- Root cause: With `maskUnits="userSpaceOnUse"`, omitted mask-region attributes invoke SVG's implicit percentage region. That region is viewport/current-user-space based and can impose an unrelated rectangular coverage boundary. It is not source geometry and is not target selection bounds.
- Affected subsystem: Shared `StagePartLayers` SVG mask coverage.
- Severity: HIGH correctness risk because all mask modes using that path can be visually clipped.
- Status: PASS after explicit coverage attributes and browser pixel/DOM regression.

## Source geometry versus evaluation region

- Source geometry was already generated from actual source shape geometry, source transforms, and output origin.
- The separate evaluation region controls where the SVG mask is allowed to affect/render. It must cover the active project/stage area independently of source contour.
- Status: PASS after making the region explicit on every user-space Matte mask.

## User retest state

- Clip + Inverted OFF: PASS before this recovery.
- Strength: PASS before this recovery.
- Feather: provisionally PASS before this recovery.
- Gradient angle endpoint: PASS before this recovery.
- Clip + Inverted ON: FAIL before this recovery because a shared rectangular cutoff remained.
- Alpha: FAIL before this recovery for the same shared cutoff.
- Luminance: FAIL before this recovery for the same shared cutoff.
- Linear/Radial Gradient: PARTIAL before this recovery because contaminated coverage prevented acceptance.

# 4. Files Created

- `reports/progress_022.md`
  - Purpose: Next sequential permanent report for the shared Matte coverage recovery.
  - Dependencies: Current source, focused tests, Chromium DOM/pixel output, Playwright configuration, and the canonical reporting policy.
  - Important note: `progress_020.md` and `progress_021.md` were preserved; no existing report was overwritten.

No production utility, domain hook, context, serializer, evaluator, clock, or persistent state file was created.

# 5. Files Modified

## Current recovery changes

- `src/components/Canvas/StagePartLayers.tsx`
  - Previous responsibility: Build shared Matte clip/mask definitions and apply target Matte attributes.
  - Change: Add explicit `x`, `y`, `width`, and `height` to every `userSpaceOnUse` image-content and Matte mask, using the existing project/stage `region` derived from output origin and project resolution.
  - Reason: Remove SVG's implicit viewport-relative mask rectangle from the shared coverage contract.
  - Behavioral impact: Mask evaluation covers the intended project/stage region; source geometry and mode semantics remain unchanged.
  - Consumers: `StageCanvas`, `PartRenderer` target wrappers, Alpha/Luminance/Clip + Inverted Matte paths, image mask composition.
  - Regression risk: MEDIUM; all Matte modes and broad Track Matte E2E coverage were rerun.

- `src/tests/matteRender.test.tsx`
  - Previous responsibility: Render-to-string checks for StagePartLayers Matte definitions.
  - Change: Extend the helper to pass app mode, activation, and project resolution; add Broadcast center coverage and explicit Alpha/Luminance mask-region assertions.
  - Reason: Lock the caller-to-region contract and prevent omission of explicit mask coverage.
  - Behavioral impact: Test-only.
  - Consumers: Vitest Matte renderer suite.
  - Regression risk: LOW.

- `e2e/track-matte.spec.ts`
  - Previous responsibility: Chromium DOM and pixel validation for Track Matte modes.
  - Change: Add an off-target Clip + Inverted Text test, partial-overlap Clip + Inverted test, Alpha/Luminance partial-overlap coverage tests, explicit mask-region assertions, and a world-rectangle green-pixel helper.
  - Reason: Reproduce the exact user failure and assert the real SVG/pixel invariant.
  - Behavioral impact: Test-only.
  - Consumers: Chromium Track Matte E2E workflow.
  - Regression risk: LOW; tests use deterministic Rectangle/Text fixtures and existing PNG decoding.

## Retained PASS 5 / PASS 5.1 files in the approved working tree

- `src/components/Canvas/StageCanvas.tsx`
  - Passes the existing active `projectResolution` prop to StagePartLayers for Broadcast origin correctness.

- `src/utils/matte.ts`
  - Reuses authored Rectangle/Box corner radius in Matte source paths.

- `src/components/Inspector/sections/style/StyleMatteSection.tsx`
  - Provides the existing Matte controls, compact short selects, flexible Mask Source, and transient 360° display overlay.

- `src/components/Inspector/PropertyInspector.css`
  - Contains scoped Matte-local density rules and the previously approved Effects layout rules.

- `src/components/Inspector/sections/style/StyleEffectsSection.tsx`
  - Contains the previous PASS 5 Effects presentation-only grouping; no Effects behavior was changed in this recovery.

- `src/tests/matte.test.ts`
  - Contains rounded source geometry coverage.

- `src/tests/styleMatteSection.test.tsx`
  - Contains Matte controls, source layout, and 360° endpoint coverage.

- `src/tests/styleEffectsSection.test.tsx`
  - Contains previous PASS 5 Effects tests.

# 6. Architecture Overview

```text
StageCanvas
  -> StagePartLayers
       -> evaluateFrame
       -> source evaluated transform
       -> buildMattePath / buildMatteClipPath
       -> explicit project/stage mask region
       -> SVG mask or clipPath definition
       -> PartRenderer outer Matte wrapper
            -> inner target transform/content
```

Source geometry and evaluation region are separate authorities. `buildMattePath` describes the source contour. `region` describes the allowed Matte evaluation coverage. `PartRenderer` keeps Matte references on the transformless outer group and target transforms on the inner group. `StageCanvas` supplies active project resolution for Broadcast.

Inspector state continues through `StyleMatteSection` and the existing generic `onPartPropChange` path. No second Matte store or UI-owned renderer was introduced.

# 7. Data Model Changes

None.

- No `CharacterPart` or `PartMatte` field changed.
- No serialized scene, localStorage, preset, clipboard, migration, animation channel, or history snapshot schema changed.
- Explicit SVG `mask` attributes are derived render output only.
- The 360° display overlay remains transient local UI state; authored angle normalization remains unchanged.
- Existing source selection, Remove, Undo, Redo, Strength, Feather, and Gradient authored data remain unchanged.

# 8. Coordinate Space Model

## Object-local and source geometry

Static Rectangle/Box geometry is read from the shared `getShapeGeometry` contract. Authored corner radius is applied where the visible renderer applies it. Freeform points use the existing freeform source. Selection bounds and transform handles are not inputs to Matte path generation.

## World/stage space

`evaluateFrame` resolves source and target transforms. `buildMattePath` applies the source transform and output origin to source-local geometry. The resulting path is stored as user-space SVG geometry.

## Matte evaluation region

The explicit region is:

```ts
{
  x: outputOrigin.x - projectWidth / 2,
  y: outputOrigin.y - projectHeight / 2,
  width: projectWidth,
  height: projectHeight,
}
```

The dimensions come from the active project resolution, with the existing `1920x1080` fallback when no prop is supplied. This is a project/stage contract, not target bounds, source bounds, selection bounds, or a hard-coded oversized rectangle.

## Target and viewport space

The Matte reference remains on the target's transformless outer group. The target's transform remains on the inner rendered group. SVG viewport/screen transforms are used only by browser pixel probes. The editor artboard and any Broadcast artboard clip remain separate from Matte source geometry.

## Invariants

Moving or scaling the source changes the source path. Moving or scaling the target changes only the target inner transform. Changing selection overlays cannot alter either. The evaluation region remains stable for a given output origin/project resolution.

# 9. Component / Module Walkthrough

## `StagePartLayers.tsx`

Builds evaluated Matte definitions once per render, deduplicates source paths, and resolves target attributes. For all user-space masks, it now emits explicit project/stage coverage attributes. Inverted shape masks still contain the project region plus source contour as an evenodd path. Feather filters retain their existing inflated filter region.

## `StageCanvas.tsx`

Owns the active project resolution and passes it to StagePartLayers. No new state or rendering path was added.

## `src/utils/matte.ts`

Converts source geometry to world path data and retains mode, gradient, Feather, Strength, and angle normalization. It does not own mask evaluation coverage; that region belongs to StagePartLayers output context.

## `PartRenderer.tsx`

Remains the target rendering authority. The outer target group carries `mask`/`clip-path`; the inner target group carries evaluated transform, opacity, and content. No Text-specific offset was added.

## `track-matte.spec.ts`

Uses deterministic localStorage scene seeding, real Chromium SVG DOM assertions, PNG decoding, SVG CTM conversion, and world-space pixel probes. New tests exercise off-target and partial-overlap Text targets plus Alpha/Luminance region attributes.

# 10. Important Code Changes

Before, a Matte mask was emitted without a region:

```tsx
<mask
  id={mask.id}
  maskUnits="userSpaceOnUse"
  maskContentUnits="userSpaceOnUse"
  mask-type={mask.mode}
>
```

After, the same existing mask receives explicit project coverage:

```tsx
<mask
  id={mask.id}
  x={region.x}
  y={region.y}
  width={region.width}
  height={region.height}
  maskUnits="userSpaceOnUse"
  maskContentUnits="userSpaceOnUse"
  mask-type={mask.mode}
>
```

The same attributes are applied to nested image-content masks. The region is derived from `outputOrigin` and `projectResolution`; no target or selection bounds are consulted.

Real browser before/after evidence:

```text
Before: <mask id="kcs-mask-src-alpha-inv" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
After:  <mask id="kcs-mask-src-alpha-inv" x="-660" y="-300"
        width="1920" height="1080" maskUnits="userSpaceOnUse"
        maskContentUnits="userSpaceOnUse">
```

After-fix off-target inverted path:

```text
M -660 -300 H 1260 V 780 H -660 Z
M -160 210 L -40 210 L -40 270 L -160 270 Z
```

The first contour is the evaluation region; the second is the off-target Rectangle source hole. The Text target remains visible in the browser.

# 11. Public Interfaces

No public interface changed.

- `StagePartLayers` props are unchanged; `projectResolution` was already optional and is now supplied by its existing caller.
- `StyleMatteSection` props are unchanged.
- Matte utility exports and types are unchanged.
- No new exported component, hook, function, type, or enum was introduced.

# 12. Algorithms and Geometry

## Shared mask coverage

For each render:

1. Resolve the output origin from Edit or active Broadcast project resolution.
2. Derive the full project/stage region from that origin and resolution.
3. Build source geometry from actual source shape/points and evaluated source transform.
4. Emit source path or content into a user-space mask.
5. Explicitly bound the mask itself to the same project/stage region.
6. Apply the mask to the transformless target wrapper.

The region is O(1) to derive per StagePartLayers render. Source path generation and existing mask deduplication remain unchanged.

## Clip + Inverted

Normal Clip remains a clipPath. Clip + Inverted uses the existing Alpha evenodd-hole structure: a project region contour and source contour in one path. The explicit mask region prevents SVG's implicit mask region from cutting the outside target area.

## Alpha/Luminance

Alpha uses white source mask content. Luminance uses source fill/luminance content. Both now receive the same explicit mask coverage, so their result differs only by existing mask content semantics, not by an implicit rectangular boundary.

## Edge cases

Missing source or unusable geometry still produces no Matte definition. Clip remains binary. Feather filter bounds remain derived from the project region and Feather value. Negative-scale edge cases remain existing scope.

# 13. Interaction / UX Behavior

## Before

With a Text target wider than a Rectangle source, moving the source away could leave an unexplained rectangular cutoff. Alpha/Luminance showed the same pattern. The user could not distinguish source geometry from SVG mask coverage.

## After

The SVG mask region covers the active project/stage area explicitly. Clip + Inverted shows the target outside the source contour, including when the source does not overlap. Alpha/Luminance still reveal only source mask content, but no unrelated mask-region rectangle cuts the target.

## Expected workflow

1. Create `NEW TEXT` as a large Text target.
2. Create a Rectangle source and place it over part of the Text.
3. Select the Rectangle as Mask Source.
4. Test Clip normal, Clip inverted, Alpha, and Luminance.
5. Move and resize the source; inspect actual target response.
6. Change Feather, Strength, Gradient Type, Angle, and Stops only in supported modes.
7. Use existing Remove, Undo, and Redo.

No Inspector redesign, Text color change, or selection-border change is part of this recovery.

# 14. Design Decisions

## Explicit project/stage mask region

- Decision: Set mask `x/y/width/height` from the active output origin and project resolution.
- Reason: Removes implicit SVG coverage while preserving source geometry and target transforms.
- Alternatives rejected: Arbitrary giant constants, target bounds, source bounds, selection bounds, CSS overflow changes, and per-mode offsets.
- Trade-off: Masks carry four additional derived SVG attributes; this makes the coordinate contract explicit.
- Future implication: Any new user-space Matte content must use the same region authority.

## Apply region to all user-space masks

- Decision: Apply coverage to normal Alpha/Luminance, inverted masks, and nested image-content masks.
- Reason: The user observed a shared pattern; patching only Clip + Inverted would leave the same implicit boundary in other modes.
- Alternatives rejected: Mode-specific fixes or assumptions that only inverted masks need coverage.
- Trade-off: Slightly more markup, one shared rule.
- Future implication: Keep source geometry and evaluation region separate in tests and reports.

## Keep existing Clip + Inverted representation

- Decision: Continue reusing Alpha evenodd-hole mask output.
- Reason: Already-established binary semantics and no new serialized mode.
- Alternatives rejected: New clip primitive, inverted path offsets, or UI-only toggle changes.
- Trade-off: Clip + Inverted uses a mask while normal Clip uses clipPath.
- Future implication: Keep Clip controls binary and Feather/Strength/Gradient disabled.

# 15. Invariants That Must Be Preserved

- Source Matte geometry comes from actual authored/evaluated source geometry and source transform.
- Matte evaluation region comes from output origin and project resolution, never selection or target bounds.
- Target transforms remain on the target inner group; Matte references remain on the outer group.
- Normal Clip remains binary clipPath behavior.
- Clip + Inverted is target geometry minus source geometry within the project region.
- Alpha/Luminance use explicit project coverage and retain their existing content semantics.
- Feather is unavailable in Clip and remains active for supported Alpha/Luminance modes.
- Strength 100/50/0 semantics remain unchanged.
- Gradient Type, Angle, Stops, and source mapping remain existing behavior.
- 360° display remains transient; authored angle remains normalized.
- Selection bounds, handles, and editor overlays have no effect on Matte geometry.
- No data-model, serialization, migration, history, or public API changes.
- No Timeline, Transitions, Text redesign, Text Color, or unrelated Inspector changes.

# 16. Testing and Verification

## Focused Vitest

- `node ./node_modules/vitest/vitest.mjs run src/tests/matte.test.ts src/tests/matteRender.test.tsx src/tests/styleMatteSection.test.tsx` — PASS, 3 files / 368 tests.
- Coverage includes normal/inverted Clip DOM, explicit Alpha/Luminance mask regions, Broadcast project center, rounded source geometry, Matte controls, source selection, Remove, gradient behavior, and 360° endpoint display/normalization.

## Playwright / E2E

- `npx playwright test e2e/track-matte.spec.ts --grep "V-A2|V-A3|V-A4|V-B2|V-B3|V-G13" --retries=0` — PASS, 6 tests in 8.6 seconds.
- `npx playwright test e2e/track-matte.spec.ts --retries=0` — PASS, 82 tests in 5.2 minutes after the shared coverage fix.
- Existing relevant regression `e2e/stroke-alignment-v2.spec.ts e2e/trim-path-v2.spec.ts e2e/shape-appearance-bounds.spec.ts --retries=0` — PASS, 9 tests in the current PASS 5 validation record.

## Full regression

- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS with the existing `react(only-export-components)` warning at `src/context/AnimatorContext.tsx:630`.
- `npm test` — PASS, 89 files / 1,365 tests.
- `npm run build` — PASS; current JavaScript bundle `532.54 kB`, with the existing Vite large-chunk warning.
- `git diff --check` — PASS.
- Vitest emitted three existing `Not implemented: navigation to another Document` notices; no test failed.

## Manual browser verification

- Chromium deterministic scene: Rectangle source at `x=-400`, Text target `NEW TEXT`, Clip + Inverted.
- After the fix, DOM contained `x="-660"`, `y="-300"`, `width="1920"`, `height="1080"`, `maskUnits="userSpaceOnUse"`, and `maskContentUnits="userSpaceOnUse"`.
- After the fix, the source-away target Text was visually fully visible in the browser screenshot; no unrelated Matte rectangle cut it.
- After the fix, Clip + Inverted DOM contained the alpha mask with an evenodd path and no normal source clipPath.
- Narrow prior PASS 5.1 inspection remains valid: document width matched viewport and Matte short controls stayed compact without horizontal overflow.

## Git validation

- Final scope audit command: `git status --short && git diff --check && git diff --stat && git ls-files --others --exclude-standard` — PASS; only known PASS 5/5.1 files, reports, and tests were listed.

# 17. Manual QA Results

- FAIL — User retest before this recovery still showed the shared rectangular cutoff in Clip + Inverted, Alpha, and Luminance.
- PARTIAL — User retest confirmed Linear/Radial output changes but could not accept Gradient while coverage was contaminated.
- PASS — Engineering Chromium reproduction now shows an explicit project/stage mask region and a fully visible off-target inverted Text target.
- PASS — Engineering Chromium partial-overlap Clip + Inverted test shows both outside regions remain visible.
- PASS — Engineering Chromium Alpha/Luminance partial-overlap tests use the same explicit project coverage and preserve source-position behavior.
- PASS — Existing Feather soft-transition regression remains green for supported modes; Clip remains disabled for Feather.
- PASS — Existing Strength regression remains green.
- PASS — Existing Gradient mode/type/angle/stops regressions and 360° endpoint regression remain green.
- PASS — Selection overlays are not used by source path or coverage-region generation.
- NOT TESTED — Final user Matte retest and acceptance after this coverage fix.
- NOT TESTED — PASS 6 and all deferred Text/Timeline/Transitions work.

# 18. Regression Risk Assessment

Overall: MEDIUM before browser verification, LOW to MEDIUM after the full 82-test Track Matte suite.

- MEDIUM: Explicit mask-region attributes affect all user-space masks; full Track Matte E2E passed, including Text, image, inverted, Feather, Strength, Gradient, and animation scenarios.
- LOW: Region derives from existing output origin/project resolution and does not alter source path math.
- LOW: Normal Clip remains unchanged.
- LOW: Inspector and Effects behavior were not changed in this recovery.
- LOW: No authored or serialized state changed.
- LOW: Existing warnings are non-blocking and pre-existing.

# 19. Performance Considerations

- Explicit region values are computed once per StagePartLayers render.
- No new timer, listener, render loop, subscription, or persistent state.
- No additional source geometry pass was introduced.
- Existing path and mask deduplication remain in place.
- The new pixel helper exists only in tests and does not affect production runtime.
- No benchmark was required or performed.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

- React and TypeScript public props remain compatible.
- Saved projects remain compatible because SVG coverage attributes are derived output only.
- Existing Matte serialized values, source IDs, modes, history, and Undo/Redo remain compatible.
- Chromium verification passed for the real browser SVG contract.
- Edit mode uses the existing fallback project region; Broadcast uses the active project resolution supplied by StageCanvas.
- Windows validation passed through TypeScript, lint, Vitest, build, Playwright, and diff checks.

# 22. Known Limitations

- Final user Matte retest is pending; engineering PASS is not user acceptance.
- Manual browser inspection used the deterministic Rectangle + Text fixture; every object/source type was not manually operated.
- The editor SVG viewport itself can still impose its normal visual canvas boundary; this is distinct from Matte mask coverage and is not changed here.
- Feather visual intensity depends on source size and probe placement, although filter and pixel regressions pass.
- Text selection border and Text legacy Color remain deferred independent work.
- Timeline horizontal scrolling and Transitions removal remain deferred.
- PASS 6 remains intentionally unstarted.

# 23. Technical Debt

- Matte rendering contains multiple content branches for shapes, freeform, text, and images; this recovery preserves them and does not consolidate them broadly.
- Future Matte content must explicitly specify its evaluation region and SVG units.
- A future browser workflow could expose user-created long names and source movement through the UI rather than seeded scenes.
- Existing historical Inspector CSS remains outside this recovery scope.

# 24. Git Summary

- Branch: `main`.
- Starting and ending HEAD: `2a005fef1ec996cd7f86d52240c14d9318f48777`.
- `origin/main`: same SHA.
- Ahead/behind: `0/0`.
- Starting working tree: known approved uncommitted PASS 5/5.1 changes; no unexpected files observed.
- Final working tree: same known source/test changes plus untracked `reports/progress_022.md`.
- Staged changes: none.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.
- No branch, commit, push, merge, rebase, reset, clean, stash, revert, or discard operation was performed.

# 25. Updated Project Tree

```text
reports/
  progress_020.md                              [existing, preserved]
  progress_021.md                              [existing, preserved]
  progress_022.md                              [new]
e2e/
  track-matte.spec.ts                           [modified]
src/components/Canvas/
  StageCanvas.tsx                               [modified, prior PASS 5.1]
  StagePartLayers.tsx                           [modified]
src/components/Inspector/
  PropertyInspector.css                         [modified, prior PASS 5]
  sections/style/
    StyleEffectsSection.tsx                     [modified, prior PASS 5]
    StyleMatteSection.tsx                       [modified, prior PASS 5.1]
src/tests/
  matte.test.ts                                 [modified, prior PASS 5.1]
  matteRender.test.tsx                          [modified]
  styleEffectsSection.test.tsx                  [new, prior PASS 5]
  styleMatteSection.test.tsx                    [modified, prior PASS 5.1]
src/utils/
  matte.ts                                      [modified, prior PASS 5.1]
```

No generated build output was intentionally added. `.hermes/desktop-attachments/` was not touched.

# 26. Self Review

Good:

- The failure was reproduced against real SVG DOM and browser pixels instead of patched by mode-specific offsets.
- Source geometry and evaluation coverage are now documented and implemented as separate concepts.
- The exact implicit mask-region omission was fixed once at the shared StagePartLayers mask boundary.
- Clip + Inverted, Alpha, and Luminance coverage now share explicit project/stage attributes.
- The Text target regression verifies the user-reported object type.
- Full Track Matte coverage passed after the production change.
- No protected unrelated surface was changed.

Could improve in a future approved pass:

- Add browser UI movement/resize actions rather than relying only on deterministic seeded scenes for all geometry cases.
- Add a direct screenshot comparison for the selection overlay versus rendered Matte output if the user requests it.

Uncertainty:

- Final user perception of the repaired result remains pending because engineering verification cannot replace the user's Matte retest.

Score: 9/10. The shared cause is fixed and covered broadly; user acceptance is intentionally the remaining gate.

# 27. Next Recommended Task

Perform the final user Matte retest using the Rectangle + `NEW TEXT` off-target and partial-overlap scenarios; do not begin PASS 6 or deferred Text/Timeline/Transitions work.

# 28. Project Status

- Current milestone: KCS V5.1 PASS 5.1 shared Matte coverage recovery complete.
- Shared rectangular cutoff: corrected and engineering-verified.
- Clip Inverted: corrected and engineering-verified.
- Alpha/Luminance geometry: explicit coverage corrected and engineering-verified.
- Feather: regression-verified for supported modes.
- Strength: regression-verified.
- Gradient: regression-verified after coverage fix; user acceptance pending.
- 360° endpoint: regression-verified.
- Full regression: PASS.
- User QA: READY FOR USER MATTE RETEST; not accepted yet.
- PASS 6: not started.

# 29. AI Development Notes

- `StagePartLayers` owns SVG Matte definition and coverage output.
- `src/utils/matte.ts` owns source geometry and normalization, not target bounds or selection bounds.
- `evaluateFrame` owns evaluated source/target transforms.
- `PartRenderer` owns target content and preserves outer Matte/inner transform separation.
- Every `userSpaceOnUse` mask must explicitly define its coverage region.
- The coverage region must derive from output origin and active project resolution.
- Never use target bounds, selection bounds, stale bounds, or arbitrary offsets as source Matte geometry.
- Keep Clip binary and keep Feather/Strength/Gradient unavailable in Clip unless separately approved.
- Keep 360° presentation transient and authored angle normalized.
- Text selection border, Text Color, Timeline, Transitions, and PASS 6 remain deferred.

## DO NOT CHANGE CASUALLY

- Source path geometry and transform composition.
- Mask `maskUnits`, `maskContentUnits`, coverage region, and SVG wrapper hierarchy.
- Alpha/Luminance content semantics, Feather, Strength, Gradient, Stops, and animation paths.
- Clip + Inverted evenodd-hole semantics.
- `StageCanvas` project-resolution ownership.
- Matte source eligibility, source IDs, serialization, history, Undo/Redo, and migration.
- Effects, Appearance, Hue, Stroke, Trim Path, Boolean, Outliner, selection, Timeline, Transitions, and Text redesign.
- Git state before explicit approval.

# 30. Lessons Learned

- SVG mask content and SVG mask coverage region are separate contracts; validating only the path is insufficient.
- An omitted `x/y/width/height` on a `userSpaceOnUse` mask can create a hidden viewport-relative rectangle that resembles a geometry bug.
- A shared rectangular symptom across modes should trigger inspection of shared SVG wrappers and units before mode-specific patches.
- Text targets are valuable regressions because their large glyph bounds make coverage errors obvious.
- Off-target inverted tests are essential: they prove the result is target minus source rather than target intersected with an accidental rectangle.
- Explicit project-derived coverage is safer than arbitrary oversized constants.
- Selection overlays must remain independent from render geometry.
- Full browser DOM plus pixel tests catch SVG behavior that render-to-string tests alone cannot.
- Passing engineering tests does not equal user QA acceptance; this report keeps the final retest as the explicit gate.
