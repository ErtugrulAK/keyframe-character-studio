# KCS — ChatGPT upload one-file: AE-INSPIRED LAYOUT, CROP AND SNAPPING (stacked on PR #9)

Generated from the current `chatgpt_handoff/latest/` bundle plus `latest/OMP_FINAL_RESPONSE.md`.
Single current truth: **the branch is implemented, validated on a frozen revision, pushed and open as PR #10,
stacked on PR #9. Nothing is merged, PR #9 was not touched, and 5173 still serves the Round-5 worktree.**

---

## 1. Where this work lives

- Canonical stable checkout (untouched, still on `main` @ `8e2df61`, clean):
  `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`
- Worktree that carries this work: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-ae-layout`
- Branch `feat/ae-layout-crop-snapping`, base `origin/fix/manual-qa-round1-remediation` @ `04eee5e` (PR #9's
  head), head `cd8fe7c5f16e174ad8a5a7c5a42524e873eb0263` (`cd8fe7c`), pushed with an explicit refspec as a new
  branch — no force, no rebase, no history rewrite
- **Validated code revision: `55ed8c7`**; `cd8fe7c` adds the record and the changelog only
- **PR #10 — OPEN, not merged** (`https://github.com/ErtugrulAK/keyframe-character-studio/pull/10`), base
  `fix/manual-qa-round1-remediation`, head `feat/ae-layout-crop-snapping`, mergeable **MERGEABLE**, CI
  **CI Pipeline** run **`38565624999`** (`pull_request`) — **success**
- **PR #9 — OPEN and untouched** (`https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`, head
  `1168cee`): no commit, push, rebase, merge or worktree change on its side
- Commits (newest first): `cd8fe7c` (record + changelog + bundle mirror), `55ed8c7` (threshold test), `9fd713a`
  (the snapping-driven drag contracts in two specs), `decc14e` (a bonded partner is not a snap target),
  `3c62d85` (the toolbar band contract), `913f3a3` (stage crop + the snap coordinate-space fix), `802cebc`
  (smart snapping and guides), `0bf21c3` (layout geometry authority + equal-spacing distribution)

## 2. The features the source video asked for, and what they do

**2.1 One layout geometry authority** — `src/utils/layoutGeometry.ts` owns the union of evaluated boxes, their
centre and the world translation of a box; the vector arrange planner imports them instead of keeping a private
copy, so align, distribute and snapping cannot disagree about where a layer is. Every box is the canonical
evaluator's (`getLayerWorldBounds`), so a rotated or non-uniformly scaled layer and a group container measure
correctly.

**2.2 TWO distribution policies, both kept**

| Policy | Reference | Rule | Command |
| --- | --- | --- | --- |
| `planDistribute` (Round 5, unchanged) | box CENTRES | interior centres at an even step, extremes fixed | `Distribute horizontal` / `Distribute vertical` |
| `planDistributeByGap` (this branch) | EDGE GAPS | the outer two boxes' outer edges hold the span, interior EDGE GAPS equalised | `Distribute horizontal spacing` / `Distribute vertical spacing` |

They are separate commands because neither is expressible as the other without changing a shipped result: with
boxes of different widths the centre policy and the gap policy give different (both correct) layouts, and gap
spacing is the look a motion designer expects for unequal boxes.

**2.3 Smart snapping and guides**

- **Targets:** the stage box plus the box of every other VISIBLE outermost layer. A group snaps as ONE
  aggregate item (its children are never independent candidates), a container that carries the moving layer
  drops out (it would be the moving item's own box), and a BONDED partner is excluded because a bond moves it
  by the same world delta — it is leaving the box a snap would lock onto.
- **Threshold:** `SNAP_THRESHOLD_SCREEN_PX = 8`, a SCREEN radius converted through the camera scale at
  pointerdown, so the feel is identical at 25%, 100% and 400%.
- **Priority:** X and Y resolve INDEPENDENTLY (a corner lock is two axis snaps), the SMALLEST screen-delta
  candidate wins, and ties break deterministically by candidate order — stage first, then the layers in
  stacking order. A moving box competes with its own lines too (left/centre/right, top/middle/bottom), so a
  drag can legitimately lock its far edge as well as its leading edge.
- **Context and cost:** the candidate set and the moving box are frozen at pointerdown (the drag writes the
  moving layers on every move); snapping writes authored transforms, never the camera; the gesture keeps its
  single batch interaction, so one drag is one undo entry.
- **Surface:** a `Toggle snapping` switch beside the grid in the toolbar's View band, **armed by default**, and
  a decorative, pointer-events-none guide overlay that disappears with the snap or the drag.

**2.4 The coordinate-space fix this branch carries.** The stage bounds were built in EDITOR space
(`EDITOR_CAMERA_CENTER ± resolution/2`) while the moving box and the layer candidates were measured in the
project-relative world that `transform.x`/`transform.y` are authored in. A stage lock therefore either never
fired or drew its guide **660px** away from the geometry (660 = `EDITOR_CAMERA_CENTER.x` − stage half-width,
960) and locked the layer to a 240-offset world centre instead of the stage edge. Candidates, the moving box
and the stage box now live in ONE space (`±half the resolution`, the world), and the overlay adds the editor
camera origin only when it DRAWS. Proven load-bearing by a temporary probe (reverting it reproduced both the
660px offset and the wrong lock target); the probe is not in the tree. `e2e/ae-layout-snapping.spec.ts` asserts
the drawn guide's own `x1` is `300 − 960 = −660`.

## 3. Stage crop / region of interest

One authority (`src/utils/stageCrop.ts`), one command surface (`src/hooks/useStageCropAuthoring.ts`) shared by
the toolbar band and the stage overlay, so both cannot disagree about what a crop does or what it costs in
history.

- **Geometry:** the new stage size IS the region's size, and the region is clamped into the stage first — a
  crop can never hide pixels outside the new frame.
- **One uniform shift:** `dx = w/2 − roi.x − roi.w/2`, `dy = h/2 − roi.y − roi.h/2`, applied ONLY to the ROOT
  layers — exactly the layers the evaluator composes against nothing (`parentId ?? booleanGroupId`, only when
  that container exists). A child is container-local, so its container already carries it and shifting it twice
  would move it twice: world placement is preserved exactly.
- **Every frame moves with it:** every `x`/`y` channel keyframe of a shifted layer across every sequence scope
  (`templateId`), and the legacy composite `keyframes[].transform.x/y` list, so no frame of any authored
  sequence is left on the old origin.
- **Untouched:** rotation, scale, opacity, masks/mattes, groups, parent transforms, trim path, media and
  `imageContentBounds` — a crop is a reposition, not a re-parent.
- **A refusal, not a silent loss:** a root layer with `anchor !== 'none'` makes the command REFUSE with an
  explanation ("A layer pinned by a stage anchor cannot be moved by a crop. Set its anchor to None first."),
  because the evaluator pins that layer's position; the Apply control is disabled with that reason as its title.
- **TWO crop-to-content modes, both CURRENT-FRAME:** "Crop to current selection at current frame" (the
  collective evaluated box of the selection, folded through the same target logic the arrange commands use) and
  "Crop to visible content at current frame" (the evaluated box of every layer whose track is not hidden for
  editing). Both measure the EVALUATED bounds at the CURRENT authored frame and say so in their labels, because
  a layer that animates away from the region leaves the new frame at the frames that move it. **No
  all-animation-frames auto-crop was added** — it needs a bounds-over-all-frames pass this branch does not
  have, and shipping it under the same label would be a lie.
- **History and state:** the armed mode and the on-screen region are TRANSIENT authoring state — drawing or
  resizing a region is not undoable — and `Apply crop` is exactly ONE batch interaction: one undo entry that
  restores the previous stage size AND the previous positions together. A zero-area or full-stage region is a
  no-op with no history entry.
- **Authoring surface:** the region is authored in stage space (origin at the stage's top-left) and drawn back
  through the editor camera with eight resize handles, a dimmer outside the region and a live size readout; the
  pointer targets a handle by its drawn element, so the handle table and the hit test cannot drift. `Escape`
  drops the region, then leaves the mode, ahead of the freeform tool's own listener.

## 4. Export parity

The crop writes ONLY the fields the OGraf export already reads — the layer `x`/`y` channels, the static
`baseTransform`, and the project resolution that `src/ograf/compiler.ts` reads as `sceneData.width` /
`sceneData.height` — and touches no export-only structure (media, `imageContentBounds`, masks/mattes). No
crop-specific export path exists, so the exporter reads the shifted document through its existing authority, and
a snapped/distributed document is likewise unchanged in kind. Evidence on this revision: the OGraf release gate
(`npm run validate:ograf` plus `e2e/ograf-editor-export.spec.ts` and `e2e/ograf-phase2d-interoperability.spec.ts`
via `PORT=5014 npm run qa:release`) is green, and every OGraf spec of the full Chromium suite is green.

## 5. What the gate found, and what was done about it (nothing weakened)

The first FULL suite run on the pushed-before revision reported **399 passed / 5 failed**: the two documented
camera samples plus THREE failures this branch caused or exposed. Two were real defects and one was an
ambiguous new test; none was reported as red, skipped, retried, padded with a sleep, or fixed by widening a
tolerance.

1. **`e2e/authoring-toolbar.spec.ts` — a missed callsite** (`3c62d85`): the spec still asserted the NINE
   pre-crop bands; the feature adds `Crop` and `Crop to content`. The count and the order now carry them, and
   the per-band check matches the label EXACTLY because `Crop` is a prefix of `Crop to content`. Everything
   else still runs (one hitbox/glyph size across every control, the tool and grid state, no Bind/Unbind). 9/9.
2. **`e2e/layer-binding.spec.ts:137` — a real snap-target defect, fixed in the product** (`decc14e`): the
   dragged child's target left edge came 4.98 world units (≈ 2.9 screen px, inside the 8px radius) from its
   BONDED PARTNER's frozen left edge, and the snap locked onto it — a lock to a box the partner was itself
   leaving, since a bond moves its partners by the same world delta (`updateCurrentTransform` propagates them).
   The snap moving set now expands through `utils/partBinding`'s `resolveBondGroup`, exactly as it already
   drops the containers that carry a moving layer. The pre-existing spec passes **unchanged** and is the
   regression proof.
3. **`e2e/named-sequence-v2.spec.ts:29` — a spec that measures a pure pointer delta** (`9fd713a`): it drags a
   shape 40px down and requires exactly that pose delta, but the shape is created on the stage centre, so its
   own top edge lands on the stage's centre line at the end of the drag — a legitimate lock — and the spec read
   the snapped pose (0.939px off). It now asserts the default and switches snapping OFF for that one
   measurement, with a comment saying why; every assertion is unchanged.
4. **`e2e/ae-layout-snapping.spec.ts`'s new threshold test — two causes of ambiguity** (`9fd713a`, `55ed8c7`):
   (a) it converted through the camera scale twice for a single drag, and the stage box is measured
   asynchronously, so the two reads could disagree; (b) the REAL cause — a moving box also carries its own
   centre and far edge, and at the zoom the `-` keys actually reach, Alpha's RIGHT edge crosses the stage's
   CENTRE line during the very drag the test used. The failure named it: `guides=[x=300]` (the viewBox centre)
   with a 23.05px gap instead of 16px. Whether it fired depended on how many zoom steps landed, and that is
   timing-dependent: the zoom handler reads `zoomRef`, which the render updates, so 13 `-` presses collapsed to
   4 effective steps (`0.9^4 = 0.6561`) under load and reached `clampZoom`'s floor of `0.3` without it. The
   test now isolates ONE candidate — a single layer seeded at (0, −200), dragged toward the stage's LEFT edge,
   the miss measured from the rendered layer box and the rendered artboard in the same frame — so "4 screen
   pixels lock, 16 do not" holds at whatever zoom the camera settles on, and its failure message carries the
   guide's line, both edges, the measured miss, the zoom and px-per-unit. Verified 3/3 green under the exact
   load that reproduced it (8 workers, `--repeat-each=3` over the snapping spec and seven heavy neighbours:
   192 passed, only the camera pair failing).
5. **Incidental, pre-existing, NOT fixed (out of scope):** the zoom-handler/`zoomRef` collapse described in
   (4) — recorded because it is what made an otherwise deterministic test look flaky.

## 6. The gate and the exact numbers

Isolated ports only (`PORT=5014` → API 5014, UI 5188 under `CI=1`); `npm run dev` was never used; 5173 and 5000
were never bound, stopped or restarted.

| Command | Result |
| --- | --- |
| `npm run build` | green — `tsc -b` clean, production build succeeded (2,075 modules) |
| `npm run validate:ograf` | green — `fixtures/ograf/minimal.ograf.json: valid OGraf v1 manifest` |
| `PORT=5014 npm run qa:release` | green — 2 passed |
| `PORT=5014 npm run qa:v6` | green — 3 passed |
| Neighbouring Playwright specs (12 files, 8 workers) | **73 passed / 2 failed** — only the camera pair |
| `npm run check` (one command) | **green** — oxlint clean, `tsc -b` clean, **168 files / 2,533 tests passed, 0 failed, 0 skipped**, production build succeeded |
| `node scripts/check-state-consistency.mjs` | **PASS (50 checks)** — 52 once this record joined the bundle |
| `npm audit --audit-level=low` | **0 vulnerabilities** |
| `git diff --check` | clean (exit 0), and clean over `802cebc..HEAD` |
| FULL Chromium suite (`CI=1 PORT=5014 … --retries=0`, 404 tests, 8 workers) | run 1 `3c62d85`: **399 / 5 failed**; run 2 `9fd713a`: **401 / 3 failed**; run 3 `55ed8c7`: **402 passed / 2 failed** |

### The two remaining failures, exactly as measured

`e2e/camera-transition-stability.spec.ts:231` (`inspector show`) and `:259` (`repeat Show Inspector`) — the
pre-existing, load-sensitive family the Round-5 record already carries. Final run: `:231` → `inspector show:
frame 6 t=143.2ms alpha x drifted -28.859px (stage 885.3px)`; `:259` → `repeat Show Inspector: frame 5
t=144.3ms alpha x drifted -28.859px (stage 1221.3px)`. Earlier runs measured `9.109px` at `:231` and
`28.859px` at `:259`. Every trace in every run reported `magnificationSpread=0.00000`, and every other trace
(`inspector hide`, `repeat Hide Inspector`, the toolbar samples, the timeline samples) reported
`worstDelta=0.000px`.

**Isolation on this revision is WORSE than the Round-5 record, and is reported as such:** running only
`e2e/camera-invariance.spec.ts e2e/camera-transition-stability.spec.ts` gave **2 workers 7 passed / 2 failed**
and **8 workers 8 passed / 1 failed**, both with a **9.109px** excursion on `inspector show`, where the Round-5
record measured `0.000px` in isolation at both worker counts. Nothing on this branch touches the measured
transition — the spec, its `DRIFT_TOLERANCE_PX = 1` bound, `expectStable` and the `.property-inspector`
`transition: width 240ms ease` rule are untouched, and the stage geometry the traces print
(`944x281 -> 584x281`, `1280x281 -> 920x281`) is identical to the Round-5 record's. **No comparison against
the pre-branch revision was made**: the Round-5 worktree and the canonical checkout are read-only for this
task and no second checkout was created, so the change in isolation behaviour is reported **without
attribution** for the reviewer's decision. No tolerance was widened, no retry added, no sleep inserted, no test
skipped and no spec byte changed.

## 7. Standing contracts (unchanged by this branch)

- **FPS/TIMEBASE:** one mapping between frames and time (`src/utils/timebase.ts`); playback is elapsed-time
  driven, so a monitor's refresh rate cannot change a duration. The GIF export keeps its 60 FPS cap; there is
  no video export.
- **Undo transaction:** one continuous gesture = ONE undo entry (opened on the press, closed on release,
  cancel or lost pointer capture). Every command of this branch respects it: a snap, a distribute, a crop and
  both crop-to-content commands each produce exactly one entry.
- **Reality Hub timing** and the macOS ZIP item remain final manual-QA pending with no product change.

## 8. PR, CI, live surfaces, and what was NOT done

- Pushed with an explicit refspec (`git push -u origin HEAD:refs/heads/feat/ae-layout-crop-snapping`) — no
  force, no `--force-with-lease`, no rebase, no history rewrite.
- **PR #10 — OPEN, not merged**, stacked on PR #9, base `fix/manual-qa-round1-remediation`, head
  `feat/ae-layout-crop-snapping`, head `cd8fe7c5f16e174ad8a5a7c5a42524e873eb0263`, mergeable **MERGEABLE**;
  CI **CI Pipeline** run **`38565624999`** (`pull_request`) — **success**
- **PR #9 — OPEN, untouched, not merged**; its branch, worktree and pushed head are unchanged.
- **5173 keeps serving the ROUND-5 worktree** (vite listener pid 50876, HTTP 200) — the user's QA surface and
  the merge gate for PR #9 — and was deliberately NOT switched to this branch.
- **API 5000** (pid 18280, `/api/health` 200) was never stopped or restarted.
- NOT done: no merge of anything; no all-animation-frames auto-crop; no re-pointing of 5173; no fix of the two
  pre-existing camera samples; no fix of the zoom-key collapse; no tag, release, npm publication,
  dependency/package/lockfile/workflow/OMP-config change, and no write to the canonical checkout.

## 9. User retest checklist (for PR #10's review; the 5173 retest still belongs to PR #9)

1. **Layout** — select three layers of DIFFERENT widths and run `Distribute horizontal spacing`: the two edge
   gaps become equal, the outer boxes' outer edges do not move, and it is ONE undo step. Then run
   `Distribute horizontal`: the interior box's CENTRE is evenly spaced (the Round-5 behaviour, kept).
2. **Snapping** — with `Toggle snapping` armed (the View band's default), drag a layer near the stage's edge,
   near its centre line and near another layer's edge: a guide appears and the layer locks. Turn the switch off
   and the same drags are free. A dragged GROUP locks as one box, and a BONDED partner is never a target.
3. **Crop** — arm `Crop / region of interest`, drag a region and check the dimmer, the eight handles and the
   size readout; `Apply crop` (one undo step) sets the stage to the region and keeps the scene where it sat,
   with every sequence scope's keyframes moved with it; `Clear crop region` drops the region without cropping;
   a layer pinned by a stage anchor refuses with an explanation; `Crop to content` offers the current selection
   and the visible content at the CURRENT frame.
4. **Export** — the OGraf ZIP of a cropped, snapped and distributed scene still matches the editor.

## 10. Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. No other file in the `latest` bundle needs to be
uploaded.
