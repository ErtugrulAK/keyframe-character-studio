# KCS Branch Status

Public-controls work and the reviewed GitHub presentation materials are integrated into `main`. The original `docs/github-presentation` branch was deleted after import verification. `without-mask` and the OMP tooling branch remain separate and untouched.

| BRANCH | PURPOSE | STATUS | LATEST KNOWN COMMIT | NEXT ACTION |
|---|---|---|---|---|
| `main` | Protected product baseline | INTEGRATED / RELEASE-TAGGED | `4d8a5ca` | Decide without-mask policy |
| `chore/omp-kcs-config-optimization` | Project-local OMP policy | SEPARATE / COMPLETE | `50b42d4` | Keep separate |
| `without-mask` | Divergent historical line | UNKNOWN / PRESERVED | `eb1d9b4` | Manual keep/archive decision |

## Public-controls scope

- Text fields are generated for visible text layers, with explicit `headline` compatibility.
- Image fields use package-relative enum/default paths and runtime safe-value checks; ASSET QA includes default and alternate resources.
- Fill/stroke fields use deterministic IDs, `format: color`, and OGraf `color-rrggbb` schema metadata.
- Matte-source helper layers are excluded.

## Protected invariants

`main` is release-tagged at `6351d1a` as `v1.1.0-public-controls`. `memory.backend: mnemopi`, model/provider mappings, global OMP configuration, `.omp/backups/`, old QA folders, and the read-only corpus remain unchanged. No source/package files changed.
