# KCS Canvas Tangent Authoring — Design Contract

Milestone A of the grouped roadmap execution (roadmap item 3).

Revision 2 — incorporates the ADVISOR design review: corrected coordinate authority, added clone-on-write and eligibility invariants, removed keyboard nudging from the increment, and pinned the smooth-handle initializer policy.

## 1. Purpose

Let the user edit Bezier tangent handles **directly on the stage canvas** for the selected freeform layer, so path authoring no longer depends on an inspector path that does not exist for freeform layers.

This is an authoring affordance over the existing path data: not a new vector editor, not a new geometry engine, and not a change to evaluation, rendering, serialization, or export.

## 2. Existing authorities reused

| Concern | Authority | Reused for |
|---|---|---|
| Path model | `src/types/animator.ts` — `BezierPath`, `BezierVertex { id, x, y, handleIn?, handleOut?, kind? }`, `PathHandle`, `PathCoordinateSpace`, `PathVertexKind` | the only path representation. `kind` is optional, so imported data may carry no kind at all |
| Path helpers | `src/utils/bezierPath.ts` — `createBezierPath`, `legacyFreeformPointsToPath`, `normalizeBezierPath`, `buildBezierPathD`, `sampleBezierPath`, `areBezierPathsTopologyCompatible` | materializing a path, geometry strings, topology guards |
| Freeform helpers | `src/utils/freeform.ts` — `getFreeformVertexWorldPositions`, `normalizeClosedPoints`, `MIN_FREEFORM_POINTS` | local → world mapping of vertices |
| Inverse transform | `src/utils/matte.ts` — `worldToLocal(point, world, outputOrigin)` | world → part-local mapping during a drag |
| Stage transform | `getComputedTransform(partId, frame)` from the animator context (evaluated **world** transform, parent chain composed) | the transform the renderer uses at the current frame |
| Canvas write path | the animator context's `setCharacterParts` (the canvas has no `onPartPropChange`; that closure is private to `DetailsPanel`) | every path write |
| Undo batching | `startBatchInteraction` / `endBatchInteraction` from `useHistory` via the context | one history entry per drag |
| Freeform rendering | `src/components/Canvas/renderers/parts/ShapePartRenderers.tsx` freeform branch (`part.path ?? legacyFreeformPointsToPath(part.points)`) | unchanged |
| Existing canvas markers | `src/components/Canvas/StageCanvas.tsx` freeform vertex marker block (`getFreeformVertexWorldPositions` + `data-testid="freeform-vertex-marker"`) | replaced by this overlay, same test id and visual language |
| Mask path editor | `src/components/Inspector/BezierPathEditor.tsx` — used only for layer-mask paths via `StyleMatteSection` | unchanged; it is not a freeform `part.path` editor |

No new path model, no second selection authority, no package/runtime change.

## 3. Coordinate spaces

- **Part-local** (`path.points[i].x/y`, `handleIn`, `handleOut`): centre-relative, Y-down, exactly what `buildBezierPathD` consumes. Handles are **absolute local coordinates**, not offsets.
- **World / stage**: editor space whose origin is `EDITOR_CAMERA_CENTER` (`EDITOR_CAMERA_VIEWBOX` is 600×480, so the centre is (300, 240)). The constant is always used; no literal centre may appear in the implementation.
- **Client / container**: `clientToSVG` in `StageCanvas` converts pointer coordinates to world coordinates.

Rules:

- The overlay receives already-evaluated world data (transform at the current frame) and the same `outputOrigin` used by the stage.
- **Delta rule:** `worldToLocal` is a point converter, not a delta converter — it subtracts `outputOrigin + transform.x/y`. A drag therefore inverse-maps the *start* world point and the *current* world point separately and uses the difference of the two local results; a raw world delta is never passed to it.
- A zero `scaleX` or `scaleY` makes the layer degenerate and invisible; the overlay is inert in that case (no markers, no handles).

## 4. Path representation, materialization, and byte expectations

- The overlay edits the **effective path**: `part.path ?? legacyFreeformPointsToPath(normalizeClosedPoints(part.points ?? []), true)`.
- **Legacy normalization.** For a points-only layer the legacy array is normalized before conversion, so a repeated closing vertex (within `1e-6`) becomes a single vertex instead of a degenerate one. If normalization leaves fewer than two points the effective path is `undefined` and the overlay stays hidden. The render branches are **not** changed by this milestone: the modern canvas branch (`ShapePartRenderers.tsx`) and the OGraf branch still draw `part.path ?? legacyFreeformPointsToPath(part.points)` / `buildFreeformPath(part.points)` without normalization, while the non-modern canvas branch already normalizes. A points-only layer that carries a duplicate closing vertex is therefore drawn with a zero-length closing edge by the former while the overlay edits the normalized topology. The two shapes are visually identical; after the first handle edit the layer has a canonical (normalized) path, so its `d` string changes once. Canonical-path layers are unaffected and byte-identical.
- **Clone-on-write invariant:** if `part.path` exists, every write clones that path and changes only the dragged handle. Legacy `points` are never rebuilt into `path` while a canonical path exists — doing so with raw legacy points would discard curves and produce a visible geometry jump and export change.
- **Materialization** happens only when `part.path === undefined`: the first handle edit materializes the canonical path from `legacyFreeformPointsToPath(normalizeClosedPoints(part.points), true)` — that helper always yields `coordinateSpace: 'local'` and `closed: true`, which is exactly what the renderer already draws today. `CharacterPart` has no `closed` field of its own; an existing canonical path keeps its own `closed` and `coordinateSpace` values untouched. `part.points` is preserved unchanged.
- **Data expectations:** after the first write the scene JSON gains a `path` field and the rendered SVG/OGraf output legitimately changes when handles change. Byte-identical output is only claimed for layers whose canonical path is left untouched.
- Topology (point count and ids) is never changed by a handle drag.

## 5. Handle semantics

- A handle drag writes the dragged handle; on a `smooth` vertex it also writes the mirrored counterpart (next bullet). For a `corner` vertex only the dragged handle changes. The vertex position and the vertex `id` are never touched by a handle drag.
- `smooth` vertices keep mirrored handles: dragging one handle mirrors the other around the vertex with the opposite direction and the other handle's existing length.
- **Zero-length drag vector.** If the dragged handle sits on its anchor (vector length `<= 1e-6`) it carries no direction, so the counterpart is left **unchanged** rather than mirrored from a fabricated unit vector; the dragged handle is still written.
- **Extreme-coordinate policy.** Each writer refuses non-finite output instead of storing it: a non-finite pointer result is dropped; a dragged vector whose `Math.hypot` length is not finite leaves the counterpart untouched (its normalized direction would be unusable); a mirror result that is not finite (reachable from individually finite coordinates that overflow the arithmetic, e.g. a counterpart at `±1.7e308`) leaves the counterpart at its previous value. The §8 initializer applies the same rule, as a ladder: a non-finite mirror is replaced by the direction-and-reach handle, a non-finite fallback handle degenerates onto the vertex, an overflowing span falls back to the documented zero reach, and an overflowing chord falls back to the documented `{x: 1, y: 0}` direction. The guarantee carried here is **the writers refuse non-finite output**: the drag and the smooth toggle never introduce a non-finite value — and it is not claimed that the arithmetic cannot overflow, nor that a value already present in imported data is repaired (the versioned SceneData import sanitizes handles, the legacy `AnimationProject` import does not, and an existing handle is passed through untouched).
- `corner` vertices (and vertices whose `kind` is absent, treated as `corner`) move only the dragged handle.
- A handle is never created implicitly by a drag; creation is the explicit smooth action in §7.

## 6. Point topology

- Supported: `corner` (independent handles) and `smooth` (mirrored direction).
- Not supported in this milestone: asymmetric handles as a third kind, handle-length locking, per-handle angle constraints, vertex add/remove on the canvas, multi-vertex transforms, path boolean work. Vertex add/remove/reorder stays in the mask-path editor and the numeric vertex editor.

## 7. Eligibility and selection model

The overlay renders only when **all** of these hold:

- edit mode (`appMode !== 'broadcast'`);
- the select tool is active (`activeTool === 'select'`);
- exactly one part is selected (`selectedPartIds.length === 1`);
- that part is `custom_freeform`;
- it is not a boolean group owner (`booleanOperation` absent) and has no `booleanOperandIds`;
- it is not a boolean operand child (`booleanGroupId` absent) — editing the owner does not change the rendered boolean geometry, so the case is excluded rather than half-supported;
- the layer is edit-visible (`track.editVisible !== false`);
- no other canvas drag is in progress (`isDragging === false` in `StageCanvas`);
- the effective path exists, has at least two points, and `coordinateSpace === 'local'`;
- `trimPathEnabled !== true` (trim length is computed from legacy `points`, so a curve-edited path would render a mismatched trim);
- `scaleX` and `scaleY` are non-zero.

This list lives in one pure predicate, `isFreeformTangentOverlayEligible` (`src/utils/freeformTangentEligibility.ts`). `StageCanvas` forwards its existing state into that helper and renders the overlay on the result; the guard matrix is unit-tested row by row, so the runtime condition and the tests cannot drift apart.

Normal `parentId` children are supported, because `getComputedTransform` already composes the parent chain.

Selection state is overlay-local: `selectedIndex: number | null` and `selectedHandle: 'in' | 'out' | null`.

- Vertex markers are always drawn for an eligible layer; handles (and their lines to the vertex) are drawn only for the selected vertex, with the selected handle rendered in the highlight colour and exposed as `data-selected`.
- Clicking a vertex selects that vertex and clears the handle selection. Clicking a handle selects the handle (and the vertex it belongs to).
- **Empty canvas:** the stage's own pointer-down on empty canvas clears the app layer selection, exactly as before this milestone. That unmounts the overlay, so the overlay needs no separate empty-canvas handler and does **not** deselect the layer by itself. The overlay drops its own selection when the shown part changes (another layer selected) or when the selected vertex index no longer exists after a topology change.
- Double-clicking a vertex toggles `corner ↔ smooth`. Switching to `smooth` materializes missing handles through the deterministic initializer in §8; switching to `corner` keeps existing handle positions and only changes `kind`.
- Multi-vertex selection is out of scope.

## 8. Smooth-handle initializer

`createBezierPath` produces corner vertices without handles, so a neighbour-based initializer is required. It is a small **pure** helper added to the canonical `src/utils/bezierPath.ts` and unit-tested there. Exact algorithm for vertex `index` of `path`:

1. **Neighbours.** `previous` = `points[index - 1]`, or `points[n - 1]` when `index === 0 && path.closed`. `next` = `points[index + 1]`, or `points[0]` when `index === n - 1 && path.closed`. For an open path the endpoints therefore have only one neighbour.
2. **Direction.** With `ε = 1e-6`, and a unit vector whenever the chosen chord is finite and non-overflowing:
   - if both neighbours exist and `|next - previous| > ε` → `unit(next - previous)`;
   - else if `next` exists and `|next - v| > ε` → `unit(next - v)`;
   - else if `previous` exists and `|v - previous| > ε` → `unit(v - previous)`;
   - else → `{ x: 1, y: 0 }`.
   A zero chord never produces a zero-length handle on its own; it only selects the next rule in this list. The direction is normalized before it is scaled, so handle length is never multiplied by an unnormalized chord.
3. **Reach.** `reach = 0.25 × min` of the distances that exist (`|v - previous|` and/or `|v - next|`); the `ε` of step 2 only *selects* the direction rule, it does not clamp the reach. Exactly coincident neighbours therefore give `reach = 0` and coincident zero-length handles (the case `src/tests/bezierTangentHandles.test.ts` pins), while a very short span such as `5e-7` still yields its own small non-zero reach. An overflowing span is not representable, so `reach` falls back to `0`.
4. **Handles.** `handleIn = v − direction × reach`, `handleOut = v + direction × reach` — mirrored, opposite directions, equal length.
5. **Non-finite refusal.** Every handle the initializer *computes* is finite: a mirror that is not finite is dropped in favour of the step 1–4 handle, and when even that handle overflows the coordinate magnitude it degenerates onto the vertex (zero reach). A handle that already exists on the vertex is passed through untouched — including one that arrived non-finite from an unsanitized legacy import (§5).
6. **Partial-smooth repair.** The **double-click smooth action** is the only writer that creates handles, and it is what repairs a `smooth` vertex that has only one handle: it keeps the existing handle exactly where it is and sets the missing counterpart to the exact mirror of the existing one around the vertex (same length, opposite direction). When both handles already exist, they are left untouched; when neither exists, both come from steps 1–4. A handle drag never creates handles (§5).

## 9. Hit testing, rendering order, and event ownership

- Markers are sized in screen units through the existing pattern: radius `7 * zScale` like today's markers, with a larger grab radius (`~9 * zScale`). `zScale` is the same value passed to `SelectionGizmo`.
- The overlay group renders **after** the artboard/border layers and **above** the transform gizmo so handles win the pointer over the gizmo's and the matte hit area's transparent regions. Pointer handlers stop propagation so a handle drag never starts a translate/rotate/scale/marquee interaction.
- Pointer capture is taken on `pointerdown` and released on `pointerup`/`pointercancel`, so a drag that leaves the marker keeps tracking and ends deterministically.
- The overlay owns no global keyboard shortcut. Its `keydown` listener for `Escape` is registered in an effect that runs **only while a drag is in flight** and is removed as soon as the drag ends (commit or cancel), so an idle overlay never consumes `Escape` and the stage's own `Escape` handling is untouched. `v1` has **no** arrow-key nudging.

## 10. Drag lifecycle and undo

- `pointerdown` on a handle: `startBatchInteraction()`, remember the initial path and the local start point in a ref, enter drag mode.
- `pointermove`: compute the local delta per §3 from the initial path, write the new path through `setCharacterParts` (each live move updates only the selected part's `path`).
- `pointerup`: `endBatchInteraction()`. `pointercancel` behaves the same way — the drag commits its last written value, exactly like `StageCanvas.handlePointerCancel` already does for the transform drags.
- **Escape during an active drag** is the only rollback path, and it is ordered so that history cannot capture a mid-drag snapshot: clear the drag ref, leave drag mode, set the `pendingCancel` **state**, and write the initial path back through `setCharacterParts`; the **post-commit effect** keyed on `pendingCancel` then calls `endBatchInteraction()` once and clears the flag. A state flag (not the path value) drives the effect, so a cancelling `pointerdown` that never moved — where the path never changes — still closes the batch. `useHistory.endBatchInteraction` reads `characterPartsRef.current`, which only syncs on render, so ending the batch inside the same handler could commit the mid-drag value — the effect runs after the rollback has been committed, which makes the batch's start and end snapshots identical and therefore records no entry.
- Because rollback is triggered by a keyboard event and not by a pointer event, no global `mouseup` can end the batch before the rollback commits. `endBatchInteraction` is idempotent, so a later stray end is a no-op.
- Result: one history entry per completed drag; a cancelled drag leaves no entry and restores the previous handles.

## 11. Constraints and documented limits

- Reuse `bezierPath.ts`, `freeform.ts`, `worldToLocal`, `getComputedTransform`, `setCharacterParts`, and the batch-history API. No duplicated transform or path math; only the §8 initializer is added.
- No change to `ShapePartRenderers`, `evaluateFrame`, `StagePartLayers`, the matte authority, `bounds.ts`, or anything under `src/ograf/`.
- **Accepted, pre-existing behaviour that this milestone does not change:** part bounds (marquee selection, matte hit areas) are derived from anchor points, so a curve may extend outside them; trim-path length is computed from legacy `points`. Both already hold today for any imported path with handles. This milestone excludes trim-enabled layers instead of silently editing around the mismatch.
- No new animation channel, state store, event bus, dependency, or CSS framework.

## 12. Tests

Implemented coverage (file → focus):

| File | Tests | Focus |
|---|---|---|
| `src/tests/freeformTangentEligibility.test.ts` | 23 | every guard of §7 row by row, canonical-path priority, negative/non-uniform scale, unrelated-track control |
| `src/tests/freeformTangentPersistence.test.ts` | 6 | legacy normalization (repeated closing vertex, `<2` points), canonical pass-through with identical `d`, no mutation of `part.points`, materialized path through the import sanitizer |
| `src/tests/freeformTangentOverlay.test.tsx` | 21 | §3 coordinate parity under identity/rotation/non-uniform/negative scale with the real `EDITOR_CAMERA_CENTER`; marker/handle visibility; untouched neighbouring vertex; smooth mirroring, the zero-length drag vector (§5), the overflowing counterpart and the overflowing dragged vector (§5); Escape with and without a move; `pointercancel`; selection model incl. layer switch and topology shrink; canonical priority; points-only materialization |
| `src/tests/freeformTangentHistory.test.tsx` | 3 | real `useHistory`: one entry per drag, undo/redo, no entry for Escape, `pointerdown`+Escape with no move, `pointercancel` commit |
| `src/tests/useSerialization.test.ts` | 95 (1 added) | the materialized canonical path survives the real `exportProject()` → `importProject()` round-trip together with the legacy `points` |
| `src/tests/bezierTangentHandles.test.ts` | 10 | §8 initializer (rings, open/closed, coincident neighbours, partial smooth, mirroring length) plus the non-finite refusal cases (overflowing mirror at the selected vertex, overflowing chord combined with an unrepresentable reach) |

Manual/runtime evidence: the permanent Playwright spec `e2e/canvas-tangent-authoring.spec.ts` (markers/handles, live drag with 1:1 pointer tracking, `Ctrl+Z`/`Ctrl+Shift+Z`, `Escape` cancel with no history entry, overlay follows the selection) plus the existing interaction e2e specs (`canvas-interaction-v1`, `interactive-shape-creation-v1`, `editor-interaction-regressions`).

Not covered by an automated test: byte-level OGraf output for a points-only layer that carries a degenerate closing vertex (§4) — the render authorities are unchanged, so their output is out of this milestone's scope. OGraf's canonical-path `d` stays pinned by the existing `src/tests/ografSvg.test.ts`.

## 13. Non-goals

- No full vector editor, pen tool, on-canvas vertex add/remove, multi-vertex transforms, or handle constraints.
- No boolean rewrite, no evaluator change, no runtime/package format change.
- No change to mask-path authoring, no new keyboard shortcut surface, no new shortcut registry.

## 14. Acceptance criteria

1. Selecting an eligible freeform layer in edit mode shows its vertices on the canvas, aligned with the rendered path under translate, rotate, scale, zoom, and pan, using the real `EDITOR_CAMERA_CENTER` origin.
2. Selecting a vertex reveals its tangent handles; dragging one updates the rendered shape live and produces exactly one undo entry, and Escape cancels cleanly.
3. Double-clicking a vertex creates symmetric handles for a curved path; a points-only layer gains a `local` canonical path on first edit without anchor movement, and the result survives export/import.
4. Existing interactions (transform gizmo, marquee, shape tools, matte overlay, freeform drawing, undo/redo, broadcast mode) are unaffected, and ineligible layers show no overlay.
5. Full validation passes with no new warnings and an independent review returns READY or READY WITH WARNINGS.
