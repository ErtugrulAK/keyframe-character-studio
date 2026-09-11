# KCS Open Tasks

## P0 — Release candidate decision

### Release-candidate validation

Run and record:

- TypeScript
- lint
- Vitest
- build
- V6 QA
- full Playwright
- OGraf manifest validation
- `git diff --check`
- manual host smoke: BASIC → COMPOSITING → ASSET folders

### Release decision

Review `docs/KCS_INTEGRATION_EXECUTION_PLAN.md` and `reports/progress_051.md`, then request explicit user approval before any `main` merge. This branch is a release candidate, not a main merge.

## P1 — Planned after release decision

- Design OGraf Package → editable KCS import around explicit package extraction, `scene.kcs` validation, asset rebasing, and an editable-state contract.
- Perform final manual UI QA for pending release surfaces.
- Prepare a release checkpoint after the candidate is accepted.

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
