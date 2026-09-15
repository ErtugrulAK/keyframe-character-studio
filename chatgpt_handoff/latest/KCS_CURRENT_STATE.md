# KCS Current State

The accepted KCS product and release-readiness blocker resolution is integrated into main. Remote `release-smoke.yml` passed for workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`; the final documentation update follows as docs-only. No release or tag has been created.

## Completed security and OGraf work

- Public Controls V1 and OGraf Package Export V2 remain active.
- Windows path, package filesystem, parent-cycle, broadcast-state, SVG boundary, and mask/matte hardening are integrated.
- SourcePath/file-handle and output-ancestor trust hardening is integrated. The residual hostile-concurrency pathname-write TOCTOU is an accepted operational constraint; trusted dedicated output directories are required.
- `validate:ograf` validates a committed fixture with complete discovered remote schema hash pinning; network access remains required and offline validation is not claimed.
- `qa:release` runs the committed manifest validation and isolated Chromium OGraf import/export/runtime smoke.
- `.github/workflows/release-smoke.yml` provides a manual Chromium gate for an explicitly selected candidate SHA.

## `without-mask` branch decision

`origin/without-mask` remains a standalone root-commit archive candidate. Keep it untouched; any rename, archive, deletion, merge, cherry-pick, or selected import requires explicit approval.

## Protected state

- Workflow-tested release code candidate: `46d2a3e59e065816d972dcd56951803951b577f6`; final documentation update is docs-only.
- Release tag `v1.1.0-public-controls` remains unchanged.
- `origin/without-mask` remains untouched and classified ARCHIVE.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, task concurrency, global configuration, and OMP tooling remain unchanged.

## Release metadata

- `package.json` and `package-lock.json` candidate version: `1.1.0-rc.1`.
- Package remains private.
- `CHANGELOG.md` retains `[Unreleased]`; the candidate entry is explicitly unreleased.

## Release decision

- Release readiness: **READY WITH WARNINGS FOR USER APPROVAL**; separate release/tag approval is required.
