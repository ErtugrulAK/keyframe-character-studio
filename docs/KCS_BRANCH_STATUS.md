# KCS Branch Status

Public-controls work is isolated from `main` and from the separate OMP tooling branch.

| BRANCH | PURPOSE | BASE | STATUS | LATEST KNOWN COMMIT | MERGE TARGET | NEXT ACTION |
|---|---|---|---|---|---|---|
| `main` | Protected release baseline | — | PROTECTED / UNCHANGED | `8024d4f` | None without explicit approval | Preserve |
| `integration/v6-ui-stable` | V6 UI integration baseline | V6 predecessor | BASE | `0289402` | RC | Preserve |
| `integration/v6-ui-ograf-release-candidate` | Product/docs release candidate | `integration/v6-ui-stable` | READY | `4e4c269` | Public-controls branch | Preserve |
| `feat/ograf-public-controls-v1` | Host-editable text/image/color controls | RC@`4e4c269` | ACTIVE | Uncommitted milestone changes | None yet | Manual host QA |
| `chore/omp-kcs-config-optimization` | Project-local OMP policy | Independent | SEPARATE / COMPLETE | `50b42d4` | None by default | Keep separate |

## Public-controls scope

- Text fields are generated for visible text layers, with explicit `headline` compatibility.
- Image fields use package-relative enum/default paths and runtime safe-value checks.
- Fill/stroke fields use deterministic IDs and OGraf `color-rrggbb` schema metadata.
- Matte-source helper layers are excluded.

## Protected invariants

`main` remains at `8024d4f`. `memory.backend: mnemopi`, model/provider mappings, global OMP configuration, `.omp/backups/`, old QA folders, and the read-only corpus remain unchanged.
