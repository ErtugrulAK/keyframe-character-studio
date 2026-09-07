# KCS V6 Merge-Blocker Recovery Report

## 1. Metadata

- Report: `progress_030.md`
- Milestone: KCS V6 merge-blocker recovery
- Date: 2026-02-12
- Branch: `feat/v6-motion-core`
- Base: `073408e6fdf789259dec4f656b426fcb36052860`
- Main branch modified: No

## 2. Scope

This report closes the blocker matrix from `reports/progress_029.md`. The implementation scope covered sequence-aware evaluation, V6 masks, track mattes, generated OGraf runtime parity, persistence, history, timeline rows, graph editing, accessibility, and security-safe generated SVG identifiers.

## 3. Decision Summary

Most reported blockers are implemented and covered by focused tests. The branch remains blocked because ordered layer-mask semantics are not yet mathematically equivalent to `(A - B) ∪ C` for arbitrary mask ordering, and the full Playwright suite did not finish within the 600-second verification window.

## 4. Blocker Matrix

All 36 findings from `progress_029.md` were reviewed:

| ID | Status | Evidence |
|---|---|---|
| A1 | FIXED | Active-sequence filtering is applied in frame evaluation and layer-mask evaluation. |
| A2 | FIXED | Legacy and canonical channel paths preserve normalized `templateId`. |
| A3 | FIXED | Auto-Bezier neighbors are selected from sorted adjacent keyframes. |
| A4 | FIXED | Bezier topology checks coordinate space and preserves one-sided handle absence. |
| C1 | FIXED | Static and generated mask definitions share deterministic safe-ID behavior. |
| C2 | FIXED | Mask scalar/path channels are evaluated from the active sequence. |
| C3 | FIXED | Animated mask path, feather, expansion, and opacity are emitted by generated runtime. |
| C4 | FIXED | Disabled masks and V2 matte state are respected. |
| C5 | REMAINING BLOCKER | Static, React, and generated runtime still apply multiple mask IDs as nested SVG masks; this is intersection-like composition and does not implement arbitrary ordered union/subtract/difference semantics. |
| C6 | FIXED | Track-matte alpha/luminance definitions and inverted polarity are emitted and tested. |
| C7 | FIXED | Unsupported advanced legacy matte combinations now produce validation errors instead of silent output. |
| C8 | FIXED | Generated SVG IDs and references are sanitized and collision-safe while logical IDs remain available in metadata. |
| C9 | FIXED | Runtime sequence selection and active-template evaluation are retained in generated modules. |
| S1 | FIXED | Serialization persists track hierarchy `parentId`. |
| S2 | FIXED | Sequence deletion removes ordinary, legacy, scalar-mask, and path-mask keyframes. |
| S3 | FIXED | Sequence selection synchronizes edit timeline duration and isolates broadcast playback state. |
| S4 | FIXED | Copy/paste and duplicate operations include scalar/path mask channels with deep-cloned values and atomic collision checks. |
| H1 | FIXED | Frame-group deletion removes active-template keyframes across all canonical channel families. |
| E1 | FIXED | Scale X/Y rows are restored and aligned with expanded transform lanes. |
| E2 | FIXED | Timeline graph selection is scoped to the active template. |
| E3 | FIXED | Keyed mask scalar edits route through keyframe mutation without overwriting the base value. |
| E4 | FIXED | Bezier vertex IDs are collision-safe after deletion/addition. |
| E5 | FIXED | Bezier vertex and handle controls expose keyboard interaction. |
| E6 | FIXED | Temporal graph pointer coordinates use the actual SVG bounding rectangle. |
| E7 | FIXED | Temporal graph keyframes expose keyboard interaction. |
| R1 | FIXED | Generated runtime IDs are deterministic and collision-safe for hostile logical IDs. |
| R2 | FIXED | Generated runtime inverted-alpha polarity and source visibility are covered by parity tests. |
| T1 | FIXED | Track-lane row restoration is covered by focused timeline tests. |
| T2 | FIXED | Active-template graph behavior is covered by focused timeline/graph tests. |
| P1 | FIXED | Serialization and template lifecycle changes preserve hierarchy and sequence isolation. |
| P2 | FIXED | History/copy/duplicate operations preserve mask channel values and IDs. |
| D1 | FIXED | Details panel exposes existing transform and mask keyframe callbacks through context. |
| D2 | FIXED | Timeline and inspector edits preserve canonical mutation authorities. |
| D3 | FIXED | Graph and Bezier controls provide keyboard-accessible interaction roles. |
| D4 | FIXED | Coordinate conversion for graph pointer editing is corrected. |
| K1 | FIXED | Input-derived generated IDs are escaped, sanitized, and tested against hostile identifiers. |

## 5. Sequence and Evaluator Parity

Status: PASS for the reviewed contracts. Active sequence IDs flow through frame and mask evaluation. Keyframe normalization and Auto-Bezier neighbor selection are covered by focused tests.

## 6. Mask Compositor Parity

Status: BLOCKED. Additive runs are grouped, but the final multi-mask application remains nested SVG masks. Nested masks compose as repeated alpha intersection and cannot represent every ordered Boolean stack.

## 7. Track Matte Parity

Status: PASS for implemented alpha/luminance V2 and clip behavior. Inverted alpha polarity, source visibility, safe references, and unsupported legacy advanced combinations are covered. Legacy unsupported combinations fail validation explicitly.

## 8. Generated Runtime Parity

Status: PASS for tested generated runtime contracts: active template selection, animated layer masks, animated mask filters, V2 mattes, clip references, inverted alpha, residual subtract opacity, and hostile IDs.

## 9. Serialization and Hierarchy

Status: PASS for persisted `parentId`, sequence cleanup, active-template duration synchronization, and isolated broadcast selection.

## 10. History and Frame Groups

Status: PASS for canonical ordinary channels, mask scalar channels, mask path channels, legacy keyframes, deep cloning, and collision-safe atomic duplicate/copy behavior.

## 11. Timeline Rows

Status: PASS for restored scale X/Y rows and expanded transform-row alignment.

## 12. Graph Editor

Status: PASS for active-template graph selection, SVG coordinate conversion, keyboard keyframe controls, and keyboard Bezier vertex/handle controls.

## 13. Accessibility

Status: PASS for the implemented graph and Bezier controls: focusable controls expose button roles and keyboard handlers. Full browser-suite confirmation is incomplete because the full Playwright run timed out.

## 14. Security

Status: PASS for generated SVG/runtime identifier sanitization and deterministic collision-safe references. Hostile ID parity tests passed.

## 15. Semantic Browser Verification

`npm run qa:v6`: PASS, 3/3 tests passed in 4.1 seconds. This is the direct V6 browser smoke suite and is the available semantic browser proof.

## 16. Focused Test Verification

The changed-contract focused suite passed:

- 20 test files
- 461 tests passed

The generated-runtime parity suite passed:

- 7 tests passed

## 17. Full Vitest

`npm test`: PASS.

- 100 test files passed
- 1,421 tests passed

## 18. TypeScript

`npx tsc --noEmit`: PASS.

## 19. Lint

`npm run lint`: PASS with one pre-existing Fast Refresh warning in `src/context/AnimatorContext.tsx` at the context export boundary. No lint error remains.

## 20. Build

`npm run build`: PASS. Vite production build completed. The existing chunk-size warning remains for the main JavaScript chunk.

## 21. Full Playwright

`CI=true npm run test:e2e`: NOT COMPLETE. The run started 252 tests with one worker and timed out after 600 seconds before producing a final result. No failure assertion was emitted by the command before timeout.

## 22. Diff Hygiene

`git diff --check`: PASS. No whitespace errors were reported.

## 23. Files Modified

Implementation changes are limited to the evaluator, compositor/runtime, serialization/history, timeline/inspector, validation, tests, roadmap/interop documentation, and Playwright CI-isolation configuration. No `.hermes/desktop-attachments/` files were changed.

## 24. Architecture and Authorities

Existing evaluator, track mutation, serialization, template lifecycle, SVG renderer, generated runtime, timeline, and inspector authorities were extended. No parallel playback engine, serializer, evaluator, or compositor was introduced.

## 25. Data and Coordinate Decisions

- Sequence identity remains separate from display name.
- Missing template IDs normalize to `Sequence` for legacy compatibility.
- Mask paths retain authored coordinate space.
- Graph pointer coordinates are derived from the actual SVG client rectangle.
- Generated IDs are runtime-safe projections of logical IDs, not replacements for persisted logical IDs.

## 26. Compatibility and Risks

Backward-compatible legacy channel and matte data remains readable. Unsupported legacy advanced matte combinations now fail validation explicitly. The material remaining risk is C5: arbitrary ordered mask Boolean composition is not complete. The full Playwright timeout is a verification limitation and must be rerun before merge review.

## 27. Performance

The implementation reuses existing channel maps and generated definitions. No new dependency or polling loop was introduced. The production build reports the existing large main chunk warning.

## 28. Git Synchronization

Phase commits created on `feat/v6-motion-core`:

- `868afca fix: scope V6 evaluation to active sequences`
- `a438ad3 fix: unify V6 mask and matte output semantics`
- `d899ce3 fix: restore V6 serialization and history integrity`
- `9c13821 fix: restore V6 timeline and graph editing contracts`
- `dac9a68 fix: restore strict V6 type contracts`
- `e142af4 docs: align V6 roadmap and interop boundaries`

The branch is ahead of `origin/feat/v6-motion-core` until the approved push step. Main remains untouched.

## 29. Self-Review and Next Task

Self-review conclusion: do not mark this branch ready. The next task is to implement a canonical ordered mask compositor that evaluates the mask stack sequentially and emits equivalent union, subtract, intersect, and difference alpha geometry in static SVG, React preview, and generated runtime, then rerun the full Playwright suite.

## 30. Final Status and AI Notes

Final status: BLOCKED by C5 ordered mask compositor parity and incomplete full Playwright verification.

### DO NOT CHANGE CASUALLY

- Do not bypass the canonical evaluator or track mutation authorities.
- Do not replace logical IDs with sanitized IDs in persisted project data.
- Do not treat nested SVG masks as proof of arbitrary ordered Boolean parity.
- Do not weaken the full Playwright timeout result or mark it as passed.
- Do not modify `main` or merge this feature branch without final pre-merge review.

Lessons: focused parity tests can prove individual mask and matte features while still missing non-commutative ordered-stack semantics. Keep stack-level algebra tests separate from per-definition emission tests.
