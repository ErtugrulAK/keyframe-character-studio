# KCS Open Tasks

## P0 — Final synchronization and branch decision

- Keep the Work PC repository and global OMP tooling synchronized.
- `without-mask` inspection is complete; preserve it as an archive candidate.
- Move to GitHub Actions/CI after the archive decision remains explicitly approved.

## Current release state

Prototype-sensitive imported-key hardening is integrated into `main@0f321c4`; the release tag `v1.1.0-public-controls` remains unchanged at `0a71bd8` in this checkout. Production release remains conditional on separately tracked security follow-ups.

## `without-mask` decision

- Classification: `ARCHIVE`.
- `origin/without-mask` is a standalone root-commit project snapshot with no merge base against `main`.
- It contains unique source, tests, docs, database artifacts, and wiki/assets content.
- No PR or issue reference was found by the available `gh` searches.
- Keep the branch untouched. Any rename, bundle archive, deletion, merge, cherry-pick, or selected import requires separate approval.
- Evidence: `docs/KCS_WITHOUT_MASK_BRANCH_AUDIT.md` and `reports/progress_066.md`.

## Global tooling state

- Home PC and Work PC OMP/OpenCode tooling is configured and task delegation is ready.
- Context7 and Playwright MCP checks passed; gated tools remain gated.
- `memory.backend: mnemopi` and `modelRoles` remain unchanged.

## P2 — Windows path hardening V1

- The implementation is integrated into `main`; centralized filename and package-relative path safety remains active.
- Focused and full validation passes; only the no-manifest `validate:ograf` usage result and pre-existing warnings remain.
- Review `docs/KCS_WINDOWS_PATH_HARDENING.md` and `reports/progress_068.md`.
## P1 — Prototype-key security follow-ups

- Numeric/style SVG validation and escaping.
- Mask/matte mode allowlisting and escaping.
- OGraf parent-cycle rejection.
- `sourcePath` trust containment and filesystem symlink/TOCTOU hardening.
- Imported broadcast-state key hardening and direct malformed-plan materialization tests.
- Keep these follow-ups separate from the merged narrow patch.
## P2 — Non-blocking follow-up

- Font catalog UI and portable-font UX without unowned fallback binaries.
- Release tag/changelog polishing.

## Invariants

- Keep `main` at the accepted release checkpoint.
- Keep `memory.backend: mnemopi`.
- Keep model/provider mappings and global config unchanged.
- Preserve standard OGraf export, legacy single-file export, KCS project export, and KCS Import behavior.
