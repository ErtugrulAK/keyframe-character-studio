# KCS Feature Blueprints — Round 2 (post reliability sprint, 2026-10-20)

Companion to `docs/roadmap/SPRINT_BLUEPRINTS.md` (round 1, PRs #41–#50).
Each blueprint names the canonical owner it must reuse, the non-goals that keep
it from becoming a second engine, and the acceptance gate that must be green
before a PR is reviewable. Nothing here is approved implementation work.

## F1 — Canvas tangent-handle editing (roadmap Next-1)

**Goal.** Drag Bézier handles of path keyframes directly on the canvas for
`custom_path`/mask-path layers, editing the same `bezierIn`/`bezierOut` /
`bezierControlPoints` fields the timeline graph already edits.

**Canonical owners.** `BezierPathEditor` + `src/utils/bezierPath.ts` for
geometry; the existing keyframe mutation pipeline for writes (one undo per
gesture — reuse the graph panel's interaction-transaction contract); the A1
fuzz guard (`ografInterpolationDriftGuard`) stays the runtime-parity oracle.

**Non-goals.** New handle models, marquee selection, multi-key gestures.

**Acceptance.** Fuzz guard green; handle writes round-trip through
`interpolateChannel` unchanged at every non-drag frame; one pointer-down →
one undo entry; e2e drag on a seeded mask path asserting the authored frame.

## F2 — Track-matte source selection affordance (roadmap Next-2)

**Goal.** Surface the current matte relationship (who masks whom) in the
outliner/inspector and let the user re-point it from there, with the existing
`sourceLayerId` / `sourcePartId` validation as the single authority.

**Canonical owners.** Matte validation already in the evaluation layer
(`evaluateLayerMasks`, track-matte guards); no new state fields.

**Non-goals.** Ring/cycle validation duplicates, per-sequence matte modes,
rendering changes.

**Acceptance.** Picker unit tests cover self-reference, cycle and disabled
matte (the case the public-controls resolver already releases correctly —
see `src/tests/ografPublicControls.test.ts`); keyboard-reachable; e2e re-points
a matte and the pixel assertion from `track-matte.spec.ts` moves accordingly.

## F3 — Lottie import mapping v1

**Goal.** Versioned Lottie → KCS mapping for path tangents, hold segments,
temporal handles, masks and track mattes; lossless fields round-trip, lossy
fields are reported, never silently approximated.

**Canonical owners.** `importValidation` (external boundary caps),
`coordinateMigration` (versioned rewrite), existing layer/track builders.

**Non-goals.** Shape-style effects, precomps, blend modes, expressions.

**Acceptance.** Round-trip fixtures per supported field group; a diagnostic
code per unsupported group; import-undo stays one transaction;
`fileAdmission` caps enforced before parsing.

## F4 — Opt-in SVG mask adapter

**Goal.** Export KCS masks as SVG `<mask>` only when semantics are equivalent
to the compositor; otherwise keep the data in `scene.kcs`.

**Gate first.** A written equivalence table (feather, opacity, multi-stop
ramps, intersect modes) decides which rows get an adapter; anything not in the
table stays unsupported. Unsupported export data is never flattened into an
irreversible approximation.

## F5 — Speed-graph editability spec (unblocks the roadmap gate)

**Goal.** The mathematical spec for editing speed and converting back to the
shared temporal-handle model. `src/utils/velocityMath.ts` (PR #47) provides
the forward direction only; the inverse is not unique for multi-segment
spans, and the spec must state the constraint set (segment borders fixed,
handles symmetric by default, tolerance) before any UI exists. The blueprint
round-1 §"explicitly not planned" remains in force until this spec lands.

## Shared prerequisite — visual-diff harness

U3 (focus/accent token unification), F1 handle visuals, and the
snap-feedback flash ADOPT item all fail the same gate: rendered-pixel
judgement. One baseline-diff harness (Playwright screenshots, fixed seed
documents, CI job) is the precondition for all three; building it is its own
small PR, not a smuggled test helper.

## Deferred with reasons (from the sprint ledger)

- Command palette (IA decision), property search (needs U3 tokens), timeline
  bookmarks (schema approval), C1 curve-default presets (needs D1
  Increment-1 surface, which PR #49 now provides — C1's dropdown still needs a
  placement decision), velocity UI (blocked on F5).
