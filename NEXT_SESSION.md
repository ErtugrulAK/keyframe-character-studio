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

1. `reports/progress_064.md`
2. `docs/KCS_BRANCH_STATUS.md`
3. `docs/KCS_OPEN_TASKS.md`

The original `docs/github-presentation` branch was deleted after verifying its useful presentation material on `main`. `without-mask` and `chore/omp-kcs-config-optimization` remain untouched. Tag `v1.1.0-public-controls` still targets `6351d1a`.

## Next approval boundary

Decide whether to keep or archive `without-mask`, then move to GitHub Actions/CI work. Do not modify the preserved OMP branch or release tag.
