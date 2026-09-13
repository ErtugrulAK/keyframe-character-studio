# KCS Open Tasks

## P0 — Main release decision

- Review the current integration RC at `integration/v6-ui-ograf-public-controls-rc@2a6b5dc`.
- Review `reports/progress_056.md`.
- Request explicit release approval before any `main` merge.

## Release decision

Public Controls V1 is accepted by target-host QA and included in the integration RC. `main` remains protected and untouched.

## P1 — Planned after release decision

- Run the release validation set again if the integration RC is changed.
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
