# KCS Minimal ChatGPT Upload Bundle — Exact-SHA Release Smoke Gate

Task-specific handoff for the 2026-10-08 exact-SHA Release Smoke Gate. This is not an archive.

## Current truth

The manual `Release Smoke Gate` passed on the exact candidate: run `37752015020`, **TESTED CODE SHA `6c27ef35d48d61a5e1163d2c91734c864fcafa01`**. Verdict: EXACT-SHA RELEASE SMOKE PASSED — READY FOR H7 RELEASE DECISION.

The workflow is verification-only (`permissions: contents: read`): it pins the `candidate_sha` input, verifies `git rev-parse HEAD`, and runs `npm ci` + Chromium + `npm run qa:release` — OGraf fixture validation plus two Chromium OGraf specs. It cannot tag, release or publish.

`6c27ef3` is the tested **code** SHA. The documentation commit that records this run is not itself smoke-tested; re-run the gate on any later SHA that changes code before making a release decision. The gate is not the full suite: the Vitest suite (135 files / 2,055 tests), the full Chromium suite (268 tests with `--retries=0`), the API/SQLite checks and the CORS posture were validated locally on the same code line and are recorded in PROJECT_STATE.md.

H7 remains HOLD. The tag, the draft prerelease, the private package version and the npm state are unchanged; npm still returns 404 for the package.

## Evidence and files

- OMP_FINAL_RESPONSE.md: the verified result, the coverage boundaries and the release boundary.
- PROJECT_STATE.md and NEXT_SESSION.md: current local validation and continuation constraints.
- KCS_RELEASE_CANDIDATE_SUMMARY.md: the release boundary with the exact-SHA smoke result.
- CHANGELOG.md and KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md: mirrored live documents.
- progress_154_exact_sha_release_smoke.md: the full run record — dispatch path, run ID, log evidence and the tested-code-SHA vs docs-tip distinction.
- manifest.txt: inventory and protected boundaries.

The four mirrored documents match their repository sources after CRLF/LF normalization and whole-document trimming. Source, tests, package files, workflows, binaries, assets, caches, and QA output are omitted. The earlier progress reports remain in `reports/` and are linked from the report indexes; they are not copied into this minimal bundle. Historical reports are not rewritten or deleted, and external workspaces and OMP configuration are untouched.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. This folder holds its sources.
