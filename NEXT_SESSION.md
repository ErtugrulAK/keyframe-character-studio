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

1. `reports/progress_060.md`
2. `docs/KCS_INVESTIGATION_BRANCH_AUDIT.md`
3. `docs/KCS_BRANCH_CLEANUP_AUDIT.md`

`main@1ad4bd3` contains the released Public Controls V1 integration. Tag `v1.1.0-public-controls` targets `6351d1a`. Investigation branches were audited read-only; no branch was deleted, merged, or cherry-picked.

## Approval boundary

Request separate approval before deleting the three safe candidates or importing `docs/github-presentation`. Keep `without-mask` under manual review and keep the OMP tooling branch separate.
