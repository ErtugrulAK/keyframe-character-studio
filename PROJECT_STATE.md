# KCS Project State

## Current position

The repository is on the documentation consolidation branch `docs/kcs-current-state-consolidation`, based on `feat/ograf-host-compat-package` at `c2db6a4`. No source implementation is planned in this milestone.

## Accepted milestones

- **V3.4.1 UI handle correction** — complete on `feat/v6-ui-v34-control-cleanup` (`eba9895` known head). Shared 26x48 handle geometry, mirrored Chevrons, focus behavior, and browser parity were validated.
- **V3.5 UX corrections** — complete on `feat/v6-ui-v35-ux-corrections` (`1ff6c61` known head). Reset View, sidebar collapse, Free Draw finalization, inspector structure, effects, icons, palette, and Trim Path changes were delivered with regression coverage.
- **V3.6 and OGraf Package Export V2** — complete on `feat/v6-ui-v36-ograf-package-v2` (`de830d6` known head). Existing export authorities were extended with deterministic package paths, asset validation, and package/legacy actions.
- **OGraf V2.1 compliance** — complete on `feat/ograf-v21-spec-compliance` (`62ad6a7`). Official schema/runtime compliance, resource safety, font diagnostics, and downstream packages were delivered.
- **OGraf import UX** — complete and preserved on the OGraf branch. KCS Import distinguishes OGraf manifests/packages from KCS project files without attempting unsafe conversion.
- **OGraf host compatibility handoff** — complete on `feat/ograf-host-compat-package` (`c2db6a4`). Evidence supports selecting a manifest-rooted folder in the target host; clean BASIC, COMPOSITING, and ASSET QA folders exist outside the repository.
- **OMP configuration optimization** — complete on `chore/omp-kcs-config-optimization` (`50b42d4` known head). Project-local policy is committed; global config and model mappings were not changed. `memory.backend` is intentionally `mnemopi`.

## Status classification

| Area | Status | Evidence / next boundary |
|---|---|---|
| UI V3.4.1, V3.5, V3.6 | COMPLETE | Historical reports and published branch heads; no new UI work in progress |
| OGraf standard export and V2.1 compliance | COMPLETE | Reports 046–047, focused/full automated verification |
| KCS OGraf import UX | COMPLETE | Report 048 and preserved importer behavior |
| Target host import behavior | USER QA PENDING | Test the external host with BASIC → COMPOSITING → ASSET folders |
| OGraf Package → editable KCS import | NOT STARTED | Requires an explicit editable-state contract and package extraction design |
| Windows filesystem hardening | NOT STARTED | Known non-blocking technical debt |
| Current-state documentation | IN PROGRESS | This branch consolidates the handoff and open tasks |

## Protected state

- `main` remains protected and unchanged at `8024d4f` unless explicitly approved.
- Do not delete or rewrite historical reports.
- The reference corpus at `C:\Users\ertugrul.ak\Desktop\ograf-graphics` is read-only.
- `.omp/backups/` is preserved and ignored.
- `.omp/config.yml` must retain `memory.backend: mnemopi`.
- Model roles, provider mappings, and global configuration remain frozen.

## Reconciliation note

Older reports describe hosted Devtool directory selection as pending because headless automation could not operate the native picker. The later milestone context and `progress_049.md` record the user-provided hosted Devtool PASS for BASIC, COMPOSITING, and ASSET. The older reports remain unchanged as audit history; current state uses the later evidence while keeping target host/downstream app QA open.

## Immediate next action

Ask the user to test `C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa\BASIC` in the target host/downstream application. Record the exact selected path, error, screenshot, and same-host result for a known-working `ograf-graphics` reference project if it fails.
