# KCS Minimal ChatGPT Upload Bundle — Combined authoring-UX line

Task-specific handoff for the `fix/authoring-ux-camera-invariance` branch
(2026-10-11), now carrying the current authoring-UX base and fully validated. This
is not an archive.

## Current truth

This line combines two slices of authoring-UX work and both are green together:

1. **Canvas camera invariance** (this branch, `df107b8`). Editor chrome changing
   size used to pan and zoom the authored world, because the edit SVG filled the
   stage and mapped its 600x480 viewBox with `preserveAspectRatio="xMidYMid meet"`
   while the pan/zoom CSS transform was applied about that moving centre. The camera
   is now its own authority (`StageCameraView` + `getStageCameraTransform` in
   `src/utils/viewportMath.ts`): a view centre in client pixels plus the px-per-unit
   scale it was anchored with, with the rendered transform dividing the layout fit
   back out. A `ResizeObserver` on the stage folds a measured box into the camera
   inside the same frame; a layout-only change leaves the camera untouched, while a
   change of the application window itself re-anchors it with its pan offset and a
   fresh scale. Measured drift before the fix was +180 px (inspector), −168 px (left
   dock) and up to 36.55 × 66.73 px with a magnification change when the timeline was
   resized; after the fix every transition measures **0.00 px** on two authored world
   points and on the rendered node box, with the magnification and the zoom label
   unchanged, the serialized document byte-identical and the undo depth unchanged.

2. **Boolean E2E locator alignment** (folded in from the base branch, `f13fed0`).
   `dea88ab` gave the Boolean buttons `aria-label={`Create ${operation} Boolean`}`,
   which overrides the visible caption as the accessible name; eleven assertions
   still queried `Union`/`Subtract`/`Intersect` with `exact: true`, timed out and
   never dispatched the Boolean operation. `f13fed0` aligns those locators with the
   exact new names (one shared helper, no regex or text fallback, no assertion
   removed) and closed all 11. It changes no application source.

## Synchronization

The base branch `fix/authoring-ux-transform-toolbar` advanced from `dea88ab` to
`7d7ebe2` after this camera branch was cut, and rewriting history is disallowed on
this line, so the advanced base was folded in with the merge commit
`aef21de5aad06592884d7a54004383b2f6eeccb1` — the only non-history-rewriting way to
synchronize. Conflicts appeared only in the ChatGPT handoff bundle and were resolved
by regenerating the bundle for the combined state; no code or test file conflicted.
Nothing was merged to `main`.

## Combined state

Combined head `aef21de`, stacked PR [#5](https://github.com/ErtugrulAK/keyframe-character-studio/pull/5)
(base `fix/authoring-ux-transform-toolbar`, head `fix/authoring-ux-camera-invariance`)
is MERGEABLE and open for review and CI only. On the merged tree, with `--retries=0`
and the isolated ports (`CI=1 PORT=5003` → UI 5188 / API 5003): the full Chromium
suite passes **273 tests, 0 failed / 0 flaky / 0 skipped**; the focused Boolean specs
pass 20; the focused camera spec passes 5 with 0.00 px drift; `qa:release` (candidate
SHA `aef21de`) passes 2 and `qa:v6` passes 3; `tsc -b`, `oxlint`, `vitest` (138 files
/ 2095 tests), `vite build`, `validate:ograf`, `check`, `check-state-consistency`
(40 checks), `npm audit --audit-level=low` (0 vulnerabilities) and `git diff --check`
are all clean.

The live preview `http://localhost:5173/` is served from this worktree by
`vite --host --port 5173` and serves the application source of the validated combined
code head `aef21de` on branch
`fix/authoring-ux-camera-invariance`; the API on `127.0.0.1:5000` (unchanged PID
24896) still answers 200. The stable repository (`keyframe-character-studio`, `main`
at `c46e698`), the runtime-parity worktree and the authoring-UX worktree were not
written to.

## Next step

Review PR #5's merged head (the camera model, its unit tests, the new Chromium spec,
the aligned Boolean locators) and run the user QA pass against the branch preview. Any
code change to this branch invalidates the validation results and needs a fresh
`--retries=0` run.

## Evidence and files

- OMP_FINAL_RESPONSE.md: the two slices, the synchronization reason, the combined
  validation matrix, the preview identity and the boundaries.
- progress_159_authoring_ux_camera_invariance.md: the camera root cause, the
  per-transition drift numbers, the fix and the camera-slice validation list.
- progress_159_boolean_e2e_locator_alignment.md: the verbose eleven failures, the
  locator-only fix and the focused/full Chromium results on the base line.
- manifest.txt: inventory, protected boundaries and the state lines.
- CHANGELOG.md and KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md: mirrored live documents.
- NEXT_SESSION.md, PROJECT_STATE.md and KCS_RELEASE_CANDIDATE_SUMMARY.md: the
  repository's current live state, mirrored unchanged.

The mirrored documents match their repository sources after CRLF/LF normalization and
whole-document trimming. Source, tests, package files, workflows, binaries, assets,
caches and QA output are omitted. Earlier progress reports stay in `reports/` and are
not copied into this minimal bundle.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. This folder
holds its sources.
