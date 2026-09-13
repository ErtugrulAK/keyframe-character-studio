# KCS Branch Status

Public-controls work is now consolidated into the integration RC branch while remaining isolated from `main` and from the separate OMP tooling branch.

| BRANCH | PURPOSE | BASE | STATUS | LATEST KNOWN COMMIT | MERGE TARGET | NEXT ACTION |
|---|---|---|---|---|---|---|
| `main` | Protected release baseline | — | PROTECTED / UNCHANGED | `8024d4f` | None without explicit approval | Preserve |
| `integration/v6-ui-stable` | V6 UI integration baseline | V6 predecessor | BASE | `0289402` | RC | Preserve |
| `integration/v6-ui-ograf-release-candidate` | Product/docs release candidate | `integration/v6-ui-stable` | READY / BASE | `4e4c269` | Public-controls RC | Preserve |
| `integration/v6-ui-ograf-public-controls-rc` | Consolidated public-controls integration RC | RC@`4e4c269` + public-controls tip | CURRENT / PUSHED | `2a6b5dc` | None without explicit approval | Request main merge approval |
| `feat/ograf-public-controls-v1` | Host-editable text/image/color controls | RC@`4e4c269` | QA-PASS / SOURCE | `2a6b5dc` | Integration RC | Preserve |
| `chore/omp-kcs-config-optimization` | Project-local OMP policy | Independent | SEPARATE / COMPLETE | `50b42d4` | None by default | Keep separate |

## Public-controls scope

- Text fields are generated for visible text layers, with explicit `headline` compatibility.
- Image fields use package-relative enum/default paths and runtime safe-value checks; ASSET QA includes default and alternate resources.
- Fill/stroke fields use deterministic IDs, `format: color`, and OGraf `color-rrggbb` schema metadata.
- Matte-source helper layers are excluded.

## Protected invariants

`main` remains at `8024d4f`. `memory.backend: mnemopi`, model/provider mappings, global OMP configuration, `.omp/backups/`, old QA folders, and the read-only corpus remain unchanged. The integration RC consolidation used a fast-forward-compatible branch creation only.
