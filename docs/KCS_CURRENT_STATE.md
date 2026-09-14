# KCS Current State

The accepted KCS product and documentation line is integrated into `main@0f321c4`; the release tag `v1.1.0-public-controls` remains unchanged at `0a71bd8` in this checkout. Prototype-sensitive imported-key hardening is merged and documented in `reports/progress_075.md` and `reports/progress_076.md`. The `without-mask` manual decision remains archive/preserve, and the OMP tooling branch remains separate.

## Public Controls V1

- Text: deterministic fields for visible text layers; explicit `headline` compatibility remains supported.
- Image: package-relative enum/default fields for verified portable image assets; runtime swaps `imageUrl` only to an allowed packaged path.
- Color: deterministic fill/stroke fields for eligible visible layers using `format: color`, `gddType: color-rrggbb`, and lowercase `#rrggbb` validation.
- Matte helper/source layers are excluded from generated controls.
- Current transform, opacity, trim, mask, and path animation channels remain authoritative. No color channels exist in the current animation contract, so public color writes update the stable base paint.

Specification: `docs/design/KCS_OGRAF_PUBLIC_CONTROLS_V1_SPEC.md`.

## Windows Path Hardening V1

The feature branch `feat/windows-path-hardening-v1` added centralized Windows filename and package-relative path safety for KCS downloads, OGraf IDs, package assets, browser ZIP entries, and filesystem materialization. Its hardening is now present in `main`; it rejects invalid characters, device names, trailing dots/spaces, traversal, absolute/UNC/drive paths, unsafe package segments, and case-insensitive package collisions while preserving valid OGraf structure and public-controls behavior.

Specification and evidence: `docs/KCS_WINDOWS_PATH_HARDENING.md` and `reports/progress_068.md`.

## `without-mask` branch decision

`origin/without-mask` is a root commit with no parent and no merge base with `main`. It is a complete standalone KCS project snapshot containing source, tests, docs, database artifacts, and a large wiki/assets corpus. No current PR or issue reference was found by the available `gh` queries.

Classification: **ARCHIVE**. The remote branch remains untouched. Future rename, bundle archive, deletion, merge, cherry-pick, or selected import requires explicit approval. Full evidence is recorded in `docs/KCS_WITHOUT_MASK_BRANCH_AUDIT.md` and `reports/progress_066.md`.

## Protected state

- `main` remains integrated at `0f321c4`.
- Release tag `v1.1.0-public-controls` remains unchanged at the observed `0a71bd8`.
- Historical reports and old host QA folders are preserved.
- Read-only corpus: `C:\Users\ertugrul.ak\Desktop\ograf-graphics`; do not modify.
- `.omp/backups/` is preserved and ignored.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, and global configuration remain unchanged.

## Validation status
- Security hardening focused tests: PASS — 5 files / 75 tests.
- Full Vitest: PASS — 101 files / 1,479 tests.
- TypeScript, lint, and production build: PASS; only pre-existing warnings remain.
- `validate:ograf`: no repository manifests; script usage exit 2 is not applicable to this checkout.
- Production release remains conditional on separately tracked SVG input, mode, parent-cycle, source-path, filesystem, and broadcast-state follow-ups.

## Next order
1. Track the security follow-ups as separate scoped work; do not fold them into the merged prototype-key patch.
2. Keep the release tag and `without-mask` branch unchanged pending explicit approval.
