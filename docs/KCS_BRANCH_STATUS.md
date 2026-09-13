# KCS Branch Status

Public-controls work is integrated into `main`; the GitHub presentation review branch was fast-forwarded into main at `07f3d84`. The original `docs/github-presentation` branch and `without-mask` remain separate and untouched.

| BRANCH | PURPOSE | STATUS | LATEST KNOWN COMMIT | NEXT ACTION |
|---|---|---|---|---|
| `main` | Protected product baseline | INTEGRATED / RELEASE-TAGGED | `07f3d84` plus merge result docs | Review imported presentation material |
| `chore/omp-kcs-config-optimization` | Project-local OMP policy | SEPARATE / COMPLETE | `50b42d4` | Keep separate |
| `docs/github-presentation` | Original presentation source | PRESERVED / UNCHANGED | `8540165` | Decide deletion separately |
| `without-mask` | Divergent historical line | UNKNOWN / PRESERVED | `eb1d9b4` | Manual keep/archive decision |

## Public-controls scope

- Text fields are generated for visible text layers, with explicit `headline` compatibility.
- Image fields use package-relative enum/default paths and runtime safe-value checks; ASSET QA includes default and alternate resources.
- Fill/stroke fields use deterministic IDs, `format: color`, and OGraf `color-rrggbb` schema metadata.
- Matte-source helper layers are excluded.

## Protected invariants

`main` is release-tagged at `6351d1a` as `v1.1.0-public-controls`. `memory.backend: mnemopi`, model/provider mappings, global OMP configuration, `.omp/backups/`, old QA folders, and the read-only corpus remain unchanged. No source/package files changed.
