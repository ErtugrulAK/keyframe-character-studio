# KCS H7 GO — v1.1.0-rc.2 Release Candidate — 2026-10-08

## Latest approved release action

The approved H7 GO decision was executed. A **new** release candidate, `v1.1.0-rc.2`, was created from the exact smoke-tested code commit — `v1.1.0-rc.1` was not moved, retargeted or deleted, and npm remains unpublished.

| Field | Value |
|---|---|
| Tested code commit (candidate) | `6c27ef35d48d61a5e1163d2c91734c864fcafa01` |
| Annotated release candidate | `v1.1.0-rc.2` — dereferences to exactly the tested commit |
| Release Smoke Gate | run `37752015020` — success, every step green |
| GitHub release | `KCS v1.1.0-rc.2`, id `RE_kwDOTexJrc4YPnCt` — **draft prerelease**, `targetCommitish` pinned to the tested commit |
| Earlier candidate | `v1.1.0-rc.1` unchanged at `46d2a3e59e065816d972dcd56951803951b577f6` |
| Package | private, metadata version `1.1.0-rc.1`; npm returns 404 |

Package metadata deliberately stays at `1.1.0-rc.1` (PATH A): the candidate is the exact smoke-tested commit, so no metadata commit — which would have created a new, untested commit — was introduced.

The documentation tip `c650da18c731dfac85d31ba00d059a8430c40b43` is newer than the candidate and is docs-only: no source, test, workflow, package, lock or asset byte differs. The candidate identity is therefore unchanged, and the docs tip is **not** itself smoke-tested.

## What the candidate contains

The release notes carry the full list. In summary: the 16 post-Astra correctness fixes (text Boolean geometry, bonded layer movement, Motion Curves targeting and mask dispatch, Playfair OGraf portability), the authoring and presentation work (layer bonds, Boolean operands, text stroke parity, opacity keyframes, sequence isolation, segment editing, the visual-only editor refresh), the hardening shipped in the same line (Lottie import, OGraf package import, loopback API bind with an exact CORS allowlist, inverted matte, Lottie parent resolution, boundary scene validation), and the toolchain/dependency work (TypeScript 7, Vitest 5, Oxlint 1.85, jsdom 30.1.1, the CI type-check and state-consistency gates, and `npm audit` at 0 vulnerabilities).

## What the smoke gate proved, and what it did not

It proved the candidate installs cleanly from its own lockfile on a fresh Ubuntu runner, the OGraf fixture manifest validates offline against the vendored SHA-256-pinned closure, a KCS OGraf package materialized on the runner interoperates with Chromium, and the editor exports an OGraf ZIP through the UI.

It is not the full suite: the Vitest suite (135 files / 2,055 tests) and the full Chromium suite (268 tests with `--retries=0`) were validated locally on the same code line. This is a pre-release candidate, not a claim of full production certification.

## Next step

The user decides whether to publish the rc.2 draft prerelease and/or run the user QA pass. Publishing the draft does not create a tag (it already exists) and does not publish to npm. Any later commit that touches source, tests, workflows, packages or assets invalidates this exact-SHA smoke result for the new commit.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT.
