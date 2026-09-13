# Next Session Handoff

## Repository and branch

Repository:

`C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`

Checkout:

`main`

Integrated RC:

`integration/v6-ui-ograf-public-controls-rc@111c101`

Main before:

`8024d4f`

Main after:

`111c101`

## Guardrails

- Do not merge to or otherwise rewrite `main`.
- Do not reset hard, force push, delete additional branches, reports, QA folders, or `.omp/backups/`.
- Do not modify `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.
- Keep `.omp/config.yml` `memory.backend: mnemopi`.
- Do not change model roles, provider mappings, or global configuration.
- Keep the OMP tooling branch separate.

## First task

Review:

1. `reports/progress_062.md`
2. `docs/presentation/README.md`
3. `docs/KCS_INVESTIGATION_BRANCH_AUDIT.md`

`review/github-presentation-import` contains the isolated presentation assets. Current `main` documentation was preserved, and `main@373d74b` was not changed by the import. Tag `v1.1.0-public-controls` still targets `6351d1a`.

## Approval boundary

Do not merge the review branch into `main` without separate approval. Do not delete branches. Keep `without-mask` and `chore/omp-kcs-config-optimization` untouched.
