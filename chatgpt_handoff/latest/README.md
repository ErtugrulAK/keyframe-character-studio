# KCS Minimal ChatGPT Upload Bundle — v1.1.0-rc.2 Public Prerelease

Task-specific handoff for the 2026-10-08 rc.2 prerelease publication. This is not an archive.

## Current truth

The `v1.1.0-rc.2` release is now a **PUBLISHED PRERELEASE** (`isDraft: false`, `isPrerelease: true`, release id `RE_kwDOTexJrc4YPnCt`, `publishedAt` 2026-10-08T13:11:16Z, public at https://github.com/ErtugrulAK/keyframe-character-studio/releases/tag/v1.1.0-rc.2). It is **RC.2 READY FOR USER QA** and is **not** a stable release.

The candidate is the exact smoke-tested code commit `6c27ef35d48d61a5e1163d2c91734c864fcafa01` (Release Smoke Gate run `37752015020`, success). Its annotated release dereferences to exactly that commit and the tag object was not recreated or moved. Publication transitioned the same release object from draft to published: no tag was created, no release was recreated or retargeted, and nothing was marked latest-stable.

`v1.1.0-rc.1` is unchanged at `46d2a3e59e065816d972dcd56951803951b577f6` and its draft release is untouched. The package remains private at metadata version `1.1.0-rc.1` and npm returns 404 — no npm publication occurred.

The documentation tip is newer than the candidate and docs-only; it is **not** itself smoke-tested. The smoke gate is not the full suite: the Vitest suite (135 files / 2,055 tests) and the full Chromium suite (268 tests with `--retries=0`) were validated locally on the same code line.

## Next step

The user QA pass: the twelve-step checklist in `progress_156_rc2_prerelease_publish.md`. Any BLOCKER or MAJOR code defect means do not proceed to a stable release, and any code change requires a new commit plus a fresh exact-SHA smoke run.

## Evidence and files

- OMP_FINAL_RESPONSE.md: the published state, the candidate identity and the boundaries.
- PROJECT_STATE.md and NEXT_SESSION.md: current state and the exact next step.
- KCS_RELEASE_CANDIDATE_SUMMARY.md: the release boundary with the published rc.2 prerelease.
- CHANGELOG.md and KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md: mirrored live documents.
- progress_156_rc2_prerelease_publish.md: pre-publish state, the publish action, post-publish verification and the user QA checklist.
- progress_155_h7_rc2_release.md: the candidate cut, the metadata decision and the tested-code-SHA vs docs-tip distinction.
- manifest.txt: inventory and protected boundaries.

The four mirrored documents match their repository sources after CRLF/LF normalization and whole-document trimming. Source, tests, package files, workflows, binaries, assets, caches, and QA output are omitted. Earlier progress reports remain in `reports/` and are linked from the report indexes; they are not copied into this minimal bundle. Historical reports are not rewritten or deleted, and external workspaces and OMP configuration are untouched.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. This folder holds its sources.
