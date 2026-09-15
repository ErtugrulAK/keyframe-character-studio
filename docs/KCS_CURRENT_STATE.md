# KCS Current State

The accepted KCS product and security follow-up line is integrated into `main@449ca898a30442e906b802f9824b2ad1dc278e5e`. Release-readiness blocker resolution is prepared on `fix/release-readiness-blockers`; no release or tag has been created.

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

- `main` baseline and `origin/main` were synchronized at `449ca898a30442e906b802f9824b2ad1dc278e5e`.
- Release tag `v1.1.0-public-controls` remains unchanged.
- `origin/without-mask` remains untouched and classified ARCHIVE.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, task concurrency, global configuration, and OMP tooling remain unchanged.

## Release metadata

- `package.json` and `package-lock.json` candidate version: `1.1.0-rc.1`.
- Package remains private.
- `CHANGELOG.md` retains `[Unreleased]`; the candidate entry is explicitly unreleased.

## Release decision

- Branch validation and independent review are required before a readiness decision.
- Production release/tag remains **NO**; separate explicit approval is required.
