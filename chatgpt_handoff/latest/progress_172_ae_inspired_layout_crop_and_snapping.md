# AE-inspired layout, crop and snapping — branch record, gate, stacked PR and handoff

Branch: `feat/ae-layout-crop-snapping` (new; stacked on PR #9's head, which stays open and untouched).
Base: `origin/fix/manual-qa-round1-remediation` @ `04eee5e` (PR #9's head).
Worktree: `keyframe-character-studio-omp-ae-layout`.

Scope of this part: commit the already-implemented work, run the remaining gates and the FULL Chromium
suite, push the branch, open ONE stacked PR and refresh the handoff. No merge, no release, no tag, no npm
publication, no force push, no rebase, no package/dependency/workflow change, and no spec left weakened,
skipped, retried or padded with a sleep. The one deviation from the plan is recorded in section 6: the gate
found two real cross-feature collisions and one ambiguous new spec, and all three were fixed honestly instead
of being reported as red.

## 1. The branch

| Commit | What it is |
| --- | --- |
| `0bf21c3` | one shared layout geometry authority (`src/utils/layoutGeometry.ts`) plus the equal-EDGE-GAP distribution policy `planDistributeByGap`, alongside the unchanged Round-5 centre-based `planDistribute` |
| `802cebc` | smart snapping and guides (screen-radius threshold, stage + other layer candidates, independent X/Y, one toolbar switch) |
| `913f3a3` | the stage crop / region of interest authority, its command hook, the toolbar Crop bands and the stage overlay — plus the carried-over stage-snap coordinate-space fix |
| `3c62d85` | the missed callsite: `e2e/authoring-toolbar.spec.ts` still asserted the nine pre-crop bands |
| `decc14e` | fix: a layer the drag carries by BOND is not a snap target (section 6) |
| `9fd713a` | test: the snapping-driven drag contracts in the two affected specs (section 6) |
| `55ed8c7` | test: the snap-threshold test measures the stage edge alone (section 6) |

## 2. Geometry semantics — one authority, TWO distribution policies

`src/utils/layoutGeometry.ts` owns the world-bounds primitives every layout command is measured against:
the union of evaluated boxes, their centre, and the world translation of a box. The vector arrange planner
imports them instead of keeping a private copy, so align, distribute and snapping cannot disagree about
where a layer is. Every box is the canonical evaluator's (`getLayerWorldBounds`), so rotated and
non-uniformly scaled layers and group containers measure correctly.

Equal-spacing distribution is a SECOND, additive policy:

| Policy | Reference | Rule | Command |
| --- | --- | --- | --- |
| `planDistribute` (Round 5, unchanged) | box CENTRES | interior centres at an even step, extremes fixed | `Distribute horizontal` / `Distribute vertical` |
| `planDistributeByGap` (this branch) | EDGE GAPS | the outer two boxes' outer edges hold the span and the interior EDGE GAPS are equalised | `Distribute horizontal spacing` / `Distribute vertical spacing` |

The two are separate commands because neither is expressible as the other without changing a shipped
result: with boxes of different widths the centre policy and the gap policy produce different (both
correct) layouts, and gap spacing is the look a motion designer expects for unequal boxes. The centre
policy keeps its Round-5 behaviour byte for byte.

## 3. Snapping — threshold, priority and the coordinate space

- **Targets:** the stage box plus the box of every other VISIBLE outermost layer. A group snaps as ONE
  aggregate item (its children never become independent candidates), a container that carries the moving
  layer drops out as a target (it would be the moving item's own box), and — since `decc14e` — the layers a
  BOND carries along are not candidates either: a partner moves by the same world delta, so it is leaving
  the box a snap would lock onto.
- **Threshold:** `SNAP_THRESHOLD_SCREEN_PX = 8`, a SCREEN radius converted through the camera scale at
  pointerdown, so the feel is identical at 25%, 100% and 400%.
- **Priority:** X and Y resolve INDEPENDENTLY (a corner lock is two axis snaps) and the SMALLEST
  screen-delta candidate wins, with a deterministic tie-break by candidate order — stage first, then the
  layers in stacking order. A moving box offers its OWN lines in the same competition (left/centre/right,
  top/middle/bottom), so a drag can legitimately lock its far edge as well as its leading edge.
- **Context:** the candidate set and the moving box are frozen at pointerdown, because the drag writes the
  moving layers on every move; snapping writes authored transforms, never the camera, and the gesture keeps
  its single batch interaction, so one drag stays one undo entry.
- **Surface:** a `Toggle snapping` switch beside the grid in the toolbar's View band (armed by DEFAULT), plus
  a decorative, pointer-events-none smart-guide overlay that disappears the instant the snap or the drag
  ends. No temporary-suspend modifier was adopted: the collision audit (`utils/shortcuts`) found Ctrl/Cmd
  already means "do not start a drag", Shift is the scale lock and Alt belongs to the OS/browser.

**The coordinate-space fix carried by `913f3a3`.** The stage bounds were built in EDITOR space
(`EDITOR_CAMERA_CENTER ± resolution/2`) while the moving box and the layer candidates were measured in the
project-relative world that `transform.x`/`transform.y` are authored in. A stage lock therefore either
never fired or drew its guide **660px** away from the geometry (660 = `EDITOR_CAMERA_CENTER.x` − stage
half-width, 960) and locked the layer to a 240-offset world centre instead of the stage edge. The candidates
and the moving box now live in ONE space (`±half the resolution`, the world) and the overlay adds the editor
camera origin only when it DRAWS a guide. The fix was proven load-bearing by a temporary probe: reverting it
reproduced both the 660px offset and the wrong lock target; the probe is not in the tree.

Evidence: `e2e/ae-layout-snapping.spec.ts` (5 tests) — the stage-edge lock (asserting the drawn guide's own
`x1` is `300 − 960 = −660`, i.e. the world coordinate the geometry lives at), the two independent axis locks,
the group-as-one-target case, the screen-radius-at-any-zoom case, and the toggle.

## 4. Crop semantics — one authority, one uniform shift, two current-frame modes

`src/utils/stageCrop.ts` is the single crop authority and `src/hooks/useStageCropAuthoring.ts` is the single
command surface the toolbar band and the stage overlay both run, so the two cannot disagree about what a crop
does or what it costs in history.

- **Geometry:** the new stage size IS the region's size, and the region is clamped into the stage first, so a
  crop can never hide pixels that are outside the new frame.
- **The shift is ONE uniform vector:** `dx = w/2 − roi.x − roi.w/2`, `dy = h/2 − roi.y − roi.h/2`, applied
  ONLY to the ROOT layers — exactly the layers the evaluator composes against nothing (`parentId ??
  booleanGroupId`, and only when that container exists). A child is container-local, so its container already
  carries it and shifting it twice would move it twice: world placement is preserved exactly.
- **Every frame moves with it:** every `x`/`y` channel keyframe of a shifted layer, across every sequence
  scope (`templateId`), and the legacy composite `keyframes[].transform.x/y` list as well, so no frame of any
  authored sequence is left on the old origin.
- **Untouched:** rotation, scale and opacity, masks and mattes, groups, parent transforms, trim path, media
  and `imageContentBounds`. A crop is a reposition, not a re-parent.
- **A refusal, not a silent loss:** a root layer with `anchor !== 'none'` makes the command REFUSE with an
  explanation ("A layer pinned by a stage anchor cannot be moved by a crop. Set its anchor to None first."),
  because the evaluator pins that layer's position and the crop would leave it behind. The Apply control is
  disabled with that reason as its title.
- **Two crop-to-content modes, both labelled CURRENT-FRAME:** "Crop to current selection at current frame"
  (the collective evaluated box of the selection, through the same target folding the arrange commands use)
  and "Crop to visible content at current frame" (the evaluated box of every layer whose track is not hidden
  for editing). Both measure the EVALUATED bounds at the CURRENT authored frame and say so, because a layer
  that animates away from the region leaves the new frame at the frames that move it. **No
  all-animation-frames auto-crop was added** — it would need a bounds-over-all-frames pass this branch does
  not have, and shipping it under the same label would be a lie.
- **History:** the armed mode and the region on screen are TRANSIENT authoring state — they never enter a
  snapshot, so drawing or resizing a region is not undoable — and `Apply crop` is exactly ONE batch
  interaction: one undo entry restoring the previous stage size AND the previous positions together. A
  zero-area or full-stage region is a no-op with no history entry.
- **Authoring surface:** the stage authors the region in stage space (origin at the stage's top-left) and
  draws it back through the editor camera, with eight resize handles, a dimmer over everything outside the
  region and a live size readout; the pointer targets a handle by its drawn element, so the handle table and
  the hit test cannot drift. `Escape` drops the region, then leaves the mode, ahead of the freeform tool's
  own listener. The toolbar gains the `Crop` band (`Crop / region of interest`, `Apply crop`,
  `Clear crop region`) and the `Crop to content` band, both reading the animator context's one authority.

Evidence: `src/tests/stageCrop.test.ts` (19 tests) pins the geometry, the shift and the refusals;
`src/tests/stageCropCommands.test.tsx` (9 tests) pins the commands, one undo entry per crop and the transient
region; `e2e/ae-layout-crop.spec.ts` (3 tests) drives the real gesture in Chromium;
`src/tests/authoringToolbar.test.tsx` covers the band, the enablement and the block reason.

## 5. Export parity

The crop writes exactly the fields the OGraf export already reads — the layer `x`/`y` channels (and the
static `baseTransform`) and the project resolution, which `src/ograf/compiler.ts` reads as `sceneData.width` /
`sceneData.height` — and touches no export-only structure (media, `imageContentBounds`, masks/mattes). No
crop-specific export path was added, so the exporter reads the shifted document through its existing
authority. Evidence on this revision: `npm run qa:release` (the OGraf release gate: manifest validation plus
`e2e/ograf-editor-export.spec.ts` and `e2e/ograf-phase2d-interoperability.spec.ts`) is green, and the OGraf
specs of the full suite are green (section 7).

## 6. What the gate found, and what was done about it

The first FULL suite run at `3c62d85` reported **399 passed / 5 failed**: the two documented camera samples,
plus THREE failures this branch caused or exposed. Two were product defects and one was an ambiguous new test;
none was reported as red, none was skipped, retried or padded, and no assertion was weakened.

**6.1 `e2e/authoring-toolbar.spec.ts` — a callsite the crop feature missed (`3c62d85`).** The spec still
asserted the NINE pre-crop bands; the feature adds the `Crop` and `Crop to content` bands. The expected count
and the expected order now carry the two new bands, and the per-band check matches the label EXACTLY, because
`Crop` is a prefix of `Crop to content` and Playwright's default name matcher resolves that to two elements
(`getByRole('group', { name: 'Crop' })` → strict-mode violation). Everything else in that spec still runs: the
single hitbox/glyph size across every control, the tool and grid state checks, and the absence of Bind/Unbind.
**9/9.**

**6.2 `e2e/layer-binding.spec.ts:137` — a real snap-target defect, fixed in the product (`decc14e`).** The
pre-existing spec drags a parented child and requires its world delta to equal a parentless calibration
drag's. It failed by 4.98 world units on the first run: the child's target left edge came 4.98 units
(≈ 2.9 screen px, inside the 8px radius) from its BONDED PARTNER's frozen left edge, and the snap locked onto
it — a lock to a box the partner was itself leaving, because a bond moves its partners by the same world
delta (`updateCurrentTransform` propagates them). The snap context's moving set now expands through the bond
authority (`utils/partBinding`'s `resolveBondGroup`), exactly as it already drops the containers that carry a
moving layer. The spec passes **unchanged** — which is the strongest available evidence that the behaviour was
wrong — and it is the regression test for the fix.

**6.3 `e2e/named-sequence-v2.spec.ts:29` — a spec that measures a pure pointer delta (`9fd713a`).** It drags
a shape 40px down and requires the pose delta to be exactly that. The shape is created on the stage centre, so
its own top edge lands exactly on the stage's centre line at the end of the drag — a legitimate lock for the
feature — and the spec read the snapped pose (0.939px off). The spec now asserts the default and switches
snapping OFF for that measurement, with a comment saying why; every assertion is unchanged.

**6.4 `e2e/ae-layout-snapping.spec.ts` — the new threshold test was ambiguous (`9fd713a`, `55ed8c7`).** It
failed intermittently under load. Two independent causes were found from the failure itself, not by guesswork:

- The first version measured the miss by converting through the camera scale twice (once to build the world
  delta, once inside the drag helper). The stage box is measured asynchronously, so the two reads can
  disagree. The helper now reads the compared edges from the SAME rendered frame and moves the pointer by
  their difference (`9fd713a`).
- That was not the whole story: the test dragged Alpha toward Bravo's left edge and asserted the absence of
  ANY guide, but a moving box also carries its own centre and its far edge, and at the zoom the `-` keys
  actually reach Alpha's RIGHT edge crosses the stage's CENTRE line during that drag — inside the 8px radius.
  The failure named it: `guides=[x=300]` (the viewBox centre) with a 23.05px gap instead of 16px. Whether it
  fired depended on how many zoom steps landed, and that IS timing-dependent: the zoom handler reads
  `zoomRef`, which the render updates, so 13 `-` presses collapsed to 4 effective steps (`0.9^4 = 0.6561`)
  under load while they reached the `clampZoom` floor of `0.3` without it. The test now isolates ONE
  candidate — a single layer seeded at (0, −200), dragged toward the stage's LEFT edge, with the miss measured
  from the rendered layer box and the rendered artboard in the same frame — so the statement
  ("4 screen pixels lock, 16 do not") holds at whatever zoom the camera settles on (`55ed8c7`). The assertion
  messages now carry the guide's own line, both edges, the measured miss, the zoom and px-per-unit.
  Verified under the exact load that reproduced it (8 workers, `--repeat-each=3` over the snapping spec and
  seven heavy neighbours): **3/3 snapping runs green, 192 passed overall, only the documented camera pair
  failing.**

**6.5 Incidental observation (NOT caused by, and NOT fixed in, this branch).** The zoom handler computes
`clampZoom(zoomRef.current * 0.9)` and `zoomRef` is assigned during render, so `-`/`=` presses that arrive
inside one React commit collapse to a single step: 13 presses produced 4 effective steps under load and the
floor of `0.3` without it. It is pre-existing (untouched by every commit on this branch) and out of this
part's scope; it is recorded here because it is what made an otherwise deterministic test look flaky.

## 7. The gate

Isolated ports only (`PORT=5014` → API 5014, UI 5188 under `CI=1`); `npm run dev` was never used; 5173 and
5000 were never bound, stopped or restarted.

| Command | Result |
| --- | --- |
| `npm run build` | **green** — `tsc -b` clean, production build succeeded (2,075 modules) |
| `npm run validate:ograf` | **green** — `fixtures/ograf/minimal.ograf.json: valid OGraf v1 manifest` |
| `PORT=5014 npm run qa:release` | **green** — 2 passed (ograf interoperability + editor export) |
| `PORT=5014 npm run qa:v6` | **green** — 3 passed |
| Neighbouring Playwright specs (12 files, 8 workers) | **73 passed / 2 failed** — only the documented camera pair |
| `npm run check` | **green** as one command — oxlint clean, `tsc -b` clean, **168 files / 2,533 tests passed, 0 failed, 0 skipped**, build succeeded |
| `node scripts/check-state-consistency.mjs` | **PASS (50 checks)** |
| `npm audit --audit-level=low` | **0 vulnerabilities** |
| `git diff --check` | **clean** (exit 0), and over the branch range `802cebc..HEAD` |

Neighbouring specs (`CI=1 PORT=5014 npx playwright test … --retries=0`, 8 workers):
`ae-layout-crop`, `ae-layout-snapping`, `canvas-interaction-v1`, `editor-interaction`,
`editor-interaction-regressions`, `group-interaction`, `authoring-layer-group`, `authoring-toolbar`,
`camera-invariance`, `camera-transition-stability`, `coordinate-unit-v2`, `real-user-verification`.

**FULL Chromium suite** (`CI=1 PORT=5014 npx playwright test --retries=0`, 404 tests, 8 workers):

| Run | Revision | Result |
| --- | --- | --- |
| 1 | `3c62d85` | **399 passed / 5 failed** — the camera pair, plus the three failures of section 6 |
| 2 | `9fd713a` | **401 passed / 3 failed** — the camera pair, plus the still-ambiguous threshold test |
| 3 | `55ed8c7` | **402 passed / 2 failed** — only the documented camera pair |

### The two failures that remain, exactly as measured

Both are the pre-existing, load-sensitive `Show Inspector` family the Round-5 record already carries. Every
other trace in every run reported `worstDelta=0.000px` and `magnificationSpread=0.00000`.

| Run | Test | Reported failure |
| --- | --- | --- |
| Full 1 | `camera-transition-stability.spec.ts:231` | `inspector show: frame 6 t=137.5ms alpha x drifted -9.109px (stage 924.8px)` |
| Full 1 | `:259` | `repeat Show Inspector: frame 6 t=153.8ms alpha x drifted -28.859px (stage 1221.3px)` |
| Full 2 | `:231` | `inspector show: frame 5 t=126.9ms alpha x drifted -9.109px (stage 924.8px)` |
| Full 2 | `:259` | `repeat Show Inspector: frame 5 t=134.8ms alpha x drifted -28.859px (stage 1221.3px)` |
| Neighbours (12 files) | `:231` | `inspector show: frame 5 t=137.6ms alpha x drifted -28.859px (stage 885.3px)` |
| Neighbours (12 files) | `:259` | `repeat Show Inspector: frame 6 t=153.6ms alpha x drifted -28.859px (stage 1221.3px)` |
| **Full 3 (final)** | `:231` | `inspector show: frame 6 t=143.2ms alpha x drifted -28.859px (stage 885.3px)` |
| **Full 3 (final)** | `:259` | `repeat Show Inspector: frame 5 t=144.3ms alpha x drifted -28.859px (stage 1221.3px)` |

**Isolation on this revision (new, and worse than the Round-5 record).** Running only
`e2e/camera-invariance.spec.ts e2e/camera-transition-stability.spec.ts` at `--retries=0`:

- **2 workers: 7 passed / 2 failed.** `inspector show` and `repeat Show Inspector` each drifted **9.109px**
  (`inspector hide`, `repeat Hide Inspector`, the toolbar samples and the timeline samples: `0.000px`,
  `magnificationSpread=0.00000`).
- **8 workers: 8 passed / 1 failed.** `inspector show` drifted **9.109px**; `repeat Show Inspector` measured
  `0.000px` on this run.

The Round-5 record states these two samples were clean in isolation (`worstDelta=0.000px` on all traces, 9/0
at 2 workers and 4/0 at 8 workers). On this revision they are **not**: the `inspector show` sample reproduces a
one-frame 9.109px client-x excursion in isolation at both worker counts, and `repeat Show Inspector` reaches
28.859px under the full-suite load. Nothing on this branch touches the measured transition: the spec, its
`DRIFT_TOLERANCE_PX = 1` bound, `expectStable` and the `.property-inspector` `transition: width 240ms ease`
rule are all untouched, and the stage box geometry the traces print (`944x281 -> 584x281`, `1280x281 ->
920x281`) is identical to the Round-5 record's. **No comparison against the pre-branch revision was made**: the
Round-5 worktree and the canonical checkout are read-only for this task and no second checkout was created, so
the change in isolation behaviour is reported **without attribution** for the reviewer's decision. No
tolerance was widened, no retry added, no sleep inserted, no test skipped and no spec byte changed.

## 8. Push and the stacked PR

- Pushed with an explicit refspec: `git push -u origin HEAD:refs/heads/feat/ae-layout-crop-snapping`.
  **No force push, no `--force-with-lease`, no rebase, no history rewrite.**
- ONE PR: base `fix/manual-qa-round1-remediation` (PR #9's head), head `feat/ae-layout-crop-snapping`. The
  body states that it stacks on PR #9 and that PR #9 was not touched.
- PR #9 itself is OPEN, its branch and worktree were not modified, and nothing was merged.

__(PR NUMBER / URL / HEAD SHA / MERGEABILITY / CI)__

## 9. Live surfaces

- **5173** keeps serving the ROUND-5 worktree (`keyframe-character-studio-omp-manual-qa-r1`, vite listener pid
  50876, HTTP 200) — the user's QA surface for the pending Round 5 retest. It was deliberately NOT switched
  to this worktree.
- **API 5000** (pid 18280, `/api/health` 200) was never stopped or restarted.
- No merge, no tag, no release, no npm publication, no dependency/package/lockfile/workflow/OMP-config
  change, and the canonical checkout was never written to.

## 10. What was NOT done

- Nothing was merged: neither PR #9 nor the stacked PR.
- No all-animation-frames auto-crop (the two crop-to-content modes are current-frame only, and say so).
- 5173 was not re-pointed at this branch; the Round-5 preview remains the user's QA surface.
- The two pre-existing `Show Inspector` camera samples are reported, not fixed (section 7), and the pre-branch
  comparison was not made.
- The zoom-key collapse of section 6.5 was recorded, not fixed.

## 11. User retest checklist (after PR #9's rounds 1–5 retest)

Nothing here is merged, so this list is for the branch preview/CI review, not for 5173:

1. Layout — select three layers of DIFFERENT widths and run `Distribute horizontal spacing`: the two edge gaps
   become equal, the outer boxes' outer edges do not move, and the change is ONE undo step. Then run
   `Distribute horizontal`: the interior box's CENTRE is evenly spaced (the Round-5 behaviour).
2. Snapping — with `Toggle snapping` armed (the View band's default), drag a layer near the stage's edge, near
   its centre line and near another layer's edge: a guide appears and the layer locks; turn the switch off and
   the same drags are free; a dragged GROUP locks as one box; a BONDED partner never acts as a target.
3. Crop — arm `Crop / region of interest`, drag a region, and check the dimmer, the eight handles and the size
   readout; `Apply crop` (one undo step) sets the stage to the region and keeps the scene where it sat; the
   keyframes of every sequence scope moved with it; `Clear crop region` drops the region without cropping; a
   layer pinned by a stage anchor refuses with an explanation; `Crop to content` offers the current selection
   and the visible content at the CURRENT frame.
4. Export — the OGraf ZIP of a cropped, snapped and distributed scene still matches the editor.
