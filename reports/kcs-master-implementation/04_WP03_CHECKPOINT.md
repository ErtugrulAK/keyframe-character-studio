# WP-03 checkpoint — Mask creation and path transformations

Product decisions applied: D-02 (no mask primitive / transform field — every result is a
`BezierPath`), D-08 (vertex add/delete refused on a path keyed in ANY sequence, with a reason).

## Plan (as executed)

- Pure: `utils/maskPathCreation.ts` — rectangle, ellipse (4 cubic segments, explicit
  approximation), pen polygon; layer-space rotate/scale about the path's own centre (vertices +
  absolute handles; layer pivot untouched); topology lock reason; vertex delete (closed ≥ 3);
  shape-preserving vertex insert (straight split or De Casteljau); nearest segment in world space.
- Hook: `useMaskEditing` gains a transient draw session (owner + shape), `commitMaskDraw`
  (ONE write: a new mask with a collision-safe ID, then edit it), topology edits through
  `applyMaskTopologyEdit`, hook-owned vertex selection and `deleteMaskSelection` (Delete/Backspace
  never reach the owner layer, also while drawing).
- UI: Inspector "DRAW MASK: Rectangle / Ellipse / Pen" (accessible names "Draw … mask", distinct
  from the toolbar's layer tools of the same visible names), "PATH: ⟲15° ⟳15° 90% 110%";
  `MaskDrawOverlay` on the stage (drag box / pen clicks, preview through the renderer's own path
  builder, degenerate drags refused, Enter / double-click / first-point click finish, Backspace
  removes a pen point, Escape cancels via the Escape chain); double-click on the outline inserts a
  point; banner "Drawing a … mask on …" with Cancel Drawing.
- Path stopwatch: discovery showed the product had NO UI to create the first mask path key
  (the path row said keys are "authored on the path lane", but no lane action exists). The
  WP-03 acceptance demo (circle → move → path key @20) needs it, so the existing K1 stopwatch
  semantics were extended to path rows: arm = the displayed path becomes the first key at the
  playhead; disarm = same confirmation dialog, active-sequence keys removed, displayed path kept as
  base. `resolveChannelAnimationState` read the scalar store for path channels (always `off`) —
  fixed to read `maskPathChannels`.

## Changed / added files

`src/utils/maskPathCreation.ts` (new), `src/utils/maskPathEditing.ts` (export normalization map),
`src/hooks/useMaskEditing.ts`, `src/context/AnimatorContext.tsx`, `src/hooks/useKeyboardShortcuts.ts`,
`src/components/Canvas/overlays/MaskDrawOverlay.tsx` (new), `src/components/Canvas/overlays/MaskPathOverlay.tsx`,
`src/components/Canvas/StageCanvas.tsx`, `src/components/Inspector/{DetailsPanel,sections/StyleTab,sections/style/StyleMatteSection}.tsx`,
`src/utils/trackMutations.ts` (`clearMaskPathAnimationMutator`), `src/hooks/useTimeline.ts` (path arm/disarm),
`src/utils/timelineMetrics.ts` (path state store), `src/components/Timeline/TrackOutlinerRow.tsx` (path stopwatch shown).
Tests: `src/tests/wp03MaskPathCreation.test.ts`, `src/tests/wp03MaskCreationFlow.test.tsx`,
`e2e/wp03-mask-creation.spec.ts`; evidence `qa/evidence/wp03-mask-creation.evidence.ts`.

## Evidence

| Command | Exit | Result |
|---|---|---|
| `npx vitest run src/tests/wp03MaskPathCreation.test.ts` | 0 | 10 tests (ellipse radial error < 3e-4; De Casteljau split exact to 1e-12; layer-space rotation on a non-square layer) |
| `npx vitest run src/tests/wp03MaskCreationFlow.test.tsx src/tests/k3MaskOutlinerRows.test.tsx src/tests/timelineMetrics*.test.ts src/tests/k1PropertyAnimation.test.tsx` | 0 | 4 files, 55 tests |
| `npx vitest run src/tests/wp03MaskCreationFlow.test.tsx` (with stopwatch test) | 0 | 5 tests |
| `npx playwright test -c playwright.isolated.config.ts --project=e2e wp03` | 0 | 3 passed (first run failed on ambiguous "Pen"/"Rectangle" button names — a real UX/a11y collision with the toolbar tools, fixed in the product, not in the test) |
| `npx playwright test -c playwright.isolated.config.ts --project=evidence wp03` | 0 | 1 passed |

Screenshots: `evidence/wp03/01_ellipse_preview … 07_pen_committed.png`.

## Known limits

- Closed paths keep ≥ 3 points (the Master Review's "minimum 2" is applied to open paths only;
  no open-path creation UI exists).
- Open/close toggle and vertex reorder are not offered (topology; out of the first slice).
- Path rotate/scale are fixed-step Inspector commands; a free-transform canvas box is not built.
- A rotate between two path keys is a geometric edit of one key; interpolation between keys is
  vertex-wise (not a rigid rotation), as documented in the Master Review.

IMPLEMENTED: YES
TESTED: PASS (focused unit/integration, real-pointer E2E, evidence) — full gates recorded in the final validation file
USER ACCEPTED: PENDING
MERGED: NO
