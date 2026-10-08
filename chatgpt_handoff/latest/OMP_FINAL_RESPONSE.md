# KCS Exact-SHA Release Smoke Gate — 2026-10-08

## Latest verified result

The manual `Release Smoke Gate` was dispatched against the exact candidate and **passed**: run `37752015020`, **TESTED CODE SHA `6c27ef35d48d61a5e1163d2c91734c864fcafa01`**, 46 s, every step `success`.

The workflow is verification-only: it declares `permissions: contents: read`, checks out the `candidate_sha` input with `fetch-depth: 1`, asserts `git rev-parse HEAD == EXPECTED_SHA`, then runs `npm ci`, installs Chromium for Playwright, and runs `npm run qa:release`. No step creates or moves a tag, publishes or finalizes a GitHub release, or runs `npm publish`.

Independently read from the run log: the runner's `EXPECTED_SHA` was the candidate, the gate printed `Release gate candidate SHA: 6c27ef3…`, the OGraf fixture validated (`minimal.ograf.json: valid OGraf v1 manifest`), both Chromium specs passed (`2 passed`), and the gate printed `Release gate passed for candidate SHA: 6c27ef3…`.

## Candidate identity

`6c27ef3` is the tested **code** SHA. The documentation commit that records this run moves the branch tip forward without changing a source, test, workflow, package or asset byte, and is **not** itself smoke-tested. A future release decision must treat `6c27ef3` as the tested candidate and re-run the gate on any later SHA that changes code.

## What the gate proves, and what it does not

It proves the candidate installs cleanly from its own lockfile on a fresh Ubuntu runner, the OGraf fixture manifest validates offline against the vendored SHA-256-pinned closure, a KCS OGraf package materialized on the runner interoperates with Chromium, and the real editor exports the current project as an OGraf ZIP through the UI.

It is not the full suite. The Vitest suite (135 files / 2,055 tests), the full Chromium suite (268 tests with `--retries=0`), the API health endpoint on the loopback bind, the `sqlite3` binding and the CORS posture were validated locally on the same code line and are recorded in PROJECT_STATE.md.

## Verdict

**EXACT-SHA RELEASE SMOKE PASSED — READY FOR H7 RELEASE DECISION.**

## Release state

H7 remains HOLD. Annotated tag `v1.1.0-rc.1` still points at `46d2a3e59e065816d972dcd56951803951b577f6`; the GitHub draft prerelease is unchanged; `package.json` is private at `1.1.0-rc.1`; npm still returns 404 for the package. Creating or moving a tag, publishing or finalizing the draft release, and npm publication all require a new explicit user instruction.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT.
