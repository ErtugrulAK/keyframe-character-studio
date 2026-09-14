# KCS Project State

## Current position

The accepted integration is on `main@b34879a`. The release tag `v1.1.0-public-controls` resolves to `0a71bd8` in this checkout. The current working branch is `feat/windows-path-hardening-v1`, a review-only feature branch based on main. The source and integration branches remain separate where preserved.

## Accepted baseline

The branch includes the accepted V3.4.1, V3.5, V3.6/OGraf Package V2, OGraf V2.1, host compatibility, public controls, presentation documentation, and release-candidate integration line. The OMP tooling branch remains separate.

## Public controls status

| Area | Status | Evidence |
|---|---|---|
| Text controls | IMPLEMENTED | Deterministic generated bindings; explicit `headline` compatibility preserved |
| Image controls | QA-PASS | Package-relative enum/defaults include default and alternate ASSET resources; target-host replacement confirmed |
| Color controls | QA-PASS | Visible fill/stroke fields include `format: color`, OGraf `color-rrggbb`, lowercase hex pattern; target-host changes confirmed |
| Runtime `updateAction` | IMPLEMENTED | Text/image/color writes rendered in generated runtime; unsafe image paths rejected |
| Host QA packages | QA-PASS | External BASIC, ASSET, and COMPOSITING packages |
| Automated validation | COMPLETE | AJV manifests, Vitest, TypeScript, lint, build, V6 QA, and equivalent Playwright coverage completed |
| Manual public-controls host QA | PASS | BASIC text/motion, ASSET image replacement, and COMPOSITING color controls confirmed |

## Windows Path Hardening V1

Implemented on `feat/windows-path-hardening-v1`. The feature centralizes Windows-safe filename and package-relative path handling for standard KCS downloads, OGraf IDs, package assets, browser ZIP entries, and filesystem materialization. Focused validation passes: 3 test files / 27 tests and TypeScript.

Evidence: `docs/KCS_WINDOWS_PATH_HARDENING.md` and `reports/progress_068.md`.

## `without-mask` decision

`origin/without-mask` is a standalone root-commit project snapshot with no merge base against `main`. It contains unique source, tests, docs, database artifacts, and wiki/assets content. It is classified **ARCHIVE** and remains untouched. See `docs/KCS_WITHOUT_MASK_BRANCH_AUDIT.md` and `reports/progress_066.md`.

## Protected state

- `main` remains integrated at `b34879a`.
- Release tag `v1.1.0-public-controls` remains unchanged at the observed `0a71bd8`.
- Historical reports and old host QA folders are preserved.
- Read-only corpus: `C:\Users\ertugrul.ak\Desktop\ograf-graphics`; do not modify.
- `.omp/backups/` is preserved and ignored.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, and global configuration remain unchanged.
- No branch merge or release-tag change is part of this task.

## Current next action

Complete full validation on `feat/windows-path-hardening-v1`, push the feature branch, and review it without merging to main.
