# Camera transition blocker — the inspector's one-frame compensation lag (remediation record)

Branch: `fix/manual-qa-round1-remediation` (existing; PR #9 stays open, not merged).
Base: `origin/main` @ `8e2df61`. Worktree: `keyframe-character-studio-omp-manual-qa-r1`.

Scope: fix the deterministic camera-transition drift blocker recorded by manual QA round 5 — the right
inspector's SHOW transition paints one frame with NEW stage geometry and OLD camera compensation — with
a root-cause fix only. No feature work, no tolerance widening, no retry, no sleep, no disabled
animation, no final-frame-only workaround, no merge, no release, no tag, no npm publication, no force
push, no rebase and no package/dependency/workflow change.

## Result summary

| Item | Result |
| --- | --- |
| Reproduced (before any edit) | `camera-transition-stability.spec.ts` at 8 workers, `--retries=0`: `--repeat-each=3` on the camera family gave **5 failed / 22 passed**, and `--repeat-each=5` on the transition spec alone gave **8 failed / 12 passed** — every failure is `inspector show`, every one of them exactly **9.109375px** or **28.859375px** of single-frame world drift |
| Root cause | The inspector's `transition: width 240ms ease` moved the stage box inside the frame's own style/layout step, while the camera could only learn the new box from the `ResizeObserver` on `.stage-canvas-container`; when Chromium delivered a size gathered from an earlier layout, that one painted frame carried the new box with the previous box's compensation |
| Fix | ONE layout authority (`src/utils/workspaceLayout.ts`): the timeline's `commitWorkspaceLayout` moved there and shared, plus `createFrameEase` (the R5-03 frame-committed ease) and `panelEdgeStyle`. Both docked panels (`useDockedPanelEdge`) ease their edge frame by frame and commit the width **and** the stage's re-measure in the same task, inside the frame's callback, before anything is painted. The panels' width/min-width/flex-basis transitions are removed; the `ResizeObserver` stays the measurement fallback and now skips a box it already committed |
| Targeted stress | `--repeat-each=10 --workers=8 --retries=0`: **60 passed / 0 failed**, `worstDelta=0.000px` on every sampled trace |
| Camera family | `e2e/camera-transition-stability.spec.ts e2e/camera-invariance.spec.ts --repeat-each=5 --workers=8 --retries=0`: **55 passed / 0 failed** |
| FULL Chromium | `npx playwright test --workers=8 --retries=0`: **398 passed / 0 failed / 0 flaky** (398 = the previous round's 396 plus this round's two new camera tests) |
| Local gate | `npm run check` green (lint, `tsc`, **166 files / 2,482 tests**, build); `node scripts/check-state-consistency.mjs` PASS (52 checks); `npm run validate:ograf`, `PORT=5015 npm run qa:release` (2 passed) and `PORT=5015 npm run qa:v6` (3 passed) green; `npm audit --audit-level=low` 0 vulnerabilities; `git diff --check` clean |
| Specs | `e2e/camera-transition-stability.spec.ts` strengthened (double mid-edge reversals both ways, short/narrow/wide viewports, the panel's own edge monotone and inline-free at rest); `e2e/v51-recovery.spec.ts`'s inspector test migrated off the browser-side width transition it asserted; `src/tests/workspaceLayout.test.ts` covers the shared ease's contract. `DRIFT_TOLERANCE_PX = 1` unchanged, no retry, no sleep, no skip |
| Live surfaces | 5173 HTTP 200 serving THIS worktree (vite listener pid 50876); API 5000 healthy (pid 18280) — neither was stopped or restarted |

---

## 1. The finding, reproduced before touching anything

**The reproduction (measured, not inferred).** On the frozen revision, with the exact load profile:

```
CI=1 PORT=5015 npx playwright test e2e/camera-transition-stability.spec.ts --workers=8 --retries=0 --repeat-each=5
```

gave **8 failed / 12 passed**, and every failure was the inspector's SHOW sample:

- `the right inspector never counter-moves the world while it animates` —
  `inspector show: frame 6 t=136.1ms alpha x drifted -9.109px (stage 924.8px)`
- `repeated chrome toggles never drift the world on any frame` —
  `repeat Show Inspector: frame 5 t=137.6ms alpha x drifted -28.859px (stage 1221.3px)`

The `--repeat-each=3` camera-family profile gave the same two test names with the same two magnitudes
(**5 failed / 22 passed**). Every failing sample is the FIRST offending frame of its sample (the
assertion stops there), the drift is always negative x, and HIDE, the left toolbar and the timeline
were clean in all of those runs.

**What the numbers mean.** The stage box changes by `delta` in a frame; the panel is anchored at the
stage's left edge, so a one-frame-late compensation moves the world by exactly `delta / 2`. The
recorded 28.859375px is half of a **57.719px** stage-width step, and 9.109375px is half of
**18.219px** — both are one frame of the inspector's own 240ms width transition. That is the "half the
width delta" signature the round-5 report described, and it is deterministic, not a flake: the same
two frames and the same two magnitudes came back in every run of the profile.

## 2. Instrumentation — which frame, and which box it was compensating for

Temporary diagnostics (removed before the commit) recorded, per painted frame, the stage container's
rect, the SVG's rendered screen CTM (the value the assertion reads), the panel's width and the
panel's inline width; and, per layout commit, the box the camera folded in, its source
(`resize-observer` vs. the remeasure command) and the `ResizeObserver`'s own reported size.

The failing SHOW frame, and the commit that produced its compensation:

```
stage commits: 2884ms:resize-observer:w=943.00(ro=943.00) 2891ms:resize-observer:w=924.72(ro=924.72) ...
>> STALE f 5 t=126.9 insp=19.22 stageW=924.781 tx=-179.500   drift=-9.109
        f 6 t=134.8 insp=59.13 stageW=884.875 tx=-170.273   drift=-19.836
```

- The frame painted the stage box **924.781px** while the SVG carried `tx = -179.500` — the
  compensation for a stage box of **943.00px** (the loop's own field `txForLiveCentre` prints the
  value the live box needs: **-170.391**).
- The compensation came from the `ResizeObserver` callback that had reported **`w=943.00`**. The next
  callback (`w=924.72`) painted the correct `-170.391` on the very next frame.
- `943.00 − 924.781 = 18.219`, and half of that is **9.109** — the drift on that frame, exactly.
- The panel's width at that frame was **19.2px**, the CSS transition's first real step
  (`360px × ease(1/14.4)`), and the compensation was for the frame when the panel's outer box was
  still **1.00px** (`width: 0` plus the panel's own non-transitioned 1px `border-left`, which
  `box-sizing: border-box` keeps as a 1px outer box).
- One run even recorded two stale frames in a row (f5 `-9.109`, f6 `-19.836`): the compensation
  trailed one frame twice, which is what "delayed correction" looks like from the DOM.

HIDE, in the same page and the same run, never showed it — every callback reported its own frame's
size (`683@603.2/live603.2`, `700@642.8/live642.8`, …), so every frame had matching geometry and
compensation and `worstDelta` stayed `0.000px`. That asymmetry is structural: on HIDE the first layout
after the class flip is the transition's own first step (`width: 0` and `border-left: 0` together, so
no size change at progress 0), while on SHOW the border reappears instantly and makes the first layout
a discrete 1.00px state that a deferred report can straddle.

## 3. Root cause (proven)

The stage camera is a **projection of the stage box**: the SVG's translate is
`camera centre − stage box centre`, so a box the DOM has already changed but the camera has not yet
been told about paints the authored world against a box it no longer has — the visible counter-move of
the scene.

The inspector's width was animated by the browser (`PropertyInspector.css` declared
`transition: width 240ms ease, min-width …, flex-basis …, transform …, opacity …`, and a later
`.motion-design-right-sidebar` rule in the same file re-declared the same list and won), so the panel's
box moved inside the frame's own style/layout step. The only thing that told the camera about the new
box was the asynchronous `ResizeObserver` on `.stage-canvas-container` — and a `ResizeObserver`
notification reports **the size that was gathered**, which Chromium may deliver after the frame that
already painted a newer box has gone out. One painted frame of new geometry with old compensation
follows, and its magnitude is exactly half the stage-width step of that frame.

Round 5 had already replaced the timeline's `transition: height` with a frame-committed JS ease for
the same reason (5.883px of transient drift); the inspector had been left on the browser-side
transition, which is why the blocker survived that round and why PR #10 — whose only camera-adjacent
changes are crop/snap authoring in `StageCanvas.tsx` — inherited it unchanged.

## 4. The fix — one layout authority

`src/utils/workspaceLayout.ts` is now the single authority for workspace geometry:

- `commitWorkspaceLayout(apply)` — the function the timeline already used, moved out of
  `SequencerTimeline.tsx` and shared: `flushSync(apply)` then the `remeasure-stage-box` command, so the
  size write and the stage's re-measure land in ONE task.
- `createFrameEase(write, settle)` — the R5-03 frame-committed ease, extracted and shared: one
  monotone ease-out cubic frame at a time, an exact final value, and a re-target that continues from
  the value the running frame last wrote.
- `panelEdgeStyle(width)` — how a travelling edge is expressed (`width`, `min-width`, `flex-basis` in
  border-box pixels), so both docked panels describe their edge the same way.
- `PANEL_EDGE_TRANSITION_MS = 240` — the duration the browser-side transition it replaces used.

`src/hooks/useDockedPanelEdge.ts` drives a docked panel's edge:

1. The toggle measures the width the panel has **right now** — the in-flight interpolated width if one
   is running, otherwise the resting width the stylesheet resolved — *before* the target class flips.
2. It hands the width back to the stylesheet and flips the target class in ONE `commitWorkspaceLayout`,
   which also folds the box that class resolves to into the camera, and then reads that box's width as
   the animation's target. The stylesheet therefore remains the single source of both resting widths
   (the inspector's `min(360px, max(250px, 34vw))` clamp included) — nothing is re-derived in JS.
3. Each animation frame writes one interpolated width through `commitWorkspaceLayout`, so the panel's
   box and the camera correction are committed in the same task, inside the frame's callback, before
   that frame paints.
4. The settle frame clears the inline width, so the resting width is the stylesheet's exact value and
   never a rounded copy of it.

Both docked panels use it (`src/App.tsx`): the right inspector and the left toolbar. The geometry
(`width`, `min-width`, `flex-basis`) is removed from both panels' transition lists, so the browser can
never animate the box the camera is a projection of; the `.hidden` dock's geometry stopped being
`!important` because an `!important` stylesheet declaration beats an inline style. The non-geometric
polish (slide, fade, border, shadow, visibility) is untouched, so opening and closing read as they did.
`prefers-reduced-motion` still snaps to the target through the same path.

`applyStageBox` gained one guard: a frame-committed edge has already folded the exact box in, so the
observer skips a box identical to the one it is holding. The `ResizeObserver` remains the fallback for
every layout change nobody committed (window resize, mode switches, drawers, broadcast).

## 5. Validation

See the result summary above for the numbers; the commands were:

- Reproduction and stress: `CI=1 PORT=5015 npx playwright test e2e/camera-transition-stability.spec.ts --workers=8 --retries=0 --repeat-each=10`
- Camera family: `... e2e/camera-transition-stability.spec.ts e2e/camera-invariance.spec.ts --workers=8 --retries=0 --repeat-each=5`
- Full Chromium: `CI=1 PORT=5015 npx playwright test --workers=8 --retries=0`
- `npx tsc -b --pretty false`, `npm run lint`, `npm test`, `npm run build`, `npm run validate:ograf`,
  `PORT=5015 npm run qa:release`, `PORT=5015 npm run qa:v6`, `npm run check`,
  `node scripts/check-state-consistency.mjs`, `npm audit --audit-level=low`, `git diff --check`

No tolerance was raised, no retry added, no sleep inserted, no test skipped, no assertion weakened and
no animation disabled or shortened.

## 6. Why PR #10's isolation run showed 9.109px where round 5 showed 0.000px (read-only comparison)

Compared `04eee5e` (PR #9's head) with `74603de` (PR #10's head, worktree
`keyframe-character-studio-omp-ae-layout`) with `git diff` only — nothing in that worktree was
modified.

- Among every camera/layout/chrome authority, PR #10 changes **exactly two files**:
  `src/components/Canvas/StageCanvas.tsx` (+285/−7) and `src/components/Canvas/StageCanvas.css` (+72).
- `src/utils/viewportMath.ts` (the camera model and `getStageCameraTransform`), `src/App.tsx`,
  `src/components/Timeline/*` and `src/components/Inspector/*` are **byte-identical** between the two
  heads — no diff at all.
- The StageCanvas diff is crop/snap authoring: new crop drag modes, snap guides, crop rect state, a
  `useStageCropAuthoring` hook, `layoutGeometry`/`stageCrop` helpers. Grepping the diff for every
  camera-timing line (`applyStageBox`, `readStageBox`, `ResizeObserver`,
  `getStageCameraTransform`, `stageBox`, `flushSync`, `remeasure`, `canvas-viewport-command`,
  `transformOrigin`, the `<svg>` element, `stage-canvas-container`) matches **one** line: the extra
  `crop-mode` class on the stage container. The CSS diff adds only decorative overlay rules
  (`.crop-mode { cursor: crosshair }`, `.snap-guide`, the crop dimmer/region) — no geometry and no
  transition.
- Conclusion: the failure is **inherited from PR #9, not amplified by PR #10**. It is the same
  inspector `transition: width 240ms` + asynchronous `ResizeObserver` race, and the chosen magnitude
  is timing/load-sensitive: the drift is exactly half of the stage-width step the CSS transition
  advanced between the deferred observer report and the paint, so a busier frame shows a bigger
  number. Round 5's 0.000px isolation record and the 9.109px record differ in frame timing, not in
  code; the fix above removes the class of failure for both heads because it lives in the shared
  inspector/layout authority that PR #10 does not touch.

## 7. What was NOT done

- No merge of PR #9 or PR #10; no tag, release or npm publication; no force push, rebase or reset.
- The canonical repo, the PR #10 worktree and `origin/without-mask` were not touched (the PR #10
  comparison in section 6 is read-only).
- 5173 and 5000 were never bound, stopped or restarted.
