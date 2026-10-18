# Progress 187 - K5 Matte Visibility Safety

Date: 2026-10-18T17:40Z (UTC) · Base: `feat/k3-mask-outliner-rows@45c8d72`
· Branch: `feat/k5-matte-visibility-safety`
(worktree `.worktrees/k5-matte-visibility-safety`, stacked on K3)

## Scope decision first: the semantics map

(The planned scout subagent died on an expired provider key; the map was
built by direct reading instead — every claim below is first-hand this
session.) Two relationship models coexist: legacy `matte` (M11) and
`trackMatte` V2, unified by `resolveMatteSource` (matte.ts). The visibility
words:

- `trackMatte.sourceVisible:false` — the AE matte switch: the source is NOT
  painted as its own layer (`StagePartLayers` hiddenMatteSources filter
  :747-757) but its geometry STILL clips (`:258-263` def loop unchanged);
  runtime parity via `matteRelationship` (`runtimeTemplate.ts:239`).
- Layer-level `visible` lives on the TRACK (sequencer), not the part — there
  is no `part.visible`. Track-level hiding is out of this slice by contract.
- Missing source: editor skips, validation reports recoverable
  (`MATTE_MISSING_SOURCE` / `TRACK_MATTE_MISSING_SOURCE`), runtime legacy
  clip path THROWS — documented divergence, DEFER list.
- Cycle walks cover legacy only; V2 cycles clip with raw geometry (no
  recursion, predictable) — DEFER list, with `sourceLayerId:''` silent case
  and the unfiltered V2 picker list (behavior change territory).

Full map with file:line evidence: `local://k5-matte-semantics-map.md`
(sprint handoff artifact).

## SAFE SUBSET shipped (affordance-only, zero behavior change)

- `isMatteSourceSuppressed(part)` — the single truth for an ACTIVE V2
  relationship whose source is matte-switched off (legacy has no such flag).
- Outliner matte badge: `Track matte source: Alpha (source hidden — still
  clipping)` (title) / `(source hidden)` (aria-label) — the UI no longer
  presents a suppressed source as a painted one.
- V2 picker options: ` (hidden)` suffix on candidates that ARE suppressed as
  a matte source (review fix — see addendum; the first version keyed on the
  candidate's OWN relationship, the wrong direction).

No render, serialization, runtime, or validation behavior moved.

## Evidence

- RED 2/2 (util truth-table; picker suffix through the real two-card layout —
  the first run caught the test reading the LEGACY `.matte-source-field`:
  both cards share the class, the query is by `select[aria-label=...]`).
- GREEN: focused 325/325 across k5 + matte + outlinerPanel +
  styleMatteSection; full Vitest **183 files / 2737 tests**; `tsc -b` 0;
  oxlint 0.
- Chromium isolated spec **1/1**: seeded V2-suppressed pair restores through
  the real route and the badge title states the hidden-still-clipping truth.

## Review-fix addendum (same branch, after head `972988f`)

Independent review of PR #27 caught a real direction error in the picker
label: `isMatteSourceSuppressed(candidate)` answers "does THIS part suppress
its own source", but the picker asks "is this CANDIDATE suppressed BY SOME
TARGET". New pure helper `suppressedMatteSourceIds(parts)` computes the
source-id set from the same fields `StagePartLayers` filters on (active V2 +
`sourceVisible:false` + non-empty id; per-source-id, so one switched-off
target suppresses even while another target shows the layer; legacy matte
contributes nothing). The outliner badge deliberately keeps
`isMatteSourceSuppressed` — the direction is correct there (it renders on
the TARGET row about its own relationship). No render, serialization,
runtime, or validation behavior moved.

- RED (behavioral, via an empty-set shim over the old lookup): util truth
  rows + both picker label rows failed the old direction; GREEN: focused
  330/330 (k5 + matte + outlinerPanel + styleMatteSection), full Vitest
  **183 files / 2742 tests**, `tsc -b` 0, oxlint 0, production build clean,
  `validate:ograf` valid.
- Matte Playwright set on the isolated lane — track-matte, m21, m22, k5, F:
  **120 passed / 0 failed** (workers=1, release-gate mode).
