# KCS Minimal ChatGPT Upload Bundle — Corner resize anchor

Task-specific handoff for the `fix/authoring-ux-corner-anchor` branch (2026-10-11),
stacked on `fix/authoring-ux-camera-invariance`. This is not an archive.

## Current truth

The transform gizmo's corner handles resized the layer about its own centre, so a corner
drag moved **both** corners: the diagonally opposite corner drifted and the dragged corner
never reached the pointer. One pure geometry authority,
`src/utils/cornerResize.ts` → `resolveCornerResize`, now solves the gesture: the diagonally
opposite corner is the fixed point in world space, the pointer travel is rotated into the
layer's basis and solved against the fixed local span, and the next origin is rebuilt from
the fixed corner — so the anchor is exact, the drag starts without a jump, rotation is
preserved, and a crossover mirrors instead of collapsing. `TransformGizmo` reports the
handle identity and the bounds it drew; `StageCanvas` writes the returned world patch
through the existing `updateCurrentTransform` authority, so container-local conversion,
keyframed channel writes and the one-history-entry-per-drag batch interaction are
unchanged.

Measured on this branch with real Chromium (`--retries=0`): the opposite corner drifts
**0.00 px in all 19 measured cases** (rotated, non-uniformly scaled, parented, keyframed,
panned, zoomed, layout-changed, free-scale), and the dragged corner reaches the pointer
within **0.87 px** everywhere. Before the fix the same spec measured up to 6.43 x 18.73 px
of opposite-corner drift (28.61 x 17.72 px with a non-uniformly scaled parent) and a
35-45 px pointer miss; the keyframed case did not move the layer at all.

Recorded contract facts, verified from the code before the fix and preserved: corner
handles are **aspect-ratio locked by default** (`isScaleLocked` starts `true`; the
Inspector's Scale card toggles "Aspect Ratio Locked (Uniform Scale)" / "Aspect Ratio
Unlocked (Free Scale)"), so the locked corner drag preserves the authored aspect ratio and
the unlocked one writes independent `scaleX`/`scaleY`; `Shift` was only a decimal-precision
switch, never an aspect constraint; TL/BR keep `nwse-resize` and TR/BL keep `nesw-resize`.

## Stacked base (unchanged, still green)

1. **Canvas camera invariance** (`fix/authoring-ux-camera-invariance`, `df107b8`): editor
   chrome changing size no longer pans/zooms the authored world; the camera is its own
   authority (`StageCameraView` + `getStageCameraTransform`) and every transition measures
   0.00 px of drift.
2. **Boolean E2E locator alignment** (folded in from the base branch, `f13fed0`): the eleven
   assertions that queried the old Boolean button captions were aligned with the exact
   accessible names. No application source change.

The corner branch is stacked on this line and changes none of it.

## Branch state

- Head `fix/authoring-ux-corner-anchor` (application commit `04dc182`, docs commit above it),
  base `fix/authoring-ux-camera-invariance` (branch base `55a4ab2`, application head
  `aef21de`).
- Stacked PR [#6](https://github.com/ErtugrulAK/keyframe-character-studio/pull/6)
  (base `fix/authoring-ux-camera-invariance`, head `fix/authoring-ux-corner-anchor`), opened
  for review and CI only. Nothing is merged. PR #5 remains the base line's review artifact.
- Validation on this branch with the isolated ports (`CI=1 PORT=5004` → UI 5188 / API 5004):
  `tsc -b`, `oxlint`, `vitest` (140 files / 2122 tests), `vite build`, `validate:ograf`,
  `check`, `qa:release` 2, `qa:v6` 3, state consistency (40 checks),
  `npm audit --audit-level=low` (0 vulnerabilities), `git diff --check`, the focused
  Chromium specs (44 passed) and the **full Chromium suite 292 passed / 0 failed / 0 flaky /
  0 skipped with `--retries=0`** are all green. No assertion, tolerance or retry was
  weakened.

## Preview and isolation

The live preview `http://localhost:5173/` was **not** moved, restarted or re-pointed: it is
still served from the camera-invariance worktree
(`...omp-camera-invariance\node_modules\...\vite --host --port 5173`, PID 16844) at the
camera line's validated application source. The API on `127.0.0.1:5000` is the same process
as before this task (PID 24896). Every test ran against the isolated UI 5188 / API 5004 pair
(release gate 5189, V6 QA 5187) started by Playwright itself; ports 5173 and 5000 were never
bound, restarted or killed. The stable repository, the authoring-UX worktree, the
runtime-parity worktree and `.hermes/desktop-attachments/` were not written to.

## Next step

Review PR #6 (the geometry helper, the wiring, the 22-case unit file, the 5-case authority
file and the 19-case Chromium spec) and keep the camera preview as the QA surface. Any
further code change to this branch invalidates the results and needs a fresh `--retries=0`
run. Known limitation: a legacy layer whose `anchor` is not `none` pins its evaluated world
position (`evaluateTransform`), so no position write can hold a corner for it; it keeps the
previous scale-only behaviour rather than gaining dead keyframes on a pinned axis.

## Evidence and files

- OMP_FINAL_RESPONSE.md: the task, the root cause, the fix, the validation matrix, the
  branch/PR/CI state, the isolation proof and the limitations.
- progress_160_corner_anchor_resize.md: the pre-fix reproduction table, the file:line root
  cause, the geometry contract, the per-case results and the full validation matrix.
- progress_159_authoring_ux_camera_invariance.md and
  progress_159_boolean_e2e_locator_alignment.md: the stacked base line's records.
- manifest.txt: inventory, protected boundaries and the state lines.
- CHANGELOG.md, KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md, NEXT_SESSION.md, PROJECT_STATE.md and
  KCS_RELEASE_CANDIDATE_SUMMARY.md: mirrored live documents of the repository (they describe
  `main`, not this branch).

The mirrored documents match their repository sources after CRLF/LF normalization and
whole-document trimming. Source, tests, package files, workflows, binaries, assets, caches
and QA output are omitted. Earlier progress reports stay in `reports/` and are not copied
into this minimal bundle.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. This folder holds its
sources.
