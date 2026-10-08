# KCS Minimal ChatGPT Upload Bundle — H7 GO / v1.1.0-rc.2 Release Candidate

Task-specific handoff for the 2026-10-08 H7 GO release-candidate cut. This is not an archive.

## Current truth

The approved H7 GO decision was executed. A **new** release candidate, `v1.1.0-rc.2`, was created from the exact smoke-tested code commit `6c27ef35d48d61a5e1163d2c91734c864fcafa01` (Release Smoke Gate run `37752015020`, success). The annotated candidate dereferences to exactly that commit, and its GitHub release entry is a **draft prerelease** whose `targetCommitish` is pinned to the same commit.

`v1.1.0-rc.1` was not moved, retargeted or deleted — it still dereferences to `46d2a3e59e065816d972dcd56951803951b577f6`, and its draft prerelease is unmodified. The package remains private at metadata version `1.1.0-rc.1` (PATH A: the candidate is the exact smoke-tested commit, so no untested metadata commit was introduced) and npm still returns 404.

The documentation tip `c650da18c731dfac85d31ba00d059a8430c40b43` is newer than the candidate and docs-only; it is **not** itself smoke-tested. Any commit that touches source, tests, workflows, packages or assets invalidates the result for the new commit.

The smoke gate is not the full suite: it runs `npm ci`, installs Chromium, validates the OGraf fixture offline, and runs two OGraf Chromium specs. The Vitest suite (135 files / 2,055 tests) and the full Chromium suite (268 tests with `--retries=0`) were validated locally on the same code line and are recorded in PROJECT_STATE.md.

## Evidence and files

- OMP_FINAL_RESPONSE.md: the release action, the candidate identity and the boundaries.
- PROJECT_STATE.md and NEXT_SESSION.md: current state and the exact next step.
- KCS_RELEASE_CANDIDATE_SUMMARY.md: the release boundary with the rc.2 candidate.
- CHANGELOG.md and KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md: mirrored live documents.
- progress_155_h7_rc2_release.md: the release execution record — phases, verification, and the tested-code-SHA vs docs-tip distinction.
- progress_154_exact_sha_release_smoke.md: the underlying smoke-gate evidence for the candidate, including what the gate does and does not prove.
- manifest.txt: inventory and protected boundaries.

The four mirrored documents match their repository sources after CRLF/LF normalization and whole-document trimming. Source, tests, package files, workflows, binaries, assets, caches, and QA output are omitted. The earlier progress reports remain in `reports/` and are linked from the report indexes; they are not copied into this minimal bundle. Historical reports are not rewritten or deleted, and external workspaces and OMP configuration are untouched.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. This folder holds its sources.
