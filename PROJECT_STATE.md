# KCS Project State

## Current position

The accepted integration is on `main`; the current pushed `main` HEAD is `258dda3`. The release tag `v1.1.0-public-controls` points to `6351d1a`. The source and integration branches remain separate where preserved.

## Accepted baseline

The branch includes the accepted V3.4.1, V3.5, V3.6/OGraf Package V2, OGraf V2.1, host compatibility, public controls, presentation documentation, and release-candidate integration line. The OMP tooling branch remains separate.

## Public controls status

| Area | Status | Evidence |
|---|---|---|
| Text controls | IMPLEMENTED | Deterministic generated bindings; explicit `headline` compatibility preserved |
| Image controls | QA-PASS | Package-relative enum/defaults include default and alternate ASSET resources; target-host replacement confirmed |
| Color controls | QA-PASS | Visible fill/stroke fields include `format: color`, OGraf `color-rrggbb`, lowercase hex pattern; target-host changes confirmed |
| Runtime `updateAction` | IMPLEMENTED | Text/image/color writes rendered in generated runtime; unsafe image paths rejected |
| Host QA packages | QA-PASS | External BASIC, ASSET, and COMPOSITING packages |
| Automated validation | COMPLETE | AJV manifests, Vitest, TypeScript, lint, build, V6 QA, and equivalent Playwright coverage completed |
| Manual public-controls host QA | PASS | BASIC text/motion, ASSET image replacement, and COMPOSITING color controls confirmed |

## `without-mask` decision

`origin/without-mask@eb1d9b4` is a standalone root-commit project snapshot with no merge base against `main`. It contains unique source, tests, docs, database artifacts, and wiki/assets content. It is classified **ARCHIVE** and remains untouched. See `docs/KCS_WITHOUT_MASK_BRANCH_AUDIT.md` and `reports/progress_066.md`.

## Protected state

- `main` is integrated at `258dda3`.
- Release tag `v1.1.0-public-controls` points to `6351d1a` and remains unchanged.
- Historical reports and old host QA folders are preserved.
- Read-only corpus: `C:\Users\ertugrul.ak\Desktop\ograf-graphics`; do not modify.
- `.omp/backups/` is preserved and ignored.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, and global configuration remain unchanged.
- No source, package, test, tag, or QA-folder changes were made by this audit.

## Current next action

Move to GitHub Actions/CI. Keep `without-mask` and `chore/omp-kcs-config-optimization` separate and preserved unless a later explicit approval changes either decision.
