# KCS Open Tasks

## P0 — Documentation and branch decision

- Record target-host public-controls QA: BASIC PASS, ASSET PASS, COMPOSITING PASS.
- Review `docs/KCS_DESKTOP_FOLDER_CLEANUP_RESULT.md` and decide whether older host-compat or downstream folders should be archived later.
- Review `docs/KCS_BRANCH_CONSOLIDATION_PLAN.md`.
- Request explicit release approval before any integration-branch update or `main` merge.

## Release decision

Public Controls V1 is accepted by the reported target-host QA. This branch is not a `main` merge; `main` remains protected.

## P1 — Planned after release decision

- Create or update the dedicated integration RC branch only after explicit approval.
- Run the release validation set on that integration branch.
- Design OGraf Package → editable KCS import around explicit extraction, validation, asset rebasing, and editable-state semantics.

## P2 — Non-blocking follow-up

- Windows case/device-name hardening.
- Font catalog UI and portable-font UX without unowned fallback binaries.
- Release tag/changelog polishing.

## Invariants

- Keep `main` untouched until explicitly approved.
- Keep `memory.backend: mnemopi`.
- Keep model/provider mappings and global config unchanged.
- Keep `.omp/backups/` present and ignored.
- Keep the read-only OGraf reference corpus untouched.
- Preserve standard OGraf export, legacy single-file export, KCS project export, and KCS Import behavior.
