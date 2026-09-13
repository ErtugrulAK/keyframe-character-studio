# KCS Project State

## Current position

The repository is on `feat/ograf-public-controls-v1`, based on `integration/v6-ui-ograf-release-candidate@4e4c269`. The feature branch adds host-editable OGraf text, image, and color controls. `main` remains untouched.

## Accepted baseline

The branch includes the accepted V3.4.1, V3.5, V3.6/OGraf Package V2, OGraf V2.1, host compatibility, and release-candidate integration line. The OMP tooling branch remains separate.

## Public controls status

| Area | Status | Evidence |
|---|---|---|
| Text controls | IMPLEMENTED | Deterministic generated bindings; explicit `headline` compatibility preserved |
| Image controls | QA-VERIFIABLE | Package-relative enum/defaults now include default and alternate ASSET resources; safe runtime swapping |
| Color controls | QA-VERIFIABLE | Visible fill/stroke fields include `format: color`, OGraf `color-rrggbb`, lowercase hex pattern |
| Runtime `updateAction` | IMPLEMENTED | Text/image/color writes rendered in generated runtime; unsafe image paths rejected |
| Host QA packages | REGENERATED | `C:\Users\senmu\Masaüstü\kcs-ograf-public-controls-qa` with two ASSET image choices |
| Automated validation | IN PROGRESS | Focused and full Vitest/TypeScript completed; remaining commands recorded in progress report |
| Manual public-controls host QA | NEEDS SECOND PASS | BASIC previously PASS; ASSET and COMPOSITING require host retest with explicit controls |

## Protected state

- `main` remains protected and unchanged at `8024d4f`.
- No merge to `main` is authorized by this milestone.
- Historical reports and old host QA folders are preserved.
- Read-only corpus: `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.
- `.omp/backups/` is preserved and ignored.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, and global configuration remain unchanged.

## Current next action

Run second manual public-controls host QA in BASIC → ASSET → COMPOSITING. In ASSET select `assets/images/logo_alt.svg`; in COMPOSITING edit `Content Fill Color` to `#00ff00` and `Content Stroke Color` to `#0000ff`. Do not merge `main`.
