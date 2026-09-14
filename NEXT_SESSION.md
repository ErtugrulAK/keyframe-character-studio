# Next Session Handoff

## Repository and branch

Repository:

`C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`

Checkout:

`main`

Current main:

`258dda3`

Release tag:

`v1.1.0-public-controls@6351d1a`

## Guardrails

- Do not reset hard, force push, delete reports, QA folders, or `.omp/backups/`.
- Do not modify `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.
- Keep `.omp/config.yml` `memory.backend: mnemopi`.
- Do not change model roles, provider mappings, or global configuration without approval.
- Keep the OMP tooling branch separate.
- Do not delete, rename, merge, cherry-pick, or import from `without-mask` without separate approval.

## Completed `without-mask` decision

`origin/without-mask@eb1d9b4` is a standalone root-commit KCS project snapshot with no merge base against `main`. It contains unique source, tests, docs, database artifacts, and wiki/assets content. The audit classification is `ARCHIVE`; the remote branch remains untouched.

Review:

1. `docs/KCS_WITHOUT_MASK_BRANCH_AUDIT.md`
2. `reports/progress_066.md`
3. `docs/KCS_BRANCH_STATUS.md`

## Next action

Move to GitHub Actions/CI. Any later archive rename, bundle archive, deletion, merge, cherry-pick, or selected import for `without-mask` requires explicit approval.
## CI audit result

GitHub Actions is green on `main@bd41339`; latest run `34822884119` passed. Local CI-equivalent validation also passed. No workflow fix was needed. Review `docs/KCS_CI_STATUS.md` and `reports/progress_067.md` before moving to the next feature track.
