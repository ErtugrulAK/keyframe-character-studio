# KCS v1.1.0-rc.2 — PUBLIC PRERELEASE — 2026-10-08

## Latest approved release action

The existing `v1.1.0-rc.2` draft was **published as a public prerelease**. It is **RC.2 READY FOR USER QA** — this is NOT a stable release.

| Field | Value |
|---|---|
| Tested code commit (candidate) | `6c27ef35d48d61a5e1163d2c91734c864fcafa01` |
| Annotated release candidate | `v1.1.0-rc.2` — dereferences to exactly the tested commit (tag object unchanged) |
| Release Smoke Gate | run `37752015020` — success, every step green |
| GitHub release | `KCS v1.1.0-rc.2`, id `RE_kwDOTexJrc4YPnCt` |
| State | `isDraft: false`, `isPrerelease: true`, `publishedAt: 2026-10-08T13:11:16Z` |
| Public URL | https://github.com/ErtugrulAK/keyframe-character-studio/releases/tag/v1.1.0-rc.2 |
| Earlier candidate | `v1.1.0-rc.1` unchanged at `46d2a3e59e065816d972dcd56951803951b577f6`; its draft release untouched |
| Package | private, metadata version `1.1.0-rc.1`; npm returns 404 |

Publication transitioned the **same** release object from draft to published; no tag was created or moved, no release was recreated or retargeted, nothing was marked latest-stable, and no stable release exists. The release notes were already complete, so they were not rewritten.

The candidate is the exact smoke-tested commit. The documentation tip is newer and docs-only — no source, test, workflow, package, lock or asset byte differs — so the candidate identity is unchanged and the docs tip is **not** itself smoke-tested.

## What the smoke gate proved, and what it did not

It proved the candidate installs cleanly from its own lockfile on a fresh Ubuntu runner, the OGraf fixture manifest validates offline against the vendored SHA-256-pinned closure, a KCS OGraf package materialized on the runner interoperates with Chromium, and the editor exports an OGraf ZIP through the UI.

It is not the full suite: the Vitest suite (135 files / 2,055 tests) and the full Chromium suite (268 tests with `--retries=0`) were validated locally on the same code line. This is a prerelease candidate, not a claim of full production certification.

## Next step — user QA

Run the twelve-step manual QA checklist in `progress_156_rc2_prerelease_publish.md` against this prerelease: app opens, project basics, shape manipulation, text rendering, opacity keyframes, a bonded pair drag, one Motion Curves easing edit, one mask/matte case, an OGraf ZIP export, an OGraf re-import, the Playfair / Cinematic Title export path, and a clean stability pass.

Classify every finding as BLOCKER, MAJOR, MINOR or COSMETIC. **Any BLOCKER or MAJOR code defect means do not proceed to a stable release**, and any code change produces a new commit that invalidates this exact-SHA smoke result — a new Release Smoke Gate run is then required before any further candidate or stable decision.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT.
