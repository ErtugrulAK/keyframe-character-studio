# KCS Current State

The accepted KCS product and documentation line is integrated into `main@258dda3`; the release tag `v1.1.0-public-controls` points to `6351d1a`. Safe merged branch cleanup, safe Copilot cleanup, and the GitHub presentation import/cleanup are complete. The `without-mask` manual decision is now classified as archive/preserve, and the OMP tooling branch remains separate.

## Public Controls V1

- Text: deterministic fields for visible text layers; explicit `headline` compatibility remains supported.
- Image: package-relative enum/default fields for verified portable image assets; runtime swaps `imageUrl` only to an allowed packaged path.
- Color: deterministic fill/stroke fields for eligible visible layers using `format: color`, `gddType: color-rrggbb`, and lowercase `#rrggbb` validation.
- Matte helper/source layers are excluded from generated controls.
- Current transform, opacity, trim, mask, and path animation channels remain authoritative. No color channels exist in the current animation contract, so public color writes update the stable base paint.

Specification: `docs/design/KCS_OGRAF_PUBLIC_CONTROLS_V1_SPEC.md`.

## `without-mask` branch decision

`origin/without-mask@eb1d9b4` is a root commit with no parent and no merge base with `main`. It is a complete standalone KCS project snapshot containing source, tests, docs, database artifacts, and a large wiki/assets corpus. No current PR or issue reference was found by the available `gh` queries.

Classification: **ARCHIVE**. The remote branch remains untouched. Future rename, bundle archive, deletion, merge, cherry-pick, or selected import requires explicit approval. Full evidence is recorded in `docs/KCS_WITHOUT_MASK_BRANCH_AUDIT.md` and `reports/progress_066.md`.

## Protected state

- `main` is integrated at `258dda3`.
- Release tag `v1.1.0-public-controls` points to `6351d1a`.
- Historical reports and old host QA folders are preserved.
- Read-only corpus: `C:\Users\ertugrul.ak\Desktop\ograf-graphics`; do not modify.
- `.omp/backups/` is preserved and ignored.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, and global configuration remain unchanged.

## Validation status

- Release checkpoint and Work PC sync: PASS.
- `without-mask` read-only audit: PASS; no merge base, standalone root snapshot.
- `gh` PR/issue searches for `without-mask`: no results.
- `git diff --check`: PASS for the audit documentation change.

## Next order

1. Preserve `without-mask` as an archive candidate unless a later approval changes the decision.
2. Move to GitHub Actions/CI.
