# KCS — Round-3 Blueprints: Graph Editing, Markers, Command Palette, Visual Coverage

Status: design + audited findings only. No product semantics were changed by
this document. Companion to the round-1/round-2 blueprint docs; F5 maths lives
in `KCS_F5_SPEED_GRAPH_INVERSE_SPEC.md` (PR #55) and its implemented slice
`src/utils/speedInverse.ts` (PR #58).

## G3 — Professional graph editing (roadmap gate map)

Current authority (verified this session):
- Stored temporal model: per-keyframe `bezierOut`/`bezierIn` on
  `PropertyKeyframe`; the effective curve is the COMPLETE PAIR across a segment
  (`prev.bezierOut && next.bezierIn`), checked after `hold` and before named
  easings by `applyEasing` (editor `utils/defaults.ts`, runtime mirror
  `ograf/runtimeTemplate.ts` — same order, fuzz-paired by the A1 drift guard,
  now including handle overrides; see §O4).
- Write path: `updatePropertyKeyframeTemporalHandlesMutator`
  (`utils/trackMutations.ts`) — merges a partial patch into the keyframe, one
  call = one document write = one undo entry (batch wrappers exist in the
  curve editor: `onBatchStart/End`).
- UI surfaces: value-graph handle rows + preset select (#57), curve editor
  modal (single segment), speed graph READ-ONLY (derived).

Feasible first slices WITHOUT product approval (all inside existing semantics):
1. Per-keyframe handle reset (`Clear handles` button per handle row writing
   `{ bezierIn: undefined, bezierOut: undefined }` via the same patch authority).
   Needs mutator support for key deletion from the patch (currently merge-only) —
   small, contained extension; one write; undo-safe.
2. Segment-slope numeric fields (entry/exit velocity in value-units/frame)
   powered by `speedInverse.ts` (F5a) — read-out is exact today; editing maps
   through the closed form, clamps reported. This is F5b with the UI gesture
   reduced to number inputs — still a product-visible interaction, so it is
   approval-gated below.
3. Keyboard parity on the value graph (Tab to select row already exists):
   Alt+Arrow nudges focused handles ±0.01 through the same patch call.

Requires PRODUCT approval (new semantics, do not implement unasked):
- Dragging speed-curve points (endpoint-slope gesture; F5b proper) — changes
  what a drag MEANS on an existing surface.
- Broken (independent in/out) handles — storage would need per-side authored
  state (the model already stores them independently; the EDITOR gesture for
  unlinking is the new semantics).
- Multi-segment selection / cross-keyframe brushing (F5 §2 Limit 4 ambiguity).
- Editing x-handles from the speed view (timing warp; forbidden by F5 spec).

Ownership invariant for every slice above: the mutator stays the ONLY writer;
the graph panels stay presentation + patch calls; no component-local curve state.

## T1 — Timeline markers (presentation-only prototype blueprint)

Verified current state: the ruler (`components/Timeline/TimeRuler.tsx`) is the
playhead's slider (role=slider, arrow keys step frames); keyframe diamonds live
in `TrackLane`; global commands run from the ONE table in
`hooks/useKeyboardShortcuts.ts` (with `keyboardFocus` scope guards). There is
NO marker concept in SceneData — and adding one is a schema change, out of
scope here.

Proposed non-persistent design (throwaway branch only, NOT shippable):
- Ownership: presentation state in the timeline component tree
  (`useState<Set<number>>`), never serialized — reload discards markers, which
  MUST be stated in the UI (tooltip: "session-only").
- Frame mapping: markers snap to integer frames via the same pixel→frame math
  the ruler drag already uses; rendering as an overlay strip ABOVE the ruler so
  lane hit-testing is untouched.
- Keyboard: `M` toggles a marker at the playhead ONLY when `ownsShortcutScope`
  allows (the global table pattern — new table entry, no ad-hoc listeners).
- Undo/Redo: markers are OUTSIDE history (like the current selection) — the
  prototype must prove that adding/removing markers creates zero history entries.
- OGraf export: markers MUST NOT appear in exported runtimes; the prototype
  asserts the emitted artifact is byte-identical with and without markers.
- Ship gate: persisting markers requires a SceneData field (+ validation,
  migration, OGraf mapping decision: bake as guide layer vs drop). That
  decision is a schema approval item, deliberately not designed further here.

Verdict: useful ONLY as a session scratchpad for QA annotation; shipping the
non-persistent version risks users reading it as saved state. Recommendation:
keep prototype-only, decide persistence semantics first.

## T3 — Property search / command palette (spec)

Verified anchors: `useKeyboardShortcuts.ts` exposes a command table already
(names like `tool-select`, `duplicate`, `delete-selection`, `select-all`,
`group-layers`...). Inspector channel rows are static lists; no search input
exists in the Inspector (grepped).

Minimal spec (no new global shortcut without approval):
- Surface: an existing-UI button in the Inspector header opening a dialog
  reusing the `ConfirmationDialog` focus-restoration hook
  (`useDialogFocusRestoration`) — NOT a floating overlay.
- Content: union of (a) all shortcut-table commands, (b) layer names,
  (c) channel names of the selected layer. Selecting a command calls the SAME
  dispatch the keydown handler uses (single dispatch point preserved).
- Shortcut: deliberately unspecified — `Ctrl/Cmd+K` is unbound today (verified:
  no `k` binding in the table) but claiming it is an interaction-semantics
  decision, so the palette ships mouse-first; binding rides a later approval.
- No new state engine: the palette is a pure consumer of existing dispatch.

## V2 — Visual-QA coverage plan (next regions, ranked)

V1 (#56) proves the harness on `.time-ruler` + `.left-sidebar-nav` (win32
baselines, deterministic seed scene). Next targets, in the order that maximizes
regression value per baseline byte, each behind the checklist in
`docs/KCS_VISUAL_QA.md`:
1. Inspector header + toolbar strip (`.motion-design-right-sidebar` top block)
   — high churn area (public-controls V1), stable when a fixed selection is seeded.
2. Keyframe lane block with a seeded multi-channel track (diamond rendering).
3. Motion Curves dialog (value graph state: seeded handles; badge text is
   deterministic after #60 lands — pin BEFORE/AFTER deliberately).
4. Header toolbar (icon family; after V3 token audit).
AVOID: canvas stage (font/antialias surface area), autosave badge (text state),
anything with transitions-in-frame. Budget: ≤ 6 regions total, ≤ 24 KB/baseline
(gzipped) before it becomes a maintenance tax.

## O-phase audit (this session, code-verified)

- O1 (matte targeting): validation is PRESENT and complete for the listed risk
  classes — `validateScene.ts` covers MISSING source, self-reference and
  cycle walks for BOTH matte kinds, with disabled-edge exclusion and
  dangling-ids-not-cycles policy; import-time id integrity is separately
  guarded (`importValidation.ts` duplicate-id records). No gap found; no change.
- O2 (Lottie): mapping lives in `src/interop/lottie/` (mapDocument/temporal/
  diagnostics); animation curves carry through `temporal.ts`; unsupported
  constructs surface as diagnostics rather than silent loss — matches the
  "never claim spec parity from syntax acceptance" rule. Follow-up (not done
  this session): fixture-level rotation/easing round-trip table — tracked in
  the master list, no bug evidence found in passing.
- O3 (SVG security): input boundary hardened by the merged N3/`fix/ograf-svg-*`
  lineage: `isSupportedEmbeddedImage` (legacyCompatibility) gates raster/SVG
  admission before parse; runtime emission escapes `<`/`>` via `cssString` and
  routes ids through `runtimeId` sanitization (verified in runtimeTemplate).
  Negative tests exist with the svg boundary specs (`ografSvg.test.ts`).
  No relaxation was made or found needed; nothing here constitutes a full
  security audit — it is a targeted review of the touched pipeline.
- O4 (editor/runtime parity): the A1 drift guard fuzzed 9 easings + duplicate
  frames + exact-key probes — but ZERO temporal-handle cases. Extended (this
  PR): seeded handle-pair fuzz on ~30% of segments + `anticipate`/`overshoot`
  added to the easing pool. Parity holds; the guard is now a real tripwire for
  the override branch every graph feature (#49/#57/#58/#60) writes through.
