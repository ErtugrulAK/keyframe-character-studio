# KCS Branch Status

Public-controls work, presentation materials, and the final cleanup state are integrated into `main`. The current docs-only checkpoint is being recorded from `main@258dda3`; `without-mask` and the OMP tooling branch remain separate and untouched.

| BRANCH | PURPOSE | STATUS | LATEST KNOWN COMMIT | NEXT ACTION |
|---|---|---|---|---|
| `main` | Protected product baseline | INTEGRATED / RELEASE-TAGGED | `258dda3` | Keep protected |
| `chore/omp-kcs-config-optimization` | Project-local OMP policy | SEPARATE / COMPLETE | `50b42d4` | Keep separate |
| `without-mask` | Independent historical project snapshot | ARCHIVE / PRESERVED | `eb1d9b4` | Leave untouched; separate archive approval required |

## `without-mask` audit

`origin/without-mask` is a root commit with no merge base against `main`. It contains a complete standalone KCS variant with source, tests, documentation, database artifacts, and a large wiki/assets corpus. No current GitHub PR or issue reference was found by the audit queries. See `docs/KCS_WITHOUT_MASK_BRANCH_AUDIT.md` and `reports/progress_066.md`.

## Public-controls scope

- Text fields are generated for visible text layers, with explicit `headline` compatibility.
- Image fields use package-relative enum/default paths and runtime safe-value checks; ASSET QA includes default and alternate resources.
- Fill/stroke fields use deterministic IDs, `format: color`, and OGraf `color-rrggbb` schema metadata.
- Matte-source helper layers are excluded.

## Protected invariants

`main` is release-tagged at `6351d1a` as `v1.1.0-public-controls`. `memory.backend: mnemopi`, model/provider mappings, global OMP configuration, `.omp/backups/`, old QA folders, and the read-only corpus remain unchanged. No product source/package/test files changed in this audit.
