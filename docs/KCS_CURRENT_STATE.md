# KCS Current State

The accepted KCS product and documentation line is integrated into `main@b34879a`; the release tag `v1.1.0-public-controls` resolves to `0a71bd8` in this checkout. Safe merged branch cleanup, safe Copilot cleanup, and the GitHub presentation import/cleanup are complete. The `without-mask` manual decision is classified as archive/preserve, and the OMP tooling branch remains separate.

## Public Controls V1

- Text: deterministic fields for visible text layers; explicit `headline` compatibility remains supported.
- Image: package-relative enum/default fields for verified portable image assets; runtime swaps `imageUrl` only to an allowed packaged path.
- Color: deterministic fill/stroke fields for eligible visible layers using `format: color`, `gddType: color-rrggbb`, and lowercase `#rrggbb` validation.
- Matte helper/source layers are excluded from generated controls.
- Current transform, opacity, trim, mask, and path animation channels remain authoritative. No color channels exist in the current animation contract, so public color writes update the stable base paint.

Specification: `docs/design/KCS_OGRAF_PUBLIC_CONTROLS_V1_SPEC.md`.

## Windows Path Hardening V1

The feature branch `feat/windows-path-hardening-v1` adds centralized Windows filename and package-relative path safety for KCS downloads, OGraf IDs, package assets, browser ZIP entries, and filesystem materialization. It rejects invalid characters, device names, trailing dots/spaces, traversal, absolute/UNC/drive paths, unsafe package segments, and case-insensitive package collisions while preserving valid OGraf structure and public-controls behavior.

Specification and evidence: `docs/KCS_WINDOWS_PATH_HARDENING.md` and `reports/progress_068.md`.

## `without-mask` branch decision

`origin/without-mask` is a root commit with no parent and no merge base with `main`. It is a complete standalone KCS project snapshot containing source, tests, docs, database artifacts, and a large wiki/assets corpus. No current PR or issue reference was found by the available `gh` queries.

Classification: **ARCHIVE**. The remote branch remains untouched. Future rename, bundle archive, deletion, merge, cherry-pick, or selected import requires explicit approval. Full evidence is recorded in `docs/KCS_WITHOUT_MASK_BRANCH_AUDIT.md` and `reports/progress_066.md`.

## Protected state

- `main` remains integrated at `b34879a`.
- Release tag `v1.1.0-public-controls` remains unchanged at the observed `0a71bd8`.
- Historical reports and old host QA folders are preserved.
- Read-only corpus: `C:\Users\ertugrul.ak\Desktop\ograf-graphics`; do not modify.
- `.omp/backups/` is preserved and ignored.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, and global configuration remain unchanged.

## Validation status
- Windows path hardening focused tests: PASS — 3 files / 27 tests.
- Full Vitest: PASS — 101 files / 1,444 tests.
- TypeScript, lint, and production build: PASS; only pre-existing warnings remain.
- `validate:ograf`: no repository manifests; script usage exit 2 is not applicable to this checkout.
- Feature branch is ready for commit and push; no merge to main.
## Next order

1. Commit and push `feat/windows-path-hardening-v1` without merging it into `main`.
2. Review the feature branch before any merge decision.
