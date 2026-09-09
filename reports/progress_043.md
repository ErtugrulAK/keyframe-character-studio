# KCS Development Report — V3.4 Control Cleanup Checkpoint

## Executive Summary

V3.4 editor control cleanup is complete on `feat/v6-ui-v34-control-cleanup`, branched from `integration/v6-ui-stable@0289402`. Reset View now restores the canonical default viewport, the sidebar handles share one visual authority, native target tooltips were removed in favor of accessible names, and Canvas toolbar active-state behavior remains animation-driven. The final focused checks and full regression gates are green.

Checkpoint commits are recorded after validation.

## Scope and User Feedback

Implemented the approved V3.4 scope:

- Reset View restores zoom `1` and pan `{ x: 0, y: 0 }` and is idempotent.
- Left and right sidebar handles use mirrored 26x48 square geometry.
- The collapsed left-toolbar specificity path no longer expands the handle to 44px.
- The Inspector handle retains its 300ms right dock-follow transition.
- Target editor controls no longer expose browser-native `title` popups.
- Accessible names remain explicit through `aria-label`.
- Canvas toolbar active feedback stays on the existing WAAPI highlight path.
- Viewport toolbar pointer-down events no longer bubble into the active canvas gesture path.
- Legacy E2E selectors were migrated to the new accessible names.

## Root Cause and Reset Contract

The former Reset View action updated only the pan state. Zoom therefore remained at the user’s current level. The fix updates both state authorities in one click handler:

- `setZoomLevel(1)`
- `setPanOffset({ x: 0, y: 0 })`

The focused component test clicks Reset twice and verifies both setters on both invocations. The real-browser V5.1 manual QA path zooms and pans first, then verifies `100%` and the identity SVG matrix after reset and again after a second reset.

The existing stage-origin contract remains unchanged: the fixed 56px rail and stage origin do not drift when the contextual left drawer collapses or reopens.

## Sidebar Handle Cleanup

A shared `.sidebar-handle` rule in `src/kcsEditorTheme.css` is the common visual authority for width, height, radius, padding, color, hover, and focus-visible treatment. Both handles are 26x48 with zero radius and no hover square.

The left handle keeps its absolute rail-edge position and mirrored chevron behavior. A final high-specificity collapsed selector restores 26px width after the legacy collapsed rule. The right Inspector handle keeps its existing dock-follow movement through a higher-specificity transition rule; reduced-motion `transition: none !important` remains authoritative.

`e2e/left-toolbar-collapse.spec.ts` now measures expanded and collapsed geometry in the real browser, including both handle widths and the Inspector transition property.

## Tooltip and Accessibility Cleanup

Native `title` attributes were removed from the target LeftToolbar navigation, Inspector toggle, and Canvas viewport toolbar controls. Their accessible names are explicit and state-aware where required:

- `Hide Left Toolbar` / `Show Left Toolbar`
- `Hide Inspector` / `Show Inspector`
- `Select Tool`, `Hand / Pan Tool`, `Show/Hide Grid`, `Zoom In (+)`, `Zoom Out (+)`, `Reset View Position`
- Descriptive left navigation names for Project Workspace, Media Assets, Vector Shapes & Graphic Elements, and Typography & Headlines

Focused tests assert the accessible names and the absence of the removed native titles. Full E2E selector migration keeps the consumer-facing behavior stable.

## Canvas Toolbar Preservation

The active viewport tool continues to use the existing `.viewport-tools-highlight` WAAPI animation and reduced-motion branches. Passive buttons are transparent and do not add a competing active background. The toolbar divider now uses a named CSS class instead of inline styling. Root `mousedown` propagation is stopped so toolbar interaction cannot start a StageCanvas pan/freeform gesture.

## Model Routing Smoke Test

The routing smoke report is preserved at `docs/research/KCS_MODEL_ROUTING_SMOKE_TEST.md`. Eight requested routes were dispatched in parallel. The report records resolved model metadata when exposed and `NOT EXPOSED` otherwise; no Muse or Spark route was invented when the environment did not expose one.

| Route | Agent | Result |
|---|---|---|
| TINY | `sonic` | project name returned; model/task metadata NOT EXPOSED |
| SMOL | `scout` | exact Toolbar file count returned; model/task metadata NOT EXPOSED |
| TASK | `task` | viewport overlay selector returned; model/task metadata NOT EXPOSED |
| COMMIT | `commit-agent` | branch/checkpoint guidance returned; model/task metadata NOT EXPOSED |
| planner-agent | `planner-agent` | resolved `openai-codex/gpt-5.6-terra` |
| designer-agent | `designer-agent` | pre-review NEEDS POLISH; final review PASS; metadata NOT EXPOSED |
| slow-agent | `slow-agent` | invariant PASS; resolved `openai-codex/gpt-5.6-sol` |
| reviewer-agent | `reviewer-agent` | final review PASS after two source blockers were fixed |

## Files Changed

Production:

- `src/components/Canvas/overlays/CanvasViewportToolbar.tsx`
- `src/components/Canvas/StageCanvas.css`
- `src/components/Toolbar/LeftToolbar.tsx`
- `src/components/Toolbar/LeftToolbar.css`
- `src/components/Inspector/PropertyInspector.css`
- `src/kcsEditorTheme.css`
- `src/App.tsx`

Tests and E2E:

- `src/tests/viewportToolbar.test.tsx`
- `src/tests/CanvasViewportToolbar.test.tsx`
- `src/tests/leftToolbar.test.tsx`
- `e2e/v51-manual-qa.spec.ts`
- `e2e/left-toolbar-collapse.spec.ts`
- Accessible-name selector migrations in the affected Canvas, workflow, broadcast, interaction, layer, sequence, and verification specs.

Evidence and research:

- `docs/design/after/v34/reset-before.png`
- `docs/design/after/v34/reset-after.png`
- `docs/design/after/v34/both-sidebars.png`
- `docs/design/after/v34/left-handle-closeup.png`
- `docs/design/after/v34/right-handle-closeup.png`
- `docs/design/after/v34/canvas-toolbar-closeup.png`
- `docs/research/KCS_MODEL_ROUTING_SMOKE_TEST.md`

Permanent E2E tests do not write screenshots into `docs/`; the evidence files are static artifacts captured during browser QA.

## Focused Validation

- Focused Vitest: 4 files, 10 tests passed.
- Focused Playwright: 7 tests passed across reset, sidebar collapse, and editor interaction regressions.
- Targeted handle/reset Playwright: 5 tests passed.
- Designer pre-review: NEEDS POLISH, addressed by the final handle geometry, tooltip, and active-state cleanup.
- Designer final review: PASS.
- Final reviewer: PASS; no critical, high, medium, or low blockers remained. The reviewer noted only future design debt around centralizing viewport default constants and adding direct focused tests for preserved WAAPI/reduced-motion branches.

## Full Regression

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with the existing Fast Refresh warning at `src/context/AnimatorContext.tsx:655`.
- `npm test`: 100 files, 1423 tests passed.
- `npm run build`: passed; existing chunk-size warning only.
- `git diff --check`: passed.
- `npm run qa:v6`: 3/3 passed.
- `npm run test:e2e`: 252/252 passed in the final run.

## Browser QA

Real Chromium inspection covered 1920x1080, 1440x900, and 1366x768. Computed checks confirmed:

- Left handle: 26x48, radius 0.
- Right handle: 26x48, radius 0.
- Fixed left rail: 56px.
- Stage origin stable across left drawer collapse/reopen.
- No targeted native `title` attributes.
- No horizontal page overflow observed.

The six V3.4 evidence screenshots are stored under `docs/design/after/v34/`.

## Reviewer Findings

The final `reviewer-agent` initially found three actionable issues: permanent E2E screenshot side effects, collapsed left-handle width overridden by a legacy 44px rule, and Inspector transition shorthand specificity. All three were fixed and re-reviewed. Final status: PASS.

The only remaining observations are non-blocking future debt: viewport default literals are not yet centralized across all camera paths, and focused component tests do not directly execute every preserved WAAPI/reduced-motion or pointer-propagation branch. No current V3.4 behavior is blocked.

## Git and Branch Safety

- Feature branch: `feat/v6-ui-v34-control-cleanup`.
- Base: `integration/v6-ui-stable@0289402`.
- `main` and `origin/main` remain untouched at `8024d4f`.
- No unrelated working-tree changes were identified.
- No branch deletion, history rewrite, force push, or main mutation is permitted by this checkpoint.

## SUBAGENT ORCHESTRATION

Parent orchestrator: Luna orchestrator.

Parallel tasks launched: 13 reconnaissance/review tasks, including the required cheap, specialist, planner, designer, slow, commit, and reviewer routes.

Subagents used:

- `TinyRoutingSmoke` -> `sonic`: routing smoke and project metadata check.
- `SmolRoutingSmoke` -> `scout`: Toolbar structure smoke.
- `TaskRoutingSmoke` -> `task`: viewport overlay structure smoke.
- `CommitRoutingSmoke` -> `commit-agent`: Git checkpoint guidance.
- `PlannerRoutingSmoke` -> `planner-agent`: implementation plan and route metadata.
- `DesignerRoutingSmoke` -> `designer-agent`: pre-review and polish recommendations.
- `SlowRoutingSmoke` -> `slow-agent`: invariant and difficult-path review.
- `ReviewerRoutingSmoke` -> `reviewer-agent`: early risk review.
- `ResetRecon`, `TooltipRecon`, `HandleRecon` -> `scout`: source authority and regression reconnaissance.
- `DesignerPreReview` -> `designer-agent`: independent visual pre-review.
- `DesignerFinalReview` -> `designer-agent`: final visual review PASS.
- `V34FinalReviewer` -> `reviewer-agent`: final correctness/security/regression review.

All shared-file edits and Git operations remained with the parent orchestrator. Subagents were read-only/review-only; no unverified concurrent source mutation was accepted.

## DO NOT CHANGE CASUALLY

Do not modify `main`, rewrite published history, weaken the fixed-rail/stage-origin contract, reintroduce native target tooltips, add a competing Canvas animation authority, or replace the shared sidebar-handle authority with per-component drift.

## Lessons Learned

- Reset actions must update every state dimension of the viewport contract, not only pan.
- Shared visual tokens are insufficient when older high-specificity selectors remain active; real computed geometry must be asserted.
- Transition shorthand rules require specificity review when dock-position animation is part of the contract.
- Permanent E2E tests must not write evidence artifacts into tracked documentation paths.
- Accessible names should remain stable when native tooltip attributes are removed.
