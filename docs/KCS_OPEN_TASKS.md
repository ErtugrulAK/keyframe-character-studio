# KCS Open Tasks

## P0 — without-mask and CI decision

- Decide whether to keep or archive `without-mask`.
- Then move to GitHub Actions/CI work.

## Current release state

Public Controls V1 and the reviewed GitHub presentation materials are integrated into `main`. The original `docs/github-presentation` branch was deleted after verification. Release tag `v1.1.0-public-controls` targets `6351d1a`.

## Investigation state

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
