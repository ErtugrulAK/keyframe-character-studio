# KCS Current State

> **Historical record — superseded.** This document describes a closed programme (the
> release-candidate work and its task chain) and is kept unchanged as an audit record.
> Nothing here is a statement about the current repository state. For the current state read
> `PROJECT_STATE.md`, `NEXT_SESSION.md` and `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`.

The accepted KCS product and release-readiness blocker resolution is integrated into main. Annotated tag `v1.1.0-rc.1` and a GitHub draft prerelease exist for workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`; no npm publication occurred.

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
- `CHANGELOG.md` retains `[Unreleased]`; the candidate metadata remains unreleased for npm/package purposes.

## Release decision

- Tag: `v1.1.0-rc.1`, pushed at the workflow-tested code candidate.
- GitHub release: draft prerelease.
- Release readiness: **READY WITH WARNINGS**.
- Publish/finalize the draft only with further explicit user instruction.
