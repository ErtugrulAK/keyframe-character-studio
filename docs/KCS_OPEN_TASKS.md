# KCS Open Tasks

## P0 — Final sync audit

- Run the final two-PC sync audit on both machines.

## Release decision

Public Controls V1 is integrated into `main@6351d1a`. Release tag `v1.1.0-public-controls` is pushed and audited safe merged branch cleanup is complete.

## Completed cleanup

- Twelve audited safe remote branches deleted.
- Two audited safe local branches deleted.
- Investigation branches remain untouched.
- Reports and documentation remain preserved.

## P2 — Non-blocking follow-up

- Windows case/device-name hardening.
- Font catalog UI and portable-font UX without unowned fallback binaries.
- Release tag/changelog polishing.

## Invariants

- Keep `main` at the accepted release checkpoint.
- Keep `memory.backend: mnemopi`.
- Keep model/provider mappings and global config unchanged.
- Preserve standard OGraf export, legacy single-file export, KCS project export, and KCS Import behavior.
