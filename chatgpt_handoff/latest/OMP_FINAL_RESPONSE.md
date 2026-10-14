# OMP final response — ae-inspired layout, crop and snapping (stacked on PR #9)

Status: **the branch is implemented, validated on a frozen revision, pushed and open as PR #10 (stacked on
PR #9). Nothing merged. PR #9 was not touched.**

## What was delivered

The AE-inspired layout/crop/snapping work (seven commits on `feat/ae-layout-crop-snapping`) was committed,
gated, pushed and handed off:

- `0bf21c3` — one shared layout geometry authority (`src/utils/layoutGeometry.ts`) plus the equal-EDGE-GAP
  distribution policy `planDistributeByGap` beside the unchanged Round-5 centre-based `planDistribute`.
- `802cebc` — smart snapping and guides: screen-radius threshold (`SNAP_THRESHOLD_SCREEN_PX = 8`), stage plus
  other visible outermost-layer candidates, independent X/Y, smallest screen-delta win with a deterministic
  tie-break, the candidate set frozen at pointerdown, a group as ONE aggregate target, one undo entry per drag,
  and a `Toggle snapping` switch in the View band (armed by default).
- `913f3a3` — the stage crop / region of interest: one authority (`src/utils/stageCrop.ts`), one command surface
  (`src/hooks/useStageCropAuthoring.ts`), the toolbar's `Crop` + `Crop to content` bands and the stage overlay.
  Plus the carried-over stage-snap coordinate-space fix (the guide was drawn 660px from the geometry and the
  lock target was wrong).
- `3c62d85`, `decc14e`, `9fd713a`, `55ed8c7` — what the gate found: the authoring-toolbar spec that still
  asserted the nine pre-crop bands; a real snap-target defect (a BONDED partner moves with the drag, so it must
  not be a candidate) that the pre-existing `layer-binding` spec caught; the named-sequence spec that measures a
  pure pointer delta and now switches snapping off for that measurement; and the new threshold test's two
  ambiguity causes.

## Validation

On the frozen revision `55ed8c7` (isolated ports only; 5173/5000 never touched): `npm run build` green
(2,075 modules), `npm run validate:ograf` green, `PORT=5014 npm run qa:release` green (2 passed),
`PORT=5014 npm run qa:v6` green (3 passed), `npm run check` green as one command (oxlint, `tsc -b`,
**168 files / 2,533 tests**, production build), `node scripts/check-state-consistency.mjs` **PASS (50 checks)**,
`npm audit --audit-level=low` **0 vulnerabilities**, `git diff --check` clean.

The neighbouring Playwright specs (12 files, 8 workers) ran **73 passed / 2 failed**, and the FULL Chromium
suite (`CI=1 PORT=5014 … --retries=0`, 404 tests, 8 workers) ran **402 passed / 2 failed** — in all three full
runs the only remaining failures are the pre-existing, load-sensitive `Show Inspector` camera samples
(`camera-transition-stability.spec.ts:231` and `:259`), a one-frame ALPHA client-x excursion of **28.859px**
against the spec's 1px bound, with `magnificationSpread=0.00000` on every trace.

Reported, not hidden: in isolation on this revision those two samples are NOT clean — `inspector show`
reproduces a **9.109px** excursion at 2 workers (7 passed / 2 failed) and at 8 workers (8 passed / 1 failed),
where the Round-5 record measured `0.000px` in isolation. The spec, its 1px bound, `expectStable` and the
`.property-inspector` `transition: width 240ms ease` it measures are untouched by this branch, and no
comparison against the pre-branch revision was made (the Round-5 worktree and the canonical checkout are
read-only for this task), so the change in isolation behaviour is reported **without attribution**. No
tolerance was widened, no retry added, no sleep inserted and no test skipped.

## Pull request

**#10 — OPEN, not merged**, stacked on PR #9: `https://github.com/ErtugrulAK/keyframe-character-studio/pull/10`,
base `fix/manual-qa-round1-remediation`, head `feat/ae-layout-crop-snapping`. Head
`cd8fe7c5f16e174ad8a5a7c5a42524e873eb0263` (`cd8fe7c`), pushed with an explicit refspec — no force, no rebase;
mergeable **MERGEABLE**; CI **CI Pipeline** run **`38565624999`** (`pull_request`) — **success**.

**PR #9 is OPEN and untouched**: no commit, push, rebase or merge happened on its branch or worktree.

## Live surfaces

5173 still serves the **Round-5 worktree** (`keyframe-character-studio-omp-manual-qa-r1`, vite listener pid
50876, HTTP 200) — the user's QA surface for the pending Round 5 retest; it was deliberately NOT switched to
this branch. **API 5000 (pid 18280, `/api/health` 200) was never stopped or restarted.** No merge, no tag, no
release and no npm publication happened, no dependency/package/lockfile/workflow byte changed, and the
canonical checkout was never written to. The one-file carries the complete tables, the feature semantics and
the retest checklist.
