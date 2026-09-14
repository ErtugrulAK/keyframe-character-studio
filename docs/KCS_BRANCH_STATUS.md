# KCS Branch Status

Public-controls work, Windows path hardening, and prototype-key security hardening are integrated into `main`. The current documentation state is synchronized with `origin/main`; `without-mask` and the OMP tooling branch remain separate and untouched.

| BRANCH | PURPOSE | STATUS | LATEST KNOWN COMMIT | NEXT ACTION |
|---|---|---|---|---|
| `main` | Protected product baseline | INTEGRATED / RELEASE CONDITIONAL | Current synchronized main | Keep protected; resolve security follow-ups before release |
| `feat/prototype-key-security-hardening` | Prototype-key security patch | MERGED / PRESERVED | `8a89538` | Keep branch; no deletion |
| `feat/windows-path-hardening-v1` | Windows path hardening | MERGED / PRESERVED | `b6fca49` | Keep branch; no deletion |
| `feat/ograf-validation-fixtures-and-guards` | Narrow malformed-plan content guards | PUSHED / REVIEW REQUIRED | `a3269ab` | Review before any merge |
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

`v1.1.0-public-controls` remains unchanged at annotated tag object `0a71bd8` (peeled commit `6351d1a`). `memory.backend: mnemopi`, model/provider mappings, global OMP configuration, `.omp/backups/`, old QA folders, and the read-only corpus remain unchanged. No release tag was created or moved.
## Security follow-up state

The merged prototype-key patch is validated. SVG input, mask/matte semantics, parent cycles, sourcePath provenance, filesystem link/TOCTOU, broadcast-state maps, and fixture/validator policy remain separately scoped; see `reports/progress_077.md` and `reports/progress_080.md`.
