# OMP final response — camera-transition blocker remediation

Status: **the inspector SHOW drift blocker is fixed at its root, validated on `42d89d5`; PR #9 updated. Not
merged.**

## What was delivered

The right inspector's SHOW transition painted one frame of NEW stage geometry with OLD camera compensation —
round 5's one open, reported item. It is now fixed, and the left dock's identical race went with it.

- **Root cause.** The panels animated their width with a browser-side `transition: width 240ms ease`
  (`PropertyInspector.css` declared it once and a later `.motion-design-right-sidebar` rule re-declared the
  same list and won; `.left-toolbar-container` carried the same list with `!important`). The stage box
  therefore moved inside the frame's own style/layout step, and the camera — a projection of that box — could
  only learn the new box from the asynchronous `ResizeObserver` on `.stage-canvas-container`, which reports
  the size it *gathered* and which Chromium may deliver after the frame that already painted a newer box.
  One painted frame with the new box and the previous box's compensation follows, i.e. half of that frame's
  stage-width step.
- **Measured.** Instrumentation recorded the observer committing `w=943.00` in the same frame whose paint
  carried the stage box `924.781px` with the compensation for `943.00` (`tx=-179.500` where `-170.391` is
  correct): `(943.00 − 924.781) / 2 = 9.109px` of world drift on that frame and none on the next; one run
  recorded two such frames in a row. HIDE never drifted, because its first layout after the class flip is the
  transition's own first step while SHOW's is a discrete `1.00px` state (`width: 0` plus the panel's own
  non-transitioned 1px `border-left`) that a deferred report can straddle. Reproduced before any edit:
  **5 failed / 22 passed** (camera family, `--repeat-each=3`) and **8 failed / 12 passed** (transition spec,
  `--repeat-each=5`), every failure the inspector SHOW sample at exactly `9.109375px` or `28.859375px`
  against the spec's 1px bound.
- **Fix — ONE layout authority.** `src/utils/workspaceLayout.ts` owns `commitWorkspaceLayout` (moved out of
  the timeline and shared), `createFrameEase` (the R5-03 frame-committed ease, extracted and shared),
  `panelEdgeStyle` and the 240ms edge duration. `useDockedPanelEdge` measures the panel's current width,
  hands the width back to the stylesheet and flips the target class in one commit, reads the class-resolved
  width as the target (the stylesheet stays the single source of both resting widths, clamp included),
  writes one interpolated width per frame through the same commit — the box and the camera correction land
  in one task, inside the frame's callback, before the paint — and clears the inline width on the exact
  settle frame. Both docked panels use it; `width`/`min-width`/`flex-basis` left their transition lists; the
  `.hidden` dock's geometry is no longer `!important`; the `ResizeObserver` remains the fallback and now
  skips a box it already holds.
- **Specs strengthened, never weakened.** Two new camera tests (double mid-edge reversals both ways,
  scheduled relative to the landed click; the inspector at a short, a clamped-narrow and a wide viewport),
  a monotone-edge assertion on the single-direction samples, four unit tests for the shared ease, and the
  `v51-recovery` inspector test migrated off the browser-side width transition it asserted. The tolerance is
  still 1px; no retry, no sleep, no skip, no duration change.

## Validation

`npm run check` green (lint, `tsc`, **166 files / 2,482 tests**, production build); state consistency PASS
(52 checks); `validate:ograf`, `qa:release` (2 passed) and `qa:v6` (3 passed) green; `npm audit --audit-level=low`
0 vulnerabilities; `git diff --check` clean. Chromium at `--workers=8 --retries=0`: targeted stress
`--repeat-each=10` **60 passed / 0 failed** with `worstDelta=0.000px` on every sampled trace; camera family
`--repeat-each=5` **55 passed / 0 failed**; **FULL suite 398 passed / 0 failed / 0 flaky**. Isolated ports
only (UI 5188 / API 5015) — 5173 and 5000 were never bound, stopped or restarted.

## PR #10 comparison (read-only)

`git diff 04eee5e 74603de` changes exactly two camera/layout/chrome files (`StageCanvas.tsx` + `.css`);
`viewportMath.ts`, `App.tsx`, `Timeline/*` and `Inspector/*` are byte-identical; the StageCanvas diff is
crop/snap authoring and matches exactly one camera-timing line (the extra `crop-mode` class). The failure is
**inherited from PR #9, not amplified by PR #10**, and its magnitude is load-sensitive — round 5's 0.000px
isolation record and the 9.109px record differ in frame timing, not in code.

## Pull request

**#9 — OPEN, not merged** (`https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`). Validated code
+ tests head `42d89d588d48a00682ee111702dbfb92179c08f4` (`42d89d5`); the round record `a3c2e04` and the
handoff refresh ride on top; pushed as a fast-forward `04eee5e..a3c2e04` with an explicit refspec — no
force, no rebase; the CI run for the pushed head is recorded on the PR.

## Live surfaces

5173 keeps serving this worktree (vite listener pid 50876, HTTP 200) and **API 5000 (pid 18280) was never
stopped or restarted**. No merge, no tag, no release and no npm publication happened, and the canonical
checkout was never written to. The user's retest against 5173 is the merge gate; the retest list is in
`chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.
