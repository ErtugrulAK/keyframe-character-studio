# KCS Project State

## Current position

The repository is on `feat/ograf-public-controls-v1`, based on `integration/v6-ui-ograf-release-candidate@4e4c269`. The feature branch adds host-editable OGraf text, image, and color controls. `main` remains untouched.

## Accepted baseline

The branch includes the accepted V3.4.1, V3.5, V3.6/OGraf Package V2, OGraf V2.1, host compatibility, and release-candidate integration line. The OMP tooling branch remains separate.

## Public controls status

| Area | Status | Evidence |
|---|---|---|
| Text controls | IMPLEMENTED | Deterministic generated bindings; explicit `headline` compatibility preserved |
| Image controls | IMPLEMENTED | Package-relative enum/defaults and safe runtime swapping |
| Color controls | IMPLEMENTED | Fill/stroke `#rrggbb` controls with OGraf `color-rrggbb` schema |
| Runtime `updateAction` | IMPLEMENTED | Text/image/color writes rendered in generated runtime |
| Host QA packages | GENERATED | `C:\Users\ertugrul.ak\Desktop\kcs-ograf-public-controls-qa` |
| Automated validation | PASS | TypeScript/lint/Vitest/build/V6/E2E/manifest checks |
| Manual public-controls host QA | PENDING | User must test the new QA folders |

## Protected state

- `main` remains protected and unchanged at `8024d4f`.
- No merge to `main` is authorized by this milestone.
- Historical reports and old host QA folders are preserved.
- Read-only corpus: `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.
- `.omp/backups/` is preserved and ignored.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, and global configuration remain unchanged.

## Current next action

Run manual public-controls host QA in BASIC → ASSET → COMPOSITING, record exact control behavior, then request release approval. Do not merge `main`.
