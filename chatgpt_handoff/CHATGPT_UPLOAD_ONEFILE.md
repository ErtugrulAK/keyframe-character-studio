# KCS camera-transition blocker — remediation one-file handoff

Branch `fix/manual-qa-round1-remediation` (PR #9, open, NOT merged). Worktree
`C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1`. This record answers one
question: why the right inspector's SHOW transition painted a frame of new stage geometry with old camera
compensation, and what was changed so it cannot. Manual QA rounds 1–5 (A–J, R2-01…R2-12, R3-01…R3-13,
R4-01…R4-16, R5-01…R5-15) are recorded in `reports/progress_165…171_*` and unchanged by this round.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. No other file in this bundle needs uploading.

---

## 1. The failure, reproduced before any edit

```
CI=1 PORT=5015 npx playwright test e2e/camera-transition-stability.spec.ts --workers=8 --retries=0 --repeat-each=5
```

**8 failed / 12 passed.** Every failure is the inspector's SHOW sample, and they are deterministic:

| Test | Recorded failure |
| --- | --- |
| `the right inspector never counter-moves the world while it animates` | `inspector show: frame 6 t=136.1ms alpha x drifted -9.109px (stage 924.8px)` |
| `repeated chrome toggles never drift the world on any frame` | `repeat Show Inspector: frame 5 t=137.6ms alpha x drifted -28.859px (stage 1221.3px)` |

The camera-family profile (`… e2e/camera-transition-stability.spec.ts e2e/camera-invariance.spec.ts
--repeat-each=3`) gave the same two test names with the same two magnitudes: **5 failed / 22 passed**.
HIDE, the left toolbar and the timeline were clean in every run, and the wonder point of the spec
(`DRIFT_TOLERANCE_PX = 1`) was never touched.

**Why 28.859px.** The panel is anchored to the stage's left edge, so a compensation that is one frame late
moves the authored world by exactly half of the stage box's step in that frame:
`28.859375 × 2 = 57.71875px`, and `9.109375 × 2 = 18.21875px` — both are one frame of the inspector's own
240ms width transition. That is the "one painted frame with new geometry and the previous frame's
compensation" signature.

## 2. Root cause (proven at frame level, not inferred)

The stage camera is a **projection of the stage box**: the SVG's translate is
`camera centre − stage box centre`, so a box the DOM has already changed but the camera has not yet been
told about paints the authored world against a box it no longer has.

The inspector's width was animated by the browser: `PropertyInspector.css` declared
`transition: width 240ms ease, min-width …, flex-basis …, transform …, opacity …`, and a later
`.motion-design-right-sidebar` rule in the same file re-declared the same list and therefore won. The panel
moved inside the frame's own style/layout step, and the only thing that could tell the camera about the new
box was the asynchronous `ResizeObserver` on `.stage-canvas-container` — which reports **the size it
gathered**, and which Chromium may deliver after the frame that already painted a newer box has gone out.

Temporary instrumentation (removed before the commit) recorded the failing frame and the commit that
produced its compensation:

```
stage commits: 2884ms:resize-observer:w=943.00(ro=943.00) 2891ms:resize-observer:w=924.72(ro=924.72) …
>> STALE f 5 t=126.9 insp=19.22 stageW=924.781 tx=-179.500   drift=-9.109
        f 6 t=134.8 insp=59.13 stageW=884.875 tx=-170.273   drift=0.000
```

- The frame painted the stage box **924.781px** with `tx = -179.500` — the compensation for a box of
  **943.00px** (instrumentation printed `-170.391` as the value the live box needs).
- The compensation came from the observer callback that had reported **`w=943.00`**; the next callback
  (`w=924.72`) painted the correct value on the following frame.
- `943.00 − 924.781 = 18.219`, and half of it is **9.109** — the drift on that frame, exactly.
- That frame's panel width was **19.2px** (the CSS transition's first real step, `360 × ease(1/14.4)`),
  and the compensation belonged to the frame when the panel's outer box was still **1.00px**
  (`width: 0` plus the panel's own non-transitioned 1px `border-left`, which `box-sizing: border-box` keeps
  as a 1px outer box).
- One run recorded two stale frames in a row (`-9.109px`, then `-19.836px`) — the same lag twice.
- HIDE, in the same page and the same run, never showed it: every callback reported its own frame's size
  (`683@603.2/live603.2`, `700@642.8/live642.8`, …), so geometry and compensation always matched. HIDE's
  first layout after the class flip is the transition's own first step (`width: 0` and `border-left: 0`
  together — no size change at progress 0), while SHOW's is the discrete 1.00px state a deferred report can
  straddle.

Round 5 had already replaced the timeline's `transition: height` with a frame-committed JS ease for this
same reason (5.883px of transient drift); the inspector had been left on the browser-side transition, which
is why the blocker survived that round.

## 3. The implementation

One layout authority, not a second one:

- **`src/utils/workspaceLayout.ts`** — `commitWorkspaceLayout(apply)` (the function the timeline already
  used: `flushSync(apply)` then the stage's `remeasure-stage-box` command, so a size write and the camera's
  correction land in ONE task), `createFrameEase(write, settle)` (the R5-03 frame-committed ease, extracted
  from the timeline and now shared: one monotone ease-out cubic frame at a time, an exact final value, and a
  re-target that continues from the value the running frame last wrote), `panelEdgeStyle(width)` (how a
  travelling edge is expressed: `width`, `min-width`, `flex-basis` in border-box pixels) and
  `PANEL_EDGE_TRANSITION_MS = 240`.
- **`src/hooks/useDockedPanelEdge.ts`** — drives a docked panel's edge. The toggle measures the width the
  panel has RIGHT NOW (the in-flight interpolated width if one is running, otherwise the resting width the
  stylesheet resolved) before the target class flips; hands the width back to the stylesheet and flips the
  target class in ONE commit (which also folds the box that class resolves to into the camera); reads that
  box's width as the animation's target, so the **stylesheet stays the single source of both resting
  widths** (the inspector's `min(360px, max(250px, 34vw))` clamp included — nothing is re-derived in JS);
  writes one interpolated width per animation frame through `commitWorkspaceLayout`, so the box and the
  camera correction are committed before that frame paints; and clears the inline width on the settle frame,
  so the resting width is the stylesheet's exact value. Rapid re-toggling cancels the in-flight frame and
  eases from the interpolated width — no jump, no second animation.
- **Both docked panels use it** (`src/App.tsx`): the right inspector and the left dock. `width`,
  `min-width` and `flex-basis` are gone from both transition lists, so the browser can never animate the box
  the camera is a projection of. The `.hidden` dock's geometry is no longer `!important` (an `!important`
  stylesheet declaration beats an inline style, which would have blocked the travelling width). The slide,
  fade, border, shadow and `visibility` polish is unchanged; `prefers-reduced-motion` still snaps to the
  target through the same path.
- `applyStageBox` gained one guard: a frame-committed edge has already folded the exact box in, so the
  observer skips a box identical to the one it holds. The `ResizeObserver` remains the measurement fallback
  for every layout change nobody committed (window resize, mode switches, drawers, broadcast).

## 4. Validation (all on isolated ports; 5173/5000 never bound, stopped or restarted)

| Gate | Result |
| --- | --- |
| Repro before the fix | **8 failed / 12 passed** (transition spec, `--repeat-each=5`) and **5 failed / 22 passed** (camera family, `--repeat-each=3`) |
| Targeted stress | `--repeat-each=10 --workers=8 --retries=0`: **60 passed / 0 failed**, `worstDelta=0.000px` on every sampled trace |
| Camera family | `--repeat-each=5 --workers=8 --retries=0`: **55 passed / 0 failed** |
| **FULL Chromium** | `npx playwright test --workers=8 --retries=0`: **398 passed / 0 failed / 0 flaky** (396 previous + this round's 2 new camera tests) |
| Local gate | `npm run check` green (lint, `tsc`, **166 files / 2,482 tests**, production build); `node scripts/check-state-consistency.mjs` PASS (52 checks); `npm run validate:ograf` valid; `PORT=5015 npm run qa:release` 2 passed; `PORT=5015 npm run qa:v6` 3 passed; `npm audit --audit-level=low` 0 vulnerabilities; `git diff --check` clean |

No tolerance was widened (`DRIFT_TOLERANCE_PX` is still 1), no retry added, no sleep inserted, no test
skipped, no assertion weakened, no animation disabled and no duration shortened.

**Specs.** `e2e/camera-transition-stability.spec.ts` gained two tests — double mid-edge reversals in both
directions (toggles scheduled relative to the click that landed, so they are genuinely mid-edge on a loaded
page) and the whole inspector contract at a short, a clamped-narrow and a wide viewport (the docked width
must come back to the stylesheet's exact value with no inline override left behind) — and its
single-direction samples now also assert the panel's own edge visits intermediate widths in ONE direction.
`e2e/v51-recovery.spec.ts`'s inspector test was **migrated, not relaxed**: it had asserted the panel's
browser-side `transition: width 0.24s`, which is precisely the mechanism this fix removes, and now asserts
the geometry is absent from the transition list, that the non-geometric polish keeps its 240ms, and that the
travelling inline width is handed back when the edge settles. Four new unit tests pin the shared ease's
contract (one monotone value per frame, an exact settle, a re-target from the interpolated value, a cancel
that stops writing).

## 5. PR #10 comparison (read-only; that worktree was never modified)

`git diff 04eee5e 74603de` (PR #9's head vs PR #10's head `feat/ae-layout-crop-snapping`):

- Among all camera/layout/chrome authorities PR #10 changes exactly two files:
  `src/components/Canvas/StageCanvas.tsx` and `src/components/Canvas/StageCanvas.css`.
- `src/utils/viewportMath.ts` (the camera model and `getStageCameraTransform`), `src/App.tsx`,
  `src/components/Timeline/*` and `src/components/Inspector/*` are **byte-identical** between the heads.
- The StageCanvas diff is crop/snap authoring; grepping it for every camera-timing line
  (`applyStageBox`, `readStageBox`, `ResizeObserver`, `getStageCameraTransform`, `stageBox`, `flushSync`,
  `remeasure`, `canvas-viewport-command`, the `<svg>`, `stage-canvas-container`) matches ONE line — the
  extra `crop-mode` class. The CSS adds only decorative overlay rules (no geometry, no transition).
- **Conclusion: the failure is inherited from PR #9, not amplified by PR #10** — the same inspector
  transition/observer race, with a load-sensitive magnitude (half of one frame's stage-width step). Round
  5's 0.000px isolation record and the 9.109px record differ in frame timing, not in code.

## 6. Pull request, live surfaces and protected state

- **PR #9 — OPEN, NOT merged**: `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`.
  Validated code + tests head **`42d89d5`** (`42d89d588d48a00682ee111702dbfb92179c08f4`); the round record
  is the commit above it; the handoff refresh (this bundle) rides on top. Pushed as a **fast-forward**
  (`04eee5e..a3c2e04`) with an explicit refspec — no force, no rebase.
- **Live surfaces:** 5173 serves THIS worktree (vite listener pid 50876, HTTP 200); API 5000 (pid 18280)
  unchanged and `/api/health` 200. Only isolated test ports were used (UI 5188 / API 5015), and
  `npm run dev` was never run.
- **No merge, no tag, no release, no npm publication.** `main`, `origin/main`, the canonical checkout, every
  other worktree, the release tags and the published `v1.1.0-rc.2` prerelease were preserved; no
  dependency/package/lockfile/workflow/OMP-config change.

## 7. Concise user retest (on 5173)

1. Open a project, select a layer, and **show/hide the right inspector** repeatedly — the scene must not
   slide left/right while the panel moves, and the panel must travel the same 240ms as before.
2. With the inspector mid-animation, click the toggle again (rapid show→hide and hide→show) — the panel must
   reverse from where it is, with no jump and no second animation, and the scene must stay put.
3. Do the same with the **left dock**, then resize the **timeline** and toggle either sidebar while the
   timeline edge is still moving — the stage keeps cropping, never moving the authored world.
4. Watch the inspector at a narrow window (the panel's `min(360px, max(250px, 34vw))` clamp) and at a wide
   one — the resting width must be exactly what it was before the toggle.

Expected: the world point under the cursor never drifts, the magnification never changes, and every edge
still eases. Report anything that moves with the exact frame and the two widths involved.
