# KCS Open Tasks

## P0 — Integration readiness

### A. Integration readiness decision

Decide whether to consolidate the accepted product branches into the integration branch. Do not merge or modify `main` without explicit user approval.

### B. Branch integration plan

Review the safest merge/cherry-pick order:

1. V3.4.1 UI correction.
2. V3.5 UX corrections.
3. V3.6 OGraf Package V2.
4. OGraf V2.1 and import UX.
5. Host-compatibility documentation and handoff.
6. Documentation consolidation and host QA recording.
7. Keep `chore/omp-kcs-config-optimization` separate unless tooling integration is explicitly approved; it is not product code.

Check whether each branch is a linear descendant or requires cherry-pick/merge. Identify conflicts before any integration action.

### Completed P0 evidence

Target host/downstream QA is complete:

- BASIC: PASS — text moves slightly right on PLAY.
- ASSET: PASS — portable image appears after a short delay.
- COMPOSITING: PASS — rectangle/color transition renders.
- Confirmed import unit: manifest-rooted folder.
- This is not KCS Import.

## P1 — Planned after approval

- Design OGraf Package → editable KCS import around explicit package extraction, `scene.kcs` validation, asset rebasing, and an editable-state contract.
- Perform final manual UI QA for pending release surfaces.
- Prepare a release checkpoint after branch integration and validation.

## P2 — Non-blocking follow-up

- Add Windows case/device-name hardening tests and boundary handling.
- Add font catalog UI and improve portable-font UX without introducing unowned fallback binaries.
- Polish the release tag/changelog after integration scope is approved.

## Invariants

- Keep `main` untouched until explicitly approved.
- Keep `memory.backend: mnemopi`.
- Keep model mappings and provider selections unchanged.
- Keep `.omp/backups/` present and ignored.
- Keep the read-only OGraf reference corpus untouched.
- Preserve standard OGraf export, legacy single-file export, KCS project export, and KCS Import behavior.
