# KCS Branch Status

Public-controls work is integrated into `main@373d74b` (with RC tip `111c101` in its ancestry). The three approved safe Copilot branches were deleted after verification. The OMP tooling branch, `docs/github-presentation`, and `without-mask` remain separate.

| BRANCH | PURPOSE | STATUS | LATEST KNOWN COMMIT | NEXT ACTION |
|---|---|---|---|---|
| `main` | Protected product baseline | INTEGRATED / RELEASE-TAGGED | `373d74b` | Review presentation import |
| `chore/omp-kcs-config-optimization` | Project-local OMP policy | SEPARATE / COMPLETE | `50b42d4` | Keep separate |
| `docs/github-presentation` | Presentation docs | IMPORT CANDIDATE / PRESERVED | `8540165` | Create review branch only after approval |
| `without-mask` | Divergent historical line | UNKNOWN / PRESERVED | `eb1d9b4` | Manual keep/archive decision |

## Public-controls scope

- Text fields are generated for visible text layers, with explicit `headline` compatibility.
- Image fields use package-relative enum/default paths and runtime safe-value checks; ASSET QA includes default and alternate resources.
- Fill/stroke fields use deterministic IDs, `format: color`, and OGraf `color-rrggbb` schema metadata.
- Matte-source helper layers are excluded.

## Protected invariants

`main` is release-tagged at `6351d1a` as `v1.1.0-public-controls`; current main is `373d74b`. `memory.backend: mnemopi`, model/provider mappings, global OMP configuration, `.omp/backups/`, old QA folders, and the read-only corpus remain unchanged. No non-approved branch was deleted.
