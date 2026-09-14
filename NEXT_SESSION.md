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

1. `reports/progress_065.md`
2. `docs/OMP_GLOBAL_TOOLING_STATUS.md`
3. `docs/KCS_CURRENT_STATE.md`

The Home PC checkpoint is documented. `main` contains the released product and presentation documentation; the release tag remains `v1.1.0-public-controls @ 6351d1a`. No branches or tags were changed by this checkpoint.

## Next approval boundary

Synchronize the Work PC repository and global OMP tooling without copying credential stores or secrets. Then decide the keep/archive policy for `without-mask` and move to GitHub Actions/CI.
