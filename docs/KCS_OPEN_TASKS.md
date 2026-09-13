# KCS Open Tasks

## P0 — Presentation import decision

- Review `docs/KCS_INVESTIGATION_BRANCH_AUDIT.md`.
- Decide whether to create a review branch for `docs/github-presentation`.
- Decide whether to keep or archive `without-mask`.

## Current release state

Public Controls V1 is integrated into `main@373d74b`. Release tag `v1.1.0-public-controls` targets `6351d1a`. The three approved safe Copilot branches have been deleted.

## Investigation state

- `docs/github-presentation` remains preserved as the only import candidate.
- `without-mask` remains preserved for manual keep/archive review.
- `chore/omp-kcs-config-optimization` remains separate and must be kept.

## P2 — Non-blocking follow-up

- Windows case/device-name hardening.
- Font catalog UI and portable-font UX without unowned fallback binaries.
- Release tag/changelog polishing.

## Invariants

- Keep `main` at the accepted release checkpoint.
- Keep `memory.backend: mnemopi`.
- Keep model/provider mappings and global config unchanged.
- Preserve standard OGraf export, legacy single-file export, KCS project export, and KCS Import behavior.
