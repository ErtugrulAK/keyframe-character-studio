# KCS Minimal ChatGPT Upload Bundle — Combined authoring-UX line

Task-specific handoff for the `fix/authoring-ux-camera-invariance` branch
(2026-10-11), now carrying the current authoring-UX base. This is not an archive.

## Current truth

This line combines two slices of authoring-UX work:

1. **Canvas camera invariance** (this branch). Editor chrome changing size used to
   pan and zoom the authored world, because the edit SVG filled the stage and
   mapped its 600x480 viewBox with `preserveAspectRatio="xMidYMid meet"` while the
   pan/zoom CSS transform was applied about that moving centre. The camera is now
   its own authority (`StageCameraView` + `getStageCameraTransform` in
   `src/utils/viewportMath.ts`): a view centre in client pixels plus the px-per-unit
   scale it was anchored with, with the rendered transform dividing the layout fit
   back out. A `ResizeObserver` on the stage folds a measured box into the camera
   inside the same frame; a layout-only change leaves the camera untouched, while a
   change of the application window itself re-anchors it with its pan offset and a
   fresh scale. Measured drift before the fix was +180 px (inspector), −168 px (left
   dock) and up to 36.55 × 66.73 px with a magnification change when the timeline
   was resized; after the fix every transition measures **0.00 px** on two authored
   world points and on the rendered node box, with the magnification and the zoom
   label unchanged, the serialized document byte-identical and the undo depth
   unchanged.

2. **Boolean E2E locator alignment** (folded in from the base branch). `dea88ab`
   gave the Boolean buttons `aria-label={`Create ${operation} Boolean`}`, which
   overrides the visible caption as the accessible name; eleven assertions still
   queried `Union`/`Subtract`/`Intersect` with `exact: true`, timed out and never
   dispatched the Boolean operation. `f13fed0` aligns those locators with the exact
   new names (one shared helper, no regex or text fallback, no assertion removed)
   and closed all 11: focused 20 passed, full Chromium 268 passed with
   `--retries=0`. It changes no application source.

## Synchronization

The base branch `fix/authoring-ux-transform-toolbar` advanced from `dea88ab` to
`7d7ebe2` after this camera branch was cut, and rewriting history is disallowed on
this line, so the advanced base was folded in with a **merge commit** — the only
non-history-rewriting way to synchronize. Conflicts appeared only in the ChatGPT
handoff bundle and were resolved by regenerating the bundle for the combined state;
no code or test file conflicted.

## Next step

Review the merged stacked PR (camera model, its unit tests, the new Chromium spec,
the aligned Boolean locators) and run the user QA pass against the branch preview.
Any code change to this branch invalidates the validation results and needs a fresh
`--retries=0` run.

## Evidence and files

- OMP_FINAL_RESPONSE.md: the two slices, the synchronization reason, the combined
  validation and the branch/PR identity.
- progress_159_authoring_ux_camera_invariance.md: the camera root cause, the
  per-transition drift numbers, the fix and the full validation list.
- progress_159_boolean_e2e_locator_alignment.md: the verbose eleven failures, the
  locator-only fix and the focused/full Chromium results.
- manifest.txt: inventory, protected boundaries and the state lines.
- CHANGELOG.md and KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md: mirrored live documents.
- NEXT_SESSION.md, PROJECT_STATE.md and KCS_RELEASE_CANDIDATE_SUMMARY.md: the
  repository's current live state, mirrored unchanged.

The mirrored documents match their repository sources after CRLF/LF normalization
and whole-document trimming. Source, tests, package files, workflows, binaries,
assets, caches and QA output are omitted. Earlier progress reports stay in
`reports/` and are not copied into this minimal bundle.

Boundaries: the user's live QA preview, the API on `127.0.0.1:5000` and the stable
repository (`keyframe-character-studio`, `main` at `c46e698`) were never written to,
restarted or killed. Every test ran on the isolated UI 5188 / API 5003 pair.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. This folder
holds its sources.
