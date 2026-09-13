# KCS Branch Status

Public-controls work is integrated into `main@717d662` (with RC tip `111c101` in its ancestry). The source and integration branches remain available. The OMP tooling branch remains separate. Cleanup is classified, not executed.

| BRANCH | PURPOSE | BASE | STATUS | LATEST KNOWN COMMIT | MERGE TARGET | NEXT ACTION |
|---|---|---|---|---|---|---|
| `main` | Protected product baseline | — | INTEGRATED / PUSHED | `717d662` | None | Review release checkpoint |
| `integration/v6-ui-stable` | V6 UI integration baseline | V6 predecessor | BASE / MERGED | `0289402` | RC | Candidate only after approval |
| `integration/v6-ui-ograf-release-candidate` | Product/docs release candidate | `integration/v6-ui-stable` | READY / MERGED | `4e4c269` | Public-controls RC | Candidate only after approval |
| `integration/v6-ui-ograf-public-controls-rc` | Consolidated public-controls integration RC | RC@`4e4c269` + public-controls tip | INTEGRATED / PUSHED | `111c101` | Main | Candidate only after approval |
| `feat/ograf-public-controls-v1` | Host-editable text/image/color controls | RC@`4e4c269` | QA-PASS / MERGED SOURCE | `2a6b5dc` | Integration RC | Candidate only after approval |
| `chore/omp-kcs-config-optimization` | Project-local OMP policy | Independent | SEPARATE / COMPLETE | `50b42d4` | None by default | Keep separate |

## Public-controls scope

- Text fields are generated for visible text layers, with explicit `headline` compatibility.
- Image fields use package-relative enum/default paths and runtime safe-value checks; ASSET QA includes default and alternate resources.
- Fill/stroke fields use deterministic IDs, `format: color`, and OGraf `color-rrggbb` schema metadata.
- Matte-source helper layers are excluded.

## Protected invariants

`main` is integrated at `717d662` with RC tip `111c101` in ancestry. `memory.backend: mnemopi`, model/provider mappings, global OMP configuration, `.omp/backups/`, old QA folders, and the read-only corpus remain unchanged. No branches were deleted.
