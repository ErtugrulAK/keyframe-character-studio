# KCS Minimal ChatGPT Upload Bundle — ae-inspired layout, crop and snapping (stacked on PR #9)

Task-specific handoff for the AE-inspired layout/crop/snapping branch `feat/ae-layout-crop-snapping`
(2026-10-14), stacked on the manual-QA-round remediation branch that PR #9 carries. The work implements the
features the user's source video asked for — AE-style alignment/snapping and a stage crop — and this part
finished it: commits, the remaining gates, the FULL Chromium suite, one stacked PR and this handoff. This is
not an archive.

## Current truth

- Repository (canonical, untouched, still on `main` @ `8e2df61`, clean):
  `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`
- Worktree that carries this work: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-ae-layout`
- Branch: `feat/ae-layout-crop-snapping`, base `origin/fix/manual-qa-round1-remediation` @ `04eee5e`
  (PR #9's head), head `cd8fe7c5f16e174ad8a5a7c5a42524e873eb0263` (`cd8fe7c`), pushed with an explicit
  refspec — no force, no rebase, no history rewrite
- **Validated code revision: `55ed8c7`**; `cd8fe7c` adds the record and the changelog only
- PR: **#10 OPEN, not merged** — `https://github.com/ErtugrulAK/keyframe-character-studio/pull/10`, stacked on
  PR #9, base `fix/manual-qa-round1-remediation`; mergeable **MERGEABLE**; CI **CI Pipeline** run
  **`38565624999`** (`pull_request`) — **__CI_CONCLUSION__**
- **PR #9 is OPEN and untouched** — `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`; its
  branch, its worktree and its pushed head were not modified, and nothing was merged
- Validation on `55ed8c7`: `npm run build` green, `npm run validate:ograf` green, `PORT=5014 npm run
  qa:release` green (2 passed), `PORT=5014 npm run qa:v6` green (3 passed), `npm run check` green as one
  command (oxlint, `tsc -b`, **168 files / 2,533 tests**, production build), state-consistency check
  **PASS (50 checks)**, `npm audit --audit-level=low` **0 vulnerabilities**, `git diff --check` clean
- FULL Chromium suite (404 tests, `--retries=0`, 8 workers): **402 passed / 2 failed** on the final run — the
  two pre-existing load-sensitive `Show Inspector` camera samples, reported below and left untouched
- Live preview: `http://localhost:5173/` — still served from the **Round-5 worktree** (vite listener pid
  50876), which is the user's QA surface and was deliberately not re-pointed at this branch
- API: `127.0.0.1:5000` — pid 18280, **never stopped or restarted**
- Next input: the user's Round 1–5 retest against 5173 (PR #9's merge gate), then the review of PR #10

## What the branch adds

- **One layout geometry authority** (`src/utils/layoutGeometry.ts`): the union / centre / world-translation
  primitives every layout command is measured against, built from the canonical evaluator's world bounds
  (`getLayerWorldBounds`), so rotated and non-uniformly scaled layers and group containers measure correctly
  and align, distribute and snapping cannot disagree about where a layer is.
- **Equal-spacing distribution as a SECOND policy**: `Distribute horizontal spacing` / `Distribute vertical
  spacing` (`planDistributeByGap`) even the EDGE GAPS along an axis while the outer boxes' outer edges hold the
  span — the right look for boxes of different sizes. Round 5's centre-based `planDistribute` keeps its own
  command and its shipped behaviour; neither policy is expressible as the other without changing a result.
- **Smart snapping and guides**: a translate drag snaps the moving item's evaluated world bounds to the stage
  box and to every other visible outermost layer's box. X and Y resolve independently (a corner lock is two
  axis snaps); the smallest screen-delta candidate wins with a deterministic tie-break (stage first, then
  layers in stacking order); the radius is a SCREEN radius (`SNAP_THRESHOLD_SCREEN_PX = 8`) converted through
  the camera scale at pointerdown, so the feel is identical at any zoom. The candidate set is frozen at
  pointerdown because the drag writes the moving layers on every move; a group snaps as one aggregate item; a
  bonded partner is not a candidate (it moves with the drag); matched lines are drawn as decorative,
  pointer-events-none guides; one drag stays one undo entry; the View band gains a `Toggle snapping` switch
  beside the grid, **armed by default**.
- **Stage crop / region of interest**: one authority (`src/utils/stageCrop.ts`) plus one command surface
  (`src/hooks/useStageCropAuthoring.ts`) shared by the toolbar's `Crop` band and the stage overlay. A crop sets
  the stage to the region's size and moves ONE uniform vector onto the ROOT layers only, shifting every `x`/`y`
  keyframe across every sequence scope and the legacy composite list; rotation/scale/opacity, masks/mattes,
  groups, parent transforms, trim path, media and `imageContentBounds` are untouched; the region is clamped
  into the stage first (no hidden clipping); a root layer pinned by a stage anchor makes the command refuse
  with an explanation; a zero-area or full-stage region is a no-op with no history entry; `Apply crop` is
  exactly one undo entry; the region and the armed mode are transient authoring state. Two crop-to-content
  modes (current selection / visible content) measure the EVALUATED bounds at the CURRENT authored frame and
  say so in their labels; no all-animation-frames auto-crop was added.
- **Two carried-over fixes**: the stage's own snap candidates and the drawn guide now live in ONE coordinate
  space (they had been split between editor space and the layer world, which drew a stage guide 660px from the
  geometry and locked the layer to the wrong target), and a BONDED partner is no longer offered as a snap
  target.

## What the gate found (all fixed, nothing weakened)

1. `e2e/authoring-toolbar.spec.ts` still asserted the NINE pre-crop bands — migrated to eleven, with the
   per-band check matching the label exactly (`Crop` is a prefix of `Crop to content`). 9/9.
2. `e2e/layer-binding.spec.ts:137` — a pre-existing spec whose subject is the bond's world-delta parity —
   failed because the dragged child's target edge came within 2.9 screen px of its BONDED partner's frozen
   edge, which the snap locked onto even though the partner was moving with the drag. Fixed in the product
   (`decc14e`): the snap moving set now expands through `utils/partBinding`'s `resolveBondGroup`. The spec
   passes **unchanged** and is the regression test.
3. `e2e/named-sequence-v2.spec.ts:29` measures the PURE pointer delta of a stage drag, and its shape is created
   on the stage centre, so the 40px downward move lands its own top edge on the stage's centre line — a
   legitimate lock. The spec now asserts the default and switches snapping off for that measurement; every
   assertion is unchanged.
4. `e2e/ae-layout-snapping.spec.ts`'s new threshold test was ambiguous for two reasons: it converted through
   the camera scale twice, and (the real one) the moving box's own far edge crosses the stage's CENTRE line at
   the zoom the `-` key presses actually reach — the failure itself named it (`guides=[x=300]` with a 23.05px
   gap instead of 16px). The test now isolates one candidate (a single layer dragged toward the stage's left
   edge, the miss measured from the rendered layer box and the rendered artboard in the same frame), with
   assertion messages that carry the guide's line, both edges, the miss, the zoom and px-per-unit. Verified
   under the load that reproduced it: 3/3 runs green.
5. Incidental, pre-existing, NOT fixed (out of scope): the zoom handler reads `zoomRef`, which the render
   updates, so `-`/`=` presses inside one React commit collapse into one step — 13 presses produced 4 effective
   steps (`0.9^4 = 0.6561`) under load and reached the `clampZoom` floor of `0.3` without it.

## The two remaining failures, exactly as measured

`e2e/camera-transition-stability.spec.ts:231` (`inspector show`) and `:259` (`repeat Show Inspector`) — the
same pre-existing, load-sensitive family the Round-5 record carries. Final full-suite run: `:231` →
`inspector show: frame 6 t=143.2ms alpha x drifted -28.859px (stage 885.3px)`; `:259` → `repeat Show
Inspector: frame 5 t=144.3ms alpha x drifted -28.859px (stage 1221.3px)`; both traces
`worstDelta=28.859px, magnificationSpread=0.00000` against the spec's 1px bound. Earlier runs measured
9.109px at `:231`. In isolation on this revision: **2 workers 7 passed / 2 failed** and **8 workers
8 passed / 1 failed**, both with a 9.109px excursion on `inspector show` — the Round-5 record measured
`0.000px` in isolation, so this revision is worse there. The spec, its bound, its `expectStable` and the
`.property-inspector` `transition: width 240ms ease` it measures are untouched by this branch, the printed
stage geometry (`944x281 -> 584x281`, `1280x281 -> 920x281`) matches the Round-5 record exactly, and no
comparison against the pre-branch revision was made (the Round-5 worktree and the canonical checkout are
read-only for this task) — reported **without attribution** for the reviewer's decision. No tolerance was
widened, no retry added, no sleep inserted and no test skipped.

## Standing contracts (unchanged)

- **FPS/TIMEBASE**: one mapping between frames and time (`src/utils/timebase.ts`); playback is elapsed-time
  driven, so a monitor's refresh rate cannot change a duration. GIF export keeps its 60 FPS cap; there is no
  video export.
- **Undo transaction**: one continuous gesture = ONE undo entry (the transaction opens on the press and closes
  on release, cancel or lost pointer capture); every command of this branch respects it — a snap, a distribute,
  a crop and a crop-to-content command each produce exactly one entry.
- **Reality Hub timing** and the macOS ZIP item remain final manual-QA pending with no product change.

## Protected state

`main`, `origin/main`, the canonical checkout, every other worktree, every release tag and the published
`v1.1.0-rc.2` prerelease were preserved. No tag was created, moved or deleted, no GitHub release was published
or finalized, nothing was published to npm, no dependency/package/lockfile/workflow/OMP-config byte changed,
and neither PR #9 nor PR #10 was merged. 5173 remains the Round-5 preview (the user's QA surface) and API 5000
was never stopped or restarted.

## Evidence and files

- `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` — the full record: the feature semantics, the snapping threshold
  and priority with the coordinate-space fix, the crop semantics with both current-frame modes, the export
  parity argument, what the gate found, the full validation table with the exact drift numbers, the PR/branch/
  head/CI, the live surfaces and the retest checklist.
- `reports/progress_172_ae_inspired_layout_crop_and_snapping.md` — this branch's record (the same content in
  repository form).
- `reports/progress_171_manual_qa_round_five_remediation.md` (and 165…170) — the manual-QA rounds this branch
  stacks on; their findings and proofs still stand unchanged.

## Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. No other file in this bundle needs to be uploaded.
