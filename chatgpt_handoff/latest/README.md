# KCS Minimal ChatGPT Upload Bundle — camera-transition blocker remediation

Task-specific handoff for the camera-transition blocker on branch `fix/manual-qa-round1-remediation`
(2026-10-14): the right inspector's SHOW transition painted one frame of NEW stage geometry with OLD camera
compensation. The blocker is fixed at its root (one frame-committed layout authority for both docked
panels), the camera specs are strengthened rather than relaxed, and the FULL Chromium suite is clean at
`--retries=0`. Manual QA rounds 1–5 are unchanged and recorded in `reports/progress_165…171_*`. This is not
an archive.

## Current truth

- Repository (canonical, untouched, still on `main` @ `8e2df61`, clean):
  `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`
- Worktree that carries this work: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1`
- Branch: `fix/manual-qa-round1-remediation` (base `origin/main` at `8e2df61`), pushed as a
  **fast-forward** (`04eee5e..a3c2e04`) with an explicit refspec — no force, no rebase
- **Validated code + tests head: `42d89d5`** (`42d89d588d48a00682ee111702dbfb92179c08f4`); the round record
  (`a3c2e04`) adds the record and the changelog only, and the handoff refresh rides on top of it
- PR: **#9 OPEN, not merged** — `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`
- Fixed: **the inspector SHOW drift blocker** (round 5's one open item, now resolved) — the same class of
  race was fixed for the left dock too
- Validation: reproducible before the fix (**8 failed / 12 passed**), **targeted stress 60 passed / 0
  failed** (`--repeat-each=10`), **camera family 55 passed / 0 failed** (`--repeat-each=5`), and the
  **FULL Chromium suite 398 passed / 0 failed / 0 flaky** at `--workers=8 --retries=0`; `npm run check`
  green (166 files / 2,482 tests, build), state consistency PASS (52 checks), `validate:ograf`,
  `qa:release` (2) and `qa:v6` (3) green, `npm audit` 0 vulnerabilities, `git diff --check` clean
- Live preview: `http://localhost:5173/` — served from THIS worktree (vite listener pid 50876, HTTP 200)
- API: `127.0.0.1:5000` — pid 18280, **never stopped or restarted**
- Next input: the **user retest on 5173** (rounds 1–5 plus the dock toggles below) — that retest is the
  merge gate

## What this round fixed

- **The blocker (round 5's reported item).** `e2e/camera-transition-stability.spec.ts` sampled one painted
  frame with the new stage box and the previous box's camera compensation: exactly **half of that frame's
  stage-width step** (`28.859375px = 57.71875 / 2` recorded at 8 workers, `9.109px` in the other sample).
  The panel animated its width with a browser-side `transition: width 240ms ease`, so its box moved inside
  the frame's own style/layout step, while the camera (a projection of the stage box) could only learn the
  new box from the asynchronous `ResizeObserver` on `.stage-canvas-container` — which reports the size it
  *gathered* and which Chromium may deliver after the frame that already painted a newer box. Instrumented,
  the observer committed `w=943.00` in the same frame whose paint carried `924.781px` with the compensation
  for `943.00` (`tx=-179.500` where `-170.391` is correct): `(943.00 − 924.781) / 2 = 9.109px`.
- **The fix — ONE layout authority.** `src/utils/workspaceLayout.ts` holds `commitWorkspaceLayout` (moved
  out of `SequencerTimeline.tsx` and shared), `createFrameEase` (the R5-03 frame-committed ease, extracted
  and shared), `panelEdgeStyle` and the 240ms edge duration. `useDockedPanelEdge` drives a docked panel's
  edge with it: it measures the width the panel has *right now* (the in-flight interpolated width when one
  is running), hands the width back to the stylesheet and flips the target class in ONE commit, reads the
  width that class resolves to as the target (so the stylesheet stays the single source of both resting
  widths, clamp included), writes one interpolated width per animation frame through the same commit — so
  the box and the camera correction land in the same task, inside the frame's callback, before the paint —
  and clears the inline width on the exact settle frame. Both docked panels use it; their geometry left
  their transition lists, the `.hidden` dock's geometry stopped being `!important`, and the
  `ResizeObserver` remains the fallback for every layout change nobody committed.
- **Specs.** Two new tests (double mid-edge reversals both ways; short, clamped-narrow and wide viewports),
  a monotone-edge assertion on the single-direction samples, four unit tests for the shared ease, and the
  `v51-recovery` inspector test **migrated** off the browser-side width transition it asserted (it is the
  mechanism this fix removes). `DRIFT_TOLERANCE_PX = 1` unchanged, no retry, no sleep, no skip.

## Evidence and files

- `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` — the full record: the reproduction, the frame-level root
  cause, why 28.859px, the implementation, the validation table, the PR #10 comparison, the live surfaces
  and the user retest.
- `reports/progress_173_camera_transition_blocker_remediation.md` — the round record (same content, longer
  form; also inside this bundle).
- `reports/progress_171_manual_qa_round_five_remediation.md` (and 165…170) — rounds 5 down to the pre-QA
  cleanup, whose findings and numbers still stand; round 5's one open item is the blocker fixed here.

## Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. No other file in this bundle needs to be uploaded.
