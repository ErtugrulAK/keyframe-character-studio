# KCS Open Tasks

## P0 — Final synchronization and branch decision

- Sync the Work PC repository and global OMP tooling safely.
- Decide whether to keep or archive `without-mask`.
- Then move to GitHub Actions/CI work.

## Current release state

Public Controls V1 and the reviewed GitHub presentation materials are integrated into `main`. The original presentation branch and review branch were cleaned up. Release tag `v1.1.0-public-controls` targets `6351d1a`.

## Global tooling state

- Home PC OMP and OpenCode tooling is configured and subagent/task delegation is ready.
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
