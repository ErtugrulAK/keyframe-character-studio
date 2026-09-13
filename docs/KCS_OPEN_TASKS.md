# KCS Open Tasks

## P0 — Release checkpoint decision

- Review `reports/progress_057.md`.
- Decide whether to create a release tag/checkpoint.
- Decide whether to prepare an optional branch cleanup plan; do not delete branches without separate approval.

## Release decision

Public Controls V1 is integrated into `main` and target-host QA is PASS. No release tag has been created.

## P1 — Planned after release decision

- Create the approved release tag/checkpoint.
- Prepare, but do not execute, any branch cleanup.

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
