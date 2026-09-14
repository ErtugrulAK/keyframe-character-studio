# KCS Open Tasks

## P0 — Final synchronization and branch decision

- Keep the Work PC repository and global OMP tooling synchronized.
- `without-mask` inspection is complete; preserve it as an archive candidate.
- Move to GitHub Actions/CI after the archive decision remains explicitly approved.

## Current release state

Public Controls V1 and the reviewed GitHub presentation materials are integrated into `main`. The release tag `v1.1.0-public-controls` targets `6351d1a`; current main is `258dda3`.

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

## P2 — Non-blocking follow-up

- Windows case/device-name hardening.
- Font catalog UI and portable-font UX without unowned fallback binaries.
- Release tag/changelog polishing.

## Invariants

- Keep `main` at the accepted release checkpoint.
- Keep `memory.backend: mnemopi`.
- Keep model/provider mappings and global config unchanged.
- Preserve standard OGraf export, legacy single-file export, KCS project export, and KCS Import behavior.
