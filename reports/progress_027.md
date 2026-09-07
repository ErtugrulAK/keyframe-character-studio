# KCS Development Report — V6.0 Repository-Wide Playwright Baseline Recovery

# 1. Executive Summary

The fresh V6 browser baseline was recovered against the current consolidated Inspector and Timeline UI. The initial run executed 252 Playwright tests with 235 passed, 16 deterministic failures, and 1 flaky result. All 16 deterministic failures were stale browser contracts: collapsed Inspector disclosures, removed legacy Inspector cards, removed Motion Transitions toolbar surface, removed sequence metadata presentation, and obsolete confirmation/selector assumptions.

The recovery updated the affected E2E contracts, restored the current named-sequence duration authority in `SequencerTimeline`, and preserved legacy procedural/preset data through the current `ANIMATION DATA` workflow. The final full run executed 252 tests with 251 passed and one remaining flaky `layer-index-persistence` result. The flaky test passed in 9/10 isolated repetitions and passed in focused post-change runs; it remains documented rather than hidden with retries or sleeps.

# 2. Original Objectives

In scope:

- Capture a fresh full Playwright baseline before edits.
- Classify every baseline failure as stale contract, product regression, harness issue, flaky, or unknown.
- Repair stale browser contracts against the current V6 UI.
- Fix confirmed product regressions without adding a parallel state or animation authority.
- Verify focused browser/domain behavior and run the full regression command set.
- Create the next sequential development report as `reports/progress_027.md`.

Out of scope:

- Git commits, pushes, branch creation, merges, resets, rebases, stashes, or other Git-state changes.
- Restoring removed legacy UI surfaces.
- Changing public APIs or introducing new dependencies.
- Touching `.hermes/desktop-attachments/`.

# 3. Problems Discovered

| Symptom | Root cause | Classification | Status |
|---|---|---|---|
| M21 image matte source select not visible | `MASK / TRACK MATTE` is a collapsed consolidated disclosure; old direct selector assumed an open Style card | A — stale test contract | Fixed |
| M22 matte relationship tests not visible | Same collapsed consolidated matte disclosure; old Style-tab helper no longer matches the UI | A — stale test contract | Fixed |
| M23 procedural Inspector card missing | Legacy `ANIMATION IN / OUT` presentation was intentionally de-emphasized; data/runtime compatibility remains | A — stale test contract | Fixed by asserting current Animation Data workflow and persisted legacy fields |
| M24 combination preset fields missing | Same removed legacy procedural card | A — stale test contract | Fixed by current compatibility assertions |
| M25 preset rename/category controls missing | Preset management is not exposed by the current main Inspector surface | A — stale test contract | Fixed by verifying the existing preset-library authority and stable scene reference |
| M26 Copy/Paste/Clear buttons missing | `ANIMATION DATA` is collapsed by default | A — stale test contract | Fixed |
| M29 scale lock button missing | Scale lock is in the collapsed `TRANSFORM` card, not the selected-keyframe panel | A — stale test contract | Fixed |
| M29 base transform controls missing | Old `.form-field-group` / `POS X` selector does not describe the current transform controls | A — stale test contract | Fixed with `Position X` |
| Named sequence ID metadata missing | Stable ID is serialized state, not current visible timeline metadata | A — stale test contract | Fixed by retaining serialized ID/link assertions |
| Named sequence duration was not persisted to its `MotionTemplate` | Timeline duration input updated only global `totalFrames`; existing `updateMotionTemplateDuration` authority was unused | B — confirmed product regression | Fixed |
| Named sequence deletion did not complete | Current flow uses a React confirmation dialog, while the test assumed a native browser dialog | A — stale test contract | Fixed |
| Real-user layer order controls missing | Current controls are inside collapsed `TRANSFORM` disclosure | A — stale test contract | Fixed |
| Motion Transitions surface missing | Removed from the current V6 toolbar; transition logic remains an internal canonical capability | A — stale test contract | Fixed by asserting current absence |
| Layer-index redo intermittently stayed at Index 1 | Isolated repetition showed intermittent history/redo observation failure, not a deterministic product failure | D — flaky | Investigated; remains documented |

No baseline failure was classified as C — harness or E — unknown.

# 4. Files Created

- `reports/progress_027.md` — this sequential milestone report. It records scope, classifications, implementation, verification, risks, and the prohibited Git operations.

# 5. Files Modified

- `src/components/Timeline/SequencerTimeline.tsx` — wired the existing `updateMotionTemplateDuration` authority into duration input and duration preset controls. The active sequence duration is now serialized as `MotionTemplate.durationFrames`; the global timeline frame count is updated only when the user changes the duration. Removed an attempted mount-time synchronization that incorrectly overwrote fixture/project `totalFrames` and regressed M27/M28 boundary contracts.
- `e2e/m21-image-matte.spec.ts` — expands the current `MASK / TRACK MATTE` disclosure before selecting a source.
- `e2e/m22-matte-relationship.spec.ts` — replaces the removed Style-tab helper with a semantic matte disclosure helper; deletion and self-reference paths use the current Inspector surface.
- `e2e/m23-in-out-presets.spec.ts` — verifies legacy procedural fields through current `ANIMATION DATA` controls and persisted scene data.
- `e2e/m24-combination-presets.spec.ts` — verifies combination preset compatibility through current `ANIMATION DATA` controls and persisted scene data.
- `e2e/m25-user-saved-presets.spec.ts` — verifies the separate custom preset library and stable scene reference without asserting removed rename/category UI.
- `e2e/m26-copy-paste-animation.spec.ts` — expands `ANIMATION DATA` before Copy/Paste/Clear actions.
- `e2e/m29-selected-keyframe.spec.ts` — expands `TRANSFORM` for scale-lock and base-transform checks; uses the current `Position X` accessible control.
- `e2e/named-sequence-v2.spec.ts` — removes the obsolete visible ID-strip assertion, uses the current duration control and React confirmation dialog, and validates per-sequence durations in frame units.
- `e2e/real-user-verification.spec.ts` — expands `TRANSFORM` and uses semantic layer-order buttons.
- `e2e/workflow.spec.ts` — removes the obsolete Motion Transitions click and verifies the current Project Workspace surface.
- `e2e/layer-index-persistence.spec.ts` — uses the current `Layer index` accessible value instead of broad visible text matching.

# 6. Architecture Overview

The change preserves the existing ownership model:

```text
AnimatorContext
  ├─ useTemplates -> motionTemplates, activeTemplateId, updateMotionTemplateDuration
  ├─ useTimeline  -> tracks, keyframe mutations, timeline state
  ├─ useHistory   -> undo/redo snapshots
  └─ useSerialization -> SceneData persistence

SequencerTimeline
  ├─ reads active sequence duration from motionTemplates
  ├─ writes duration through updateMotionTemplateDuration
  └─ updates global totalFrames for the active timeline view

Inspector
  └─ StyleCard disclosures own visibility of Transform, Animation Data, and Matte controls
```

No second duration, animation, serialization, or history engine was introduced.

# 7. Data Model Changes

Authored/serialized state:

- `MotionTemplate.durationFrames` is now updated by the visible duration control through the existing `updateMotionTemplateDuration` authority.
- Named sequence IDs remain stable and independent from display names.
- Legacy layer fields (`inAnimPreset`, `inAnimDuration`, `outAnimPreset`, `outAnimDuration`) remain loadable and serializable.
- Custom preset library data remains in its existing localStorage authority.

Derived state:

- The duration input displays the active `MotionTemplate.durationFrames / fps`.
- Broadcast sequence runtime continues to consume the persisted sequence duration.

Transient state:

- Disclosure open/closed state remains local UI state.
- Selected keyframe and scale-lock state remain owned by the existing Inspector/timeline authorities.

# 8. Coordinate Space Model

No coordinate or geometry implementation was changed. Existing contracts remain:

- Object-local geometry is transformed by authored/evaluated transforms.
- World/canvas transforms feed SVG rendering and hit testing.
- Viewport/screen coordinates are used only at pointer boundaries.
- Inspector values, evaluated channels, gizmo interaction, serialized transforms, and undo/redo continue through their existing canonical paths.

The focused QA run included the existing direct corner-resize/gizmo tests and matte editor interaction tests.

# 9. Component / Module Walkthrough

`SequencerTimeline.tsx`:

- Reads `motionTemplates`, `activeTemplateId`, `totalFrames`, `fps`, and the existing `updateMotionTemplateDuration` callback from `AnimatorContext`.
- Displays the active sequence duration using the current `.duration-control-box` input.
- Converts seconds to frames using `Math.round(seconds * fps)`.
- Updates the selected sequence and global active timeline duration through existing state authorities.
- Preserves project/fixture `totalFrames` on mount; no implicit synchronization effect remains.

Updated E2E helpers:

- Semantic disclosure helpers inspect `aria-expanded` and open only when needed.
- Current accessible names are used for Transform, Layer index, Position X, Animation Data, and confirmation dialog controls.
- Tests continue to exercise real UI paths and serialize/assert through the existing scene authority.

# 10. Important Code Changes

Duration control now uses the canonical template authority:

```tsx
const durationFrames = Math.round(sec * fps);
updateMotionTemplateDuration(activeTemplateId, durationFrames);
setTotalFrames(durationFrames);
```

This fixes the previous split-brain behavior where the visible duration changed only global timeline state while `MotionTemplate.durationFrames` remained stale.

# 11. Public Interfaces

No new exported interfaces, hooks, components, or types were added.

The existing `updateMotionTemplateDuration(id, durationFrames)` context callback is now consumed by `SequencerTimeline`. Its signature and behavior remain unchanged.

# 12. Algorithms and Geometry

The only new calculation is duration conversion:

- Input: positive duration in seconds from the existing number input.
- Output: integer frame count using `Math.round(seconds * fps)`.
- Existing `normalizeSequenceDuration` remains the final model-level normalization authority.
- Duration preset pills use the same seconds-to-frames conversion.
- No geometry algorithm, interpolation algorithm, mask algorithm, or hit-testing algorithm changed.

# 13. Interaction / UX Behavior

Before:

- Inspector controls were rendered conditionally but tests assumed legacy always-open cards or removed tabs.
- Named-sequence duration editing changed the global timeline duration but not the selected sequence metadata.
- Sequence deletion tests expected a native browser dialog.

After:

- Users open `TRANSFORM`, `ANIMATION DATA`, or `MASK / TRACK MATTE` through their accessible disclosure buttons.
- Duration editing updates both the active sequence metadata and active timeline duration.
- Sequence deletion uses the visible `Delete sequence?` confirmation dialog.
- Legacy procedural data remains compatible without restoring the removed legacy editor.

Expected workflow:

1. Select a part or sequence.
2. Expand the current Inspector card when its controls are needed.
3. Edit through current semantic controls.
4. Save/reload through the existing serialization authority.
5. Verify stable IDs, channels, presets, or legacy fields from the current UI/state boundary.

# 14. Design Decisions

1. Update tests to the current V6 UI instead of restoring removed UI. This avoids compatibility-breaking presentation duplication.
2. Reuse `updateMotionTemplateDuration` instead of adding a second duration store. This preserves the existing domain authority and broadcast callback path.
3. Remove mount-time duration synchronization after focused boundary failures showed it overwrote valid project `totalFrames` fixtures. User edits synchronize the active timeline; mount does not silently rewrite project data.
4. Keep the layer-index flake visible. Adding sleeps, retries, or weakened assertions would hide an unresolved history observation risk.
5. Replace removed preset-management walkthroughs with compatibility assertions against the current preset-library and scene authorities.

# 15. Invariants That Must Be Preserved

- Motion template IDs are stable and independent from display names.
- `MotionTemplate.durationFrames` is the named-sequence duration authority.
- Legacy procedural fields remain backward compatible.
- Custom preset library storage remains separate from scene references.
- Inspector disclosure state must not alter domain state.
- Keyframe values, metadata, easing, template IDs, and bezier data remain canonical.
- Undo/redo remains the existing history authority; no test may hide a transition failure with arbitrary delay.
- Matte source relationships remain target-owned and type-agnostic.
- Coordinate/render/hit-test contracts remain unchanged.
- Production code and tests do not depend on `.omp` harness files.

# 16. Testing and Verification

Fresh baseline before fixes:

- Command: `CI=true npm run test:e2e`
- Result: 252 tests, 235 passed, 16 failed, 1 flaky.
- Deterministic failures: all 16 classified A — stale test contract.
- Flaky candidate: `layer-index-persistence.spec.ts`.

Flaky isolation:

- Command: `CI=true npx playwright test e2e/layer-index-persistence.spec.ts --project=chromium --repeat-each=10 --retries=0`
- Result: 9 passed, 1 failed.
- The failure was the redo state remaining at `Index 1`; no retry/sleep was added.

Focused recovery:

- Command: `CI=true npx playwright test e2e/m21-image-matte.spec.ts e2e/m22-matte-relationship.spec.ts e2e/m23-in-out-presets.spec.ts e2e/m24-combination-presets.spec.ts e2e/m25-user-saved-presets.spec.ts e2e/m26-copy-paste-animation.spec.ts e2e/m29-selected-keyframe.spec.ts e2e/named-sequence-v2.spec.ts e2e/real-user-verification.spec.ts e2e/workflow.spec.ts e2e/layer-index-persistence.spec.ts --project=chromium --retries=0`
- Initial post-selector result: 64 passed, 1 failed in named-sequence duration/deletion follow-up.
- After product and contract corrections: 65 passed.

Additional focused regression:

- Command: `npx tsc --noEmit && CI=true npx playwright test e2e/m27-keyframe-duplicate.spec.ts e2e/m28-keyframe-copy-paste.spec.ts e2e/named-sequence-v2.spec.ts e2e/layer-index-persistence.spec.ts --project=chromium --retries=0`
- Result: 27 passed.

Gizmo/domain focused QA:

- Command: `CI=true npx playwright test e2e/canvas-interaction-v1.spec.ts e2e/editor-interaction.spec.ts e2e/editor-interaction-regressions.spec.ts --project=chromium --retries=0`
- Result: 13 passed.
- Command: `npm run qa:v6`
- Result: 3 passed.

Final full Playwright:

- Command: `CI=true npm run test:e2e`
- Result: 252 tests, 251 passed, 1 flaky (`layer-index-persistence.spec.ts`). No deterministic failures remained.

Final code regression commands:

- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS with the pre-existing Fast Refresh warning in `src/context/AnimatorContext.tsx:654`.
- `npm test` — PASS, 100 test files and 1408 tests.
- `npm run build` — PASS; Vite emitted the existing large-chunk warning.
- `git diff --check` — PASS; Git reported existing working-copy LF/CRLF normalization warnings for three modified E2E files.

# 17. Manual QA Results

- Automated browser QA: PASS for all deterministic affected flows and focused gizmo/domain suites.
- Manual interactive browser session: NOT TESTED.
- Remaining flaky layer-index redo reproduction: PARTIAL; 1/10 isolated repetitions failed and the final full run marked it flaky.

# 18. Regression Risk Assessment

Overall: MEDIUM.

- LOW: Selector-only E2E updates; they target current accessible disclosure/button contracts and do not alter production behavior.
- LOW: Legacy compatibility assertions; they continue to inspect serialized fields through the existing authority.
- MEDIUM: Named-sequence duration wiring; it changes a previously incomplete product path but uses an existing callback and passed focused/full regression coverage.
- MEDIUM: Layer-index history/redo flake remains unresolved and should not be treated as fully closed.
- LOW: No dependency, public API, coordinate, renderer, or serialization schema changes beyond writing the existing duration field correctly.

# 19. Performance Considerations

- Duration editing performs one existing template state update and one existing timeline frame update per committed input change.
- No pointer hot path, render geometry cache, or animation evaluation loop changed.
- No new polling, sleeps, retries, or broad DOM scans were added to production code.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

- React, TypeScript, Vite, and Playwright versions were unchanged.
- Windows/Chromium CI-mode execution was used for all browser verification.
- Existing scene storage key and serialization paths remain unchanged.
- Legacy procedural fields and custom preset references remain loadable.
- The final build and TypeScript checks passed.
- Existing lint, build, Vitest, and Git line-ending warnings remain non-blocking warnings.

# 22. Known Limitations

- `layer-index-persistence.spec.ts` remains intermittently flaky around redo restoring `Index 2`; it passed 9/10 isolated repetitions and was the only flaky result in the final 252-test run.
- No manual browser session was performed; verification used Playwright browser automation and repository test commands.
- The removed legacy `ANIMATION IN / OUT` and Motion Transitions presentation surfaces were not restored; compatibility is verified through current authorities instead.

# 23. Technical Debt

- Investigate the history snapshot/React scheduling boundary behind the layer-index redo flake. Revisit only with a deterministic reproduction or state-level instrumentation; do not add arbitrary waits.
- Consider exposing a stable accessible label for the Timeline duration input instead of relying on the current `.duration-control-box` structural class in E2E tests.
- Consider a dedicated current UI flow for preset metadata management if that capability is intentionally returned to the main product surface.

# 24. Git Summary

- Branch: `feat/v6-motion-core`
- HEAD before work: `d83f43e3d51d95e34bf62caf3e4c136b0ae7ee5f`
- Origin feature HEAD before work: `d83f43e3d51d95e34bf62caf3e4c136b0ae7ee5f`
- Branch divergence before work: `0 0`
- Working tree contained no unexpected changes before implementation.
- Git state was not reset, stashed, rebased, merged, committed, or pushed.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.

# 25. Updated Project Tree

```text
e2e/
  layer-index-persistence.spec.ts
  m21-image-matte.spec.ts
  m22-matte-relationship.spec.ts
  m23-in-out-presets.spec.ts
  m24-combination-presets.spec.ts
  m25-user-saved-presets.spec.ts
  m26-copy-paste-animation.spec.ts
  m29-selected-keyframe.spec.ts
  named-sequence-v2.spec.ts
  real-user-verification.spec.ts
  workflow.spec.ts
src/components/Timeline/
  SequencerTimeline.tsx
reports/
  progress_027.md
```

# 26. Self Review

- Scope stayed within the approved V6 baseline recovery.
- Current UI authorities were used instead of restoring obsolete surfaces.
- The duration product fix reuses existing context state and callback paths.
- A mount-time synchronization attempt was removed after focused boundary QA exposed regressions.
- All deterministic baseline failures are resolved.
- The known flaky history behavior remains visible and documented.
- No unverified manual-browser claim is made.

# 27. Next Recommended Task

Investigate the deterministic source of the layer-index redo flake with targeted history-state instrumentation or a minimal reproduction. Preserve the current assertion and avoid timing-based stabilization.

# 28. Project Status

V6 repository-wide Playwright baseline recovery: COMPLETE for deterministic failures.

Final verification status: PASS with one known flaky layer-index test.

Git delivery status: local working-tree changes only; no commit and no push by explicit scope.

# 29. AI Development Notes

- Followed repository reporting policy and created the next sequential report without overwriting prior reports.
- Used the fresh full Playwright run before edits as the baseline authority.
- Classified all baseline failures with evidence from Playwright error contexts and current source.
- Avoided `.hermes/desktop-attachments/` and did not alter Git state.
- The attempted `omp update` was not part of the repository change and produced no verified repository update.

## DO NOT CHANGE CASUALLY

- Current V6 consolidated Inspector disclosure structure.
- `updateMotionTemplateDuration` as the named-sequence duration authority.
- Stable sequence IDs and channel template references.
- Legacy scene/preset compatibility fields.
- History/undo/redo semantics and the remaining layer-index flake assertion.
- Coordinate-space, matte, evaluation, and serialization authorities.

# 30. Lessons Learned

- A visible domain control can be current while its browser contract is stale; inspect accessible structure before changing production UI.
- Existing callback APIs are strong evidence of intended ownership, especially when tests reveal that visible edits do not reach serialized state.
- Mount-time state synchronization is risky when fixtures intentionally separate project duration from sequence metadata; synchronize on explicit user edits instead.
- A flaky retry is not a pass: isolate it repeatedly, record the rate, and keep the failure visible until the history boundary is understood.
- Compatibility tests should assert preserved data and current workflows, not resurrect removed presentation layers.
