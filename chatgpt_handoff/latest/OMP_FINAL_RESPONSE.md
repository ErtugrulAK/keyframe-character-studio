# OMP final response — manual QA round two remediation

Status: **round 2 implemented and validated on the current head; PR #9 updated. Not merged.**

## What was delivered

Twelve round-2 findings (R2-01…R2-12) were remediated on `fix/manual-qa-round1-remediation` in eight
commits, on top of the already-recorded round-1 work (A–J):

- `a941dc8` — R2-05 rotation turns about ONE world pivot captured at pointer-down; R2-04
  `src/utils/selectionFrame.ts` becomes the single frame-geometry authority and the synthetic fallback
  square is gone.
- `016f0b5` — R2-01/R2-03 timeline collapse/expand, height resize and column resize through ONE sizing
  authority (`timelineConstants.ts`); R2-02 the timeline commits its size and re-measures the stage in
  the SAME task, so no frame is painted with a stale (box, transform) pairing.
- `47ae65c` — R2-10/R2-12 canonical `selectedKeyframeIds` in `useSelection` plus the marquee box-select
  gesture (multi-key MOVE deliberately not implemented; recorded as a follow-up).
- `80afc17` — R2-11 18px hit target / 8px hollow-or-filled diamond; R2-09 compact animation-channel
  tree with one rail and shared row constants.
- `9b845c1` — R2-07 app-root capture-phase `contextmenu` suppression across the editor.
- `39e34a5` — R2-08 Fill/Stroke off the toolbar, R2-06 Group/Ungroup off Details, visual polish.
- `03f4e26` — the opacity lane rendered where the tree lists it (row-for-row alignment).
- `9207b22` — three authoring-ux specs author colour through the Inspector instead of the removed
  toolbar popover.

Key measured outcomes: R2-05 worst frame-centre drift **40.559px → 0.000px**; R2-02 a real 151–155-frame
drag with height 320→441 holds **0.000px** worst drift and 0.00000 magnification spread; R2-07
propagation is never stopped, so KCS custom menus still work.

## Validation

Full validation on the round-2 head (isolated ports only; 5173/5000 never touched): the full gate was
green, including the FULL Chromium suite `--retries=0` (**359 passed, 0 failed, 0 flaky**) — the
one-file `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` carries the complete table. No assertion was
weakened, no spec was skipped and no retry was added.

## Pull request

**#9 — OPEN, not merged** (`https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`). Round-2
head `0078dcd68f2fc01ee8c2504149381593ed03c976` (`0078dcd`), mergeable MERGEABLE, merge state CLEAN;
CI **CI Pipeline** run `38267691521` (`pull_request`) — **success** (2026-10-12T15:05:35Z → 15:07:35Z).

## Live surfaces

The 5173 QA preview keeps serving this worktree (vite listener pid 33512) and **API 5000 (pid 8872) was
never stopped or restarted**. No merge, no tag, no release and no npm publication happened. The user's
retest against 5173 is the merge gate; the exact retest list is in
`chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.
