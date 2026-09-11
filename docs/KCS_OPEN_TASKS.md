# KCS Open Tasks

## P0 — Required before new host implementation

### User host QA

Test these external host/downstream application folders in order:

1. `C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa\BASIC`
2. `C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa\COMPOSITING`
3. `C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa\ASSET`

Select each folder itself. Do not use KCS Import, a standalone manifest, or a ZIP. The official Devtool PASS is distinct from target host application QA.

If rejected, collect:

- selected path
- exact application error
- screenshot
- whether a known-working `ograf-graphics` reference project imports in the same host app

### Current host decision boundary

Do not add a guessed wrapper, descriptor, vendor block, ZIP importer, or alternate exporter until the target host returns evidence that the existing manifest-rooted folder contract is insufficient.

## P1 — Planned after P0

- Design OGraf Package → KCS editable import around explicit package extraction, `scene.kcs` validation, asset rebasing, and an editable-state contract.
- Prepare a branch consolidation/integration plan after host QA, without touching `main` until explicitly approved.
- Perform final manual UI QA for any pending release surfaces and update the appropriate report without rewriting historical reports.

## P2 — Non-blocking follow-up

- Add Windows case/device-name hardening tests and boundary handling.
- Add font catalog UI and improve portable-font UX without introducing unowned fallback binaries.
- Prepare a release checkpoint or tag only after integration scope and user QA are approved.

## Invariants

- Keep `memory.backend: mnemopi`.
- Keep model mappings and provider selections unchanged.
- Keep `.omp/backups/` present and ignored.
- Keep the read-only OGraf reference corpus untouched.
- Preserve standard OGraf export, legacy single-file export, KCS project export, and KCS Import behavior.
