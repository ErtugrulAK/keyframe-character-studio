# Progress 108 — Canvas Tangent Authoring (Milestone A) + Grouped Roadmap Orchestration

## 1. Scope

Grouped-roadmap orchestration with Milestone A (roadmap item 3, direct canvas tangent handles) as the first milestone. The goal review, milestone grouping, design contract, design review, implementation, and validation all ran; the milestone was **not merged** because the independent merge-gate review returned BLOCKED with a concrete remaining-work list.

## 2. Repo preflight state

- `main` = `origin/main` = `d3aa135bdf8d63b9cb01b21f2b2f4c14f7973c72`; working tree clean.
- Tag `v1.1.0-rc.1` present, target `46d2a3e59e065816d972dcd56951803951b577f6` (unchanged).
- CI on `main`: run `35103238439` (d3aa135) — success; no failing run on current `main`.

## 3. Goal review and milestone grouping

Complete before this run: Task 105 (export diagnostics remediation UX), Task 106B (minimal handoff policy + CI fix), Task 107 (track-matte source selection affordance). Roadmap items 1 and 2 are done.

Remaining roadmap items were grouped as instructed:

| Milestone | Roadmap items | Status this run |
|---|---|---|
| A — Canvas path authoring UX (tangent handles) | 3 | Implemented and validated on a branch; **not merged** (review BLOCKED) |
| B — Graph + keyboard accessibility | 4 | Not started |
| C — First export / onboarding flow | 5 | Not started |
| D — State / CI / warning hygiene | 6, 9 | Plan only (needs approval for dependency work) |
| E — OGraf QA / schema hardening study | 7, 8 | Plan only |
| F — Architecture exploration only | 10, 11, 12 | Plan only |

The grouping held up: A is genuinely separable, and B–F each keep their own gate. One correction to the grouping: item 9 (dependency/warning maintenance) must stay behind an explicit approval gate because it touches `package.json`/lockfile, so it is not a mechanical follow-up to item 6.

## 4. Milestone A — design contract

`docs/KCS_CANVAS_TANGENT_AUTHORING_CONTRACT.md` (three revisions).

- Revision 1 was reviewed by the ADVISOR/planner role and returned BLOCKED for factual and structural reasons (wrong editor camera centre, wrong rendering-authority file, `onPartPropChange` misdescribed as a canvas API, optional `BezierVertex.kind` ignored, a materialization hazard when both `path` and `points` exist, byte-parity over-claim, `worldToLocal` misused as a delta converter, an unimplementable smooth-handle rule, missing eligibility guards, pointer-ownership gaps).
- Revision 2 accepted every correction; a second review (SLOW role) confirmed most were CLOSED but returned BLOCKED on four remaining mechanics: the initializer's degenerate/open/partial policies, the cancel-rollback commit ordering versus `useHistory`'s ref sync, and a non-existent `part.closed` field.
- Revision 3 pinned all four: unit-normalized chord direction with an explicit fallback ladder, open-path endpoint rule, "zero chord never forces zero-length handles", the double-click action as the only handle creator (with mirror repair), materialization fixed to `legacyFreeformPointsToPath(normalizeClosedPoints(points), true)` (`closed: true`), and an Escape-cancel that writes the rollback first and closes the batch in a post-commit effect, with `pointercancel` committing like the existing transform drags.

Budget note: the prompt allows one review plus one re-review after BLOCKED; a third design round was not run, and the implementation review below covers the contract's promises.

## 5. Milestone A — implementation (branch `feat/canvas-tangent-authoring`, commit `c7ae7bc`)

- `src/utils/bezierPath.ts`: pure `initializeSmoothHandles(path, index)` — neighbour chord, unit direction, quarter-of-shortest-span reach, deterministic degenerate ladder, partial-smooth mirror repair, existing handles never overwritten.
- `src/utils/freeform.ts`: pure `resolveFreeformPath(part)` = `part.path ?? legacyFreeformPointsToPath(part.points, true)`.
- `src/components/Canvas/overlays/FreeformTangentOverlay.tsx`: vertex markers for the selected freeform layer (replacing the previous read-only marker block, same `data-testid`), the selected vertex's handles, handle drags through `setCharacterParts` inside `startBatchInteraction`/`endBatchInteraction`, Escape rollback, double-click corner/smooth toggle, pointer capture, all markers screen-sized through `zScale`.
- `src/components/Canvas/StageCanvas.tsx`: eligibility guards (edit mode, select tool, single selection, `custom_freeform`, no boolean ownership/operand, edit-visible, no other drag, `coordinateSpace === 'local'`, ≥2 points, trim disabled, non-zero scale) and wiring; the existing marker block was removed rather than duplicated.
- Tests: `src/tests/bezierTangentHandles.test.ts` (7) and `src/tests/freeformTangentOverlay.test.tsx` (6).

## 6. Validation at the stop point

| Check | Command | Result |
|---|---|---|
| Focused tests | `npx vitest run src/tests/bezierTangentHandles.test.ts src/tests/freeformTangentOverlay.test.tsx src/tests/bezierPath.test.ts` | PASS — 3 files / 18 tests |
| Full Vitest | `npm test` | PASS — 105 files / 1,588 tests |
| OGraf fixture | `npm run validate:ograf` | PASS |
| Release gate | `npm run qa:release` | PASS — 2 Chromium tests |
| Production build | `npm run build` | PASS — existing Vite chunk-size warning only |
| TypeScript | `npx tsc --noEmit` | PASS |
| Lint | `npm run lint` | PASS — existing `AnimatorContext` Fast Refresh warning only |
| Whitespace | `git diff --check` | PASS |

`main` was not modified by this milestone: the branch is committed but unmerged, so `main`, the tag, the draft release, and CI are exactly as they were at preflight.

## 7. Independent review — BLOCKED

One independent merge-gate review ran on `d3aa135..c7ae7bc`. Verdict: **BLOCKED**, with these required items before merge:

1. **HIGH — verification matrix incomplete.** The contract requires coordinate parity at the real `EDITOR_CAMERA_CENTER` with rotation, non-uniform, and negative scale; behavior tests for every `StageCanvas` eligibility guard; canonical-path priority; real `useHistory` undo/redo/cancel entry counts; serialization/import and OGraf byte-parity; and a manual editor smoke. The branch has focused unit/component tests only, and one test name ("leaves other vertices identical") over-claims what it asserts.
2. **MEDIUM — legacy normalization missing.** `resolveFreeformPath` uses raw `part.points`; the contract pins `normalizeClosedPoints(points)`, so a legacy layer whose closing vertex repeats the first vertex would show an extra marker and materialize a duplicate vertex into the canonical path.
3. **MEDIUM — §7 selection model incomplete.** No separate handle-selection authority, no empty-canvas "clear overlay selection only" behavior, and the overlay does not reset its `selectedIndex` when the selected layer changes.
4. **MEDIUM — Escape lifecycle.** The listener is installed for the overlay's lifetime instead of only during a drag; a pointerdown-then-Escape with no move can leave the batch open until the global `mouseup`.
5. Also named: a plausible bug where dragging a smooth handle exactly onto its anchor collapses the counterpart's length (`Math.hypot(...) || 1`).

Reviewer conclusion: merge is blocked until those are closed; the reviewer explicitly confirmed the reused authorities, the coordinate/delta rule, the initializer, the pointer-ownership order, and that no parallel engine or protected-authority change was introduced.

## 8. Stop rationale

The orchestrator policy allows fixing in scope and running one more focused review, but also requires stopping when a milestone turns broad. Here the remaining work is a coherent batch (two small code fixes, selection/lifecycle behaviour, and a real verification matrix including history and export parity) that is larger than the increment itself. Stopping keeps `main` green and unchanged, leaves the design contract and the implementation available for the next session, and avoids merging an unverified increment. No package, workflow, dependency, or release change was made, and `chatgpt_handoff/latest/` was not given source or test copies.

## 9. Protected invariants

- Tag `v1.1.0-rc.1` target unchanged; draft release not published/finalized; no npm publish; no branch deleted.
- `main` untouched (`d3aa135…`); CI on `main` green.
- No new matte/rendering/evaluation/timing/package/state engine; `ShapePartRenderers`, `evaluateFrame`, `StagePartLayers`, matte authority, `bounds.ts`, and `src/ograf/**` untouched.
- `without-mask`, global OMP configuration (model roles, provider mappings, `memory.backend: mnemopi`, `task.maxConcurrency: 8`) untouched.
- `C:\Users\ertugrul.ak\Desktop\KCS` and `C:\Users\ertugrul.ak\Desktop\ograf-graphics` untouched; no secrets handled.

## 10. Next recommended action

Finish Milestone A on the existing branch by closing the review's five items, then run one focused re-review and merge by fast-forward. `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` records the milestone plan, the approval gates, and the recommended next prompt.
