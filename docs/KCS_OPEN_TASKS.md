# KCS Open Tasks

## P0 — Investigation branch decisions

- Review `docs/KCS_INVESTIGATION_BRANCH_AUDIT.md`.
- Decide whether to delete the three safe candidates.
- Decide whether to create a review branch for `docs/github-presentation`.
- Decide whether to keep/archive `without-mask`.

## Current release state

Public Controls V1 is integrated into `main@1ad4bd3`. Release tag `v1.1.0-public-controls` targets `6351d1a`. Safe merged branch cleanup is complete.

## Investigation findings

- Three Copilot branches are safe deletion candidates after later approval.
- `docs/github-presentation` contains unique documentation/presentation work and is an import candidate.
- `without-mask` is highly divergent and remains an unknown/manual decision.
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
