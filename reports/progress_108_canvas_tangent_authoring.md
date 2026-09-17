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

One independent merge-gate review ran on `d3aa135..c7ae7bc`. Verdict: **BLOCKED**, with these required items before merge. **Update (blocker-closing pass, §11): all five items were closed; see §11 for the evidence per item.**

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

## 11. Blocker-closing pass (this session)

### Branch

- Branch: `feat/canvas-tangent-authoring`
- Milestone A feature commit: `c7ae7bc` — `feat: add direct canvas tangent handle authoring`
- Blocker-fix commit: `fix: close canvas tangent authoring review blockers` (this pass)
- Baseline `main` at branch point: `d3aa135`
- Current `main` / `origin/main`: `312a0d771123b2b64f9b6f5779f873b439eedab5`
- Ancestry: `main` and the branch **diverged** (main advanced with four docs/handoff commits after `d3aa135`), so a fast-forward merge is not possible in either direction. No rebase, no merge commit, no force push was performed.

### Blocker status

| # | Review finding | Status | Evidence |
|---|---|---|---|
| 1 | HIGH — verification matrix incomplete (coordinate parity, guard matrix, canonical-path priority, real history, serialization/import, OGraf parity, manual smoke) | **CLOSED** | §Verification matrix below; new `freeformTangentEligibility.test.ts` (23), `freeformTangentPersistence.test.ts` (6), `freeformTangentHistory.test.tsx` (3), overlay suite grown to 19; guarded render condition extracted to `src/utils/freeformTangentEligibility.ts` |
| 2 | MEDIUM — legacy points normalization missing in `resolveFreeformPath` | **CLOSED** | `src/utils/freeform.ts`: `part.path ?? legacyFreeformPointsToPath(normalizeClosedPoints(part.points ?? []), true)`; tests cover repeated closing vertex, `<2` points → `undefined`, canonical-path priority, no mutation of `part.points` |
| 3 | MEDIUM — §7 selection model incomplete | **CLOSED** | overlay holds `selectedIndex` + `selectedHandle` + an in-flight drag flag; clicking a vertex clears the handle selection, clicking a handle selects it (rendered highlighted via `data-selected`); switching layer or losing the selected vertex resets the overlay selection; empty-canvas behaviour documented (see Deviations) |
| 4 | MEDIUM — Escape lifecycle / batch close | **CLOSED** | `Escape` listener is installed **only** while a drag is in flight and removed when it ends; the batch is closed by a state-driven post-commit effect (`pendingCancel`), so a `pointerdown` with no `pointermove` still closes the batch |
| 5 | MEDIUM — smooth-handle-at-anchor collapse (`Math.hypot(...) || 1`) | **CLOSED** | Drag: a vector `<= 1e-6` keeps the counterpart's own length/direction, a non-finite pointer result is dropped, a non-finite (overflowing) dragged length leaves the counterpart untouched, and a non-finite mirror leaves the counterpart untouched. Smooth toggle: the §8 initializer computes finite handles only — non-finite mirror → direction-and-reach handle; non-finite fallback → degenerate onto the vertex; overflowing span → zero reach; overflowing chord → `{x: 1, y: 0}`. Exact scope: **the writers refuse non-finite output**; an existing handle (including one from an unsanitized legacy import) is passed through, and the arithmetic is not claimed to be overflow-free. Tests: `1.7e308` counterpart, `1.7e308` dragged vector, `1e308` mirror overflow (selected vertex = the huge one), overflowing chord with a reach that cannot be represented. |

### Verification matrix

### A. Coordinate parity (real origin, real transform)

Overlay suite `FreeformTangentOverlay coordinate mapping`, `outputOrigin = EDITOR_CAMERA_CENTER` (the production constant), one row per transform: identity, rotation-only, non-uniform scale, negative `scaleX`, and rotation + non-uniform + negative scale + offset.

For each row the test drags the out-handle through the stage pointer mapper by a screen delta and requires the handle's world position to move by exactly that delta (± 1e-6 local / < 2 px in the browser run). The delta is produced by the implementation's separate inverse-mapping of the *start* and *current* pointer points (`worldToLocal` on each, difference of the two locals), so a raw world delta reaching `worldToLocal` would fail this row.

### B. Eligibility guard matrix

`src/tests/freeformTangentEligibility.test.ts` — 23 tests. One positive case, one legacy-points-only positive case, two negative-control positives (unrelated hidden track, negative/non-uniform scale), and 18 guard rows, each asserting the predicate is `false`:

broadcast mode · non-select tool · active stage drag · empty selection · multi-selection · missing selected part · non-freeform type · boolean owner · boolean operands · boolean operand child · edit-hidden track · trim enabled · missing evaluated transform · `scaleX === 0` · `scaleY === 0` · normalized-space path · single-vertex path · fewer than two legacy points.

Plus canonical priority (path present while legacy points are unusable → eligible) and the inverse case.

The guard list is no longer inline JSX: `StageCanvas` calls `isFreeformTangentOverlayEligible({...})`, so the matrix and the runtime condition are the same code.

### C. Canonical-path priority

- Unit: `resolveFreeformPath` returns the *same object* when `part.path` exists, and `buildBezierPathD(resolved) === buildBezierPathD(part.path)` even when legacy `points` disagree.
- Component: with `path` and differing legacy `points` the overlay renders exactly the path's 3 markers at the path's anchors (legacy points would produce 4 different anchors).
- Clone-on-write: the untouched-vertex test reads the neighbouring smooth vertex's handles after a drag and requires `26/0` and `14/0` — its own values — while the dragged vertex's handle holds the pointer value.

### D. Real history

`src/tests/freeformTangentHistory.test.tsx` wires the overlay to the real `useHistory` (same `startBatchInteraction` / `endBatchInteraction` wiring `StageCanvas` uses):

| Action | Expected | Result |
|---|---|---|
| completed drag | exactly one undo entry; undo restores the previous handle; redo reapplies | PASS |
| drag then `Escape` | path restored, **no** entry added (one undo returns to the pre-drag state, then `canUndo === false`) | PASS |
| `pointerdown` then `Escape`, no move | batch closed, no entry (`canUndo === false`), path unchanged | PASS |
| `pointercancel` after a move | last value committed, one entry, undo restores | PASS |

### E. Serialization / import

`src/tests/freeformTangentPersistence.test.ts`:

- A points-only layer materializes a `local`, closed path whose anchors are exactly the normalized legacy polygon and whose `d` equals the normalized `legacyFreeformPointsToPath` output.
- The materialized path (after `initializeSmoothHandles`) survives `JSON` round-trip **and** the import sanitizer `normalizeBezierPath(..., 'local')` unchanged (`toEqual` + identical `d`).
- `part.points` identity and the whole part object are unchanged by resolution (no hidden rebuild while a canonical path exists).
- **Real serializer round-trip (added after the first review round):** `src/tests/useSerialization.test.ts` → `Milestone A: a materialized freeform path survives export → import with its handles and legacy points` runs the real authority (`exportProject()` → `importProject()`), then asserts the restored part keeps the canonical path (`toEqual` of the whole path, `handleOut`, `kind: 'smooth'`, identical `d`) **and** the legacy `points` array next to it.

### F. OGraf / SVG byte parity

- No file under `src/ograf/`, `ShapePartRenderers.tsx`, `StagePartLayers.tsx`, `bounds.ts`, `evaluateFrame`, or the matte authority is modified by this pass.
- For a **canonical** freeform path, `resolveFreeformPath` returns the identical object, so every render authority that reads `content.path` emits the identical `d` before and after this milestone. What the tests assert is exactly this: object identity plus `buildBezierPathD(resolveFreeformPath(part)) === buildBezierPathD(part.path)` in `freeformTangentPersistence.test.ts`. The renderers themselves are **not** called by that test — OGraf's canonical-path output is pinned by the existing, unchanged `src/tests/ografSvg.test.ts` (`d` for a canonical freeform layer), and Canvas/matte resolution is unchanged code, so the parity argument is structural rather than a new byte-diff assertion.
- `npm run validate:ograf` PASS and the OGraf suite in the full run PASS.
- Not claimed: byte parity for an *edited* handle (edits legitimately change geometry) and for a points-only layer **after** its first edit (documented deviation below).

### G. Manual editor smoke (real Chromium, real app)

Throwaway Playwright spec (deleted after the run) seeded a scene with a canonical-path freeform layer plus a rect layer, then asserted against the live DOM:

| Step | Result |
|---|---|
| no selection → overlay absent; select layer → overlay present with 3 markers | PASS |
| click a vertex → its two handles appear | PASS |
| drag the out-handle 90/−60 px → rendered `d` changes and the handle follows the pointer within 2 px | PASS |
| `Ctrl+Z` → `d` restored byte-for-byte; `Ctrl+Shift+Z` → `d` reapplied | PASS |
| drag then `Escape` → `d` restored; the following `Ctrl+Z` steps over the *previous* action (no entry for the cancelled drag) | PASS |
| switching the selected layer away → overlay removed, back → re-rendered | PASS |

The smoke is now a **permanent, re-runnable spec** instead of a throwaway one: `e2e/canvas-tangent-authoring.spec.ts` (seeds the scene through the autosave key, asserts the same table above, writes `test-results/tangent-authoring-handles.png` and `test-results/tangent-authoring-eligibility.png`). `test-results/` is not tracked, so the screenshots are regenerated by running the spec; the spec itself is the auditable artefact. It is not part of CI or the release gate (neither runs this file).

Existing interaction e2e specs re-run on the branch for the "not obviously broken" part of the requirement: `canvas-interaction-v1.spec.ts` (gizmo corner resize, cursor-anchored zoom, marquee selection), `interactive-shape-creation-v1.spec.ts` (shape tools incl. Escape cancel), `editor-interaction-regressions.spec.ts` (mirror duplicate keeps the selection gizmo aligned) — **9 passed**.

Note recorded during the smoke: a `custom_freeform` layer intentionally renders no transform gizmo (`SelectionGizmo` skips `TransformGizmo` for freeform parts), so the gizmo check uses the rect layer. This is pre-existing behaviour, unchanged here.

### Changed files

| File | Change |
|---|---|
| `src/utils/freeformTangentEligibility.ts` | **new** — pure eligibility predicate (single guard authority) |
| `src/utils/freeform.ts` | `resolveFreeformPath` normalizes legacy points |
| `src/components/Canvas/StageCanvas.tsx` | inline guard chain replaced by the helper call; unused import removed |
| `src/components/Canvas/overlays/FreeformTangentOverlay.tsx` | selection model (vertex + handle state, layer/topology reset), state-driven Escape/batch close, drag-scoped key listener, zero-length handle guard, `data-selected` marker on the handle hit target |
| `src/tests/freeformTangentEligibility.test.ts` | **new** — 23 guard/priority tests |
| `src/tests/freeformTangentPersistence.test.ts` | **new** — 6 normalization/materialization/parity tests |
| `src/tests/freeformTangentHistory.test.tsx` | **new** — 3 real-`useHistory` tests |
| `src/tests/freeformTangentOverlay.test.tsx` | rewritten — 19 tests (coordinate matrix, selection model, Escape/pointercancel, smooth-at-anchor, canonical priority) |
| `docs/KCS_CANVAS_TANGENT_AUTHORING_CONTRACT.md` | §4/§5/§7/§9/§10/§12 clarified where the implementation forced wording |
| `reports/progress_108_canvas_tangent_authoring.md` | this report |

Removed claim: the previous test name "leaves other vertices identical" asserted only the dragged vertex in one direction; the test was renamed and now reads the neighbouring smooth vertex's `handleOut`/`handleIn` after the drag.

### Validation

| Command | Result |
|---|---|
| `npx vitest run` on the tangent/path suites + `useSerialization` | 162 passed (19 files) |
| Focused per-file counts | eligibility 23 · persistence 6 · overlay 21 · history 3 · initializer 10 · bezierPath 5 · useSerialization 95 |
| `npm test` (full suite) | 108 files / 1639 tests passed |
| `npm run validate:ograf` | PASS (`fixtures/ograf/minimal.ograf.json` valid) |
| `npm run qa:release` | PASS — release gate 2/2, candidate SHA resolved from HEAD |
| `npm run build` | PASS (`tsc -b && vite build`) |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (one pre-existing `react-refresh` warning in `AnimatorContext.tsx`) |
| `git diff --check` | clean |
| `npx playwright test e2e/canvas-tangent-authoring.spec.ts` | PASS — permanent real-browser smoke (1 test) |

### Deviations and limits (disclosed, not hidden)

1. **Empty-canvas click.** The contract §7 wording said an empty-canvas click must clear only the overlay-local selection. The stage already clears the *app* layer selection on an empty-canvas pointer-down — existing behaviour that this milestone must not change — and that necessarily unmounts the overlay. The contract was corrected to state the actual, pre-existing behaviour instead of adding a second selection authority.
2. **Legacy points-only layers and the degenerate closing vertex.** `normalizeClosedPoints` drops a repeated closing vertex, so for a points-only layer that carries one, the overlay shows/edits the normalized topology while the modern canvas and OGraf render branches (`part.path ?? legacyFreeformPointsToPath(part.points)`) still draw the duplicated, zero-length closing edge (the legacy/non-modern canvas branch already normalizes: `ShapePartRenderers.tsx:345-348`). A scene imported through `src/utils/v6Migration.ts` materializes a canonical path from the raw legacy points, so such a layer never reaches the overlay's normalization step at all — pre-existing migration behaviour, outside this milestone's scope. The shapes are visually identical (the extra edge has zero length), but after the first handle edit the materialized canonical path is the normalized one, so the `d` string of that layer changes (an edited layer, so F's parity claim does not apply). Canonical-path layers are unaffected. Recorded in the contract §4.
3. **`resolveFreeformPath` with two coincident legacy points** now returns `undefined` (normalization leaves one point) instead of a degenerate 2-point path, so the overlay stays hidden. Defence, not a behaviour loss: a 2-point "polygon" was never renderable as a closed shape.
4. **Extreme coordinates are refused, not repaired.** Individually finite coordinates near the double-precision limit can overflow the mirror/normalization arithmetic. The drag writer refuses non-finite output (the counterpart keeps its value); the §8 initializer refuses it too, falling back to the direction-and-reach handle and then to a zero-length handle at the vertex. Both are pinned by tests, and both tests fail on the pre-fix code (verified by replaying the old expressions). A non-finite value that a user scene already contains is preserved as-is: the versioned SceneData import sanitizes handles, the legacy `AnimationProject` import does not, and repairing that path is outside this milestone.
5. **Merge is not ff-possible on this branch base.** See §Branch. Awaiting an explicit decision.

#### Independent review rounds

| Round | Scope | Verdict | Outcome |
|---|---|---|---|
| 1 | `d3aa135..c7ae7bc` (the original implementation) | BLOCKED | the five findings closed in this pass |
| 2 | `c7ae7bc..0114098` (this pass) | BLOCKED | blockers 2/3/4 CLOSED; two gaps remained: (a) no real `exportProject()` → `importProject()` round-trip of a materialized path — the new test in `useSerialization.test.ts` closes it; (b) `Math.hypot` overflow on individually-finite imported coordinates could still write `Infinity`/`NaN` — closed by the non-finite policy in §5 plus the `1.7e308` counterpart test. Six documentation over-claims were also corrected (round-trip wording, renderer-parity wording, the NaN/Infinity claim, the initializer reach claim, screenshot paths now replaced by a permanent spec, and the points-only render generalization). |
| 3 | `0114098..eb1f1a1` (fix commits) | BLOCKED | blocker 1 CLOSED (real `exportProject()` → `importProject()` round-trip); blocker 5 still OPEN, with two extreme-coordinate paths named: the §8 initializer could store an overflowing mirror, and a dragged vector whose `hypot` overflows collapsed the counterpart onto the anchor (both finite-input arithmetic, not regressions of this milestone). Both are now guarded and covered by tests, and the five remaining documentation over-claims were rewritten to their exact scope. |
| 4 | `71e4290` / `469c070` (extreme-coordinate fixes) | BLOCKED | the drag side CLOSED; the initializer guard was incomplete — the *final* direction-and-reach fallback was still unvalidated, and one newly added test selected the wrong vertex so it passed on the pre-fix code. Both are fixed: the initializer now walks mirror → direction-and-reach → degenerate-onto-vertex, and the two regression tests were corrected/added and verified to fail pre-fix. |
| 5 | the final initializer fixes | focused, in progress | — |

Self-found hardening during round 2: the unmount cleanup that closes an open batch was bound to `onBatchEnd`'s identity, so a re-created callback during a drag could have closed the batch early and split one drag into several history entries. It now reads the latest callback through a ref and is bound to unmount only.

## Merge status

**NOT MERGED.** The branch is committed and fully validated, but `main` advanced with docs-only commits after the branch point, so `git merge --ff-only` cannot be used in either direction. Per the task's protected rules (no rebase, no merge commit, no force push) the merge was stopped and reported for an approval decision.
