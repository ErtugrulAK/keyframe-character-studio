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

- The overlay edits the **effective path**: `part.path ?? legacyFreeformPointsToPath(normalizeClosedPoints(part.points), true)`.
- **Clone-on-write invariant:** if `part.path` exists, every write clones that path and changes only the dragged handle. Legacy `points` are never rebuilt into `path` while a canonical path exists — doing so with raw legacy points would discard curves and produce a visible geometry jump and export change.
- **Materialization** happens only when `part.path === undefined`: the first handle edit materializes the canonical path from `legacyFreeformPointsToPath(normalizeClosedPoints(part.points), true)` — that helper always yields `coordinateSpace: 'local'` and `closed: true`, which is exactly what the renderer already draws today. `CharacterPart` has no `closed` field of its own; an existing canonical path keeps its own `closed` and `coordinateSpace` values untouched. `part.points` is preserved unchanged.
- **Data expectations:** after the first write the scene JSON gains a `path` field and the rendered SVG/OGraf output legitimately changes when handles change. Byte-identical output is only claimed for layers whose canonical path is left untouched.
- Topology (point count and ids) is never changed by a handle drag.

## 5. Handle semantics

- Dragging `handleOut` writes only `handleOut`; dragging `handleIn` writes only `handleIn`. The other handle, the vertex position, and the vertex `id` are untouched by a handle drag.
- `smooth` vertices keep mirrored handles: dragging one handle mirrors the other around the vertex with the opposite direction and the other handle's existing length.
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

Normal `parentId` children are supported, because `getComputedTransform` already composes the parent chain.

Selection state is overlay-local: `selectedVertexIndex` and `selectedHandle: 'in' | 'out' | null`.

- Vertex markers are always drawn for an eligible layer; handles (and their lines to the vertex) are drawn only for the selected vertex.
- Clicking a vertex selects it and clears the handle selection. Clicking empty canvas clears the overlay selection only.
- Double-clicking a vertex toggles `corner ↔ smooth`. Switching to `smooth` materializes missing handles through the deterministic initializer in §8; switching to `corner` keeps existing handle positions and only changes `kind`.
- Multi-vertex selection is out of scope.

## 8. Smooth-handle initializer

`createBezierPath` produces corner vertices without handles, so a neighbour-based initializer is required. It is a small **pure** helper added to the canonical `src/utils/bezierPath.ts` and unit-tested there. Exact algorithm for vertex `index` of `path`:

1. **Neighbours.** `previous` = `points[index - 1]`, or `points[n - 1]` when `index === 0 && path.closed`. `next` = `points[index + 1]`, or `points[0]` when `index === n - 1 && path.closed`. For an open path the endpoints therefore have only one neighbour.
2. **Direction (always a unit vector).** With `ε = 1e-6`:
   - if both neighbours exist and `|next - previous| > ε` → `unit(next - previous)`;
   - else if `next` exists and `|next - v| > ε` → `unit(next - v)`;
   - else if `previous` exists and `|v - previous| > ε` → `unit(v - previous)`;
   - else → `{ x: 1, y: 0 }`.
   A zero chord never produces a zero-length handle on its own; it only selects the next rule in this list. The direction is normalized before it is scaled, so handle length is never multiplied by an unnormalized chord.
3. **Reach.** `reach = 0.25 × min` of the distances that exist (`|v - previous|` and/or `|v - next|`); `reach = 0` only when the vertex has no neighbour at all (a single-point path, which is ineligible anyway).
4. **Handles.** `handleIn = v − direction × reach`, `handleOut = v + direction × reach` — mirrored, opposite directions, equal length.
5. **Partial-smooth repair.** The **double-click smooth action** is the only writer that creates handles, and it is what repairs a `smooth` vertex that has only one handle: it keeps the existing handle exactly where it is and sets the missing counterpart to the exact mirror of the existing one around the vertex (same length, opposite direction). When both handles already exist, they are left untouched; when neither exists, both come from steps 1–4. A handle drag never creates handles (§5).

## 9. Hit testing, rendering order, and event ownership

- Markers are sized in screen units through the existing pattern: radius `7 * zScale` like today's markers, with a larger grab radius (`~9 * zScale`). `zScale` is the same value passed to `SelectionGizmo`.
- The overlay group renders **after** the artboard/border layers and **above** the transform gizmo so handles win the pointer over the gizmo's and the matte hit area's transparent regions. Pointer handlers stop propagation so a handle drag never starts a translate/rotate/scale/marquee interaction.
- Pointer capture is taken on `pointerdown` and released on `pointerup`/`pointercancel`, so a drag that leaves the marker keeps tracking and ends deterministically.
- The overlay owns no global keyboard shortcut. Only while a drag is active does it listen for `Escape` to cancel; that listener is removed when the drag ends. `v1` has **no** arrow-key nudging.

## 10. Drag lifecycle and undo

- `pointerdown` on a handle: `startBatchInteraction()`, remember the initial path and the local start point in a ref, enter drag mode.
- `pointermove`: compute the local delta per §3 from the initial path, write the new path through `setCharacterParts` (each live move updates only the selected part's `path`).
- `pointerup`: `endBatchInteraction()`. `pointercancel` behaves the same way — the drag commits its last written value, exactly like `StageCanvas.handlePointerCancel` already does for the transform drags.
- **Escape during an active drag** is the only rollback path, and it is ordered so that history cannot capture a mid-drag snapshot: set `pendingCancelRef`, write the initial path back through `setCharacterParts`, clear the drag mode, and let a **post-commit effect** call `endBatchInteraction()` once and clear the flag. `useHistory.endBatchInteraction` reads `characterPartsRef.current`, which only syncs on render, so ending the batch inside the same handler could commit the mid-drag value — the effect runs after the rollback has been committed, which makes the batch's start and end snapshots identical and therefore records no entry.
- Because rollback is triggered by a keyboard event and not by a pointer event, no global `mouseup` can end the batch before the rollback commits. `endBatchInteraction` is idempotent, so a later stray end is a no-op.
- Result: one history entry per completed drag; a cancelled drag leaves no entry and restores the previous handles.

## 11. Constraints and documented limits

- Reuse `bezierPath.ts`, `freeform.ts`, `worldToLocal`, `getComputedTransform`, `setCharacterParts`, and the batch-history API. No duplicated transform or path math; only the §8 initializer is added.
- No change to `ShapePartRenderers`, `evaluateFrame`, `StagePartLayers`, the matte authority, `bounds.ts`, or anything under `src/ograf/`.
- **Accepted, pre-existing behaviour that this milestone does not change:** part bounds (marquee selection, matte hit areas) are derived from anchor points, so a curve may extend outside them; trim-path length is computed from legacy `points`. Both already hold today for any imported path with handles. This milestone excludes trim-enabled layers instead of silently editing around the mismatch.
- No new animation channel, state store, event bus, dependency, or CSS framework.

## 12. Tests

- **Unit (`bezierPath`)**: the §8 initializer for regular rings, closed/open paths, two-point paths, coincident neighbours, and partial-smooth vertices; mirroring preserves the counterpart length.
- **Unit (overlay geometry)**: absolute inverse-map delta under rotation, non-uniform scale, and negative scale with the real `outputOrigin`; the resulting handle lands exactly where the pointer is.
- **Component (overlay)**: markers render only for an eligible freeform layer; handles appear only for the selected vertex; a drag writes a single `path` value whose other vertices are byte-identical; Escape rolls back; double-click toggles corner/smooth and creates mirrored handles.
- **Guards**: boolean owner, boolean operand, edit-hidden layer, non-select tool, broadcast mode, active drag, normalized-space path, trim-enabled layer, and zero-scale transform all render no overlay.
- **Materialization**: points-only layer gains a `local` path on first edit with unchanged anchors; a layer that already has both `path` and `points` keeps its canonical path (no legacy rebuild); a path-only layer round-trips unchanged until edited.
- **History**: one entry per drag, undo restores the previous handles, redo reapplies, cancelled drag adds no entry.
- **Serialization/export**: the materialized path survives `exportProject`/import; an untouched canonical freeform path still produces byte-identical OGraf SVG.
- **Manual smoke**: drag a handle in the running editor, confirm live rendering, undo, and that gizmo/marquee/shape tools still work.

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
