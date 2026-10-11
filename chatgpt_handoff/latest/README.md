# KCS Minimal ChatGPT Upload Bundle — Canvas camera invariance

Task-specific handoff for the `fix/authoring-ux-camera-invariance` branch (2026-10-11). This is not an archive.

## Current truth

Editor chrome no longer moves the authored world. Opening or closing a sidebar, or resizing the timeline, used to pan and zoom the stage: the edit SVG filled the stage and mapped its 600x480 viewBox with `preserveAspectRatio="xMidYMid meet"`, so the camera content was centred on the stage box centre and magnified by that box's aspect fit, while the pan/zoom transform was applied about that moving centre. Measured drift before the fix was +180 px (inspector), −168 px (left dock), and up to 60 px × 90 px with a 4x magnification change when the timeline was resized.

The camera is now its own authority (`StageCameraView` + `getStageCameraTransform` in `src/utils/viewportMath.ts`): a view centre in client pixels plus the px-per-unit scale it was anchored with, with the rendered transform dividing the layout fit back out. A `ResizeObserver` on the stage folds a measured box into the camera inside the same frame; a layout-only change leaves the camera untouched, while a change of the application window itself re-anchors it with its pan offset and a fresh scale. After the fix every transition measures 0.00 px drift on two authored world points and on the rendered node box, with the magnification and the zoom label unchanged.

Branch `fix/authoring-ux-camera-invariance` at `df107b894d9e5490a767a169e5c43d2418550be4`, stacked on `fix/authoring-ux-transform-toolbar` (`dea88ab`). Stacked PR [#5](https://github.com/ErtugrulAK/keyframe-character-studio/pull/5) is open for review and CI only and is not merged; `CI Pipeline` run `38138294854` covers it.

The full local Chromium suite reports 262 passed / 11 failed with `--retries=0`, and all 11 failures are inherited from the base commit `dea88ab`: it added `aria-label={\`Create ${operation} Boolean\`}` to the Boolean operation buttons, while `e2e/boolean-text-operands.spec.ts` (9 tests), `e2e/editor-interaction.spec.ts:164` and `e2e/v51-manual-qa.spec.ts:50` still query the accessible name `Union`/`Intersect` with `exact: true`. This branch touches no Boolean markup.

## Next step

Review the stacked PR (camera model, its unit tests, the new Chromium spec) and, once the base branch's Boolean accessible-name regression is resolved there, re-run the full Chromium suite on the combined line.

## Evidence and files

- OMP_FINAL_RESPONSE.md: root cause, the measured before/after drift, the fix and the branch/PR/CI identity.
- progress_159_authoring_ux_camera_invariance.md: the same record in report form, with the per-transition numbers and the full validation list.
- manifest.txt: inventory, protected boundaries and the state lines.
- CHANGELOG.md and KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md: mirrored live documents.
- NEXT_SESSION.md, PROJECT_STATE.md and KCS_RELEASE_CANDIDATE_SUMMARY.md: the repository's current live state, mirrored unchanged.

The mirrored documents match their repository sources after CRLF/LF normalization and whole-document trimming. Source, tests, package files, workflows, binaries, assets, caches and QA output are omitted. Earlier progress reports stay in `reports/` and are not copied into this minimal bundle.

Boundaries: the user's live QA preview (`keyframe-character-studio-omp-authoring-ux`, UI 5173 / API 5000) and the stable repository (`keyframe-character-studio`, `main` at `c46e698`) were never written to, restarted or killed. Every test ran on the isolated UI 5188 / API 5003 pair.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. This folder holds its sources.
