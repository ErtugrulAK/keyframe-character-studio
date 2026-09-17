# Progress 108 — Canvas Tangent Authoring (Milestone A) — Review Blockers Closed

## Scope

Roadmap item 3 (Milestone A of `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`): direct Bezier tangent-handle authoring on the stage canvas for the selected freeform layer, on top of the existing path model, renderer, transform authority, write path, and history batching.

This report records the blocker-closing pass after the independent review of the first implementation returned **BLOCKED** (5 findings).

Out of scope (unchanged): new path/selection/state engine, evaluator or renderer changes, OGraf package format, boolean-path editing, trim-path authoring, vertex add/remove on canvas, keyboard nudging, multi-vertex transforms.

## Branch

- Branch: `feat/canvas-tangent-authoring`
- Milestone A feature commit: `c7ae7bc` — `feat: add direct canvas tangent handle authoring`
- Blocker-fix commit: `fix: close canvas tangent authoring review blockers` (this pass)
- Baseline `main` at branch point: `d3aa135`
- Current `main` / `origin/main`: `312a0d771123b2b64f9b6f5779f873b439eedab5`
- Ancestry: `main` and the branch **diverged** (main advanced with four docs/handoff commits after `d3aa135`), so a fast-forward merge is not possible in either direction. No rebase, no merge commit, no force push was performed.

## Blocker status

| # | Review finding | Status | Evidence |
|---|---|---|---|
| 1 | HIGH — verification matrix incomplete (coordinate parity, guard matrix, canonical-path priority, real history, serialization/import, OGraf parity, manual smoke) | **CLOSED** | §Verification matrix below; new `freeformTangentEligibility.test.ts` (23), `freeformTangentPersistence.test.ts` (6), `freeformTangentHistory.test.tsx` (3), overlay suite grown to 19; guarded render condition extracted to `src/utils/freeformTangentEligibility.ts` |
| 2 | MEDIUM — legacy points normalization missing in `resolveFreeformPath` | **CLOSED** | `src/utils/freeform.ts`: `part.path ?? legacyFreeformPointsToPath(normalizeClosedPoints(part.points ?? []), true)`; tests cover repeated closing vertex, `<2` points → `undefined`, canonical-path priority, no mutation of `part.points` |
| 3 | MEDIUM — §7 selection model incomplete | **CLOSED** | overlay holds `selectedIndex` + `selectedHandle` + an in-flight drag flag; clicking a vertex clears the handle selection, clicking a handle selects it (rendered highlighted via `data-selected`); switching layer or losing the selected vertex resets the overlay selection; empty-canvas behaviour documented (see Deviations) |
| 4 | MEDIUM — Escape lifecycle / batch close | **CLOSED** | `Escape` listener is installed **only** while a drag is in flight and removed when it ends; the batch is closed by a state-driven post-commit effect (`pendingCancel`), so a `pointerdown` with no `pointermove` still closes the batch |
| 5 | MEDIUM — smooth-handle-at-anchor collapse (`Math.hypot(...) || 1`) | **CLOSED** | `withMovedHandle` treats a dragged vector `<= 1e-6` as zero-direction and keeps the counterpart at its own length/direction instead of mirroring a fabricated unit vector; NaN/Infinity no longer reachable |

## Verification matrix

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

Export/import of the `path` field itself is unchanged by this milestone and already covered by `src/tests/useSerialization.test.ts` (`path: { ... }` local-path fixtures at the export and import assertions).

### F. OGraf / SVG byte parity

- No file under `src/ograf/`, `ShapePartRenderers.tsx`, `StagePartLayers.tsx`, `bounds.ts`, `evaluateFrame`, or the matte authority is modified by this pass.
- For a **canonical** freeform path, `resolveFreeformPath` returns the identical object, so every render authority that reads `content.path` emits the identical `d` before and after this milestone (asserted in `freeformTangentPersistence.test.ts`).
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

Screenshots: `test-results/tangent-smoke-handles.png`, `test-results/tangent-smoke-after-marquee.png`.

Existing interaction e2e specs re-run on the branch for the "not obviously broken" part of the requirement: `canvas-interaction-v1.spec.ts` (gizmo corner resize, cursor-anchored zoom, marquee selection), `interactive-shape-creation-v1.spec.ts` (shape tools incl. Escape cancel), `editor-interaction-regressions.spec.ts` (mirror duplicate keeps the selection gizmo aligned) — **9 passed**.

Note recorded during the smoke: a `custom_freeform` layer intentionally renders no transform gizmo (`SelectionGizmo` skips `TransformGizmo` for freeform parts), so the gizmo check uses the rect layer. This is pre-existing behaviour, unchanged here.

## Changed files

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

## Validation

| Command | Result |
|---|---|
| `npx vitest run` on the six tangent/path suites | 63 passed (6 files) |
| `npm test` (full suite) | 108 files / 1633 tests passed |
| `npm run validate:ograf` | PASS (`fixtures/ograf/minimal.ograf.json` valid) |
| `npm run qa:release` | PASS — release gate 2/2, candidate SHA resolved from HEAD |
| `npm run build` | PASS (`tsc -b && vite build`) |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (one pre-existing `react-refresh` warning in `AnimatorContext.tsx`) |
| `git diff --check` | clean |

## Deviations and limits (disclosed, not hidden)

1. **Empty-canvas click.** The contract §7 wording said an empty-canvas click must clear only the overlay-local selection. The stage already clears the *app* layer selection on an empty-canvas pointer-down — existing behaviour that this milestone must not change — and that necessarily unmounts the overlay. The contract was corrected to state the actual, pre-existing behaviour instead of adding a second selection authority.
2. **Legacy points-only layers and the degenerate closing vertex.** `normalizeClosedPoints` drops a repeated closing vertex, so for a points-only layer that carries one, the overlay shows/edits the normalized topology while the canvas/OGraf render branch (`part.path ?? legacyFreeformPointsToPath(part.points)`) still draws the duplicated, zero-length closing edge. The shapes are visually identical (the extra edge has zero length), but after the first handle edit the materialized canonical path is the normalized one, so the `d` string of that layer changes (an edited layer, so F's parity claim does not apply). Canonical-path layers are unaffected. Recorded in the contract §4.
3. **`resolveFreeformPath` with two coincident legacy points** now returns `undefined` (normalization leaves one point) instead of a degenerate 2-point path, so the overlay stays hidden. Defence, not a behaviour loss: a 2-point "polygon" was never renderable as a closed shape.
4. **Merge is not ff-possible on this branch base.** See §Branch. Awaiting an explicit decision.

## Merge status

**NOT MERGED.** The branch is committed and fully validated, but `main` advanced with docs-only commits after the branch point, so `git merge --ff-only` cannot be used in either direction. Per the task's protected rules (no rebase, no merge commit, no force push) the merge was stopped and reported for an approval decision.
