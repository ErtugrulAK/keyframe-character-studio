# KCS Open Tasks

## P0 — Public-controls host QA

- Test `C:\Users\ertugrul.ak\Desktop\kcs-ograf-public-controls-qa\BASIC`.
- Test `C:\Users\ertugrul.ak\Desktop\kcs-ograf-public-controls-qa\ASSET`.
- Test `C:\Users\ertugrul.ak\Desktop\kcs-ograf-public-controls-qa\COMPOSITING`.
- Record exact host controls, changed values, render behavior, errors, and screenshots.
- Confirm the older `kcs-ograf-host-compat-qa` folder still works.

## Release decision

Review `reports/progress_052.md` and the public-controls QA evidence, then request explicit approval before any `main` merge. This branch is not a main merge.

## P1 — Planned after release decision

- Design OGraf Package → editable KCS import around explicit extraction, validation, asset rebasing, and editable-state semantics.
- Prepare a release checkpoint after public-controls QA acceptance.

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
