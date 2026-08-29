# KCS Development Report — V5.1 Manual QA Fix Pass A.3

Metadata:
- Date: 2026-08-29
- Milestone: KCS V5.1 — Manual QA Fix Pass A.3
- Branch: `main`
- Starting HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Ending HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Commit status: Uncommitted intentional Pass A, A.1, A.2, and A.3 changes; commit prohibited
- Report number: `004`

# 1. Executive Summary

Pass A.3 fixes the final focused Boolean lifecycle bug discovered after the successful Pass A.2 manual retest. Deleting a Boolean parent previously removed only the generated result and left its hidden Boolean operands in project state. The result was an invisible/orphaned set of elements that could remain in the Outliner, Timeline, serialized project, and future history snapshots.

The fix adds one pure `partDeletion` authority that expands a requested deletion through explicit `booleanOperandIds` ownership, deduplicates the closure, removes associated tracks, and sanitizes remaining invalid Boolean references. The existing `useTimeline.deletePart` path now uses this authority, so keyboard deletion and other callers share the same semantics. Selection IDs, selected keyframe state, and transient operand-editing state are cleared when deleted elements require it.

Dissolve remains separate and non-destructive: `dissolveBooleanGroup` still removes the relationship while preserving and restoring operands. No Boolean schema version or persisted editor-mode field was added. Existing `useHistory` captures the resulting parts/tracks state, so cascade delete participates in the existing undo/redo stack.

Completion state: focused implementation, unit/history tests, focused Chromium/E2E, and live Chromium browser verification passed. Ready for User QA Pass A.3 retest. Mask, Color, Reset View, Rename, Timeline, Export, responsive QA, and full regression remain out of scope.

# 2. Original Objectives

Original task: remove all owned Boolean operands when the Boolean parent/result is deleted while preserving Dissolve semantics and existing history/animation authorities.

In scope:

- Verify the accumulated Pass A/A.1/A.2 working tree and Boolean ownership model.
- Add deduplicated Boolean deletion closure logic.
- Route central element deletion through that closure.
- Remove all associated tracks/channels/keyframes by deleted part ID.
- Clean selection, selected-keyframe, and transient operand-editing state.
- Preserve unrelated elements and malformed-reference safety.
- Preserve `dissolveBooleanGroup` as operand-preserving relationship cleanup.
- Verify state through focused unit tests, history tests, Chromium/E2E, and live browser checks.
- Create the next sequential permanent report.

Out of scope:

- Mask, Color, Reset View, Rename, Timeline QA, Export, responsive QA, visual redesign, and full regression.
- Boolean schema redesign or SceneData version changes.
- New undo stack, animation evaluator, serializer, or persistence model.
- Commit, push, reset, restore, clean, stash, checkout, branch, merge, or rebase.

Pass A.2 manual QA was completed successfully before this lifecycle follow-up was discovered. Its successful result remains the baseline and is not reimplemented here.

# 3. Problems Discovered

## 3.1 Boolean parent deletion left hidden operands

- Symptom: Deleting a Boolean result removed the parent but left its `booleanOperandIds` elements in project state. Those operands retained `booleanGroupId` and remained hidden from ordinary rendering.
- Reproduction: Create Rectangle + Triangle → Union → select parent → press Delete. The result disappeared, but the owned operands remained in state/Outliner relationship.
- Root cause: `useTimeline.deletePart` filtered only the requested selected IDs and tracks whose `partId` matched those IDs. It did not expand Boolean ownership.
- Affected subsystem: lifecycle deletion, Outliner, Canvas visibility, Timeline tracks, serialization state, selection, and history snapshots.
- Severity: P0/P1 data-lifecycle correctness.
- Status: FIXED through the central `deleteParts` utility and `useTimeline.deletePart` integration.

## 3.2 Deletion and Dissolve required distinct semantics

- Symptom/risk: A generic Boolean relationship cleanup could accidentally make Dissolve destructive if operand cleanup were placed in the shared dissolve helper.
- Root cause: Delete and Dissolve both operate on Boolean parent/operand relationships but have opposite ownership intent.
- Affected subsystem: Boolean Inspector actions and lifecycle utilities.
- Severity: HIGH compatibility/data-loss risk.
- Status: FIXED by leaving `dissolveBooleanGroup` relationship-preserving and adding cascade expansion only to the deletion path.

## 3.3 Deletion closure needed malformed-reference safety

- Symptom/risk: A Boolean parent may reference a missing operand ID, duplicate an operand ID, or contain nested/cyclic malformed ownership references.
- Root cause: No normalized ownership closure existed.
- Affected subsystem: programmatic deletion and persisted project state cleanup.
- Severity: HIGH defensive-programming risk.
- Status: FIXED. Existing IDs are traversed once with a Set/queue; missing references do not crash; remaining invalid references are sanitized without deleting unrelated parts.

## 3.4 Editor state could outlive deleted tracks/parts

- Symptom/risk: Selected IDs, selected keyframe ID, or active Boolean operand-editing group could reference deleted data.
- Root cause: Existing delete path cleared primary/part selection but did not clear selected keyframe or transient Boolean editing state based on the deletion closure.
- Affected subsystem: Inspector, Timeline, Selection, Boolean edit mode.
- Severity: MEDIUM-HIGH stale editor state.
- Status: FIXED in `useTimeline.deletePart`.

# 4. Files Created

## `src/utils/partDeletion.ts`

- Purpose: Canonical pure deletion-closure and associated-track cleanup authority.
- Responsibilities: Expand requested IDs through `booleanOperandIds`, deduplicate ownership closure, safely handle missing/cyclic references, remove deleted parts/tracks, and sanitize remaining Boolean references.
- Why it exists: Lifecycle semantics must not be duplicated in keyboard, Inspector, or future context-menu callers.
- Dependencies: `CharacterPart` and `Track` types only; no React dependency.
- Important notes: The utility does not mutate inputs, does not touch persistence directly, and does not implement Dissolve.

## `src/tests/partDeletion.test.ts`

- Purpose: Direct state-level coverage for deletion ownership and safety.
- Responsibilities: Tests parent cascade, unrelated preservation, multi-selection/deduplication, malformed references, nested ownership, and cyclic malformed input.
- Why it exists: The bug concerns invisible state objects, so Canvas disappearance alone is insufficient evidence.
- Dependencies: Vitest and existing animator types.
- Important notes: Test-only; no application runtime dependency.

# 5. Files Modified

Every file below received intentional Pass A.3 changes or focused lifecycle coverage. Earlier Pass A/A.1/A.2 changes remain intentionally uncommitted and are documented in reports `progress_001.md` through `progress_003.md`.

- `src/hooks/useTimeline.ts` — Previous responsibility: timeline state and central `deletePart` mutation. Change: accepts current `characterParts`, optional Boolean editing state, and selected-keyframe state; routes deletion through `deleteParts`; removes tracks, filters selection, clears deleted selected keyframes, and exits operand mode. Behavioral impact: deleting a Boolean parent now removes its owned operands and associated tracks. Risk: HIGH because this is the central scene deletion path.
- `src/context/AnimatorContext.tsx` — Previous responsibility: compose domain hooks. Change: passes current parts and transient Boolean editing state/setter into `useTimeline`. Behavioral impact: all existing delete callers receive the centralized cascade behavior and state cleanup. Risk: HIGH orchestration boundary.
- `src/tests/useTimeline.test.ts` — Adds a hook-level cascade test verifying owned parts, tracks, primary/selected IDs, selected keyframe state, and operand editing state are cleaned. Risk: LOW test-only.
- `src/tests/useHistory.test.ts` — Adds undo/redo coverage restoring and re-removing the complete Boolean parent/operand relationship and tracks. Risk: LOW test-only.
- `src/tests/partDeletion.test.ts` — New direct deletion authority coverage described above. Risk: LOW test-only.
- `e2e/editor-interaction.spec.ts` — Adds a real UI Delete → state/orphan check → Undo → Redo scenario with an unrelated Circle preserved. Risk: LOW test-only.

No Inspector button was changed to cascade: the Boolean Inspector action remains Dissolve, deliberately preserving its non-destructive semantics. Keyboard deletion enters through the existing `useKeyboardShortcuts` → `deletePart` path. There is no separate Outliner delete action in the current UI.

# 6. Architecture Overview

The central lifecycle flow is now:

```text
Keyboard Delete / future delete caller
                 |
                 v
        AnimatorContext.deletePart
                 |
                 v
        useTimeline.deletePart
                 |
                 v
     partDeletion.deleteParts(parts, tracks, requestedIds)
                 |
        +--------+---------+
        |                  |
        v                  v
  ownership closure   track cleanup
        |
        v
  parts + deleted IDs
        |
        +--> selection cleanup
        +--> selected-keyframe cleanup
        +--> Boolean edit-mode cleanup
        +--> existing history snapshot path
```

Delete and Dissolve intentionally diverge:

```text
Delete parent
  -> expand booleanOperandIds
  -> remove parent + owned operands + tracks
  -> clear affected editor state

Dissolve parent
  -> remove parent relationship
  -> keep operands
  -> restore independent visible operands
```

`partDeletion` is pure and domain-level. React hooks orchestrate state setters; `useHistory` remains the existing snapshot authority.

# 7. Data Model Changes

## Authored/serialized state

No new SceneData version or field was introduced. Existing Boolean fields remain:

- Parent: `booleanOperandIds` and `booleanOperation`.
- Operand: `booleanGroupId`.
- Existing `booleanContours`/`points` and transforms remain unchanged.
- Associated `Track` records continue to be identified by `partId`.

After a parent deletion, no owned part or track remains. If a surviving malformed part references a deleted parent or operand, `deleteParts` clears the invalid relationship/reference without deleting that surviving unrelated part.

## Derived/evaluated state

No evaluator change was required. `evaluateFrame`, `evaluateTransform`, and `Track.channels` remain authoritative for animation. Deleted IDs simply no longer appear in the input parts/tracks state.

## Transient editor/UI state

`useTimeline.deletePart` cleans:

- `selectedPartIds` entries in the deletion closure.
- `selectedPartId` when the primary selected part is deleted.
- `selectedKeyframeId` when its owning track is deleted.
- `booleanOperandEditingGroupId` when the active Boolean parent or an actively edited operand is deleted.

These values remain editor-only and are not serialized.

# 8. Coordinate Space Model

Not materially changed by Pass A.3. The existing Pass A/A.1/A.2 coordinate contract remains relevant because lifecycle deletion must remove the same authored/evaluated entities across all surfaces:

- Object-local and Boolean-parent-local transforms remain unchanged for surviving parts.
- World/canvas rendering receives no deleted parent or operand.
- SVG viewport/screen state is unaffected by deletion and must not retain selection overlays.
- Animation evaluation receives no deleted part/track ID.

Deletion is ID/ownership based, not coordinate based. It does not rewrite surviving transforms, geometry, or viewport state. Undo restores the exact prior parts/tracks snapshot through the existing history authority.

# 9. Component / Module Walkthrough

## `useTimeline`

Owns the existing central `deletePart` action used by keyboard deletion and exposed through `AnimatorContext`. It now resolves the selected deletion request, calls the pure closure utility, applies parts/tracks state, and clears dependent transient IDs. The optional Boolean editing setter keeps existing direct hook tests/callers backward compatible while the provider supplies the real setter.

## `AnimatorContext`

Passes `characterParts`, `booleanOperandEditingGroupId`, and its setter into `useTimeline`. No deletion logic was duplicated in the Context.

## `useKeyboardShortcuts`

Unchanged behavior: Delete/Backspace first gives selected-keyframe deletion precedence, then calls the central `deletePart(selectedPartId)`. This means Boolean cascade behavior does not depend on a new keyboard implementation.

## `DetailsPanel`

Unchanged lifecycle distinction: selected Boolean parent uses its existing Dissolve action in the Inspector. That action calls `dissolveBooleanGroupState`, which preserves operands. Destructive Delete remains the central `deletePart` path.

## `partDeletion`

Pure ownership closure and state projection. It does not know React, history, selection, rendering, or serialization.

# 10. Important Code Changes

The deletion closure expands only explicit Boolean ownership:

```ts
const ids = collectOwnedDeletionIds(parts, requestedIds);
```

Each ownership ID is visited at most once. Missing IDs are ignored, and duplicate/cyclic references cannot create an infinite traversal.

`useTimeline.deletePart` now uses the normalized result:

```ts
const deletion = deleteParts(characterParts, tracks, requestedIds);
setCharacterParts(deletion.parts);
setTracks(deletion.tracks);
```

Editor cleanup is based on the same closure, not only the originally clicked ID:

```ts
if (selectedKeyframeId && tracks.some((track) => deletedIdSet.has(track.partId))) {
  setSelectedKeyframeId(null);
}
```

# 11. Public Interfaces

- `DeletePartsResult`: pure result containing `parts`, `tracks`, and `deletedIds`.
- `collectOwnedDeletionIds(parts, requestedIds)`: returns a deduplicated Set containing existing requested IDs and recursively owned Boolean operands.
- `deleteParts(parts, tracks, requestedIds)`: returns filtered parts/tracks plus the normalized deletion closure; sanitizes surviving invalid Boolean references.
- `useTimeline` options: adds `characterParts` and optional `booleanOperandEditingGroupId`/setter inputs. The setter is optional for compatibility with isolated existing hook callers and defaults to a no-op when not supplied.
- Existing `AnimatorContext.deletePart(partId)` public behavior is preserved while its lifecycle semantics are strengthened for Boolean parents.

No new React component, SceneData field, enum, or serialized interface was added.

# 12. Algorithms and Geometry

## Ownership closure

Input: current `CharacterPart[]` and requested existing IDs.

1. Build an ID-to-part map.
2. Seed a Set/queue with existing requested IDs.
3. Pop each part once.
4. If it has `booleanOperandIds`, add only existing unseen operand IDs.
5. Continue until the queue is empty.

Complexity: O(V + E) for reachable ownership vertices/edges, with Set membership preventing duplicate work and cycles.

## State cleanup

The resulting ID Set filters:

- `CharacterPart[]` by `part.id`.
- `Track[]` by `track.partId`.

Surviving Boolean parents have operand references filtered against both existing IDs and deleted IDs. Surviving operands whose `booleanGroupId` points to a deleted ID have that relationship cleared. Unrelated parts remain in the result.

No geometry, transform, interpolation, or polygon operation is performed by the deletion utility.

# 13. Interaction / UX Behavior

## Delete Boolean

- BEFORE: Delete parent/result; hidden operands remained in state and could remain invisible.
- AFTER: Delete parent expands ownership and removes parent, valid owned operands, and associated tracks. Selection/editor references are cleared.
- EXPECTED USER WORKFLOW: Create A + B → Boolean → select parent → Delete/Backspace. Outliner, Canvas, Timeline, Inspector, and stored scene state contain none of the three.

## Undo/Redo

- BEFORE: Existing history could restore only the state actually filtered by the old delete path.
- AFTER: One deletion state contains the complete cascade; existing history restores and reapplies the entire relationship.
- EXPECTED USER WORKFLOW: Delete Boolean → Undo restores parent + operands + relationship → Redo removes all again.

## Dissolve

- BEFORE/AFTER contract preserved: Dissolve is not Delete.
- EXPECTED USER WORKFLOW: Create Boolean → Dissolve Boolean. Parent disappears, operands survive, become ordinary independent visible parts, and their relationship references are cleared.

## Unrelated selection

- BEFORE: No closure normalization existed for parent + unrelated multi-selection.
- AFTER: Requested IDs and owned operands form one deduplicated deletion closure; unrelated selected parts are removed only if explicitly requested.

# 14. Design Decisions

## Central pure deletion authority

- Decision: Add `partDeletion.deleteParts` and call it from `useTimeline.deletePart`.
- Reason: Keyboard and future UI callers need identical lifecycle semantics without duplicated cleanup.
- Alternatives: Add cascade logic separately to keyboard, Inspector, and Outliner handlers; modify `dissolveBooleanGroup`.
- Trade-offs: `useTimeline` receives current parts and transient mode state; existing hook wiring grows slightly.
- Future implication: Any new delete entry point must call `AnimatorContext.deletePart`, not filter arrays independently.

## Explicit Delete/Dissolve separation

- Decision: Keep `dissolveBooleanGroup` operand-preserving and put cascade behavior only in deletion.
- Reason: Users expect Dissolve to preserve authored operands; combining semantics risks data loss.
- Alternatives: Add a mode flag to a generic relationship helper; make one helper infer intent.
- Trade-offs: Two lifecycle functions remain, but intent is explicit and safer.
- Future implication: Do not reuse `deleteParts` for Dissolve.

## Sanitizing surviving invalid references

- Decision: Remove references to deleted/missing operand IDs from surviving parts without deleting those parts.
- Reason: Prevents broken `booleanOperandIds`/`booleanGroupId` references while respecting the requirement not to delete unrelated elements.
- Alternatives: Leave malformed references; delete every part that mentions a deleted ID.
- Trade-offs: A malformed surviving Boolean may lose its invalid relationship data, but unrelated authored content is preserved.
- Future implication: Add validation diagnostics separately if malformed ownership needs user-facing repair UI.

# 15. Invariants That Must Be Preserved

- Deleting a Boolean parent removes every existing ID explicitly listed by its `booleanOperandIds`, recursively for nested owned groups.
- Missing/duplicate/cyclic ownership references never crash or loop.
- Unrelated parts are never deleted unless directly requested.
- Tracks are removed by deleted part ID; no animation track may remain for a deleted element.
- Delete is destructive; Dissolve preserves operands.
- Existing `useHistory` remains the only undo/redo authority.
- `Track.channels`, `evaluateFrame`, and `evaluateTransform` remain animation authorities.
- Selection, selected-keyframe, and transient operand-edit state cannot retain deleted IDs.
- No new persisted lifecycle/mode field is introduced.
- Keyboard Delete retains selected-keyframe precedence.
- Existing Pass A Boolean transform, rendering, and coordinate-space invariants remain unchanged.
- No full regression or deferred QA category may be started in this pass.

# 16. Testing and Verification

## TypeScript

- Command: `npx tsc --noEmit`
- Result: PASS.

## Vitest

- Final command:

```text
npx vitest run src/tests/partDeletion.test.ts src/tests/useTimeline.test.ts src/tests/useHistory.test.ts src/tests/useSelection.test.ts src/tests/booleanGeometry.test.ts src/tests/evaluateFrame.test.ts src/tests/useInspector.test.ts src/tests/useSerialization.test.ts src/tests/selectionGizmo.test.tsx src/tests/viewportMath.test.ts src/tests/outlinerPanel.test.tsx src/tests/freeform.test.ts src/tests/useKeyboardShortcuts.test.ts
```

- Result: PASS, 13 files and 275 tests.
- Coverage: direct deletion closure, Boolean parent cascade, unrelated preservation, malformed/nested/cyclic references, tracks, selected keyframe cleanup, transient operand-edit state cleanup, history undo/redo, Dissolve utility behavior, selection, animation/evaluation, serialization, and preserved Pass A/A.1/A.2 focused contracts.

## Playwright/E2E

- Final command:

```text
CI= npx playwright test e2e/editor-interaction.spec.ts e2e/v51-manual-qa.spec.ts -g "Boolean parent deletion|supports Boolean creation"
```

- Result: PASS, 2 tests.
- Delete scenario: created Rectangle + Triangle + unrelated Circle, created Union, deleted parent through normal keyboard flow, verified parent/operands disappeared, Circle remained, saved state contained only Circle/layer track, Undo restored the relationship, and Redo removed it again.
- Dissolve scenario: existing Boolean creation/hierarchy/dissolve path passed and operands remained after Dissolve.

## Manual Chromium verification

- Seeded Rectangle + Triangle + Circle through the application storage boundary.
- Created and selected a Union Boolean.
- Deleted the Boolean with Delete; live Outliner state contained only Circle and Inspector returned to the empty state.
- Undid deletion; parent and two nested operands returned.
- Verified no browser runtime errors.
- Ran a separate Dissolve flow; Rectangle and Triangle remained visible independent parts after the parent disappeared.

## Git validation

- Command: `git diff --check`
- Result: PASS. Standard line-ending warnings were emitted for existing edited files; no whitespace error was reported.
- Final branch/HEAD: `main`; HEAD and origin/main remain `fe543aa64d4079a2923eec60659e748cfc360d4c`; ahead/behind `0/0`.
- Working tree remains intentionally dirty with accumulated Pass A/A.1/A.2/A.3 and report changes.

## Not run by scope

- Full Vitest.
- Full Playwright.
- Production build.
- Lint.
- Mask, Color, Reset View, Rename, Timeline, Export, responsive, and final visual QA.

# 17. Manual QA Results

- Pass A.2 baseline: PASS per user retest.
- Boolean parent Delete cascade: PASS in live Chromium and focused E2E.
- Owned operands removed from state: PASS in E2E saved-state assertion.
- Unrelated Circle preservation: PASS in live UI/E2E.
- Outliner/Canvas/Inspector cleanup: PASS in live UI/E2E.
- Timeline track cleanup: PASS in saved-state assertion; the deletion closure removes tracks by `partId`.
- Undo restoration: PASS in live Chromium/E2E; parent, operands, and nested hierarchy returned.
- Redo removal: PASS in focused E2E.
- Dissolve preserves operands: PASS in live Chromium and existing focused E2E.
- Malformed/missing/nested/cyclic ownership: PASS in direct unit tests; not a separate user browser workflow.
- Delete while operand editing: PASS by hook state cleanup coverage; full manual mode-before-delete sequence remains recommended.
- Mask, Color, Reset View, Rename, Timeline, Export, responsive, and final visual QA: NOT TESTED by explicit scope.

# 18. Regression Risk Assessment

- Central deletion path: HIGH. Keyboard and future delete callers now remove more data for Boolean parents; this is intended but must not be bypassed.
- Delete/Dissolve distinction: HIGH. Accidentally routing Dissolve through cascade deletion would cause data loss.
- History snapshots: MEDIUM-HIGH. Undo/redo must capture the complete parts/tracks state; focused tests pass, full regression remains unrun.
- Malformed references: MEDIUM. Sanitization protects remaining parts, but malformed documents may need separate validation UX.
- Animation cleanup: MEDIUM-HIGH. Track cleanup is ID-based and focused-tested; no new evaluator was introduced.
- Selection/editor cleanup: MEDIUM. Selected keyframe and transient mode are cleared based on the deletion closure.
- Performance: LOW-MEDIUM. Closure traversal is linear in owned relationship size.

# 19. Performance Considerations

- Ownership closure is O(V + E) over reachable Boolean ownership and uses Set membership to avoid duplicate traversal.
- Parts/tracks filtering is linear in current arrays.
- No geometry recomputation, render loop, animation clock, or additional React subscription was added.
- Deletion performs one pure closure calculation followed by existing state setter calls.
- No benchmark was executed.

# 20. Dependencies

No dependency changes. Existing `polygon-clipping` and all package versions remain unchanged.

# 21. Compatibility

- React/TypeScript: Existing hook/context architecture preserved; TypeScript check passed.
- Vite/Chromium: Focused E2E and live browser deletion/dissolve checks passed.
- Node/Windows: Commands ran in the existing Windows workspace.
- Saved projects: No schema/version change; existing Boolean ownership fields remain supported.
- Animation: Existing `Track.channels`, `evaluateFrame`, and `evaluateTransform` remain authorities; deleted tracks are removed by part ID.
- History: Existing `useHistory` captures the resulting complete parts/tracks state; no special stack was introduced.
- Warnings: Standard Git line-ending warnings only; no runtime error remained in final browser verification.

# 22. Known Limitations

- User Pass A.3 retest is still required.
- No separate Outliner delete/context-menu command currently exists; future entry points must use the central `deletePart` path.
- Deleting an operand alone is not a new product workflow; surviving malformed parent cleanup is defensive rather than a designed operand-edit lifecycle.
- Animated dissolve trajectory semantics remain the existing Pass A limitation.
- Nested Boolean lifecycle behavior is covered by pure closure tests but not a full browser nested-group workflow.
- Full regression, build, and lint remain unrun.
- Deferred Mask, Color, Reset View, Rename, Timeline, Export, responsive, and final QA remain untouched.

# 23. Technical Debt

- Add a component-level delete test that enters Edit Operands, deletes an active operand/parent, and verifies mode/selection transitions through the real UI.
- Add direct saved-project import/reload orphan validation after cascade deletion.
- Add a dedicated context-menu/Outliner deletion entry point only if product UX requires it, routed through `deletePart`.
- Consider explicit validation diagnostics for malformed Boolean references rather than relying only on deletion sanitization.
- Continue avoiding duplicated relationship cleanup helpers.

# 24. Git Summary

- Branch: `main`
- Starting HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Ending HEAD: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- origin/main: `fe543aa64d4079a2923eec60659e748cfc360d4c`
- Ahead/behind: `0/0`
- Working tree: Intentionally dirty with accumulated Pass A/A.1/A.2/A.3, policy, and report files.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.
- New production file: `src/utils/partDeletion.ts`.
- New test file: `src/tests/partDeletion.test.ts`.
- Modified lifecycle files: `src/hooks/useTimeline.ts`, `src/context/AnimatorContext.tsx`, `src/tests/useTimeline.test.ts`, `src/tests/useHistory.test.ts`, `e2e/editor-interaction.spec.ts`.
- Permanent report: `reports/progress_004.md`.

# 25. Updated Project Tree

```text
reports/
├── DEVELOPMENT_REPORTING_POLICY.md [canonical]
├── progress_001.md [Pass A]
├── progress_002.md [Pass A.1]
├── progress_003.md [Pass A.2]
└── progress_004.md [new: Pass A.3]

src/hooks/
└── useTimeline.ts [changed: central deletion path]

src/context/
└── AnimatorContext.tsx [changed: deletion dependencies]

src/utils/
└── partDeletion.ts [new: Boolean-aware deletion authority]

src/tests/
├── partDeletion.test.ts [new]
├── useTimeline.test.ts [changed]
└── useHistory.test.ts [changed]

e2e/
└── editor-interaction.spec.ts [changed: Boolean cascade Delete E2E]
```

Accumulated Pass A/A.1/A.2 files remain in the working tree and are documented in earlier reports. `node_modules`, `dist`, generated artifacts, and `.hermes/desktop-attachments/` are omitted.

# 26. Self Review

What is good:

- Deletion ownership is explicit, pure, deduplicated, and separate from Dissolve.
- The bug is verified at state level, not only by Canvas disappearance.
- Existing keyboard precedence, history, animation tracks, and selection authorities are reused.
- Unrelated content preservation and malformed-reference safety are covered.
- Real Chromium/E2E coverage proves Delete, Undo, Redo, and Dissolve behavior.

What could improve:

- The real UI has no separate Outliner/context-menu delete action to exercise; future callers must be guarded by architecture conventions.
- Component-level active operand-mode deletion coverage would strengthen the transient-state proof.
- Full regression remains necessary before final milestone approval.

Uncertainty:

- Nested Boolean browser behavior was not exercised end-to-end; nested closure behavior is covered by pure tests.
- Deleting an operand alone is defensively sanitized but not a newly designed user workflow.

Score: 8/10. The orphan lifecycle bug has direct state, history, E2E, and browser evidence with a small central fix. Full regression and nested/operand-edit browser coverage remain pending.

# 27. Next Recommended Task

Perform the complete User QA Pass A.3 retest, including Delete while locked and Edit Operands modes, state/timeline inspection, Undo/Redo, Dissolve regression, and reload verification.

# 28. Project Status

- Current milestone: KCS V5.1 Manual QA Fix Pass A.3.
- Completed work: Boolean parent cascade deletion, ownership closure/deduplication, track cleanup, selection/editor cleanup, history restoration, Dissolve separation, focused tests, focused E2E, and live Chromium verification.
- Remaining milestone work: User Pass A.3 retest; then deferred Mask, Color, Reset View, Rename, Timeline, Export, responsive, final visual QA, and full regression.
- QA stage: Ready for User QA Pass A.3 retest; not final milestone approval.

# 29. AI Development Notes

- `useTimeline.deletePart` is the current central element deletion authority exposed through `AnimatorContext`.
- `useKeyboardShortcuts` preserves keyframe-delete precedence before calling element deletion.
- Boolean ownership is explicit in parent `booleanOperandIds`; operand `booleanGroupId` is relationship metadata.
- Delete expands parent ownership; Dissolve only removes the relationship and preserves operands.
- `deleteParts` is pure and must remain React/history independent.
- Tracks are associated by `track.partId`; deleting a part requires deleting its tracks.
- Selected IDs, selected keyframe IDs, and transient Boolean edit group IDs are editor state and must not reference deleted entities.
- Existing history captures `characterParts` and `tracks`; do not create a Boolean-specific undo stack.
- Existing `Track.channels`, `evaluateFrame`, and `evaluateTransform` remain animation authorities.
- Useful tests: `src/tests/partDeletion.test.ts`, `useTimeline.test.ts`, `useHistory.test.ts`, `e2e/editor-interaction.spec.ts`, and `e2e/v51-manual-qa.spec.ts`.
- Browser reproduction: create Rectangle + Triangle + Circle → Boolean(Rectangle, Triangle) → Delete parent → inspect Outliner/Inspector/storage → Undo → Redo; separately create Boolean → Dissolve.
- Keep lifecycle semantics explicit when adding future context-menu or Outliner delete controls.

## DO NOT CHANGE CASUALLY

- Do not put cascade deletion into `dissolveBooleanGroup`.
- Do not delete every part that merely references a deleted ID; expand only explicit owned Boolean operands and sanitize remaining references.
- Do not filter only the visible Boolean result and forget hidden operands/tracks.
- Do not leave selected part/keyframe/editor-mode IDs pointing to deleted entities.
- Do not replace `useHistory` with a Boolean-specific undo mechanism.
- Do not add a second animation or serialization cleanup authority.
- Do not bypass `AnimatorContext.deletePart` for future destructive delete UI.
- Do not change `Track.channels`, `evaluateFrame`, or `evaluateTransform` as part of lifecycle cleanup.
- Do not broaden Pass A.3 into the deferred QA categories or full regression.

# 30. Lessons Learned

- Invisible state objects are lifecycle bugs even when the Canvas appears correct; state-level assertions are mandatory for destructive operations.
- Delete and Dissolve can share relationship data but must have independent ownership semantics.
- A pure closure utility makes deduplication, malformed-reference handling, and direct tests straightforward.
- Existing history can correctly restore a cascade when the mutation updates the complete canonical parts/tracks state in one logical React transaction.
- Selection and timeline cleanup must be derived from the same deletion closure, not the clicked ID alone.
- Focused E2E should include unrelated content, saved-state inspection, Undo, and Redo—not only disappearance of the selected row.
