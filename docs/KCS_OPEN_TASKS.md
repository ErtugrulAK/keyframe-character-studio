# KCS Open Tasks

## P0 — Release checkpoint decision

- Review `reports/progress_058.md` and the cleanup audits.
- Decide whether to create the proposed release tag.
- Decide whether to approve deletion of branches classified safe after final PR/dependency review.

## Release decision

Public Controls V1 is integrated into `main@717d662` and target-host QA is PASS. No release tag has been created and no branches have been deleted.

## P1 — Planned after release decision

- Create the approved release tag/checkpoint.
- Execute only the specifically approved branch cleanup commands.

## P2 — Non-blocking follow-up

- Windows case/device-name hardening.
- Font catalog UI and portable-font UX without unowned fallback binaries.
- Release tag/changelog polishing.

## Invariants

- Keep `main` integrated at the accepted checkpoint.
- Keep source and integration branches available.
- Keep `memory.backend: mnemopi`.
- Keep model/provider mappings and global config unchanged.
- Preserve standard OGraf export, legacy single-file export, KCS project export, and KCS Import behavior.
