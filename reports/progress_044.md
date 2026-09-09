# KCS Development Report — V3.4.1 Sidebar Handle Final Visual Correction

## Executive Summary

V3.4.1 resolved the authoritative visual QA mismatch between the left and right sidebar hide/show handles. The left large-square appearance came from legacy per-component geometry and hover/focus rules, not from a pseudo-element or wrapper. Those obsolete rules were removed. Both controls now use the shared `.sidebar-handle` visual authority, the same 14px Lucide Chevron family, mirrored direction, and the same narrow 26x48 edge-tab footprint.

The final branch is `feat/v6-ui-v34-control-cleanup`. Full regression is green with the added parity coverage: **253/253 Playwright**, **100 Vitest files / 1423 tests**, V6 QA 3/3, TypeScript, lint, build, and diff check passed.

## User Visual QA Finding

The V3.4 screenshots showed a left control that read as a large square/box while the right control read as a narrow panel-edge tab. Source-level equality was not accepted as proof. The correction was validated in a real Chromium surface across rest, hover, focus-visible, expanded, collapsed, shown, and hidden states.

## Computed-Style Root Cause

The exact left-side root cause was in `src/components/Toolbar/LeftToolbar.css`:

- Legacy `.left-toolbar-toggle` set `width: 44px`, `height: 34px`, bottom margins, rounded corners, transparent background, and a transparent border.
- Legacy `.left-toolbar-toggle:hover` added a panel-hover background and border color.
- Legacy `.left-toolbar-container.collapsed .left-toolbar-toggle` retained `width: 44px`.
- A later grouped `.left-toolbar-toggle:hover, .left-toolbar-toggle:focus-visible` rule still painted `outline: 2px solid var(--kcs-focus)` on ordinary mouse hover.

The right side carried the equivalent obsolete 24x24/base border/radius and hover/focus outline rules in `src/components/Inspector/PropertyInspector.css`. No `::before` or `::after` pseudo-element contributed to either control. No second visual wrapper was found.

The live final computed rest state at 1920x1080 is:

| Property | Left | Right |
|---|---:|---:|
| Width | 26px | 26px |
| Height | 48px | 48px |
| Min width/height | 0px / 0px | 0px / 0px |
| Padding | 0px | 0px |
| Margin | 0px | 0px |
| Border | 0px | 0px |
| Radius | 0px | 0px |
| Box shadow | none | none |
| Pseudo-elements | none | none |
| Position | absolute | absolute |
| Title | null | null |
| Icon | 14px Lucide Chevron | 14px Lucide Chevron |

The final live hover state keeps the same 26x48 element box and has `outline-style: none`. The final focus-visible state keeps the same element box and has a 2px solid outline with `outline-offset: -2px`, keeping the accessibility indication inside/tight to the tab.

## Shared Handle Visual Contract

`src/kcsEditorTheme.css` is the single visual authority:

- `display: inline-flex`
- centered icon alignment
- width 26px and height 48px
- zero padding, border, and radius
- shared elevated background and muted color
- shared hover background/color
- shared 160ms easing
- focus-visible 2px inward outline with `-2px` offset

Per-side CSS now retains only structural/positional behavior:

- Left: absolute rail-edge hinge at `right: -13px`, `top: 50%`, `translateY(-50%)`, z-index 3.
- Right: absolute Inspector dock handle, z-index 100, existing shown/hidden right positioning, and the existing 300ms dock-follow transition.

No layout shift, stage-origin change, rail change, or Inspector width change was introduced.

## Mirrored Icon Language

`src/components/Toolbar/LeftToolbar.tsx` and `src/App.tsx` now both use the Lucide Chevron family at 14px with stroke width 2 and round caps/joins:

- Left shown: `ChevronLeft`; left collapsed: `ChevronRight`.
- Inspector shown: `ChevronRight`; Inspector hidden: `ChevronLeft`.

The direction is mirrored according to the panel edge and current visibility state. The previous `PanelRightClose`/`PanelRightOpen` glyph family was removed so the controls share the same optical language.

## Focused Browser Assertions

`e2e/left-toolbar-collapse.spec.ts` now verifies in a real browser:

- Left/right visible width difference <= 2px.
- Left/right visible height difference <= 2px.
- Narrow width range 24–28px and height range 44–50px.
- Equal border and radius family.
- Equal icon bounding boxes.
- Absolute positioning and side-specific z-index values.
- No pseudo-element content.
- Native `title` absent and `aria-label` present.
- Hover preserves width/height, has no outline, and has no box shadow.
- Focus-visible preserves width/height and uses a 2px solid inward outline.
- Left collapsed and right hidden states preserve the same dimensions.
- Existing toggle and stage-origin behavior remains covered.

The focused spec passes **2/2**.

## Tooltip and Accessibility Verification

Neither handle has a native `title` attribute or custom tooltip node. Accessible names remain state-aware through `aria-label`:

- `Hide Left Toolbar` / `Show Left Toolbar`
- `Hide Inspector` / `Show Inspector`

Browser inspection and the focused test confirm no target tooltip popup and no pseudo-element popup source.

## Browser Evidence

Latest-bundle screenshots were recaptured after the final Chevron change under `docs/design/after/v341/`:

- `left-rest.png`
- `left-hover.png`
- `left-focus.png`
- `right-rest.png`
- `right-hover.png`
- `right-focus.png`
- `both-handles.png`
- `left-collapsed.png`
- `right-hidden.png`

Browser QA used 1920x1080, 1440x900, and 1366x768. No page overflow was observed. The fixed 56px rail, stage origin, Inspector dock behavior, and handle reachability remained intact.

## Designer Review

Pre-implementation `designer-agent` review identified the legacy left 44x34/transparent geometry and recommended removing per-component visual overrides while retaining only edge positioning.

Final `designer-agent` review initially identified the old right PanelRight glyph as a visual-family mismatch. The icon family was corrected to mirrored Chevrons and the final screenshots were recaptured. Final visual contract: PASS for rest parity, hover parity, focus parity, mirrored icon treatment, panel-edge attachment, no nested rectangle, and professional editor feel.

## Reviewer Findings

Final `reviewer-agent` found and verified fixes for:

1. Removed Inspector structural positioning accidentally during legacy cleanup; restored `position: absolute` and `z-index: 100` while keeping the visual authority shared.
2. Added explicit position/z-index assertions to prevent the E2E parity test from masking edge-position regressions.
3. Corrected the focused test’s computed-style fields and removed an unreadable compound z-index assertion.
4. Re-captured screenshots after the final icon-family correction.

Final reviewer status: **PASS**. Remaining observations are non-blocking test-design follow-ups: the right handle’s overlap requires forced pointer interaction in the browser test, and a future test could assert exact Inspector edge endpoint geometry without `force`. No V3.4.1 blocker remains.

## Full Regression

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with the existing Fast Refresh warning at `src/context/AnimatorContext.tsx:655`.
- `npm test`: 100 files, 1423 tests passed.
- `npm run build`: passed; existing chunk-size warning only.
- `git diff --check`: passed.
- `npm run qa:v6`: 3/3 passed.
- `CI=true npm run test:e2e`: 253/253 passed, 0 failed, 0 flaky, 0 skipped.

The full Playwright total increased from 252 to 253 because V3.4.1 added one real-browser parity test.

## Functional Freeze Confirmation

No changes were made to Reset View behavior, Canvas toolbar WAAPI animation, the 79px header, the 56px rail contract, stage origin, Inspector width, selection, timeline, masks, Track Matte, Track.channels, graph semantics, pointer capture, history, serialization, import/export, OGraf, or playback.

## Files Changed

- `src/kcsEditorTheme.css`
- `src/components/Toolbar/LeftToolbar.css`
- `src/components/Inspector/PropertyInspector.css`
- `src/App.tsx`
- `e2e/left-toolbar-collapse.spec.ts`
- `docs/design/after/v341/*.png`
- `reports/progress_044.md`

## Git Summary

- Branch: `feat/v6-ui-v34-control-cleanup`
- Base: `integration/v6-ui-stable@0289402`
- `main` remains untouched at `8024d4f`.
- Existing V3.4 commits remain published; V3.4.1 correction is prepared as the next commit after final green validation.

## SUBAGENT ORCHESTRATION

Parent orchestrator: Luna orchestrator.

Parallel read-only tasks before coding:

- `LeftHandleComputedRecon` -> `scout`: identified legacy 44x34/44px rules and the hover outline as the exact left visual root cause; confirmed no pseudo-element.
- `RightHandleComputedRecon` -> `scout`: compared effective right/left computed styles, hidden-state clipping, legacy hover outline, and dock positioning.
- `DesignerPreV341` -> `designer-agent`: recommended deleting per-side visual geometry and keeping only edge positioning.

Final read-only reviews:

- `DesignerFinalV341` -> `designer-agent`: identified the PanelRight versus Chevron optical mismatch; after correction the final visual contract is PASS.
- `ReviewerFinalV341` -> `reviewer-agent`: found the temporary Inspector structural-positioning regression and required stronger parity assertions; final review PASS after fixes.

All source edits and Git operations remained with the parent orchestrator. No subagent edited overlapping files.

## DO NOT CHANGE CASUALLY

Do not modify `main`, weaken the 56px rail or stage-origin contract, reintroduce per-side handle visual authorities, reintroduce native target tooltips, replace the shared Chevron language with unrelated glyph families, or remove the inward focus indication.

## Lessons Learned

- Computed-style equality must be checked in every interaction state; source-level CSS similarity is insufficient.
- Legacy specificity and grouped hover/focus selectors can preserve visual defects after a new shared class is added.
- Shared visual tokens should own only visual behavior; edge positioning and z-index must remain explicit structural rules.
- Icon family parity is part of visual component parity, not a cosmetic afterthought.
- Screenshot evidence must be recaptured after every final visual or glyph change.
