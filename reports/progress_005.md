# KCS V5.1 — CI Recovery / Production Build Repair

Metadata:
- Date: 2026-08-30
- Milestone: KCS V5.1 — Checkpoint CI Recovery / Production Build Fix
- Branch: `main`
- Starting HEAD: `22782890ca5e7f73caf58ea468714faf496fb70e`
- Ending HEAD: `22782890ca5e7f73caf58ea468714faf496fb70e` (uncommitted repair)
- Commit status: Intentional uncommitted CI recovery changes; commit prohibited for this task
- Push status: No push performed
- Report number: `005`

# Executive Summary

The KCS V5.1 checkpoint at `22782890ca5e7f73caf58ea468714faf496fb70e` reproduced the reported GitHub Actions production-build failure locally. The repair applies five small source changes across four existing modules:

- Restores the semantic child-part ID lookup in the child-frame rotation path.
- Completes the multi-selection contract consumed by `useTimeline`.
- Passes selected-keyframe state through the existing `AnimatorContext` → `useTimeline` composition boundary.
- Exposes the existing project-resolution setter through the provider value.
- Removes one genuinely stale `getFreeformBounds` import without touching working bounds algorithms.

The Boolean deletion authority, selection model, history authority, and geometry implementation remain unchanged. Focused deletion/timeline/history tests passed, and `npm run build` passed with both `tsc -b` and `vite build`.

# Objectives

- Preserve checkpoint `22782890ca5e7f73caf58ea468714faf496fb70e`.
- Reproduce the actual CI production-build failure locally.
- Fix the reported errors at their architectural roots.
- Preserve Boolean A.3 cascade deletion and undo/redo behavior.
- Preserve single selection, Ctrl multi-selection, marquee selection, timeline selection, and operand editing.
- Preserve project-resolution import/export and UI behavior.
- Keep shape and Boolean bounds algorithms unchanged.
- Verify the real production bundle command, not only standalone type checking.
- Create the next sequential progress report.
- Do not commit or push.

# CI Failure Analysis

The local command `npm run build` reproduced the six reported checkpoint errors before repair:

- `StageCanvas.tsx`: two unresolved `targetId` references.
- `AnimatorContext.tsx`: `setSelectedPartIds` was passed to `useTimeline` although the option contract omitted it.
- `AnimatorContext.tsx`: the provider value omitted the required `setProjectResolution` field.
- `useTimeline.ts`: destructuring and dependency usage referenced `setSelectedPartIds` although its option contract omitted it.
- `bounds.ts`: `getFreeformBounds` was imported but unused.

After the first minimal corrections, the production build exposed one additional incomplete composition input: `selectedKeyframeId` and `setSelectedKeyframeId` were required by `UseTimelineOptions` but were not passed by `AnimatorContext`. That was repaired at the same composition boundary. The second `npm run build` completed successfully.

# Root Causes

## 1. Child-frame rotation used an out-of-scope target ID

**ERROR**

`src/components/Canvas/StageCanvas.tsx(387,58)` and `(393,64)` reported `Cannot find name 'targetId'`.

**→ ROOT CAUSE**

The preceding child-frame scale branch defined the target entity as `dragStart.partId ?? selectedPartId`. The rotation branch used the same semantic state but omitted the local declaration, leaving two references outside any defining scope.

**→ FIX**

Added the same local semantic target resolution to the rotation branch:

```ts
const targetId = dragStart.partId ?? selectedPartId;
```

This does not invent a new ID or alter deletion behavior. It identifies the dragged child when present and otherwise uses the current primary selection, matching the adjacent scale path.

**→ VERIFICATION**

`npm run build` passed. Existing `partDeletion`, `useTimeline`, and `useHistory` focused tests passed. The A.3 deletion authority remains unchanged.

## 2. Multi-selection setter was missing from `UseTimelineOptions`

**ERROR**

`src/context/AnimatorContext.tsx(345,5)` reported that `setSelectedPartIds` was not a known `UseTimelineOptions` property. `src/hooks/useTimeline.ts(45,3)` reported that the property did not exist on the same type.

**→ ROOT CAUSE**

The multi-selection migration had already reached runtime behavior: `useTimeline` destructured and used `setSelectedPartIds`, the provider passed it, and existing tests supplied it. The local interface was stale and omitted the required option.

**→ FIX**

Added `setSelectedPartIds: (ids: string[]) => void` to `UseTimelineOptions`. The existing `useSelection` state remains the selection authority; no second selection store, optional escape hatch, or single-selection rollback was introduced.

**→ VERIFICATION**

Focused `useTimeline` tests passed. The production type check in `npm run build` passed. Existing canvas, outliner, timeline, marquee, and selection implementations were not changed.

## 3. Project-resolution setter was omitted from the provider value

**ERROR**

`src/context/AnimatorContext.tsx(500,7)` reported that `setProjectResolution` was required by `AnimatorContextType` but missing from the supplied provider object.

**→ ROOT CAUSE**

The state and setter already existed in `AnimatorContext`, were passed to `useSerialization`, and were consumed by `ProjectDrawer`. Only the provider value projection omitted the existing setter.

**→ FIX**

Added the existing `setProjectResolution` state setter to `AnimatorContext.Provider`'s `value` object. The public context contract and project-resolution behavior are preserved.

**→ VERIFICATION**

`npm run build` passed. `ProjectDrawer` and serialization callsites remain unchanged and continue to use the same state setter.

## 4. Selected-keyframe inputs were missing from the timeline composition

**ERROR**

After the initial fixes, `npm run build` reported that the `AnimatorContext` call to `useTimeline` was missing required `selectedKeyframeId` and `setSelectedKeyframeId` options.

**→ ROOT CAUSE**

`useSelection` already returned both values and `UseTimelineOptions` already required them, but the context composition passed only the part-selection values. This was a second incomplete migration at the same hook boundary.

**→ FIX**

Passed the existing `selectedKeyframeId` and `setSelectedKeyframeId` values from `AnimatorContext` into `useTimeline`. No type weakening was used.

**→ VERIFICATION**

The subsequent `npm run build` passed. Focused `useTimeline` and `useHistory` tests passed.

## 5. `getFreeformBounds` was a stale import

**ERROR**

`src/utils/bounds.ts(2,1)` reported that `getFreeformBounds` was declared but never read.

**→ ROOT CAUSE**

`getPartLocalBounds` computes freeform bounds through the existing local `boundsFromPoints(part.points || [])` path. The imported helper was not used by this module, and the current triangle, star, rhombus, parallelogram, and Boolean bounds algorithms were already implemented through the existing geometry paths.

**→ FIX**

Removed only the unused import. No bounds calculation, geometry algorithm, fallback, or threshold was changed.

**→ VERIFICATION**

`npm run build` passed. Existing bounds/freeform tests remain in the repository and were not modified.

# Files Modified

- `src/components/Canvas/StageCanvas.tsx`
  - Added the missing local `targetId` declaration in child-frame rotation.
- `src/context/AnimatorContext.tsx`
  - Passed selected-keyframe state into `useTimeline`.
  - Exposed `setProjectResolution` in the provider value.
- `src/hooks/useTimeline.ts`
  - Declared the already-consumed `setSelectedPartIds` option.
- `src/utils/bounds.ts`
  - Removed the unused `getFreeformBounds` import.
- `reports/progress_005.md`
  - Added this sequential CI recovery report.

No workflow file was modified. No Boolean deletion utility, history hook, selection hook, evaluator, serializer, or geometry algorithm was modified.

# Architecture Impact

The change is limited to existing composition boundaries and one stale import:

```text
useSelection
  ├─ selectedPartId / selectedPartIds
  └─ selectedKeyframeId
          |
          v
AnimatorContext
          |
          v
useTimeline
```

`useSelection` remains the single selection state authority. `useTimeline` now accurately declares the multi-selection setter it already consumes. `AnimatorContext` now projects the existing resolution setter and selected-keyframe state consistently with its declared contracts.

Boolean lifecycle behavior remains centralized in:

```text
AnimatorContext.deletePart
  -> useTimeline.deletePart
  -> deleteParts
  -> selection/keyframe/operand-mode cleanup
  -> existing useHistory snapshot flow
```

The repair does not add a new deletion path, animation engine, evaluator, serialization field, or history mechanism.

# Implementation Details

- `StageCanvas` rotation now mirrors the neighboring scale path's target resolution: `dragStart.partId ?? selectedPartId`.
- `UseTimelineOptions` now includes the required `setSelectedPartIds` callback used by deletion cleanup.
- `AnimatorContext` passes both selected-keyframe values already owned by `useSelection`.
- `AnimatorContext.Provider` exposes the same `setProjectResolution` returned by `useState` and already consumed by `ProjectDrawer` and `useSerialization`.
- `bounds.ts` retains the existing `getPartLocalBounds`, `getShapeGeometry`, freeform-point, stroke, and Boolean-contour behavior.
- No `any`, `@ts-ignore`, `@ts-expect-error`, optional contract weakening, fallback, or behavior-silencing change was added.

# Regression Risk Analysis

- **Boolean A.3 cascade deletion:** Low incremental risk. `partDeletion.ts` and its call path were not changed. Focused deletion and history tests passed.
- **Undo/redo:** Low incremental risk. `useHistory` was not changed. Focused history tests passed.
- **Selection:** Low incremental risk. The repair completes the existing multi-selection contract without changing state transitions or event handlers.
- **Timeline deletion cleanup:** Low incremental risk. The setter is now typed exactly as the existing implementation uses it.
- **Project resolution:** Low incremental risk. The existing setter is now returned through context; state ownership and serialization behavior are unchanged.
- **Bounds:** Low incremental risk. Only an unused import was removed.
- **Child-frame rotation:** Scoped correctness fix. The branch now resolves the same target ID as its adjacent scale implementation.

# Testing

Focused tests executed:

```text
npm test -- src/tests/partDeletion.test.ts src/tests/useTimeline.test.ts src/tests/useHistory.test.ts
```

Result:

```text
Test Files  3 passed (3)
Tests       20 passed (20)
```

CI-compatible broad commands executed:

```text
npm run lint
npx tsc --noEmit
npm test
```

Results:

```text
lint: PASS (one existing react/only-export-components warning)
standalone TypeScript check: PASS
Test Files 80 passed (80)
Tests 1327 passed (1327)
```

The focused suite covers Boolean ownership closure, deletion cleanup, and Boolean deletion undo/redo. No tests were deleted, skipped, weakened, or modified for this repair.

# Production Build Verification

Executed:

```text
npm run build
git diff --check
```

Result:

```text
tsc -b: PASS
vite build: PASS
git diff --check: PASS
```

The Vite build transformed 1,899 modules and completed successfully. Vite emitted only the existing chunk-size warning for the generated JavaScript bundle; it was not treated as a build failure.

# GitHub Actions Consistency

The workflow `.github/workflows/ci.yml` runs these commands after `npm ci`:

```text
npm run lint
npx tsc --noEmit
npm test
npm run build
```

The workflow itself is correct and was not modified. The prior checkpoint verification reported standalone `npx tsc --noEmit` success, but that command is not equivalent to the required production command. CI later ran `npm run build`, which invokes project build mode (`tsc -b`) and then Vite bundling. The discrepancy was therefore verification coverage: the earlier local gate did not execute the actual production bundle command. This recovery treats `npm run build` as mandatory.

# Known Limitations

- The repository still emits Vite's existing advisory warning about a generated chunk exceeding 500 kB. The build completes successfully; this repair does not introduce code splitting or unrelated bundle refactoring.
- Lint completed successfully with one existing `react(only-export-components)` warning in `src/context/AnimatorContext.tsx`; this recovery does not refactor that unrelated warning.
- No new browser manual-QA pass was required for these compile-contract-only changes; previously verified Boolean and selection behavior was not altered.

# Technical Debt

- CI and local developer habits should continue treating `npm run build` as a required gate rather than relying on `npx tsc --noEmit` alone.
- The project may later address the existing Vite chunk-size advisory as an independent performance task. It is outside this checkpoint recovery.
- `UseTimelineOptions` and `AnimatorContextType` are currently maintained as local interfaces. Future contract changes should update their composition callsites atomically.

# Git Summary

- Starting HEAD: `22782890ca5e7f73caf58ea468714faf496fb70e`
- `origin/main`: `22782890ca5e7f73caf58ea468714faf496fb70e`
- Branch: `main`
- Commit: none
- Push: none
- Working tree: intentional uncommitted recovery changes
- Source diff: 4 existing source files, 5 insertions, 1 deletion; plus this report

# Self Review

- Scope stayed within the six reported build failures and the one additional incomplete timeline composition error exposed by the real build.
- No unrelated feature, milestone, workflow, Boolean lifecycle, selection algorithm, bounds algorithm, or history refactor was introduced.
- No destructive Git command was used.
- No `any`, TypeScript suppression directive, optional-property workaround, arbitrary retry, sleep, threshold, or fallback was added.
- The checkpoint commit remains intact and unmodified.

# Next Recommended Task

Review this uncommitted CI recovery diff and, if accepted, create a separate checkpoint commit through the approved Git workflow. Do not start a new feature milestone before that review.

# Project Status

KCS V5.1 checkpoint CI recovery is technically repaired at the source level. The production build passes locally. The working tree intentionally remains uncommitted and unpushed pending user review.

# AI Development Notes

- Repository communication rules require English source and report content; this report follows that convention.
- The repair favored contract completion over optional fields or compiler suppression.
- A production-build rerun was required after the first corrections because build mode exposed one additional missing hook input not shown in the initial error batch.

# Lessons Learned

- A successful standalone type check does not prove that the project-reference build and bundler pass.
- Hook option interfaces and their composition callsites must migrate together during state-model changes.
- Existing state ownership is the safest fix for missing provider fields: expose the setter already used by UI and serialization rather than introducing another state path.
- Unused imports in geometry modules should be removed surgically when the active calculation path is already correct.
