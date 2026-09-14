# KCS Project State

## Current position

The accepted integration is now on `main`; the current pushed `main` HEAD is `717d662`, containing the integrated release-candidate tip `111c101`. The source and integration branches remain available.

## Accepted baseline

The branch includes the accepted V3.4.1, V3.5, V3.6/OGraf Package V2, OGraf V2.1, host compatibility, and release-candidate integration line. The OMP tooling branch remains separate.

## Public controls status

| Area | Status | Evidence |
|---|---|---|
| Text controls | IMPLEMENTED | Deterministic generated bindings; explicit `headline` compatibility preserved |
| Image controls | QA-PASS | Package-relative enum/defaults include default and alternate ASSET resources; target-host replacement confirmed |
| Color controls | QA-PASS | Visible fill/stroke fields include `format: color`, OGraf `color-rrggbb`, lowercase hex pattern; target-host changes confirmed |
| Runtime `updateAction` | IMPLEMENTED | Text/image/color writes rendered in generated runtime; unsafe image paths rejected |
| Host QA packages | QA-PASS | `C:\Users\senmu\Masaüstü\KCS\kcs-ograf-public-controls-qa`; BASIC, ASSET, and COMPOSITING PASS |
| Automated validation | COMPLETE | AJV manifests 3/3; Vitest 1,437/1,437; TypeScript, lint, build, V6 QA, and equivalent Playwright coverage completed |
| Manual public-controls host QA | PASS | User confirms BASIC text/motion, ASSET image replacement, and COMPOSITING color controls |

## Protected state

- `main` is integrated at `6351d1a`; the accepted RC tip `111c101` remains in its ancestry.
- Release tag `v1.1.0-public-controls` points to `6351d1a` and was pushed.
- Historical reports and old host QA folders are preserved.
- Read-only corpus: `C:\Users\ertugrul.ak\Desktop\ograf-graphics`; do not modify.
- `.omp/backups/` is preserved and ignored.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, and global configuration remain unchanged.

## Current next action

Run the final Work PC repository and global OMP tooling synchronization without copying credential stores or secrets. Then decide whether to keep or archive `without-mask`, followed by GitHub Actions/CI work.
